import { useCallback, useEffect, useMemo, useState } from 'react'
import { App, Button, Empty, Modal, Popconfirm, Spin, Upload } from 'antd'
import { ClockCircleOutlined, DeleteOutlined, FileImageOutlined, LoadingOutlined, PlusOutlined, VideoCameraOutlined } from '@ant-design/icons'
import type { UploadProps } from 'antd'
import { dataManageApi } from '@/servers/dataManage'
import type { DroneTaskVO, HbdpUploadResource } from '@/types/dataManage'
import AuthenticatedPreview from './AuthenticatedPreview'
import { useResourceBlobUrl } from '@/utils/useResourceBlobUrl'

const MAX_FILE_BYTES = 50 * 1024 * 1024 // 50MB 单文件上限

function formatBytes(n?: number): string {
  if (n == null || !Number.isFinite(n)) return '-'
  if (n < 1024) return `${n} B`
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`
  return `${(n / 1024 / 1024).toFixed(2)} MB`
}

function isImageLike(r: HbdpUploadResource): boolean {
  if (r.fileType) return r.fileType === 'image'
  return (r.mimeType ?? '').startsWith('image/')
}

export interface DroneResourceModalProps {
  visible: boolean
  task: DroneTaskVO | null
  /** upload = 可上传 / 预览 / 删除 / 提交保存；view = 仅查看 */
  mode: 'upload' | 'view'
  onClose: () => void
  /** 保存成功后通知上层（一般用于刷新外层任务列表 resultCount） */
  onSaved?: () => void
}

/**
 * 无人机任务关联资源弹窗（二合一）
 *
 * - mode='upload'：可上传新图片 / 视频，删除已上传条目，"保存"把已上传 + 本次新上传的资源 ID 一并提交到
 *   POST /dpSys/data-manage/drone-task/result
 * - mode='view'：仅按 taskId 拉取已上传列表展示
 *
 * 数据来源：
 * - 列表：GET /dpSys/hbdp/wurenji/task/resources
 * - 上传：POST /dpSys/hbdp/resource/upload（FormData: file, businessType=drone_task）
 * - 删除：DELETE /dpSys/hbdp/resource/{id}
 * - 预览：GET /dpSys/hbdp/resource/preview/{id}（带 token 的二进制流）
 */
export default function DroneResourceModal({ visible, task, mode, onClose, onSaved }: DroneResourceModalProps) {
  const { message: msgApi } = App.useApp()
  const [loading, setLoading] = useState(false)
  const [serverResources, setServerResources] = useState<HbdpUploadResource[]>([])
  /** 本次新上传但尚未点"保存"的资源（已经上传到资源中心，但还没关联到任务） */
  const [newResources, setNewResources] = useState<HbdpUploadResource[]>([])
  /** 正在删除的资源 ID，置灰对应按钮 */
  const [deleting, setDeleting] = useState<Set<number>>(new Set())
  /** 正在保存中的资源 ID（上传中），用于显示进度 */
  const [uploading, setUploading] = useState<Set<string>>(new Set())
  const [saving, setSaving] = useState(false)
  /** 单条预览弹窗 */
  const [previewing, setPreviewing] = useState<HbdpUploadResource | null>(null)

  const editable = mode === 'upload'

  const allResources = useMemo(() => {
    // 本地新上传排在前面，已保存排在后面，便于识别
    return [...newResources, ...serverResources]
  }, [newResources, serverResources])

  const loadResources = useCallback(async () => {
    if (!task?.taskId) return
    setLoading(true)
    try {
      const list = await dataManageApi.getDroneTaskResources(task.taskId)
      setServerResources(Array.isArray(list) ? list : [])
    } catch (err) {
      msgApi.error(err instanceof Error ? err.message : '资源列表加载失败')
      setServerResources([])
    } finally {
      setLoading(false)
    }
  }, [task?.taskId, msgApi])

  useEffect(() => {
    if (visible && task?.taskId) {
      setNewResources([])
      setPreviewing(null)
      void loadResources()
    }
  }, [visible, task?.taskId, loadResources])

  /** 自定义上传：每个文件调一次接口，拿到 id 后合并到 newResources */
  const customUpload: UploadProps['customRequest'] = useCallback((options) => {
    const { file, onSuccess, onError } = options
    const f = file as File
    if (!f) {
      onError?.(new Error('invalid_file'))
      return
    }
    if (f.size > MAX_FILE_BYTES) {
      msgApi.warning(`单个文件不能超过 ${Math.round(MAX_FILE_BYTES / 1024 / 1024)} MB`)
      onError?.(new Error('too_large'))
      return
    }
    setUploading(prev => new Set(prev).add(f.name + ':' + f.size))
    void (async () => {
      try {
        const id = await dataManageApi.uploadDroneResource(f)
        setNewResources(prev => [
          ...prev,
          {
            id,
            fileName: f.name,
            fileSize: f.size,
            fileType: f.type.startsWith('video/') ? 'video' : 'image',
            mimeType: f.type,
            createTime: new Date().toISOString(),
            businessType: 'drone_task',
            businessId: task?.taskId,
            filePath: '',
          },
        ])
        onSuccess?.({} as unknown as Record<string, unknown>)
      } catch (err) {
        msgApi.error(err instanceof Error ? err.message : `${f.name} 上传失败`)
        const uploadErr = err instanceof Error ? err : new Error('upload_failed')
        onError?.(uploadErr)
      } finally {
        setUploading(prev => {
          const next = new Set(prev)
          next.delete(f.name + ':' + f.size)
          return next
        })
      }
    })()
  }, [msgApi, task?.taskId])

  const handleDelete = useCallback(async (r: HbdpUploadResource) => {
    if (r.id == null) return
    setDeleting(prev => new Set(prev).add(r.id))
    try {
      // 区分"本地新上传未保存"和"已保存到后端"：前者直接本地移除，后者调 DELETE
      const isNew = newResources.some(item => item.id === r.id)
      if (!isNew) {
        await dataManageApi.deleteDroneResource(r.id)
      }
      setNewResources(prev => prev.filter(item => item.id !== r.id))
      setServerResources(prev => prev.filter(item => item.id !== r.id))
      msgApi.success('已删除')
    } catch (err) {
      msgApi.error(err instanceof Error ? err.message : '删除失败')
    } finally {
      setDeleting(prev => {
        const next = new Set(prev)
        next.delete(r.id)
        return next
      })
    }
  }, [newResources, msgApi])

  /** 保存：把 newResources + serverResources 合并后整体提交 */
  const handleSave = async () => {
    if (!task?.taskId) return
    if (newResources.length === 0 && serverResources.length === 0) {
      msgApi.warning('暂无可保存的资源，请先上传')
      return
    }
    setSaving(true)
    try {
      const ids = allResources.map(r => r.id).filter((v): v is number => typeof v === 'number')
      await dataManageApi.submitDroneTaskResult({ taskId: task.taskId, resourceIds: ids })
      msgApi.success('保存成功')
      setNewResources([])
      await loadResources()
      onSaved?.()
    } catch (err) {
      msgApi.error(err instanceof Error ? err.message : '保存失败')
    } finally {
      setSaving(false)
    }
  }

  const titleSuffix = mode === 'upload' ? '上传资源' : '查看资源'
  const newCount = newResources.length
  const savedCount = serverResources.length
  const totalCount = newCount + savedCount

  return (
    <>
      <Modal
        open={visible}
        title={task?.taskName ? `${titleSuffix} · ${task.taskName}` : titleSuffix}
        onCancel={onClose}
        width={960}
        centered
        destroyOnClose
        footer={
          editable ? [
            <Button key="cancel" onClick={onClose}>取消</Button>,
            <Button
              key="save"
              type="primary"
              loading={saving}
              onClick={handleSave}
              disabled={totalCount === 0}
            >
              保存
            </Button>,
          ] : [
            <Button key="close" onClick={onClose}>关闭</Button>,
          ]
        }
      >
        <div className="min-h-[400px] flex flex-col">
          {/* 顶部摘要条 */}
          <div className="flex items-center justify-between px-3 py-2 mb-2 rounded border border-[rgba(255,255,255,0.08)] bg-[rgba(0,0,0,0.2)]">
            <span className="flex items-center gap-3 text-13px">
              {editable && newCount > 0 && (
                <span className="flex items-center gap-1 text-[#FFB024]">
                  <span className="w-2 h-2 rounded-full bg-[#FFB024]" />
                  待保存 {newCount}
                </span>
              )}
              <span className="flex items-center gap-1 text-[#A8D6FF]">
                <span className="w-2 h-2 rounded-full bg-[#52c41a]" />
                已上传 {savedCount}
              </span>
              <span className="text-[rgba(168,214,255,0.55)] text-12px">合计 {totalCount} 个</span>
            </span>
            <span className="text-[11px] text-[rgba(168,214,255,0.5)] truncate max-w-[420px]">{task?.taskId}</span>
          </div>

          {editable && (
            <div className="flex items-center justify-between mb-3 px-1 py-2.5 rounded border border-dashed border-[rgba(1,194,255,0.35)] bg-[rgba(1,194,255,0.04)]">
              <div className="text-[#A8D6FF] text-13px px-2">
                支持图片 / 视频，单文件不超过 {Math.round(MAX_FILE_BYTES / 1024 / 1024)} MB。上传后请点击底部「保存」提交关联。
              </div>
              <Upload
                multiple
                showUploadList={false}
                accept="image/*,video/mp4,.mp4,.mov,.heic"
                customRequest={customUpload}
              >
                <Button type="primary" icon={<PlusOutlined />}>
                  上传文件{uploading.size > 0 ? `（${uploading.size}个上传中）` : ''}
                </Button>
              </Upload>
            </div>
          )}

          {uploading.size > 0 && (
            <div className="mb-2 text-[#FFB024] text-12px flex items-center gap-1">
              <LoadingOutlined />
              当前有 {uploading.size} 个文件正在上传…
            </div>
          )}

          {loading ? (
            <div className="flex-1 flex items-center justify-center py-12 text-[rgba(168,214,255,0.7)] text-13px">
              加载资源中…
            </div>
          ) : allResources.length === 0 ? (
            <div className="flex-1 flex flex-col items-center justify-center py-6">
              <Empty
                imageStyle={{ height: 80 }}
                description={
                  <span className="text-[rgba(168,214,255,0.65)] text-13px">
                    {editable ? '暂未上传资源，请先上传后再保存' : '该任务尚无关联资源'}
                  </span>
                }
              />
              <div className="text-[11px] text-[rgba(168,214,255,0.4)] mt-2">任务 ID：{task?.taskId}</div>
            </div>
          ) : (
            <div className="drone-resource-list max-h-[65vh] overflow-y-auto pr-1 space-y-2.5">
              {allResources.map(r => {
                const isVideo = !isImageLike(r)
                const isNew = newResources.some(item => item.id === r.id)
                return (
                  <div
                    key={r.id + (isNew ? '_new' : '_svr')}
                    className={`group shrink-0 rounded-lg overflow-hidden border transition-all ${
                      isNew
                        ? 'border-[rgba(255,176,36,0.55)] hover:shadow-[0_0_10px_rgba(255,176,36,0.2)] bg-[rgba(0,0,0,0.25)]'
                        : 'border-[rgba(255,255,255,0.12)] bg-[rgba(0,0,0,0.25)] hover:border-[#01C2FF] hover:shadow-[0_0_8px_rgba(1,194,255,0.15)]'
                    }`}
                  >
                    <div
                      className="relative w-full h-300px overflow-hidden bg-[rgba(0,0,0,0.35)] cursor-pointer"
                      onClick={() => setPreviewing(r)}
                      title="点击放大预览"
                    >
                      {isNew && (
                        <div className="absolute top-1.5 left-1.5 z-10 px-1.5 py-0.5 rounded text-[10px] bg-[#FFB024] text-[#1a1a1a] font-medium">
                          未保存
                        </div>
                      )}
                      <AuthenticatedPreview id={r.id} name={r.fileName} />
                    </div>
                    <div className="px-2.5 py-1.5 flex items-center justify-between gap-2 bg-[rgba(0,0,0,0.2)]">
                      <span className="flex items-center gap-1 text-11px text-[#A8D6FF] min-w-0 flex-1">
                        {isVideo
                          ? <VideoCameraOutlined className="text-[#01C2FF] shrink-0" />
                          : <FileImageOutlined className="text-[#01C2FF] shrink-0" />}
                        <span className="truncate" title={r.fileName}>{r.fileName}</span>
                      </span>
                      <span className="text-[10px] text-[rgba(168,214,255,0.55)] shrink-0 flex items-center gap-1">
                        <span>{formatBytes(r.fileSize)}</span>
                        {r.createTime && (
                          <span className="flex items-center gap-0.5">
                            <ClockCircleOutlined className="opacity-60" />
                            {r.createTime.slice(0, 10)}
                          </span>
                        )}
                        {editable && (
                          <Popconfirm
                            title="删除该资源？"
                            description={isNew ? '本地新上传，取消关联即可' : '将从资源中心硬删除，且不可恢复'}
                            okText="删除"
                            okButtonProps={{ danger: true }}
                            cancelText="取消"
                            onConfirm={() => handleDelete(r)}
                          >
                            <Button
                              danger
                              size="small"
                              icon={<DeleteOutlined />}
                              loading={deleting.has(r.id)}
                              className="ml-2"
                            >
                              删除
                            </Button>
                          </Popconfirm>
                        )}
                      </span>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </Modal>

      {/* 单资源预览二次弹窗：标题 / 样式完全借鉴 drone/index.tsx:818 "图片/视频采集成果预览" */}
      <Modal
        open={!!previewing}
        onCancel={() => setPreviewing(null)}
        footer={null}
        centered
        width={960}
        destroyOnClose
        title={previewing && (() => {
          const isVideo = !isImageLike(previewing)
          return (
            <div className="flex items-center justify-between pr-8">
              <span className="text-[#03FBFD] text-17px font-bold flex items-center gap-2">
                {isVideo
                  ? <VideoCameraOutlined className="text-[#01C2FF]" />
                  : <FileImageOutlined className="text-[#01C2FF]" />}
                {isVideo ? '视频成果预览' : '图片成果预览'}
              </span>
              {previewing.createTime && (
                <span className="text-[rgba(168,214,255,0.7)] text-12px font-normal">
                  上传时间：{previewing.createTime}
                </span>
              )}
            </div>
          )
        })()}
      >
        {previewing && (() => {
          const isVideo = !isImageLike(previewing)
          return (
            <ResourcePreviewBody
              id={previewing.id}
              name={previewing.fileName}
              isVideo={isVideo}
            />
          )
        })()}
      </Modal>
    </>
  )
}

/**
 * 预览 Modal 的主区域：调用 useResourceBlobUrl 拿到带 token 的 blob URL，
 * 视频给 controls autoPlay，图片用 antd Image + preview 罩（可放大/旋转/全屏）。
 * 容器包裹圆角边框 + 阴影 / 渐变背景，模仿 drone 页"图片采集成果预览"的视觉。
 */
function ResourcePreviewBody({ id, name, isVideo }: { id: number; name: string; isVideo: boolean }) {
  const { url, error, reload } = useResourceBlobUrl(id)
  if (error) {
    return (
      <div className="flex flex-col items-center gap-3 py-8">
        <Button onClick={reload}>预览加载失败，点击重试</Button>
      </div>
    )
  }
  if (!url) {
    return (
      <div className="flex items-center justify-center gap-2 py-12 text-[#A8D6FF] text-13px">
        <Spin size="small" />加载预览…
      </div>
    )
  }
  if (isVideo) {
    return (
      <div className="flex flex-col items-center justify-center p-4 min-h-[300px] overflow-hidden">
        <div className="w-full flex flex-col items-center gap-3">
          <div className="w-full rounded-2xl overflow-hidden shadow-[0_0_30px_rgba(0,0,0,0.5)] border border-[rgba(255,255,255,0.2)] bg-black">
            <video src={url} controls autoPlay className="w-full max-h-[65vh] object-contain" />
          </div>
          <div className="text-[rgba(168,214,255,0.6)] text-12px">提示：支持画中画、全屏播放与倍速调节</div>
        </div>
      </div>
    )
  }
  return (
    <div className="flex flex-col items-center justify-center p-4 min-h-[300px] overflow-hidden">
      <div className="w-full flex flex-col items-center gap-3">
        <div className="p-2 rounded-2xl bg-[rgba(0,56,129,0.5)] border border-[rgba(255,255,255,0.2)] shadow-[0_0_30px_rgba(0,0,0,0.4)] flex items-center justify-center">
          <img src={url} alt={name} className="max-h-[62vh] max-w-full object-contain rounded-xl" />
        </div>
        <div className="text-[rgba(168,214,255,0.6)] text-12px">提示：点击图片可直接进行放大、旋转、全屏预览</div>
      </div>
    </div>
  )
}

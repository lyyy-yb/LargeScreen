import { useEffect, useState } from 'react'
import { Empty, Image, Modal, Spin } from 'antd'
import { ClockCircleOutlined, PlayCircleOutlined, VideoCameraOutlined, PictureOutlined } from '@ant-design/icons'
import { listFlyResult } from '@/servers/mapBox'
import type { DroneTaskVO } from '@/types/dataManage'

export interface FlyResultItem {
  resultsID: string
  resultsType: 'p' | 'v' | string
  resultsUrl: string
  resultsTime: string
}

export interface DroneApiResultModalProps {
  visible: boolean
  task: DroneTaskVO | null
  onClose: () => void
}

/**
 * 无人机任务来源=api 的"采集结果"查看弹窗。
 *
 * 卡片样式严格借鉴 src/pages/drone/index.tsx:617-641 "视频采集"侧栏：
 * - h-110px 缩略图（与 drone 一致）
 * - object-cover + 视频加 PlayCircle overlay
 * - rounded-lg 卡片，hover 边框/阴影
 * - 底部信息条紧凑字号
 *
 * 数据源：GET /dpSys/hbdp/wurenji/listFlyResult?jobID={taskId}
 * 弹窗 body：min-h-[400px] 防塌缩 + max-h-[65vh] overflow-y-auto 弹窗内滚动
 */
export default function DroneApiResultModal({ visible, task, onClose }: DroneApiResultModalProps) {
  const [loading, setLoading] = useState(false)
  const [items, setItems] = useState<FlyResultItem[]>([])
  const [previewing, setPreviewing] = useState<FlyResultItem | null>(null)

  useEffect(() => {
    if (!visible || !task?.taskId) return
    let active = true
    setLoading(true)
    listFlyResult({ jobID: task.taskId })
      .then(res => {
        if (!active) return
        const list = res?.resultCode === 0 && Array.isArray(res.data) ? (res.data as FlyResultItem[]) : []
        setItems(list)
      })
      .catch(() => { if (active) setItems([]) })
      .finally(() => { if (active) setLoading(false) })
    return () => { active = false }
  }, [visible, task?.taskId])

  return (
    <>
      <Modal
        open={visible}
        title={task?.taskName ? `采集结果 · ${task.taskName}` : '采集结果'}
        onCancel={onClose}
        footer={null}
        width={960}
        centered
        destroyOnClose
      >
        <div className="min-h-[400px] flex flex-col">
          {/* 顶部摘要条 */}
          <div className="flex items-center justify-between px-3 py-2 mb-2 rounded border border-[rgba(255,255,255,0.08)] bg-[rgba(0,0,0,0.2)]">
            <span className="flex items-center gap-3 text-13px">
              {items.filter(i => i.resultsType === 'v').length > 0 && (
                <span className="flex items-center gap-0.5 text-[#01C2FF]">
                  <VideoCameraOutlined />{items.filter(i => i.resultsType === 'v').length}
                </span>
              )}
              {items.filter(i => i.resultsType === 'p').length > 0 && (
                <span className="flex items-center gap-0.5 text-[#01C2FF]">
                  <PictureOutlined />{items.filter(i => i.resultsType === 'p').length}
                </span>
              )}
              <span className="text-[rgba(168,214,255,0.55)]">项采集成果</span>
            </span>
            <span className="text-[11px] text-[rgba(168,214,255,0.5)] truncate max-w-[420px]">{task?.taskId}</span>
          </div>

          {loading ? (
            <div className="flex-1 flex items-center justify-center gap-2 py-12 text-[#A8D6FF] text-13px">
              <Spin size="small" />加载采集结果中…
            </div>
          ) : items.length === 0 ? (
            <div className="flex-1 flex flex-col items-center justify-center py-6">
              <Empty
                imageStyle={{ height: 80 }}
                description={
                  <span className="text-[rgba(168,214,255,0.65)] text-13px">该任务暂无采集结果</span>
                }
              />
              <div className="text-[11px] text-[rgba(168,214,255,0.4)] mt-2">任务 ID：{task?.taskId}</div>
            </div>
          ) : (
            <div className="drone-result-list max-h-[65vh] overflow-y-auto pr-1 space-y-2.5">
              {items.map(item => {
                const isVideo = item.resultsType === 'v'
                return (
                  <div
                    key={item.resultsID}
                    className="group rounded-lg overflow-hidden border border-[rgba(255,255,255,0.12)] bg-[rgba(0,0,0,0.25)] hover:border-[#01C2FF] hover:shadow-[0_0_8px_rgba(1,194,255,0.15)] transition-all cursor-pointer"
                    onClick={() => setPreviewing(item)}
                    title="点击打开弹窗预览/播放"
                  >
                    <div className="relative w-full h-300px overflow-hidden bg-[rgba(0,0,0,0.35)]">
                      {isVideo ? (
                        <>
                          <video src={item.resultsUrl} className="w-full h-full object-cover" preload="metadata" muted />
                          <div className="absolute inset-0 flex items-center justify-center bg-[rgba(0,0,0,0.3)] group-hover:bg-[rgba(0,0,0,0.15)] transition-all">
                            <PlayCircleOutlined className="text-36px text-white/90 drop-shadow-md group-hover:scale-110 transition-transform" />
                          </div>
                        </>
                      ) : (
                        <Image src={item.resultsUrl} preview={false} className="w-full h-full object-cover" fallback="" />
                      )}
                    </div>
                    <div className="px-2.5 py-1.5 flex items-center justify-between bg-[rgba(0,0,0,0.2)]">
                      <span className="text-[#A8D6FF] text-11px truncate flex-1 flex items-center gap-1">
                        {isVideo
                          ? <><VideoCameraOutlined className="text-[#01C2FF]" />视频</>
                          : <><PictureOutlined className="text-[#01C2FF]" />图片</>}
                      </span>
                      <span className="text-[rgba(168,214,255,0.5)] text-10px shrink-0 flex items-center gap-1">
                        <ClockCircleOutlined className="opacity-60" />
                        {item.resultsTime || '-'}
                      </span>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </Modal>

      {/* 单条预览弹窗：标题 / 容器样式借鉴 drone/index.tsx:818 "视频/图片采集成果预览" */}
      <Modal
        open={!!previewing}
        onCancel={() => setPreviewing(null)}
        footer={null}
        width={960}
        centered
        destroyOnClose
        title={previewing && (
          <div className="flex items-center justify-between pr-8">
            <span className="text-[#03FBFD] text-17px font-bold flex items-center gap-2">
              {previewing.resultsType === 'v'
                ? <VideoCameraOutlined className="text-[#01C2FF]" />
                : <PictureOutlined className="text-[#01C2FF]" />}
              {previewing.resultsType === 'v' ? '视频采集成果预览' : '图片采集成果预览'}
            </span>
            {previewing.resultsTime && (
              <span className="text-[rgba(168,214,255,0.7)] text-12px font-normal">
                采集时间：{previewing.resultsTime}
              </span>
            )}
          </div>
        )}
      >
        {previewing && (
          <div className="flex flex-col items-center justify-center p-4 min-h-[300px] overflow-hidden">
            {previewing.resultsType === 'v' ? (
              <div className="w-full flex flex-col items-center gap-3">
                <div className="w-full rounded-2xl overflow-hidden shadow-[0_0_30px_rgba(0,0,0,0.5)] border border-[rgba(255,255,255,0.2)] bg-black">
                  <video
                    src={previewing.resultsUrl}
                    controls
                    autoPlay
                    className="w-full max-h-[65vh] object-contain"
                  />
                </div>
                <div className="text-[rgba(168,214,255,0.6)] text-12px">提示：支持画中画、全屏播放与倍速调节</div>
              </div>
            ) : (
              <div className="w-full flex flex-col items-center gap-3">
                <div className="p-2 rounded-2xl bg-[rgba(0,56,129,0.5)] border border-[rgba(255,255,255,0.2)] shadow-[0_0_30px_rgba(0,0,0,0.4)] flex items-center justify-center">
                  <Image
                    src={previewing.resultsUrl}
                    preview={{
                      mask: <div className="text-[#03FBFD] text-14px font-medium flex items-center gap-1">点击放大旋转预览</div>,
                    }}
                    className="max-h-[62vh] max-w-full object-contain rounded-xl"
                  />
                </div>
                <div className="text-[rgba(168,214,255,0.6)] text-12px">提示：点击图片可直接进行放大、旋转、全屏预览</div>
              </div>
            )}
          </div>
        )}
      </Modal>
    </>
  )
}

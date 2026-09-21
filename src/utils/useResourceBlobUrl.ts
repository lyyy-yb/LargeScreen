import { useEffect, useState } from 'react'
import { dataManageApi } from '@/servers/dataManage'

/**
 * hook：调用 GET /dpSys/hbdp/resource/preview/{id} 拉取二进制，转换成 blob URL。
 * - 自动挂载时拉取，组件卸载时 revoke
 * - 通过 `video` boolean 区分 mime 类型，供调用方选 <video> / <img>
 *
 * 适用场景：drone 任务资源导入（import）来源的视频/图片预览，URL 不能直接拼
 * （接口需要登录 token），必须由前端带 token 取 Blob 后再 URL.createObjectURL。
 *
 * 用于：
 * - src/pages/manage/components/AuthenticatedPreview.tsx 缩略图
 * - src/pages/manage/components/DroneResourceModal.tsx 二次预览
 * - src/pages/drone/index.tsx 视频采集列表 + 预览（drone-dataSource 分流）
 */
export function useResourceBlobUrl(id: number | string | null | undefined): {
  url: string
  video: boolean
  error: boolean
  revision: number
  reload: () => void
} {
  const [url, setUrl] = useState('')
  const [video, setVideo] = useState(false)
  const [error, setError] = useState(false)
  const [revision, setRevision] = useState(0)

  useEffect(() => {
    if (id == null || id === '') {
      setUrl('')
      setVideo(false)
      setError(false)
      return
    }
    let active = true
    let objectUrl = ''
    setUrl('')
    setError(false)
    dataManageApi.previewDroneResource(id)
      .then(blob => {
        if (!active) return
        objectUrl = URL.createObjectURL(blob)
        setVideo(blob.type.startsWith('video/'))
        setUrl(objectUrl)
      })
      .catch(() => { if (active) setError(true) })
    return () => {
      active = false
      if (objectUrl) URL.revokeObjectURL(objectUrl)
    }
  }, [id, revision])

  return {
    url,
    video,
    error,
    revision,
    reload: () => setRevision(v => v + 1),
  }
}

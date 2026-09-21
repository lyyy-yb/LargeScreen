import { Button, Spin } from 'antd'
import { PlayCircleOutlined } from '@ant-design/icons'
import { useResourceBlobUrl } from '@/utils/useResourceBlobUrl'

/**
 * 无人机任务资源缩略图预览：固定高度容器中铺满显示。
 * 视频加 PlayCircle overlay；图片 object-cover；加载/失败态给出友好提示。
 *
 * 内部委托 useResourceBlobUrl hook 完成带 token 的 blob URL 拉取与回收。
 * （hook 抽到 src/utils/useResourceBlobUrl.ts，drone 页也能复用。）
 */
export default function AuthenticatedPreview({ id, name }: { id: number | string; name: string }) {
  const { url, video, error, reload } = useResourceBlobUrl(id)

  if (error) {
    return <Button onClick={reload}>预览加载失败，点击重试</Button>
  }
  if (!url) return <Spin />
  if (video) {
    return (
      <>
        <video
          src={url}
          className="w-full h-full object-cover"
          preload="metadata"
          muted
          aria-label={name}
          onError={() => reload()}
        />
        <div className="absolute inset-0 flex items-center justify-center bg-[rgba(0,0,0,0.3)] transition-all pointer-events-none">
          <PlayCircleOutlined className="text-36px text-white/90 drop-shadow-md" />
        </div>
      </>
    )
  }
  return (
    <img
      src={url}
      alt={name}
      onError={() => reload()}
      className="w-full h-full object-cover block"
    />
  )
}

export { useResourceBlobUrl }

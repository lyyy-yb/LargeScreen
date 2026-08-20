import { useNavigate, useSearchParams } from 'react-router-dom'
import { Button, Image } from 'antd'
import { ArrowLeftOutlined, VideoCameraOutlined, PictureOutlined } from '@ant-design/icons'

export default function MediaPreview() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const url = searchParams.get('url') || ''
  const type = searchParams.get('type') || 'p'
  const time = searchParams.get('time') || ''

  const isVideo = type === 'v'

  return (
    <div className="w-full h-full relative flex flex-col overflow-hidden" style={{ background: '#1a5ab0' }}>
      {/* 顶栏 Header */}
      <div className="h-60px px-6 flex items-center justify-between bg-[rgba(0,56,129,0.85)] border-b border-[rgba(255,255,255,0.2)] shrink-0 z-10">
        <div className="flex items-center gap-4">
          <Button
            type="text"
            icon={<ArrowLeftOutlined />}
            onClick={() => navigate('/drone')}
            className="!text-[#03FBFD] !bg-[rgba(255,255,255,0.1)] hover:!bg-[rgba(255,255,255,0.2)] !rounded-2xl"
          >
            返回无人机机场
          </Button>
          <span className="text-[#A0C7FF] text-18px font-bold flex items-center gap-2">
            {isVideo ? <VideoCameraOutlined className="text-[#01C2FF]" /> : <PictureOutlined className="text-[#01C2FF]" />}
            视频采集成果预览
          </span>
        </div>
        {time && (
          <span className="text-[rgba(168,214,255,0.7)] text-13px">
            采集时间：{time}
          </span>
        )}
      </div>

      {/* 主展示区 Main Content */}
      <div className="flex-1 flex flex-col items-center justify-center p-6 overflow-hidden relative">
        {!url ? (
          <div className="text-[rgba(168,214,255,0.5)] text-14px">暂无媒体文件链接</div>
        ) : isVideo ? (
          <div className="w-full max-w-1000px flex flex-col items-center gap-3">
            <div className="w-full rounded-2xl overflow-hidden shadow-[0_0_30px_rgba(0,0,0,0.5)] border border-[rgba(255,255,255,0.2)] bg-black">
              <video
                src={url}
                controls
                autoPlay
                className="w-full max-h-[75vh] object-contain"
              />
            </div>
            <div className="text-[rgba(168,214,255,0.6)] text-12px">提示：支持画中画、全屏播放与倍速调节</div>
          </div>
        ) : (
          <div className="w-full max-w-1000px flex flex-col items-center gap-3">
            <div className="p-2 rounded-2xl bg-[rgba(0,56,129,0.5)] border border-[rgba(255,255,255,0.2)] shadow-[0_0_30px_rgba(0,0,0,0.4)] flex items-center justify-center">
              <Image
                src={url}
                preview={{
                  mask: <div className="text-[#03FBFD] text-14px font-medium flex items-center gap-1">点击放大旋转预览</div>,
                }}
                className="max-h-[72vh] max-w-full object-contain rounded-xl"
              />
            </div>
            <div className="text-[rgba(168,214,255,0.6)] text-12px">提示：点击图片可直接进行放大、旋转、全屏预览</div>
          </div>
        )}
      </div>
    </div>
  )
}

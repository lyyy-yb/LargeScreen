import type { CSSProperties } from 'react'
import { SendOutlined } from '@ant-design/icons'

export interface DispatchPointPopupProps {
  popup: { x: number; y: number; lng: number; lat: number }
  onDispatch: (lngLat: { lng: number; lat: number }) => void
}

/** 地图空白处点击弹窗（对齐 antd-demo showFlyPopup：单按钮"派遣无人机"） */
export default function DispatchPointPopup({ popup, onDispatch }: DispatchPointPopupProps) {
  const style: CSSProperties = {
    left: popup.x,
    top: Math.max(popup.y - 12, 8),
    transform: popup.y > 60 ? 'translate(-50%, -100%)' : 'translate(-50%, 0)',
  }
  return (
    <div
      className="absolute z-[9998] rounded-8px shadow-xl overflow-hidden"
      style={{ ...style, background: 'rgba(4,22,52,0.95)', border: '1px solid rgba(0,180,255,0.35)' }}
      onClick={e => e.stopPropagation()}
    >
      <button
        type="button"
        className="flex items-center gap-1.5 px-4 py-2 text-13px text-[#03FBFD] cursor-pointer hover:bg-[rgba(1,194,255,0.15)] transition-colors"
        onClick={() => onDispatch({ lng: popup.lng, lat: popup.lat })}
      >
        <SendOutlined />
        <span>派遣无人机</span>
      </button>
    </div>
  )
}

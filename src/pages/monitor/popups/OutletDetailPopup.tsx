import { useEffect, useRef, type CSSProperties } from 'react'
import {
  OUTLET_POPUP_WIDTH,
  OUTLET_POPUP_GAP,
  type OutletPointDetail,
} from './shared'

interface OutletDetailPopupProps {
  detail: OutletPointDetail
  onClose: () => void
}

/** 企业排口详情弹窗：展示排口名称、企业名称、许可证编号、管理类别、污染因子与经纬度 */
export default function OutletDetailPopup({ detail, onClose }: OutletDetailPopupProps) {
  const popupRef = useRef<HTMLDivElement>(null)

  // 点击弹窗外部区域时自动关闭弹窗
  useEffect(() => {
    const handlePointerDown = (event: MouseEvent | TouchEvent) => {
      if (popupRef.current && !popupRef.current.contains(event.target as Node)) {
        onClose()
      }
    }
    const timer = setTimeout(() => {
      document.addEventListener('mousedown', handlePointerDown)
      document.addEventListener('touchstart', handlePointerDown)
    }, 0)
    return () => {
      clearTimeout(timer)
      document.removeEventListener('mousedown', handlePointerDown)
      document.removeEventListener('touchstart', handlePointerDown)
    }
  }, [onClose])

  // 优先展示在点击位置上方，上方放不下时翻转到下方；无坐标时居中
  const pos = detail.pos
  const anchorStyle: CSSProperties = pos
    ? {
        left: `min(max(${OUTLET_POPUP_WIDTH / 2 + 8}px, ${pos.x}px), calc(100% - ${OUTLET_POPUP_WIDTH / 2 + 8}px))`,
        top: Math.max(pos.y - OUTLET_POPUP_GAP, 8),
        transform: pos.y > 220 ? `translate(-50%, -100%)` : 'translate(-50%, 0)',
      }
    : { left: '50%', top: '50%', transform: 'translate(-50%, -50%)' }

  const rows: { label: string; value: string }[] = [
    { label: '企业名称', value: detail.companyName || '--' },
    { label: '许可证编号', value: detail.licenseNo || '--' },
    { label: '管理类别', value: detail.manageCategory || '--' },
    { label: '污染因子', value: detail.pollutants || '--' },
    { label: '经纬度', value: `${detail.lng.toFixed(6)}，${detail.lat.toFixed(6)}` },
  ]

  return (
    <div
      ref={popupRef}
      className="absolute z-[99999] p-3 rounded-8px border border-[#9aa7b4]/45 bg-[rgba(10,18,32,0.94)] shadow-[0_8px_28px_rgba(0,10,35,0.55)] box-border"
      style={{ ...anchorStyle, width: OUTLET_POPUP_WIDTH }}
    >
      <div className="flex items-center justify-between mb-2 pb-2 border-b border-[#9aa7b4]/25">
        <span className="text-[#d0d8e0] text-13px font-bold truncate">{detail.outletName || '企业排口'}</span>
        <button
          type="button"
          className="text-[#7088a8] hover:text-white text-13px leading-none px-1 cursor-pointer"
          onClick={onClose}
        >
          ✕
        </button>
      </div>
      <div className="flex flex-col gap-1.5">
        {rows.map((row) => (
          <div key={row.label} className="flex items-start gap-2 text-11px leading-1.6">
            <span className="text-[#7088a8] shrink-0 w-56px">{row.label}</span>
            <span className="text-[#d0d8e0] break-all">{row.value}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

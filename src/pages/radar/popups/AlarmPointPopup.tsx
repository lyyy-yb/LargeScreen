import type { CSSProperties } from 'react'
import { Button } from 'antd'
import type { AlarmItem } from '../shared'

/** 告警点位弹窗固定估算尺寸（锚定定位计算用） */
const ALARM_POPUP_W = 296
const ALARM_POPUP_H = 200

export interface AlarmPointPopupProps {
  popup: { item: AlarmItem; x: number; y: number }
  onCancel: () => void
  onConfirm: (item: AlarmItem) => void
}

/** 告警点位点击弹窗（对齐 antd-demo customDiv warn/error 分支："是否确认为污染源" 取消/确认） */
export default function AlarmPointPopup({ popup, onCancel, onConfirm }: AlarmPointPopupProps) {
  const { item, x, y } = popup
  const showAbove = y >= ALARM_POPUP_H + 14
  const style: CSSProperties = {
    width: ALARM_POPUP_W,
    left: `min(max(${ALARM_POPUP_W / 2 + 8}px, ${x}px), calc(100% - ${ALARM_POPUP_W / 2 + 8}px))`,
    top: showAbove ? y - 14 : y + 14,
    transform: `translate(-50%, ${showAbove ? '-100%' : '0'})`,
  }
  return (
    <div
      className="absolute z-[9998] rounded-10px p-3 text-[#A8D6FF] shadow-xl"
      style={{ ...style, background: 'rgba(4,22,52,0.95)', border: '1px solid rgba(0,180,255,0.35)', backdropFilter: 'blur(8px)' }}
      onClick={e => e.stopPropagation()}
    >
      <div className="text-[#03FBFD] text-13px font-700 mb-2">是否确认为污染源</div>
      <div className="space-y-1 text-12px">
        <p>位置：{item.address || '--'}</p>
        <p>经纬度：{item.dapLng}，{item.dapLat}</p>
        <p>次数：{item.times}</p>
      </div>
      <div className="flex justify-end gap-2 mt-3">
        <Button size="small" onClick={onCancel}>取消</Button>
        <Button size="small" type="primary" onClick={() => onConfirm(item)}>确认</Button>
      </div>
    </div>
  )
}

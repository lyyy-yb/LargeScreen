import { Switch } from 'antd'

export type PointMode = 'alert' | 'air'

export interface MapPointDisplayBarProps {
  pointMode: PointMode
  onPointModeChange: (mode: PointMode) => void
  showDronePoints: boolean
  onShowDroneChange: (v: boolean) => void
  showRadarPoints: boolean
  onShowRadarChange: (v: boolean) => void
  showEmissionOutletPoints: boolean
  onShowEmissionOutletChange: (v: boolean) => void
}

/** 地图底部水平居中：打点显示控件条（预警↔空气互斥 + 无人机/雷达/排口 Switch） */
export default function MapPointDisplayBar({
  pointMode,
  onPointModeChange,
  showDronePoints,
  onShowDroneChange,
  showRadarPoints,
  onShowRadarChange,
  showEmissionOutletPoints,
  onShowEmissionOutletChange,
}: MapPointDisplayBarProps) {
  const btnBase = 'text-11px px-3 py-1 rounded-4px border cursor-pointer transition-all bg-transparent'
  const btnActive = 'border-[#00f0ff] text-white bg-[#1890ff]/35 shadow-[0_0_8px_rgba(0,240,255,0.35)]'
  const btnIdle = 'border-[#2f9bff]/60 text-[#7bd7ff] hover:text-white hover:border-[#00f0ff]'
  return (
    <div className="point-display-bar absolute bottom-52px left-1/2 -translate-x-1/2 z-20 flex items-center gap-2 rounded-8px bg-[rgba(4,22,52,0.85)] px-2 py-1.5 border border-[#00d4ff]/30 shadow-[0_4px_12px_rgba(0,0,0,0.3)]">
      <button
        type="button"
        onClick={() => onPointModeChange('alert')}
        className={`${btnBase} ${pointMode === 'alert' ? btnActive : btnIdle}`}
      >
        预警点位
      </button>
      <button
        type="button"
        onClick={() => onPointModeChange('air')}
        className={`${btnBase} ${pointMode === 'air' ? btnActive : btnIdle}`}
      >
        空气质量监测站
      </button>
      <span className="w-1px h-16px bg-[#2f9bff]/40 mx-1" />
      <div className="flex items-center gap-1.5 text-[#d2ecff] text-11px">
        <span>无人机</span>
        <Switch size="small" checked={showDronePoints} onChange={onShowDroneChange} />
      </div>
      <div className="flex items-center gap-1.5 text-[#d2ecff] text-11px">
        <span>雷达</span>
        <Switch size="small" checked={showRadarPoints} onChange={onShowRadarChange} />
      </div>
      <div className="flex items-center gap-1.5 text-[#d2ecff] text-11px">
        <span>排口</span>
        <Switch size="small" checked={showEmissionOutletPoints} onChange={onShowEmissionOutletChange} />
      </div>
    </div>
  )
}

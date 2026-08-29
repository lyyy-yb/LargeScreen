import type { ReactNode } from 'react'
import DialGraphic from './DialGraphic'

/** 侧栏卡片通用面板样式（与父组件 sidePanelStyle 保持一致） */
const SIDE_PANEL_STYLE = {
  background: 'linear-gradient(160deg, rgba(7, 36, 78, 0.9), rgba(4, 22, 55, 0.85))',
  border: '1px solid rgba(0, 180, 255, 0.35)',
  boxShadow: '0 4px 24px rgba(0, 10, 35, 0.6), inset 0 0 15px rgba(0, 180, 255, 0.1)',
} as const

export interface StationStatItem {
  /** 行内小图标 class（is-blue / is-orange / is-warning-dot 等） */
  iconClass: string
  label: string
  value: number
  /** 数值 span 的修饰 class（is-yellow / is-warning） */
  valueClassName?: string
}

export interface StationListRow {
  id: string | number
  name: string
  tooltip: string
}

export interface StationStatusCardProps {
  /** less 修饰类：--drone / --radar */
  modifier: 'drone' | 'radar'
  title: string
  /** 标题左侧 3px 竖条颜色 + shadow */
  accentColor: string
  gifSrc: string
  alt: string
  unit: string
  totalCount: number
  onlineCount: number
  /** 是否用 is-offline 而非 is-warning-dot 展示离线（无人机场用前者） */
  offlineIconClass: 'is-offline' | 'is-warning-dot'
  /** 任务/告警 统计 section 标题 */
  sectionLabel: string
  statistics: StationStatItem[]
  stations: StationListRow[]
  maxStations?: number
  /** 列表项 hover 时的 class（光量子雷达有 hover:bg-white/5） */
  rowHoverClass?: string
  /** 列表项状态区由调用方渲染（无人机场含在线/离线 badge + modeLabel；雷达仅纯文字） */
  renderStationStatus: (station: StationListRow) => ReactNode
  onNavigate: () => void
}

/** 右侧面板通用 station 状态卡片：标题 + 仪表盘 + 统计 + 站点列表 + 详情按钮 */
export default function StationStatusCard({
  modifier,
  title,
  accentColor,
  gifSrc,
  alt,
  unit,
  totalCount,
  onlineCount,
  offlineIconClass,
  sectionLabel,
  statistics,
  stations,
  maxStations,
  rowHoverClass,
  renderStationStatus,
  onNavigate,
}: StationStatusCardProps) {
  const visibleStations = typeof maxStations === 'number' ? stations.slice(0, maxStations) : stations
  return (
    <section
      className={`status-card status-card--${modifier} flex-1 flex flex-col overflow-hidden rounded-10px p-3.5`}
      style={SIDE_PANEL_STYLE}
    >
      <div className="status-card__title flex items-center gap-2 mb-2">
        <span
          className="w-3px h-15px rounded-xs"
          style={{ backgroundColor: accentColor, boxShadow: `0 0 8px ${accentColor}` }}
        />
        <span className="text-white text-14px font-bold">{title}</span>
      </div>

      <div className="status-card__overview">
        <DialGraphic gifSrc={gifSrc} alt={alt} />
        <div className="status-card__headline">
          <div className="status-card__value">
            <strong>{totalCount}</strong>
            <span>{unit}</span>
          </div>
          <div className="status-card__availability">
            <div><i className="is-online" /><span>在线</span><b>{onlineCount}</b></div>
            <div><i className={offlineIconClass} /><span>离线</span><b className="is-warning">{totalCount - onlineCount}</b></div>
          </div>
        </div>
      </div>

      <div className="status-card__statistics">
        <div className="status-card__section-label">{sectionLabel}</div>
        {statistics.map(item => (
          <div key={item.label} className="status-card__row">
            <span><i className={item.iconClass} />{item.label}</span>
            <b className={item.valueClassName}>{item.value}</b>
          </div>
        ))}
      </div>

      <div className={`mt-2 ${maxStations ? 'max-h-72px' : 'max-h-120px'} overflow-y-auto space-y-1 pr-1`}>
        {visibleStations.map(station => (
          <div
            key={station.id}
            className={`flex items-center justify-between text-10px text-[#b2d9ff] ${rowHoverClass ?? ''} px-1 py-0.5 rounded`}
          >
            <span className="truncate pr-2 cursor-pointer" title={station.tooltip}>{station.name}</span>
            {renderStationStatus(station)}
          </div>
        ))}
        {!stations.length && <div className="text-10px text-[#7088a8]">暂无站点数据</div>}
      </div>

      <button
        type="button"
        onClick={onNavigate}
        className="status-card__button mt-auto text-11px transition-all cursor-pointer"
      >
        详情
      </button>
    </section>
  )
}

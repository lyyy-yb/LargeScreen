export interface MapLegendItem {
  /** 图标 src（可选） */
  icon?: string
  /** 文字标签 */
  label: string
  /** 用作占位的色块 class 或 inline 样式（适用于"飞行路线"这种条状） */
  placeholderClassName?: string
}

export interface MapLegendCardProps {
  title: string
  /** 标题左侧 3px 竖条颜色 */
  accentColor: string
  items: MapLegendItem[]
  /** 兼容 less 中的 --air / --drone / --radar / --warning 宽度修饰 */
  modifier?: 'air' | 'drone' | 'radar' | 'warning'
}

export function MapLegendCard({ title, accentColor, items, modifier }: MapLegendCardProps) {
  const className = modifier ? `map-legend-card map-legend-card--${modifier}` : 'map-legend-card'
  return (
    <div className={className}>
      <div className="text-[#7bd7ff] font-bold mb-1.5 flex items-center gap-1.5">
        <span className="w-3px h-11px" style={{ backgroundColor: accentColor }} />
        <span>{title}</span>
      </div>
      <div className="flex flex-col gap-1 text-[#d2ecff] text-10px">
        {items.map((item, idx) => (
          <div key={`${item.label}-${idx}`} className="flex items-center gap-1">
            {item.icon ? (
              <img src={item.icon} className="w-14px h-14px" alt="" />
            ) : item.placeholderClassName ? (
              <span className={item.placeholderClassName} />
            ) : null}
            <span>{item.label}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

export interface MapLegendGroupProps {
  /** 容器位置：top-3 left-3 / top-44px right-3 */
  position: 'left' | 'right'
  className?: string
  cards: MapLegendCardProps[]
}

/** 地图图例组：左上图例（空气质量 + 无人机场）或右上图例（雷达 + 预警点位） */
export default function MapLegendGroup({ position, className, cards }: MapLegendGroupProps) {
  const positionClass = position === 'left'
    ? 'map-legend-deck--left absolute top-3 left-3'
    : 'map-legend-deck--right absolute top-44px right-3'
  return (
    <div className={`map-legend-deck ${positionClass} z-20 flex items-start gap-3 text-11px ${className ?? ''}`}>
      {cards.map(card => (
        <MapLegendCard key={card.title} {...card} />
      ))}
    </div>
  )
}

import type { CSSProperties, ReactNode } from 'react'

interface MapPanelHeaderProps {
  title: ReactNode
  subtitle?: ReactNode
  accent?: string
  extra?: ReactNode
  tools?: ReactNode
}

/** 标题和操作分区：短操作靠右，搜索等宽操作独占下一行。 */
export default function MapPanelHeader({ title, subtitle, accent = '#20e8ff', extra, tools }: MapPanelHeaderProps) {
  return (
    <header className="map-panel-header" style={{ '--panel-accent': accent } as CSSProperties}>
      <div className="map-panel-header__row">
        <div className="map-panel-header__heading">
          <div className="map-panel-header__title">{title}</div>
          {subtitle && <div className="map-panel-header__subtitle">{subtitle}</div>}
        </div>
        {extra && <div className="map-panel-header__extra">{extra}</div>}
      </div>
      {tools && <div className="map-panel-header__tools">{tools}</div>}
    </header>
  )
}

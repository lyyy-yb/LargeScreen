import type { CSSProperties, ReactNode } from 'react'
import { classNames } from '@/utils/helpers'
import './index.less'

interface TechPanelProps {
  /** 标题文字 */
  title?: string
  /** 标题左侧发光条/角标的强调色 */
  accent?: string
  /** 标题栏右侧附加内容 */
  extra?: ReactNode
  children: ReactNode
  className?: string
  bodyClassName?: string
  style?: CSSProperties
  /** 紧凑模式：用于地图浮层小卡片（图例等） */
  compact?: boolean
}

/**
 * 科技风面板：四角 L 形亮角 + 顶部流光 + 标题发光条。
 * 纯 CSS 实现，accent 通过 CSS 变量 --tp-accent 下发。
 */
export default function TechPanel({
  title,
  accent = '#20e8ff',
  extra,
  children,
  className,
  bodyClassName,
  style,
  compact = false,
}: TechPanelProps) {
  const panelStyle = { ...style, '--tp-accent': accent } as CSSProperties
  return (
    <div
      className={classNames('tech-panel', compact && 'tech-panel--compact', className)}
      style={panelStyle}
    >
      {(title || extra) && (
        <div className="tech-panel__header">
          {title && <div className="tech-panel__title">{title}</div>}
          {extra && <div className="tech-panel__extra">{extra}</div>}
        </div>
      )}
      <div className={classNames('tech-panel__body', bodyClassName)}>{children}</div>
    </div>
  )
}

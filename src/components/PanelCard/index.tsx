import type { ReactNode, CSSProperties } from 'react'
import { classNames } from '@/utils/helpers'

interface PanelCardProps {
  title?: string
  icon?: ReactNode
  extra?: ReactNode
  children: ReactNode
  className?: string
  style?: CSSProperties
  borderColor?: string
}

export default function PanelCard({
  title,
  icon,
  extra,
  children,
  className,
  style,
  borderColor,
}: PanelCardProps) {
  return (
    <div
      className={classNames(
        'bg-[rgba(10,60,130,0.8)] box-border rounded-20px',
        'border-1 border-solid border-[rgba(255,255,255,0.3)]',
        'shadow-[0_0_10px_0_rgba(180,203,234,0.16)]',
        'px-8px py-6px',
        className
      )}
      style={{ ...style, ...(borderColor ? { borderColor } : {}) }}
    >
      {(title || extra) && (
        <div className="box-header-bg color-#A0C7FF text-18px line-height-40px px-15px flex items-center justify-between">
          <div className="flex items-center gap-2">
            {icon && <span>{icon}</span>}
            {title && <span>{title}</span>}
          </div>
          {extra && <div>{extra}</div>}
        </div>
      )}
      <div className="px-15px py-4px">{children}</div>
    </div>
  )
}

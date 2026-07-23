import { classNames } from '@/utils/helpers'

interface StatItem {
  label: string
  value: string | number
  color?: string
  bgColor?: string
  borderColor?: string
}

interface StatGridProps {
  items: StatItem[]
  columns?: number
  className?: string
}

export default function StatGrid({ items, columns = 3, className }: StatGridProps) {
  return (
    <div
      className={classNames('grid gap-2', className)}
      style={{ gridTemplateColumns: `repeat(${columns}, 1fr)` }}
    >
      {items.map((item, index) => (
        <div
          key={index}
          className={classNames(
            'p-2 rounded text-center border',
            item.bgColor || 'bg-gradient-to-br from-cyan-500/20 to-cyan-600/10',
            item.borderColor || 'border-cyan-500/30'
          )}
        >
          <div
            className={classNames('font-bold text-lg', item.color || 'text-cyan-400')}
          >
            {item.value}
          </div>
          <div className="text-white/50 text-xs mt-0.5">{item.label}</div>
        </div>
      ))}
    </div>
  )
}

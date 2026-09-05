/** 8 项污染物 tab 切换 */
import { POLLUTANTS, DEFAULT_POLLUTANT } from '../constants'
import type { PollutantKey } from '../types'

interface PollutantTabsProps {
  active: PollutantKey
  onChange: (key: PollutantKey) => void
}

export default function PollutantTabs({ active, onChange }: PollutantTabsProps) {
  return (
    <div className="flex items-center gap-1.5">
      {POLLUTANTS.map(item => {
        const isActive = item.key === active
        const baseClass = 'text-12px px-3 py-1 rounded-4px border transition-colors cursor-pointer select-none'
        return (
          <button
            key={item.key}
            type="button"
            onClick={() => onChange(item.key)}
            className={`${baseClass} ${isActive
              ? 'bg-[rgba(0,212,255,0.18)] border-[#00d4ff]/70 text-[#eafcff] shadow-[0_0_10px_rgba(0,212,255,0.25)]'
              : 'bg-[rgba(8,40,84,0.4)] border-[#00d4ff]/15 text-[#7eb5de] hover:border-[#00d4ff]/40 hover:text-[#cce9ff]'
            }`}
          >
            {item.label}
          </button>
        )
      })}
    </div>
  )
}

export { DEFAULT_POLLUTANT }

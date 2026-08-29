import dayjs from 'dayjs'
import type { StationAirRange } from '@/types/airData'

interface AirStationRangeCardProps {
  title: string
  range?: StationAirRange
  latestTime?: string
  onView: () => void
}

const sidePanelStyle = {
  background: 'linear-gradient(160deg, rgba(7, 36, 78, 0.9), rgba(4, 22, 55, 0.85))',
  border: '1px solid rgba(0, 180, 255, 0.35)',
  boxShadow: '0 4px 24px rgba(0, 10, 35, 0.6), inset 0 0 15px rgba(0, 180, 255, 0.1)',
}

/** 近一小时区间展示的 8 种污染物字段（名称与单位分开处理，以便样式精细控制） */
const AIR_RANGE_FIELDS: { key: string; name: string; unit: string }[] = [
  { key: 'pm25', name: 'PM2.5', unit: '(μg/m³)' },
  { key: 'pm10', name: 'PM10', unit: '(μg/m³)' },
  { key: 'so2', name: 'SO₂', unit: '(μg/m³)' },
  { key: 'no2', name: 'NO₂', unit: '(μg/m³)' },
  { key: 'co', name: 'CO', unit: '(mg/m³)' },
  { key: 'o3', name: 'O₃', unit: '(μg/m³)' },
  { key: 'vocs', name: 'VOCs', unit: '(μg/m³)' },
  { key: 'tsp', name: 'TSP', unit: '(μg/m³)' },
]

/** 提取标题中文与括号（括号及内部文字淡化/小号处理） */
function renderTitleWithBracket(title: string) {
  const match = title.match(/^(.*?)（(.*?)）$/)
  if (match) {
    return (
      <span className="truncate flex items-baseline">
        <span>{match[1]}</span>
        <span className="text-11px text-[#9de2ff] font-normal ml-0.5">（{match[2]}）</span>
      </span>
    )
  }
  return <span className="truncate">{title}</span>
}

/** 格式化 min-max 区间（无数据显示 --，min=max 时只显示单个值） */
function formatRange(min: number | null | undefined, max: number | null | undefined): string {
  const hasMin = min != null && Number.isFinite(min)
  const hasMax = max != null && Number.isFinite(max)
  if (!hasMin && !hasMax) return '--'
  if (hasMin && !hasMax) return String(min)
  if (!hasMin && hasMax) return String(max)
  if (min === max) return String(min)
  return `${min}~${max}`
}

/** 空气质量站（固定站/移动站）区间卡片：统一青色（#18e8ff）数据点击后查看站点数据详情 */
export default function AirStationRangeCard({
  title,
  range,
  latestTime,
  onView,
}: AirStationRangeCardProps) {
  const values = (range ?? {}) as unknown as Record<string, number | null>
  return (
    <section
      className="status-card h-200px shrink-0 flex flex-col overflow-hidden"
      style={sidePanelStyle}
    >
      <div className="panel-title-divider flex items-center gap-1.5 text-[#7bd7ff] text-12px font-bold mb-2 pb-2">
        <span className="w-3px h-11px bg-[#00f0ff]" />
        {renderTitleWithBracket(title)}
        {latestTime && (
          <span className="ml-auto shrink-0 text-[#5c92c1] text-10px font-mono font-normal">
            {dayjs(latestTime).format('YYYY/MM/DD HH:mm')}
          </span>
        )}
      </div>
      {/* 8 条指标各自独立色块包裹 */}
      <div className="flex-1 min-h-0 grid grid-cols-2 content-start gap-2.5">
        {AIR_RANGE_FIELDS.map((field) => (
          <div
            key={field.key}
            className="flex items-center justify-between rounded-4px border border-[#2f7fd6]/60 bg-[#1c64be]/55 px-2 py-1.5"
          >
            <span className="text-10px whitespace-nowrap flex items-baseline">
              <span className="text-[#edf6ff] font-semibold">{field.name}</span>
              <span className="text-9px text-[#a3d4ff]/85 font-normal ml-0.5">{field.unit}</span>
            </span>
            <button
              type="button"
              onClick={onView}
              className="text-[#18e8ff] text-11px font-mono cursor-pointer bg-transparent border-none p-0 hover:text-white hover:underline"
            >
              {range ? formatRange(values[`${field.key}Min`], values[`${field.key}Max`]) : '--'}
            </button>
          </div>
        ))}
      </div>
    </section>
  )
}

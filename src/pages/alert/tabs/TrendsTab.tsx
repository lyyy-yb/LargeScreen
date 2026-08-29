import { AlertFilled } from '@ant-design/icons'
import dayjs from 'dayjs'
import type { AlertEvent } from '../modals/AlertDetailModal'

interface TrendsTabProps {
  alerts: AlertEvent[]
  alertLevelOptions: { value: string; label: string; color?: string }[]
}

const LEVEL_COLOR_MAP: Record<string, string> = {
  level1: '#FF4D4F',
  level2: '#FA8C16',
  level3: '#FAAD14',
  level4: '#1890FF',
}

const STATUS_LABEL_MAP: Record<string, string> = {
  undispatched: '待派发',
  pending: '待处置',
  processing: '处置中',
  completed: '已处置',
  closed: '已关闭',
  cleared: '已清除',
}

const STATUS_COLOR_MAP: Record<string, string> = {
  待派发: '#FAAD14',
  待处置: '#FA8C16',
  处置中: '#1890FF',
  已处置: '#52C41A',
  已关闭: '#8C8C8C',
  已清除: '#8C8C8C',
}

interface TrendItem {
  time: string
  area: string
  level: string
  content: string
  status: string
}

export default function TrendsTab({ alerts, alertLevelOptions }: TrendsTabProps) {
  const items: TrendItem[] = alerts.slice(0, 20).map((item) => ({
    time: item.createdAt ? dayjs(item.createdAt).format('HH:mm') : '--:--',
    area: item.location || item.assignedCity || '—',
    level: item.alertLevel,
    content: item.triggerReason,
    status: STATUS_LABEL_MAP[item.status] ?? item.status,
  }))

  return (
    <div className="space-y-3 p-4">
      {items.map((item, idx) => {
        const color = LEVEL_COLOR_MAP[item.level] || '#FA8C16'
        return (
          <div
            key={idx}
            className="flex items-center gap-3 p-3.5 rounded-lg"
            style={{
              backgroundColor: 'rgba(3,251,253,0.04)',
              border: '1px solid rgba(3,251,253,0.15)',
            }}
          >
            <div
              className="w-11 h-11 rounded-full flex items-center justify-center shrink-0"
              style={{
                backgroundColor: color + '22',
                border: `2px solid ${color}`,
              }}
            >
              <AlertFilled style={{ color, fontSize: 18 }} />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <span className="text-white/90 text-14px font-medium">{item.area}</span>
                <span
                  className="text-12px px-2 py-0.5 rounded font-semibold"
                  style={{ color, border: `1px solid ${color}` }}
                >
                  {alertLevelOptions.find((o) => o.value === item.level)?.label || '预警'}
                </span>
              </div>
              <div className="text-white/60 text-12px mt-1 truncate">{item.content}</div>
            </div>
            <div className="text-right shrink-0">
              <div
                className="text-12px font-medium"
                style={{ color: STATUS_COLOR_MAP[item.status] || '#1890FF' }}
              >
                {item.status}
              </div>
              <div className="text-white/40 text-11px mt-1">{item.time}</div>
            </div>
          </div>
        )
      })}
    </div>
  )
}

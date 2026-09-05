import type { AirDataLatestVO } from '@/types/airData'
import { POLLUTANT_KEYS, type PollutantKey } from '../types'

/** 演示专用浓度断点，不是国标、AQI 换算或健康建议，等待后台阈值配置替换。 */
export const DEMO_CONCENTRATION_THRESHOLDS: Record<PollutantKey, number[]> = {
  pm25: [35, 75, 115, 150, 250], pm10: [50, 150, 250, 350, 420],
  so2: [50, 150, 475, 800, 1600], no2: [40, 80, 180, 280, 565],
  co: [2, 4, 14, 24, 36], o3: [100, 160, 215, 265, 800],
  vocs: [50, 100, 200, 400, 800], tsp: [80, 120, 200, 300, 500],
}
const DEMO_LEVELS = [
  { label: '正常', color: '#26ee8c' }, { label: '良', color: '#ffe45c' },
  { label: '轻度污染', color: '#ffa53d' }, { label: '中度污染', color: '#ff5757' },
  { label: '重度污染', color: '#c168ff' }, { label: '严重污染', color: '#c93762' },
]
export function demoConcentrationLevel(key: PollutantKey, value: number | null) {
  if (value == null) return { label: '暂无数据', color: '#92a9bf' }
  const index = DEMO_CONCENTRATION_THRESHOLDS[key].findIndex(limit => value <= limit)
  return DEMO_LEVELS[index < 0 ? 5 : index]
}
/** 每台站取最新记录，逐污染物排除缺测；0 参与平均，绝不使用 min/max 中点。 */
export function concentrationMeans(records: AirDataLatestVO[]) {
  const latest = new Map<string, AirDataLatestVO>()
  records.forEach(row => {
    const code = row.mnCode?.trim()
    if (!code) return
    const previous = latest.get(code)
    if (!previous || row.dataTime > previous.dataTime) latest.set(code, row)
  })
  return POLLUTANT_KEYS.map(key => {
    const values = [...latest.values()].map(row => row[key]).filter(value => value != null && String(value).trim() !== '' && Number.isFinite(Number(value)) && Number(value) >= 0).map(Number)
    return { key, count: values.length, value: values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : null }
  })
}

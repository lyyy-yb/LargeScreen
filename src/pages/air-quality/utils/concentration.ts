import type { AirDataLatestVO } from '@/types/airData'
import { POLLUTANT_KEYS } from '../types'

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

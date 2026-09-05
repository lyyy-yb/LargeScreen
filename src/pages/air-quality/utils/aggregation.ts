import dayjs, { type Dayjs } from 'dayjs'

export type AirAggregation = 'minute' | 'hourly' | 'daily'
export type AirTimeRange = [Dayjs, Dayjs]
export const AGGREGATIONS = {
  minute: { label: '分钟', unit: 'minute', limit: 60, stepLabel: '1 分钟', format: 'YYYY-MM-DD HH:mm' },
  hourly: { label: '小时', unit: 'hour', limit: 48, stepLabel: '1 小时', format: 'YYYY-MM-DD HH' },
  daily: { label: '日', unit: 'day', limit: 31, stepLabel: '1 日', format: 'YYYY-MM-DD' },
} as const

/** UI 选择起止时段，均包含在内；接口边界覆盖完整时段。 */
export function latestBucket(type: AirAggregation, now = dayjs()): Dayjs {
  const { unit } = AGGREGATIONS[type]
  return now.startOf(unit).subtract(1, unit)
}
export function recentRange(type: AirAggregation, count: number, now = dayjs()): AirTimeRange {
  const end = latestBucket(type, now)
  return [end.subtract(count - 1, AGGREGATIONS[type].unit), end]
}
export function normalizeRange(range: AirTimeRange, type: AirAggregation): AirTimeRange {
  return range.map(value => value.startOf(AGGREGATIONS[type].unit)) as AirTimeRange
}
export function rangeError(range: AirTimeRange, type: AirAggregation, now = dayjs()): string | null {
  const { unit, limit, label } = AGGREGATIONS[type]
  if (range.some(value => !value.isValid())) return '请选择有效时间'
  const [start, end] = normalizeRange(range, type)
  if (end.isBefore(start)) return '结束时间不能早于开始时间'
  if (end.isAfter(latestBucket(type, now))) return '只能选择已完成的时段，不能选择未来时间'
  if (end.diff(start, unit) + 1 > limit) return `${label}模式最多选择 ${limit} 个${label}时段（含起止时段）`
  return null
}
/** 全站历史约定只提交这三个字段，不发送客户端步长。 */
export interface AirHistoryQuery { startTime: string; endTime: string; type: AirAggregation }
export function toHistoryQuery(range: AirTimeRange, type: AirAggregation): AirHistoryQuery {
  const [start, end] = normalizeRange(range, type)
  return { startTime: start.format('YYYY-MM-DD HH:mm:ss'), endTime: end.endOf(AGGREGATIONS[type].unit).format('YYYY-MM-DD HH:mm:ss'), type }
}
export function historyBuckets(query: AirHistoryQuery): Array<{ start: Dayjs; end: Dayjs }> {
  const { unit, limit } = AGGREGATIONS[query.type]
  const start = dayjs(query.startTime).startOf(unit)
  const end = dayjs(query.endTime).startOf(unit)
  if (rangeError([start, end], query.type)) return []
  return Array.from({ length: Math.min(limit, end.diff(start, unit) + 1) }, (_, index) => {
    const bucket = start.add(index, unit)
    return { start: bucket, end: bucket.endOf(unit) }
  })
}

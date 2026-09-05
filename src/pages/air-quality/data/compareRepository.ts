/** 对比区数据 repository：单站/多站趋势
 *  - 单站多污染物：8 条折线
 *  - 多站单污染物：N 条折线（污染物 = tab 选中）
 *  - 数据源：
 *    - 空 timeRange：dataSourceApi.aqiDetail(dataSourceId) 取 12h 浓度（*Trend 8 字段）
 *    - 有 timeRange：dataManageApi.airStationDetail({ deviceId, level, startTime, endTime }) 自动翻页
 *  - 多站并发 4
 *  - requestId 用于过期丢弃
 */
import { dataSourceApi } from '@/servers/business'
import { dataManageApi } from '@/servers/dataManage'
import type { AirDataDetailVO } from '@/types/dataManage'
import { toHistoryQuery, type AirAggregation } from '../utils/aggregation'
import type { AirTrendItem } from '@/types/airData'
import type { Dayjs } from 'dayjs'
import { POLLUTANT_KEYS, type AirStationViewModel, type PollutantKey } from '../types'

const TREND_FIELD_MAP: Record<PollutantKey, string> = {
  pm25: 'pm25Trend',
  pm10: 'pm10Trend',
  so2: 'so2Trend',
  no2: 'no2Trend',
  co: 'coTrend',
  o3: 'o3Trend',
  vocs: 'vocsTrend',
  tsp: 'tspTrend',
}

const TREND_VALUES_FIELD_MAP: Record<PollutantKey, string> = {
  pm25: 'pm25Avg',
  pm10: 'pm10Avg',
  so2: 'so2Avg',
  no2: 'no2Avg',
  co: 'coAvg',
  o3: 'o3Avg',
  vocs: 'vocsAvg',
  tsp: 'tspAvg',
}

export interface ComparePoint {
  time: string
  /** 各污染物值（用于多污染物） */
  values: Partial<Record<PollutantKey, number | null>>
}

export interface CompareSeries {
  /** deviceId 标识 */
  deviceId: string
  stationName: string
  stationType: AirStationViewModel['stationType']
  points: ComparePoint[]
}

const MAX_PAGE_SIZE = 1000

/** 解析 aqiDetail 的浓度趋势（8 字段） */
function parseAqiDetailTrend(payload: unknown): ComparePoint[] {
  if (!payload || typeof payload !== 'object') return []
  const record = payload as Record<string, unknown>
  const merged = new Map<string, ComparePoint>()
  POLLUTANT_KEYS.forEach(key => {
    const trendKey = TREND_FIELD_MAP[key]
    const arr = record[trendKey]
    if (!Array.isArray(arr)) return
    arr.forEach((item: unknown) => {
      if (!item || typeof item !== 'object') return
      const row = item as Record<string, unknown>
      const time = (row.hour ?? row.time ?? row.dataTime) as string | undefined
      if (!time) return
      const raw = row.value
      const num = Number(raw)
      const val = raw != null && Number.isFinite(num) ? num : null
      let existing = merged.get(time)
      if (!existing) {
        existing = { time, values: {} }
        merged.set(time, existing)
      }
      existing.values[key] = val
    })
  })
  // aqiDetail 已按近12小时顺序返回，不能用 HH:mm 字典排序打乱跨午夜趋势。
  return Array.from(merged.values())
}

/** 单站 12h 趋势（aqiDetail） */
export async function fetchStation12h(dataSourceId: number): Promise<ComparePoint[]> {
  if (!dataSourceId) return []
  const res = await dataSourceApi.aqiDetail(dataSourceId)
  return parseAqiDetailTrend(res?.data)
}

/** 单站任意范围（dataManage airStationDetail 自动翻页） */
export async function fetchStationRange(
  deviceId: string,
  startTime: Dayjs,
  endTime: Dayjs,
  type: AirAggregation,
): Promise<ComparePoint[]> {
  if (!deviceId || !startTime.isValid() || !endTime.isValid()) return []
  const query = toHistoryQuery([startTime, endTime], type)

  const allRows: AirDataDetailVO[] = []
  let pageNum = 1
  // 自动翻页直到拿完
  while (true) {
    const res = await dataManageApi.airStationDetail({
      deviceId,
      level: query.type,
      startTime: query.startTime,
      endTime: query.endTime,
      pageNum,
      pageSize: MAX_PAGE_SIZE,
    })
    const records = Array.isArray(res?.records) ? res.records : []
    allRows.push(...records)
    const total = Number(res?.total) || 0
    if (allRows.length >= total || records.length === 0) break
    pageNum++
    if (pageNum > 1000) break // 安全上限
  }

  // 8 项 → ComparePoint
  const sorted = allRows.slice().sort((a, b) => (a.dataTime > b.dataTime ? 1 : a.dataTime < b.dataTime ? -1 : 0))
  return sorted.map(row => {
    const values: Partial<Record<PollutantKey, number | null>> = {}
    POLLUTANT_KEYS.forEach(key => {
      const raw = row[key]
      const num = Number(raw)
      values[key] = raw != null && Number.isFinite(num) ? num : null
    })
    return { time: row.dataTime, values }
  })
}

/** 从 aqiDetail 响应中提取当前各污染物 *Avg 字段（页面其它地方可能用） */
export function parseAqiDetailAverages(payload: unknown): Partial<Record<PollutantKey, number | null>> {
  if (!payload || typeof payload !== 'object') return {}
  const record = payload as Record<string, unknown>
  const out: Partial<Record<PollutantKey, number | null>> = {}
  POLLUTANT_KEYS.forEach(key => {
    const k = TREND_VALUES_FIELD_MAP[key]
    const raw = record[k]
    const num = Number(raw)
    out[key] = raw != null && Number.isFinite(num) ? num : null
  })
  return out
}

/** 从 aqiDetail 响应中提取近 12h 趋势点（时间字符串，小时粒度） */
export function parseAqiDetailTrendRows(payload: unknown): AirTrendItem[] {
  if (!payload || typeof payload !== 'object') return []
  const record = payload as Record<string, unknown>
  const merged = new Map<string, AirTrendItem>()
  POLLUTANT_KEYS.forEach(key => {
    const trendKey = TREND_FIELD_MAP[key]
    const arr = record[trendKey]
    if (!Array.isArray(arr)) return
    arr.forEach((item: unknown) => {
      if (!item || typeof item !== 'object') return
      const row = item as Record<string, unknown>
      const time = (row.hour ?? row.time ?? row.dataTime) as string | undefined
      if (!time) return
      const raw = row.value
      const num = Number(raw)
      const val = raw != null && Number.isFinite(num) ? num : null
      let existing = merged.get(time)
      if (!existing) {
        existing = { hour: time, pm25: null, pm10: null, so2: null, no2: null, co: null, o3: null, vocs: null, tsp: null }
        merged.set(time, existing)
      }
      ;(existing as unknown as Record<string, unknown>)[key] = val
    })
  })
  return Array.from(merged.values()).sort((a, b) => (a.hour > b.hour ? 1 : a.hour < b.hour ? -1 : 0))
}

/** 并发上限执行器 */
export async function runWithConcurrency<T, R>(items: T[], limit: number, fn: (item: T, index: number) => Promise<R>): Promise<R[]> {
  const results: R[] = new Array(items.length)
  let cursor = 0
  const workers = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (true) {
      const i = cursor++
      if (i >= items.length) return
      results[i] = await fn(items[i], i)
    }
  })
  await Promise.all(workers)
  return results
}

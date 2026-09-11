import dayjs from 'dayjs'
import { airDataSeries } from '@/servers/airData'
import type { AirSeriesVO, AirResolution } from '@/types/airData'
import { POLLUTANT_KEYS, type AirPlaybackFrame, type AirStationViewModel } from '../types'
import { AGGREGATIONS, historyBuckets, type AirHistoryQuery } from '../utils/aggregation'

export const AIR_RESOLUTION = { minute: 'minute', hourly: 'hour', daily: 'day' } as const satisfies Record<string, AirResolution>
export const emptyAirValues = () => Object.fromEntries(POLLUTANT_KEYS.map(key => [key, null])) as AirStationViewModel['values']

/** 缺测留空，绝不以最新数据补历史；坐标直接使用接口声明的 GCJ02。 */
export function buildAirHistory(data: AirSeriesVO, query: AirHistoryQuery, sources: AirStationViewModel[]) {
  if (data.resolution !== AIR_RESOLUTION[query.type] || !Array.isArray(data.stations) || !Array.isArray(data.series)) {
    throw new Error('空气质量历史响应格式或统计类型不匹配')
  }
  const metadata = new Map(data.stations.map(station => [station.deviceId, station]))
  const stations = sources.map(station => {
    const item = metadata.get(station.deviceId)
    const valid = item?.lng != null && item?.lat != null && Number.isFinite(Number(item.lng)) && Number.isFinite(Number(item.lat)) && Math.abs(Number(item.lng)) <= 180 && Math.abs(Number(item.lat)) <= 85
    return valid ? { ...station, lng: Number(item.lng), lat: Number(item.lat) } : station
  })
  const ids = new Set(stations.map(station => station.deviceId))
  const buckets = historyBuckets(query)
  const frames: AirPlaybackFrame[] = buckets.map(({ start, end }, index) => ({
    index, startTime: start.format('YYYY-MM-DD HH:mm:ss'), endTime: end.format('YYYY-MM-DD HH:mm:ss'),
    valuesByDeviceId: Object.fromEntries(stations.map(station => [station.deviceId, emptyAirValues()])),
  }))
  const byTime = new Map(frames.map(frame => [frame.startTime, frame]))
  let matched = 0
  // 保证同一时段重复设备记录稳定地采用较晚记录，不重复计入。
  const rows = [...data.series].sort((a, b) => a.time.localeCompare(b.time))
  for (const row of rows) {
    if (!ids.has(row.deviceId) || !dayjs(row.time).isValid()) continue
    const time = dayjs(row.time).startOf(AGGREGATIONS[query.type].unit).format('YYYY-MM-DD HH:mm:ss')
    const frame = byTime.get(time)
    if (!frame) continue
    const values = emptyAirValues()
    for (const key of POLLUTANT_KEYS) {
      const raw = row[key]
      values[key] = raw != null && String(raw).trim() !== '' && Number.isFinite(Number(raw)) && Number(raw) >= 0 ? Number(raw) : null
    }
    frame.valuesByDeviceId[row.deviceId] = values
    matched++
  }
  return { stations, frames: matched ? frames : [] }
}

export async function getAirHistory(query: AirHistoryQuery, sources: AirStationViewModel[]) {
  const response = await airDataSeries({ resolution: AIR_RESOLUTION[query.type], startTime: query.startTime, endTime: query.endTime })
  if (response.resultCode !== 0 || !response.data) throw new Error(response.message || response.msg || '空气质量历史查询失败')
  return buildAirHistory(response.data, query, sources)
}

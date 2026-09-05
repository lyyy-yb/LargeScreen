/** 数据源 + airData/latest 合并为 AirStationViewModel。
 *  - 严格按 deviceId === mnCode 关联，禁使用两种 DTO 的 id 关联（语义不同）
 *  - 过滤无效经纬度
 *  - 重复 mnCode 保留 dataTime 较新的一条
 *  - stationType 不是 fixed/mobile 记 unknown（不擅自归为移动站）
 */
import { dataSourceApi } from '@/servers/business'
import type { DataSourceDTO, DataSourceQuery } from '@/types/business'
import type { AirDataLatestVO } from '@/types/airData'
import { POLLUTANT_KEYS, type AirStationType, type AirStationViewModel, type PollutantKey } from '../types'

export interface BuildAirStationsInput {
  sources: DataSourceDTO[]
  latest: AirDataLatestVO[]
}

const SOURCE_PAGE_SIZE = 500

/** 按接口 total 拉完当前区域全部空气质量站，避免固定 999 条截断点位。 */
export async function fetchAllAirSources(
  query: Omit<DataSourceQuery, 'pageNum' | 'pageSize'>,
): Promise<DataSourceDTO[]> {
  const result: DataSourceDTO[] = []
  let pageNum = 1
  while (true) {
    const response = await dataSourceApi.list({ ...query, pageNum, pageSize: SOURCE_PAGE_SIZE })
    const records = Array.isArray(response.data?.records) ? response.data.records : []
    result.push(...records)
    const total = Number(response.data?.total) || result.length
    if (result.length >= total || records.length === 0) return result
    pageNum++
  }
}

function normalizeStationType(raw: string | undefined | null): AirStationType {
  if (raw === 'fixed' || raw === 'mobile') return raw
  return 'unknown'
}

function getDisplayName(station: DataSourceDTO): string {
  const short = (station.shortName ?? '').trim()
  if (short) return short
  const device = (station.deviceName ?? '').trim()
  if (device) return device
  return '未命名地址'
}

function makeEmptyValues(): Record<PollutantKey, number | null> {
  return POLLUTANT_KEYS.reduce((acc, key) => {
    acc[key] = null
    return acc
  }, {} as Record<PollutantKey, number | null>)
}

export function buildAirStations({ sources, latest }: BuildAirStationsInput): AirStationViewModel[] {
  // 1. mnCode 索引（重复取 dataTime 较新）
  const latestByDevice = new Map<string, AirDataLatestVO>()
  latest.forEach(item => {
    const code = (item.mnCode ?? '').trim()
    if (!code) return
    const prev = latestByDevice.get(code)
    if (!prev) {
      latestByDevice.set(code, item)
      return
    }
    const prevTime = prev.dataTime ?? ''
    const curTime = item.dataTime ?? ''
    if (curTime > prevTime) latestByDevice.set(code, item)
  })

  // 2. 站点元数据
  const result: AirStationViewModel[] = []
  sources.forEach(source => {
    const lng = Number(source.lng)
    const lat = Number(source.lat)
    if (!Number.isFinite(lng) || !Number.isFinite(lat) || lng < -180 || lng > 180 || lat < -90 || lat > 90) {
      return
    }
    const deviceId = (source.deviceId ?? '').trim()
    if (!deviceId) return
    const cur = latestByDevice.get(deviceId)
    const values = makeEmptyValues()
    if (cur) {
      POLLUTANT_KEYS.forEach(key => {
        const raw = cur[key]
        const num = Number(raw)
        values[key] = raw != null && Number.isFinite(num) ? num : null
      })
    }
    result.push({
      dataSourceId: Number(source.id) || 0,
      deviceId,
      name: getDisplayName(source),
      stationType: normalizeStationType(source.stationType),
      lng,
      lat,
      aqi: source.aqi != null && Number.isFinite(Number(source.aqi)) ? Number(source.aqi) : null,
      aqiLevel: (source.aqiLevel ?? '').trim(),
      values,
      dataTime: cur?.dataTime ?? null,
    })
  })

  // 3. 诊断信息：当前值无对应站点坐标的 latest 记录（不在地图绘制，但记录）
  if (typeof console !== 'undefined') {
    const orphanLatest: string[] = []
    latestByDevice.forEach((_, code) => {
      const matched = result.find(s => s.deviceId === code)
      if (!matched) orphanLatest.push(code)
    })
    if (orphanLatest.length > 0) {
      console.debug(`[air-quality] ${orphanLatest.length} 个 mnCode 在 latest 中但无对应站点坐标，已忽略`)
    }
  }

  return result
}

/** 标准化扫描模型。正式 SPS 走 spsAdapter；原始报文演示映射不等同于生产协议。 */
export type RadarHeatFactor = 'source' | 'pm25' | 'pm10'
export interface RadarHeatSite { id: string; name: string; lng: number; lat: number; yaw?: number }
export interface RadarRay {
  siteId: string; period: string; time: string; factor: RadarHeatFactor
  bearing: number; width: number; startM: number; stepM: number; values: Array<number | null>
  /** 真实接口按点提供的距离边界（米），支持不等间距。 */
  distanceEdgesM?: number[]
}
export interface RadarHeatFrame {
  siteId: string; period: string; time: string; factor: RadarHeatFactor; rays: RadarRay[]; complete: boolean
}
export const RADAR_FACTORS = {
  source: { label: '污染源', unit: 'a.u.', max: 1, ticks: [0, .15, .35, 1], stops: [0, .015, .05, .1, .15, .35, 1] },
  pm25: { label: 'PM2.5', unit: 'μg/m³', max: 150, ticks: [0, 35, 75, 150], stops: [0, 20, 35, 55, 75, 110, 150] },
  pm10: { label: 'PM10', unit: 'μg/m³', max: 250, ticks: [0, 50, 150, 250], stops: [0, 30, 50, 100, 150, 200, 250] },
} as const
export const HEAT_COLORS = ['#008511', '#6fb900', '#f3ed00', '#ff9000', '#ff2800', '#f242c4', '#663591']
export function radarHeatRatio(value: number, factor: RadarHeatFactor): number {
  const stops=RADAR_FACTORS[factor].stops
  const index=stops.findIndex(stop=>value<=stop)
  if(index===0)return 0
  if(index<0)return 1
  return (index-1+(value-stops[index-1])/(stops[index]-stops[index-1]))/(stops.length-1)
}
export function radarHeatColor(value: number, factor: RadarHeatFactor): string {
  const ratio = radarHeatRatio(value,factor)
  const pos = ratio * (HEAT_COLORS.length - 1), index = Math.min(HEAT_COLORS.length - 2, Math.floor(pos))
  const a = HEAT_COLORS[index], b = HEAT_COLORS[index + 1]
  return `rgb(${[1,3,5].map(offset => Math.round(parseInt(a.slice(offset,offset+2),16) * (1-pos+index) + parseInt(b.slice(offset,offset+2),16) * (pos-index))).join(',')})`
}

/** 显式注入映射；不能在正式对接时猜测 DataType 或俯仰角。 */
export interface RadarEnvelopeMapping {
  factorFor: (type: number) => RadarHeatFactor | undefined
  bearingFor: (row: Record<string, unknown>) => number
  distanceMultiplier: number
  rayWidth: number
}
export function decodeRadarEnvelope(input: unknown, mapping: RadarEnvelopeMapping): RadarRay[] {
  const envelope = typeof input === 'string' ? JSON.parse(input) : input
  if (!envelope || typeof envelope !== 'object') throw new Error('无效扫描消息')
  const outer = envelope as Record<string, unknown>
  if (outer.IsGZip === true) throw new Error('压缩协议尚未对接，请提供解压后的 Json')
  const rows = typeof outer.Json === 'string' ? JSON.parse(outer.Json) : outer.Json
  if (!Array.isArray(rows)) throw new Error('扫描 Json 必须为数组')
  return rows.flatMap((raw: unknown) => {
    if (!raw || typeof raw !== 'object') return []
    const row = raw as Record<string, unknown>
    if (String(row.scanType ?? outer.ScanMode).toUpperCase() !== 'PPI') return []
    const factor = mapping.factorFor(Number(row.dataType ?? outer.DataType))
    const distance = row.distanceData
    if (!factor || !Array.isArray(distance) || distance.length < 3 || !Array.isArray(row.data)) return []
    const startM = Number(distance[0]) * mapping.distanceMultiplier
    const stepM = Number(distance[1]) * mapping.distanceMultiplier
    const count = Number(distance[2]), bearing = mapping.bearingFor(row)
    const siteId = String(row.radarId ?? outer.SiteId ?? ''), period = String(row.periodId ?? outer.Period ?? '')
    const time = String(row.dataTime ?? outer.DataTime ?? '')
    if (!siteId || !period || !Number.isFinite(Date.parse(time)) || !Number.isFinite(bearing) || !Number.isFinite(startM) || startM < 0 || !Number.isFinite(stepM) || stepM <= 0 || !Number.isInteger(count) || count < 1 || count > 5000 || row.data.length !== count) return []
    if (!(mapping.rayWidth > 0 && mapping.rayWidth <= 10)) return []
    const values = row.data.map((value: unknown) => value == null || String(value).trim() === '' || !Number.isFinite(Number(value)) || Number(value) < 0 ? null : Number(value))
    return [{ siteId, period, time, factor, bearing: ((bearing % 360)+360)%360, width: mapping.rayWidth, startM, stepM, values }]
  })
}

/** 同站/同污染物/同周期累积；相同方向重发替换，禁止周期和站点串流混入。 */
export function mergeRadarRays(frame: RadarHeatFrame | null, rays: RadarRay[]): RadarHeatFrame | null {
  if (!rays.length) return frame
  const head = rays[0]
  const same = frame?.siteId === head.siteId && frame.period === head.period && frame.factor === head.factor
  const merged = new Map((same ? frame.rays : []).map(ray => [ray.bearing,ray]))
  rays.filter(ray => ray.siteId === head.siteId && ray.period === head.period && ray.factor === head.factor).forEach(ray => merged.set(ray.bearing,ray))
  return { siteId: head.siteId, period: head.period, time: head.time, factor: head.factor, rays: [...merged.values()], complete: false }
}

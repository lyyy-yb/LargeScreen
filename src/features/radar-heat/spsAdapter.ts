import type { SpsDetail } from '@/servers/radarHeat'
import type { RadarHeatFrame, RadarRay } from './model'

const array = (value: unknown): unknown[] => {
  const result = typeof value === 'string' ? JSON.parse(value) : value
  if (!Array.isArray(result)) throw new Error('扫描距离或浓度不是数组')
  return result
}

/** 按用户平台对照应用公共起始角修正，所有站点共用，不依赖站点名称或偏航是否为零。 */
export const SPS_START_ANGLE_OFFSET = 252
const toBearing = (hangle: number, yaw: number) => (((hangle + SPS_START_ANGLE_OFFSET + yaw) % 360) + 360) % 360

export function decodeSpsDetail(detail: SpsDetail, siteId: string, yaw = 0): RadarHeatFrame {
  if (!Number.isFinite(yaw)) throw new Error('雷达偏航角无效')
  if (!detail || detail.radarId !== siteId || !detail.periodId || detail.scanType !== 'PPI' || !Array.isArray(detail.rays)) throw new Error('扫描周期格式、雷达标识或扫描模式不匹配')
  if (!detail.rays.length || Number(detail.rayCount) !== detail.rays.length) throw new Error('扫描周期射线不完整，暂不播放')
  if (!Number.isFinite(Date.parse(detail.startTime))) throw new Error('扫描周期时间无效')
  const angles = detail.rays.map(ray => toBearing(Number(ray.hangle), yaw)).sort((a,b)=>a-b)
  const gaps = angles.map((angle,index)=>(angles[(index+1)%angles.length]-angle+360)%360).filter(gap=>gap>0 && gap<=3).sort((a,b)=>a-b)
  const width = gaps.length ? gaps[Math.floor(gaps.length/2)] : .5
  const rays: RadarRay[] = detail.rays.map(ray => {
    const raw = array(ray.valueArray), distances = array(ray.distanceArray)
    if (raw.length < 2 || raw.length > 10000 || (distances.length !== raw.length && distances.length !== raw.length+1)) throw new Error('扫描距离数组与浓度数量不匹配，需确认距离格式')
    const edges = distances.map(value=>value == null || String(value).trim()==='' ? NaN : Number(value)*1000)
    if (edges.some((value,index)=>!Number.isFinite(value) || value<0 || (index>0 && value<=edges[index-1]))) throw new Error('扫描距离数组必须严格递增且有效')
    if (edges.length===raw.length) edges.push(edges[edges.length-1]+edges[edges.length-1]-edges[edges.length-2])
    if (ray.hangle==null || !Number.isFinite(Number(ray.hangle))) throw new Error('扫描方位角无效')
    return { siteId, period:detail.periodId, time:ray.dataTime, factor:'source', bearing:toBearing(Number(ray.hangle), yaw),
      width, startM:edges[0], stepM:edges[1]-edges[0], distanceEdgesM:edges,
      values:raw.map(value=>value == null || String(value).trim()==='' || !Number.isFinite(Number(value)) || Number(value)<0 ? null : Number(value)),
    }
  })
  return { siteId, period:detail.periodId, time:detail.startTime, factor:'source', rays, complete:true }
}

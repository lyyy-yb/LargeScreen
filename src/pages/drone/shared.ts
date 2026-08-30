import type { RegionSelection } from '@/types/region'
import { cities, districts } from '@/utils/city'

/** 飞行任务（listFlyJob 返回结构） */
export interface TaskItem {
  jobID: string
  jobName: string
  jobTime: string
  jobStatus: string
  dockCode: string
}

/** 待执飞计划（listFlyPlan 返回结构） */
export interface PlanItem {
  planId: string
  planName: string
  startDate: string
  flyTime: string
  dockCode: string
  lineName: string
}

/** 飞行结果（listFlyResult 返回结构） */
export interface FlyResultItem {
  resultsID: string
  resultsTime: string
  resultsType: string
  resultsUrl: string
}

/** 无人机实时传感器数据（暂未接入 SSE，仅做类型占位） */
export interface SensorData {
  pm25: number
  pm10: number
  altitude: number
  battery: number
  speed: number
  signal: number
}

/**
 * 飞行任务状态映射（含旧枚举值兼容）
 * 颜色与 /manage/dataManage 的 TASK_STATUS_MAP 一致，便于跨页面视觉统一
 */
export const statusObj: Record<string, { message: string; color: string }> = {
  '0': { message: '等待中', color: '#ffb024' },
  '1': { message: '进行中', color: '#399293' },
  'a': { message: '已完成', color: '#02f8fa' },
  'f': { message: '失败', color: '#f12a27' },
  // 旧枚举值兼容
  '2': { message: '进行中', color: '#399293' },
  '3': { message: '已完成', color: '#02f8fa' },
  '4': { message: '取消', color: '#ef6c6a' },
  '5': { message: '失败', color: '#f12a27' },
  '6': { message: '任务中断', color: '#f37472' },
}

export const ZHEJIANG_CENTER: [number, number] = [120.582886, 29.991549]

/** 经纬度有效性校验 */
export function isValidCoordinate(lng: number, lat: number) {
  return Number.isFinite(lng) && Number.isFinite(lat) &&
    lng >= -180 && lng <= 180 && lat >= -90 && lat <= 90
}

/**
 * 根据当前区域选择派生地图中心点 + 缩放级别：
 * - 区县：11.5 级
 * - 市：9 级
 * - 省/无选择：浙江省中心 7.5 级
 */
export function getRegionCamera(selection?: RegionSelection) {
  const county = districts.find(item =>
    String(item.adcode) === selection?.countyCode ||
    (!!selection?.countyName && item.name === selection.countyName),
  )
  if (county) return { center: [county.lng, county.lat] as [number, number], zoom: 11.5 }

  const city = cities.find(item =>
    item.adcode === selection?.cityCode ||
    (!!selection?.cityName && item.name === selection.cityName),
  )
  if (city) return { center: [city.lng, city.lat] as [number, number], zoom: 9 }

  return { center: ZHEJIANG_CENTER, zoom: 7.5 }
}

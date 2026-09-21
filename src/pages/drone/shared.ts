import type { RegionSelection } from '@/types/region'
import { cities, districts } from '@/utils/city'

/** 飞行任务结构迁移至 @/types/dataManage 的 DroneTaskVO，来源接口已切换到 /data-manage/drone-task/list */

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

/**
 * 飞行任务采集结果 - drone 端"视频采集"侧栏统一的展示模型。
 *
 * 数据来源由 selected task.dataSource 决定：
 * - api：原有 /dpSys/hbdp/wurenji/listFlyResult?jobID=...，resultsUrl 直接是公网 URL
 * - import：/dpSys/hbdp/wurenji/task/resources?taskId=...，resourceId 是关键，
 *   实际访问预览需要走 /dpSys/hbdp/resource/preview/{id}（带 token），
 *   渲染组件会通过 useResourceBlobUrl 钩子把 resourceId 转成 blob URL
 */
export interface DroneMediaItem {
  /** 唯一标识（api 用 resultsID、import 用 String(resourceId)） */
  resultsID: string
  /** p 图片 / v 视频 */
  resultsType: 'p' | 'v' | string
  /** 直接可用的 URL；import 来源留空，由渲染端按 resourceId 自动 fetch  */
  resultsUrl?: string
  /** import 来源的资源 ID（/hbdp/resource/preview/{id} 的 id） */
  resourceId?: number
  /** 显示用时间 */
  resultsTime: string
  /** 文件名（import 来源携带） */
  fileName?: string
  /** 数据来源标记，仅用于区分 UI 渲染路径 */
  source: 'api' | 'import'
}

/** 清洗后的无人机传感器数据接口单项结构（/hbdp/drone-sensor/cleaned/list） */
export interface CleanedSensorItem {
  id: number
  rawId?: number
  siteCode: string
  dataTime: string
  longitude: string | number
  latitude: string | number
  altitude: string | number
  so2?: number | null
  no2?: number | null
  co?: number | null
  o3?: number | null
  vocs?: number | null
  tsp?: number | null
  pm25?: number | null
  pm10?: number | null
  temperature?: number | null
  humidity?: number | null
  pressure?: number | null
  windSpeed?: number | null
  windDirection?: number | null
  cleanStatus?: string
  cleanMessage?: string
  cleanTime?: string
  createTime?: string
}

/** 底部面板显示的传感器读数模型 */
export interface SensorData {
  pm25: number
  pm10: number
  altitude: number
  vocs: number
  tsp: number
  /** 二氧化硫 μg/m³ */
  so2: number
  /** 二氧化氮 μg/m³ */
  no2: number
  /** 臭氧 μg/m³ */
  o3: number
  /** 一氧化碳 mg/m³ */
  co: number
  temperature: number
  humidity: number
  battery?: number
  speed?: number
  signal?: number
  dataTime?: string
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

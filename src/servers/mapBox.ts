import { request } from './request'
import dayjs from 'dayjs'

// ========== 雷达 ==========
// 雷达列表
export function leidaList(params?: object) {
  return request.get('/dpSys/hbdp/leida/list', { params })
}
// 突发点
export function alarmPointAll(params?: object) {
  return request.get('/dpSys/hbdp/leida/alarmPoint', { params })
}

/** monitor 地图使用的细网格 Top 5% 常规/突发点位 */
export interface AlarmPointTop5Item {
  times?: number
  address?: string
  type?: number
  dapLng?: number
  dapLat?: number
}

export interface AlarmPointTop5Data {
  regularPoints?: AlarmPointTop5Item[]
  suddenPoints?: AlarmPointTop5Item[]
}

/** 异常点位查询：细网格（10m）前 5%，仅 monitor 页面使用 */
export function alarmPointTop5(params: {
  BsiId: string
  hour?: 1 | 3 | 24
  startTime?: string
  endTime?: string
}) {
  return request.get<AlarmPointTop5Data>('/dpSys/hbdp/leida/alarmPointTop5', { params })
}

// ========== monitor 全局搜索 ==========
export interface GlobalSearchItem {
  type?: string
  typeName?: string
  name?: string
  longitude?: number
  latitude?: number
  sourceId?: string
}

/** 全局搜索（排口/无人机/微站/雷达等） */
export function globalSearch(keyword: string) {
  return request.get<GlobalSearchItem[]>('/dpSys/hbdp/global/search', { params: { keyword } })
}

// ========== 无人机 ==========
// 无人机机场列表
export function dockList(params?: object) {
  return request.get('/dpSys/hbdp/wurenji/dockList', { params })
}
// 飞行任务列表（startDate 必传，默认近30天）
export function listFlyJob(params?: object) {
  return request.get('/dpSys/hbdp/wurenji/listFlyJob', {
    params: { startDate: dayjs().subtract(30, 'day').format('YYYY-MM-DD'), ...params },
  })
}
// 飞行计划列表（startDate 必传，默认近30天）
export function listFlyPlan(params?: object) {
  return request.get('/dpSys/hbdp/wurenji/listFlyPlan', {
    params: { startDate: dayjs().subtract(30, 'day').format('YYYY-MM-DD'), ...params },
  })
}
// 飞行结果列表
export function listFlyResult(params?: object) {
  return request.get('/dpSys/hbdp/wurenji/listFlyResult', { params })
}
// 无人机派遣
export function wrjPatrol(data: object) {
  return request.post('/dpSys/hbdp/wurenji/patrol', data)
}

// ========== 走航 ==========
// 走航车列表
export function zouhangList() {
  return request.get('/dpSys/hbdp/zouhang/list')
}
// 走航任务详情
export function taskDetail(params?: object) {
  return request.get('/dpSys/hbdp/zouhang/taskDetail', { params })
}
// 走航任务列表
export function taskList(params?: object) {
  return request.get('/dpSys/hbdp/zouhang/taskList', { params })
}

// ========== 污染源 ==========
// 删除污染源
export function wurandelete(data: object, params?: object) {
  return request.post('/dpSys/hbdp/wuranyuan/delete', data, { params })
}
// 选项列表-污染源类型
export function options4leixing(params?: object) {
  return request.get('/dpSys/hbdp/wuranyuan/options4leixing', { params })
}
// 选项列表-污染源街道
export function options4xiangzhen(params?: object) {
  return request.get('/dpSys/hbdp/wuranyuan/options4xiangzhen', { params })
}
// 分页查询污染源
export function wuranPage(params?: object) {
  return request.get('/dpSys/hbdp/wuranyuan/page', { params })
}
// 污染源列表
export function wuranList(params?: object) {
  return request.get('/dpSys/hbdp/wuranyuan/query', { params })
}
// 根据经纬度查最近污染源
export function wuranListByLngLat(params?: object) {
  return request.get('/dpSys/hbdp/wuranyuan/listByLngAndlat', { params })
}
// 污染源图片视频资源查询
export function wuranQuerySource(params?: object) {
  return request.get('/dpSys/hbdp/wuranyuan/querySource', { params })
}
// 污染源增加图片视频资源
export function wuranAddSource(data: object) {
  return request.post('/dpSys/hbdp/wuranyuan/addSource', data)
}
// 污染源上传资源
export function wuranUploadSource(formData: FormData) {
  return request.post('/dpSys/hbdp/wuranyuan/uploadSource', formData)
}
// 问题闭环处置流程更新
export function wtbhczUploadSource(formData: FormData) {
  return request.post('/dpSys/hbdp/wuranyuan/uploadSourceWtbhcz', formData)
}
// 修改污染源
export function wuranEdit(data: object) {
  return request.post('/dpSys/hbdp/wuranyuan/edit', data)
}
// 新增污染源
export function wuranAdd(data: object) {
  return request.post('/dpSys/hbdp/wuranyuan/add', data)
}

// ========== 年度总结 ==========
// 年度总结信息查询
export function getYearInfo(params?: object) {
  return request.get('/dpSys/ndzj/info', { params })
}

// ========== 企业排口 ==========
/** 企业排口列表项（大屏打点用） */
export interface HbdpEmissionOutlet {
  id: number
  seqNo?: number
  /** 许可证编号 */
  licenseNo?: string
  /** 排污单位（企业）名称 */
  companyName?: string
  /** 许可证管理类别 */
  manageCategory?: string
  /** 废气排口数量 */
  outletCount?: number
  /** 在线监测排口数量 */
  onlineMonitorInfo?: string
  /** 废气排口名称 */
  outletName?: string
  /** 排口涉及的污染因子 */
  pollutants?: string
  /** 经度 */
  longitude?: number
  /** 纬度 */
  latitude?: number
  remarks?: string
  /** 删除标志（0 存在 / 2 删除，后端已过滤不返回） */
  delFlag?: string
}

/** 企业排口列表查询（大屏打点，已删除的不返回） */
export function emissionOutletList(params?: { companyNameLike?: string }) {
  return request.get<HbdpEmissionOutlet[]>('/dpSys/hbdp/emissionOutlet/list', { params })
}

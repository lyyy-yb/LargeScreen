import { request } from './request'
import type {
  AirDataDetailVO,
  DataDetailExportQuery,
  DataDetailQuery,
  DroneTaskExportQuery,
  DroneTaskQuery,
  DroneTaskVO,
  IPage,
  MobileMonitorDetailVO,
  MobileMonitorExportQuery,
  MobileMonitorQuery,
} from '@/types/dataManage'

/**
 * 数据管理模块（对应后端 Swagger `数据管理` tag）
 * 注意：路径前缀为 /data-manage/，不是 /dpSys/hbdp/
 * 后端统一使用 resultCode=0 表示成功（与若依 code=200 风格不同）
 */
const API_PREFIX = '/data-manage'

/**
 * 拆包：request.get<T> 返回 ServerResult<T>（{ resultCode, message, data }），
 * 本模块后端以 resultCode=0 表示成功，其余按失败抛出交由页面提示。
 */
async function unwrap<T>(promise: Promise<{ resultCode: number; message: string; data: T }>): Promise<T> {
  const res = await promise
  if (!res || res.resultCode !== 0) {
    throw new Error(res?.message || '接口请求失败')
  }
  return res.data
}

export const dataManageApi = {
  // ---------- 微站数据 ----------
  /** 查询微站数据详情（分页） */
  airStationDetail: (params: DataDetailQuery) =>
    unwrap(request.get<IPage<AirDataDetailVO>>(`${API_PREFIX}/air-station/detail`, { params })),
  /** 导出微站数据详情（全量，不带分页） */
  airStationExport: (params: DataDetailExportQuery) =>
    request.get(`${API_PREFIX}/air-station/export`, { params, responseType: 'blob' }),

  // ---------- 走航任务 ----------
  /** 查询走航任务列表（返回有数据的日期清单） */
  mobileMonitorDetail: (params: MobileMonitorQuery) =>
    unwrap(request.get<MobileMonitorDetailVO>(`${API_PREFIX}/mobile-monitor/detail`, { params })),
  /** 导出走航任务列表（全量） */
  mobileMonitorExport: (params: MobileMonitorExportQuery) =>
    request.get(`${API_PREFIX}/mobile-monitor/export`, { params, responseType: 'blob' }),

  // ---------- 无人机任务 ----------
  /** 查询无人机任务列表（分页） */
  droneTaskList: (params: DroneTaskQuery) =>
    unwrap(request.get<IPage<DroneTaskVO>>(`${API_PREFIX}/drone-task/list`, { params })),
  /** 导出无人机任务列表（全量，不带分页） */
  droneTaskExport: (params: DroneTaskExportQuery) =>
    request.get(`${API_PREFIX}/drone-task/export`, { params, responseType: 'blob' }),
  /** 下载无人机任务导入模板 */
  droneTaskImportTemplate: () =>
    request.get(`${API_PREFIX}/drone-task/importTemplate`, { responseType: 'blob' }),
  /** 导入无人机任务数据（Excel 文件上传） */
  droneTaskImportData: (file: File) => {
    const formData = new FormData()
    formData.append('file', file)
    return request.post<string>(`${API_PREFIX}/drone-task/importData`, formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    })
  },
}

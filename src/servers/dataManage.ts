import { request } from './request'
import type {
  AirDataDetailVO,
  DataDetailExportQuery,
  DataDetailQuery,
  DroneTaskExportQuery,
  DroneTaskQuery,
  DroneTaskResultSubmit,
  DroneTaskVO,
  HbdpUploadResource,
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
 *
 * 注意：该模块成功响应为 resultCode/message，但异常时按**若依风格**返回 code/msg
 * （实测：/data-manage/mobile-monitor/detail 缺 deviceId 时返回 500 且体为 {"msg":"无权访问该设备数据","code":500}），
 * 故错误文案需同时兼容 message 与 msg。
 */
async function unwrap<T>(
  promise: Promise<{ resultCode?: number; message?: string; msg?: string; data: T }>,
): Promise<T> {
  const res = await promise
  if (!res || res.resultCode !== 0) {
    throw new Error(res.message || res.msg || '接口请求失败')
  }
  return res.data
}

/**
 * 解析上传接口的非标准响应：
 * - /hbdp/resource/upload swagger 未声明 200 schema，部分实现会把上传结果直接返回
 *   为 { url, fileName, ... } 平铺对象，或包成标准 ResponseData<HbdpUploadResource>
 * 这里提取可能的 id 字段，若解析不出则抛出"无法解析资源 ID"错误。
 */
function pickResourceId(payload: unknown): number {
  if (payload == null || typeof payload !== 'object') {
    throw new Error('上传响应无法解析')
  }
  const obj = payload as Record<string, unknown>
  // 形态 1：ResponseData<HbdpUploadResource> → data.id
  const data = obj.data
  if (data && typeof data === 'object') {
    const id = (data as Record<string, unknown>).id
    if (typeof id === 'number' && Number.isFinite(id)) return id
  }
  // 形态 2：dataId（部分老接口风格）
  if (typeof obj.dataId === 'number') return obj.dataId
  // 形态 3：平铺字段
  if (typeof obj.id === 'number' && Number.isFinite(obj.id)) return obj.id as number
  throw new Error('上传响应中未找到资源 ID，请联系后端确认接口规范')
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
    return unwrap(request.post<string>(`${API_PREFIX}/drone-task/importData`, formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    }))
  },

  // ---------- 无人机任务关联资源 ----------
  // 资源中心相关接口走 /dpSys/hbdp/*（与 mapBox.ts 现有无人机接口保持一致）：
  //   vite.config.ts 的 proxy 把 /dpSys/* rewrite 去掉 /dpSys/ 后转发到 218.244.154.247:8089
  //   后端真实路径是 /hbdp/resource/*，缺少前缀会直连 5556 dev server → 404
  /** 上传单个文件到资源中心，返回上传后回填的资源主键 ID */
  uploadDroneResource: async (file: File): Promise<number> => {
    const formData = new FormData()
    formData.append('file', file)
    formData.append('businessType', 'drone_task')
    // 该接口 200 schema 未在 swagger 中声明，部分实现把返回结构包成
    // { resultCode, data: { id, fileName, ... } } 或直接平铺，这里仅取 id
    const payload = await request.post<unknown>('/dpSys/hbdp/resource/upload', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    })
    return pickResourceId(payload)
  },
  /** 删除已上传的资源（按 ID） */
  deleteDroneResource: (id: number | string) =>
    request.delete(`/dpSys/hbdp/resource/${id}`),
  /** 拉取资源二进制（带登录 token），返回 Blob 供 URL.createObjectURL 预览 */
  previewDroneResource: async (id: number | string): Promise<Blob> => {
    // responseType: 'blob' 时 request 拦截器直接 return res.data，故这里拿到的是原始 Blob
    const blob = await request.get<Blob>(`/dpSys/hbdp/resource/preview/${id}`, { responseType: 'blob' })
    return blob as unknown as Blob
  },
  /** 查询指定无人机任务已关联的资源列表（含已上传图片/视频） */
  getDroneTaskResources: (taskId: string) =>
    unwrap(request.get<HbdpUploadResource[]>('/dpSys/hbdp/wurenji/task/resources', {
      params: { taskId },
    })),
  /** 提交任务结果关联（保存资源 ID 到任务） */
  submitDroneTaskResult: (body: DroneTaskResultSubmit) =>
    unwrap(request.post<unknown>(`${API_PREFIX}/drone-task/result`, undefined, {
      params: { taskId: body.taskId, resourceIds: body.resourceIds },
    })),
}

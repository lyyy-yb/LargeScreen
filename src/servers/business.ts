import { request } from './request'
import type {
  AlertDashboardVO,
  AlertEventDTO,
  AlertEventQuery,
  AlertReviewPayload,
  CleanRuleDTO,
  CleanRuleQuery,
  DataSourceDTO,
  DataSourceQuery,
  DispatchTaskPayload,
  DisposalTaskDTO,
  DisposalTaskQuery,
  PageResult,
  WarningRuleDTO,
  WarningRuleExportQuery,
  WarningRuleQuery,
} from '@/types/business'

const API_PREFIX = '/dpSys/hbdp'

export const warningRuleApi = {
  list: (params: WarningRuleQuery) =>
    request.get<PageResult<WarningRuleDTO>>(`${API_PREFIX}/warningRule/list`, { params }),
  detail: (id: number) =>
    request.get<WarningRuleDTO>(`${API_PREFIX}/warningRule/${id}`),
  add: (data: Omit<WarningRuleDTO, 'id'>) =>
    request.post(`${API_PREFIX}/warningRule`, data),
  edit: (data: WarningRuleDTO) =>
    request.put(`${API_PREFIX}/warningRule`, data),
  changeStatus: (id: number, enabled: 0 | 1) =>
    request.put(`${API_PREFIX}/warningRule/changeStatus`, { id, enabled }),
  remove: (ids: number | number[]) =>
    request.delete(`${API_PREFIX}/warningRule/${Array.isArray(ids) ? ids.join(',') : ids}`),
  /** 下载导入模板（返回文件流） */
  importTemplate: () =>
    request.post(`${API_PREFIX}/warningRule/importTemplate`, undefined, { responseType: 'blob' }),
  /** 导入预警规则（Excel 文件上传） */
  importData: (file: File) => {
    const formData = new FormData()
    formData.append('file', file)
    return request.post<string>(`${API_PREFIX}/warningRule/importData`, formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    })
  },
  /** 按当前筛选条件导出预警规则（返回文件流） */
  exportRules: (params: WarningRuleExportQuery) =>
    request.get(`${API_PREFIX}/warningRule/export`, { params, responseType: 'blob' }),
}

export const alertEventApi = {
  /** 预警面板数据：统计 + 近一小时最新预警列表（大屏预警处置卡片专用） */
  dashboard: () =>
    request.get<AlertDashboardVO>(`${API_PREFIX}/alertEvent/dashboard`),
  list: (params: AlertEventQuery) =>
    request.get<PageResult<AlertEventDTO>>(`${API_PREFIX}/alertEvent/list`, { params }),
  detail: (id: number) =>
    request.get<AlertEventDTO>(`${API_PREFIX}/alertEvent/${id}`),
  add: (data: Omit<AlertEventDTO, 'id'>) =>
    request.post(`${API_PREFIX}/alertEvent`, data),
  edit: (data: AlertEventDTO) =>
    request.put(`${API_PREFIX}/alertEvent`, data),
  changeStatus: (id: number, status: AlertEventDTO['status']) =>
    request.put(`${API_PREFIX}/alertEvent/changeStatus`, { id, status }),
  /** 清除预警事件（仅待派发状态可操作） */
  clear: (id: number) =>
    request.put(`${API_PREFIX}/alertEvent/clear/${id}`),
  /** 审核预警事件：confirm-确认关闭 return-退回重办（仅已处置状态可操作） */
  review: (data: AlertReviewPayload) =>
    request.put(`${API_PREFIX}/alertEvent/review`, data),
  dispatch: (data: DispatchTaskPayload) =>
    request.post<string>(`${API_PREFIX}/alertEvent/dispatch`, data),
  remove: (ids: number | number[]) =>
    request.delete(`${API_PREFIX}/alertEvent/${Array.isArray(ids) ? ids.join(',') : ids}`),
}

export const disposalTaskApi = {
  list: (params: DisposalTaskQuery) =>
    request.get<PageResult<DisposalTaskDTO>>(`${API_PREFIX}/disposalTask/list`, { params }),
  detail: (id: number) =>
    request.get<DisposalTaskDTO>(`${API_PREFIX}/disposalTask/${id}`),
  add: (data: Omit<DisposalTaskDTO, 'id'>) =>
    request.post(`${API_PREFIX}/disposalTask`, data),
  edit: (data: DisposalTaskDTO) =>
    request.put(`${API_PREFIX}/disposalTask`, data),
  changeStatus: (id: number, status: DisposalTaskDTO['status']) =>
    request.put(`${API_PREFIX}/disposalTask/changeStatus`, { id, status }),
  remove: (ids: number | number[]) =>
    request.delete(`${API_PREFIX}/disposalTask/${Array.isArray(ids) ? ids.join(',') : ids}`),
}

export const cleanRuleApi = {
  list: (params: CleanRuleQuery) =>
    request.get<PageResult<CleanRuleDTO>>(`${API_PREFIX}/cleanRule/list`, { params }),
  detail: (id: number) =>
    request.get<CleanRuleDTO>(`${API_PREFIX}/cleanRule/${id}`),
  add: (data: Omit<CleanRuleDTO, 'id'>) =>
    request.post(`${API_PREFIX}/cleanRule`, data),
  edit: (data: CleanRuleDTO) =>
    request.put(`${API_PREFIX}/cleanRule`, data),
  changeStatus: (id: number, enabled: 0 | 1) =>
    request.put(`${API_PREFIX}/cleanRule/changeStatus`, { id, enabled }),
  remove: (ids: number | number[]) =>
    request.delete(`${API_PREFIX}/cleanRule/${Array.isArray(ids) ? ids.join(',') : ids}`),
}

export const dataSourceApi = {
  list: (params: DataSourceQuery) =>
    request.get<PageResult<DataSourceDTO>>(`${API_PREFIX}/dataSource/list`, { params }),
  detail: (id: number) =>
    request.get<DataSourceDTO>(`${API_PREFIX}/dataSource/${id}`),
  add: (data: Omit<DataSourceDTO, 'id'>) =>
    request.post(`${API_PREFIX}/dataSource`, data),
  edit: (data: DataSourceDTO) =>
    request.put(`${API_PREFIX}/dataSource`, data),
  changeStatus: (id: number, enabled: 0 | 1) =>
    request.put(`${API_PREFIX}/dataSource/changeStatus`, { id, enabled }),
  remove: (ids: number | number[]) =>
    request.delete(`${API_PREFIX}/dataSource/${Array.isArray(ids) ? ids.join(',') : ids}`),
  /** AQI 详情（当前 AQI + 近 12 小时各污染物小时均值趋势；后端异常时不兜底 mock，页面展示空态） */
  aqiDetail: (id: number) =>
    request.get<unknown>(`${API_PREFIX}/dataSource/${id}/aqiDetail`),
}

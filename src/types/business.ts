export interface PageResult<T> {
  records: T[]
  total: number
  current: number
  size: number
}

export interface WarningRuleDTO {
  id: number
  ruleName: string
  dataType: string
  fieldName: string
  ruleType: string
  alertLevel: string
  priority: number
  enabled: 0 | 1
  config?: string | Record<string, unknown>
  autoDispatch: 0 | 1
  targetCity?: string
  targetCityId?: number
  targetDistrictId?: number | string
  targetTownId?: number | string
  deptId?: number
  description?: string
  createTime?: string
  updateTime?: string
}

export interface WarningRuleQuery {
  pageNum: number
  pageSize: number
  ruleName?: string
  dataType?: string
  fieldName?: string
  ruleType?: string
  alertLevel?: string
  enabled?: 0 | 1
}

export interface AlertEventDTO {
  id: number
  ruleId?: number
  ruleName: string
  alertLevel: string
  dataType: string
  deviceId?: string
  deviceName: string
  location: string
  city: string
  district: string
  townId?: number
  town?: string
  deptId?: number
  triggerReason: string
  status: 'undispatched' | 'pending' | 'processing' | 'completed' | 'closed'
  assignedCity?: string
  createTime?: string
  updateTime?: string
}

export interface AlertEventQuery {
  pageNum: number
  pageSize: number
  ruleName?: string
  alertLevel?: string
  dataType?: string
  deviceName?: string
  city?: string
  district?: string
  town?: string
  status?: string
}

export interface DispatchTaskPayload {
  alertId: number
  taskType: string
  assigneeId?: number
  requesterId?: number
  townId?: number
  requireTime?: string
  disposalContent?: string
}

export interface DisposalTaskDTO {
  id: number
  alertId: number
  dataType: string
  taskType: string
  status: 'pending' | 'received' | 'processing' | 'completed'
  assigneeId?: number
  assigneeName?: string
  requesterId?: number
  requesterName?: string
  requireTime?: string
  disposalContent?: string
  photos?: string | string[]
  completedAt?: string
  city?: string
  district?: string
  townId?: number
  town?: string
  deptId?: number
  createTime?: string
  updateTime?: string
}

export interface DisposalTaskQuery {
  pageNum: number
  pageSize: number
  alertId?: number
  dataType?: string
  taskType?: string
  status?: string
  assigneeName?: string
  requesterName?: string
  city?: string
  district?: string
  town?: string
}

export interface CleanRuleDTO {
  id: number
  ruleName: string
  dataType: string
  fieldName: string
  ruleType: string
  action: string
  enabled: 0 | 1
  priority: number
  description?: string
  deptId?: number
  config?: string | Record<string, unknown>
  createTime?: string
  updateTime?: string
}

export interface CleanRuleQuery {
  pageNum: number
  pageSize: number
  ruleName?: string
  dataType?: string
  fieldName?: string
  ruleType?: string
  action?: string
  enabled?: 0 | 1
}

export interface DataSourceDTO {
  id: number
  deviceId: string
  deviceName: string
  dataType: string
  protocol: string
  location?: string
  lng?: number
  lat?: number
  cityId?: number
  districtId?: number
  townId?: number
  deptId?: number
  enabled: 0 | 1
  connectionStatus: string
  description?: string
  createBy?: string
  createTime?: string
  updateBy?: string
  updateTime?: string
  /** 综合空气质量指数 AQI（needAqi=1 时返回） */
  aqi?: number
  /** 空气质量等级：优/良/轻度污染/中度污染/重度污染/严重污染 */
  aqiLevel?: string
  so2Iaqi?: number
  no2Iaqi?: number
  coIaqi?: number
  o3Iaqi?: number
  pm10Iaqi?: number
  pm25Iaqi?: number
}

export interface DataSourceQuery {
  pageNum: number
  pageSize: number
  deviceName?: string
  deviceId?: string
  dataType?: string
  protocol?: string
  enabled?: 0 | 1
  cityId?: number
  districtId?: number
  townId?: number
  /** 是否计算 AQI：1-计算 0或不传-不计算 */
  needAqi?: 0 | 1
}

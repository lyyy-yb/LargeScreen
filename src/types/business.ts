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

/** 预警规则导出查询条件（不含分页） */
export type WarningRuleExportQuery = Omit<WarningRuleQuery, 'pageNum' | 'pageSize'>

export interface AlertEventDTO {
  id: number
  ruleId?: number
  ruleName: string
  alertLevel: string
  dataType: string
  deviceId?: string
  deviceName: string
  location: string
  /** 地市部门 ID（dept_id 体系，后端不再返回名称） */
  cityId?: number
  /** 区县部门 ID */
  districtId?: number
  townId?: number
  /** 站点类型：fixed-固定站 mobile-移动站 */
  stationType?: string
  deptId?: number
  triggerReason: string
  /** 规则累计触发次数（预警列表接口返回） */
  triggerCount?: number
  /** 最近一次触发时间 */
  lastTriggerTime?: string
  /** 最近一次触发值；部分数据源可能返回字符串 */
  lastTriggerValue?: number | string
  status: 'undispatched' | 'pending' | 'processing' | 'completed' | 'closed' | 'cleared'
  assignedCity?: string
  /** 预警点位经度（list 接口返回，用于大屏地图打点） */
  lng?: number
  /** 预警点位纬度（list 接口返回，用于大屏地图打点） */
  lat?: number
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
  /** 地市部门 ID（后端按 ID 筛选，不再支持名称） */
  cityId?: number
  districtId?: number
  townId?: number
  stationType?: string
  /** 状态筛选，优先级高于 includeHistory */
  status?: string
  /** 是否显示历史预警（已清除/已关闭），默认只显示活跃预警 */
  includeHistory?: boolean
  /** 预警时间-开始（YYYY-MM-DD HH:mm:ss） */
  startTime?: string
  /** 预警时间-结束（YYYY-MM-DD HH:mm:ss） */
  endTime?: string
}

/** 预警事件审核（确认关闭/退回重办） */
export interface AlertReviewPayload {
  alertId: number
  /** confirm-确认关闭 return-退回重办 */
  action: 'confirm' | 'return'
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

/** 预警面板列表项（alertEvent/dashboard 返回） */
export interface AlertDashboardItem {
  /** 预警规则名称 */
  ruleName: string
  /** 监测位置 */
  location: string
  /** 预警时间 */
  alertTime: string
}

/** 预警面板数据：统计 + 近一小时最新预警列表（alertEvent/dashboard 返回） */
export interface AlertDashboardVO {
  /** 有效预警数（排除已清除和已关闭） */
  effectiveCount: number
  /** 待处置预警数（待派发 + 待处置） */
  pendingCount: number
  /** 处置中预警数 */
  processingCount: number
  /** 已完成预警数 */
  completedCount: number
  /** 今日派单数 */
  todayDispatchCount: number
  /** 今日处置数（今日关闭的预警） */
  todayClosedCount: number
  /** 近一小时最新预警列表 */
  latestAlerts: AlertDashboardItem[]
}

export interface DisposalPhotoDTO {
  id: string | number
  fileName?: string
  uploadTime?: string
  uploadBy?: string
  delFlag?: string
}

export interface DisposalVerificationDTO {
  id: string | number
  verificationResult?: string
  verifyTime?: string
  verifyBy?: string
  photos?: DisposalPhotoDTO[] | null
  delFlag?: string
}

export interface DisposalTaskDTO {
  id: number
  alertId: number
  dataType: string
  taskType: string
  /** 状态：pending-待接收 processing-处置中 committed-已提交 completed-已完成（received 已废弃） */
  status: 'pending' | 'processing' | 'committed' | 'completed'
  assigneeId?: number
  assigneeName?: string
  requesterId?: number
  requesterName?: string
  requireTime?: string
  disposalContent?: string
  verificationResult?: string
  verifications?: DisposalVerificationDTO[] | null
  photos?: string | string[]
  completedAt?: string
  /** 地市部门 ID（后端不再返回名称） */
  cityId?: number
  districtId?: number
  townId?: number
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
  cityId?: number
  districtId?: number
  townId?: number
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
  /** 站点短名（用于地图标注与详情弹窗） */
  shortName?: string
  dataType: string
  protocol: string
  /** 站点类型：fixed-固定站 mobile-移动站（仅空气质量监测站需要） */
  stationType?: string
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
  /** 所属无人机（drone_video）数据源 ID，仅 drone_sensor 类型有效 */
  droneId?: number
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
  /** 站点类型：fixed-固定站 mobile-移动站（仅空气质量监测站有效） */
  stationType?: string
  protocol?: string
  enabled?: 0 | 1
  cityId?: number
  districtId?: number
  townId?: number
  /** 是否计算 AQI：1-计算 0或不传-不计算 */
  needAqi?: 0 | 1
}

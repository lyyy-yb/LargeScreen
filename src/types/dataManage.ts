/** 数据管理模块类型定义（对应后端 Swagger `数据管理` tag，路径前缀 /data-manage/） */

/** 通用响应包装：后端使用 resultCode=0 表示成功（与若依 code=200 风格不同） */
export interface ResponseData<T = unknown> {
  resultCode: number
  message: string
  data: T
}

/** MyBatis-Plus 分页结构 */
export interface IPage<T> {
  records: T[]
  total: number
  size: number
  current: number
  pages: number
}

// ============ 微站数据（air-station） ============

/** 数据级别：minute-分钟级 hourly-小时级汇总 daily-日级汇总 */
export type AirDataLevel = 'minute' | 'hourly' | 'daily'

/** 微站数据详情查询参数 */
export interface DataDetailQuery {
  /** 设备编号（mn_code） */
  deviceId?: string
  /** 数据类型 */
  dataType?: string
  /** 数据级别 */
  level?: AirDataLevel
  /** 开始时间 */
  startTime?: string
  /** 结束时间 */
  endTime?: string
  pageNum?: number
  pageSize?: number
}

/** 微站数据详情 VO */
export interface AirDataDetailVO {
  id: number
  /** 设备编号 */
  deviceId: string
  /** 设备名称 */
  deviceName: string
  /** 数据级别 */
  dataLevel: AirDataLevel
  /** 监测时间 */
  dataTime: string
  /** PM2.5 μg/m³ */
  pm25: number | null
  /** PM10 μg/m³ */
  pm10: number | null
  /** 二氧化硫 μg/m³ */
  so2: number | null
  /** 二氧化氮 μg/m³ */
  no2: number | null
  /** 一氧化碳 mg/m³ */
  co: number | null
  /** 臭氧 μg/m³ */
  o3: number | null
  /** VOCs μg/m³ */
  vocs: number | null
  /** TSP μg/m³ */
  tsp: number | null
  /** 温度 ℃ */
  temperature: number | null
  /** 湿度 % */
  humidity: number | null
  /** 气压 KPa */
  pressure: number | null
  /** 风速 m/s */
  windSpeed: number | null
  /** 风向 ° */
  windDirection: number | null
  /** 样本数（汇总时才有） */
  sampleCount: number | null
}

/** 微站导出查询参数：与查询一致但不带分页（后端全量导出） */
export type DataDetailExportQuery = Omit<DataDetailQuery, 'pageNum' | 'pageSize'>

// ============ 走航任务（mobile-monitor） ============

/** 走航任务查询参数 */
export interface MobileMonitorQuery {
  /** 车辆编码（mnCode），必填 */
  mnCode: string
  /** 开始日期 yyyy-MM-dd */
  startDate?: string
  /** 结束日期 yyyy-MM-dd */
  endDate?: string
}

/**
 * 走航任务详情 VO
 * 注意：Swagger 声明为 mnCode / mnName / dataDates，
 * 实测后端返回 { deviceId, dataDates }，故两者都保留为可选。
 */
export interface MobileMonitorDetailVO {
  /** 实测返回的设备/车辆编码 */
  deviceId?: string | null
  /** Swagger 声明的车辆编码 */
  mnCode?: string | null
  /** Swagger 声明的车辆名称 */
  mnName?: string | null
  /** 有数据的日期列表 */
  dataDates: string[]
}

/** 走航任务导出查询参数 */
export type MobileMonitorExportQuery = MobileMonitorQuery

// ============ 无人机任务（drone-task） ============

/**
 * 任务状态：与 /drone 飞行任务（listFlyJob.jobStatus）同一套枚举，值为**字符串**
 * 0-等待中 1-进行中 a-已完成 f-失败
 * 注意：Swagger 声明为 int32，实际返回 jobStatus 字符串枚举，以实际数据为准。
 */
export type DroneTaskStatus = '0' | '1' | 'a' | 'f'

/** 数据来源：api-第三方接口 import-本地导入 */
export type DroneTaskDataSource = 'api' | 'import'

/** 无人机任务查询参数 */
export interface DroneTaskQuery {
  /** 机场编码 */
  dockCode?: string
  /** 任务名称（模糊查询） */
  taskName?: string
  /** 任务状态 */
  taskStatus?: DroneTaskStatus
  /** 开始时间 */
  startTime?: string
  /** 结束时间 */
  endTime?: string
  /** 是否包含第三方接口数据，默认 true */
  includeThirdParty?: boolean
  pageNum?: number
  pageSize?: number
}

/** 无人机任务 VO */
export interface DroneTaskVO {
  /** 任务ID */
  taskId: string
  /** 机场编码 */
  dockCode: string
  /** 飞行计划ID */
  planId: string
  /** 任务名称 */
  taskName: string
  /** 任务状态 */
  taskStatus: DroneTaskStatus
  /** 任务执行时间 */
  taskTime: string
  /** 失败原因 */
  failReason: string
  /** 任务执行结果数 */
  resultCount: number
  /** 数据来源 */
  dataSource: DroneTaskDataSource
  /** 备注 */
  remark: string
  /** 创建者 */
  createBy: string
  /** 创建时间 */
  createTime: string
}

/** 无人机任务导出查询参数：不带分页（后端全量导出） */
export type DroneTaskExportQuery = Omit<DroneTaskQuery, 'pageNum' | 'pageSize'>

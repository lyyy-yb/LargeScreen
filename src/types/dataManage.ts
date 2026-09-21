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
  /** 设备编号（deviceId），必填。后端 DTO 实际为 deviceId，非 Swagger 声明的 mnCode */
  deviceId: string
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
 * 任务状态：与 /drone 飞行任务（droneTaskVO.taskStatus）同一套枚举，值为**字符串**
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
  /** 任务执行（开始）时间 */
  taskTime: string
  /**
   * 任务结束时间。后端尚未提供该字段（drone-task/list 当前只返 taskTime），
   * 前端按 taskTime + 1h 兜底。
   */
  completedTime?: string
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

// ============ 通用上传资源（/hbdp/resource/*） ============

/**
 * 已上传的资源记录（来自 /hbdp/wurenji/task/resources 与 /hbdp/resource/upload）。
 * 一个资源代表一个图片或视频文件，最终由无人机任务的"上传"操作管理起来。
 */
export interface HbdpUploadResource {
  /** 主键 ID（上传后回填，用于预览 / 删除 / 关联到任务结果） */
  id: number
  /** 原始文件名 */
  fileName: string
  /** 相对存储路径 */
  filePath: string
  /** 文件大小（字节） */
  fileSize?: number
  /** 文件类型：image-图片 video-视频 */
  fileType: 'image' | 'video' | string
  /** MIME 类型（image/jpeg, video/mp4 等） */
  mimeType?: string
  /** 图片/视频宽度 */
  width?: number
  /** 图片/视频高度 */
  height?: number
  /** 视频时长（秒） */
  duration?: number
  /** 缩略图路径 */
  thumbnailPath?: string
  /** 业务类型：drone_task-无人机任务 evidence-举证 disposal-后续处置 */
  businessType?: string
  /** 业务 ID（一般等于 taskId） */
  businessId?: string
  /** 上传人 */
  createBy?: string
  /** 上传时间 */
  createTime?: string
}

/**
 * 资源关联提交入参（POST /data-manage/drone-task/result）。
 * 后端按 taskId + resourceIds[] 写入中间表。
 */
export interface DroneTaskResultSubmit {
  taskId: string
  resourceIds: number[]
}

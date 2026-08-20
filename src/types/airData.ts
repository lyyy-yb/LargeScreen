/** 站点最新实时数据（对应后端 AirDataLatestVO） */
export interface AirDataLatestVO {
  id: number
  mnCode: string
  deviceName: string
  shortName?: string
  dataType: string
  dataTime: string
  cityId: number
  districtId: number
  townId: number
  deptId: number
  /** 站点类型：fixed-固定站 mobile-移动站 */
  stationType?: string
  pm25: number
  pm10: number
  so2: number
  no2: number
  co: number
  o3: number
  vocs: number
  tsp: number
}

/** 按站点类型统计的近一小时各污染物值范围（对应后端 StationAirRangeDTO） */
export interface StationAirRange {
  /** 站点类型：fixed-固定站 mobile-移动站 */
  stationType: string
  pm25Min: number | null
  pm25Max: number | null
  pm10Min: number | null
  pm10Max: number | null
  so2Min: number | null
  so2Max: number | null
  no2Min: number | null
  no2Max: number | null
  coMin: number | null
  coMax: number | null
  o3Min: number | null
  o3Max: number | null
  vocsMin: number | null
  vocsMax: number | null
  tspMin: number | null
  tspMax: number | null
}

/** 地图空气质量打点（按数据源经纬度展示六级图标） */
export interface AirQualityPoint {
  name: string
  lng: number
  lat: number
  /** AQI 数值（图标上方显示） */
  value: number | null
  iaqi: number | null
  /** 数据源 ID（用于查询 aqiDetail 近 12 小时趋势） */
  id?: number
  /** 区域部门 ID（兼容旧模式保留） */
  deptId?: number
  /** 空气质量等级文本（优/良/轻度污染/…，决定六级图标） */
  aqiLevel?: string
  /** 各污染物分指数 IAQI（点击详情展示） */
  pm25Iaqi?: number | null
  pm10Iaqi?: number | null
  so2Iaqi?: number | null
  no2Iaqi?: number | null
  coIaqi?: number | null
  o3Iaqi?: number | null
}

/** 近 12 小时污染物小时均值趋势单条（对应 dataSource/{id}/aqiDetail；异常时不做 mock 兜底） */
export interface AirTrendItem {
  /** 小时标签（如 08:00） */
  hour: string
  pm25?: number | null
  pm10?: number | null
  so2?: number | null
  no2?: number | null
  co?: number | null
  o3?: number | null
}

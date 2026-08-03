/** 站点最新实时数据（对应后端 AirDataLatestVO） */
export interface AirDataLatestVO {
  id: number
  mnCode: string
  deviceName: string
  dataType: string
  dataTime: string
  cityId: number
  districtId: number
  townId: number
  deptId: number
  pm25: number
  pm10: number
  so2: number
  no2: number
  co: number
  o3: number
  vocs: number
  tsp: number
}

/** 区域小时均值统计结果（对应后端 HourlyAvgVO） */
export interface HourlyAvgVO {
  deptId: number
  field: string
  avgValue: number
  /** 空气质量分指数 IAQI（0~500），vocs/tsp 暂不支持时为 null */
  iaqi: number | null
  stationCount: number
  startTime: string
  endTime: string
}

/** 地图空气质量打点（按数据源经纬度展示六级图标） */
export interface AirQualityPoint {
  name: string
  lng: number
  lat: number
  /** AQI 数值（图标上方显示） */
  value: number | null
  iaqi: number | null
  /** 区域部门 ID（旧 hourlyAvg 模式兼容） */
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

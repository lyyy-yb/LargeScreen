import { request } from './request'
import type { AirDataLatestVO, StationAirRange, AirResolution, AirSeriesVO, MicroStationAvgVO } from '@/types/airData'

// ============ 空气质量数据查询（对应后端 /hbdp/airData） ============

/** 查询各设备上一完整小时的浓度均值。
 *  @param stationType 可选：fixed-固定站 mobile-移动站 */
export function airDataLatest(params?: { dataType?: string; deptId?: number; stationType?: string }) {
  return request.get<AirDataLatestVO[]>('/dpSys/hbdp/airData/latest', { params })
}

/** 按站点类型统计近一小时各污染物值范围（替代已下线的 hourlyAvg）。
 *  返回每种站点类型的 8 种污染物 min/max 区间 */
export function airDataStationAirRange(params?: { dataType?: string }) {
  return request.get<StationAirRange[]>('/dpSys/hbdp/airData/stationAirRange', { params })
}

/** 后台只接受分辨率和开始/结束时间，不传前端播放步长。 */
export function airDataSeries(params: { resolution: AirResolution; startTime: string; endTime: string }) {
  return request.get<AirSeriesVO>('/dpSys/hbdp/airData/series', { params })
}

export function airDataMicroStationAvg() {
  return request.get<MicroStationAvgVO>('/dpSys/hbdp/airData/microStationAvg')
}

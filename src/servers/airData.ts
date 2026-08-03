import { request } from './request'
import type { AirDataLatestVO, HourlyAvgVO } from '@/types/airData'

// ============ 空气质量数据查询（对应后端 /hbdp/airData） ============

/** 查询站点最新一条实时数据（空气质量监测站列表）。
 *  后台暂未要求传地市 deptId，但按业务需要一并传递（先传着）。 */
export function airDataLatest(params?: { dataType?: string; deptId?: number }) {
  return request.get<AirDataLatestVO[]>('/dpSys/hbdp/airData/latest', { params })
}

/** 统计指定区域一小时污染物均值（地图按市/区县打点）。
 *  @param deptId 区域部门ID（省/市/区县/乡镇）
 *  @param field 污染物字段（so2/no2/co/o3/pm25/pm10/vocs/tsp） */
export function airDataHourlyAvg(params: { deptId: number; field: string }) {
  return request.get<HourlyAvgVO>('/dpSys/hbdp/airData/hourlyAvg', { params })
}

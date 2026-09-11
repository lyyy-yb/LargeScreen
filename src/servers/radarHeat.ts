import { request } from './request'

export interface SpsPeriod {
  periodId: string; radarId: string; scanType: string
  startTime: string; endTime: string; rayCount: number
}
export interface SpsRay { dataTime: string; distanceArray: unknown; valueArray: unknown; hangle: number; vangle: number }
export interface SpsDetail extends SpsPeriod { rays: SpsRay[] }

export function radarPeriods(params: { radarId: string; startTime?: string; endTime?: string; limit?: number }) {
  return request.get<SpsPeriod[]>('/dpSys/hbdp/radarSps/periods', { params })
}
export function radarPeriodDetail(periodId: string) {
  return request.get<SpsDetail>('/dpSys/hbdp/radarSps/detail', { params: { periodId } })
}

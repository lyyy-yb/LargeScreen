import type { DeptInfo, RoleLevel } from './auth'

export interface RegionSelection {
  provinceCode: '330000'
  provinceName: '浙江省'
  cityCode?: string
  cityName?: string
  countyCode?: string
  countyName?: string
  townDeptId?: number
  townName?: string
}

export interface RegionContext {
  roleLevel: RoleLevel
  defaultSelection: RegionSelection
  selection: RegionSelection
  mapSelection: RegionSelection
  querySelection: RegionSelection
  departments: DeptInfo[]
  usedFallback: boolean
  fallbackMessage?: string
  initialized: boolean
}

export interface RegionQueryParams {
  province: string
  provinceCode: string
  city?: string
  cityCode?: string
  district?: string
  districtCode?: string
  county?: string
  countyCode?: string
  town?: string
  townDeptId?: number
}


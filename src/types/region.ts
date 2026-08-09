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
  /** 命中的角色权限字符（如 city_admin / city_business），用于同层级下的角色差异控制 */
  roleKey?: string
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


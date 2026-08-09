import type { DeptInfo, RoleInfo, RoleLevel, UserInfo } from '@/types/auth'
import type { RegionContext, RegionQueryParams, RegionSelection } from '@/types/region'
import { cities, districts } from '@/utils/city'

const PROVINCE: RegionSelection = {
  provinceCode: '330000',
  provinceName: '浙江省',
}

const FALLBACK_CITY = cities.find(item => item.name === '杭州市')!
const FALLBACK_COUNTY = districts.find(item => item.name === '西湖区' && item.parent === Number(FALLBACK_CITY.adcode))!
const FALLBACK_TOWN = '西湖风景名胜区街道'

// 角色权限字符（后台新命名）→ 展示层级映射，按优先级排序；旧权限字符保留兼容
const ROLE_KEY_LEVELS: Array<{ level: RoleLevel; keys: string[] }> = [
  { level: 'admin', keys: ['admin'] },
  { level: 'city', keys: ['city_admin', 'city_business', 'city'] },
  { level: 'county', keys: ['district_admin', 'district_business', 'county'] },
  { level: 'town', keys: ['town_business', 'town'] },
]

// 业务人员角色：首页与区域范围与对应管理员一致（乡镇除外），但隐藏管理型界面与入口
const BUSINESS_ROLE_KEYS = new Set(['city_business', 'district_business', 'town_business'])

export type AlertTab = 'rules' | 'alerts' | 'tasks' | 'trends'

// 市/区县业务人员可见的底部导航：监控大屏、光量子雷达、预警中心
const CITY_COUNTY_BUSINESS_TAB_KEYS = ['/monitor', '/radar', '/alert']

// 市/区县业务人员禁止访问的页面（矩阵未授予的功能）
const CITY_COUNTY_BUSINESS_BLOCKED_PATHS = ['/drone', '/patrol', '/report', '/pollution', '/manage/data-source', '/manage/clean-rule']

// 乡镇业务人员仅有小程序与数据管理权限，大屏页面全部不可访问
const TOWN_BUSINESS_BLOCKED_PATHS = ['/monitor', '/radar', '/drone', '/patrol', '/alert', '/report', '/pollution']

export function isBusinessRole(context?: { roleKey?: string } | null) {
  return !!context?.roleKey && BUSINESS_ROLE_KEYS.has(context.roleKey)
}

// 底部导航可见页：返回 null 表示不限制；空数组表示无可见导航（乡镇业务人员）
export function getVisibleTabKeys(roleKey?: string): string[] | null {
  if (roleKey === 'city_business' || roleKey === 'district_business') return CITY_COUNTY_BUSINESS_TAB_KEYS
  if (roleKey === 'town_business') return []
  return null
}

// 角色禁止直接访问的路由；返回空数组表示不限制
export function getBlockedPaths(roleKey?: string): string[] {
  if (roleKey === 'town_business') return TOWN_BUSINESS_BLOCKED_PATHS
  if (roleKey === 'city_business' || roleKey === 'district_business') return CITY_COUNTY_BUSINESS_BLOCKED_PATHS
  return []
}

// 角色登录/重定向落地页：乡镇业务人员仅能进入数据管理
export function getLandingPath(roleKey?: string): string {
  return roleKey === 'town_business' ? '/manage/data-manage' : '/monitor'
}

function normalizeName(value = '') {
  return value.trim().replace(/\s+/g, '')
}

function nameEquals(left: string, right: string) {
  const a = normalizeName(left)
  const b = normalizeName(right)
  if (a === b) return true
  return a.replace(/[省市区县]$/, '') === b.replace(/[省市区县]$/, '')
}

export function resolveRole(
  rawRoles: string[] = [],
  userRoles: RoleInfo[] = [],
): { level: RoleLevel; roleKey: string } {
  const roleKeys = new Set([
    ...rawRoles.map(role => role.toLowerCase()),
    ...userRoles.map(role => role.roleKey?.toLowerCase()).filter(Boolean),
  ])
  for (const { level, keys } of ROLE_KEY_LEVELS) {
    const matched = keys.find(key => roleKeys.has(key))
    if (matched) return { level, roleKey: matched }
  }
  return { level: 'town', roleKey: '' }
}

export function resolveRoleLevel(rawRoles: string[] = [], userRoles: RoleInfo[] = []): RoleLevel {
  return resolveRole(rawRoles, userRoles).level
}

// 预警中心可见页签：地市业务人员仅区域预警实时动向；区县业务人员为实时预警监控+处置任务管理；
// 返回 null 表示不限制（管理员/乡镇等维持原有逻辑）
export function getVisibleAlertTabs(roleKey?: string): AlertTab[] | null {
  if (roleKey === 'city_business') return ['trends']
  if (roleKey === 'district_business') return ['alerts', 'tasks']
  return null
}

function flattenDepartments(items: DeptInfo[]): DeptInfo[] {
  const result: DeptInfo[] = []
  const visit = (item: DeptInfo) => {
    result.push(item)
    item.children?.forEach(visit)
  }
  items.forEach(visit)
  return result
}

function getDepartmentPath(user: UserInfo, departments: DeptInfo[]) {
  const flattened = flattenDepartments(departments)
  const index = new Map(flattened.map(item => [Number(item.deptId), item]))
  if (user.dept) index.set(Number(user.dept.deptId), user.dept)

  const currentId = Number(user.deptId ?? user.dept?.deptId)
  if (!Number.isFinite(currentId)) return []
  const current = index.get(currentId)
  if (!current || current.status === '1') return []

  const ancestorIds = (current.ancestors || '')
    .split(',')
    .map(value => Number(value))
    .filter(value => Number.isFinite(value) && value > 0)
  const fromAncestors = [...ancestorIds.map(id => index.get(id)).filter((item): item is DeptInfo => !!item), current]
  if (fromAncestors.length > 1) return fromAncestors

  const reversed: DeptInfo[] = []
  const visited = new Set<number>()
  let cursor: DeptInfo | undefined = current
  while (cursor && !visited.has(Number(cursor.deptId))) {
    reversed.push(cursor)
    visited.add(Number(cursor.deptId))
    cursor = cursor.parentId ? index.get(Number(cursor.parentId)) : undefined
  }
  return reversed.reverse()
}

function findGeographicPath(path: DeptInfo[]) {
  let city = path
    .map(dept => cities.find(item => nameEquals(item.name, dept.deptName)))
    .find(Boolean)

  let county = path
    .map(dept => districts.find(item => nameEquals(item.name, dept.deptName) && (!city || item.parent === Number(city.adcode))))
    .find(Boolean)

  if (!city && county) city = cities.find(item => Number(item.adcode) === county?.parent)
  if (city && !county) {
    county = path
      .map(dept => districts.find(item => nameEquals(item.name, dept.deptName) && item.parent === Number(city?.adcode)))
      .find(Boolean)
  }

  const countyDeptIndex = county
    ? path.findIndex(dept => nameEquals(dept.deptName, county!.name))
    : -1
  const townDept = countyDeptIndex >= 0 ? path.slice(countyDeptIndex + 1).find(dept => dept.status !== '1') : undefined

  return { city, county, townDept }
}

function withCity(city = FALLBACK_CITY): RegionSelection {
  return { ...PROVINCE, cityCode: city.adcode, cityName: city.name }
}

function withCounty(
  city = FALLBACK_CITY,
  county = FALLBACK_COUNTY,
): RegionSelection {
  return {
    ...withCity(city),
    countyCode: String(county.adcode),
    countyName: county.name,
  }
}

export function createRegionContext(
  user: UserInfo,
  rawRoles: string[] = [],
  departments: DeptInfo[] = [],
): RegionContext {
  const { level: roleLevel, roleKey } = resolveRole(rawRoles, user.roles)
  if (roleLevel === 'admin') {
    return {
      roleLevel,
      roleKey,
      defaultSelection: PROVINCE,
      selection: PROVINCE,
      mapSelection: PROVINCE,
      querySelection: PROVINCE,
      departments,
      usedFallback: false,
      initialized: true,
    }
  }

  const { city, county, townDept } = findGeographicPath(getDepartmentPath(user, departments))
  let defaultSelection: RegionSelection
  let mapSelection: RegionSelection
  let usedFallback: boolean
  let fallbackMessage: string | undefined

  if (roleLevel === 'city') {
    usedFallback = !city
    defaultSelection = withCity(city || FALLBACK_CITY)
    mapSelection = defaultSelection
    if (usedFallback) fallbackMessage = '当前账号未配置有效的所在市（部门），已默认定位到杭州市'
  } else if (roleLevel === 'county') {
    usedFallback = !city || !county
    defaultSelection = withCounty(city && county ? city : FALLBACK_CITY, city && county ? county : FALLBACK_COUNTY)
    mapSelection = defaultSelection
    if (usedFallback) fallbackMessage = '当前账号未配置有效的所在区县（部门），已默认定位到杭州市西湖区'
  } else {
    usedFallback = !city || !county || !townDept
    const base = withCounty(city && county && townDept ? city : FALLBACK_CITY, city && county && townDept ? county : FALLBACK_COUNTY)
    defaultSelection = {
      ...base,
      townDeptId: usedFallback ? undefined : townDept?.deptId,
      townName: usedFallback ? FALLBACK_TOWN : townDept?.deptName,
    }
    mapSelection = base
    if (usedFallback) fallbackMessage = '当前账号未配置有效的所在乡镇街道（部门），已默认定位到西湖风景名胜区街道'
  }

  return {
    roleLevel,
    roleKey,
    defaultSelection,
    selection: defaultSelection,
    mapSelection,
    querySelection: defaultSelection,
    departments,
    usedFallback,
    fallbackMessage,
    initialized: true,
  }
}

export function toRegionQuery(selection: RegionSelection): RegionQueryParams {
  return {
    province: selection.provinceName,
    provinceCode: selection.provinceCode,
    ...(selection.cityName ? { city: selection.cityName, cityCode: selection.cityCode } : {}),
    ...(selection.countyName
      ? {
          district: selection.countyName,
          districtCode: selection.countyCode,
          county: selection.countyName,
          countyCode: selection.countyCode,
        }
      : {}),
    ...(selection.townName ? { town: selection.townName, townDeptId: selection.townDeptId } : {}),
  }
}

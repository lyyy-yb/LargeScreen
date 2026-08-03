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

const ROLE_PRIORITY: RoleLevel[] = ['admin', 'city', 'county', 'town']

function normalizeName(value = '') {
  return value.trim().replace(/\s+/g, '')
}

function nameEquals(left: string, right: string) {
  const a = normalizeName(left)
  const b = normalizeName(right)
  if (a === b) return true
  return a.replace(/[省市区县]$/, '') === b.replace(/[省市区县]$/, '')
}

export function resolveRoleLevel(rawRoles: string[] = [], userRoles: RoleInfo[] = []): RoleLevel {
  const roleKeys = new Set([
    ...rawRoles.map(role => role.toLowerCase()),
    ...userRoles.map(role => role.roleKey?.toLowerCase()).filter(Boolean),
  ])
  return ROLE_PRIORITY.find(role => roleKeys.has(role)) || 'town'
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
  const roleLevel = resolveRoleLevel(rawRoles, user.roles)
  if (roleLevel === 'admin') {
    return {
      roleLevel,
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

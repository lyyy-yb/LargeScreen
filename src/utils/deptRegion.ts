import { cities, districts } from '@/utils/city'
import type { DeptInfo } from '@/types/auth'

export interface RegionOption {
  value: string
  label: string
}

export function flattenDepartments(items: DeptInfo[]): DeptInfo[] {
  const result: DeptInfo[] = []
  const seen = new Set<number | string>()
  const walk = (list: DeptInfo[]) => {
    list.forEach(item => {
      const id = item.deptId
      if (!seen.has(id)) {
        seen.add(id)
        result.push(item)
      }
      if (item.children?.length) walk(item.children)
    })
  }
  walk(items)
  return result
}

export function normalizeName(value?: string | null) {
  return (value ?? '').trim().replace(/\s+/g, '')
}

export function nameEquals(left?: string | null, right?: string | null) {
  const a = normalizeName(left)
  const b = normalizeName(right)
  if (!a || !b) return false
  if (a === b) return true
  return a.replace(/[省市区县]$/, '') === b.replace(/[省市区县]$/, '')
}

export function isCityDept(dept: DeptInfo) {
  return cities.some(city => nameEquals(city.name, dept.deptName))
}

export function isDistrictDept(dept: DeptInfo, cityDept?: DeptInfo) {
  if (cityDept) {
    const cityAdcode = Number(cities.find(c => nameEquals(c.name, cityDept.deptName))?.adcode)
    return districts.some(d => nameEquals(d.name, dept.deptName) && (!cityAdcode || d.parent === cityAdcode))
  }
  return districts.some(d => nameEquals(d.name, dept.deptName))
}

export function findRootDepartment(allDepts: DeptInfo[]) {
  const roots = allDepts.filter(d => !d.parentId || Number(d.parentId) === 0)
  if (roots.length <= 1) return roots[0]
  return roots.reduce((max, d) => {
    const maxDesc = countDescendants(allDepts, Number(max.deptId))
    const desc = countDescendants(allDepts, Number(d.deptId))
    return desc > maxDesc ? d : max
  })
}

export function countDescendants(allDepts: DeptInfo[], parentId: number) {
  let count = 0
  const walk = (pid: number) => {
    const children = allDepts.filter(d => Number(d.parentId) === pid)
    count += children.length
    children.forEach(c => walk(Number(c.deptId)))
  }
  walk(parentId)
  return count
}

export function buildDeptRegionOptions(allDepts: DeptInfo[]) {
  let cityDepts = allDepts.filter(isCityDept)
  if (!cityDepts.length) {
    const root = findRootDepartment(allDepts)
    if (root) cityDepts = allDepts.filter(d => Number(d.parentId) === Number(root.deptId))
  }
  const cityDeptIds = new Set(cityDepts.map(d => Number(d.deptId)))

  const getCityDept = (cityId?: number | string) => allDepts.find(d => Number(d.deptId) === Number(cityId))

  const getDistrictOptions = (cityId?: number | string): RegionOption[] => {
    if (!cityId) return []
    const cityDept = getCityDept(cityId)
    let children = allDepts.filter(d => Number(d.parentId) === Number(cityId))
    if (!children.length && cityDept) {
      const cityAdcode = Number(cities.find(c => nameEquals(c.name, cityDept.deptName))?.adcode)
      children = allDepts.filter(d => isDistrictDept(d, cityDept) && (!cityAdcode || districts.find(item => nameEquals(item.name, d.deptName))?.parent === cityAdcode))
    }
    return children.map(d => ({ value: String(d.deptId), label: d.deptName }))
  }

  const getTownOptions = (districtId?: number | string): RegionOption[] => {
    if (!districtId) return []
    const children = allDepts.filter(d => Number(d.parentId) === Number(districtId) && !cityDeptIds.has(Number(d.deptId)))
    return children.map(d => ({ value: String(d.deptId), label: d.deptName }))
  }

  return {
    cityOptions: cityDepts.map(d => ({ value: String(d.deptId), label: d.deptName })),
    getDistrictOptions,
    getTownOptions,
  }
}

export function addOption(
  options: RegionOption[],
  value?: number | string,
  label?: string,
) {
  if (!value || !label || options.some(option => String(option.value) === String(value))) return options
  return [{ value: String(value), label }, ...options]
}

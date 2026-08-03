import type { DeptInfo } from '@/types/auth'

/** AQI 六级分类 key（与 public/marker/aq-*.png 图标一一对应） */
export type AqiLevelKey = 'good' | 'moderate' | 'light' | 'medium' | 'heavy' | 'severe'

/** IAQI → 六级分类（0~50 优 / 51~100 良 / 101~150 轻度 / 151~200 中度 / 201~300 重度 / >300 严重） */
export function iaqiToLevel(iaqi: number | null | undefined): AqiLevelKey {
  if (iaqi == null || !Number.isFinite(iaqi)) return 'good'
  if (iaqi <= 50) return 'good'
  if (iaqi <= 100) return 'moderate'
  if (iaqi <= 150) return 'light'
  if (iaqi <= 200) return 'medium'
  if (iaqi <= 300) return 'heavy'
  return 'severe'
}

/** AQI 六级图标（空气质量监测站图例同款） */
export const AQI_LEVEL_ICON: Record<AqiLevelKey, string> = {
  good: '/marker/aq-good.png',
  moderate: '/marker/aq-moderate.png',
  light: '/marker/aq-light.png',
  medium: '/marker/aq-medium.png',
  heavy: '/marker/aq-heavy.png',
  severe: '/marker/aq-severe.png',
}

/** 后端 aqiLevel 中文等级 → 六级分类 key */
export const AQI_LEVEL_TEXT: Record<string, AqiLevelKey> = {
  '优': 'good',
  '良': 'moderate',
  '轻度污染': 'light',
  '中度污染': 'medium',
  '重度污染': 'heavy',
  '严重污染': 'severe',
}

/** 根据 aqiLevel 文本（优先）或 iaqi 数值解析六级分类 key */
export function resolveAqiLevelKey(aqiLevel?: string | null, iaqi?: number | null): AqiLevelKey {
  if (aqiLevel) {
    const key = AQI_LEVEL_TEXT[aqiLevel.trim()]
    if (key) return key
  }
  return iaqiToLevel(iaqi)
}

/** 大屏指标选择框（PM2.5/SO2/NOX/TVOCs）→ 后端污染物字段 */
export const METRIC_TO_FIELD: Record<string, string> = {
  'PM2.5': 'pm25',
  'SO2': 'so2',
  'NOX': 'no2',
  'TVOCs': 'vocs',
}

/** 污染物字段 → 展示标签 */
export const FIELD_LABEL: Record<string, string> = {
  pm25: 'PM2.5',
  pm10: 'PM10',
  so2: 'SO₂',
  no2: 'NO₂',
  co: 'CO',
  o3: 'O₃',
  vocs: 'VOCs',
  tsp: 'TSP',
}

function normalizeName(value = '') {
  return value.trim().replace(/\s+/g, '')
}

function nameEquals(left?: string | null, right?: string | null) {
  const a = normalizeName(left ?? '')
  const b = normalizeName(right ?? '')
  if (!a || !b) return false
  if (a === b) return true
  return a.replace(/[省市区县]$/, '') === b.replace(/[省市区县]$/, '')
}

/** 扁平化部门树 */
export function flattenDepts(items: DeptInfo[]): DeptInfo[] {
  const result: DeptInfo[] = []
  const visit = (item: DeptInfo) => {
    result.push(item)
    item.children?.forEach(visit)
  }
  items.forEach(visit)
  return result
}

/** 按市名匹配部门 ID */
export function findCityDeptId(allDepts: DeptInfo[], cityName?: string): number | undefined {
  if (!cityName) return undefined
  return allDepts.find(d => nameEquals(d.deptName, cityName))?.deptId
}

/** 按区县名匹配部门 ID（优先在指定市的子部门中匹配，避免跨市重名） */
export function findDistrictDeptId(allDepts: DeptInfo[], districtName?: string, cityName?: string): number | undefined {
  if (!districtName) return undefined
  const cityDeptId = findCityDeptId(allDepts, cityName)
  if (cityDeptId != null) {
    const child = allDepts.find(d => Number(d.parentId) === Number(cityDeptId) && nameEquals(d.deptName, districtName))
    if (child) return child.deptId
  }
  return allDepts.find(d => nameEquals(d.deptName, districtName))?.deptId
}

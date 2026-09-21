/**
 * 无人机机场（dockList）公共类型与工具函数
 *
 * 后端 /dpSys/hbdp/wurenji/dockList 新增字段：
 * - status: boolean   true=在线，false=离线
 * - modeCode: number  0=空闲，1=调试，2=远程调试，3=升级，4=工作中
 */

/** 机场工作模式编码 */
export type DockModeCode = 0 | 1 | 2 | 3 | 4

/** 机场工作模式中文 */
export const DOCK_MODE_LABEL: Record<DockModeCode, string> = {
  0: '空闲',
  1: '调试',
  2: '远程调试',
  3: '升级',
  4: '工作中',
}

/** 机场列表原始项（与后端 dockList 返回保持一致） */
export interface DockItem {
  dockCode: string
  dockName: string
  dockAddress?: string
  dockLat?: number | string
  dockLng?: number | string
  /** true=在线，false=离线 */
  status?: boolean | string
  /** 0=空闲，1=调试，2=远程调试，3=升级，4=工作中 */
  modeCode?: DockModeCode | number
  /** 无人机对应的传感器编码数组 */
  sensorDeviceIds?: string[]
  [key: string]: unknown
}

/** 规范化后的机场状态（用于 UI 展示） */
export interface NormalizedDock {
  dockCode: string
  dockName: string
  dockAddress: string
  dockLng: number
  dockLat: number
  online: boolean
  statusText: '在线' | '离线'
  modeCode: DockModeCode
  modeLabel: string
  /** 关联的首个传感器编码（无值时为 null） */
  sensorDeviceId: string | null
  /** 原始传感器编码数组 */
  sensorDeviceIds: string[]
}

/** 判断机场在线状态：兼容 boolean 及 字符串/数字 */
export function getDockOnlineStatus(statusRaw: unknown): { online: boolean; statusText: '在线' | '离线' } {
  if (typeof statusRaw === 'boolean') {
    return { online: statusRaw, statusText: statusRaw ? '在线' : '离线' }
  }
  if (statusRaw !== undefined && statusRaw !== null && String(statusRaw).trim() !== '') {
    const s = String(statusRaw).toLowerCase()
    if (['true', '1', 'online', 'normal', 'running', '在线', '正常', '运行'].includes(s)) {
      return { online: true, statusText: '在线' }
    }
    if (['false', '0', 'offline', 'off', 'fault', 'error', '离线', '故障', '异常', '停用'].includes(s)) {
      return { online: false, statusText: '离线' }
    }
  }
  return { online: false, statusText: '离线' }
}

/** 判断机场是否可以被派遣：必须在线且空闲 */
export function isDockDispatchable(dock: { online?: boolean; modeCode?: DockModeCode | number }): boolean {
  return dock.online === true && Number(dock.modeCode) === 0
}

/** 获取机场在线状态文本 */
export function getDockOnlineText(online?: boolean): string {
  if (online === true) return '在线'
  if (online === false) return '离线'
  return '未知'
}

/** 获取工作模式中文标签 */
export function getDockModeLabel(modeCode?: DockModeCode | number): string {
  if (modeCode === undefined || modeCode === null || Number.isNaN(Number(modeCode))) return '空闲'
  const code = Number(modeCode)
  return DOCK_MODE_LABEL[code as DockModeCode] ?? `模式${code}`
}

/** 获取工作模式对应主题颜色 */
export function getDockModeColor(modeCode?: DockModeCode | number): string {
  const code = Number(modeCode ?? 0)
  switch (code) {
    case 0: return '#01C2FF' // 空闲: 亮青
    case 1: return '#FA8C16' // 调试: 橙色
    case 2: return '#13C2C2' // 远程调试: 青绿
    case 3: return '#722ED1' // 升级: 紫色
    case 4: return '#52C41A' // 工作中: 绿色
    default: return '#01C2FF'
  }
}

/** 将原始 dockList 项转换为规范化对象 */
export function normalizeDock(item: DockItem | Record<string, unknown>): NormalizedDock {
  const raw = item as Record<string, unknown>
  const dockCode = String(raw.dockCode ?? raw.id ?? '')
  const dockName = String(raw.dockName ?? raw.name ?? '未命名机场')
  const dockAddress = String(raw.dockAddress ?? raw.address ?? raw.location ?? '地址未维护')
  const dockLng = Number(raw.dockLng ?? raw.lng ?? raw.longitude)
  const dockLat = Number(raw.dockLat ?? raw.lat ?? raw.latitude)

  const { online, statusText } = getDockOnlineStatus(raw.status)

  const rawMode = raw.modeCode
  const modeNum = Number(rawMode ?? 0)
  const normalizedMode = Number.isFinite(modeNum) && modeNum >= 0 && modeNum <= 4
    ? (modeNum as DockModeCode)
    : (0 as DockModeCode)

  const rawSensorIds = Array.isArray(raw.sensorDeviceIds)
    ? (raw.sensorDeviceIds as unknown[]).map(String).filter(Boolean)
    : []
  const sensorDeviceId = rawSensorIds.length > 0 ? rawSensorIds[0] : null

  return {
    dockCode,
    dockName,
    dockAddress,
    dockLng: Number.isFinite(dockLng) ? dockLng : 0,
    dockLat: Number.isFinite(dockLat) ? dockLat : 0,
    online,
    statusText,
    modeCode: normalizedMode,
    modeLabel: getDockModeLabel(normalizedMode),
    sensorDeviceId,
    sensorDeviceIds: rawSensorIds,
  }
}


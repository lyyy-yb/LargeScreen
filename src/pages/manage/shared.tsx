import { useEffect } from 'react'
import { Tag } from 'antd'
import dayjs, { type Dayjs } from 'dayjs'
import type { AirDataLevel, DroneTaskDataSource, DroneTaskStatus } from '@/types/dataManage'

export type TabKey = 'station' | 'mobile' | 'drone'

/** 查询条件变更后防抖触发接口查询的时长 */
export const QUERY_DEBOUNCE = 500

/** 默认时间范围：昨天 00:00:00 ~ 今天 00:00:00（默认查一天） */
export function defaultDayRange(): [Dayjs, Dayjs] {
  return [dayjs().subtract(1, 'day').startOf('day'), dayjs().startOf('day')]
}

/**
 * 查询条件变化后防抖自动查询（无需查询/重置按钮）
 * 用 effect + setTimeout 实现：条件变化即重置定时器，停止输入 500ms 后才真正请求
 * @param enabled 是否启用（仅当前页签激活时查询）
 * @param query 查询条件（需为稳定引用，用 useMemo 包装）
 * @param run 实际执行的查询函数
 */
export function useDebouncedQuery(enabled: boolean, query: unknown, run: () => void, delay = QUERY_DEBOUNCE) {
  useEffect(() => {
    if (!enabled) return
    const timer = setTimeout(run, delay)
    return () => clearTimeout(timer)
    // run 随 state 变化产生新引用，此处只依赖查询条件本身，故忽略
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, query, delay])
}

/** 数据级别：'' 表示全部（后端不传 level） */
export const LEVEL_OPTIONS: { value: AirDataLevel | ''; label: string }[] = [
  { value: '', label: '全部' },
  { value: 'minute', label: '分钟级' },
  { value: 'hourly', label: '小时级汇总' },
  { value: 'daily', label: '日级汇总' },
]

export const LEVEL_LABEL: Record<AirDataLevel, string> = {
  minute: '分钟级',
  hourly: '小时级汇总',
  daily: '日级汇总',
}

export const LEVEL_COLOR: Record<AirDataLevel, string> = {
  minute: 'blue',
  hourly: 'orange',
  daily: 'purple',
}

/**
 * 无人机任务状态：与 /drone 飞行任务（listFlyJob.jobStatus）同一套字符串枚举
 * 0-等待中 1-进行中 a-已完成 f-失败
 */
export const TASK_STATUS_MAP: Record<DroneTaskStatus, { label: string; color: string }> = {
  '0': { label: '等待中', color: 'default' },
  '1': { label: '进行中', color: 'processing' },
  'a': { label: '已完成', color: 'success' },
  'f': { label: '失败', color: 'error' },
}

export const TASK_STATUS_OPTIONS: { value: DroneTaskStatus; label: string }[] = [
  { value: '0', label: '等待中' },
  { value: '1', label: '进行中' },
  { value: 'a', label: '已完成' },
  { value: 'f', label: '失败' },
]

/** 表格状态渲染：后端可能返回数字或字符串，统一转字符串后再查表 */
export function renderTaskStatus(v: unknown) {
  const meta = TASK_STATUS_MAP[String(v) as DroneTaskStatus]
  return <Tag color={meta?.color}>{meta?.label ?? String(v ?? '-')}</Tag>
}

export const DATA_SOURCE_MAP: Record<DroneTaskDataSource, string> = {
  api: '第三方接口',
  import: '本地导入',
}

export const DATE_TIME_FMT = 'YYYY-MM-DD HH:mm:ss'
export const DATE_FMT = 'YYYY-MM-DD'

/** 数值格式化：分钟级/小时级部分污染物为 null，统一渲染为 - */
export const fmt = (v: number | null | undefined) => (v == null ? '-' : v)

/** 下载 Blob 文件（模板下载/导出共用） */
export function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = filename
  document.body.appendChild(anchor)
  anchor.click()
  anchor.remove()
  URL.revokeObjectURL(url)
}

/** 后端异常时也会返回 JSON 格式的 blob，先识别再提示 */
export async function isJsonErrorBlob(blob: Blob): Promise<boolean> {
  if (!blob.type.includes('application/json')) return false
  try {
    const body = JSON.parse(await blob.text()) as { msg?: string; message?: string }
    return !(body == null)
  } catch {
    return true
  }
}

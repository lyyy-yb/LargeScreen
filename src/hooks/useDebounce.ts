import { useEffect, useState } from 'react'

/**
 * 通用值防抖 hook：输入值在 delay 毫秒内不再变化才返回更新后的值。
 * 用于搜索框/筛选条件变更触发的列表查询，避免连续输入期间每次按键都打接口。
 *
 * @param value 任意需要防抖的值
 * @param delay 防抖窗口毫秒数，默认 300
 * @returns 与 value 同类型、但延后更新的稳定值
 */
export function useDebounce<T>(value: T, delay = 300): T {
  const [debounced, setDebounced] = useState(value)
  useEffect(() => {
    const timer = window.setTimeout(() => setDebounced(value), delay)
    return () => window.clearTimeout(timer)
  }, [value, delay])
  return debounced
}

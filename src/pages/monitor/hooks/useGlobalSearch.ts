import { useCallback, useEffect, useRef, useState } from 'react'
import { globalSearch } from '@/servers/mapBox'
import type { GlobalSearchItem } from '@/servers/mapBox'

export interface UseGlobalSearchOptions {
  /** 输入防抖间隔（ms），默认 800 */
  debounceMs?: number
  /** 选中某条结果后的副作用（如地图定位），由调用方决定具体动作 */
  onLocate?: (item: GlobalSearchItem) => void
}

export interface UseGlobalSearchResult {
  keyword: string
  results: GlobalSearchItem[]
  loading: boolean
  open: boolean
  onChange: (value: string) => void
  onSubmit: () => void
  onClear: () => void
  onSelect: (item: GlobalSearchItem) => void
  onFocus: () => void
  onClose: () => void
}

/**
 * 监控大屏全局搜索 hook：
 * - 800ms 防抖触发 globalSearch
 * - 请求序号（searchRequestRef）保护竞态：过期响应自动丢弃
 * - 卸载时清空 timer 并自增 requestId 阻断 in-flight 响应
 */
export function useGlobalSearch(options: UseGlobalSearchOptions = {}): UseGlobalSearchResult {
  const { debounceMs = 800, onLocate } = options
  const [keyword, setKeyword] = useState('')
  const [results, setResults] = useState<GlobalSearchItem[]>([])
  const [loading, setLoading] = useState(false)
  const [open, setOpen] = useState(false)
  const timerRef = useRef<number | null>(null)
  const requestRef = useRef(0)

  const run = useCallback(async (value: string) => {
    const trimmed = value.trim()
    if (!trimmed) return
    const requestId = ++requestRef.current
    setLoading(true)
    try {
      const res = await globalSearch(trimmed)
      if (requestId !== requestRef.current) return
      const list = Array.isArray(res.data)
        ? res.data.filter(item => {
            const lng = Number(item.longitude)
            const lat = Number(item.latitude)
            return Number.isFinite(lng) && Number.isFinite(lat)
          })
        : []
      setResults(list)
      setOpen(true)
    } catch {
      if (requestId !== requestRef.current) return
      setResults([])
      setOpen(true)
    } finally {
      if (requestId === requestRef.current) setLoading(false)
    }
  }, [])

  useEffect(() => () => {
    if (timerRef.current != null) window.clearTimeout(timerRef.current)
    requestRef.current += 1
  }, [])

  const onChange = useCallback((value: string) => {
    setKeyword(value)
    if (timerRef.current != null) window.clearTimeout(timerRef.current)
    requestRef.current += 1
    if (!value.trim()) {
      setResults([])
      setOpen(false)
      setLoading(false)
      return
    }
    setLoading(true)
    timerRef.current = window.setTimeout(() => { void run(value) }, debounceMs)
  }, [run, debounceMs])

  const onSubmit = useCallback(() => {
    if (timerRef.current != null) window.clearTimeout(timerRef.current)
    void run(keyword)
  }, [run, keyword])

  const onClear = useCallback(() => {
    if (timerRef.current != null) window.clearTimeout(timerRef.current)
    requestRef.current += 1
    setKeyword('')
    setResults([])
    setOpen(false)
    setLoading(false)
  }, [])

  const onSelect = useCallback((item: GlobalSearchItem) => {
    setKeyword(item.name?.trim() || '未命名地址')
    setOpen(false)
    onLocate?.(item)
  }, [onLocate])

  const onFocus = useCallback(() => {
    if (keyword.trim() && !loading) setOpen(true)
  }, [keyword, loading])

  const onClose = useCallback(() => setOpen(false), [])

  return { keyword, results, loading, open, onChange, onSubmit, onClear, onSelect, onFocus, onClose }
}

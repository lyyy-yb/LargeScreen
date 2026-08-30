import { useEffect } from 'react'

/**
 * 数据加载 effect：自动管理 fetch 竞态保护 + 依赖变化重跑
 *
 * 使用场景：useEffect 内调用异步接口，需要在 cleanup 时丢弃过期响应以防覆盖最新 state
 *
 * @param fn 接收一个 cancelled 标记的回调，回调内调用 fetch 然后判断 if (cancelled) return
 * @param deps 依赖数组（任意类型，与 useEffect 语义一致）
 *
 * @example
 * useAsyncEffect((cancelled) => {
 *   dataSourceApi.list(params)
 *     .then(res => { if (!cancelled) setAirPoints(res.data) })
 *     .catch(() => { if (!cancelled) setAirPoints([]) })
 * }, [params])
 */
export function useAsyncEffect(
  fn: (cancelled: () => boolean) => void | Promise<void>,
  deps: ReadonlyArray<unknown>,
): void {
  useEffect(() => {
    let cancelled = false
    fn(() => cancelled)
    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps)
}

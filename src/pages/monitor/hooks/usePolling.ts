import { useEffect, useRef } from 'react'

/**
 * 通用轮询 hook：组件挂载时立即执行一次 fn，之后每 intervalMs 触发一次。
 * deps 变化时清空旧 timer 并立即重新调度（fn 总是从 ref 取最新）。
 * 组件卸载时 clearInterval；React 18 卸载后 setState 是 noop，无需手动 cancelled。
 */
export function usePolling(
  fn: () => void,
  intervalMs: number,
  deps: ReadonlyArray<unknown> = [],
): void {
  const fnRef = useRef(fn)
  fnRef.current = fn
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => {
    fnRef.current()
    const timer = window.setInterval(() => fnRef.current(), intervalMs)
    return () => window.clearInterval(timer)
  }, [intervalMs, ...deps])
}

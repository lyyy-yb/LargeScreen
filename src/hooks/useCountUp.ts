import { useEffect, useRef, useState } from 'react'

/**
 * 数字 count-up 缓动：挂载时从 0 滚到目标值，目标值变化时从旧值缓动到新值（easeOutCubic）。
 * 用于大屏关键指标数字，配合已有数据轮询使用。
 */
export function useCountUp(target: number, duration = 600): number {
  const [display, setDisplay] = useState(0)
  const fromRef = useRef(0)
  const rafRef = useRef(0)

  useEffect(() => {
    const from = fromRef.current
    if (from === target) {
      setDisplay(target)
      return
    }
    const start = performance.now()
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / duration)
      const eased = 1 - (1 - t) ** 3
      setDisplay(Math.round(from + (target - from) * eased))
      if (t < 1) {
        rafRef.current = requestAnimationFrame(tick)
      } else {
        fromRef.current = target
      }
    }
    rafRef.current = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(rafRef.current)
  }, [target, duration])

  return display
}

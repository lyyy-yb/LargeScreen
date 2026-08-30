import { useState, useEffect, useCallback, useRef } from 'react'

interface ScaleOptions {
  designWidth?: number
  designHeight?: number
  /** resize 事件防抖延迟（ms），默认 150；可设 0 关闭 */
  resizeDebounceMs?: number
}

export function useScreenScale(options: ScaleOptions = {}) {
  const {
    designWidth = 1600,
    designHeight = 900,
    resizeDebounceMs = 150,
  } = options

  const calculateScale = useCallback(() => {
    const screenWidth = window.innerWidth
    const screenHeight = window.innerHeight
    // 不保持横竖比例：X/Y 各自独立拉伸铺满视口，避免等比缩放产生的留白/变形难看问题
    return {
      scaleX: screenWidth / designWidth,
      scaleY: screenHeight / designHeight,
    }
  }, [designWidth, designHeight])

  const [scale, setScale] = useState(calculateScale)
  const timerRef = useRef<number | null>(null)

  useEffect(() => {
    const update = () => setScale(calculateScale())
    const handleResize = () => {
      if (resizeDebounceMs <= 0) {
        update()
        return
      }
      if (timerRef.current != null) window.clearTimeout(timerRef.current)
      timerRef.current = window.setTimeout(update, resizeDebounceMs)
    }
    window.addEventListener('resize', handleResize)
    return () => {
      window.removeEventListener('resize', handleResize)
      if (timerRef.current != null) {
        window.clearTimeout(timerRef.current)
        timerRef.current = null
      }
    }
  }, [calculateScale, resizeDebounceMs])

  return { scaleX: scale.scaleX, scaleY: scale.scaleY, designWidth, designHeight }
}

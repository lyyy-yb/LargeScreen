import { useState, useEffect, useCallback } from 'react'

interface ScaleOptions {
  designWidth?: number
  designHeight?: number
}

export function useScreenScale(options: ScaleOptions = {}) {
  const { designWidth = 1600, designHeight = 900 } = options

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

  useEffect(() => {
    const handleResize = () => setScale(calculateScale())
    window.addEventListener('resize', handleResize)
    return () => window.removeEventListener('resize', handleResize)
  }, [calculateScale])

  return { scaleX: scale.scaleX, scaleY: scale.scaleY, designWidth, designHeight }
}

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
    const scaleX = screenWidth / designWidth
    const scaleY = screenHeight / designHeight
    return Math.min(scaleX, scaleY)
  }, [designWidth, designHeight])

  const [scale, setScale] = useState(calculateScale)

  useEffect(() => {
    const handleResize = () => setScale(calculateScale())
    window.addEventListener('resize', handleResize)
    return () => window.removeEventListener('resize', handleResize)
  }, [calculateScale])

  return { scale, designWidth, designHeight }
}

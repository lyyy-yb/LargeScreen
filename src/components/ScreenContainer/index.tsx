import type { ReactNode } from 'react'
import { useScreenScale } from '@/hooks/useScreenScale'

interface ScreenContainerProps {
  children: ReactNode
  designWidth?: number
  designHeight?: number
}

export default function ScreenContainer({
  children,
  designWidth = 1600,
  designHeight = 900,
}: ScreenContainerProps) {
  const { scale } = useScreenScale({ designWidth, designHeight })

  return (
    <div className="w-full h-full flex items-center justify-center overflow-hidden bg-[#00162d]">
      <div
        className="shrink-0"
        style={{
          width: designWidth,
          height: designHeight,
          transform: `scale(${scale})`,
          transformOrigin: 'center center',
        }}
      >
        {children}
      </div>
    </div>
  )
}

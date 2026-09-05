import { useLayoutEffect, useRef, type ReactNode } from 'react'
import { createPortal } from 'react-dom'

/** 将地图像素坐标保留在页面坐标系内，同时跳出地图、毛玻璃和路由动画的层叠上下文。 */
export default function MapPopupPortal({ children }: { children: ReactNode }) {
  const anchorRef = useRef<HTMLSpanElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)

  useLayoutEffect(() => {
    const anchor = anchorRef.current
    const container = containerRef.current
    const root = anchor?.closest<HTMLElement>('.map-screen, .monitor-screen, .air-quality-screen') ?? anchor?.parentElement
    if (!root || !container) return
    const syncBounds = () => {
      const rect = root.getBoundingClientRect()
      Object.assign(container.style, {
        left: `${rect.left}px`, top: `${rect.top}px`,
        width: `${root.clientWidth}px`, height: `${root.clientHeight}px`,
        transform: `scale(${rect.width / (root.offsetWidth || 1)}, ${rect.height / (root.offsetHeight || 1)})`,
      })
    }
    syncBounds()
    const observer = new ResizeObserver(syncBounds)
    observer.observe(root)
    window.addEventListener('resize', syncBounds)
    window.addEventListener('scroll', syncBounds, true)
    document.addEventListener('animationend', syncBounds, true)
    return () => {
      observer.disconnect()
      window.removeEventListener('resize', syncBounds)
      window.removeEventListener('scroll', syncBounds, true)
      document.removeEventListener('animationend', syncBounds, true)
    }
  }, [])

  return <><span ref={anchorRef} hidden />{createPortal(
    <div ref={containerRef} className="map-popup-portal screen-shell">{children}</div>,
    document.body,
  )}</>
}

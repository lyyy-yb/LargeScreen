import { useEffect, useRef, useState } from 'react'
import dayjs from 'dayjs'
import type { AlertDashboardItem } from '@/types/business'

interface AlertLatestCarouselProps {
  items: AlertDashboardItem[]
  onNavigate: () => void
}

/** 最新预警轮播参数：单条高度（含间距）与最大可视条数 */
const ALERT_CAROUSEL_ITEM_HEIGHT = 46
const ALERT_CAROUSEL_MAX_VISIBLE = 5
/** 最新预警最多展示条数（main 端在调用前裁剪，本组件只负责渲染） */

/**
 * 最新预警轮播：每 3 秒向上滚动一条，列表复制一份后滚过一圈无动画归位，实现无缝循环；
 * 可视条数按容器实际可用高度动态反算，保证列表高度始终是条目高度整数倍且不被卡片裁切
 */
export default function AlertLatestCarousel({ items, onNavigate }: AlertLatestCarouselProps) {
  const [tick, setTick] = useState(0)
  const containerRef = useRef<HTMLDivElement>(null)
  const [visible, setVisible] = useState(3)

  useEffect(() => {
    const el = containerRef.current
    if (!el) return
    const measure = () =>
      setVisible(
        Math.max(
          1,
          Math.min(ALERT_CAROUSEL_MAX_VISIBLE, Math.floor(el.clientHeight / ALERT_CAROUSEL_ITEM_HEIGHT)),
        ),
      )
    measure()
    const observer = new ResizeObserver(measure)
    observer.observe(el)
    return () => observer.disconnect()
  }, [])

  const enabled = items.length > visible

  useEffect(() => {
    if (!enabled) return
    const timer = window.setInterval(() => setTick((t) => t + 1), 3000)
    return () => window.clearInterval(timer)
  }, [enabled])

  // 可视条数变化时偏移取模归位，避免滚动位置超出新可视范围
  const offset = enabled ? tick % (items.length + 1) : 0
  const displayItems = enabled ? [...items, ...items] : items

  return (
    <div ref={containerRef} className="min-h-0 flex-1">
      {/* 内层视口高度精确为条目高度整数倍，底部不会露出半条被裁切的条目 */}
      <div className="overflow-hidden" style={{ height: visible * ALERT_CAROUSEL_ITEM_HEIGHT }}>
        <div
          style={{
            transform: `translateY(-${offset * ALERT_CAROUSEL_ITEM_HEIGHT}px)`,
            transition: offset !== 0 ? 'transform 0.5s ease' : 'none',
          }}
        >
          {displayItems.map((item, idx) => (
            <div
              key={`${item.alertTime}-${idx}`}
              onClick={onNavigate}
              className="h-40px mb-1.5 rounded-6px border border-[#2f7fd6]/60 bg-[#1c64be]/55 px-2.5 py-1 cursor-pointer transition-colors hover:border-[#2f9bff]"
            >
              <div className="flex items-center gap-1.5">
                <span className="shrink-0 w-5px h-5px rounded-full bg-[#ff6868] shadow-[0_0_6px_#ff6868]" />
                <span
                  className="flex-1 min-w-0 text-[#d2ecff] text-11px font-bold truncate"
                  title={item.ruleName}
                >
                  {item.ruleName}
                </span>
                <span className="shrink-0 text-[#5c92c1] text-9px font-mono">
                  {item.alertTime ? dayjs(item.alertTime).format('HH:mm') : '--'}
                </span>
              </div>
              <div className="mt-0.5 pl-6.5 text-10px text-[#5c92c1] truncate" title={item.location}>
                {item.location}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

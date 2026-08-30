import { useEffect, useState } from 'react'
import { DisconnectOutlined } from '@ant-design/icons'

/**
 * 全局网络状态条：
 * - 浏览器 online 事件：navigator.onLine 恢复时延迟 1s 检测（避免抖动）
 * - 浏览器 offline 事件：立即显示
 * - 持续 3s 后自动隐藏，恢复时立即隐藏
 */
export default function NetworkStatus() {
  const [offline, setOffline] = useState(!navigator.onLine)
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    const showOffline = () => {
      setOffline(true)
      setVisible(true)
    }
    const handleOnline = () => {
      // 延迟 1s 检测，避免网络瞬断又恢复的抖动
      window.setTimeout(() => {
        if (navigator.onLine) {
          setOffline(false)
          setVisible(false)
        }
      }, 1000)
    }
    const handleOffline = () => showOffline()

    window.addEventListener('online', handleOnline)
    window.addEventListener('offline', handleOffline)
    return () => {
      window.removeEventListener('online', handleOnline)
      window.removeEventListener('offline', handleOffline)
    }
  }, [])

  useEffect(() => {
    if (!offline) {
      const timer = window.setTimeout(() => setVisible(false), 3000)
      return () => window.clearTimeout(timer)
    }
    return undefined
  }, [offline])

  if (!visible) return null
  return (
    <div
      className="fixed top-0 left-0 right-0 z-[9999] flex items-center justify-center gap-2 py-2 text-white text-sm font-medium shadow-lg"
      style={{ background: 'linear-gradient(90deg, #d4380d 0%, #ff7875 100%)' }}
    >
      <DisconnectOutlined />
      <span>{offline ? '网络连接已断开，请检查网络' : '网络已恢复'}</span>
    </div>
  )
}

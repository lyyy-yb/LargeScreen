import { useNavigate, useLocation } from 'react-router-dom'
import { tabRoutes } from '@/router/routes'
import { useAuthStore } from '@/stores'
import commonTabBg from '@/assets/images/com.png'
import activeTabBg from '@/assets/images/active.png'

export default function BottomTabs() {
  const navigate = useNavigate()
  const location = useLocation()
  const { accessibleFeatures } = useAuthStore()

  const isActive = (path: string) => {
    return location.pathname === path
  }

  // 权限过滤：如果 accessibleFeatures 非空且不是 'all'，则过滤
  const filteredTabs = (() => {
    if (!accessibleFeatures || accessibleFeatures.length === 0) {
      return tabRoutes // 无限制，显示全部
    }
    if (accessibleFeatures.includes('all')) {
      return tabRoutes
    }
    return tabRoutes.filter(tab => accessibleFeatures.includes(tab.title))
  })()

  return (
    <footer className="absolute inset-x-0 bottom-0 z-100 h-44px overflow-visible pointer-events-none bg-[linear-gradient(180deg,transparent_0%,rgba(0,25,65,0.72)_100%)]">
      <nav aria-label="大屏模块导航" className="h-full flex justify-center items-end pointer-events-auto">
        {filteredTabs.map(item => {
          const active = isActive(item.key)
          return (
            <button
              type="button"
              key={item.key}
              aria-current={active ? 'page' : undefined}
              className={`group relative h-44px w-160px -ml-10px first:ml-0 select-none transition-transform duration-200 hover:-translate-y-2px focus-visible:outline-none focus-visible:-translate-y-2px ${active ? 'z-20 -translate-y-1px' : 'z-10'}`}
              onClick={() => !active && navigate(item.key)}
            >
              <img
                src={active ? activeTabBg : commonTabBg}
                alt=""
                draggable={false}
                className="absolute inset-0 h-full w-180px max-w-none drop-shadow-[0_0_18px_rgba(0,54,124,0.85)]"
              />
              <span className={`absolute inset-y-0 left-0 w-180px flex items-center justify-center text-15px font-500 transition-colors ${active ? 'text-[#173b62]' : 'text-white group-hover:text-[#03fbfd]'}`}>
                {item.title}
              </span>
            </button>
          )
        })}
      </nav>
    </footer>
  )
}

import { useNavigate, useLocation } from 'react-router-dom'
import { tabRoutes } from '@/router/routes'
import { useAppStore } from '@/stores'
import commonTabBg from '@/assets/images/com.png'
import activeTabBg from '@/assets/images/active.png'

export default function BottomTabs() {
  const navigate = useNavigate()
  const location = useLocation()
  const regionContext = useAppStore(state => state.regionContext)
  const scopeName =
    regionContext?.selection.townName
    || regionContext?.selection.countyName
    || regionContext?.selection.cityName
    || regionContext?.selection.provinceName
    || '浙江省'

  const isActive = (path: string) => {
    return location.pathname === path
  }

  return (
    <footer className="screen-bottom-tabs absolute inset-x-0 bottom-0 z-100 h-48px overflow-visible pointer-events-none bg-[linear-gradient(180deg,transparent_0%,rgba(0,25,65,0.78)_100%)]">
      <nav aria-label={`${scopeName}大屏模块导航`} className="h-full flex justify-center items-end pointer-events-none">
        {tabRoutes.map(item => {
          const active = isActive(item.key)
          return (
            <button
              type="button"
              key={item.key}
              title={`${scopeName} · ${item.title}`}
              aria-current={active ? 'page' : undefined}
              className={`screen-bottom-tabs__item pointer-events-auto group relative h-48px w-148px -ml-10px first:ml-0 select-none transition-transform duration-200 hover:-translate-y-2px focus-visible:outline-none focus-visible:-translate-y-2px ${active ? 'z-20 -translate-y-1px' : 'z-10'}`}
              onClick={() => !active && navigate(item.key)}
            >
              <img
                src={active ? activeTabBg : commonTabBg}
                alt=""
                draggable={false}
                className="absolute inset-0 h-full w-[calc(100%+20px)] max-w-none drop-shadow-[0_0_18px_rgba(0,54,124,0.85)]"
              />
              <span className={`absolute inset-y-0 left-0 w-[calc(100%+20px)] flex items-center justify-center text-15px font-600 tracking-wide transition-colors ${active ? 'text-[#173b62]' : 'text-[#e8f6ff] group-hover:text-[#03fbfd]'}`}>
                {item.title}
              </span>
            </button>
          )
        })}
      </nav>
    </footer>
  )
}

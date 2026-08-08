import { useNavigate, useLocation } from 'react-router-dom'
import { tabRoutes } from '@/router/routes'
import { useAppStore } from '@/stores'

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
              className={`screen-bottom-tabs__item pointer-events-auto relative h-44px w-148px -ml-10px first:ml-0 select-none transition-transform duration-200 hover:-translate-y-2px focus-visible:outline-none focus-visible:-translate-y-2px ${active ? 'z-20 -translate-y-1px' : 'z-10'}`}
              onClick={() => !active && navigate(item.key)}
            >
              <span className="screen-bottom-tabs__shape" aria-hidden />
              <span className={`screen-bottom-tabs__label ${active ? 'screen-bottom-tabs__label--active' : ''}`}>
                {item.title}
              </span>
            </button>
          )
        })}
      </nav>
    </footer>
  )
}

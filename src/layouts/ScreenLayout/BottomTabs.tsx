import { useNavigate, useLocation } from 'react-router-dom'
import { tabRoutes, type TabRouteMeta } from '@/router/routes'
import { useAppStore } from '@/stores'
import { getVisibleTabKeys } from '@/utils/region'

export default function BottomTabs() {
  const navigate = useNavigate()
  const location = useLocation()
  const regionContext = useAppStore(state => state.regionContext)
  // 业务角色导航过滤：市业务可见监控大屏/雷达/预警中心/年度管理，区县业务仅前三项，乡镇业务无可见导航；null 不限制
  const visibleTabKeys = getVisibleTabKeys(regionContext?.roleKey)
  const roleKey = regionContext?.roleKey
  const visibleTabs = tabRoutes.filter((item) => {
    if (visibleTabKeys !== null && !visibleTabKeys.includes(item.key)) return false
    if (item.roles && item.roles.length > 0) {
      if (!roleKey || !item.roles.includes(roleKey)) return false
    }
    return true
  }) as TabRouteMeta[]
  const scopeName =
    regionContext?.selection.townName
    || regionContext?.selection.countyName
    || regionContext?.selection.cityName
    || regionContext?.selection.provinceName
    || '浙江省'

  const isActive = (path: string) => {
    return location.pathname === path
  }

  // 无可见导航的角色（乡镇业务人员）不渲染底部导航
  if (!visibleTabs.length) return null

  return (
    <footer className="screen-bottom-tabs absolute inset-x-0 bottom-0 z-100 h-48px overflow-visible pointer-events-none bg-[linear-gradient(180deg,transparent_0%,rgba(0,25,65,0.78)_100%)]">
      <nav aria-label={`${scopeName}大屏模块导航`} className="h-full flex justify-center items-end pointer-events-none">
        {visibleTabs.map(item => {
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

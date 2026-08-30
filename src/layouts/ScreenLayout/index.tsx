import { Outlet, useLocation } from 'react-router-dom'
import Header from './Header'
import BottomTabs from './BottomTabs'
import PageErrorBoundary from '@/components/PageErrorBoundary'
import NetworkStatus from '@/components/NetworkStatus'

export default function ScreenLayout() {
  const location = useLocation()

  return (
    <div className="w-full h-full overflow-x-auto overflow-y-hidden bg-[#00162d]">
      <NetworkStatus />
      <div className="screen-shell min-w-960px w-full h-full relative overflow-hidden flex flex-col bg-[#1a5ab0]">
        <Header />
        <main key={location.pathname} className="flex-1 relative overflow-hidden route-page-enter">
          <PageErrorBoundary>
            <Outlet />
          </PageErrorBoundary>
        </main>
        <BottomTabs />
      </div>
    </div>
  )
}

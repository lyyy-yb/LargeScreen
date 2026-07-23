import { Outlet, useLocation } from 'react-router-dom'
import Header from './Header'
import BottomTabs from './BottomTabs'
import ScreenContainer from '@/components/ScreenContainer'
import PageErrorBoundary from '@/components/PageErrorBoundary'

export default function ScreenLayout() {
  const location = useLocation()

  return (
    <ScreenContainer>
      <div className="w-full h-full relative overflow-hidden flex flex-col bg-[#1a5ab0]">
        <Header />
        <main key={location.pathname} className="flex-1 relative overflow-hidden route-page-enter">
          <PageErrorBoundary>
            <Outlet />
          </PageErrorBoundary>
        </main>
        <BottomTabs />
      </div>
    </ScreenContainer>
  )
}

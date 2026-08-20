/* eslint-disable react-refresh/only-export-components -- 路由配置文件需要同时声明懒加载组件和导出路由元数据 */
import { lazy, Suspense } from 'react'
import type { RouteObject } from 'react-router-dom'
import { Navigate } from 'react-router-dom'
import AuthGuard from './AuthGuard'
import ScreenLayout from '@/layouts/ScreenLayout'
import PageLoading from '@/components/PageLoading'
import { useAppStore } from '@/stores'
import { getLandingPath } from '@/utils/region'

// 懒加载页面
const Login = lazy(() => import('@/pages/login'))
const Monitor = lazy(() => import('@/pages/monitor'))
const Radar = lazy(() => import('@/pages/radar'))
const Drone = lazy(() => import('@/pages/drone'))
const DroneMediaPreview = lazy(() => import('@/pages/drone/MediaPreview'))
const Patrol = lazy(() => import('@/pages/patrol'))
const AlertPage = lazy(() => import('@/pages/alert'))
const Report = lazy(() => import('@/pages/report'))
const Pollution = lazy(() => import('@/pages/pollution'))
const DataSource = lazy(() => import('@/pages/manage/dataSource'))
const CleanRule = lazy(() => import('@/pages/manage/cleanRule'))
const DataManage = lazy(() => import('@/pages/manage/dataManage'))
const NotFound = lazy(() => import('@/pages/not-found'))
const Forbidden = lazy(() => import('@/pages/forbidden'))

// 包装懒加载组件
function LazyComponent({ children }: { children: React.ReactNode }) {
  return <Suspense fallback={<PageLoading />}>{children}</Suspense>
}

// 根路径按角色落地：乡镇业务人员仅能进入数据管理，其余角色进入监控大屏
function HomeRedirect() {
  const roleKey = useAppStore(state => state.regionContext?.roleKey)
  return <Navigate to={getLandingPath(roleKey)} replace />
}

export interface RouteMeta {
  title?: string
  tab?: boolean
  hidden?: boolean
  roles?: string[]
}

export const routes: RouteObject[] = [
  {
    path: '/login',
    element: <LazyComponent><Login /></LazyComponent>,
  },
  {
    path: '/403',
    element: <LazyComponent><Forbidden /></LazyComponent>,
  },
  {
    path: '/',
    element: (
      <AuthGuard>
        <ScreenLayout />
      </AuthGuard>
    ),
    children: [
      {
        index: true,
        element: <HomeRedirect />,
      },
      {
        path: 'monitor',
        element: <LazyComponent><Monitor /></LazyComponent>,
        handle: { title: '监控大屏', tab: true } as RouteMeta,
      },
      {
        path: 'radar',
        element: <LazyComponent><Radar /></LazyComponent>,
        handle: { title: '光量子雷达', tab: true } as RouteMeta,
      },
      {
        path: 'drone',
        element: <LazyComponent><Drone /></LazyComponent>,
        handle: { title: '无人机机场', tab: true } as RouteMeta,
      },
      {
        path: 'drone/media',
        element: <LazyComponent><DroneMediaPreview /></LazyComponent>,
        handle: { title: '成果预览', hidden: true } as RouteMeta,
      },
      {
        path: 'patrol',
        element: <LazyComponent><Patrol /></LazyComponent>,
        handle: { title: '走航巡查', tab: true } as RouteMeta,
      },
      {
        path: 'alert',
        element: <LazyComponent><AlertPage /></LazyComponent>,
        handle: { title: '预警中心', tab: true } as RouteMeta,
      },
      {
        path: 'report',
        element: <LazyComponent><Report /></LazyComponent>,
        handle: { title: '年度管理', tab: true } as RouteMeta,
      },
      {
        path: 'pollution',
        element: <LazyComponent><Pollution /></LazyComponent>,
        handle: { title: '污染源管理', hidden: true } as RouteMeta,
      },
      {
        path: 'manage/data-source',
        element: <LazyComponent><DataSource /></LazyComponent>,
        handle: { title: '数据接入' } as RouteMeta,
      },
      {
        path: 'manage/clean-rule',
        element: <LazyComponent><CleanRule /></LazyComponent>,
        handle: { title: '清洗规则' } as RouteMeta,
      },
      {
        path: 'manage/data-manage',
        element: <LazyComponent><DataManage /></LazyComponent>,
        handle: { title: '数据管理' } as RouteMeta,
      },
    ],
  },
  {
    path: '*',
    element: <LazyComponent><NotFound /></LazyComponent>,
  },
]

// Tab 配置
export const tabRoutes = [
  { key: '/monitor', title: '监控大屏' },
  { key: '/radar', title: '光量子雷达' },
  { key: '/drone', title: '无人机机场' },
  { key: '/patrol', title: '走航巡查' },
  { key: '/alert', title: '预警中心' },
  { key: '/report', title: '年度管理' },
]

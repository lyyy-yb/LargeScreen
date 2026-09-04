import { useEffect } from 'react'
import { matchPath, Navigate, useLocation } from 'react-router-dom'
import type { ReactNode } from 'react'
import { message } from 'antd'
import { useAppStore, useAuthStore } from '@/stores'
import PageLoading from '@/components/PageLoading'
import { loadSessionContext, takeFallbackMessage } from '@/services/session'
import { getBlockedPaths, getLandingPath } from '@/utils/region'
import { routes, type RouteMeta } from './routes'

interface AuthGuardProps {
  children: ReactNode
}

/**
 * 在 BrowserRouter（非 data router）下用 matchPath 自己匹配当前 pathname 命中的子路由，
 * 取其 handle.roles 做角色白名单校验。useMatches 仅在 createBrowserRouter 数据路由下可用。
 */
function resolveRouteHandle(pathname: string): RouteMeta | undefined {
  for (const top of routes) {
    if (!Array.isArray(top.children)) continue
    const parentPath = (top.path ?? '').replace(/\/+$/, '')
    for (const child of top.children) {
      const childPath = child.path ?? ''
      if (!childPath || childPath === 'index' || childPath === '*') continue
      const fullPath = `${parentPath}/${childPath}`.replace(/\/+/g, '/') || '/'
      const match = matchPath({ path: fullPath, end: false }, pathname)
      if (match) return child.handle as RouteMeta | undefined
    }
  }
  return undefined
}

export default function AuthGuard({ children }: AuthGuardProps) {
  const location = useLocation()
  const { token, initialized, setSession, logout } = useAuthStore()
  const { regionContext, setRegionContext, resetRegionContext } = useAppStore()

  useEffect(() => {
    if (!token || (initialized && regionContext?.initialized)) {
      return
    }

    let active = true
    loadSessionContext()
      .then(({ info, regionContext: nextRegionContext }) => {
        if (!active) return
        const roles = info.roles || info.user.roles?.map(role => role.roleKey) || []
        setSession(info.user, roles, info.permissions || [], nextRegionContext.roleLevel)
        setRegionContext(nextRegionContext)
        const fallbackMessage = takeFallbackMessage(nextRegionContext, token)
        if (fallbackMessage) message.warning(fallbackMessage)
      })
      .catch(error => {
        if (!active) return
        logout()
        resetRegionContext()
        message.error(error instanceof Error ? error.message : '用户信息过期，需要重新登录')
      })

    return () => {
      active = false
    }
  }, [
    token,
    initialized,
    regionContext?.initialized,
    setSession,
    setRegionContext,
    logout,
    resetRegionContext,
  ])

  if (!token) {
    return <Navigate to="/login" state={{ from: location }} replace />
  }

  if (!initialized || !regionContext?.initialized) {
    return <PageLoading />
  }

  // 业务角色禁止直接访问未授权页面（区县业务 / 乡镇业务等），重定向到各自落地页
  if (getBlockedPaths(regionContext?.roleKey).includes(location.pathname)) {
    return <Navigate to={getLandingPath(regionContext?.roleKey)} replace />
  }

  // 路由级角色白名单（routes 中 handle.roles）：仅列表内角色可访问；不在列表则跳 403
  const roleKey = regionContext?.roleKey
  const lastMeta = resolveRouteHandle(location.pathname)
  const allowedRoles = lastMeta?.roles
  if (allowedRoles && allowedRoles.length > 0) {
    if (!roleKey || !allowedRoles.includes(roleKey)) {
      return <Navigate to="/403" replace />
    }
  }

  return <>{children}</>
}

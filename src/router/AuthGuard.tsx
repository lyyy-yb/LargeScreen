import { useEffect } from 'react'
import { Navigate, useLocation } from 'react-router-dom'
import type { ReactNode } from 'react'
import { message } from 'antd'
import { useAppStore, useAuthStore } from '@/stores'
import PageLoading from '@/components/PageLoading'
import { loadSessionContext, takeFallbackMessage } from '@/services/session'
import { getBlockedPaths, getLandingPath } from '@/utils/region'

interface AuthGuardProps {
  children: ReactNode
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
        message.error(error instanceof Error ? error.message : '用户信息初始化失败，请重新登录')
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

  // 业务角色禁止直接访问未授权页面（乡镇业务人员无大屏页面权限），重定向到各自落地页
  if (getBlockedPaths(regionContext?.roleKey).includes(location.pathname)) {
    return <Navigate to={getLandingPath(regionContext?.roleKey)} replace />
  }

  return <>{children}</>
}

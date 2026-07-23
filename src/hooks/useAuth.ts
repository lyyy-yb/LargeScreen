import { useAuthStore } from '@/stores'

export function useAuth() {
  const { roles, accessibleFeatures, isLoggedIn } = useAuthStore()

  const hasRole = (role: string): boolean => {
    return roles.includes(role)
  }

  const hasFeature = (feature: string): boolean => {
    if (accessibleFeatures.length === 0) return true
    return accessibleFeatures.includes(feature)
  }

  const hasAnyRole = (roleList: string[]): boolean => {
    return roleList.some(role => roles.includes(role))
  }

  return {
    roles,
    accessibleFeatures,
    isLoggedIn: isLoggedIn(),
    hasRole,
    hasFeature,
    hasAnyRole,
  }
}

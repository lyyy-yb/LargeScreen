import { create } from 'zustand'
import { devtools } from 'zustand/middleware'
import { getLocalInfo, setLocalInfo, removeLocalInfo } from '@/utils/storage'
import { TOKEN, USERNAME } from '@/utils/enum'

interface AuthState {
  token: string | null
  username: string | null
  roles: string[]
  accessibleFeatures: string[]
  setToken: (token: string) => void
  setUsername: (username: string) => void
  setPermission: (roles: string[], features: string[]) => void
  logout: () => void
  isLoggedIn: () => boolean
}

export const useAuthStore = create<AuthState>()(
  devtools(
    (set, get) => ({
      token: getLocalInfo<string>(TOKEN),
      username: getLocalInfo<string>(USERNAME),
      roles: getLocalInfo<string[]>('ROLES') || [],
      accessibleFeatures: getLocalInfo<string[]>('FEATURES') || [],

      setToken: (token: string) => {
        setLocalInfo(TOKEN, token)
        set({ token })
      },

      setUsername: (username: string) => {
        setLocalInfo(USERNAME, username)
        set({ username })
      },

      setPermission: (roles: string[], features: string[]) => {
        setLocalInfo('ROLES', roles)
        setLocalInfo('FEATURES', features)
        set({ roles, accessibleFeatures: features })
      },

      logout: () => {
        removeLocalInfo(TOKEN)
        removeLocalInfo(USERNAME)
        removeLocalInfo('ROLES')
        removeLocalInfo('FEATURES')
        set({ token: null, username: null, roles: [], accessibleFeatures: [] })
      },

      isLoggedIn: () => {
        return !!get().token
      },
    }),
    { enabled: true, name: 'authStore' }
  )
)

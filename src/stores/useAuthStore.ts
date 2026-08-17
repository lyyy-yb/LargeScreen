import { create } from 'zustand'
import { devtools } from 'zustand/middleware'
import { getLocalInfo, setLocalInfo, removeLocalInfo } from '@/utils/storage'
import { TOKEN, USERNAME } from '@/utils/enum'
import type { RoleLevel, UserInfo } from '@/types/auth'

interface AuthState {
  token: string | null
  username: string | null
  user: UserInfo | null
  roles: string[]
  roleLevel: RoleLevel | null
  accessibleFeatures: string[]
  initialized: boolean
  setToken: (token: string) => void
  setUsername: (username: string) => void
  setSession: (user: UserInfo, roles: string[], features: string[], roleLevel: RoleLevel) => void
  logout: () => void
  isLoggedIn: () => boolean
}

export const useAuthStore = create<AuthState>()(
  devtools(
    (set, get) => ({
      token: getLocalInfo<string>(TOKEN),
      username: getLocalInfo<string>(USERNAME),
      user: null,
      roles: [],
      roleLevel: null,
      accessibleFeatures: [],
      initialized: false,

      setToken: (token: string) => {
        setLocalInfo(TOKEN, token)
        set({ token })
      },

      setUsername: (username: string) => {
        setLocalInfo(USERNAME, username)
        set({ username })
      },

      setSession: (user, roles, accessibleFeatures, roleLevel) => {
        const username = user.userName
        setLocalInfo(USERNAME, username)
        set({ user, username, roles, accessibleFeatures, roleLevel, initialized: true })
      },

      logout: () => {
        removeLocalInfo(TOKEN)
        removeLocalInfo(USERNAME)
        removeLocalInfo('ROLES')
        removeLocalInfo('FEATURES')
        set({
          token: null,
          username: null,
          user: null,
          roles: [],
          roleLevel: null,
          accessibleFeatures: [],
          initialized: false,
        })
      },

      isLoggedIn: () => {
        return !!get().token
      },
    }),
    { enabled: import.meta.env.DEV, name: 'authStore' }
  )
)

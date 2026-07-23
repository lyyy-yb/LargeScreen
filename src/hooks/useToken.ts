import { useCallback } from 'react'
import { getLocalInfo, setLocalInfo, removeLocalInfo } from '@/utils/storage'
import { TOKEN } from '@/utils/enum'

export function useToken() {
  const getToken = useCallback((): string | null => {
    return getLocalInfo<string>(TOKEN)
  }, [])

  const setToken = useCallback((token: string): void => {
    setLocalInfo(TOKEN, token)
  }, [])

  const removeToken = useCallback((): void => {
    removeLocalInfo(TOKEN)
  }, [])

  return [getToken, setToken, removeToken] as const
}

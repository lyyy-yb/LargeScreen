import { deptList, getInfo } from '@/servers/api'
import type { DeptInfo, GetInfoResponse } from '@/types/auth'
import type { RegionContext } from '@/types/region'
import { createRegionContext } from '@/utils/region'

const FALLBACK_WARNING_TOKEN_KEY = 'REGION_FALLBACK_WARNING_TOKEN'

export function takeFallbackMessage(
  context: RegionContext,
  token: string,
  force = false,
) {
  if (!context.fallbackMessage) return undefined
  if (!force && sessionStorage.getItem(FALLBACK_WARNING_TOKEN_KEY) === token) return undefined
  sessionStorage.setItem(FALLBACK_WARNING_TOKEN_KEY, token)
  return context.fallbackMessage
}

export async function loadSessionContext() {
  const info = await getInfo()
  if (info.code !== 200 || !info.user) {
    const error = new Error(info.msg || '获取当前用户信息失败') as Error & { code?: string }
    // 业务码 401 视为登录过期，交由上层统一提示并跳转登录页
    if (info.code === 401) error.code = 'AUTH_EXPIRED'
    throw error
  }

  const typedInfo = info as GetInfoResponse
  let departments: DeptInfo[] = []
  try {
    const deptResponse = await deptList()
    if (deptResponse.code === 200 && Array.isArray(deptResponse.data)) {
      departments = deptResponse.data
    }
  } catch {
    // 部门列表不可用时，区域解析仍会使用 getInfo.user.dept 安全回退。
  }

  return {
    info: typedInfo,
    regionContext: createRegionContext(typedInfo.user, typedInfo.roles, departments),
  }
}

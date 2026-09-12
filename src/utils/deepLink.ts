/**
 * 跨平台免登录 deep-link 工具
 *
 * URL 形式（其他平台拼接后跳转即可进入本平台指定预警详情）：
 *   /alert?type=nologin&list=his&alertId=4066
 *   /alert?type=nologin&role=city_admin&list=his&alertId=4066
 *
 * 行为：
 *   - type=nologin   → 跳过登录页，按 role 选择对应 token 注入会话
 *   - role=xxx       → 选择 NOLOGIN_TOKENS 中 xxx 角色的 token；缺省或未知回落 default
 *   - list=his       → 进入"实时预警监控"页签并自动开启"历史预警"开关
 *   - alertId=4066   → 自动加载并打开对应预警的详情弹窗
 *
 * Token 来源优先级（高 → 低）：
 *   1. import.meta.env.VITE_NOLOGIN_TOKEN_<ROLE>     部署期按角色覆盖
 *   2. import.meta.env.VITE_NOLOGIN_TOKEN            兼容老命名，仅覆盖 default
 *   3. @/config/nologin-tokens.NOLOGIN_TOKENS[role]  文件兜底
 *   4. @/config/nologin-tokens.NOLOGIN_TOKENS[default] 最后兜底
 */

import { useAuthStore } from '@/stores/useAuthStore'
import {
  DEFAULT_NOLOGIN_ROLE,
  NOLOGIN_TOKENS,
  type NologinRole,
} from '@/config/nologin-tokens'

const LS_TOKEN_KEY = 'LS_TOKEN'

// ---------- deep-link query keys ----------
export const DL_TYPE = 'type'
export const DL_LIST = 'list'
export const DL_ALERT_ID = 'alertId'
export const DL_ROLE = 'role'

// ---------- deep-link values ----------
/** list 参数取值：'his' = 历史预警（开启"历史预警"开关） */
export const DL_LIST_HIS = 'his'

/** type 参数取值：'nologin' = 免登录 */
export const DL_TYPE_NOLOGIN = 'nologin'

export interface AlertDeepLinkParams {
  /** list=his 命中：开启历史预警 */
  list?: typeof DL_LIST_HIS
  /** alertId 命中：打开对应预警的详情弹窗 */
  alertId?: number
}

// ---------- token 解析 ----------

type EnvRecord = Readonly<Record<string, string | undefined>>

/**
 * 解析指定角色的 token。
 *
 * 优先级：env(VITE_NOLOGIN_TOKEN_<ROLE>) > env(VITE_NOLOGIN_TOKEN，仅 default)
 *       > 文件 NOLOGIN_TOKENS[role] > 文件 NOLOGIN_TOKENS[default]
 */
export function getNologinToken(role: string = DEFAULT_NOLOGIN_ROLE): string {
  const env = import.meta.env as EnvRecord
  const upperRole = role.toUpperCase()

  // 1. env 覆盖指定角色
  const roleEnvKey = `VITE_NOLOGIN_TOKEN_${upperRole}`
  const roleEnvToken = env[roleEnvKey]?.trim()
  if (roleEnvToken) return roleEnvToken

  // 2. 老命名 env 仅作用于 default
  if (role === DEFAULT_NOLOGIN_ROLE) {
    const legacyEnvToken = env['VITE_NOLOGIN_TOKEN']?.trim()
    if (legacyEnvToken) return legacyEnvToken
  }

  // 3. 文件兜底
  if (NOLOGIN_TOKENS[role as NologinRole]) {
    return NOLOGIN_TOKENS[role as NologinRole]
  }

  // 4. 最后兜底：default
  return NOLOGIN_TOKENS[DEFAULT_NOLOGIN_ROLE]
}

/** 当前 URL 是否携带 type=nologin */
export function hasNologinDeepLink(): boolean {
  return new URLSearchParams(window.location.search).get(DL_TYPE) === DL_TYPE_NOLOGIN
}

/** 解析 URL 中的 role；未指定或未知回落 default */
export function parseNologinRole(): string {
  const role = new URLSearchParams(window.location.search).get(DL_ROLE)
  if (!role) return DEFAULT_NOLOGIN_ROLE
  if (role in NOLOGIN_TOKENS) return role
  // 未知角色：回落 default + 控制台告警（开发期容错）
  if (typeof console !== 'undefined') {
    console.warn(
      `[deepLink] nologin role "${role}" 未在 NOLOGIN_TOKENS 中配置，回落 default。请在 src/config/nologin-tokens.ts 补齐。`,
    )
  }
  return DEFAULT_NOLOGIN_ROLE
}

/** 解析 alert 页面的 deep-link 参数（list + alertId） */
export function parseAlertDeepLink(): AlertDeepLinkParams {
  const params = new URLSearchParams(window.location.search)
  const result: AlertDeepLinkParams = {}
  if (params.get(DL_LIST) === DL_LIST_HIS) result.list = DL_LIST_HIS
  const rawId = params.get(DL_ALERT_ID)
  if (rawId != null && rawId !== '') {
    const id = Number(rawId)
    if (Number.isFinite(id) && id > 0) result.alertId = id
  }
  return result
}

/**
 * 应用免登录 token：
 *   - 解析 URL 中的 role，按角色取 token
 *   - 写 localStorage（LS_TOKEN），让 useAuthStore 后续任意位置读取一致
 *   - 同步更新 zustand store 当前值（store 已在 import 阶段完成初始化）
 *
 * 必须在 React 第一次渲染前（即 main.tsx 顶层、createRoot 之前）调用，
 * 否则 AuthGuard 会因为 token 缺失把页面重定向到 /login。
 */
export function applyNologinToken(): void {
  if (!hasNologinDeepLink()) return

  const role = parseNologinRole()
  const token = getNologinToken(role)

  try {
    localStorage.setItem(LS_TOKEN_KEY, JSON.stringify(token))
  } catch {
    // localStorage 写入失败（隐私模式 / 配额超限）不影响 store 注入
  }

  // 同步 store：store 在 import 阶段已初始化，state.token 是从 import 时的
  // localStorage 读出的值；这里同步覆盖，保证 AuthGuard 渲染前拿到的就是新 token，
  // 不需要走 loadSessionContext 的异步等待。
  useAuthStore.setState({ token })
}

/**
 * 消费（清理）URL 中的 deep-link 参数，避免刷新后重复触发
 *  - 不修改 pathname / hash，仅替换 search
 *  - 用 replaceState 不入历史栈，不触发 React Router 重渲染
 *
 * @param keys 要清理的 key 列表
 */
export function consumeDeepLinkParams(keys: readonly string[]): void {
  if (typeof window === 'undefined') return
  const params = new URLSearchParams(window.location.search)
  let changed = false
  for (const key of keys) {
    if (params.has(key)) {
      params.delete(key)
      changed = true
    }
  }
  if (!changed) return
  const query = params.toString()
  const next =
    window.location.pathname + (query ? `?${query}` : '') + window.location.hash
  window.history.replaceState({}, '', next)
}

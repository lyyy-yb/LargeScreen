/**
 * 跨平台集成 · 免登录 token 配置（多角色）
 *
 * ────────────────────────────────────────────────────────────────────
 * 用途：其他平台（调度、工单、督办等）通过 deep-link 跳转进入本平台指定
 *       预警/页面时，跳过登录直接使用对应角色的永久 token 访问。
 *
 * URL 形式：
 *   /alert?type=nologin&list=his&alertId=4066              ← 用 default 角色
 *   /alert?type=nologin&role=city_admin&list=his&alertId=4066
 *   /alert?type=nologin&role=district_business&list=his&alertId=4066
 *
 * 约束：
 *   - role 取值必须对应本文件 NOLOGIN_TOKENS 里的 key；未知角色回落 default
 *     并在控制台告警（开发期容错，生产期应在使用前补齐 token）。
 *   - 这是"共享访问凭据"，不是用户登录凭据；后端应按 token 账号的权限
 *     矩阵严格限制数据范围与写权限，避免横向越权。
 *
 * 轮换方式（任选其一）：
 *   1. 修改下方对应角色值，重新构建并发布
 *   2. .env 注入（优先级高于文件，无需改代码）：
 *        VITE_NOLOGIN_TOKEN_DEFAULT=eyJ...        ← 覆盖 default 角色
 *        VITE_NOLOGIN_TOKEN_CITY_ADMIN=eyJ...     ← 覆盖 city_admin 角色
 *        VITE_NOLOGIN_TOKEN=eyJ...                ← 兼容老命名，仅覆盖 default
 *
 * 新增角色：
 *   1. 后端提供 token（按角色开通永久 token）
 *   2. 在 NOLOGIN_TOKENS 下面追加一行 `roleKey: 'eyJ...'`
 *   3. 在 DEFAULT_NOLOGIN_ROLE 之外的 role 即可在 URL 里用 role=roleKey 访问
 * ────────────────────────────────────────────────────────────────────
 */

/**
 * 各角色的免登录永久 token。
 *
 * ⚠️ token 可以直接提交到 git（项目约定）：
 *    - 这是跨平台集成的"共享访问凭据"，不是用户私密凭据
 *    - 后端按账号权限隔离数据范围，前端泄漏本身不带来额外风险
 *    - 后续新增角色只需在本对象追加一行
 */
export const NOLOGIN_TOKENS = {
  // 默认：智造新城综合（兼容历史 URL）
  default:
    'eyJhbGciOiJIUzUxMiJ9.eyJzdWIiOiJ6aGl6YW9fdG9rZW4iLCJsb2dpbl91c2VyX2tleSI6IjBkNzdjNTRjLTQwNjYtNGVkOS1hYzE2LWVmOWViNjU5ZjBmYyJ9.KEpZ2aId-mDHQYPV754TiWiKlXhPD5wl9D7QfTaf28omj_fLUDkOEHyjuU3cu4o4r1rx0ZzwJtYEwiCGuoiN7w',
  // ───── 后续角色 token 由后端下发后填入 ─────
  // city_admin: 'eyJ...',
  // district_admin: 'eyJ...',
  // district_business: 'eyJ...',
  // town_business: 'eyJ...',
} as const satisfies Readonly<Record<string, string>>

/** 未在 URL 中指定 role 时使用的默认角色 */
export const DEFAULT_NOLOGIN_ROLE: keyof typeof NOLOGIN_TOKENS = 'default'

/** 所有可选角色 key（用于 TS 类型约束） */
export type NologinRole = keyof typeof NOLOGIN_TOKENS

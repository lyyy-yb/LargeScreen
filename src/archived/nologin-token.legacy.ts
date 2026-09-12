/**
 * 跨平台集成 · 免登录 token 配置
 *
 * ────────────────────────────────────────────────────────────────────
 * 用途：其他平台（如调度系统、工单系统）通过 deep-link 跳转进入本平台
 *       指定预警详情时，跳过登录直接使用本 token 访问。
 *
 * 示例 URL：
 *   /alert?type=nologin&list=his&alertId=4066
 *
 * 安全约束：
 *   - 这是"共享访问凭据"，不是用户登录凭据；任何拿到这个 URL 的人都能
 *     通过本 token 访问该账号可见的数据。
 *   - 后端应基于 token 中的账号（zhizhao_token / login_user_key=
 *     0d77c54c-4066-4ed9-ac16-ef9eb659f0fc）严格限制数据范围与写权限，
 *     避免横向越权。
 *
 * 轮换方式（任选其一）：
 *   1. 直接修改下方 NOLOGIN_TOKEN 常量值，重新构建并发布
 *   2. 通过 .env 注入 VITE_NOLOGIN_TOKEN（优先级高于本文件，无需改代码）
 *      .env.production 示例：
 *        VITE_NOLOGIN_TOKEN=eyJhbGciOiJIUzUxMiJ9...
 *
 * git 策略：如不希望把生产 token 提交到仓库，可将本文件加入 .gitignore，
 *           并在仓库中保留 .example 模板；CI/CD 阶段再注入真实 token。
 * ────────────────────────────────────────────────────────────────────
 */
export const NOLOGIN_TOKEN =
  'eyJhbGciOiJIUzUxMiJ9.eyJzdWIiOiJ6aGl6YW9fdG9rZW4iLCJsb2dpbl91c2VyX2tleSI6IjBkNzdjNTRjLTQwNjYtNGVkOS1hYzE2LWVmOWViNjU5ZjBmYyJ9.KEpZ2aId-mDHQYPV754TiWiKlXhPD5wl9D7QfTaf28omj_fLUDkOEHyjuU3cu4o4r1rx0ZzwJtYEwiCGuoiN7w'

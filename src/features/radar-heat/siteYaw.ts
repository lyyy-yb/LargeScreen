/** 只解析站点自身偏航；平台公共起始角修正在 SPS 适配器统一应用。 */
export function resolveRadarSiteYaw(rawYaw: unknown): number | undefined {
  const parsed = rawYaw == null || String(rawYaw).trim() === '' ? NaN : Number(rawYaw)
  const yaw = Number.isFinite(parsed) ? ((parsed % 360) + 360) % 360 : undefined
  return yaw
}

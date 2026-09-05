/** 热力权重：当前污染物最大有效值为 1；其余按 value / max 归一化。
 *  所有站点都有至少 0.1 的保底权重，缺测、0 或负值同样按 0.1 处理。
 */
export interface HeatPoint {
  lng: number
  lat: number
  weight: number
  value: number | null
}

export interface HeatScale {
  max: number
  stops: Array<{ ratio: number; value: number; color: string }>
}

export const HEATMAP_RAMP_COLORS = ['#164e86', '#00a8a8', '#53d769', '#ffe45c', '#ff8a3d', '#e53935']
export const HEATMAP_RAMP_POSITIONS = [0, 0.2, 0.4, 0.6, 0.8, 1]

export function normalizeHeatWeights(values: Array<number | null | undefined>): {
  weights: number[]
  scale: HeatScale
} {
  const normalizedValues = values.map(value => {
    const num = Number(value)
    return value != null && Number.isFinite(num) && num > 0 ? num : null
  })
  const max = normalizedValues.reduce<number>((result, value) => Math.max(result, value ?? 0), 0)
  const weights = normalizedValues.map(value => {
    if (max <= 0 || value == null) return 0.1
    return Math.min(1, Math.max(0.1, value / max))
  })
  const legendRatios = [0.2, 0.4, 0.6, 0.8, 1]
  const legendColors = HEATMAP_RAMP_COLORS.slice(1)
  return {
    weights,
    scale: {
      max,
      stops: legendRatios.map((ratio, index) => ({
        ratio,
        value: max * ratio,
        color: legendColors[index],
      })),
    },
  }
}

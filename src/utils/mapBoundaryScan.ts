import { LineLayer, type ILayer, type Scene } from '@antv/l7'

interface BoundaryScanOptions {
  /** 抬升高度（贴到拉伸块顶面） */
  raisingHeight?: number
  zIndex?: number
  /** 扫光段颜色 */
  color?: string
  size?: number
  /** [光段长度, 间隔]，像素级 dash */
  dash?: [number, number]
  /** 单圈时长（秒），越大越慢 */
  duration?: number
  opacity?: number
  /** 高度是否固定尺度（需与抬升所贴合的 heightfixed 地块保持一致） */
  heightfixed?: boolean
  /** 关闭深度测试，避免被拉伸地块顶面遮挡 */
  depth?: boolean
}

/**
 * 边界扫光：沿区域边界跑一条高亮光段循环移动（lineType dash + animate）。
 * 参考 MF-2.5DMap / three-cesium-examples 的城市扫光思路，用 L7 LineLayer 低成本实现。
 */
export function addBoundaryScan(
  scene: Scene,
  geojson: unknown,
  options: BoundaryScanOptions = {},
): ILayer {
  const {
    raisingHeight = 0,
    zIndex = 6,
    color = '#c9fbff',
    size = 2.2,
    dash = [140, 560],
    duration = 7,
    opacity = 0.85,
    heightfixed = false,
    depth = true,
  } = options

  const layer = new LineLayer({ zIndex, enablePicking: false })
    .source(geojson as never)
    .shape('line')
    .color(color)
    .size(size)
    .style({ raisingHeight, opacity, lineType: 'dash', dashArray: dash, heightfixed, depth })
  layer.animate({ duration, interval: 0, trailLength: 0 })
  scene.addLayer(layer)
  return layer
}

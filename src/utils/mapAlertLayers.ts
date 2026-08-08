import { PointLayer, type ILayer, type Scene } from '@antv/l7'

/** 预警等级（1~3 对应 warn-l1 ~ warn-l3 图标） */
export type AlertLevel = 1 | 2 | 3

/** 大屏地图预警打点（来自 alertEvent/list 接口经纬度，同经纬度已聚合） */
export interface AlertMapPoint {
  id?: number | string
  /** 设备名称（微站/雷达/无人机场） */
  name: string
  level: AlertLevel
  lng: number
  lat: number
  /** 同经纬度聚合后的预警个数（>1 时图标上方显示数字） */
  count?: number
}

export interface AlertMapLayers {
  iconLayer: ILayer
  countLayer: ILayer
  setData: (points: AlertMapPoint[]) => void
  destroy: () => void
}

/** 三级预警图标（与右上图例一致） */
const ALERT_LEVEL_ICON: Record<AlertLevel, string> = {
  1: '/marker/warn-l1.png',
  2: '/marker/warn-l2.png',
  3: '/marker/warn-l3.png',
}

/** 后端 alertLevel 文本（level1/level2/…或 一级预警 等）→ 预警等级 */
export function resolveAlertLevel(alertLevel?: string | null): AlertLevel {
  const text = (alertLevel ?? '').trim()
  const digit = text.match(/[123]/)?.[0]
  if (digit === '1') return 1
  if (digit === '2') return 2
  return 3
}

function decorate(points: AlertMapPoint[]) {
  return points.map(point => ({ ...point, iconName: `warn-l${point.level}` }))
}

/** 只取同经纬度聚合后预警个数 > 1 的点用于显示计数文本 */
function withCount(points: AlertMapPoint[]) {
  return points.filter(point => (point.count ?? 1) > 1)
}

/**
 * 创建预警点位打点图层：按预警等级显示 warn-l1 ~ warn-l3 原始切图（不做透视/光晕加工）。
 * 同经纬度多条预警由页面聚合后传入 count，图标上方显示预警个数。
 * 与空气质量监测站打点相互独立，由页面按钮组切换显示。
 */
export async function createAlertLayers(
  scene: Scene,
  points: AlertMapPoint[],
  raisingHeight = 0,
): Promise<AlertMapLayers> {
  // 注册三级预警图标（直接使用设计原始切图）
  Object.entries(ALERT_LEVEL_ICON).forEach(([level, url]) => {
    const name = `warn-l${level}`
    if (scene.hasImage(name)) return
    scene.addImage(name, url)
  })

  const iconLayer = new PointLayer({
    zIndex: 31,
    name: 'alert-point-icon-layer',
    enablePropagation: false,
    pickingBuffer: 4,
  })
    .source(decorate(points), { parser: { type: 'json', x: 'lng', y: 'lat' } })
    .shape('iconName', (iconName: string) => iconName)
    // L7 image 点 size 为半径（渲染直径≈2n），7 ≈ 14px，与空气质量图标同大
    .size(7)
    .style({ raisingHeight, heightfixed: true, depth: false })
  scene.addLayer(iconLayer)

  // 聚合计数文本：同经纬度预警 > 1 条时在图标上方显示个数
  const countLayer = new PointLayer({
    zIndex: 32,
    name: 'alert-point-count-layer',
    enablePropagation: false,
  })
    .source(withCount(points), { parser: { type: 'json', x: 'lng', y: 'lat' } })
    .shape('count', 'text')
    .size(9)
    .color('#ffffff')
    .style({
      raisingHeight,
      heightfixed: true,
      depth: false,
      textOffset: [0, -16],
      textAnchor: 'center',
      textAllowOverlap: true,
      padding: [2, 4],
      stroke: '#063d72',
      strokeWidth: 2,
    })
  scene.addLayer(countLayer)

  return {
    iconLayer,
    countLayer,
    setData(nextPoints) {
      iconLayer.setData(decorate(nextPoints), { parser: { type: 'json', x: 'lng', y: 'lat' } })
      countLayer.setData(withCount(nextPoints), { parser: { type: 'json', x: 'lng', y: 'lat' } })
    },
    destroy() {
      scene.removeLayer(iconLayer)
      scene.removeLayer(countLayer)
    },
  }
}

import { PointLayer, type ILayer, type Scene } from '@antv/l7'
import type { AirQualityPoint } from '@/types/airData'
import { AQI_LEVEL_ICON, resolveAqiLevelKey } from './airQuality'
import { AIR_NAME_MIN_ZOOM, bindZoomNameLayer } from './mapZoomName'

export interface AirMapLayers {
  iconLayer: ILayer
  setData: (points: AirQualityPoint[]) => void
  /** 页面级显隐开关接入站名文字层（实际可见性还受缩放阈值控制） */
  setNameVisible: (visible: boolean) => void
}

/** 点击打点时的屏幕像素坐标（相对地图容器，供页面侧锚定详情弹窗） */
export interface AirPointClickPos {
  x: number
  y: number
}

/** 无空气质量数据的微站图标名与图片 */
const AQ_NONE_ICON_NAME = 'aq-none'
const AQ_NONE_ICON_URL = '/marker/aq-none.png'

/** 固定站使用设计稿提供的方形切图；移动站继续使用原圆形图标。 */
const FIXED_AQ_LEVEL_ICON = {
  good: '/marker/aq-fixed-good.png',
  moderate: '/marker/aq-fixed-moderate.png',
  light: '/marker/aq-fixed-light.png',
  medium: '/marker/aq-fixed-medium.png',
  heavy: '/marker/aq-fixed-heavy.png',
  severe: '/marker/aq-fixed-severe.png',
} as const
const FIXED_AQ_NONE_ICON_NAME = 'aq-fixed-none'
const FIXED_AQ_NONE_ICON_URL = '/marker/aq-fixed-none.png'

/** 判断打点是否具备空气质量数据（无数据时展示占位图标且不弹详情） */
export function hasAirQualityData(point: AirQualityPoint): boolean {
  return point.aqiLevel != null && point.aqiLevel !== ''
}

/** 为每个打点附加六级图标名（优先用后端 aqiLevel 文本定图标；无空气质量数据用占位图标） */
function decorate(points: AirQualityPoint[]) {
  return points.map(point => ({
    ...point,
    iconName: point.stationType === 'fixed'
      ? (hasAirQualityData(point)
          ? `aq-fixed-${resolveAqiLevelKey(point.aqiLevel, point.iaqi)}`
          : FIXED_AQ_NONE_ICON_NAME)
      : (hasAirQualityData(point)
          ? `aq-${resolveAqiLevelKey(point.aqiLevel, point.iaqi)}`
          : AQ_NONE_ICON_NAME),
  }))
}

/**
 * 创建空气质量打点图层：按 IAQI 六级显示对应图标（aq-good ~ aq-severe）。
 * 点击图标通过 onPointClick 回调通知页面（含点击像素坐标），详情弹窗由页面侧统一渲染，
 * 避免图层内 Popup 与页面弹窗同时出现。
 * @param onPointClick 点击图标回调（可选）
 */
export async function createAirQualityLayers(
  scene: Scene,
  points: AirQualityPoint[],
  raisingHeight = 0,
  onPointClick?: (point: AirQualityPoint, pos?: AirPointClickPos) => void,
): Promise<AirMapLayers> {
  // 注册六级 AQI 图标与无数据占位图标：直接使用设计原始切图，不做透视/光晕等立体加工
  const iconEntries: [string, string][] = [
    ...Object.entries(AQI_LEVEL_ICON).map(([level, url]) => [`aq-${level}`, url] as [string, string]),
    ...Object.entries(FIXED_AQ_LEVEL_ICON).map(([level, url]) => [`aq-fixed-${level}`, url] as [string, string]),
    [AQ_NONE_ICON_NAME, AQ_NONE_ICON_URL],
    [FIXED_AQ_NONE_ICON_NAME, FIXED_AQ_NONE_ICON_URL],
  ]
  iconEntries.forEach(([name, url]) => {
    if (scene.hasImage(name)) return
    scene.addImage(name, url)
  })

  const data = decorate(points)

  // 六级图标层（开启拾取，点击由页面侧弹出唯一详情弹窗）
  const iconLayer = new PointLayer({
    zIndex: 30,
    name: 'air-quality-icon-layer',
  })
    .source(data, { parser: { type: 'json', x: 'lng', y: 'lat' } })
    .shape('iconName', (iconName: string) => iconName)
    // L7 image 点 size 为半径（渲染直径≈2n），10 ≈ 20px；depth: false 关闭深度测试，
    // 配合调用方传入的 raisingHeight（高于纹理顶面）保证图标不被纹理面遮挡
    .size(10)
    .style({ raisingHeight, heightfixed: true, depth: false })
  scene.addLayer(iconLayer)

  iconLayer.on('click', (e: any) => {
    const props = e?.feature
    if (!props?.name) return
    // 无空气质量数据的微站仅占位展示，不弹详情弹窗
    if (!hasAirQualityData(props as AirQualityPoint)) return
    const pos = typeof e?.x === 'number' && typeof e?.y === 'number' ? { x: e.x, y: e.y } : undefined
    onPointClick?.(props as AirQualityPoint, pos)
  })

  // 站名文字层：地图放大到 AIR_NAME_MIN_ZOOM 后自动显示，禁拾取避免盖住图标点击
  const nameLayer = new PointLayer({
    zIndex: 31,
    name: 'air-quality-name-layer',
    enablePicking: false,
  })
    .source(data, { parser: { type: 'json', x: 'lng', y: 'lat' } })
    .shape('name', 'text')
    .size(9)
    .color('#eafcff')
    .style({
      textAnchor: 'top',
      textOffset: [0, -25],
      spacing: 2,
      padding: [2, 2],
      stroke: '#021a3f',
      strokeWidth: 2,
      raisingHeight,
      heightfixed: true,
      textAllowOverlap: true,
      depth: false,
    })
  scene.addLayer(nameLayer)
  const nameControl = bindZoomNameLayer(scene, nameLayer, AIR_NAME_MIN_ZOOM)

  return {
    iconLayer,
    setData(nextPoints) {
      const nextData = decorate(nextPoints)
      iconLayer.setData(nextData, { parser: { type: 'json', x: 'lng', y: 'lat' } })
      nameLayer.setData(nextData, { parser: { type: 'json', x: 'lng', y: 'lat' } })
    },
    setNameVisible(visible) {
      nameControl.setBaseVisible(visible)
    },
  }
}

import { PointLayer, type ILayer, type Scene } from '@antv/l7'
// 绕过 l7-component 的 UMD browser 入口，避免开发构建丢失 Marker 命名导出。
import Marker from '@antv/l7-component/es/marker'
import { anchorType } from '@antv/l7-utils'
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

/** 可选：自定义名称装饰函数。返回字符串会作为地图文字层显示（替代默认 name） */
export type AirPointNameDecorator = (point: AirQualityPoint) => string | undefined

/** 可选：控制点位是否可点击（空气质量页允许所有有数据点；monitor 行为不变） */
export type AirPointClickable = (point: AirQualityPoint) => boolean

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

/** 名称装饰：默认沿用 point.name；调用方传入 nameDecorator 时使用其返回值。 */
function applyDisplayName(points: AirQualityPoint[], decorator?: AirPointNameDecorator): AirQualityPoint[] {
  if (!decorator) return points
  return points.map(point => {
    const text = decorator(point)
    return text ? { ...point, name: text } : point
  })
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
  options?: { nameDecorator?: AirPointNameDecorator; clickable?: AirPointClickable },
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

  const data = decorate(applyDisplayName(points, options?.nameDecorator))
  const richMarkers = new Map<string, { marker: Marker; element: HTMLButtonElement; point: AirQualityPoint }>()
  let namesVisible = true
  const refreshRichVisibility = () => {
    richMarkers.forEach(({ marker }) => {
      if (namesVisible && scene.getZoom() >= AIR_NAME_MIN_ZOOM) marker.show()
      else marker.hide()
    })
  }
  const rawMap = (scene as unknown as { mapService: { map: { on: (event: string, fn: () => void) => void; off: (event: string, fn: () => void) => void } } }).mapService.map
  rawMap.on('zoom', refreshRichVisibility)
  scene.on('destroy', () => { rawMap.off('zoom', refreshRichVisibility); richMarkers.clear() })
  const syncRichLabels = (next: AirQualityPoint[]) => {
    const keys = new Set<string>()
    next.filter(point => point.richLabel).forEach(point => {
      const key = String(point.id ?? `${point.lng},${point.lat},${point.name}`)
      keys.add(key)
      let entry = richMarkers.get(key)
      if (!entry) {
        const element = document.createElement('button')
        element.type = 'button'
        element.className = 'air-map-label'
        ;['air-station-badge', 'air-map-label__name', 'air-map-label__value'].forEach(className => {
          const span = document.createElement('span'); span.className = className; element.appendChild(span)
        })
        // L7 的 y offset 正数向上；TOP 锚点配负值把标签放在图标下方，留 8px 空隙。
        const marker = new Marker({ element, anchor: anchorType.TOP, offsets: [0, -18] }).setLnglat({ lng: point.lng, lat: point.lat })
        entry = { marker, element, point }
        richMarkers.set(key, entry)
        element.addEventListener('click', event => {
          event.stopPropagation()
          const current = richMarkers.get(key)?.point
          if (current) onPointClick?.(current, scene.lngLatToContainer([current.lng, current.lat]))
        })
        scene.addMarker(marker)
      }
      entry.point = point
      entry.marker.setLnglat({ lng: point.lng, lat: point.lat })
      entry.element.dataset.stationType = point.stationType ?? 'unknown'
      entry.element.setAttribute('aria-label', `${point.richLabel!.prefix} ${point.name} ${point.richLabel!.value}`)
      entry.element.children[0].textContent = point.richLabel!.prefix
      entry.element.children[1].textContent = point.name
      entry.element.children[2].textContent = point.richLabel!.value
    })
    richMarkers.forEach((entry, key) => { if (!keys.has(key)) { entry.marker.remove(); richMarkers.delete(key) } })
    refreshRichVisibility()
  }
  syncRichLabels(data)

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
    // monitor 的无 AQI 点继续不可点；空气质量页可通过 detailEnabled 明确开启浓度详情。
    const point = props as AirQualityPoint
    const clickable = options?.clickable?.(point) ?? (point.detailEnabled === true || hasAirQualityData(point))
    if (!clickable) return
    const pos = typeof e?.x === 'number' && typeof e?.y === 'number' ? { x: e.x, y: e.y } : undefined
    onPointClick?.(point, pos)
  })

  // 站名文字层：地图放大到 AIR_NAME_MIN_ZOOM 后自动显示，禁拾取避免盖住图标点击
  const nameLayer = new PointLayer({
    zIndex: 31,
    name: 'air-quality-name-layer',
    enablePicking: false,
  })
    .source(data.filter(point => !point.richLabel), { parser: { type: 'json', x: 'lng', y: 'lat' } })
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
      const nextData = decorate(applyDisplayName(nextPoints, options?.nameDecorator))
      iconLayer.setData(nextData, { parser: { type: 'json', x: 'lng', y: 'lat' } })
      nameLayer.setData(nextData.filter(point => !point.richLabel), { parser: { type: 'json', x: 'lng', y: 'lat' } })
      syncRichLabels(nextData)
    },
    setNameVisible(visible) {
      nameControl.setBaseVisible(visible)
      namesVisible = visible
      refreshRichVisibility()
    },
  }
}

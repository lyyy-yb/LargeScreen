import { PointLayer, type ILayer, type Scene } from '@antv/l7'
import { bindZoomNameLayer } from './mapZoomName'

/**
 * 企业排口打点（/dpSys/hbdp/emissionOutlet/list）：
 * 紫蓝渐变圆点（深紫中心 → 浅蓝边缘，inline SVG image 渲染）；
 * 图标 zoom >= 13 才显示；文字 zoom >= 16 才显示，两行：第一行排口名、第二行企业名。
 */
export interface EmissionOutletPoint {
  id?: number
  /** 排口名称（文字第一行） */
  outletName?: string
  /** 企业（排污单位）名称（文字第二行） */
  companyName?: string
  /** 许可证编号 */
  licenseNo?: string
  /** 许可证管理类别 */
  manageCategory?: string
  /** 排口涉及的污染因子 */
  pollutants?: string
  /** 废气排口数量 */
  outletCount?: number
  /** 在线监测排口数量 */
  onlineMonitorInfo?: string
  lng: number
  lat: number
}

/** 点击排口圆点时的屏幕像素坐标（相对地图容器，供页面侧锚定详情弹窗） */
export interface OutletPointClickPos {
  x: number
  y: number
}

export interface EmissionOutletLayers {
  /** 渐变圆点图标层 */
  layer: ILayer
  setData: (points: EmissionOutletPoint[]) => void
  /** 页面级显隐开关；图标和文字仍分别受各自缩放阈值控制 */
  setVisible: (visible: boolean) => void
  destroy: () => void
}

/** 图标显示的最小缩放级别（放大到该级别后展示渐变圆点） */
export const OUTLET_ICON_MIN_ZOOM = 13
/** 名称显示的最小缩放级别（放大到该级别后展示两行文字） */
export const OUTLET_NAME_MIN_ZOOM = 16

/** 排口圆点 image 的 scene 标识（同一 scene 内复用 addImage 结果） */
const OUTLET_ICON_IMAGE = 'emission-outlet-gradient-icon'

/** 高亮蓝紫渐变圆点：亮青外环在卫星底图上保持辨识度，白色描边贴近原型 */
const OUTLET_ICON_SVG = `<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 20 20">
  <defs>
    <radialGradient id="og" cx="50%" cy="50%" r="50%">
      <stop offset="0%" stop-color="#3929a8"/>
      <stop offset="58%" stop-color="#4f63e8"/>
      <stop offset="100%" stop-color="#39d9ff"/>
    </radialGradient>
  </defs>
  <circle cx="10" cy="10" r="9.2" fill="#55e6ff" fill-opacity="0.34"/>
  <circle cx="10" cy="10" r="8" fill="url(#og)" stroke="#f4fdff" stroke-width="1.5"/>
</svg>`
const OUTLET_ICON_DATA_URL = `data:image/svg+xml;utf8,${encodeURIComponent(OUTLET_ICON_SVG)}`

function decorate(points: EmissionOutletPoint[]) {
  const valid = points
    .filter(point => Number.isFinite(point.lng) && Number.isFinite(point.lat))
    .map(point => ({
      ...point,
      outletName: point.outletName ?? '',
      companyName: point.companyName ?? '',
    }))
  if (import.meta.env.DEV) {
    console.log('[emission-outlet] decorate', points.length, '->', valid.length)
  }
  return valid
}

/** 创建企业排口打点图层（紫蓝渐变圆点 + 两行文字：排口名 / 企业名） */
export async function createEmissionOutletLayers(
  scene: Scene,
  points: EmissionOutletPoint[],
  raisingHeight = 0,
  onPointClick?: (point: EmissionOutletPoint, pos?: OutletPointClickPos) => void,
): Promise<EmissionOutletLayers> {
  const data = decorate(points)
  if (import.meta.env.DEV) {
    console.log('[emission-outlet] create layers with', data.length, 'points')
  }

  // 注册渐变图标（已注册则跳过，跨 scene 不共享、需各自注册）
  if (!scene.hasImage(OUTLET_ICON_IMAGE)) {
    await scene.addImage(OUTLET_ICON_IMAGE, OUTLET_ICON_DATA_URL)
  }

  // 渐变圆点图标层（zoom >= 13 显示）
  const layer = new PointLayer({
    zIndex: 29,
    name: 'emission-outlet-icon-layer',
    enablePropagation: false,
    pickingBuffer: 4,
  })
    .source(data, { parser: { type: 'json', x: 'lng', y: 'lat' } })
    .shape(OUTLET_ICON_IMAGE)
    .size(6)
    .style({ raisingHeight, heightfixed: true, depth: false, opacity: 1 })
  scene.addLayer(layer)

  // 点击排口圆点：回调页面侧弹出详情弹窗（含点击像素坐标，锚定弹窗位置）
  layer.on('click', (e: any) => {
    const props = e?.feature
    if (!props || !Number.isFinite(props.lng)) return
    const pos = typeof e?.x === 'number' && typeof e?.y === 'number' ? { x: e.x, y: e.y } : undefined
    onPointClick?.(props as EmissionOutletPoint, pos)
  })
  // 图标层缩放门控：复用 bindZoomNameLayer（仅调 layer.show/hide，不限定图层类型）
  const iconControl = bindZoomNameLayer(scene, layer, OUTLET_ICON_MIN_ZOOM)

  // 第二行文字：企业名称。L7 的 textOffset Y 轴为正数向上，因此使用负值将文字放到圆点下方。
  const companyLayer = new PointLayer({
    zIndex: 30,
    name: 'emission-outlet-company-layer',
    enablePicking: false,
  })
    .source(data, { parser: { type: 'json', x: 'lng', y: 'lat' } })
    .shape('companyName', 'text')
    .size(10)
    .color('#e8fbff')
    .style({
      textAnchor: 'top',
      textOffset: [0, -60],
      spacing: 2,
      padding: [2, 2],
      fontWeight: 700,
      stroke: '#03264c',
      strokeWidth: 2,
      backgroundColor: 'rgba(8, 47, 84, 0.58)',
      backgroundPadding: [3, 1],
      backgroundRadius: 2,
      raisingHeight,
      heightfixed: true,
      textAllowOverlap: true,
      depth: false,
    })
  scene.addLayer(companyLayer)
  const companyControl = bindZoomNameLayer(scene, companyLayer, OUTLET_NAME_MIN_ZOOM)

  // 第一行文字：排口名称，与企业名保持紧凑的两行间距。
  const nameLayer = new PointLayer({
    zIndex: 30,
    name: 'emission-outlet-name-layer',
    enablePicking: false,
  })
    .source(data, { parser: { type: 'json', x: 'lng', y: 'lat' } })
    .shape('outletName', 'text')
    .size(11)
    .color('#e8fbff')
    .style({
      textAnchor: 'top',
      textOffset: [0, -22],
      spacing: 2,
      padding: [2, 2],
      fontWeight: 700,
      stroke: '#03264c',
      strokeWidth: 2,
      backgroundColor: 'rgba(8, 47, 84, 0.58)',
      backgroundPadding: [3, 1],
      backgroundRadius: 2,
      raisingHeight,
      heightfixed: true,
      textAllowOverlap: true,
      depth: false,
    })
  scene.addLayer(nameLayer)
  const nameControl = bindZoomNameLayer(scene, nameLayer, OUTLET_NAME_MIN_ZOOM)

  return {
    layer,
    setData(nextPoints) {
      const nextData = decorate(nextPoints)
      if (import.meta.env.DEV) {
        console.log('[emission-outlet] setData', nextData.length)
      }
      layer.setData(nextData, { parser: { type: 'json', x: 'lng', y: 'lat' } })
      nameLayer.setData(nextData, { parser: { type: 'json', x: 'lng', y: 'lat' } })
      companyLayer.setData(nextData, { parser: { type: 'json', x: 'lng', y: 'lat' } })
    },
    setVisible(visible) {
      // 图标/文字都受页面开关 + 各自缩放阈值的双条件控制。
      // 不直接调用 layer.show()，避免开关状态覆盖缩放门控的隐藏结果。
      iconControl.setBaseVisible(visible)
      nameControl.setBaseVisible(visible)
      companyControl.setBaseVisible(visible)
    },
    destroy() {
      scene.removeLayer(layer)
      scene.removeLayer(nameLayer)
      scene.removeLayer(companyLayer)
    },
  }
}

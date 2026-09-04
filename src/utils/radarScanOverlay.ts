import Marker from '@antv/l7-component/es/marker'
import { PointLayer, type Scene } from '@antv/l7'
import { anchorType } from '@antv/l7-utils'

export const RADAR_SCAN_RADIUS_M = 6000

export interface RadarScanPoint {
  id?: string | number
  lng: number
  lat: number
  online?: boolean
}

export interface RadarScanOverlayOptions {
  /**
   * 返回扫描盘中心雷达图标的 DOM 渲染源（HTMLImageElement 或图片地址）。
   */
  iconFor?: (point: RadarScanPoint) => HTMLImageElement | string | null | undefined
  /** 中心图标尺寸（px），默认 14 */
  iconSize?: number
}

export interface RadarScanOverlay {
  setData: (points: RadarScanPoint[]) => void
  show: () => void
  hide: () => void
  destroy: () => void
}

interface MarkerEntry {
  marker: Marker
  element: HTMLDivElement
  point: RadarScanPoint
}

/**
 * 6000 米贴地雷达扫描盘：L7 原生 shape('radar') 旋转圈 + DOM 中心图标。
 * 名称沿用 RadarScanOverlay 以保持与原调用方（监控大屏三层地图、雷达页）接口兼容。
 */
export function createRadarScanOverlay(
  scene: Scene,
  points: RadarScanPoint[],
  options: RadarScanOverlayOptions = {},
): RadarScanOverlay {
  const { iconFor, iconSize = 14 } = options
  let entries: MarkerEntry[] = []
  let destroyed = false
  let visible = true
  let isLayerAdded = false

  // 1. L7 原生 shape('radar') WebGL 6000 米米制扫描圈
  const scanLayer = new PointLayer({
    zIndex: 4,
    name: 'radar-scan-meter-layer',
    enablePropagation: false,
  })
    .shape('radar')
    .size(RADAR_SCAN_RADIUS_M)
    .color('rgba(0, 241, 255, 0.50)')
    .style({
      speed: 1,
      unit: 'meter' as any,
    })
    .animate(true)

  const removeMarker = (marker: Marker) => {
    const markerService = (scene as unknown as { markerService?: { removeMarker?: (item: Marker) => void } }).markerService
    if (markerService?.removeMarker) markerService.removeMarker(marker)
    else marker.remove()
  }

  const clearMarkers = () => {
    entries.forEach(entry => removeMarker(entry.marker))
    entries = []
  }

  const applyVisible = () => {
    if (visible) {
      if (isLayerAdded) scanLayer.show()
      entries.forEach(entry => { entry.element.style.display = '' })
    } else {
      if (isLayerAdded) scanLayer.hide()
      entries.forEach(entry => { entry.element.style.display = 'none' })
    }
  }

  const setData = (nextPoints: RadarScanPoint[]) => {
    if (destroyed) return
    clearMarkers()
    const validPoints = nextPoints.filter(point => Number.isFinite(point.lng) && Number.isFinite(point.lat))

    // 渲染中心雷达图标 (DOM Marker，显式指定 14px 容器宽高等居中定位)
    entries = validPoints
      .map((point) => {
        const iconSource = iconFor?.(point)
        if (!iconSource) return null

        const element = document.createElement('div')
        element.className = 'radar-scan-overlay-icon-wrapper'
        element.style.pointerEvents = 'none'
        element.style.position = 'relative'
        element.style.width = `${iconSize}px`
        element.style.height = `${iconSize}px`
        element.style.display = 'flex'
        element.style.alignItems = 'center'
        element.style.justifyContent = 'center'

        const img = document.createElement('img')
        img.src = typeof iconSource === 'string' ? iconSource : iconSource.src
        img.style.width = '100%'
        img.style.height = '100%'
        img.style.display = 'block'
        img.style.pointerEvents = 'none'
        img.style.filter = 'drop-shadow(0 0 4px rgba(0, 245, 255, 0.6))'
        img.alt = ''
        img.draggable = false
        element.appendChild(img)

        const marker = new Marker({ element, anchor: anchorType.CENTER, overflowHide: false })
          .setLnglat({ lng: point.lng, lat: point.lat })
        scene.addMarker(marker)
        return { marker, element, point }
      })
      .filter((entry): entry is MarkerEntry => entry !== null)

    // 更新或延后初始化 6000m WebGL 雷达图层
    if (validPoints.length > 0) {
      if (isLayerAdded) {
        scanLayer.setData(validPoints, { parser: { type: 'json', x: 'lng', y: 'lat' } })
      } else {
        scanLayer.source(validPoints, { parser: { type: 'json', x: 'lng', y: 'lat' } })
        scene.addLayer(scanLayer)
        isLayerAdded = true
      }
    } else {
      if (isLayerAdded) {
        scanLayer.setData([], { parser: { type: 'json', x: 'lng', y: 'lat' } })
      }
    }

    applyVisible()
  }

  setData(points)

  return {
    setData,
    show() {
      if (destroyed || visible) return
      visible = true
      applyVisible()
    },
    hide() {
      if (destroyed || !visible) return
      visible = false
      applyVisible()
    },
    destroy() {
      if (destroyed) return
      destroyed = true
      clearMarkers()
      if (isLayerAdded) {
        scene.removeLayer(scanLayer)
        isLayerAdded = false
      }
    },
  }
}

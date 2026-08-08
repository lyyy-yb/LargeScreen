import Marker from '@antv/l7-component/es/marker'
import type { Scene } from '@antv/l7'
import { anchorType } from '@antv/l7-utils'

/** 扫描半径（真实米制）：直径随地图缩放按经纬度换算像素，保证覆盖范围与实际一致 */
export const RADAR_SCAN_RADIUS_M = 15000
/** 扫描盘像素直径下限/上限（避免极端缩放下 DOM 过小或过大） */
const SCAN_DIAMETER_MIN_PX = 24
const SCAN_DIAMETER_MAX_PX = 1600
/** 扫描盘向内侧倾斜的角度（配合地图 pitch 产生贴地立体感） */
const SCAN_TILT_DEG = 30

/** 指定纬度、缩放下 1px 对应的米数（Web 墨卡托） */
function metersPerPixel(lat: number, zoom: number) {
  return (156543.03392 * Math.cos((lat * Math.PI) / 180)) / Math.pow(2, zoom)
}

export interface RadarScanPoint {
  id?: string | number
  lng: number
  lat: number
  online?: boolean
}

export interface RadarScanOverlayOptions {
  /**
   * 返回扫描盘中心雷达图标的 DOM 渲染源（HTMLImageElement 或图片地址）。
   * 图标与扫描盘位于同一个 DOM Marker 节点内，天然同心，不存在投影错位。
   */
  iconFor?: (point: RadarScanPoint) => HTMLImageElement | string | null | undefined
  /** 中心图标尺寸（px），默认 14 */
  iconSize?: number
}

export interface RadarScanOverlay {
  setData: (points: RadarScanPoint[]) => void
  destroy: () => void
}

interface MarkerEntry {
  marker: Marker
  element: HTMLDivElement
  inner: HTMLDivElement
  point: RadarScanPoint
}

/**
 * L7 2.29 的内置 `shape('radar')` 在部分 WebGL 驱动下会整层不出图。
 * 这里改用随地图定位的 DOM 扫描盘：按真实米制（半径 9000m）随缩放换算像素、向内倾斜制造贴地立体感。
 * 雷达图标直接渲染在扫描盘 DOM 节点中心，保证图标始终位于扫描盘正中间。
 */
export function createRadarScanOverlay(
  scene: Scene,
  points: RadarScanPoint[],
  options: RadarScanOverlayOptions = {},
): RadarScanOverlay {
  const { iconFor, iconSize = 14 } = options
  let entries: MarkerEntry[] = []
  let frameId = 0
  let lastZoom = Number.NaN
  let destroyed = false

  const removeMarker = (marker: Marker) => {
    const markerService = (scene as unknown as { markerService?: { removeMarker?: (item: Marker) => void } }).markerService
    if (markerService?.removeMarker) markerService.removeMarker(marker)
    else marker.remove()
  }

  const syncSizes = (force = false) => {
    if (destroyed || !entries.length) return
    const zoom = scene.getZoom()
    if (!force && Math.abs(zoom - lastZoom) < 0.002) return
    lastZoom = zoom
    entries.forEach(entry => {
      // 9000m 真实半径 → 当前缩放下的像素直径，随地图缩放改变大小
      const mpp = metersPerPixel(entry.point.lat, zoom)
      const diameterPx = Math.min(
        SCAN_DIAMETER_MAX_PX,
        Math.max(SCAN_DIAMETER_MIN_PX, Math.round((RADAR_SCAN_RADIUS_M * 2) / mpp)),
      )
      entry.element.style.width = `${diameterPx}px`
      entry.element.style.height = `${diameterPx}px`
      entry.element.style.opacity = '1'
      // 扫描盘整体透视内倾形成贴地椭圆；中心图标不参与倾斜，保持正视角
      entry.inner.style.transform = `perspective(${Math.round(diameterPx * 2.4)}px) rotateX(${SCAN_TILT_DEG}deg)`
    })
  }

  const watchZoom = () => {
    if (destroyed || !entries.some(entry => entry.element.isConnected)) {
      frameId = 0
      return
    }
    syncSizes()
    frameId = window.requestAnimationFrame(watchZoom)
  }

  const startWatching = () => {
    if (!frameId && !destroyed && entries.length) frameId = window.requestAnimationFrame(watchZoom)
  }

  const clear = () => {
    entries.forEach(entry => removeMarker(entry.marker))
    entries = []
    lastZoom = Number.NaN
  }

  const setData = (nextPoints: RadarScanPoint[]) => {
    if (destroyed) return
    clear()
    entries = nextPoints
      .filter(point => Number.isFinite(point.lng) && Number.isFinite(point.lat))
      .map((point, index) => {
        const element = document.createElement('div')
        element.className = 'radar-scan-overlay'
        element.dataset.radarId = String(point.id ?? index)
        element.setAttribute('aria-hidden', 'true')
        element.innerHTML = `
          <span class="radar-scan-overlay__inner">
            <span class="radar-scan-overlay__disc"></span>
            <span class="radar-scan-overlay__sweep"></span>
            <span class="radar-scan-overlay__cross"></span>
          </span>
        `
        const inner = element.querySelector('.radar-scan-overlay__inner') as HTMLDivElement

        // 中心雷达图标：与扫描盘同一 DOM 节点，绝对居中，彻底避免投影错位
        const iconSource = iconFor?.(point)
        if (iconSource) {
          const img = document.createElement('img')
          img.className = 'radar-scan-overlay__icon'
          img.src = typeof iconSource === 'string' ? iconSource : iconSource.src
          img.style.width = `${iconSize}px`
          img.style.height = `${iconSize}px`
          img.alt = ''
          img.draggable = false
          element.appendChild(img)
        }

        const marker = new Marker({ element, anchor: anchorType.CENTER, overflowHide: false })
          .setLnglat({ lng: point.lng, lat: point.lat })
        scene.addMarker(marker)
        return { marker, element, inner, point }
      })
    syncSizes(true)
    startWatching()
  }

  setData(points)

  return {
    setData,
    destroy() {
      if (destroyed) return
      destroyed = true
      if (frameId) window.cancelAnimationFrame(frameId)
      frameId = 0
      clear()
    },
  }
}

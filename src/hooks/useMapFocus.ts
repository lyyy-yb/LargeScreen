import { useEffect, type RefObject } from 'react'
import { PointLayer, type ILayer, type Scene } from '@antv/l7'
import type { MapFocusTarget } from '@/types/mapFocus'

const SEARCH_MARKER_IMAGE = 'monitor-search-location-pin'
const SEARCH_MARKER_SVG = `<svg xmlns="http://www.w3.org/2000/svg" width="32" height="42" viewBox="0 0 32 42">
  <defs>
    <linearGradient id="pin" x1="7" y1="3" x2="25" y2="34" gradientUnits="userSpaceOnUse">
      <stop stop-color="#55b8ff"/>
      <stop offset="1" stop-color="#2478ee"/>
    </linearGradient>
  </defs>
  <path d="M16 1.5C8.55 1.5 2.5 7.55 2.5 15c0 10.2 10.62 22.13 12.72 24.39a1.06 1.06 0 0 0 1.56 0C18.88 37.13 29.5 25.2 29.5 15 29.5 7.55 23.45 1.5 16 1.5Z" fill="url(#pin)" stroke="#fff" stroke-width="2"/>
  <circle cx="16" cy="14.5" r="6" fill="#fff"/>
</svg>`
const SEARCH_MARKER_URL = `data:image/svg+xml;utf8,${encodeURIComponent(SEARCH_MARKER_SVG)}`
const markerImagePromises = new WeakMap<Scene, Promise<void>>()

function ensureMarkerImage(scene: Scene) {
  if (scene.hasImage(SEARCH_MARKER_IMAGE)) return Promise.resolve()
  const existing = markerImagePromises.get(scene)
  if (existing) return existing
  const promise = scene.addImage(SEARCH_MARKER_IMAGE, SEARCH_MARKER_URL)
  markerImagePromises.set(scene, promise)
  return promise
}

/**
 * monitor 全局搜索定位：移动并放大地图，在目标坐标显示 3 秒高亮标记。
 * 标记使用蓝色水滴定位图钉 + 半透明青色光环。
 */
export function useMapFocus(
  sceneRef: RefObject<Scene | null>,
  ready: boolean,
  focusTarget?: MapFocusTarget | null,
) {
  useEffect(() => {
    const scene = sceneRef.current
    if (!ready || !focusTarget || !scene) return

    const rawMap = (scene as unknown as { mapService?: { map?: { flyTo?: (options: object) => void } } }).mapService?.map
    if (focusTarget.animate && rawMap?.flyTo) {
      rawMap.flyTo({ center: [focusTarget.lng, focusTarget.lat], zoom: focusTarget.zoom, duration: 1200 })
    } else scene.setZoomAndCenter(focusTarget.zoom, [focusTarget.lng, focusTarget.lat])
    const data = [{ lng: focusTarget.lng, lat: focusTarget.lat }]

    let haloLayer: ILayer | null = null
    let markerLayer: ILayer | null = null
    let timer: number | null = null
    let cancelled = false

    let removed = false
    const removeMarker = () => {
      if (removed) return
      removed = true
      if (markerLayer) scene.removeLayer(markerLayer)
      if (haloLayer) scene.removeLayer(haloLayer)
    }

    void ensureMarkerImage(scene).then(() => {
      if (cancelled) return
      const nextHaloLayer = new PointLayer({ zIndex: 98, enablePicking: false })
        .source(data, { parser: { type: 'json', x: 'lng', y: 'lat' } })
        .shape('circle')
        .size(22)
        .color('#00eaff')
        .style({ opacity: 0.18, stroke: '#a8fbff', strokeWidth: 1.5, depth: false, heightfixed: true })

      const nextMarkerLayer = new PointLayer({ zIndex: 99, enablePicking: false })
        .source(data, { parser: { type: 'json', x: 'lng', y: 'lat' } })
        .shape(SEARCH_MARKER_IMAGE)
        .size(14)
        .style({ opacity: 1, depth: false, heightfixed: true })

      haloLayer = nextHaloLayer
      markerLayer = nextMarkerLayer
      scene.addLayer(nextHaloLayer)
      scene.addLayer(nextMarkerLayer)
      timer = window.setTimeout(removeMarker, 3000)
    })

    return () => {
      cancelled = true
      if (timer != null) window.clearTimeout(timer)
      removeMarker()
    }
  }, [focusTarget, ready, sceneRef])
}

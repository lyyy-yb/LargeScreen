import { PolygonLayer, type ILayer, type Scene } from '@antv/l7'

/** 覆盖浙江省全境的大矩形外环（挖洞用，三级地图通用） */
const OUTER_RING = [
  [108, 18],
  [132, 18],
  [132, 40],
  [108, 40],
  [108, 18],
]

/** 提取 geojson 中所有 Polygon/MultiPolygon 的环（作为蒙层的洞） */
function extractRings(geojson: any): number[][][] {
  return (geojson?.features ?? []).flatMap((f: any) =>
    f.geometry?.type === 'Polygon'
      ? f.geometry.coordinates
      : (f.geometry?.coordinates ?? []).flat(),
  )
}

/**
 * 区域外蒙层：大矩形挖掉区域轮廓，区域外用深色半透明雾化，突出主体区域。
 * 与省级地图（ZJ3DMap）方案一致，市/区县/乡镇级复用。
 */
export function addRegionMask(
  scene: Scene,
  geojson: any,
  zIndex: number = 1,
  opacity: number = 0.55,
  options: { enabled?: boolean } = { enabled: true },
): ILayer | null {
  if (options.enabled === false) return null
  const rings = extractRings(geojson)
  const maskLayer = new PolygonLayer({ zIndex, enablePicking: false, autoFit: false })
    .source({
      type: 'FeatureCollection',
      features: [{ type: 'Feature', properties: {}, geometry: { type: 'Polygon', coordinates: [OUTER_RING, ...rings] } }],
    })
    .shape('fill')
    .color('#04162e')
    .style({ opacity })
  scene.addLayer(maskLayer)
  return maskLayer
}

/** 计算 geojson 的经纬度包围盒 */
function boundsOf(geojson: any): [number, number, number, number] | null {
  let minLng = Number.POSITIVE_INFINITY
  let maxLng = Number.NEGATIVE_INFINITY
  let minLat = Number.POSITIVE_INFINITY
  let maxLat = Number.NEGATIVE_INFINITY
  const visit = (value: unknown) => {
    if (!Array.isArray(value)) return
    if (value.length >= 2 && typeof value[0] === 'number' && typeof value[1] === 'number') {
      minLng = Math.min(minLng, value[0])
      maxLng = Math.max(maxLng, value[0])
      minLat = Math.min(minLat, value[1])
      maxLat = Math.max(maxLat, value[1])
      return
    }
    value.forEach(visit)
  }
  ;(geojson?.features ?? []).forEach((f: any) => visit(f.geometry?.coordinates))
  return Number.isFinite(minLng) ? [minLng, minLat, maxLng, maxLat] : null
}

/**
 * 限制拖拽范围：区域不能被拖出可视范围。
 * 包围盒按区域跨度比例外扩（近景小区域外扩少、远景大区域外扩多）。
 */
export function setRegionBounds(scene: Scene, geojson: any) {
  const b = boundsOf(geojson)
  if (!b) return
  const [minLng, minLat, maxLng, maxLat] = b
  const spanLng = maxLng - minLng
  const spanLat = maxLat - minLat
  const padLng = Math.min(Math.max(spanLng * 0.5, 0.15), 1.2)
  const padLat = Math.min(Math.max(spanLat * 0.5, 0.12), 1)
  // L7 mapService 为私有属性，用 any 断言取底层 mapbox 实例
  const rawMap: any = (scene as any).mapService?.map ?? (scene as any).mapService?.getMap?.()
  rawMap?.setMaxBounds?.([
    [minLng - padLng, minLat - padLat],
    [maxLng + padLng, maxLat + padLat],
  ])
}

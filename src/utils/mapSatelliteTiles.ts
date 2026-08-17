import { RasterLayer, type ILayer, type Scene } from '@antv/l7'

/** 卫星瓦片地址（与 radar 页 L7MapView 同源，走本地 /offMap 代理，不依赖外部资源） */
export const SATELLITE_TILE_URL = '/offMap/api/tilesets/zjw/{z}/{x}/{y}.jpg'

export interface SatelliteTilesOptions {
  /** 图层层级，默认 1（垫底） */
  zIndex?: number
  /** 底图不透明度 0~1，默认 0.95。值越小底图越淡、数据越突出 */
  opacity?: number
  /** 低于该缩放级别不请求/不显示卫星瓦片（节省带宽） */
  minZoom?: number
  /** 高于该缩放级别不请求/不显示卫星瓦片 */
  maxZoom?: number
  /** 初始是否显示，默认 true */
  visible?: boolean
  /** 自定义瓦片地址；默认自动拼接 window.location.origin + SATELLITE_TILE_URL */
  url?: string
}

/**
 * 给地图场景铺设卫星影像底图（与 radar 页一致）。
 * 低 zIndex 垫底，区域边界线/打点图层叠加在其上。
 *
 * 关键能力：
 * - opacity 调整“底图强度”，让霓虹色数据层在大屏上更突出；
 * - minZoom/maxZoom 做缩放门控，仅在指定层级范围请求瓦片，省带宽；
 * - 返回的图层可直接 .style({ opacity }) / .show() / .hide() 做实时控制，
 *   无需销毁重建。
 */
export function addSatelliteTiles(scene: Scene, options: SatelliteTilesOptions = {}): ILayer {
  const {
    zIndex = 1,
    opacity = 0.95,
    minZoom = 0,
    maxZoom = 16,
    visible = true,
    url,
  } = options

  const tileUrl = url ?? `${window.location.origin}${SATELLITE_TILE_URL}`

  const tileLayer = new RasterLayer({ zIndex, enablePicking: false }).source(tileUrl, {
    parser: {
      type: 'rasterTile',
      tileSize: 256,
      zoomOffset: 0,
      minZoom,
      maxZoom,
    },
  })

  tileLayer.style({ opacity })
  if (!visible) tileLayer.hide()
  scene.addLayer(tileLayer)
  return tileLayer
}

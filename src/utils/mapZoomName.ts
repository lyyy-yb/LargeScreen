import type { ILayer, Scene } from '@antv/l7'

/** 空气质量监测站名称显示的最小缩放级别（放大到该级别后展示站名） */
export const AIR_NAME_MIN_ZOOM = 11
/** 雷达常规/突发点位名称显示的最小缩放级别（比空气站名更深一级） */
export const RADAR_NAME_MIN_ZOOM = 14

export interface ZoomNameControl {
  /** 外部开关（页面级图层显隐），与缩放阈值共同决定名称层是否可见 */
  setBaseVisible: (visible: boolean) => void
}

/**
 * 缩放阈值名称层控制：仅当「外部开关开启 且 地图缩放 >= minZoom」时才显示名称文字层。
 * L7 Scene 未暴露可靠的 zoom 事件，直接监听底层 mapbox 实例的 'zoom' 事件
 * （与 mapRegionMask 取 mapService 的方式一致）。
 */
export function bindZoomNameLayer(scene: Scene, layer: ILayer, minZoom: number): ZoomNameControl {
  let baseVisible = true
  const rawMap: any = (scene as any).mapService?.map ?? (scene as any).mapService?.getMap?.()

  const apply = () => {
    const zoomOk = scene.getZoom() >= minZoom
    if (baseVisible && zoomOk) layer.show()
    else layer.hide()
  }

  rawMap?.on?.('zoom', apply)
  apply()

  return {
    setBaseVisible(visible: boolean) {
      baseVisible = visible
      apply()
    },
  }
}

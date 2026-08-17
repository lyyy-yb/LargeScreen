import { PointLayer, type ILayer, type Scene } from '@antv/l7'
import { bindZoomNameLayer, RADAR_NAME_MIN_ZOOM } from './mapZoomName'

/**
 * 雷达突发告警点（/dpSys/hbdp/leida/alarmPoint）：
 * type 1 = 超限（橙 #FFB024），type 2 = 突高（红 #FF3936），与老项目 MapBox 配色一致。
 */
export interface RadarAlarmPoint {
  lng: number
  lat: number
  /** 1=超限 2=突高 */
  type: 1 | 2
  name?: string
}

export interface RadarAlarmLayers {
  layer: ILayer
  setData: (points: RadarAlarmPoint[]) => void
  /** 页面级显隐开关接入名称文字层（实际可见性还受缩放阈值控制） */
  setNameVisible: (visible: boolean) => void
  destroy: () => void
}

function decorate(points: RadarAlarmPoint[]) {
  return points
    .filter(point => Number.isFinite(point.lng) && Number.isFinite(point.lat))
    .map(point => ({ ...point, rColor: point.type === 2 ? '#FF3936' : '#FFB024' }))
}

/** 创建雷达告警点打点图层（橙/红圆点 + 白色细描边，独立于预警点位图层常显） */
export async function createRadarAlarmLayers(
  scene: Scene,
  points: RadarAlarmPoint[],
  raisingHeight = 0,
): Promise<RadarAlarmLayers> {
  const layer = new PointLayer({
    zIndex: 30,
    name: 'radar-alarm-point-layer',
    enablePropagation: false,
    pickingBuffer: 4,
  })
    .source(decorate(points), { parser: { type: 'json', x: 'lng', y: 'lat' } })
    .shape('circle')
    .color('rColor')
    .size(5)
    .style({ raisingHeight, heightfixed: true, depth: false, stroke: '#ffffff', strokeWidth: 1, opacity: 0.95 })
  scene.addLayer(layer)

  // 突发点位名称文字层：地图放大到 RADAR_NAME_MIN_ZOOM 后自动显示（仅有名称的点位）
  const nameLayer = new PointLayer({
    zIndex: 31,
    name: 'radar-alarm-name-layer',
    enablePicking: false,
  })
    .source(decorate(points).filter(point => point.name), { parser: { type: 'json', x: 'lng', y: 'lat' } })
    .shape('name', 'text')
    .size(9)
    .color('#ffe9e8')
    .style({
      textAnchor: 'top',
      textOffset: [0, -20],
      spacing: 2,
      padding: [2, 2],
      stroke: '#3a0a0a',
      strokeWidth: 2,
      raisingHeight,
      heightfixed: true,
      textAllowOverlap: true,
      depth: false,
    })
  scene.addLayer(nameLayer)
  const nameControl = bindZoomNameLayer(scene, nameLayer, RADAR_NAME_MIN_ZOOM)

  return {
    layer,
    setData(nextPoints) {
      const nextData = decorate(nextPoints)
      layer.setData(nextData, { parser: { type: 'json', x: 'lng', y: 'lat' } })
      nameLayer.setData(nextData.filter(point => point.name), { parser: { type: 'json', x: 'lng', y: 'lat' } })
    },
    setNameVisible(visible) {
      nameControl.setBaseVisible(visible)
    },
    destroy() {
      scene.removeLayer(layer)
      scene.removeLayer(nameLayer)
    },
  }
}

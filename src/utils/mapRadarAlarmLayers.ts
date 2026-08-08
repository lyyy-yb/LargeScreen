import { PointLayer, type ILayer, type Scene } from '@antv/l7'

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

  return {
    layer,
    setData(nextPoints) {
      layer.setData(decorate(nextPoints), { parser: { type: 'json', x: 'lng', y: 'lat' } })
    },
    destroy() {
      scene.removeLayer(layer)
    },
  }
}

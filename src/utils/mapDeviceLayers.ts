import { LineLayer, PointLayer, type ILayer, type Scene } from '@antv/l7'
import type { MapDevicePoint } from '@/types/mapDevice'

export interface DeviceMapLayers {
  iconLayer: ILayer
  labelLayer: ILayer
  radarLayer: ILayer
  flightLineLayer: ILayer | null
  flightDashLayer: ILayer | null
  setData: (points: MapDevicePoint[]) => void
}

/** 生成第一个无人机的示例飞行线数据：从萧山飞到西湖区 */
function buildDemoFlightLine(dronePoints: MapDevicePoint[]) {
  if (!dronePoints.length) return null
  const origin = dronePoints[0]
  // 西湖区中心坐标
  const xihuCenter = { lng: 120.13, lat: 30.26 }
  // 模拟从萧山到西湖区的巡检路线（5个航点）
  const waypoints = [
    { lng: origin.lng, lat: origin.lat },
    { lng: origin.lng + (xihuCenter.lng - origin.lng) * 0.25, lat: origin.lat + (xihuCenter.lat - origin.lat) * 0.25 + 0.01 },
    { lng: origin.lng + (xihuCenter.lng - origin.lng) * 0.5, lat: origin.lat + (xihuCenter.lat - origin.lat) * 0.5 - 0.005 },
    { lng: origin.lng + (xihuCenter.lng - origin.lng) * 0.75, lat: origin.lat + (xihuCenter.lat - origin.lat) * 0.75 + 0.008 },
    { lng: xihuCenter.lng, lat: xihuCenter.lat },
  ]
  // 已飞行部分（前3段用实线）
  const flownSegments = waypoints.slice(0, 3).map((wp, i) => ({
    coordinates: [wp, waypoints[i + 1]],
  }))
  // 待飞行部分（后2段用虚线）
  const pendingSegments = waypoints.slice(2).map((wp, i) => ({
    coordinates: [wp, waypoints[i + 1]],
  }))
  return { flownSegments, pendingSegments }
}

export async function createDeviceMapLayers(
  scene: Scene,
  points: MapDevicePoint[],
  raisingHeight = 0,
): Promise<DeviceMapLayers> {
  const imageMap: Record<string, string> = {
    'monitor-radar-on': '/marker/radar-on.png',
    'monitor-radar-off': '/marker/radar-off.png',
    'monitor-drone-on': '/marker/drone-on.png',
    'monitor-drone-off': '/marker/drone-off.png',
  }
  await Promise.all(
    Object.entries(imageMap).map(([name, url]) =>
      scene.hasImage(name) ? Promise.resolve() : scene.addImage(name, url),
    ),
  )

  const withIcons = points.map(point => {
    const prefix = point.type === 'radar' ? 'monitor-radar' : 'monitor-drone'
    const suffix = point.online ? 'on' : 'off'
    return { ...point, iconName: `${prefix}-${suffix}` }
  })
  const radarPoints = withIcons.filter(point => point.type === 'radar')
  const dronePoints = points.filter(point => point.type === 'drone')

  // 雷达扫描动画（借鉴 antd-demo，size 6000 米）
  const radarLayer = new PointLayer({
    zIndex: 20,
    name: 'monitor-radar-scan-layer',
    enablePropagation: false,
    pickingBuffer: 2,
  })
    .source(radarPoints, { parser: { type: 'json', x: 'lng', y: 'lat' } })
    .shape('radar')
    .size(6000)
    .color('rgba(2, 248, 250, 0.50)')
    .style({ speed: 1, unit: 'meter', raisingHeight })
    .animate(true)
  scene.addLayer(radarLayer)

  // 图标层（不再添加多余 circle 层，与 /drone 页面保持一致）
  const iconLayer = new PointLayer({
    zIndex: 22,
    name: 'monitor-device-icon-layer',
    enablePropagation: false,
    pickingBuffer: 4,
  })
    .source(withIcons, { parser: { type: 'json', x: 'lng', y: 'lat' } })
    .shape('iconName', (iconName: string) => iconName)
    .size('type', (type: MapDevicePoint['type']) => type === 'radar' ? 18 : 16)
    .style({ raisingHeight, heightfixed: true })
  scene.addLayer(iconLayer)

  // 标签层
  const labelLayer = new PointLayer({
    zIndex: 23,
    name: 'monitor-device-label-layer',
    enablePropagation: false,
  })
    .source(withIcons, { parser: { type: 'json', x: 'lng', y: 'lat' } })
    .shape('name', 'text')
    .size(12)
    .color('#e8fcff')
    .style({
      raisingHeight,
      heightfixed: true,
      textOffset: [0, -15],
      textAnchor: 'center',
      textAllowOverlap: false,
      padding: [4, 4],
      stroke: '#063d72',
      strokeWidth: 2,
    })
  scene.addLayer(labelLayer)

  // 飞行线样例：第一个无人机的巡检路线
  let flightLineLayer: ILayer | null = null
  let flightDashLayer: ILayer | null = null
  const flightData = buildDemoFlightLine(dronePoints)
  if (flightData) {
    // 已飞行部分 - 实线 + arc3d 动画
    flightLineLayer = new LineLayer({ zIndex: 18, blend: 'normal' })
      .source(flightData.flownSegments)
      .shape('arc3d')
      .size(2)
      .color('rgb(0, 191, 255)')
      .animate({ interval: 0.2, trailLength: 0.6, duration: 1 })
      .style({
        sourceColor: 'rgb(0, 191, 255)',
        targetColor: 'rgb(57, 255, 20)',
        thetaOffset: 0.3,
        opacity: 1,
      })
    scene.addLayer(flightLineLayer)

    // 待飞行部分 - 虚线
    flightDashLayer = new LineLayer({ zIndex: 17 })
      .source(flightData.pendingSegments)
      .shape('line')
      .size(1.5)
      .color('rgba(0, 191, 255, 0.5)')
      .style({
        lineType: 'dash',
        dashArray: [4, 4],
        opacity: 0.7,
      })
    scene.addLayer(flightDashLayer)
  }

  return {
    iconLayer,
    labelLayer,
    radarLayer,
    flightLineLayer,
    flightDashLayer,
    setData(nextPoints) {
      const nextWithIcons = nextPoints.map(point => {
        const prefix = point.type === 'radar' ? 'monitor-radar' : 'monitor-drone'
        const suffix = point.online ? 'on' : 'off'
        return { ...point, iconName: `${prefix}-${suffix}` }
      })
      iconLayer.setData(nextWithIcons, { parser: { type: 'json', x: 'lng', y: 'lat' } })
      labelLayer.setData(nextWithIcons, { parser: { type: 'json', x: 'lng', y: 'lat' } })
      radarLayer.setData(nextWithIcons.filter(point => point.type === 'radar'), {
        parser: { type: 'json', x: 'lng', y: 'lat' },
      })
      // 更新飞行线
      const nextDrones = nextPoints.filter(point => point.type === 'drone')
      const nextFlight = buildDemoFlightLine(nextDrones)
      if (nextFlight && flightLineLayer) {
        flightLineLayer.setData(nextFlight.flownSegments)
      }
      if (nextFlight && flightDashLayer) {
        flightDashLayer.setData(nextFlight.pendingSegments)
      }
    },
  }
}

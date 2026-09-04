import { PointLayer, type ILayer, type Scene } from '@antv/l7'
import type { MapDevicePoint } from '@/types/mapDevice'

export interface DeviceMapLayers {
  /** monitor 端只保留无人机图标层；雷达扫描效果已下线（统一收敛到 radar 页） */
  iconLayer: ILayer
  setData: (points: MapDevicePoint[]) => void
  destroy: () => void
}

export async function createDeviceMapLayers(
  scene: Scene,
  points: MapDevicePoint[],
  raisingHeight = 0,
): Promise<DeviceMapLayers> {
  // 无人机场图标（直接用原图，不再做透视变形：monitor 端不再渲染雷达 DOM 扫描盘，warp 仅服务于扫描中心图标）
  const imageMap: Record<string, string> = {
    'monitor-drone-on': '/marker/drone-on.png',
    'monitor-drone-off': '/marker/drone-off.png',
  }
  await Promise.all(
    Object.entries(imageMap).map(async ([name, url]) => {
      if (!scene.hasImage(name)) scene.addImage(name, url)
    }),
  )

  const droneIconPoints = points
    .filter(point => point.type === 'drone')
    .map(point => ({ ...point, iconName: point.online ? 'monitor-drone-on' : 'monitor-drone-off' }))

  // 无人机图标层（size 7 ≈ 14px 直径；monitor 端不再叠加雷达 DOM 扫描盘/名称层，避免与雷达页重复）
  // zIndex 33：高于所有其他点位图层（排口 29 / 雷达告警 30 / 空气站 30 / 预警 31 / 预警计数 32），
  // 避免机场图标被同类打点压盖。机场数量远少于站点，压盖影响可控。
  const iconLayer = new PointLayer({
    zIndex: 33,
    name: 'monitor-device-icon-layer',
    enablePropagation: false,
    pickingBuffer: 4,
  })
    .source(droneIconPoints, { parser: { type: 'json', x: 'lng', y: 'lat' } })
    .shape('iconName', (iconName: string) => iconName)
    .size(7)
    .style({ raisingHeight, heightfixed: true })
  scene.addLayer(iconLayer)

  return {
    iconLayer,
    setData(nextPoints) {
      const nextDronePoints = nextPoints
        .filter(point => point.type === 'drone')
        .map(point => ({ ...point, iconName: point.online ? 'monitor-drone-on' : 'monitor-drone-off' }))
      iconLayer.setData(nextDronePoints, { parser: { type: 'json', x: 'lng', y: 'lat' } })
    },
    destroy() {
      scene.removeLayer(iconLayer)
    },
  }
}

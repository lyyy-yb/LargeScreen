import { PointLayer, type ILayer, type Scene } from '@antv/l7'
import type { MapDevicePoint } from '@/types/mapDevice'
import { getPerspectiveIcon } from './iconPerspective'
import { createRadarScanOverlay, type RadarScanOverlay } from './radarScanOverlay'

export interface DeviceMapLayers {
  iconLayer: ILayer
  radarLayer: RadarScanOverlay
  setData: (points: MapDevicePoint[]) => void
  destroy: () => void
}

export async function createDeviceMapLayers(
  scene: Scene,
  points: MapDevicePoint[],
  raisingHeight = 0,
): Promise<DeviceMapLayers> {
  // 注册图标（透视变形后更有立体感：向底部飘 25°、向右侧飘 10°）
  const imageMap: Record<string, string> = {
    'monitor-radar-on': '/marker/radar-on.png',
    'monitor-radar-off': '/marker/radar-off.png',
    'monitor-drone-on': '/marker/drone-on.png',
    'monitor-drone-off': '/marker/drone-off.png',
  }
  // 本地保留变形后的图片引用，供雷达 DOM 扫描盘中心图标复用
  const warpedImages: Record<string, HTMLImageElement | string> = {}
  await Promise.all(
    Object.entries(imageMap).map(async ([name, url]) => {
      try {
        warpedImages[name] = await getPerspectiveIcon(url)
      } catch {
        warpedImages[name] = url
      }
      if (!scene.hasImage(name)) scene.addImage(name, warpedImages[name])
    }),
  )

  const withIcons = points.map(point => {
    const prefix = point.type === 'radar' ? 'monitor-radar' : 'monitor-drone'
    const suffix = point.online ? 'on' : 'off'
    return { ...point, iconName: `${prefix}-${suffix}` }
  })
  const radarPoints = withIcons.filter(point => point.type === 'radar')
  const droneIconPoints = withIcons.filter(point => point.type === 'drone')

  // 雷达：固定像素扫描盘 + 中心图标同一 DOM 节点渲染（彻底消除图标与扫描盘错位）。
  // 使用 DOM overlay 也避免了 L7 2.29 内置 radar shader 在部分显卡上不出图的问题。
  const radarLayer = createRadarScanOverlay(scene, radarPoints, {
    iconFor: point => warpedImages[point.online ? 'monitor-radar-on' : 'monitor-radar-off'],
    iconSize: 14,
  })

  // 无人机图标层（size 7 ≈ 14px 直径，与雷达 DOM 中心图标同大；不显示名称文字）
  const iconLayer = new PointLayer({
    zIndex: 22,
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
    radarLayer,
    setData(nextPoints) {
      const nextWithIcons = nextPoints.map(point => {
        const prefix = point.type === 'radar' ? 'monitor-radar' : 'monitor-drone'
        const suffix = point.online ? 'on' : 'off'
        return { ...point, iconName: `${prefix}-${suffix}` }
      })
      iconLayer.setData(nextWithIcons.filter(point => point.type === 'drone'), { parser: { type: 'json', x: 'lng', y: 'lat' } })
      radarLayer.setData(nextWithIcons.filter(point => point.type === 'radar'))
    },
    destroy() {
      radarLayer.destroy()
    },
  }
}

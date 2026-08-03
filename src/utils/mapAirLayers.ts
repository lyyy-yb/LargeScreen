import { PointLayer, type ILayer, type Scene } from '@antv/l7'
import type { AirQualityPoint } from '@/types/airData'
import { AQI_LEVEL_ICON, resolveAqiLevelKey } from './airQuality'

export interface AirMapLayers {
  iconLayer: ILayer
  labelLayer: ILayer
  setData: (points: AirQualityPoint[]) => void
}

/** 为每个打点附加六级图标名与数值文本（优先用后端 aqiLevel 文本定图标） */
function decorate(points: AirQualityPoint[]) {
  return points.map(point => ({
    ...point,
    iconName: `aq-${resolveAqiLevelKey(point.aqiLevel, point.iaqi)}`,
    valueText: point.value != null && Number.isFinite(point.value)
      ? String(Math.round(point.value * 10) / 10)
      : '--',
  }))
}

/**
 * 创建空气质量打点图层：按 IAQI 六级显示对应图标（aq-good ~ aq-severe），
 * 图标上方叠加数值文本。与空气质量监测站图例一一对应。
 * @param onPointClick 点击图标回调（返回该点数据，用于展示站点详情）
 */
export async function createAirQualityLayers(
  scene: Scene,
  points: AirQualityPoint[],
  raisingHeight = 0,
  onPointClick?: (point: AirQualityPoint) => void,
): Promise<AirMapLayers> {
  // 注册六级 AQI 图标
  await Promise.all(
    Object.entries(AQI_LEVEL_ICON).map(([level, url]) =>
      scene.hasImage(`aq-${level}`) ? Promise.resolve() : scene.addImage(`aq-${level}`, url),
    ),
  )

  const data = decorate(points)

  // 六级图标层（开启拾取，点击弹出站点详情）
  const iconLayer = new PointLayer({
    zIndex: 30,
    name: 'air-quality-icon-layer',
  })
    .source(data, { parser: { type: 'json', x: 'lng', y: 'lat' } })
    .shape('iconName', (iconName: string) => iconName)
    .size(16)
    .style({ raisingHeight, heightfixed: true })
  scene.addLayer(iconLayer)
  if (onPointClick) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    iconLayer.on('click', (e: any) => {
      const props = e?.feature
      if (props?.name) onPointClick(props as AirQualityPoint)
    })
  }

  // 数值文本层（图标上方）
  const labelLayer = new PointLayer({
    zIndex: 31,
    name: 'air-quality-label-layer',
    enablePicking: false,
    enablePropagation: false,
  })
    .source(data, { parser: { type: 'json', x: 'lng', y: 'lat' } })
    .shape('valueText', 'text')
    .size(11)
    .color('#e8fcff')
    .style({
      raisingHeight,
      heightfixed: true,
      textOffset: [0, -15],
      textAnchor: 'center',
      textAllowOverlap: true,
      padding: [3, 3],
      stroke: '#063d72',
      strokeWidth: 2,
    })
  scene.addLayer(labelLayer)

  return {
    iconLayer,
    labelLayer,
    setData(nextPoints) {
      const nextData = decorate(nextPoints)
      iconLayer.setData(nextData, { parser: { type: 'json', x: 'lng', y: 'lat' } })
      labelLayer.setData(nextData, { parser: { type: 'json', x: 'lng', y: 'lat' } })
    },
  }
}

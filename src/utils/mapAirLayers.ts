import { PointLayer, type ILayer, type Scene } from '@antv/l7'
// Popup 未从 @antv/l7 主入口的 ES 模块导出，需从子包引入
import { Popup } from '@antv/l7-component'
import type { AirQualityPoint } from '@/types/airData'
import { AQI_LEVEL_ICON, resolveAqiLevelKey } from './airQuality'

export interface AirMapLayers {
  iconLayer: ILayer
  setData: (points: AirQualityPoint[]) => void
}

/** 无空气质量数据的微站图标名与图片 */
const AQ_NONE_ICON_NAME = 'aq-none'
const AQ_NONE_ICON_URL = '/marker/aq-none.png'

/** 判断打点是否具备空气质量数据（无数据时展示占位图标且不弹详情） */
export function hasAirQualityData(point: AirQualityPoint): boolean {
  return point.aqiLevel != null && point.aqiLevel !== ''
}

/** 为每个打点附加六级图标名（优先用后端 aqiLevel 文本定图标；无空气质量数据用占位图标） */
function decorate(points: AirQualityPoint[]) {
  return points.map(point => ({
    ...point,
    iconName: hasAirQualityData(point)
      ? `aq-${resolveAqiLevelKey(point.aqiLevel, point.iaqi)}`
      : AQ_NONE_ICON_NAME,
  }))
}

/** 构建点击详情弹窗 HTML（L7 Popup 内容：综合 AQI + 各污染物分指数 IAQI） */
function buildPopupHTML(point: AirQualityPoint): string {
  const fmt = (v: number | null | undefined) => (v != null && Number.isFinite(Number(v)) ? String(Math.round(Number(v) * 10) / 10) : '--')
  const cells = ([
    ['PM2.5', point.pm25Iaqi], ['PM10', point.pm10Iaqi], ['SO₂', point.so2Iaqi],
    ['NO₂', point.no2Iaqi], ['CO', point.coIaqi], ['O₃', point.o3Iaqi],
  ] as [string, number | null | undefined][])
    .map(([label, v]) => `<div class="air-detail-cell"><div class="air-detail-value">${fmt(v)}</div><div class="air-detail-field">${label}</div></div>`)
    .join('')
  return `
    <div class="air-detail-popup">
      <div class="air-detail-title">${point.name} 监测详情</div>
      <div class="air-detail-aqi">
        <span class="air-detail-aqi-label">综合 AQI</span>
        <span class="air-detail-aqi-value">${fmt(point.value)}</span>
        ${point.aqiLevel ? `<span class="air-detail-aqi-badge">${point.aqiLevel}</span>` : ''}
      </div>
      <div class="air-detail-grid">${cells}</div>
    </div>`
}

/**
 * 创建空气质量打点图层：按 IAQI 六级显示对应图标（aq-good ~ aq-severe）。
 * 点击图标在该点上方弹出 L7 Popup 展示各项 IAQI 详情。
 * @param onPointClick 点击图标额外回调（可选）
 */
export async function createAirQualityLayers(
  scene: Scene,
  points: AirQualityPoint[],
  raisingHeight = 0,
  onPointClick?: (point: AirQualityPoint) => void,
): Promise<AirMapLayers> {
  // 注册六级 AQI 图标与无数据占位图标：直接使用设计原始切图，不做透视/光晕等立体加工
  const iconEntries: [string, string][] = [
    ...Object.entries(AQI_LEVEL_ICON).map(([level, url]) => [`aq-${level}`, url] as [string, string]),
    [AQ_NONE_ICON_NAME, AQ_NONE_ICON_URL],
  ]
  iconEntries.forEach(([name, url]) => {
    if (scene.hasImage(name)) return
    scene.addImage(name, url)
  })

  const data = decorate(points)

  // 六级图标层（开启拾取，点击弹出站点详情）
  const iconLayer = new PointLayer({
    zIndex: 30,
    name: 'air-quality-icon-layer',
  })
    .source(data, { parser: { type: 'json', x: 'lng', y: 'lat' } })
    .shape('iconName', (iconName: string) => iconName)
    // L7 image 点 size 为半径（渲染直径≈2n），10 ≈ 20px；depth: false 关闭深度测试，
    // 配合调用方传入的 raisingHeight（高于纹理顶面）保证图标不被纹理面遮挡
    .size(10)
    .style({ raisingHeight, heightfixed: true, depth: false })
  scene.addLayer(iconLayer)

  // 点击详情弹窗（L7 Popup，自动锚定在对应图标上方并随地图移动）
  let detailPopup: Popup | null = null
  const ensurePopup = () => {
    if (!detailPopup) {
      detailPopup = new Popup({
        offsets: [0, -26],
        closeButton: true,
        closeOnClick: false,
        className: 'air-quality-popup',
        maxWidth: '340px',
      })
      scene.addPopup(detailPopup)
    }
    return detailPopup
  }
  iconLayer.on('click', (e: any) => {
    const props = e?.feature
    if (!props?.name) return
    // 无空气质量数据的微站仅占位展示，不弹详情弹窗
    if (!hasAirQualityData(props as AirQualityPoint)) return
    onPointClick?.(props as AirQualityPoint)
    const popup = ensurePopup()
    popup.setLnglat([props.lng, props.lat])
    popup.setHTML(buildPopupHTML(props as AirQualityPoint))
    popup.show()
  })

  return {
    iconLayer,
    setData(nextPoints) {
      const nextData = decorate(nextPoints)
      iconLayer.setData(nextData, { parser: { type: 'json', x: 'lng', y: 'lat' } })
    },
  }
}

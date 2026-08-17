import { useEffect, useRef, useState } from 'react'
import { LineLayer, PointLayer, PolygonLayer, Scene } from '@antv/l7'
import { Mapbox } from '@antv/l7-maps'
import type { DistrictItem } from '@/utils/city'
import type { MapDevicePoint } from '@/types/mapDevice'
import type { AirQualityPoint } from '@/types/airData'
import { createDeviceMapLayers, type DeviceMapLayers } from '@/utils/mapDeviceLayers'
import { createAirQualityLayers, type AirMapLayers, type AirPointClickPos } from '@/utils/mapAirLayers'
import { createAlertLayers, type AlertMapLayers, type AlertMapPoint } from '@/utils/mapAlertLayers'
import { createRadarAlarmLayers, type RadarAlarmLayers, type RadarAlarmPoint } from '@/utils/mapRadarAlarmLayers'
import { createEmissionOutletLayers, type EmissionOutletLayers, type EmissionOutletPoint, type OutletPointClickPos } from '@/utils/mapEmissionOutletLayers'
import { addSatelliteTiles } from '@/utils/mapSatelliteTiles'
import { addRegionMask, setRegionBounds } from '@/utils/mapRegionMask'
import { useLayerVisibility } from '@/hooks/useLayerVisibility'

interface CountyBoundaryMapProps {
  county: DistrictItem
  devicePoints?: MapDevicePoint[]
  airPoints?: AirQualityPoint[]
  /** 预警点位（alertEvent/list 经纬度），与 airPoints 由页面按钮组切换显示 */
  alertPoints?: AlertMapPoint[]
  /** 雷达突发告警点（hbdp/leida/alarmPoint，常显） */
  radarAlarmPoints?: RadarAlarmPoint[]
  /** 企业排口打点（hbdp/emissionOutlet/list，灰点，zoom>=13 图标 / >=15 两行文字） */
  emissionOutletPoints?: EmissionOutletPoint[]
  /** 点击企业排口圆点，弹出详情弹窗 */
  onOutletClick?: (point: EmissionOutletPoint, pos?: OutletPointClickPos) => void
  onAirPointClick?: (point: AirQualityPoint, pos?: AirPointClickPos) => void
  /** 显示预警点位（与空气质量互斥，由页面按钮组保证同刻只显一类），默认 false */
  showAlertPoints?: boolean
  /** 显示空气质量检测站，默认 true（页面互斥按钮组初始态为空气） */
  showAirPoints?: boolean
  /** 显示无人机图标层，默认 true */
  showDronePoints?: boolean
  /** 显示雷达（扫描盘 + 突发告警点），默认 true */
  showRadarPoints?: boolean
}

interface GeoFeature {
  type: 'Feature'
  properties?: Record<string, unknown>
  geometry?: { coordinates?: unknown }
}

interface GeoCollection {
  type: 'FeatureCollection'
  features: GeoFeature[]
}

// 平面地图风格：区县不抬高、无拉伸/边墙，仅平面边界线勾勒轮廓，卫星底图直接透出

function collection(features: GeoFeature[]): GeoCollection {
  return { type: 'FeatureCollection', features }
}

export default function CountyBoundaryMap({
  county,
  devicePoints = [],
  airPoints = [],
  alertPoints = [],
  radarAlarmPoints = [],
  emissionOutletPoints = [],
  onOutletClick,
  onAirPointClick,
  showAlertPoints = false,
  showAirPoints = true,
  showDronePoints = true,
  showRadarPoints = true,
}: CountyBoundaryMapProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const [ready, setReady] = useState(false)
  const [loadError, setLoadError] = useState('')
  const deviceLayersRef = useRef<DeviceMapLayers | null>(null)
  const devicePointsRef = useRef(devicePoints)
  const airLayersRef = useRef<AirMapLayers | null>(null)
  const airPointsRef = useRef(airPoints)
  const alertLayersRef = useRef<AlertMapLayers | null>(null)
  const alertPointsRef = useRef(alertPoints)
  const radarAlarmLayersRef = useRef<RadarAlarmLayers | null>(null)
  const radarAlarmPointsRef = useRef(radarAlarmPoints)
  const emissionOutletPointsRef = useRef(emissionOutletPoints)
  const emissionOutletLayersRef = useRef<EmissionOutletLayers | null>(null)
  const onAirPointClickRef = useRef(onAirPointClick)
  const onOutletClickRef = useRef(onOutletClick)

  useEffect(() => {
    onAirPointClickRef.current = onAirPointClick
  }, [onAirPointClick])

  useEffect(() => {
    onOutletClickRef.current = onOutletClick
  }, [onOutletClick])

  useEffect(() => {
    devicePointsRef.current = devicePoints
    deviceLayersRef.current?.setData(devicePoints)
  }, [devicePoints])

  useEffect(() => {
    airPointsRef.current = airPoints
    airLayersRef.current?.setData(airPoints)
  }, [airPoints])

  useEffect(() => {
    alertPointsRef.current = alertPoints
    alertLayersRef.current?.setData(alertPoints)
  }, [alertPoints])

  useEffect(() => {
    radarAlarmPointsRef.current = radarAlarmPoints
    radarAlarmLayersRef.current?.setData(radarAlarmPoints)
  }, [radarAlarmPoints])

  useEffect(() => {
    emissionOutletPointsRef.current = emissionOutletPoints
    emissionOutletLayersRef.current?.setData(emissionOutletPoints)
  }, [emissionOutletPoints])

  // 页面按钮组/Switch → 图层显隐（持久层 show/hide，不销毁重建）
  useLayerVisibility(
    { alertLayersRef, airLayersRef, deviceLayersRef, radarAlarmLayersRef },
    { showAlertPoints, showAirPoints, showDronePoints, showRadarPoints },
    ready,
  )

  useEffect(() => {
    if (!containerRef.current) return
    setReady(false)
    setLoadError('')

    const scene = new Scene({
      id: containerRef.current,
      logoVisible: false,
      map: new Mapbox({
        style: 'blank',
        center: [county.lng, county.lat],
        zoom: 9.5,
        minZoom: 8.8,
        maxZoom: 17,
        pitch: 42,
        rotation: 0,
      }),
    })

    scene.setBgColor('rgba(9, 54, 114, 0.5)')
    scene.on('loaded', async () => {
      scene.setMapStatus({
        dragEnable: true,
        zoomEnable: true,
        rotateEnable: false,
        doubleClickZoom: false,
      })

      // 卫星影像底图（与 radar 页同源）
      addSatelliteTiles(scene)

      try {
        let countyData: GeoCollection
        if (county.name === '智造新城' || String(county.adcode) === '330899' || county.name.includes('智造新城')) {
          countyData = await fetch('/map/zhizao_newcity.json').then(response => {
            if (!response.ok) throw new Error(`智造新城边界加载失败 (${response.status})`)
            return response.json() as Promise<GeoCollection>
          })
        } else {
          const cityDistricts = await fetch(`/map/${county.parent}_full.json`).then(response => {
            if (!response.ok) throw new Error(`区县边界加载失败 (${response.status})`)
            return response.json() as Promise<GeoCollection>
          })

          const countyFeature = cityDistricts.features.find(
            feature => String(feature.properties?.adcode) === String(county.adcode),
          )
          if (!countyFeature) throw new Error(`未找到 ${county.name} 的区县边界`)

          countyData = collection([countyFeature])
        }

        // 区县级：仅显示区县边界
        // 区县外蒙层 + 限制拖拽范围（与省级同方案）
        addRegionMask(scene, countyData)
        setRegionBounds(scene, countyData)

        // 平面区域底：近全透明填充直接透出卫星底图（仅承担区域衬托，不再拉伸抬高）
        const countyBase = new PolygonLayer({ zIndex: 1, autoFit: true })
          .source(countyData)
          .shape('fill')
          .color('#2f8cdd')
          .style({ opacity: 0.06 })
        scene.addLayer(countyBase)

        // 区县界亮轮廓（平面边界：天蓝实线，不再使用有高度的边墙）
        const countyBoundLine = new LineLayer({ zIndex: 7, enablePicking: false })
          .source(countyData)
          .shape('line')
          .color('#3fc6ff')
          .size(2.2)
          .style({ opacity: 1 })
        scene.addLayer(countyBoundLine)

        // 区域名称文本标签
        const featureProps = countyData.features[0]?.properties
        const labelCenter: [number, number] =
          (Array.isArray(featureProps?.center) && featureProps.center.length === 2 && (featureProps.center as [number, number])) ||
          (Array.isArray(featureProps?.centroid) && featureProps.centroid.length === 2 && (featureProps.centroid as [number, number])) ||
          [county.lng, county.lat]

        const textLayer = new PointLayer({ zIndex: 12, enablePicking: false })
          .source([{ name: county.name, lng: labelCenter[0], lat: labelCenter[1] }], {
            parser: { type: 'json', x: 'lng', y: 'lat' },
          })
          .shape('name', 'text')
          .size(15)
          .color('#dffbff')
          .style({
            textAnchor: 'center',
            stroke: '#082548',
            strokeWidth: 3.5,
            raisingHeight: 0,
            textAllowOverlap: true,
            heightFixed: true,
          })
        scene.addLayer(textLayer)

        deviceLayersRef.current = await createDeviceMapLayers(scene, devicePointsRef.current, 0)
        airLayersRef.current = await createAirQualityLayers(
          scene,
          airPointsRef.current,
          0,
          (point, pos) => onAirPointClickRef.current?.(point, pos),
        )
        // 预警点位标记（alertEvent/list 经纬度，warn-l1~l3 图标，与空气质量打点切换显示）
        alertLayersRef.current = await createAlertLayers(scene, alertPointsRef.current, 0)
        // 雷达突发告警点（hbdp/leida/alarmPoint，橙/红圆点常显）
        radarAlarmLayersRef.current = await createRadarAlarmLayers(scene, radarAlarmPointsRef.current, 0)

        // 企业排口打点（hbdp/emissionOutlet/list，灰色圆点，zoom>=13 图标 / >=15 两行文字）
        emissionOutletLayersRef.current = await createEmissionOutletLayers(
          scene,
          emissionOutletPointsRef.current,
          0,
          (point, pos) => onOutletClickRef.current?.(point, pos),
        )
        setReady(true)
      } catch (error) {
        console.error('CountyBoundaryMap: 加载本地区县图层失败', error)
        setLoadError(error instanceof Error ? error.message : '地图图层加载失败')
      }
    })

    return () => {
      deviceLayersRef.current?.destroy()
      alertLayersRef.current?.destroy()
      radarAlarmLayersRef.current?.destroy()
      emissionOutletLayersRef.current?.destroy()
      deviceLayersRef.current = null
      airLayersRef.current = null
      alertLayersRef.current = null
      radarAlarmLayersRef.current = null
      emissionOutletLayersRef.current = null
      scene.destroy()
    }
  }, [county])

  return (
    <div className="relative w-full h-full">
      <div ref={containerRef} className="w-full h-full" />
      {!ready && (
        <div className="absolute inset-0 flex items-center justify-center bg-[rgba(21,94,169,0.82)] text-[#dffbff] text-13px">
          {loadError || `正在加载${county.name}地图...`}
        </div>
      )}
    </div>
  )
}

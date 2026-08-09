import { useEffect, useRef, useState } from 'react'
import { LineLayer, PolygonLayer, Scene } from '@antv/l7'
import { Mapbox } from '@antv/l7-maps'
import type { DistrictItem } from '@/utils/city'
import type { MapDevicePoint } from '@/types/mapDevice'
import type { AirQualityPoint } from '@/types/airData'
import { createDeviceMapLayers, type DeviceMapLayers } from '@/utils/mapDeviceLayers'
import { createAirQualityLayers, type AirMapLayers, type AirPointClickPos } from '@/utils/mapAirLayers'
import { createAlertLayers, type AlertMapLayers, type AlertMapPoint } from '@/utils/mapAlertLayers'
import { createRadarAlarmLayers, type RadarAlarmLayers, type RadarAlarmPoint } from '@/utils/mapRadarAlarmLayers'
import { addSatelliteTiles } from '@/utils/mapSatelliteTiles'
import { addRegionMask, setRegionBounds } from '@/utils/mapRegionMask'

interface CountyBoundaryMapProps {
  county: DistrictItem
  devicePoints?: MapDevicePoint[]
  airPoints?: AirQualityPoint[]
  /** 预警点位（alertEvent/list 经纬度），与 airPoints 由页面按钮组切换显示 */
  alertPoints?: AlertMapPoint[]
  /** 雷达突发告警点（hbdp/leida/alarmPoint，常显） */
  radarAlarmPoints?: RadarAlarmPoint[]
  onAirPointClick?: (point: AirQualityPoint, pos?: AirPointClickPos) => void
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

// 漂浮地图风格（L7 floatmap 示例）：区县近景使用轻量高度；城市级的数万米高度在 12+ 级缩放下会形成遮挡视野的高柱。
const COUNTY_TOP = 450 // 区块厚度
const FLOAT_BASE = 150 // 区块抬离地面高度（缩小与底图间距）
const MARKER_TOP = 2400

function collection(features: GeoFeature[]): GeoCollection {
  return { type: 'FeatureCollection', features }
}

export default function CountyBoundaryMap({
  county,
  devicePoints = [],
  airPoints = [],
  alertPoints = [],
  radarAlarmPoints = [],
  onAirPointClick,
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
  const onAirPointClickRef = useRef(onAirPointClick)

  useEffect(() => {
    onAirPointClickRef.current = onAirPointClick
  }, [onAirPointClick])

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
        maxZoom: 15,
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
        const cityDistricts = await fetch(`/map/${county.parent}_full.json`).then(response => {
          if (!response.ok) throw new Error(`区县边界加载失败 (${response.status})`)
          return response.json() as Promise<GeoCollection>
        })

        const countyFeature = cityDistricts.features.find(
          feature => String(feature.properties?.adcode) === String(county.adcode),
        )
        if (!countyFeature) throw new Error(`未找到 ${county.name} 的区县边界`)

        const countyData = collection([countyFeature])

        // 区县级：仅显示区县边界
        // 区县外蒙层 + 限制拖拽范围（与省级同方案）
        addRegionMask(scene, countyData)
        setRegionBounds(scene, countyData)

        const countyBase = new PolygonLayer({ zIndex: 1, autoFit: true })
          .source(countyData)
          .shape('extrude')
          .size(COUNTY_TOP)
          .color('#2f8cdd')
          .style({
            heightfixed: true,
            pickLight: true,
            raisingHeight: FLOAT_BASE,
            opacity: 0.06,
            // 侧面统一淡蓝（与边界线 #3fc6ff 同色系），替代原深蓝渐变
            sourceColor: '#8fdcff',
            targetColor: '#3fc6ff',
          })
        scene.addLayer(countyBase)

        // 边墙（淡蓝实心光墙，与省/市级同方案）
        const countyWall = new LineLayer({ zIndex: 2, enablePicking: false })
          .source(countyData)
          .shape('wall')
          .size(2200)
          .style({
            heightfixed: true,
            opacity: 0.45,
            sourceColor: '#3fc6ff',
            targetColor: '#3fc6ff',
          })
        scene.addLayer(countyWall)

        // 顶面不铺纹理，直接使用纯色拉伸面（与省/市/区县统一）

        // 区县界亮轮廓（外侧边界：天蓝实线，高度高于边墙避免角度遮挡）
        const countyBoundLine = new LineLayer({ zIndex: 7, enablePicking: false })
          .source(countyData)
          .shape('line')
          .color('#3fc6ff')
          .size(2.2)
          .style({ raisingHeight: 3500, heightfixed: true, opacity: 1, depth: false })
        scene.addLayer(countyBoundLine)

        deviceLayersRef.current = await createDeviceMapLayers(scene, devicePointsRef.current, MARKER_TOP)
        airLayersRef.current = await createAirQualityLayers(
          scene,
          airPointsRef.current,
          MARKER_TOP,
          (point, pos) => onAirPointClickRef.current?.(point, pos),
        )
        // 预警点位标记（alertEvent/list 经纬度，warn-l1~l3 图标，与空气质量打点切换显示）
        alertLayersRef.current = await createAlertLayers(scene, alertPointsRef.current, MARKER_TOP)
        // 雷达突发告警点（hbdp/leida/alarmPoint，橙/红圆点常显）
        radarAlarmLayersRef.current = await createRadarAlarmLayers(scene, radarAlarmPointsRef.current, MARKER_TOP + 1200)
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
      deviceLayersRef.current = null
      airLayersRef.current = null
      alertLayersRef.current = null
      radarAlarmLayersRef.current = null
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

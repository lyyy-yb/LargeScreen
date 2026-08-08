import { useEffect, useRef, useState } from 'react'
import { LineLayer, PointLayer, PolygonLayer, Scene } from '@antv/l7'
import { Mapbox } from '@antv/l7-maps'
import type { DistrictItem } from '@/utils/city'
import type { MapDevicePoint } from '@/types/mapDevice'
import type { AirQualityPoint } from '@/types/airData'
import { createDeviceMapLayers, type DeviceMapLayers } from '@/utils/mapDeviceLayers'
import { createAirQualityLayers, type AirMapLayers } from '@/utils/mapAirLayers'
import { createAlertLayers, type AlertMapLayers, type AlertMapPoint } from '@/utils/mapAlertLayers'
import { createRadarAlarmLayers, type RadarAlarmLayers, type RadarAlarmPoint } from '@/utils/mapRadarAlarmLayers'
import { addSatelliteTiles } from '@/utils/mapSatelliteTiles'
import { addRegionMask, setRegionBounds } from '@/utils/mapRegionMask'

interface CountyBoundaryMapProps {
  county: DistrictItem
  townName?: string
  devicePoints?: MapDevicePoint[]
  airPoints?: AirQualityPoint[]
  /** 预警点位（alertEvent/list 经纬度），与 airPoints 由页面按钮组切换显示 */
  alertPoints?: AlertMapPoint[]
  /** 雷达突发告警点（hbdp/leida/alarmPoint，常显） */
  radarAlarmPoints?: RadarAlarmPoint[]
  onAirPointClick?: (point: AirQualityPoint) => void
  onTownClick?: (townName: string) => void
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

// 漂浮地图风格（L7 floatmap 示例）：区县/街道近景使用轻量高度；城市级的数万米高度在 12+ 级缩放下会形成遮挡视野的高柱。
const COUNTY_TOP = 450 // 区块厚度
const FLOAT_BASE = 150 // 区块抬离地面高度（缩小与底图间距）
const BLOCK_TOP = FLOAT_BASE + COUNTY_TOP // 区块顶面高度
const MARKER_TOP = 2400

function featureName(feature: GeoFeature) {
  return String(feature.properties?.Name ?? feature.properties?.name ?? feature.properties?.NAME ?? '')
}

function normalizeTownName(name: string) {
  return name.replace(/街道办事处|人民政府|\s/g, '')
}

function featureCenter(feature: GeoFeature): [number, number] {
  let minLng = Number.POSITIVE_INFINITY
  let maxLng = Number.NEGATIVE_INFINITY
  let minLat = Number.POSITIVE_INFINITY
  let maxLat = Number.NEGATIVE_INFINITY

  const visit = (value: unknown) => {
    if (!Array.isArray(value)) return
    if (value.length >= 2 && typeof value[0] === 'number' && typeof value[1] === 'number') {
      minLng = Math.min(minLng, value[0])
      maxLng = Math.max(maxLng, value[0])
      minLat = Math.min(minLat, value[1])
      maxLat = Math.max(maxLat, value[1])
      return
    }
    value.forEach(visit)
  }
  visit(feature.geometry?.coordinates)
  return Number.isFinite(minLng)
    ? [(minLng + maxLng) / 2, (minLat + maxLat) / 2]
    : [0, 0]
}

function collection(features: GeoFeature[]): GeoCollection {
  return { type: 'FeatureCollection', features }
}

export default function CountyBoundaryMap({
  county,
  townName,
  devicePoints = [],
  airPoints = [],
  alertPoints = [],
  radarAlarmPoints = [],
  onAirPointClick,
  onTownClick,
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

  const onTownClickRef = useRef(onTownClick)
  useEffect(() => {
    onTownClickRef.current = onTownClick
  }, [onTownClick])

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
        zoom: townName ? 11.8 : 9.5,
        minZoom: townName ? 10.5 : 8.8,
        maxZoom: 15,
        pitch: townName ? 36 : 42,
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
        const [cityDistricts, allTowns] = await Promise.all([
          fetch(`/map/${county.parent}_full.json`).then(response => {
            if (!response.ok) throw new Error(`区县边界加载失败 (${response.status})`)
            return response.json() as Promise<GeoCollection>
          }),
          fetch('/map/zhejiang_towns.json').then(response => {
            if (!response.ok) throw new Error(`乡镇边界加载失败 (${response.status})`)
            return response.json() as Promise<GeoCollection>
          }),
        ])

        const countyFeature = cityDistricts.features.find(
          feature => String(feature.properties?.adcode) === String(county.adcode),
        )
        if (!countyFeature) throw new Error(`未找到 ${county.name} 的区县边界`)

        const countyCode = String(county.adcode)
        const townFeatures = allTowns.features.filter(feature =>
          String(feature.properties?.code ?? '').startsWith(countyCode),
        )
        const wantedTown = normalizeTownName(townName ?? '')
        const selectedTown = townName
          ? townFeatures.find(feature => normalizeTownName(featureName(feature)) === wantedTown)
            ?? townFeatures.find(feature => normalizeTownName(featureName(feature)).includes(wantedTown))
          : undefined
        const countyData = collection([countyFeature])
        const townData = collection(townFeatures)

        if (containerRef.current) {
          containerRef.current.dataset.townFeatureCount = String(townFeatures.length)
          containerRef.current.dataset.selectedTown = selectedTown ? featureName(selectedTown) : ''
        }

        if (selectedTown) {
          // 乡镇级：只显示当前乡镇（漂浮区块+光幕+选中边界），不叠加其他乡镇/区县边界
          const townOnly = collection([selectedTown])
          const [townLng, townLat] = featureCenter(selectedTown)

          // 乡镇外蒙层 + 限制拖拽范围（与省级同方案）
          addRegionMask(scene, townOnly)
          setRegionBounds(scene, townOnly)

          const townBase = new PolygonLayer({ zIndex: 1, autoFit: true, enablePicking: false })
            .source(townOnly)
            .shape('extrude')
            .size(COUNTY_TOP)
            .color('#3492e2')
            .style({
              heightfixed: true,
              pickLight: true,
              raisingHeight: FLOAT_BASE,
              opacity: 0.06,
              sourceColor: '#4fb8f0',
              targetColor: '#0a4a8a',
            })
          scene.addLayer(townBase)

          // 边墙（淡蓝实心光墙，与省/市级同方案）
          const townWall = new LineLayer({ zIndex: 2, enablePicking: false })
            .source(townOnly)
            .shape('wall')
            .size(2200)
            .style({
              heightfixed: true,
              opacity: 0.45,
              sourceColor: '#3fc6ff',
              targetColor: '#3fc6ff',
            })
          scene.addLayer(townWall)

          // 选中乡镇边界：高亮核心描边 + 流动蚂蚁线（高度高于边墙，depth:false 防角度遮挡）
          const townOutline = new LineLayer({ zIndex: 10, enablePicking: false })
            .source(townOnly)
            .shape('line')
            .color('#bffbff')
            .size(2.5)
            .style({ raisingHeight: 4200, heightfixed: true, opacity: 1, depth: false })
          scene.addLayer(townOutline)

          const townDash = new LineLayer({ zIndex: 11, enablePicking: false })
            .source(townOnly)
            .shape('line')
            .color('#7ff6ff')
            .size(1.2)
            .style({ raisingHeight: 4200, heightfixed: true, opacity: 0.9, depth: false, dashArray: [4, 3] })
          townDash.animate(true)
          scene.addLayer(townDash)

          const townLabel = new PointLayer({ zIndex: 12, enablePicking: false })
            .source([{ name: featureName(selectedTown), lng: townLng, lat: townLat }], { parser: { type: 'json', x: 'lng', y: 'lat' } })
            .shape('name', 'text')
            .size(11)
            .color('#eafcff')
            .style({
              textAnchor: 'center',
              stroke: '#021a3f',
              strokeWidth: 3,
              raisingHeight: BLOCK_TOP + 1000,
              textAllowOverlap: false,
              heightFixed: true,
            })
          scene.addLayer(townLabel)

          scene.setZoomAndCenter(12.7, [townLng, townLat])
        } else {
          // 区县级：显示区县+乡镇两级边界，只能选中乡镇
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
              sourceColor: '#4fb8f0',
              targetColor: '#0a4a8a',
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

          // 乡镇面仅用低透明度交替着色，边界线在其上完整呈现；点击选中乡镇
          if (townFeatures.length) {
            const townTint = new PolygonLayer({ zIndex: 3, autoFit: false })
              .source(townData)
              .shape('extrude')
              .size(180)
              .color('Name', ['#1a6fc0', '#0f4a8a', '#2283d2', '#155a9e'])
              .style({
                heightfixed: true,
                topsurface: true,
                sidesurface: false,
                raisingHeight: BLOCK_TOP,
                opacity: 0.06,
              })
            scene.addLayer(townTint)
            townTint.on('click', (e: any) => {
              const name = featureName(e.feature as GeoFeature)
              if (name) onTownClickRef.current?.(name)
            })

            // 乡镇界描边（内侧边界：天蓝）。与省/市级同方案：每乡镇一个单要素线图层，
            // 高度统一高于边墙，depth:false 按 zIndex 合成
            townFeatures.forEach(feature => {
              const townLine = new LineLayer({ zIndex: 5, enablePicking: false })
                .source(collection([feature]))
                .shape('line')
                .color('#3fc6ff')
                .size(2)
                .style({ raisingHeight: 3500, heightfixed: true, opacity: 1, depth: false })
              scene.addLayer(townLine)
            })

            const labels = townFeatures.map(feature => {
              const [lng, lat] = featureCenter(feature)
              return { name: featureName(feature), lng, lat }
            })
            const townLabels = new PointLayer({ zIndex: 12, enablePicking: false })
              .source(labels, { parser: { type: 'json', x: 'lng', y: 'lat' } })
              .shape('name', 'text')
              .size(10)
              .color('#eafcff')
              .style({
                textAnchor: 'center',
                stroke: '#021a3f',
                strokeWidth: 3,
                raisingHeight: BLOCK_TOP + 1000,
                textAllowOverlap: false,
                heightFixed: true,
              })
            scene.addLayer(townLabels)
          }

          // 区县界亮轮廓（外侧边界：天蓝实线，高度高于边墙避免角度遮挡）
          const countyBoundLine = new LineLayer({ zIndex: 7, enablePicking: false })
            .source(countyData)
            .shape('line')
            .color('#3fc6ff')
            .size(2.2)
            .style({ raisingHeight: 3500, heightfixed: true, opacity: 1, depth: false })
          scene.addLayer(countyBoundLine)
        }

        deviceLayersRef.current = await createDeviceMapLayers(scene, devicePointsRef.current, MARKER_TOP)
        airLayersRef.current = await createAirQualityLayers(
          scene,
          airPointsRef.current,
          MARKER_TOP,
          point => onAirPointClickRef.current?.(point),
        )
        // 预警点位标记（alertEvent/list 经纬度，warn-l1~l3 图标，与空气质量打点切换显示）
        alertLayersRef.current = await createAlertLayers(scene, alertPointsRef.current, MARKER_TOP)
        // 雷达突发告警点（hbdp/leida/alarmPoint，橙/红圆点常显）
        radarAlarmLayersRef.current = await createRadarAlarmLayers(scene, radarAlarmPointsRef.current, MARKER_TOP + 1200)
        setReady(true)
      } catch (error) {
        console.error('CountyBoundaryMap: 加载本地区县/乡镇图层失败', error)
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
  }, [county, townName])

  return (
    <div
      className="relative w-full h-full"
      data-map-scope={townName ? 'town' : 'county'}
      data-town-name={townName ?? ''}
    >
      <div ref={containerRef} className="w-full h-full" />
      {!ready && (
        <div className="absolute inset-0 flex items-center justify-center bg-[rgba(21,94,169,0.82)] text-[#dffbff] text-13px">
          {loadError || `正在加载${townName || county.name}地图...`}
        </div>
      )}
    </div>
  )
}

import { useEffect, useRef } from 'react'
import { Scene, PolygonLayer, LineLayer, PointLayer } from '@antv/l7'
import { Mapbox } from '@antv/l7-maps'
import type { MapDevicePoint } from '@/types/mapDevice'
import type { AirQualityPoint } from '@/types/airData'
import { createDeviceMapLayers, type DeviceMapLayers } from '@/utils/mapDeviceLayers'
import { createAirQualityLayers, type AirMapLayers } from '@/utils/mapAirLayers'
import { addWaterRippleSurface, WATER_TEXTURE_URL } from '@/utils/mapWaterRipple'

interface ZJ3DMapProps {
  id?: string
  selectedCity?: string
  onCityClick?: (cityName: string, adcode: number) => void
  onCityHover?: (cityName: string | null) => void
  devicePoints?: MapDevicePoint[]
  airPoints?: AirQualityPoint[]
  onAirPointClick?: (point: AirQualityPoint) => void
}

// 各市监测站点 mock 数据
const stationPoints = [
  { name: '杭州站', lng: 120.15, lat: 30.28 },
  { name: '宁波站', lng: 121.55, lat: 29.87 },
  { name: '温州站', lng: 120.70, lat: 28.00 },
  { name: '嘉兴站', lng: 120.76, lat: 30.77 },
  { name: '湖州站', lng: 120.09, lat: 30.89 },
  { name: '绍兴站', lng: 120.58, lat: 30.00 },
  { name: '金华站', lng: 119.65, lat: 29.08 },
  { name: '衢州站', lng: 118.87, lat: 28.97 },
  { name: '舟山站', lng: 122.11, lat: 30.04 },
  { name: '台州站', lng: 121.42, lat: 28.66 },
  { name: '丽水站', lng: 119.92, lat: 28.47 },
]

const alertPoints = [
  { name: '预警-临安', lng: 119.72, lat: 30.23, level: 1 },
  { name: '预警-余杭', lng: 120.10, lat: 30.30, level: 2 },
  { name: '预警-萧山', lng: 120.27, lat: 30.18, level: 1 },
  { name: '预警-桐庐', lng: 119.68, lat: 29.80, level: 3 },
]

// 立体高度分层：底图城市 -> 悬浮 -> 选中，逐级抬高做出立体感
const BASE_TOP = 50000 // 底图城市顶面高度
const HOVER_TOP = 64000 // 悬浮城市顶面高度
const SELECT_TOP = 84000 // 选中城市顶面高度
const TEXT_TOP = 90000 // 城市名标签高度（高于选中顶面，避免被遮挡）

export default function ZJ3DMap({
  id = 'zj3dmap',
  selectedCity,
  onCityClick,
  onCityHover,
  devicePoints = [],
  airPoints = [],
  onAirPointClick,
}: ZJ3DMapProps) {
  const sceneRef = useRef<Scene | null>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const cityFeaturesRef = useRef<any[]>([])
  const selectedCityRef = useRef(selectedCity)
  const hoverNameRef = useRef<string | null>(null)
  // 用 ref 保存回调，避免回调变化导致地图重新初始化（闪烁）
  const onCityClickRef = useRef(onCityClick)
  const onCityHoverRef = useRef(onCityHover)
  const devicePointsRef = useRef(devicePoints)
  const deviceLayersRef = useRef<DeviceMapLayers | null>(null)
  const airPointsRef = useRef(airPoints)
  const airLayersRef = useRef<AirMapLayers | null>(null)

  // 高亮图层引用（L7 链式构建返回 ILayer，统一用 any 持有）
  const selectedFillRef = useRef<any>(null)
  const selectedTextureRef = useRef<any>(null)
  const selectedOutlineRef = useRef<any>(null)
  const selectedGlowRef = useRef<any>(null)
  const hoverFillRef = useRef<any>(null)
  const hoverOutlineRef = useRef<any>(null)

  useEffect(() => {
    onCityClickRef.current = onCityClick
  }, [onCityClick])

  useEffect(() => {
    onCityHoverRef.current = onCityHover
  }, [onCityHover])

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

  // 仅更新某一个高亮图层的数据（传入 null 则清空）
  const setHighlight = (layer: any, name: string | null) => {
    const feature = name ? cityFeaturesRef.current.find(f => f.properties?.name === name) : null
    layer?.setData({
      type: 'FeatureCollection',
      features: feature ? [feature] : [],
    })
  }

  useEffect(() => {
    selectedCityRef.current = selectedCity
    // 选中变化：刷新选中高亮，并清掉可能与新选中重合的悬浮高亮
    const sel = selectedCity ?? null
    setHighlight(selectedFillRef.current, sel)
    setHighlight(selectedTextureRef.current, sel)
    setHighlight(selectedOutlineRef.current, sel)
    setHighlight(selectedGlowRef.current, sel)
    if (hoverNameRef.current && hoverNameRef.current !== sel) {
      setHighlight(hoverFillRef.current, hoverNameRef.current)
      setHighlight(hoverOutlineRef.current, hoverNameRef.current)
    } else {
      setHighlight(hoverFillRef.current, null)
      setHighlight(hoverOutlineRef.current, null)
    }
  }, [selectedCity])

  useEffect(() => {
    if (!containerRef.current || sceneRef.current) return

    const scene = new Scene({
      id: containerRef.current,
      logoVisible: false,
      map: new Mapbox({
        style: 'blank',
        center: [120.2, 29.3],
        zoom: 6.8,
        pitch: 45,
        rotation: -5,
        minZoom: 5,
        maxZoom: 10,
      }),
    })
    scene.setBgColor('rgba(5, 44, 96, 0.24)')
    sceneRef.current = scene

    scene.on('loaded', async () => {
      scene.setMapStatus({
        dragEnable: true,
        zoomEnable: true,
        rotateEnable: false,
        doubleClickZoom: false,
      })

      try {
        const [citiesRes, wallRes] = await Promise.all([
          fetch('/map/zhejiang_cities.json').then(r => r.json()),
          fetch('/map/zhejiang_wall.json').then(r => r.json()),
        ])
        cityFeaturesRef.current = citiesRes.features

        // 1. 省界发光围墙 (wall)
        const wallLayer = new LineLayer({ zIndex: 1 })
          .source(wallRes)
          .shape('wall')
          .size(80000)
          .style({ heightfixed: true, opacity: 0.7, sourceColor: '#43ADF1', targetColor: 'rgba(1,21,59,0)' })
        scene.addLayer(wallLayer)

        // 2. 3D 拉伸多边形 (extrude) —— 底图城市
        const polygonLayer = new PolygonLayer({ zIndex: 2, autoFit: false })
          .source(citiesRes)
          .shape('extrude')
          .size(BASE_TOP)
          .color('name', [
            '#1d6caf', '#195f9f', '#2276b7', '#1b65a5',
            '#267cbc', '#1a62a1', '#2372b2', '#206cab',
            '#287fbe', '#1c67a7', '#2577b7',
          ])
          .active({ color: '#43d9ff', mix: 0.45 })
          .select({ color: '#54e7ff', mix: 0.62 })
          .style({
            heightfixed: true,
            pickLight: true,
            raisingHeight: 0,
            opacity: 0.92,
            sourceColor: '#43ADF1',
            targetColor: '#01153B',
          })
        scene.addLayer(polygonLayer)

        // 2.5 水波纹表面层：在区域顶面铺一层青色同心涟漪纹理（光量子雷达圆形图的水纹效果）
        addWaterRippleSurface(scene, citiesRes, BASE_TOP, 3)

        // 3. 底部边界线（淡蓝）
        const lineDown = new LineLayer({ zIndex: 3 })
          .source(citiesRes)
          .shape('line')
          .color('#0DCCFF')
          .size(1)
          .style({ raisingHeight: 0, opacity: 0.8 })
        scene.addLayer(lineDown)

        // 4. 顶部边界线（淡蓝，略高于水面纹理层，任何角度都可见）
        const lineUp = new LineLayer({ zIndex: 4 })
          .source(citiesRes)
          .shape('line')
          .color('#0DCCFF')
          .size(1.5)
          .style({ raisingHeight: BASE_TOP + 1200, opacity: 1 })
        scene.addLayer(lineUp)

        // 5. 悬浮高亮（抬高到 HOVER_TOP，淡蓝描边 + 半透明填充，做出悬浮立体感）
        const hoverFill = new PolygonLayer({ zIndex: 5 })
          .source({ type: 'FeatureCollection', features: [] })
          .shape('extrude')
          .size(HOVER_TOP)
          .color('#3aa9ef')
          .style({
            heightfixed: true,
            pickLight: true,
            raisingHeight: 0,
            opacity: 0.5,
            sourceColor: '#43ADF1',
            targetColor: '#01153B',
          })
        scene.addLayer(hoverFill)
        hoverFillRef.current = hoverFill

        // 6. 选中高亮（抬高到 SELECT_TOP，仅侧面渐变，顶面由纹理层覆盖）
        const selectedFill = new PolygonLayer({ zIndex: 6 })
          .source({ type: 'FeatureCollection', features: [] })
          .shape('extrude')
          .size(SELECT_TOP)
          .color('#2ea0ec')
          .style({
            heightfixed: true,
            pickLight: true,
            raisingHeight: 0,
            opacity: 0.96,
            topsurface: false,
            sidesurface: true,
            sourceColor: '#43ADF1',
            targetColor: '#01153B',
          })
        scene.addLayer(selectedFill)
        selectedFillRef.current = selectedFill

        // 6.5 选中顶面纹理（与底图同款水面纹理，跟随选中区域抬高）
        const selectedTexture = new PolygonLayer({ zIndex: 7, enablePicking: false })
          .source({ type: 'FeatureCollection', features: [] })
          .shape('extrude')
          .size(SELECT_TOP + 500)
          .color('#5DDDFF')
          .style({
            mapTexture: WATER_TEXTURE_URL,
            topsurface: true,
            sidesurface: false,
            heightfixed: true,
            raisingHeight: 0,
            opacity: 0.55,
          })
        scene.addLayer(selectedTexture)
        selectedTextureRef.current = selectedTexture

        // 7. 悬浮描边（淡蓝，位于悬浮顶面，与悬浮块对齐避免视差偏差）
        const hoverOutline = new LineLayer({ zIndex: 8 })
          .source({ type: 'FeatureCollection', features: [] })
          .shape('line')
          .color('#bfe9ff')
          .size(3)
          .style({ raisingHeight: HOVER_TOP, opacity: 0.95 })
        scene.addLayer(hoverOutline)
        hoverOutlineRef.current = hoverOutline

        // 8. 选中描边（亮白青色细线，精致贴边）
        const selectedOutline = new LineLayer({ zIndex: 9 })
          .source({ type: 'FeatureCollection', features: [] })
          .shape('line')
          .color('#d9f4ff')
          .size(2.5)
          .style({ raisingHeight: SELECT_TOP + 1500, opacity: 0.95 })
        scene.addLayer(selectedOutline)
        selectedOutlineRef.current = selectedOutline

        // 8.5 选中光晕（淡蓝色宽描边，高透明度柔和外发光）
        const selectedGlow = new LineLayer({ zIndex: 8 })
          .source({ type: 'FeatureCollection', features: [] })
          .shape('line')
          .color('#4db8ff')
          .size(9)
          .style({ raisingHeight: SELECT_TOP + 1500, opacity: 0.08 })
        scene.addLayer(selectedGlow)
        selectedGlowRef.current = selectedGlow

        // 初始化选中描边（初次进入时 prop 已有选中城市）
        const initialSelected = citiesRes.features.find((feature: any) => feature.properties?.name === selectedCityRef.current)
        if (initialSelected) {
          selectedFillRef.current?.setData({ type: 'FeatureCollection', features: [initialSelected] })
          selectedTextureRef.current?.setData({ type: 'FeatureCollection', features: [initialSelected] })
          selectedOutlineRef.current?.setData({ type: 'FeatureCollection', features: [initialSelected] })
          selectedGlowRef.current?.setData({ type: 'FeatureCollection', features: [initialSelected] })
        }

        // 9. 城市名称文字 —— 使用正确的 center 字段（geojson 的 centroid 坐标有误，会导致标签偏移）
        const texts = citiesRes.features.map((f: any) => {
          const c = f.properties.center || f.properties.centroid || [120.2, 29.3]
          return {
            name: f.properties.name.replace('市', ''),
            lng: c[0],
            lat: c[1],
          }
        })
        const textLayer = new PointLayer({ zIndex: 10 })
          .source(texts, { parser: { type: 'json', x: 'lng', y: 'lat' } })
          .shape('name', 'text')
          .size(14)
          .color('#fff')
          .style({
            textAnchor: 'center',
            spacing: 2,
            padding: [2, 2],
            stroke: '#0DCCFF',
            strokeWidth: 0.3,
            raisingHeight: TEXT_TOP,
            textAllowOverlap: true,
            heightFixed: true,
          })
        scene.addLayer(textLayer)

        // 10. 监测站点标记
        const stationLayer = new PointLayer({ zIndex: 11 })
          .source(stationPoints, { parser: { type: 'json', x: 'lng', y: 'lat' } })
          .shape('circle')
          .size(8)
          .color('#00ff88')
          .style({ opacity: 0.9, strokeWidth: 1, stroke: '#fff' })
        scene.addLayer(stationLayer)

        // 11-12. 使用接口经纬度打印雷达扫描与无人机场图标（与老项目字段一致）
        deviceLayersRef.current = await createDeviceMapLayers(scene, devicePointsRef.current, TEXT_TOP + 2000)

        // 空气质量六级图标打点（按 IAQI 显示在各市中心）
        airLayersRef.current = await createAirQualityLayers(
          scene,
          airPointsRef.current,
          TEXT_TOP + 4000,
          point => onAirPointClickRef.current?.(point),
        )

        // 13. 预警点位标记
        const alertLayer = new PointLayer({ zIndex: 12 })
          .source(alertPoints, { parser: { type: 'json', x: 'lng', y: 'lat' } })
          .shape('triangle')
          .size(12)
          .color('level', (level: number) => (level === 1 ? '#FF4D4F' : level === 2 ? '#FA8C16' : '#FAAD14'))
          .style({ opacity: 0.95, strokeWidth: 1, stroke: '#fff' })
        scene.addLayer(alertLayer)

        // 14. 悬浮/点击交互 —— 选中做抬高立体高亮，悬浮做抬起高亮；描边高度与块顶面对齐，无偏差
        polygonLayer.on('mousemove', (e: any) => {
          const name = e.feature?.properties?.name
          if (!name) return
          onCityHoverRef.current?.(name)
          hoverNameRef.current = name
          if (name !== selectedCityRef.current) {
            setHighlight(hoverFillRef.current, name)
            setHighlight(hoverOutlineRef.current, name)
          } else {
            setHighlight(hoverFillRef.current, null)
            setHighlight(hoverOutlineRef.current, null)
          }
        })

        polygonLayer.on('unmousemove', () => {
          onCityHoverRef.current?.(null)
          hoverNameRef.current = null
          setHighlight(hoverFillRef.current, null)
          setHighlight(hoverOutlineRef.current, null)
        })

        polygonLayer.on('click', (e: any) => {
          const name = e.feature?.properties?.name
          const adcode = e.feature?.properties?.adcode
          if (name) onCityClickRef.current?.(name, adcode)
        })
      } catch (err) {
        console.error('ZJ3DMap: 加载地图数据失败', err)
      }
    })

    return () => {
      if (sceneRef.current) {
        sceneRef.current.destroy()
        sceneRef.current = null
      }
      selectedFillRef.current = null
      selectedTextureRef.current = null
      selectedOutlineRef.current = null
      selectedGlowRef.current = null
      hoverFillRef.current = null
      hoverOutlineRef.current = null
      deviceLayersRef.current = null
      airLayersRef.current = null
      cityFeaturesRef.current = []
    }
  }, [])

  return <div ref={containerRef} id={id} className="w-full h-full" />
}

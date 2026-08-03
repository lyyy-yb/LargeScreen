import { useEffect, useRef, useState } from 'react'
import { Scene, PolygonLayer, LineLayer, PointLayer } from '@antv/l7'
import { Mapbox } from '@antv/l7-maps'
import type { CityItem, DistrictItem } from '@/utils/city'
import type { MapDevicePoint } from '@/types/mapDevice'
import type { AirQualityPoint } from '@/types/airData'
import { createDeviceMapLayers, type DeviceMapLayers } from '@/utils/mapDeviceLayers'
import { createAirQualityLayers, type AirMapLayers } from '@/utils/mapAirLayers'
import { addWaterRippleSurface, WATER_TEXTURE_URL } from '@/utils/mapWaterRipple'

interface CityDistrictMapProps {
  city: CityItem
  districtItems: DistrictItem[]
  selectedDistrict?: string
  onDistrictClick?: (districtName: string, adcode: number) => void
  onDistrictHover?: (districtName: string | null) => void
  devicePoints?: MapDevicePoint[]
  airPoints?: AirQualityPoint[]
  onAirPointClick?: (point: AirQualityPoint) => void
}

// 立体高度分层：底图区县 -> 悬浮 -> 选中，逐级抬高做出立体感（与省级地图风格一致）
const BASE_TOP = 40000
const HOVER_TOP = 54000
const SELECT_TOP = 70000
const TEXT_TOP = 76000

export default function CityDistrictMap({
  city,
  districtItems,
  selectedDistrict,
  onDistrictClick,
  onDistrictHover,
  devicePoints = [],
  airPoints = [],
  onAirPointClick,
}: CityDistrictMapProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const sceneRef = useRef<Scene | null>(null)
  const districtFeaturesRef = useRef<any[]>([])
  const stationLayerRef = useRef<any>(null)
  const deviceLayersRef = useRef<DeviceMapLayers | null>(null)
  const devicePointsRef = useRef(devicePoints)
  const airLayersRef = useRef<AirMapLayers | null>(null)
  const airPointsRef = useRef(airPoints)
  const selectedDistrictRef = useRef(selectedDistrict)
  const hoverNameRef = useRef<string | null>(null)
  const onClickRef = useRef(onDistrictClick)
  const onHoverRef = useRef(onDistrictHover)
  const [ready, setReady] = useState(false)

  // 高亮图层引用
  const selectedFillRef = useRef<any>(null)
  const selectedTextureRef = useRef<any>(null)
  const selectedOutlineRef = useRef<any>(null)
  const selectedGlowRef = useRef<any>(null)
  const hoverFillRef = useRef<any>(null)
  const hoverOutlineRef = useRef<any>(null)

  useEffect(() => {
    onClickRef.current = onDistrictClick
  }, [onDistrictClick])

  useEffect(() => {
    onHoverRef.current = onDistrictHover
  }, [onDistrictHover])

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
    const feature = name ? districtFeaturesRef.current.find(f => f.properties?.name === name) : null
    layer?.setData({
      type: 'FeatureCollection',
      features: feature ? [feature] : [],
    })
  }

  // 选中区县变化：刷新选中高亮，并清掉可能与新选中重合的悬浮高亮
  useEffect(() => {
    selectedDistrictRef.current = selectedDistrict
    const sel = selectedDistrict ?? null
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
  }, [selectedDistrict])

  // 区县列表变化：刷新站点标记
  useEffect(() => {
    stationLayerRef.current?.setData(districtItems, {
      parser: { type: 'json', x: 'lng', y: 'lat' },
    })
  }, [districtItems])

  useEffect(() => {
    if (!containerRef.current) return

    setReady(false)
    const scene = new Scene({
      id: containerRef.current,
      logoVisible: false,
      map: new Mapbox({
        style: 'blank',
        center: [city.lng, city.lat],
        zoom: 8.3,
        pitch: 45,
        rotation: 0,
        minZoom: 6,
        maxZoom: 12,
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
        // 区县边界（_full）与市界轮廓（用于发光围墙）
        // 边界数据已本地化到 public/map，避免正式环境（HTTP 部署）访问外部 HTTPS 资源失败
        const [districtsRes, cityBoundRes] = await Promise.all([
          fetch(`/map/${city.adcode}_full.json`).then(r => r.json()),
          fetch(`/map/${city.adcode}.json`).then(r => r.json()),
        ])
        districtFeaturesRef.current = districtsRes.features

        // 1. 市界发光围墙
        const wallLayer = new LineLayer({ zIndex: 1 })
          .source(cityBoundRes)
          .shape('wall')
          .size(60000)
          .style({ heightfixed: true, opacity: 0.65, sourceColor: '#43ADF1', targetColor: 'rgba(1,21,59,0)' })
        scene.addLayer(wallLayer)

        // 2. 3D 拉伸多边形 —— 底图区县
        const polygonLayer = new PolygonLayer({ zIndex: 2, autoFit: false })
          .source(districtsRes)
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
        addWaterRippleSurface(scene, districtsRes, BASE_TOP, 3)

        // 3. 底部边界线
        const lineDown = new LineLayer({ zIndex: 3 })
          .source(districtsRes)
          .shape('line')
          .color('#0DCCFF')
          .size(1)
          .style({ raisingHeight: 0, opacity: 0.8 })
        scene.addLayer(lineDown)

        // 4. 顶部边界线（略高于水面纹理层，任何角度都可见）
        const lineUp = new LineLayer({ zIndex: 4 })
          .source(districtsRes)
          .shape('line')
          .color('#0DCCFF')
          .size(1.5)
          .style({ raisingHeight: BASE_TOP + 1200, opacity: 1 })
        scene.addLayer(lineUp)

        // 5. 悬浮高亮（抬高到 HOVER_TOP）
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

        // 7. 悬浮描边
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

        // 初始化选中高亮（初次进入时 prop 可能已有选中区县）
        const initialSelected = districtsRes.features.find((feature: any) => feature.properties?.name === selectedDistrictRef.current)
        if (initialSelected) {
          selectedFillRef.current?.setData({ type: 'FeatureCollection', features: [initialSelected] })
          selectedTextureRef.current?.setData({ type: 'FeatureCollection', features: [initialSelected] })
          selectedOutlineRef.current?.setData({ type: 'FeatureCollection', features: [initialSelected] })
          selectedGlowRef.current?.setData({ type: 'FeatureCollection', features: [initialSelected] })
        }

        // 9. 区县名称文字 —— 使用 center 字段（centroid 可能偏移）
        const texts = districtsRes.features.map((f: any) => {
          const c = f.properties.center || f.properties.centroid || [city.lng, city.lat]
          return { name: f.properties.name, lng: c[0], lat: c[1] }
        })
        const textLayer = new PointLayer({ zIndex: 10 })
          .source(texts, { parser: { type: 'json', x: 'lng', y: 'lat' } })
          .shape('name', 'text')
          .size(13)
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

        // 10. 区县监测站点标记（使用区县中心经纬度）
        const stationLayer = new PointLayer({ zIndex: 11 })
          .source(districtItems, { parser: { type: 'json', x: 'lng', y: 'lat' } })
          .shape('circle')
          .size(8)
          .color('#00ff88')
          .style({ opacity: 0.9, strokeWidth: 1, stroke: '#fff' })
        scene.addLayer(stationLayer)
        stationLayerRef.current = stationLayer

        // 11. 雷达扫描与无人机场图标
        deviceLayersRef.current = await createDeviceMapLayers(scene, devicePointsRef.current, TEXT_TOP + 2000)

        // 空气质量六级图标打点（按 IAQI 显示在各区县中心）
        airLayersRef.current = await createAirQualityLayers(
          scene,
          airPointsRef.current,
          TEXT_TOP + 4000,
          point => onAirPointClickRef.current?.(point),
        )

        // 12. 悬浮/点击交互
        polygonLayer.on('mousemove', (e: any) => {
          const name = e.feature?.properties?.name
          if (!name) return
          onHoverRef.current?.(name)
          hoverNameRef.current = name
          if (name !== selectedDistrictRef.current) {
            setHighlight(hoverFillRef.current, name)
            setHighlight(hoverOutlineRef.current, name)
          } else {
            setHighlight(hoverFillRef.current, null)
            setHighlight(hoverOutlineRef.current, null)
          }
        })

        polygonLayer.on('unmousemove', () => {
          onHoverRef.current?.(null)
          hoverNameRef.current = null
          setHighlight(hoverFillRef.current, null)
          setHighlight(hoverOutlineRef.current, null)
        })

        polygonLayer.on('click', (e: any) => {
          const name = e.feature?.properties?.name
          const adcode = e.feature?.properties?.adcode
          if (name) onClickRef.current?.(name, Number(adcode))
        })

        setReady(true)
      } catch (err) {
        console.error('CityDistrictMap: 加载地图数据失败', err)
        setReady(true)
      }
    })

    return () => {
      scene.destroy()
      sceneRef.current = null
      stationLayerRef.current = null
      deviceLayersRef.current = null
      airLayersRef.current = null
      selectedFillRef.current = null
      selectedTextureRef.current = null
      selectedOutlineRef.current = null
      selectedGlowRef.current = null
      hoverFillRef.current = null
      hoverOutlineRef.current = null
      districtFeaturesRef.current = []
    }
    // 城市变化时重建场景；选中/站点/设备变化通过各自 effect 增量更新。
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [city.adcode])

  return (
    <div className="relative w-full h-full">
      <div ref={containerRef} className="w-full h-full" />
      {!ready && (
        <div className="absolute inset-0 flex items-center justify-center bg-[rgba(21,94,169,0.82)] text-[#dffbff] text-13px">
          正在加载{city.name}区县地图...
        </div>
      )}
    </div>
  )
}

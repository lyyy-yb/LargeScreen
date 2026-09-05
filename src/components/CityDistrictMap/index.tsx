import { useEffect, useRef, useState } from 'react'
import { Scene, PolygonLayer, LineLayer, PointLayer } from '@antv/l7'
import { Mapbox } from '@antv/l7-maps'
import type { CityItem, DistrictItem } from '@/utils/city'
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
import { useMapFocus } from '@/hooks/useMapFocus'
import type { MapFocusTarget } from '@/types/mapFocus'

interface CityDistrictMapProps {
  city: CityItem
  districtItems: DistrictItem[]
  selectedDistrict?: string
  onDistrictClick?: (districtName: string, adcode: number) => void
  onDistrictHover?: (districtName: string | null) => void
  devicePoints?: MapDevicePoint[]
  airPoints?: AirQualityPoint[]
  /** 预警点位（alertEvent/list 经纬度），与 airPoints 由页面按钮组切换显示 */
  alertPoints?: AlertMapPoint[]
  /** monitor 雷达常规/突发点（hbdp/leida/alarmPointTop5） */
  radarAlarmPoints?: RadarAlarmPoint[]
  /** 企业排口打点（hbdp/emissionOutlet/list，灰点，zoom>=13 图标 / >=16 两行文字） */
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
  /** 显示企业排口打点（图标 + 两行文字），默认 true */
  showEmissionOutletPoints?: boolean
  /** 是否显示市级外的省外挖洞蒙层；默认 true（monitor 行为不变），空气质量页传 false */
  showRegionMask?: boolean
  /** 是否显示边界线 + 城市块 + 区县标签；默认 true（monitor 行为不变），空气质量页传 false */
  showBoundary?: boolean
  /** 全局搜索选中后的定位目标 */
  focusTarget?: MapFocusTarget | null
}

// 平面地图风格：区域不抬高、无拉伸/边墙，仅平面边界线勾勒轮廓，卫星底图直接透出

export default function CityDistrictMap({
  city,
  selectedDistrict,
  onDistrictClick,
  onDistrictHover,
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
  showEmissionOutletPoints = true,
  showRegionMask = true,
  showBoundary = true,
  focusTarget,
}: CityDistrictMapProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const sceneRef = useRef<Scene | null>(null)
  const districtFeaturesRef = useRef<any[]>([])
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
  const selectedDistrictRef = useRef(selectedDistrict)
  const hoverNameRef = useRef<string | null>(null)
  const onClickRef = useRef(onDistrictClick)
  const onHoverRef = useRef(onDistrictHover)
  const [ready, setReady] = useState(false)

  // 高亮图层引用
  const selectedOutlineRef = useRef<any>(null)
  const selectedFillRef = useRef<any>(null)
  const selectedGlowRef = useRef<any>(null)
  const selectedDashRef = useRef<any>(null)
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

  const onOutletClickRef = useRef(onOutletClick)
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
    { alertLayersRef, airLayersRef, deviceLayersRef, radarAlarmLayersRef, emissionOutletLayersRef },
    { showAlertPoints, showAirPoints, showDronePoints, showRadarPoints, showEmissionOutletPoints },
    ready,
  )

  useMapFocus(sceneRef, ready, focusTarget)

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
    setHighlight(selectedOutlineRef.current, sel)
    setHighlight(selectedFillRef.current, sel)
    setHighlight(selectedGlowRef.current, sel)
    setHighlight(selectedDashRef.current, sel)
    if (hoverNameRef.current && hoverNameRef.current !== sel) {
      setHighlight(hoverOutlineRef.current, hoverNameRef.current)
    } else {
      setHighlight(hoverOutlineRef.current, null)
    }
  }, [selectedDistrict])

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
        minZoom: 7.6,
        maxZoom: 17,
      }),
    })
    scene.setBgColor('rgba(9, 54, 114, 0.5)')
    sceneRef.current = scene

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
        // 区县边界（_full）与市界轮廓（用于发光围墙）
        // 边界数据已本地化到 public/map，避免正式环境（HTTP 部署）访问外部 HTTPS 资源失败
        const [districtsRes, cityBoundRes] = await Promise.all([
          fetch(`/map/${city.adcode}_full.json`).then(r => r.json()),
          fetch(`/map/${city.adcode}.json`).then(r => r.json()),
        ])
        districtFeaturesRef.current = districtsRes.features

        // 市外蒙层 + 限制拖拽范围（与省级同方案）：市界外雾化，市域不能拖出可视范围
        addRegionMask(scene, cityBoundRes, 1, 0.55, { enabled: showRegionMask })
        setRegionBounds(scene, cityBoundRes)

        // 1. 市界轮廓（平面边界：天蓝实线，不再使用有高度的边墙）
        if (showBoundary) {
          const cityBoundLine = new LineLayer({ zIndex: 6, enablePicking: false })
            .source(cityBoundRes)
            .shape('line')
            .color('#3fc6ff')
            .size(2.2)
            .style({ opacity: 1 })
          scene.addLayer(cityBoundLine)

        // 2. 平面区域地块 —— 近全透明填充直接显示卫星底图，仅承担点选交互与淡色区域衬托
        const polygonLayer = new PolygonLayer({ zIndex: 2, autoFit: false })
          .source(districtsRes)
          .shape('fill')
          .color('name', [
            '#2b86d8', '#2f8cdd', '#318fe0', '#2c88da',
            '#3492e2', '#2d89db', '#3695e5', '#2e8bdc',
            '#338fe1', '#3090df', '#369aea',
          ])
          .style({ opacity: 0.06 })
        scene.addLayer(polygonLayer)

        // 交互事件立即绑定：不依赖后续任何异步图层加载，保证点选/悬浮始终可用。
        // 注意：所有装饰层必须 enablePicking: false，否则会盖住本地块层截获鼠标事件。
        polygonLayer.on('mousemove', (e: any) => {
          const name = e.feature?.properties?.name
          if (!name) return
          onHoverRef.current?.(name)
          hoverNameRef.current = name
          if (name !== selectedDistrictRef.current) {
            setHighlight(hoverOutlineRef.current, name)
          } else {
            setHighlight(hoverOutlineRef.current, null)
          }
        })

        polygonLayer.on('unmousemove', () => {
          onHoverRef.current?.(null)
          hoverNameRef.current = null
          setHighlight(hoverOutlineRef.current, null)
        })

        polygonLayer.on('click', (e: any) => {
          const name = e.feature?.properties?.name
          const adcode = e.feature?.properties?.adcode
          if (name) onClickRef.current?.(name, Number(adcode))
        })

        // 3. 区县界描边（平面边界：天蓝）。与省级同方案：每区县一个单要素线图层
        // （已验证可渲染模式），depth:false 按 zIndex 合成
        districtsRes.features.forEach((feature: any) => {
          const districtLine = new LineLayer({ zIndex: 5, enablePicking: false })
            .source({ type: 'FeatureCollection', features: [feature] })
            .shape('line')
            .color('#3fc6ff')
            .size(2)
            .style({ opacity: 1 })
          scene.addLayer(districtLine)
        })
        }

        // 5. 悬浮描边：亮白加粗，与常态天蓝边形成对比（同省级方案）
        const hoverOutline = new LineLayer({ zIndex: 8, enablePicking: false })
          .source({ type: 'FeatureCollection', features: [] })
          .shape('line')
          .color('#ffffff')
          .size(3.5)
          .style({ opacity: 1 })
        scene.addLayer(hoverOutline)
        hoverOutlineRef.current = hoverOutline

        // 8. 选中效果 = 面色提亮 + 高亮描边 + 流动蚂蚁线（三层各司其职，禁拾取）
        const selectedFill = new PolygonLayer({ zIndex: 4, enablePicking: false })
          .source({ type: 'FeatureCollection', features: [] })
          .shape('fill')
          .color('#2fb9f5')
          .style({ opacity: 0.35 })
        scene.addLayer(selectedFill)
        selectedFillRef.current = selectedFill

        const selectedOutline = new LineLayer({ zIndex: 9, enablePicking: false })
          .source({ type: 'FeatureCollection', features: [] })
          .shape('line')
          .color('#bffbff')
          .size(2.5)
          .style({ opacity: 1 })
        scene.addLayer(selectedOutline)
        selectedOutlineRef.current = selectedOutline

        // 选中微光晕（仅选中态保留一点柔光，常规边界无光晕）
        const selectedGlow = new LineLayer({ zIndex: 8, enablePicking: false })
          .source({ type: 'FeatureCollection', features: [] })
          .shape('line')
          .color('#3fe0ff')
          .size(6)
          .style({ opacity: 0.25 })
        scene.addLayer(selectedGlow)
        selectedGlowRef.current = selectedGlow

        const selectedDash = new LineLayer({ zIndex: 10, enablePicking: false })
          .source({ type: 'FeatureCollection', features: [] })
          .shape('line')
          .color('#7ff6ff')
          .size(1.2)
          .style({ opacity: 0.9, dashArray: [4, 3] })
        selectedDash.animate(true)
        scene.addLayer(selectedDash)
        selectedDashRef.current = selectedDash

        // 初始化选中高亮（初次进入时 prop 可能已有选中区县）
        const initialSelected = districtsRes.features.find((feature: any) => feature.properties?.name === selectedDistrictRef.current)
        if (initialSelected) {
          selectedOutlineRef.current?.setData({ type: 'FeatureCollection', features: [initialSelected] })
          selectedFillRef.current?.setData({ type: 'FeatureCollection', features: [initialSelected] })
          selectedGlowRef.current?.setData({ type: 'FeatureCollection', features: [initialSelected] })
          selectedDashRef.current?.setData({ type: 'FeatureCollection', features: [initialSelected] })
        }

        // 9. 区县名称文字（禁拾取，避免文字盖住地块截获点击）
        const texts = districtsRes.features.map((f: any) => {
          const c = f.properties.center || f.properties.centroid || [city.lng, city.lat]
          return { name: f.properties.name, lng: c[0], lat: c[1] }
        })
        const textLayer = new PointLayer({ zIndex: 10, enablePicking: false })
          .source(texts, { parser: { type: 'json', x: 'lng', y: 'lat' } })
          .shape('name', 'text')
          .size(13)
          .color('#eafcff')
          .style({
            textAnchor: 'center',
            spacing: 2,
            padding: [2, 2],
            stroke: '#021a3f',
            strokeWidth: 3,
            raisingHeight: 0,
            textAllowOverlap: true,
            heightFixed: true,
          })
        if (showBoundary) scene.addLayer(textLayer)

        // 11. 雷达扫描与无人机场图标
        deviceLayersRef.current = await createDeviceMapLayers(scene, devicePointsRef.current, 0)

        // 空气质量六级图标打点（按 IAQI 显示在各区县中心）
        airLayersRef.current = await createAirQualityLayers(
          scene,
          airPointsRef.current,
          0,
          (point, pos) => onAirPointClickRef.current?.(point, pos),
        )

        // 预警点位标记（alertEvent/list 经纬度，warn-l1~l3 图标，与空气质量打点切换显示）
        alertLayersRef.current = await createAlertLayers(scene, alertPointsRef.current, 0)

        // monitor 雷达常规/突发点（hbdp/leida/alarmPointTop5，橙/红圆点）
        radarAlarmLayersRef.current = await createRadarAlarmLayers(scene, radarAlarmPointsRef.current, 0)

        // 企业排口打点（hbdp/emissionOutlet/list，灰色圆点，zoom>=13 图标 / >=16 两行文字）
        emissionOutletLayersRef.current = await createEmissionOutletLayers(
          scene,
          emissionOutletPointsRef.current,
          0,
          (point, pos) => onOutletClickRef.current?.(point, pos),
        )

        setReady(true)
      } catch (err) {
        console.error('CityDistrictMap: 加载地图数据失败', err)
        setReady(true)
      }
    })

    return () => {
      deviceLayersRef.current?.destroy()
      alertLayersRef.current?.destroy()
      radarAlarmLayersRef.current?.destroy()
      emissionOutletLayersRef.current?.destroy()
      scene.destroy()
      sceneRef.current = null
      deviceLayersRef.current = null
      airLayersRef.current = null
      alertLayersRef.current = null
      radarAlarmLayersRef.current = null
      emissionOutletLayersRef.current = null
      selectedOutlineRef.current = null
      selectedFillRef.current = null
      selectedGlowRef.current = null
      selectedDashRef.current = null
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

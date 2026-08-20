import { useEffect, useRef, useState } from 'react'
import { Scene, PolygonLayer, LineLayer, PointLayer } from '@antv/l7'
import { Mapbox } from '@antv/l7-maps'
import type { MapDevicePoint } from '@/types/mapDevice'
import type { AirQualityPoint } from '@/types/airData'
import { createDeviceMapLayers, type DeviceMapLayers } from '@/utils/mapDeviceLayers'
import { createAirQualityLayers, type AirMapLayers, type AirPointClickPos } from '@/utils/mapAirLayers'
import { createAlertLayers, type AlertMapLayers, type AlertMapPoint } from '@/utils/mapAlertLayers'
import { createRadarAlarmLayers, type RadarAlarmLayers, type RadarAlarmPoint } from '@/utils/mapRadarAlarmLayers'
import { createEmissionOutletLayers, type EmissionOutletLayers, type EmissionOutletPoint, type OutletPointClickPos } from '@/utils/mapEmissionOutletLayers'
import { addSatelliteTiles } from '@/utils/mapSatelliteTiles'
import { useLayerVisibility } from '@/hooks/useLayerVisibility'
import { useMapFocus } from '@/hooks/useMapFocus'
import type { MapFocusTarget } from '@/types/mapFocus'

interface ZJ3DMapProps {
  id?: string
  selectedCity?: string
  onCityClick?: (cityName: string, adcode: number) => void
  onCityHover?: (cityName: string | null) => void
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
  /** 全局搜索选中后的定位目标 */
  focusTarget?: MapFocusTarget | null
}

// 平面地图风格：区域不抬高、无拉伸/边墙，仅平面边界线勾勒轮廓，卫星底图直接透出

export default function ZJ3DMap({
  id = 'zj3dmap',
  selectedCity,
  onCityClick,
  onCityHover,
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
  focusTarget,
}: ZJ3DMapProps) {
  const sceneRef = useRef<Scene | null>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const [ready, setReady] = useState(false)
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
  const alertPointsRef = useRef(alertPoints)
  const alertLayersRef = useRef<AlertMapLayers | null>(null)
  const radarAlarmPointsRef = useRef(radarAlarmPoints)
  const radarAlarmLayersRef = useRef<RadarAlarmLayers | null>(null)
  const emissionOutletPointsRef = useRef(emissionOutletPoints)
  const emissionOutletLayersRef = useRef<EmissionOutletLayers | null>(null)

  // 高亮图层引用（L7 链式构建返回 ILayer，统一用 any 持有）
  const selectedOutlineRef = useRef<any>(null)
  const selectedFillRef = useRef<any>(null)
  const selectedGlowRef = useRef<any>(null)
  const selectedDashRef = useRef<any>(null)
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
    setHighlight(selectedOutlineRef.current, sel)
    setHighlight(selectedFillRef.current, sel)
    setHighlight(selectedGlowRef.current, sel)
    setHighlight(selectedDashRef.current, sel)
    if (hoverNameRef.current && hoverNameRef.current !== sel) {
      setHighlight(hoverOutlineRef.current, hoverNameRef.current)
    } else {
      setHighlight(hoverOutlineRef.current, null)
    }
  }, [selectedCity])

  useEffect(() => {
    if (!containerRef.current || sceneRef.current) return
    setReady(false)

    const scene = new Scene({
      id: containerRef.current,
      logoVisible: false,
      map: new Mapbox({
        style: 'blank',
        center: [120.2, 29.3],
        zoom: 6.8,
        pitch: 45,
        rotation: -5,
        minZoom: 6.2,
        maxZoom: 15,
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
      // 限制拖拽范围：浙江省不能被拖出可视范围（包围盒略留余量）
      const rawMap: any = (scene as any).mapService?.map ?? (scene as any).mapService?.getMap?.()
      rawMap?.setMaxBounds?.([[115.5, 25.2], [124.8, 32.8]])

      // 卫星影像底图（与 radar 页同源）
      addSatelliteTiles(scene)

      try {
        const [citiesRes, wallRes] = await Promise.all([
          fetch('/map/zhejiang_cities.json').then(r => r.json()),
          fetch('/map/zhejiang_wall.json').then(r => r.json()),
        ])
        cityFeaturesRef.current = citiesRes.features

        // 0. 省外蒙层：大范围矩形挖掉浙江省轮廓，深色半透明雾化省外区域突出主体
        const outerRing = [[108, 18], [132, 18], [132, 40], [108, 40], [108, 18]]
        const zjRings = wallRes.features.flatMap((f: any) =>
          f.geometry?.type === 'Polygon'
            ? f.geometry.coordinates
            : (f.geometry?.coordinates ?? []).flat(),
        )
        const maskLayer = new PolygonLayer({ zIndex: 1, enablePicking: false, autoFit: false })
          .source({
            type: 'FeatureCollection',
            features: [{ type: 'Feature', properties: {}, geometry: { type: 'Polygon', coordinates: [outerRing, ...zjRings] } }],
          })
          .shape('fill')
          .color('#04162e')
          .style({ opacity: 0.55 })
        scene.addLayer(maskLayer)

        // 1. 省界轮廓（平面边界：天蓝色实线，不再使用有高度的边墙）
        const provinceLine = new LineLayer({ zIndex: 6, enablePicking: false })
          .source(wallRes)
          .shape('line')
          .color('#3fc6ff')
          .size(2.2)
          .style({ opacity: 1 })
        scene.addLayer(provinceLine)

        // 2. 平面区域地块 —— 近全透明填充直接显示卫星底图，仅承担点选交互与淡色区域衬托
        const polygonLayer = new PolygonLayer({ zIndex: 2, autoFit: false })
          .source(citiesRes)
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
          onCityHoverRef.current?.(name)
          hoverNameRef.current = name
          if (name !== selectedCityRef.current) {
            setHighlight(hoverOutlineRef.current, name)
          } else {
            setHighlight(hoverOutlineRef.current, null)
          }
        })

        polygonLayer.on('unmousemove', () => {
          onCityHoverRef.current?.(null)
          hoverNameRef.current = null
          setHighlight(hoverOutlineRef.current, null)
        })

        polygonLayer.on('click', (e: any) => {
          const name = e.feature?.properties?.name
          const adcode = e.feature?.properties?.adcode
          if (name) onCityClickRef.current?.(name, adcode)
        })

        // 3. 市界描边（内侧市界：天蓝色）。
        // 关键实测结论：本机真实浏览器中，「11 个市要素喂给单个 LineLayer」不渲染，
        // 而「单市要素 setData 的 LineLayer」（选中/悬浮描边）稳定渲染。
        // 因此常态市界 = 每市一个线图层，完全复用已验证可用的单要素图层模式。
        citiesRes.features.forEach((feature: any) => {
          const cityLine = new LineLayer({ zIndex: 5, enablePicking: false })
            .source({ type: 'FeatureCollection', features: [feature] })
            .shape('line')
            .color('#3fc6ff')
            .size(2)
            .style({ opacity: 1 })
          scene.addLayer(cityLine)
        })

        // 5. 悬浮描边：亮白加粗，与常态天蓝边形成对比
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

        // 初始化选中高亮（初次进入时 prop 已有选中城市）
        const initialSelected = citiesRes.features.find((feature: any) => feature.properties?.name === selectedCityRef.current)
        if (initialSelected) {
          selectedOutlineRef.current?.setData({ type: 'FeatureCollection', features: [initialSelected] })
          selectedFillRef.current?.setData({ type: 'FeatureCollection', features: [initialSelected] })
          selectedGlowRef.current?.setData({ type: 'FeatureCollection', features: [initialSelected] })
          selectedDashRef.current?.setData({ type: 'FeatureCollection', features: [initialSelected] })
        }

        // 9. 城市名称文字（禁拾取，避免文字盖住地块截获点击）
        const texts = citiesRes.features.map((f: any) => {
          const c = f.properties.center || f.properties.centroid || [120.2, 29.3]
          return {
            name: f.properties.name.replace('市', ''),
            lng: c[0],
            lat: c[1],
          }
        })
        const textLayer = new PointLayer({ zIndex: 10, enablePicking: false })
          .source(texts, { parser: { type: 'json', x: 'lng', y: 'lat' } })
          .shape('name', 'text')
          .size(14)
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
        scene.addLayer(textLayer)

        // 11-12. 使用接口经纬度打印雷达扫描与无人机场图标（与老项目字段一致）
        deviceLayersRef.current = await createDeviceMapLayers(scene, devicePointsRef.current, 0)

        // 空气质量六级图标打点（按 IAQI 显示在各市中心）
        airLayersRef.current = await createAirQualityLayers(
          scene,
          airPointsRef.current,
          0,
          (point, pos) => onAirPointClickRef.current?.(point, pos),
        )

        // 13. 预警点位标记（alertEvent/list 经纬度，warn-l1~l3 图标）
        alertLayersRef.current = await createAlertLayers(scene, alertPointsRef.current, 0)

        // 13.5 monitor 雷达常规/突发点（hbdp/leida/alarmPointTop5，橙/红圆点）
        radarAlarmLayersRef.current = await createRadarAlarmLayers(scene, radarAlarmPointsRef.current, 0)

        // 14. 企业排口打点（hbdp/emissionOutlet/list，灰色圆点，zoom>=13 图标 / >=16 两行文字）
        emissionOutletLayersRef.current = await createEmissionOutletLayers(
          scene,
          emissionOutletPointsRef.current,
          0,
          (point, pos) => onOutletClickRef.current?.(point, pos),
        )
      } catch (err) {
        console.error('ZJ3DMap: 加载地图数据失败', err)
      }
      setReady(true)
    })

    return () => {
      deviceLayersRef.current?.destroy()
      alertLayersRef.current?.destroy()
      radarAlarmLayersRef.current?.destroy()
      emissionOutletLayersRef.current?.destroy()
      if (sceneRef.current) {
        sceneRef.current.destroy()
        sceneRef.current = null
      }
      selectedOutlineRef.current = null
      selectedFillRef.current = null
      selectedGlowRef.current = null
      selectedDashRef.current = null
      hoverOutlineRef.current = null
      deviceLayersRef.current = null
      airLayersRef.current = null
      alertLayersRef.current = null
      radarAlarmLayersRef.current = null
      emissionOutletLayersRef.current = null
      cityFeaturesRef.current = []
    }
  }, [])

  return <div ref={containerRef} id={id} className="w-full h-full" />
}

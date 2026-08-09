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
import { addSatelliteTiles } from '@/utils/mapSatelliteTiles'
import { addRegionMask, setRegionBounds } from '@/utils/mapRegionMask'

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
  /** 雷达突发告警点（hbdp/leida/alarmPoint，常显） */
  radarAlarmPoints?: RadarAlarmPoint[]
  onAirPointClick?: (point: AirQualityPoint, pos?: AirPointClickPos) => void
}

// 漂浮地图风格（L7 floatmap 示例）：区块抬离地面 + 光幕接地 + 块底/块顶双细线
const BASE_TOP = 3000 // 区块厚度（降低厚度避免纹理面盖住边界/打点）
const FLOAT_BASE = 3000 // 区块抬离地面高度（缩小与底图间距）
const BLOCK_TOP = FLOAT_BASE + BASE_TOP // 区块顶面高度
const TEXT_TOP = BLOCK_TOP + 6000

export default function CityDistrictMap({
  city,
  selectedDistrict,
  onDistrictClick,
  onDistrictHover,
  devicePoints = [],
  airPoints = [],
  alertPoints = [],
  radarAlarmPoints = [],
  onAirPointClick,
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
        maxZoom: 14,
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
        addRegionMask(scene, cityBoundRes)
        setRegionBounds(scene, cityBoundRes)

        // 1. 市界边墙（淡蓝色实心光墙，与省级地图同方案）
        const wallLayer = new LineLayer({ zIndex: 1, enablePicking: false })
          .source(cityBoundRes)
          .shape('wall')
          .size(9000)
          .style({
            heightfixed: true,
            opacity: 0.45,
            sourceColor: '#3fc6ff',
            targetColor: '#3fc6ff',
          })
        scene.addLayer(wallLayer)

        // 1.5 市界亮轮廓（外侧边界：天蓝实线，高度高于边墙避免角度遮挡）
        const cityBoundLine = new LineLayer({ zIndex: 6, enablePicking: false })
          .source(cityBoundRes)
          .shape('line')
          .color('#3fc6ff')
          .size(2.2)
          .style({ raisingHeight: 11000, heightfixed: true, opacity: 1, depth: false })
        scene.addLayer(cityBoundLine)

        // 2. 3D 拉伸地块 —— 与省级对齐：顶面近全透明直接显示卫星底图，仅侧面留淡蓝薄边
        const polygonLayer = new PolygonLayer({ zIndex: 2, autoFit: false })
          .source(districtsRes)
          .shape('extrude')
          .size(BASE_TOP)
          .color('name', [
            '#2b86d8', '#2f8cdd', '#318fe0', '#2c88da',
            '#3492e2', '#2d89db', '#3695e5', '#2e8bdc',
            '#338fe1', '#3090df', '#369aea',
          ])
          .style({
            heightfixed: true,
            pickLight: true,
            raisingHeight: FLOAT_BASE,
            opacity: 0.06,
            // 侧面统一淡蓝（与边界线 #3fc6ff 同色系），替代原深蓝渐变
            sourceColor: '#8fdcff',
            targetColor: '#3fc6ff',
          })
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

        // 3. 区县界描边（内侧边界：天蓝）。与省级同方案：每区县一个单要素线图层
        // （已验证可渲染模式），高度统一高于边墙，depth:false 按 zIndex 合成
        districtsRes.features.forEach((feature: any) => {
          const districtLine = new LineLayer({ zIndex: 5, enablePicking: false })
            .source({ type: 'FeatureCollection', features: [feature] })
            .shape('line')
            .color('#3fc6ff')
            .size(2)
            .style({ raisingHeight: 11000, heightfixed: true, opacity: 1, depth: false })
          scene.addLayer(districtLine)
        })

        // 4.5 智造新城（仅衢州）：不叠加凸出填充面，仅描边 + 标签，并自动聚焦
        if (city.adcode === '330800' || city.name.includes('衢州')) {
          try {
            const zhizaoRes = await fetch('/map/zhizao_newcity.json').then(r => r.json())
            const ZZ_CENTER: [number, number] = [118.93118, 28.90954]
            // 智造新城独立配色（琥珀金系，与全局天蓝体系区分）：半透明区域面 + 描边 + 蚂蚁线
            const zzFill = new PolygonLayer({ zIndex: 7, enablePicking: false, autoFit: false })
              .source(zhizaoRes)
              .shape('extrude')
              .size(300)
              .color('#ff9f43')
              .style({
                heightfixed: true,
                topsurface: true,
                sidesurface: false,
                raisingHeight: BLOCK_TOP + 300,
                opacity: 0.25,
              })
            scene.addLayer(zzFill)

            // 智造新城边墙（有高度的区域边：琥珀金光墙，与边界线 #ffd166 同色系；边界线 13000 高于墙顶避免遮挡）
            const zzWall = new LineLayer({ zIndex: 7, enablePicking: false })
              .source(zhizaoRes)
              .shape('wall')
              .size(3500)
              .style({
                heightfixed: true,
                opacity: 0.45,
                sourceColor: '#ffd166',
                targetColor: '#ffd166',
              })
            scene.addLayer(zzWall)

            const zzLine = new LineLayer({ zIndex: 8, enablePicking: false })
              .source(zhizaoRes)
              .shape('line')
              .color('#ffd166')
              // 边界再次加粗（6px），比区县边界（2px）明显更粗以突出智造新城
              .size(6)
              .style({ raisingHeight: 13000, heightfixed: true, opacity: 1, depth: false })
            scene.addLayer(zzLine)

            const zzDash = new LineLayer({ zIndex: 9, enablePicking: false })
              .source(zhizaoRes)
              .shape('line')
              .color('#ffe9a8')
              .size(1.2)
              .style({ raisingHeight: 13000, heightfixed: true, opacity: 0.9, depth: false, dashArray: [4, 3] })
            zzDash.animate(true)
            scene.addLayer(zzDash)

            // 中心呼吸光圈（扩散动画）
            const zzRipple = new PointLayer({ zIndex: 11, enablePicking: false })
              .source([{ lng: ZZ_CENTER[0], lat: ZZ_CENTER[1] }], { parser: { type: 'json', x: 'lng', y: 'lat' } })
              .shape('circle')
              .size(16)
              .color('#ffc857')
              .style({ raisingHeight: 13000, heightfixed: true, opacity: 0.8, depth: false })
            zzRipple.animate(true)
            scene.addLayer(zzRipple)

            const zzCore = new PointLayer({ zIndex: 11, enablePicking: false })
              .source([{ lng: ZZ_CENTER[0], lat: ZZ_CENTER[1] }], { parser: { type: 'json', x: 'lng', y: 'lat' } })
              .shape('circle')
              .size(4)
              .color('#fff6dd')
              .style({ raisingHeight: 13000, heightfixed: true, opacity: 1, depth: false })
            scene.addLayer(zzCore)
            // 名称标签（金色描边呼应独立配色）
            const zzLabel = new PointLayer({ zIndex: 12, enablePicking: false })
              .source([{ name: '智造新城', lng: ZZ_CENTER[0], lat: ZZ_CENTER[1] }], { parser: { type: 'json', x: 'lng', y: 'lat' } })
              .shape('name', 'text')
              .size(13)
              .color('#ffe9a8')
              .style({
                textAnchor: 'center',
                stroke: '#7a4a08',
                strokeWidth: 3,
                raisingHeight: BLOCK_TOP + 10000,
                textAllowOverlap: true,
                heightFixed: true,
              })
            scene.addLayer(zzLabel)
            // 自动聚焦到智造新城（缩放适中，不怼太近）
            scene.setZoomAndCenter(10.4, ZZ_CENTER)
          } catch (err) {
            console.warn('CityDistrictMap: 加载智造新城数据失败', err)
          }
        }

        // 5. 悬浮描边：亮白加粗，与常态天蓝边形成对比（同省级方案）
        const hoverOutline = new LineLayer({ zIndex: 8, enablePicking: false })
          .source({ type: 'FeatureCollection', features: [] })
          .shape('line')
          .color('#ffffff')
          .size(3.5)
          .style({ raisingHeight: 13000, heightfixed: true, opacity: 1, depth: false })
        scene.addLayer(hoverOutline)
        hoverOutlineRef.current = hoverOutline

        // 8. 选中效果 = 面色提亮 + 高亮描边 + 流动蚂蚁线（三层各司其职，禁拾取）
        const selectedFill = new PolygonLayer({ zIndex: 4, enablePicking: false })
          .source({ type: 'FeatureCollection', features: [] })
          .shape('extrude')
          .size(BASE_TOP + 800)
          .color('#2fb9f5')
          .style({
            heightfixed: true,
            raisingHeight: FLOAT_BASE,
            opacity: 0.35,
          })
        scene.addLayer(selectedFill)
        selectedFillRef.current = selectedFill

        const selectedOutline = new LineLayer({ zIndex: 9, enablePicking: false })
          .source({ type: 'FeatureCollection', features: [] })
          .shape('line')
          .color('#bffbff')
          .size(2.5)
          .style({ raisingHeight: 13000, heightfixed: true, opacity: 1, depth: false })
        scene.addLayer(selectedOutline)
        selectedOutlineRef.current = selectedOutline

        // 选中微光晕（仅选中态保留一点柔光，常规边界无光晕）
        const selectedGlow = new LineLayer({ zIndex: 8, enablePicking: false })
          .source({ type: 'FeatureCollection', features: [] })
          .shape('line')
          .color('#3fe0ff')
          .size(6)
          .style({ raisingHeight: 13000, heightfixed: true, opacity: 0.25, depth: false })
        scene.addLayer(selectedGlow)
        selectedGlowRef.current = selectedGlow

        const selectedDash = new LineLayer({ zIndex: 10, enablePicking: false })
          .source({ type: 'FeatureCollection', features: [] })
          .shape('line')
          .color('#7ff6ff')
          .size(1.2)
          .style({ raisingHeight: 13000, heightfixed: true, opacity: 0.9, depth: false, dashArray: [4, 3] })
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
            raisingHeight: TEXT_TOP,
            textAllowOverlap: true,
            heightFixed: true,
          })
        scene.addLayer(textLayer)

        // 11. 雷达扫描与无人机场图标
        deviceLayersRef.current = await createDeviceMapLayers(scene, devicePointsRef.current, TEXT_TOP + 2000)

        // 空气质量六级图标打点（按 IAQI 显示在各区县中心）
        airLayersRef.current = await createAirQualityLayers(
          scene,
          airPointsRef.current,
          TEXT_TOP + 4000,
          (point, pos) => onAirPointClickRef.current?.(point, pos),
        )

        // 预警点位标记（alertEvent/list 经纬度，warn-l1~l3 图标，与空气质量打点切换显示）
        alertLayersRef.current = await createAlertLayers(scene, alertPointsRef.current, TEXT_TOP + 4000)

        // 雷达突发告警点（hbdp/leida/alarmPoint，橙/红圆点常显）
        radarAlarmLayersRef.current = await createRadarAlarmLayers(scene, radarAlarmPointsRef.current, TEXT_TOP + 6000)

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
      scene.destroy()
      sceneRef.current = null
      deviceLayersRef.current = null
      airLayersRef.current = null
      alertLayersRef.current = null
      radarAlarmLayersRef.current = null
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

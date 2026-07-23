import { useEffect, useRef } from 'react'
import { Scene, PolygonLayer, LineLayer, PointLayer } from '@antv/l7'
import { Mapbox } from '@antv/l7-maps'

interface ZJ3DMapProps {
  id?: string
  selectedCity?: string
  onCityClick?: (cityName: string, adcode: number) => void
  onCityHover?: (cityName: string | null) => void
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

const radarPoints = [
  { name: '雷达-杭州', lng: 120.21, lat: 30.25 },
  { name: '雷达-宁波', lng: 121.62, lat: 29.90 },
  { name: '雷达-温州', lng: 120.65, lat: 27.95 },
  { name: '雷达-金华', lng: 119.60, lat: 29.12 },
]

const dronePoints = [
  { name: '机场-杭州', lng: 120.30, lat: 30.42 },
  { name: '机场-宁波', lng: 121.48, lat: 29.82 },
  { name: '机场-温州', lng: 120.72, lat: 28.02 },
  { name: '机场-嘉兴', lng: 120.80, lat: 30.75 },
  { name: '机场-绍兴', lng: 120.55, lat: 30.05 },
]

const alertPoints = [
  { name: '预警-临安', lng: 119.72, lat: 30.23, level: 1 },
  { name: '预警-余杭', lng: 120.10, lat: 30.30, level: 2 },
  { name: '预警-萧山', lng: 120.27, lat: 30.18, level: 1 },
  { name: '预警-桐庐', lng: 119.68, lat: 29.80, level: 3 },
]

export default function ZJ3DMap({ id = 'zj3dmap', selectedCity, onCityClick, onCityHover }: ZJ3DMapProps) {
  const sceneRef = useRef<Scene | null>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const selectedOutlineRef = useRef<LineLayer | null>(null)
  const cityFeaturesRef = useRef<any[]>([])
  const selectedCityRef = useRef(selectedCity)
  // 用 ref 保存回调，避免回调变化导致地图重新初始化（闪烁）
  const onCityClickRef = useRef(onCityClick)
  const onCityHoverRef = useRef(onCityHover)

  useEffect(() => {
    onCityClickRef.current = onCityClick
  }, [onCityClick])

  useEffect(() => {
    onCityHoverRef.current = onCityHover
  }, [onCityHover])

  useEffect(() => {
    selectedCityRef.current = selectedCity
    const selectedFeature = cityFeaturesRef.current.find(feature => feature.properties?.name === selectedCity)
    selectedOutlineRef.current?.setData({
      type: 'FeatureCollection',
      features: selectedFeature ? [selectedFeature] : [],
    })
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
    scene.setBgColor('#155ea9')
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
          .style({ heightfixed: true, opacity: 0.7, sourceColor: '#0DCCFF', targetColor: 'rgba(13,204,255,0)' })
        scene.addLayer(wallLayer)

        // 2. 3D 拉伸多边形 (extrude)
        const polygonLayer = new PolygonLayer({ zIndex: 2, autoFit: false })
          .source(citiesRes)
          .shape('extrude')
          .size(50000)
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
            sourceColor: '#0b4e8e',
            targetColor: '#45dfff',
          })
        scene.addLayer(polygonLayer)

        // 3. 底部边界线
        const lineDown = new LineLayer({ zIndex: 3 })
          .source(citiesRes)
          .shape('line')
          .color('#0DCCFF')
          .size(1)
          .style({ raisingHeight: 0, opacity: 0.8 })
        scene.addLayer(lineDown)

        // 4. 顶部边界线
        const lineUp = new LineLayer({ zIndex: 4 })
          .source(citiesRes)
          .shape('line')
          .color('#0DCCFF')
          .size(1.5)
          .style({ raisingHeight: 50000, opacity: 1 })
        scene.addLayer(lineUp)

        // 外部选择器和列表也能驱动同一个清晰的受控选中描边。
        const initialSelected = citiesRes.features.find((feature: any) => feature.properties?.name === selectedCityRef.current)
        const selectedOutline = new LineLayer({ zIndex: 9 })
        selectedOutline
          .source({ type: 'FeatureCollection', features: initialSelected ? [initialSelected] : [] })
          .shape('line')
          .color('#e8fdff')
          .size(4)
          .style({ raisingHeight: 52000, opacity: 1 })
        scene.addLayer(selectedOutline)
        selectedOutlineRef.current = selectedOutline

        // 5. 城市名称文字
        const texts = citiesRes.features.map((f: any) => ({
          name: f.properties.name.replace('市', ''),
          lng: f.properties.centroid[0],
          lat: f.properties.centroid[1],
        }))
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
            raisingHeight: 60000,
            textAllowOverlap: true,
            heightFixed: true,
          })
        scene.addLayer(textLayer)

        // 6. 监测站点标记
        const stationLayer = new PointLayer({ zIndex: 11 })
          .source(stationPoints, { parser: { type: 'json', x: 'lng', y: 'lat' } })
          .shape('circle')
          .size(8)
          .color('#00ff88')
          .style({ opacity: 0.9, strokeWidth: 1, stroke: '#fff' })
        scene.addLayer(stationLayer)

        // 7. 雷达站标记
        const radarLayer = new PointLayer({ zIndex: 11 })
          .source(radarPoints, { parser: { type: 'json', x: 'lng', y: 'lat' } })
          .shape('circle')
          .size(10)
          .color('#a855f7')
          .style({ opacity: 0.9, strokeWidth: 1.5, stroke: '#fff' })
        scene.addLayer(radarLayer)

        // 8. 无人机机场标记
        const droneLayer = new PointLayer({ zIndex: 11 })
          .source(dronePoints, { parser: { type: 'json', x: 'lng', y: 'lat' } })
          .shape('circle')
          .size(8)
          .color('#06b6d4')
          .style({ opacity: 0.9, strokeWidth: 1, stroke: '#fff' })
        scene.addLayer(droneLayer)

        // 9. 预警点位标记
        const alertLayer = new PointLayer({ zIndex: 12 })
          .source(alertPoints, { parser: { type: 'json', x: 'lng', y: 'lat' } })
          .shape('triangle')
          .size(12)
          .color('level', (level: number) => (level === 1 ? '#FF4D4F' : level === 2 ? '#FA8C16' : '#FAAD14'))
          .style({ opacity: 0.95, strokeWidth: 1, stroke: '#fff' })
        scene.addLayer(alertLayer)

        // 10. 悬浮/点击交互 - 单个城市高亮（L7 内置 active/select 逐要素生效，不影响其他市）
        polygonLayer.on('mousemove', (e: any) => {
          const name = e.feature?.properties?.name
          if (name) onCityHoverRef.current?.(name)
        })

        polygonLayer.on('unmousemove', () => {
          onCityHoverRef.current?.(null)
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
      selectedOutlineRef.current = null
      cityFeaturesRef.current = []
    }
  }, [])

  return <div ref={containerRef} id={id} className="w-full h-full" />
}

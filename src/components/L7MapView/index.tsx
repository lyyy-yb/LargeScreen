import { useEffect, useRef } from 'react'
import { Scene, RasterLayer, PointLayer } from '@antv/l7'
import { Map as L7Map } from '@antv/l7-maps'

interface L7MapViewProps {
  id: string
  center?: [number, number]
  zoom?: number
  minZoom?: number
  maxZoom?: number
  className?: string
  /** 是否加载卫星瓦片 */
  showTiles?: boolean
  /** 城市标签数据 */
  cityData?: Array<{ name: string; lng: number; lat: number; [key: string]: any }>
  /** 点位数据 */
  markers?: Array<{ lng: number; lat: number; name: string; color?: string; size?: number }>
  onSceneLoaded?: (scene: Scene) => void
}

export default function L7MapView({
  id,
  center = [120.19382669582967, 30.258134],
  zoom = 10,
  minZoom = 5,
  maxZoom = 16,
  className = '',
  showTiles = true,
  cityData = [],
  markers = [],
  onSceneLoaded,
}: L7MapViewProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const sceneRef = useRef<Scene | null>(null)

  useEffect(() => {
    if (!containerRef.current) return

    const scene = new Scene({
      id: containerRef.current,
      map: new L7Map({
        style: 'blank',
        center,
        zoom,
        minZoom,
        maxZoom,
      }),
      logoVisible: false,
    })

    scene.on('loaded', () => {
      sceneRef.current = scene

      // 加载卫星瓦片
      if (showTiles) {
        const offMapUrl = `${window.location.origin}/offMap/api/tilesets/zjw/{z}/{x}/{y}.jpg`
        const tileLayer = new RasterLayer({ zIndex: 1 }).source(offMapUrl, {
          parser: {
            type: 'rasterTile',
            tileSize: 256,
            zoomOffset: 0,
          },
        })
        scene.addLayer(tileLayer)
      }

      // 城市标签 - 使用 PointLayer 文字
      if (cityData.length > 0) {
        const labelLayer = new PointLayer({ zIndex: 10 })
          .source(cityData, {
            parser: { type: 'json', x: 'lng', y: 'lat' },
          })
          .shape('name', 'text')
          .color('#03FBFD')
          .size(13)
          .style({
            textAnchor: 'center',
            textOffset: [0, 0],
            stroke: '#003366',
            strokeWidth: 2,
            padding: [4, 6],
            textAllowOverlap: false,
          })
        scene.addLayer(labelLayer)

        // 城市点位
        const cityPointLayer = new PointLayer({ zIndex: 9 })
          .source(cityData, {
            parser: { type: 'json', x: 'lng', y: 'lat' },
          })
          .shape('circle')
          .color('#03FBFD')
          .size(6)
          .style({ opacity: 0.8, strokeWidth: 1, stroke: '#ffffff' })
        scene.addLayer(cityPointLayer)
      }

      // 点位标记
      if (markers.length > 0) {
        const pointLayer = new PointLayer({ zIndex: 10 })
          .source(markers, {
            parser: { type: 'json', x: 'lng', y: 'lat' },
          })
          .shape('circle')
          .color('color', (c: string) => c || '#03FBFD')
          .size('size', (s: number) => s || 10)
          .style({ opacity: 0.9, strokeWidth: 1, stroke: '#fff' })
        scene.addLayer(pointLayer)

        // 点位名称标注
        const markerLabelLayer = new PointLayer({ zIndex: 11 })
          .source(markers, {
            parser: { type: 'json', x: 'lng', y: 'lat' },
          })
          .shape('name', 'text')
          .color('#A8D6FF')
          .size(11)
          .style({
            textAnchor: 'bottom',
            textOffset: [0, -8],
            stroke: '#003366',
            strokeWidth: 1.5,
          })
        scene.addLayer(markerLabelLayer)
      }

      onSceneLoaded?.(scene)
    })

    return () => {
      scene.destroy()
      sceneRef.current = null
    }
    // 地图实例按页面挂载一次；路由切换会卸载组件并创建新实例。
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return (
    <div
      id={id}
      ref={containerRef}
      className={`w-full h-full ${className}`}
      style={{ background: '#1a5ab0' }}
    />
  )
}

import { useEffect, useRef } from 'react'
import { Scene, RasterLayer, PointLayer, type ILayer } from '@antv/l7'
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
  /** 点位数据（可携带任意额外字段，点击时随 feature 原样回传） */
  markers?: Array<{ lng: number; lat: number; name: string; color?: string; size?: number; [key: string]: unknown }>
  /** 点位图标 URL（传入则用图片图标替代圆形） */
  markerIconUrl?: string
  /** 地图场景加载完成回调（可用于注册点击事件等） */
  onSceneLoaded?: (scene: Scene) => void
  /** 点位点击回调：feature 为打点原始数据，pos 为相对地图容器的像素坐标 */
  onMarkerClick?: (feature: Record<string, unknown>, pos: { x: number; y: number }) => void
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
  markerIconUrl,
  onSceneLoaded,
  onMarkerClick,
}: L7MapViewProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const sceneRef = useRef<Scene | null>(null)
  const cameraRef = useRef({ center, zoom })
  const markerDataRef = useRef(markers)
  const markerIconRef = useRef(markerIconUrl)
  const onMarkerClickRef = useRef(onMarkerClick)
  useEffect(() => {
    onMarkerClickRef.current = onMarkerClick
  }, [onMarkerClick])
  const markerLayersRef = useRef<Parameters<Scene['removeLayer']>[0][]>([])
  const markerRenderVersionRef = useRef(0)
  const [centerLng, centerLat] = center

  const renderMarkers = async (
    scene: Scene,
    data: NonNullable<L7MapViewProps['markers']>,
    iconUrl?: string,
  ) => {
    const renderVersion = ++markerRenderVersionRef.current
    if (!data.length) {
      // 数据清空时移除所有 marker 图层
      await Promise.all(markerLayersRef.current.map(layer => scene.removeLayer(layer)))
      markerLayersRef.current = []
      return
    }
    if (sceneRef.current !== scene || renderVersion !== markerRenderVersionRef.current) return

    // 增量更新：图标模式（icon）切换才需要重建图层；同 shape 下用 setData 原地刷新
    const existingLayers = markerLayersRef.current
    const useIcon = !!iconUrl
    if (existingLayers.length === 2) {
      const dataArgs = { parser: { type: 'json', x: 'lng', y: 'lat' } } as const
      try {
        existingLayers[0].setData(data, dataArgs)
        existingLayers[1].setData(data, dataArgs)
        if (sceneRef.current !== scene || renderVersion !== markerRenderVersionRef.current) return
        return
      } catch {
        // setData 失败（极端情况）→ 退化到全量重建
      }
    }

    // 全量重建路径
    await Promise.all(existingLayers.map(layer => scene.removeLayer(layer)))
    markerLayersRef.current = []
    if (sceneRef.current !== scene || renderVersion !== markerRenderVersionRef.current) return

    if (useIcon) {
      if (!scene.hasImage('marker-icon')) await scene.addImage('marker-icon', iconUrl!)
      if (sceneRef.current !== scene || renderVersion !== markerRenderVersionRef.current) return
      const pointLayer = new PointLayer({ zIndex: 10 })
        .source(data, {
          parser: { type: 'json', x: 'lng', y: 'lat' },
        })
        .shape('marker-icon')
        .size(22)
      const markerLabelLayer = new PointLayer({ zIndex: 11, enablePicking: false })
        .source(data, {
          parser: { type: 'json', x: 'lng', y: 'lat' },
        })
        .shape('name', 'text')
        .color('#A8D6FF')
        .size(11)
        .style({
          textAnchor: 'top',
          textOffset: [0, -25],
          stroke: '#003366',
          strokeWidth: 1.5,
        })
      scene.addLayer(pointLayer)
      scene.addLayer(markerLabelLayer)
      markerLayersRef.current = [pointLayer, markerLabelLayer]
      bindMarkerClick(pointLayer)
      return
    }

    const pointLayer = new PointLayer({ zIndex: 10 })
      .source(data, {
        parser: { type: 'json', x: 'lng', y: 'lat' },
      })
      .shape('circle')
      .color('color', (color: string) => color || '#03FBFD')
      .size('size', (size: number) => size || 10)
      .style({ opacity: 0.9, strokeWidth: 1, stroke: '#fff' })
    const markerLabelLayer = new PointLayer({ zIndex: 11, enablePicking: false })
      .source(data, {
        parser: { type: 'json', x: 'lng', y: 'lat' },
      })
      .shape('name', 'text')
      .color('#A8D6FF')
      .size(11)
      .style({
        textAnchor: 'top',
        textOffset: [0, -20],
        stroke: '#003366',
        strokeWidth: 1.5,
      })
    scene.addLayer(pointLayer)
    scene.addLayer(markerLabelLayer)
    markerLayersRef.current = [pointLayer, markerLabelLayer]
    bindMarkerClick(pointLayer)
  }

  /** 点位图层点击：回传 feature 原始数据与点击像素坐标（供页面侧锚定弹窗） */
  const bindMarkerClick = (pointLayer: ILayer) => {
    pointLayer.on('click', (e: any) => {
      const feature = e?.feature
      if (!feature || !onMarkerClickRef.current) return
      const pos = typeof e?.x === 'number' && typeof e?.y === 'number' ? { x: e.x, y: e.y } : { x: 0, y: 0 }
      onMarkerClickRef.current(feature as Record<string, unknown>, pos)
    })
  }

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
      const latestCamera = cameraRef.current
      scene.setZoomAndCenter(latestCamera.zoom, latestCamera.center)

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

      void renderMarkers(scene, markerDataRef.current, markerIconRef.current)

      onSceneLoaded?.(scene)
    })

    return () => {
      markerRenderVersionRef.current += 1
      markerLayersRef.current = []
      scene.destroy()
      sceneRef.current = null
    }
    // 地图实例按页面挂载一次；路由切换会卸载组件并创建新实例。
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    const latestCenter: [number, number] = [centerLng, centerLat]
    cameraRef.current = { center: latestCenter, zoom }
    sceneRef.current?.setZoomAndCenter(zoom, latestCenter)
  }, [centerLat, centerLng, zoom])

  useEffect(() => {
    markerDataRef.current = markers
    markerIconRef.current = markerIconUrl
    if (sceneRef.current) void renderMarkers(sceneRef.current, markers, markerIconUrl)
  }, [markerIconUrl, markers])

  return (
    <div
      id={id}
      ref={containerRef}
      className={`w-full h-full ${className}`}
      style={{ background: '#1a5ab0' }}
    />
  )
}

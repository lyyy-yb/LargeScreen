import { useState, useEffect, useRef, useCallback } from 'react'
import { LineLayer, PointLayer, type Scene, type ILayer } from '@antv/l7'
import type { CleanedSensorItem } from './shared'
import { isValidCoordinate } from './shared'

export interface TrajectoryPoint {
  lng: number
  lat: number
  raw: CleanedSensorItem
}

interface FlySegment {
  coord: [[number, number], [number, number]]
  fromIndex: number
  toIndex: number
}

interface UseTrajectoryPlaybackOptions {
  scene: Scene | null
  items: CleanedSensorItem[]
  autoPlay?: boolean
  baseInterval?: number // 基础步进间隔（毫秒），默认 600ms
}

export function useTrajectoryPlayback({
  scene,
  items,
  autoPlay = true,
  baseInterval = 600,
}: UseTrajectoryPlaybackOptions) {
  const [points, setPoints] = useState<TrajectoryPoint[]>([])
  const [currentIndex, setCurrentIndex] = useState(0)
  const [isPlaying, setIsPlaying] = useState(false)
  const [speed, setSpeed] = useState<1 | 2 | 4>(1)

  // 图层引用（对标 AntV L7 官方航向图标准设计）
  const layersRef = useRef<{
    dotPoint?: ILayer // 点位波动雷达波纹圈（#ffed11）
    dashedArc?: ILayer // 底层细虚线航道弧线（#ff6b34, size: 1.5, dash: [5, 5]）
    planeFlyLine?: ILayer // 飞机航向贴图流动弧线（#ff6b34, texture: 'plane'）
    solidArc?: ILayer // 已飞过的实线高亮弧线（#00ff88）
    startCircle?: ILayer
    startLabel?: ILayer
    endCircle?: ILayer
    endLabel?: ILayer
    droneMarker?: ILayer
    droneHalo?: ILayer
  }>({})

  const segmentsRef = useRef<FlySegment[]>([])
  const timerRef = useRef<number | null>(null)
  const currentIndexRef = useRef(0)
  currentIndexRef.current = currentIndex
  const pointsRef = useRef<TrajectoryPoint[]>([])
  pointsRef.current = points
  const isPlayingRef = useRef(false)
  isPlayingRef.current = isPlaying
  const speedRef = useRef(speed)
  speedRef.current = speed

  // 清除所有航线与特效图层
  const clearLayers = useCallback((sc: Scene) => {
    Object.values(layersRef.current).forEach(layer => {
      if (layer) {
        try { sc.removeLayer(layer) } catch { /* ignore */ }
      }
    })
    layersRef.current = {}
    segmentsRef.current = []
  }, [])

  // 解析并初始化轨迹数据
  useEffect(() => {
    const validPoints: TrajectoryPoint[] = []
    items.forEach(item => {
      const lng = parseFloat(String(item.longitude))
      const lat = parseFloat(String(item.latitude))
      if (isValidCoordinate(lng, lat)) {
        validPoints.push({ lng, lat, raw: item })
      }
    })

    setPoints(validPoints)
    setCurrentIndex(0)
    setIsPlaying(false)

    if (timerRef.current) {
      window.clearTimeout(timerRef.current)
      timerRef.current = null
    }

    if (!scene) return

    clearLayers(scene)

    if (validPoints.length === 0) return

    let isCancelled = false

    // 绘制航向图高保真图层（对标 AntV L7 plane_animate2 官方示例）
    const initLayers = async () => {
      // 1. 注册金色飞机贴图
      if (!scene.hasImage('plane')) {
        try {
          await scene.addImage('plane', '/marker/plane.svg')
        } catch {
          try {
            await scene.addImage(
              'plane',
              'https://gw.alipayobjects.com/zos/bmw-prod/0ca1668e-38c2-4010-8568-b57cb33839b9.svg'
            )
          } catch (e) {
            console.warn('飞机纹理加载失败', e)
          }
        }
      }
      if (isCancelled) return

      // 2. 提取不重复的巡航途径点（用于波纹动画圈）
      const uniqueWaypoints: { lng: number; lat: number }[] = []
      validPoints.forEach((p, i) => {
        if (i === 0 || p.lng !== validPoints[i - 1].lng || p.lat !== validPoints[i - 1].lat) {
          uniqueWaypoints.push({ lng: p.lng, lat: p.lat })
        }
      })

      // 3. 构建起降与航向之间的弧线段
      const segments: FlySegment[] = []
      for (let i = 0; i < validPoints.length - 1; i++) {
        const p1 = validPoints[i]
        const p2 = validPoints[i + 1]
        if (p1.lng !== p2.lng || p1.lat !== p2.lat) {
          segments.push({
            coord: [
              [p1.lng, p1.lat],
              [p2.lng, p2.lat],
            ],
            fromIndex: i,
            toIndex: i + 1,
          })
        }
      }
      segmentsRef.current = segments

      const startCoord = [validPoints[0].lng, validPoints[0].lat] as [number, number]
      const endCoord = [
        validPoints[validPoints.length - 1].lng,
        validPoints[validPoints.length - 1].lat,
      ] as [number, number]

      // 4. 点位波动波纹光圈（官方 dotPoint: shape('circle').animate(true).size(36).color('#ffed11')）
      if (uniqueWaypoints.length > 0) {
        const dotPoint = new PointLayer({ zIndex: 11, enablePicking: false })
          .source(uniqueWaypoints, {
            parser: { type: 'json', x: 'lng', y: 'lat' },
          })
          .shape('circle')
          .color('#ffed11')
          .animate(true)
          .size(36)
        scene.addLayer(dotPoint)
        layersRef.current.dotPoint = dotPoint
      }

      // 5. 底层精致虚线航线弧线（官方 flyLine2: color('#ff6b34').shape('arc').size(1.5).dashArray([5, 5])）
      if (segments.length > 0) {
        const dashedArc = new LineLayer({ zIndex: 12, enablePicking: false })
          .source(segments, {
            parser: { type: 'json', coordinates: 'coord' },
          })
          .color('#ff6b34')
          .shape('arc')
          .size(1.5)
          .style({
            lineType: 'dash',
            dashArray: [5, 5],
            opacity: 0.65,
          })
        scene.addLayer(dashedArc)
        layersRef.current.dashedArc = dashedArc

        // 6. 航向动态流动线（官方 flyLine: texture('plane').shape('arc').size(15).animate(...)）
        const planeFlyLine = new LineLayer({ zIndex: 13, blend: 'normal', enablePicking: false })
          .source(segments, {
            parser: { type: 'json', coordinates: 'coord' },
          })
          .color('#ff6b34')
          .texture('plane')
          .shape('arc')
          .size(16)
          .animate({
            duration: 1.8,
            interval: 0.2,
            trailLength: 0.05,
          })
          .style({
            textureBlend: 'replace',
            lineTexture: true,
            iconStep: 10,
          })
        scene.addLayer(planeFlyLine)
        layersRef.current.planeFlyLine = planeFlyLine

        // 7. 走过的弧线路径：使用高亮绿金色实线弧线（初始为空）
        const solidArc = new LineLayer({ zIndex: 15, enablePicking: false })
          .source([], {
            parser: { type: 'json', coordinates: 'coord' },
          })
          .color('#00ff88')
          .shape('arc')
          .size(2.5)
          .style({
            lineType: 'solid',
            opacity: 0.95,
          })
        scene.addLayer(solidArc)
        layersRef.current.solidArc = solidArc
      }

      // 8. 起始点立体标识徽标（绿色高亮，中心居中“起”）
      const startCircle = new PointLayer({ zIndex: 16, enablePicking: false })
        .source([{ lng: startCoord[0], lat: startCoord[1] }], {
          parser: { type: 'json', x: 'lng', y: 'lat' },
        })
        .shape('circle')
        .size(16)
        .color('#00ff88')
        .style({ stroke: '#ffffff', strokeWidth: 2, opacity: 0.95 })
      scene.addLayer(startCircle)
      layersRef.current.startCircle = startCircle

      const startLabel = new PointLayer({ zIndex: 17, enablePicking: false })
        .source([{ lng: startCoord[0], lat: startCoord[1], name: '起' }], {
          parser: { type: 'json', x: 'lng', y: 'lat' },
        })
        .shape('name', 'text')
        .size(10)
        .color('#003881')
        .style({ textAnchor: 'center', fontWeight: 'bold' })
      scene.addLayer(startLabel)
      layersRef.current.startLabel = startLabel

      // 9. 终点立体标识徽标（橙红色高亮，中心居中“终”）
      if (validPoints.length >= 2) {
        const endCircle = new PointLayer({ zIndex: 16, enablePicking: false })
          .source([{ lng: endCoord[0], lat: endCoord[1] }], {
            parser: { type: 'json', x: 'lng', y: 'lat' },
          })
          .shape('circle')
          .size(16)
          .color('#ff4d4f')
          .style({ stroke: '#ffffff', strokeWidth: 2, opacity: 0.95 })
        scene.addLayer(endCircle)
        layersRef.current.endCircle = endCircle

        const endLabel = new PointLayer({ zIndex: 17, enablePicking: false })
          .source([{ lng: endCoord[0], lat: endCoord[1], name: '终' }], {
            parser: { type: 'json', x: 'lng', y: 'lat' },
          })
          .shape('name', 'text')
          .size(10)
          .color('#ffffff')
          .style({ textAnchor: 'center', fontWeight: 'bold' })
        scene.addLayer(endLabel)
        layersRef.current.endLabel = endLabel
      }

      // 10. 当前执行任务的无人机高精打点（附带呼吸光环）
      const droneHalo = new PointLayer({ zIndex: 19, enablePicking: false })
        .source([{ lng: startCoord[0], lat: startCoord[1] }], {
          parser: { type: 'json', x: 'lng', y: 'lat' },
        })
        .shape('circle')
        .size(24)
        .color('#00ff88')
        .animate(true)
      scene.addLayer(droneHalo)
      layersRef.current.droneHalo = droneHalo

      const droneMarker = new PointLayer({ zIndex: 20, enablePicking: false })
        .source([{ lng: startCoord[0], lat: startCoord[1] }], {
          parser: { type: 'json', x: 'lng', y: 'lat' },
        })
        .shape(scene.hasImage('plane') ? 'plane' : 'circle')
        .size(20)
        .color('#f4ea2a')
      scene.addLayer(droneMarker)
      layersRef.current.droneMarker = droneMarker

      // 11. 3D 俯仰视角倾斜与镜头自适应（设置 pitch: 38° 呈现逼真的立体航向弧线视角）
      try {
        scene.setPitch(38)
      } catch {
        /* ignore */
      }

      const lngs = validPoints.map(p => p.lng)
      const lats = validPoints.map(p => p.lat)
      const minLng = Math.min(...lngs)
      const maxLng = Math.max(...lngs)
      const minLat = Math.min(...lats)
      const maxLat = Math.max(...lats)
      const center: [number, number] = [(minLng + maxLng) / 2, (minLat + maxLat) / 2]
      const span = Math.max(maxLng - minLng, (maxLat - minLat) * 1.5)
      let zoom = 14
      if (span > 0.5) zoom = 10
      else if (span > 0.2) zoom = 11
      else if (span > 0.08) zoom = 12
      else if (span > 0.03) zoom = 13
      else zoom = 14.2

      scene.setZoom(zoom)
      scene.panTo(center)

      if (autoPlay && validPoints.length > 1) {
        setIsPlaying(true)
      }
    }

    void initLayers()

    return () => {
      isCancelled = true
      clearLayers(scene)
    }
  }, [items, scene, autoPlay, clearLayers])

  // 更新指定动画步进的图层状态
  const updateStepLayers = useCallback((index: number) => {
    const pts = pointsRef.current
    if (!pts.length) return
    const curPt = pts[index]
    if (!curPt) return

    // 更新当前巡航无人机与光环位置
    const drone = layersRef.current.droneMarker
    if (drone) {
      drone.setData([{ lng: curPt.lng, lat: curPt.lat }], {
        parser: { type: 'json', x: 'lng', y: 'lat' },
      })
    }
    const halo = layersRef.current.droneHalo
    if (halo) {
      halo.setData([{ lng: curPt.lng, lat: curPt.lat }], {
        parser: { type: 'json', x: 'lng', y: 'lat' },
      })
    }

    // 更新走过的弧线（实线高亮）
    const segs = segmentsRef.current
    const completedSegs = segs.filter(s => s.toIndex <= index)
    const solid = layersRef.current.solidArc
    if (solid) {
      solid.setData(completedSegs, {
        parser: { type: 'json', coordinates: 'coord' },
      })
    }

    // 更新尚未走过的弧线（虚线与贴图飞机在未走路段继续流动）
    const remainingSegs = segs.filter(s => s.toIndex > index)
    const dashed = layersRef.current.dashedArc
    if (dashed) {
      dashed.setData(remainingSegs, {
        parser: { type: 'json', coordinates: 'coord' },
      })
    }
    const flyLine = layersRef.current.planeFlyLine
    if (flyLine) {
      flyLine.setData(remainingSegs, {
        parser: { type: 'json', coordinates: 'coord' },
      })
    }
  }, [])

  // 动画步进时钟驱动
  useEffect(() => {
    if (!isPlaying) {
      if (timerRef.current) {
        window.clearTimeout(timerRef.current)
        timerRef.current = null
      }
      return
    }

    const pts = pointsRef.current
    if (pts.length <= 1) return

    const tick = () => {
      const current = currentIndexRef.current
      if (current >= pts.length - 1) {
        setIsPlaying(false)
        return
      }
      const nextIndex = current + 1
      setCurrentIndex(nextIndex)
      updateStepLayers(nextIndex)

      if (nextIndex < pts.length - 1) {
        const interval = Math.max(100, Math.round(baseInterval / speedRef.current))
        timerRef.current = window.setTimeout(tick, interval)
      } else {
        setIsPlaying(false)
      }
    }

    const interval = Math.max(100, Math.round(baseInterval / speedRef.current))
    timerRef.current = window.setTimeout(tick, interval)

    return () => {
      if (timerRef.current) {
        window.clearTimeout(timerRef.current)
        timerRef.current = null
      }
    }
  }, [isPlaying, speed, baseInterval, updateStepLayers])

  // 播放控制
  const play = useCallback(() => {
    if (currentIndex >= points.length - 1) {
      setCurrentIndex(0)
      updateStepLayers(0)
    }
    setIsPlaying(true)
  }, [currentIndex, points.length, updateStepLayers])

  const pause = useCallback(() => {
    setIsPlaying(false)
  }, [])

  const reset = useCallback(() => {
    setIsPlaying(false)
    setCurrentIndex(0)
    updateStepLayers(0)
  }, [updateStepLayers])

  const seek = useCallback((targetIndex: number) => {
    const pts = pointsRef.current
    if (!pts.length) return
    const safeIndex = Math.max(0, Math.min(targetIndex, pts.length - 1))
    setCurrentIndex(safeIndex)
    updateStepLayers(safeIndex)
  }, [updateStepLayers])

  return {
    points,
    currentPoint: points[currentIndex] || null,
    currentIndex,
    totalPoints: points.length,
    isPlaying,
    speed,
    play,
    pause,
    reset,
    seek,
    setSpeed,
  }
}

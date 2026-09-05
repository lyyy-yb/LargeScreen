/** 圆形影像底图 + 淡紫色蒙层 + 连续热力；行政区数据仅用于定位，不绘制边界。 */
import { useEffect, useMemo, useRef } from 'react'
import { HeatmapLayer, Scene, type ILayer } from '@antv/l7'
import { Mapbox } from '@antv/l7-maps'
import type { Dayjs } from 'dayjs'
import type { CityItem, DistrictItem } from '@/utils/city'
import {
  HEATMAP_RAMP_COLORS,
  HEATMAP_RAMP_POSITIONS,
  normalizeHeatWeights,
  type HeatPoint,
} from '../utils/heatScale'
import type { AirStationViewModel, PollutantKey } from '../types'
import MapPanelHeader from '@/components/MapPanelHeader'
import { POLLUTANT_BY_KEY } from '../constants'
import { addSatelliteTiles } from '@/utils/mapSatelliteTiles'

interface AirHeatmapPanelProps {
  stations: AirStationViewModel[]
  activePollutant: PollutantKey
  timeRange: [Dayjs, Dayjs] | null
  currentFrameValuesByDevice: Record<string, Record<PollutantKey, number | null>>
  isProvinceView: boolean
  activeCity?: CityItem
  activeCounty?: DistrictItem
}

interface GeoFeature {
  type: 'Feature'
  properties?: Record<string, unknown>
  geometry?: Record<string, unknown>
}

interface GeoCollection {
  type: 'FeatureCollection'
  features: GeoFeature[]
}

const EMPTY_COLLECTION: GeoCollection = { type: 'FeatureCollection', features: [] }

function regionBounds(geometry: GeoCollection): [[number, number], [number, number]] | null {
  let west = Infinity, south = Infinity, east = -Infinity, north = -Infinity
  const visit = (coordinates: unknown): void => {
    if (!Array.isArray(coordinates)) return
    if (typeof coordinates[0] === 'number' && typeof coordinates[1] === 'number') {
      const [lng, lat] = coordinates
      if (!Number.isFinite(lng) || !Number.isFinite(lat)) return
      west = Math.min(west, lng); east = Math.max(east, lng)
      south = Math.min(south, lat); north = Math.max(north, lat)
    } else coordinates.forEach(visit)
  }
  geometry.features.forEach(feature => visit(feature.geometry?.coordinates))
  return Number.isFinite(west) ? [[west, south], [east, north]] : null
}

async function loadRegionGeometry(
  isProvinceView: boolean,
  activeCity?: CityItem,
  activeCounty?: DistrictItem,
): Promise<GeoCollection> {
  if (isProvinceView) {
    return fetch('/map/zhejiang_wall.json').then(response => response.json() as Promise<GeoCollection>)
  }
  if (activeCounty) {
    if (activeCounty.name.includes('智造新城') || String(activeCounty.adcode) === '330899') {
      return fetch('/map/zhizao_newcity.json').then(response => response.json() as Promise<GeoCollection>)
    }
    const cityDistricts = await fetch(`/map/${activeCounty.parent}_full.json`)
      .then(response => response.json() as Promise<GeoCollection>)
    const feature = cityDistricts.features.find(item =>
      String(item.properties?.adcode) === String(activeCounty.adcode),
    )
    return feature ? { type: 'FeatureCollection', features: [feature] } : EMPTY_COLLECTION
  }
  if (activeCity) {
    return fetch(`/map/${activeCity.adcode}.json`).then(response => response.json() as Promise<GeoCollection>)
  }
  return EMPTY_COLLECTION
}

function getCenter(isProvinceView: boolean, activeCity?: CityItem, activeCounty?: DistrictItem): [number, number] {
  if (activeCounty) return [activeCounty.lng, activeCounty.lat]
  if (activeCity) return [activeCity.lng, activeCity.lat]
  if (isProvinceView) return [120.2, 29.3]
  return [120.2, 29.3]
}

export default function AirHeatmapPanel({
  stations,
  activePollutant,
  timeRange,
  currentFrameValuesByDevice,
  isProvinceView,
  activeCity,
  activeCounty,
}: AirHeatmapPanelProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const sceneRef = useRef<Scene | null>(null)
  const heatLayerRef = useRef<ILayer | null>(null)
  const pointsRef = useRef<HeatPoint[]>([])

  const { points, scale } = useMemo(() => {
    const values = stations.map(station => {
      if (timeRange) {
        return currentFrameValuesByDevice[station.deviceId]?.[activePollutant] ?? null
      }
      return station.values[activePollutant]
    })
    const normalized = normalizeHeatWeights(values)
    return {
      points: stations
        .filter(station => Number.isFinite(station.lng) && Number.isFinite(station.lat))
        .map((station, index) => ({
          lng: station.lng,
          lat: station.lat,
          weight: normalized.weights[index] ?? 0.1,
          value: values[index] == null || !Number.isFinite(Number(values[index])) ? null : Number(values[index]),
        })),
      scale: normalized.scale,
    }
  }, [stations, activePollutant, timeRange, currentFrameValuesByDevice])

  const scopeKey = isProvinceView
    ? 'province'
    : activeCounty
      ? `county-${activeCounty.adcode}`
      : activeCity
        ? `city-${activeCity.adcode}`
        : 'unknown'

  useEffect(() => {
    const container = containerRef.current
    if (!container) return
    let disposed = false
    const scene = new Scene({
      id: container,
      logoVisible: false,
      map: new Mapbox({
        style: 'blank',
        center: getCenter(isProvinceView, activeCity, activeCounty),
        zoom: isProvinceView ? 5.4 : activeCounty ? 8.4 : 7,
        pitch: 0,
        rotation: 0,
        minZoom: 3,
        maxZoom: 16,
      }),
    })
    sceneRef.current = scene
    scene.setBgColor('rgba(5, 35, 67, 0.58)')

    scene.on('loaded', async () => {
      if (disposed) return
      scene.setMapStatus({
        dragEnable: false,
        zoomEnable: false,
        rotateEnable: false,
        doubleClickZoom: false,
      })
      addSatelliteTiles(scene, { zIndex: 0, opacity: 0.7 })
      try {
        const geometry = await loadRegionGeometry(isProvinceView, activeCity, activeCounty)
        if (disposed) return
        const bounds = regionBounds(geometry)
        if (bounds) scene.fitBounds(bounds, { padding: 12, animate: false })
      } catch (error) {
        console.warn('[air-quality] 热力图区域矢量底图加载失败', error)
      }
      if (disposed) return
      const heatLayer = new HeatmapLayer({ zIndex: 5, enablePicking: false })
        .source(pointsRef.current, { parser: { type: 'json', x: 'lng', y: 'lat' } })
        .shape('heatmap')
        .size('weight', [0, 1])
        .style({
          intensity: 1.3,
          radius: 30,
          opacity: 0.78,
          rampColors: {
            colors: HEATMAP_RAMP_COLORS,
            positions: HEATMAP_RAMP_POSITIONS,
          },
        })
      scene.addLayer(heatLayer)
      heatLayerRef.current = heatLayer
    })

    return () => {
      disposed = true
      heatLayerRef.current = null
      sceneRef.current = null
      scene.destroy()
    }
  }, [scopeKey, isProvinceView, activeCity, activeCounty])

  useEffect(() => {
    pointsRef.current = points
    heatLayerRef.current?.setData(points, { parser: { type: 'json', x: 'lng', y: 'lat' } })
  }, [points])

  return (
    <div className="screen-glass-panel air-quality-heatmap-panel p-3 overflow-hidden flex flex-col">
      <MapPanelHeader title="热力分布" extra={<span>{POLLUTANT_BY_KEY[activePollutant].label}</span>} />
      <div className="air-heatmap-viewport"><div className="air-quality-heatmap-stage">
        <div ref={containerRef} className="air-quality-heatmap-map" />
        <div className="air-heatmap-tint" />
      </div></div>
      <div className="air-heatmap-legend-title">参考浓度区间（{POLLUTANT_BY_KEY[activePollutant].unit}）</div>
      <div className="air-quality-heatmap-legend" title="按最大浓度归一化的参考区间；地图热力为周边点位平滑叠加，非逐像素实测浓度。缺测权重按 0.1 保底。">
        {scale.max > 0 ? scale.stops.map((stop, index) => (
          <span key={stop.ratio} className="flex items-center gap-0.5">
            <span className="air-quality-heatmap-legend-swatch" style={{ background: stop.color }} />
            <span>{index === 0 ? '0' : `>${scale.stops[index - 1].value.toFixed(1)}`}–{stop.value.toFixed(1)}</span>
          </span>
        )) : <span>暂无正值数据 · 仅展示保底热力</span>}
      </div>
    </div>
  )
}

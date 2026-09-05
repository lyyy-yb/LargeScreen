/** 空气质量大屏页面主入口
 *  - 沿用 monitor 页面骨架：左/中/右三栏
 *  - 8 项污染物 tab 切换（默认 PM2.5）
 *  - 三级地图 + 关闭区域外蒙层
 *  - 数据源分页 + airData/latest 合并成 AirStationViewModel
 *  - 时间范围 + 单次播放器
 *  - 右侧范围 + 热力图
 *  - 左栏 4 等级预警 + 20 条
 */
import { useEffect, useMemo, useRef, useState } from 'react'
import { Spin } from 'antd'
import { type Dayjs } from 'dayjs'
import './index.less'
import { useAppStore } from '@/stores'
import { useRegionSelection } from '@/pages/monitor/hooks/useRegionSelection'
import ZJ3DMap from '@/components/ZJ3DMap'
import CityDistrictMap from '@/components/CityDistrictMap'
import CountyBoundaryMap from '@/components/CountyBoundaryMap'
import { flattenDepts, findCityDeptId, findDistrictDeptId } from '@/utils/airQuality'
import { airDataLatest } from '@/servers/airData'
import type { AirDataLatestVO } from '@/types/airData'
import type { AlertEventDTO } from '@/types/business'
import type { MapFocusTarget } from '@/types/mapFocus'
import { buildAirStations, fetchAllAirSources, type BuildAirStationsInput } from './data/airQualityRepository'
import { createMockAirPlaybackProvider } from './data/mockAirPlaybackProvider'
import type { AirPlaybackFrame, AirStationViewModel, PollutantKey } from './types'
import { toHistoryQuery, type AirAggregation } from './utils/aggregation'
import AirAveragePanel from './panels/AirAveragePanel'
import { DEFAULT_POLLUTANT } from './constants'
import PollutantTabs from './components/PollutantTabs'
import AirStationConcentrationPopup from './popups/AirStationConcentrationPopup'
import AirQualityAlertPanel from './panels/AirQualityAlertPanel'
import AirTimePlayer from './components/AirTimePlayer'
import AirComparePanel from './panels/AirComparePanel'
import AirHeatmapPanel from './panels/AirHeatmapPanel'
import MapPopupPortal from '@/components/MapPopupPortal'

/** 把数据源记录转成 mapAirLayers 需要的 AirQualityPoint 形状。 */
function toAirQualityPoint(station: AirStationViewModel, tab: PollutantKey) {
  return {
    stationType: station.stationType === 'fixed' || station.stationType === 'mobile' ? station.stationType : undefined,
    name: station.name,
    richLabel: { prefix: station.stationType === 'fixed' ? '固' : station.stationType === 'mobile' ? '移' : '?', value: station.values[tab] == null ? '--' : String(Math.round(station.values[tab]! * 10) / 10) },
    lng: station.lng,
    lat: station.lat,
    value: station.aqi,
    iaqi: null,
    id: station.dataSourceId,
    aqiLevel: station.aqiLevel,
    detailEnabled: true,
  }
}

export default function AirQuality() {
  const { regionContext } = useAppStore()
  const {
    selection,
    isProvinceView,
    activeCity,
    activeCounty,
  } = useRegionSelection()

  const [activePollutant, setActivePollutant] = useState<PollutantKey>(DEFAULT_POLLUTANT)
  const [stations, setStations] = useState<AirStationViewModel[]>([])
  const [averageRecords, setAverageRecords] = useState<AirDataLatestVO[]>([])
  const [focusTarget, setFocusTarget] = useState<MapFocusTarget | null>(null)
  const [stationLoading, setStationLoading] = useState(false)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [activeStation, setActiveStation] = useState<{ station: AirStationViewModel; pos?: { x: number; y: number } } | null>(null)
  const [comparedDeviceIds, setComparedDeviceIds] = useState<Set<string>>(new Set())
  // 全页面唯一时间范围 + 回放状态
  const [timeRange, setTimeRange] = useState<[Dayjs, Dayjs] | null>(null)
  const [aggregation, setAggregation] = useState<AirAggregation>('hourly')
  const [playbackStations, setPlaybackStations] = useState<AirStationViewModel[]>([])
  const [frames, setFrames] = useState<AirPlaybackFrame[]>([])
  const [currentFrameIdx, setCurrentFrameIdx] = useState(0)
  const [playbackLoading, setPlaybackLoading] = useState(false)
  const [isMockPlayback, setIsMockPlayback] = useState(false)

  const allDepts = useMemo(
    () => flattenDepts(regionContext?.departments ?? []),
    [regionContext?.departments],
  )

  // 站点元数据 + 当前浓度（airDataLatest 是上一完整小时均值）
  useEffect(() => {
    let cancelled = false
    const loadStations = async (silent = false) => {
      if (!silent) {
        setStationLoading(true)
        setLoadError(null)
      }
      const cityDeptId = findCityDeptId(allDepts, selection?.cityName)
      const districtDeptId = selection?.countyName
        ? findDistrictDeptId(allDepts, selection.countyName, selection.cityName)
        : undefined
      const query: Parameters<typeof fetchAllAirSources>[0] = { needAqi: 1, dataType: 'air_quality_station' }
      if (districtDeptId != null) query.districtId = Number(districtDeptId)
      else if (cityDeptId != null) query.cityId = Number(cityDeptId)

      const [srcRes, latestRes] = await Promise.allSettled([
        fetchAllAirSources(query),
        airDataLatest({ dataType: 'air_quality_station' }),
      ])
      if (cancelled) return
      if (srcRes.status === 'rejected') {
        setLoadError(srcRes.reason instanceof Error ? srcRes.reason.message : '站点列表请求失败')
        if (!silent) { setStations([]); setAverageRecords([]) }
        setStationLoading(false)
        return
      }
      if (latestRes.status === 'rejected' && silent) {
        setLoadError(latestRes.reason instanceof Error ? latestRes.reason.message : '站点当前浓度请求失败')
        return
      }
      const latest: AirDataLatestVO[] = latestRes.status === 'fulfilled' && Array.isArray(latestRes.value?.data)
        ? latestRes.value.data
        : []
      const input: BuildAirStationsInput = { sources: srcRes.value, latest }
      const sourceCodes = new Set(srcRes.value.map(source => source.deviceId?.trim()))
      setAverageRecords(latest.filter(row => sourceCodes.has(row.mnCode?.trim())))
      const merged = buildAirStations(input)
      const validDeviceIds = new Set(merged.map(station => station.deviceId))
      setStations(merged)
      setComparedDeviceIds(previous => {
        const next = new Set([...previous].filter(deviceId => validDeviceIds.has(deviceId)))
        return next.size === previous.size ? previous : next
      })
      setLoadError(latestRes.status === 'rejected' ? '站点当前浓度请求失败' : null)
      setStationLoading(false)
    }
    void loadStations()
    const timer = window.setInterval(() => { void loadStations(true) }, 3 * 60 * 1000)
    return () => { cancelled = true; window.clearInterval(timer) }
  }, [selection, allDepts])

  // 当前帧值映射：deviceId → Record<PollutantKey, number | null>；无帧时退化为 station.values
  const currentFrameValuesByDevice = useMemo(() => {
    const out: Record<string, Record<PollutantKey, number | null>> = {}
    if (frames.length > 0 && currentFrameIdx < frames.length) {
      const frame = frames[currentFrameIdx]
      stations.forEach(s => {
        out[s.deviceId] = frame.valuesByDeviceId[s.deviceId] ?? s.values
      })
      return out
    }
    stations.forEach(s => { out[s.deviceId] = s.values })
    return out
  }, [frames, currentFrameIdx, stations])

  // 地图点位必须读取当前播放帧；无回放时 currentFrameValuesByDevice 已退化为真实当前值。
  const airPoints = useMemo(
    () => stations.map(station => toAirQualityPoint({
      ...station,
      values: currentFrameValuesByDevice[station.deviceId] ?? station.values,
    }, activePollutant)),
    [stations, currentFrameValuesByDevice, activePollutant],
  )

  // dataSourceId → station 索引，用于点击点位时反查
  const stationByDsId = useMemo(() => {
    const map = new Map<number, AirStationViewModel>()
    stations.forEach(s => { if (s.dataSourceId) map.set(s.dataSourceId, s) })
    return map
  }, [stations])

  const handleAirPointClick = (point: { id?: number }, pos?: { x: number; y: number }) => {
    if (point?.id == null) return
    const station = stationByDsId.get(point.id)
    if (!station) return
    setActiveStation({ station, pos })
  }

  const handleCompareToggle = (deviceId: string, checked: boolean) => {
    setComparedDeviceIds(prev => {
      const next = new Set(prev)
      if (checked) next.add(deviceId); else next.delete(deviceId)
      return next
    })
  }

  const activeStationCompared = activeStation ? comparedDeviceIds.has(activeStation.station.deviceId) : false

  const handleTimeRangeChange = (nextRange: [Dayjs, Dayjs] | null) => {
    setTimeRange(nextRange)
    setPlaybackStations(nextRange ? stations : [])
    setFrames([])
    setCurrentFrameIdx(0)
    setPlaybackLoading(false)
    setIsMockPlayback(false)
  }

  const handleAlertLocate = (item: AlertEventDTO) => {
    const station = stations.find(station => station.deviceId === item.deviceId)
    const lng = item.lng == null ? station?.lng : Number(item.lng)
    const lat = item.lat == null ? station?.lat : Number(item.lat)
    if (lng == null || lat == null || !Number.isFinite(lng) || !Number.isFinite(lat) || Math.abs(lng) > 180 || Math.abs(lat) > 90) return
    setActiveStation(null)
    setFocusTarget({ lng, lat, zoom: 16, animate: true, requestId: Date.now() })
  }

  // 时间范围变化 → 通过 mock provider 拉取全站回放帧（C 阶段；后端批量接口就位后换 apiAirPlaybackProvider）
  const mockProviderRef = useRef(createMockAirPlaybackProvider())
  useEffect(() => {
    if (!timeRange) return
    let cancelled = false
    const loadFrames = async () => {
      setPlaybackLoading(true)
      try {
        const result = await mockProviderRef.current.getFrames(toHistoryQuery(timeRange, aggregation), playbackStations)
        if (cancelled) return
        setFrames(result)
        setCurrentFrameIdx(0)
        setIsMockPlayback(true)
        setPlaybackLoading(false)
      } catch (error) {
        if (cancelled) return
        console.warn('[air-quality] 回放帧生成失败', error)
        setFrames([])
        setIsMockPlayback(false)
        setPlaybackLoading(false)
      }
    }
    void loadFrames()
    return () => { cancelled = true }
  }, [timeRange, aggregation, playbackStations])

  const currentFrameTime = frames[currentFrameIdx]?.startTime

  // 对比选站列表（按选择顺序）
  const comparedStations = useMemo(
    () => stations.filter(s => comparedDeviceIds.has(s.deviceId)),
    [stations, comparedDeviceIds],
  )

  return (
    <div className={`air-quality-screen${comparedStations.length ? ' has-comparison' : ''}`}>
      {/* 主地图铺满（仿 monitor 布局） */}
      <div className="air-quality-map-stage">
        {isProvinceView ? (
          <ZJ3DMap
            focusTarget={focusTarget}
            maxZoom={17}
            airPoints={airPoints}
            showAirPoints
            showDronePoints={false}
            showRadarPoints={false}
            showEmissionOutletPoints={false}
            showAlertPoints={false}
            showRegionMask={false}
            showBoundary={false}
            onAirPointClick={handleAirPointClick}
          />
        ) : activeCounty ? (
          <CountyBoundaryMap
            focusTarget={focusTarget}
            county={activeCounty}
            airPoints={airPoints}
            showAirPoints
            showDronePoints={false}
            showRadarPoints={false}
            showEmissionOutletPoints={false}
            showAlertPoints={false}
            showRegionMask={false}
            showBoundary={false}
            onAirPointClick={handleAirPointClick}
          />
        ) : activeCity ? (
          <CityDistrictMap
            focusTarget={focusTarget}
            city={activeCity}
            districtItems={[]}
            airPoints={airPoints}
            showAirPoints
            showDronePoints={false}
            showRadarPoints={false}
            showEmissionOutletPoints={false}
            showAlertPoints={false}
            showRegionMask={false}
            showBoundary={false}
            onAirPointClick={handleAirPointClick}
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-[#dffbff]">区域地图加载失败</div>
        )}

        {/* 顶部 8 项污染物 tab（浮在地图上） */}
        <div className="air-quality-topbar map-overlay-toolbar">
          <PollutantTabs active={activePollutant} onChange={setActivePollutant} />
        </div>

        {/* 加载态 / 错误态 */}
        {stationLoading && (
          <div className="absolute top-12 left-1/2 -translate-x-1/2 z-30 text-[#7eb5de] text-12px flex items-center gap-1.5 bg-[rgba(4,22,52,0.78)] px-2 py-1 rounded">
            <Spin size="small" /> 站点数据加载中…
          </div>
        )}
        {loadError && !stationLoading && (
          <div className="absolute top-12 left-1/2 -translate-x-1/2 z-30 text-[#ff7a45] text-12px bg-[rgba(4,22,52,0.78)] px-2 py-1 rounded">
            站点数据加载失败：{loadError}
          </div>
        )}

        {/* 点位 popup */}
        {activeStation && (
          <MapPopupPortal>
          <AirStationConcentrationPopup
            key={activeStation.station.deviceId}
            station={activeStation.station}
            pos={activeStation.pos}
            onClose={() => setActiveStation(null)}
            compared={activeStationCompared}
            onCompareToggle={handleCompareToggle}
            liveValues={isMockPlayback && frames.length > 0
              ? currentFrameValuesByDevice[activeStation.station.deviceId] ?? activeStation.station.values
              : null}
            isPlayback={isMockPlayback && frames.length > 0}
          />
          </MapPopupPortal>
        )}
      </div>

      {/* 左栏：浮在地图上 */}
      <aside className="air-quality-side air-quality-side-left">
        <div className="screen-glass-panel flex-1 min-h-0 p-3 overflow-hidden flex flex-col">
          <AirQualityAlertPanel onLocate={handleAlertLocate} />
        </div>
      </aside>

      {/* 右栏：浮在地图上 */}
      <aside className="air-quality-side air-quality-side-right">
        <AirAveragePanel records={averageRecords} loading={stationLoading} error={loadError} />
        <AirHeatmapPanel
          stations={stations}
          activePollutant={activePollutant}
          timeRange={timeRange}
          currentFrameValuesByDevice={currentFrameValuesByDevice}
          isProvinceView={isProvinceView}
          activeCity={activeCity}
          activeCounty={activeCounty}
        />
      </aside>

      {/* 底部播放器：浮在地图底部居中 */}
      <div className="air-quality-bottombar">
        <AirTimePlayer
          key={aggregation}
          aggregation={aggregation}
          onAggregationChange={type => { setAggregation(type); handleTimeRangeChange(null) }}
          timeRange={timeRange}
          onTimeRangeChange={handleTimeRangeChange}
          currentFrameIdx={currentFrameIdx}
          frameCount={frames.length}
          currentFrameTime={currentFrameTime}
          loading={playbackLoading}
          onFrameChange={setCurrentFrameIdx}
        />
      </div>

      {/* 对比区在共用时间控件下方，关闭后时间控件自动回到底部。 */}
      {comparedStations.length > 0 && (
        <div className="air-quality-compare screen-glass-panel">
          <AirComparePanel
            aggregation={aggregation}
            stations={comparedStations}
            activePollutant={activePollutant}
            timeRange={timeRange}
            onClose={() => setComparedDeviceIds(new Set())}
            onRemoveStation={deviceId => handleCompareToggle(deviceId, false)}
          />
        </div>
      )}
    </div>
  )
}

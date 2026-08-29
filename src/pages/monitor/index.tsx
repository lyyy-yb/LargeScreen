import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import CityDistrictMap from '@/components/CityDistrictMap'
import CountyBoundaryMap from '@/components/CountyBoundaryMap'
import ZJ3DMap from '@/components/ZJ3DMap'
import { useAppStore } from '@/stores'
import { cities, districts } from '@/utils/city'
import type { RegionSelection } from '@/types/region'
import { toRegionQuery } from '@/utils/region'
import {
  dockList,
  leidaList,
  listFlyJob,
  alarmPointTop5,
  emissionOutletList,
  globalSearch,
  type GlobalSearchItem,
} from '@/servers/mapBox'
import { leiDaBaojingTongji } from '@/servers/api'
import { getDockModeLabel, getDockModeColor, getDockOnlineStatus } from '@/utils/dock'
import { airDataStationAirRange } from '@/servers/airData'
import { alertEventApi, dataSourceApi } from '@/servers/business'
import type { AlertDashboardVO, AlertEventQuery, DataSourceQuery } from '@/types/business'
import type { MapDevicePoint } from '@/types/mapDevice'
import type { RadarAlarmPoint } from '@/utils/mapRadarAlarmLayers'
import type { EmissionOutletPoint, OutletPointClickPos } from '@/utils/mapEmissionOutletLayers'
import { resolveAlertLevel, type AlertMapPoint } from '@/utils/mapAlertLayers'
import type { AirQualityPoint, StationAirRange } from '@/types/airData'
import type { AirPointClickPos } from '@/utils/mapAirLayers'
import { flattenDepts, findCityDeptId, findDistrictDeptId } from '@/utils/airQuality'
import type { MapFocusTarget } from '@/types/mapFocus'
import droneSpinGif from '@/assets/images/drone-spin.gif'
import radarSpinGif from '@/assets/images/radar-spin.gif'
import AirStationDetailPopup from './popups/AirStationDetailPopup'
import OutletDetailPopup from './popups/OutletDetailPopup'
import type { AirPointDetail, OutletPointDetail } from './popups/shared'
import DialGraphic from './cards/DialGraphic'
import AirStationRangeCard from './cards/AirStationRangeCard'
import AlertStatCard from './cards/AlertStatCard'
import AlertLatestCarousel from './cards/AlertLatestCarousel'
import StationDataModal from './modals/StationDataModal'
import { usePolling } from './hooks/usePolling'
import MapLegendGroup from './overlays/MapLegendGroup'
import RegionControls from './overlays/RegionControls'
import MapPointDisplayBar from './overlays/MapPointDisplayBar'
import SourceSummary, { DistributionSummary } from './overlays/MonitorSummaryOverlays'
import GlobalMapSearch from './overlays/GlobalMapSearch'
import './index.less'

interface MonitorStation {
  id: string
  name: string
  address: string
  online: boolean
  lng?: number
  lat?: number
  /** 无人机工作模式：0=空闲，1=调试，2=远程调试，3=升级，4=工作中 */
  modeCode?: number
  modeLabel?: string
}


/** 雷达告警统计时间窗口求和：regular + sudden，缺省默认 0 */
function sumWindowStats(stats: UnknownRecord, key: string): number {
  const windowStats = stats[key]
  if (!windowStats || typeof windowStats !== 'object') return 0
  const record = windowStats as UnknownRecord
  const regular = Number(record.regular)
  const sudden = Number(record.sudden)
  return (Number.isFinite(regular) ? regular : 0) + (Number.isFinite(sudden) ? sudden : 0)
}

type UnknownRecord = Record<string, unknown>

function extractRecords(value: unknown): UnknownRecord[] {
  if (Array.isArray(value)) return value.filter(item => !!item && typeof item === 'object') as UnknownRecord[]
  if (!value || typeof value !== 'object') return []
  const record = value as UnknownRecord
  const nested = record.records ?? record.list ?? record.rows
  return Array.isArray(nested) ? nested.filter(item => !!item && typeof item === 'object') as UnknownRecord[] : []
}

function firstText(item: UnknownRecord, keys: string[], fallback = '') {
  for (const key of keys) {
    const value = item[key]
    if (value !== undefined && value !== null && String(value).trim()) return String(value)
  }
  return fallback
}

function stationOnline(item: UnknownRecord, kind: 'drone' | 'radar') {
  if (kind === 'drone') {
    return getDockOnlineStatus(item.status).online
  }
  if (kind === 'radar') {
    if (item.bsTransStatus !== undefined && item.bsTransStatus !== null) {
      return String(item.bsTransStatus) === '1' || String(item.bsTransStatus).toLowerCase() === 'true'
    }
  }
  const raw = firstText(item, ['online', 'onlineStatus', 'status', 'deviceStatus', 'dockStatus', 'bsiStatus', 'bsTransStatus']).toLowerCase()
  // 如果API未返回状态字段，默认在线
  if (!raw) return true
  if (kind === 'radar') {
    // 雷达API的status字段语义与无人机不同（可能表示运行模式等），仅在明确离线标识时才判定离线
    return !['0', 'false', 'offline', 'off', 'fault', 'error', '离线', '故障', '异常', '停用'].includes(raw)
  }
  return ['1', 'true', 'online', 'normal', 'running', '在线', '正常', '运行'].includes(raw)
}

function normalizeStations(value: unknown, kind: 'drone' | 'radar'): MonitorStation[] {
  return extractRecords(value).map((item, index) => {
    const modeCode = kind === 'drone' ? Number(item.modeCode ?? NaN) : NaN
    return {
      id: firstText(item, ['id', 'bsId', 'bsiId', 'dockId', 'dockCode', 'stationId'], `${kind}-${index}`),
      name: firstText(
        item,
        kind === 'drone'
          ? ['dockName', 'name', 'stationName', 'deviceName']
          : ['bsName', 'bsiName', 'stationName', 'name', 'deviceName', 'dockName'],
        kind === 'drone' ? `无人机站 ${index + 1}` : `雷达站 ${index + 1}`,
      ),
      address: firstText(
        item,
        ['bsLocation', 'bsiLocation', 'location', 'address', 'siteAddress', 'bsDistrict', 'district', 'areaName'],
        '地址未维护'
      ),
      online: stationOnline(item, kind),
      lng: Number(firstText(
        item,
        kind === 'drone'
          ? ['dockLng', 'lng', 'longitude']
          : ['bsLng', 'bsiLng', 'lng', 'longitude'],
        'NaN',
      )),
      lat: Number(firstText(
        item,
        kind === 'drone'
          ? ['dockLat', 'lat', 'latitude']
          : ['bsiLat', 'lat', 'latitude'],
        'NaN',
      )),
      modeCode: Number.isFinite(modeCode) ? modeCode : undefined,
      modeLabel: kind === 'drone' && Number.isFinite(modeCode) ? getDockModeLabel(modeCode) : undefined,
    }
  })
}

function getStationTooltip(station: MonitorStation) {
  if (station.address && station.address !== '地址未维护' && station.address !== station.name) {
    return `${station.name}\n地址：${station.address}`
  }
  return station.name
}

/** 5 个 sub-components（DialGraphic / AirStationRangeCard / AlertStatCard /
 *  AlertLatestCarousel / StationDataModal）已分别抽到 cards/ 与 modals/。
 */

/** 侧栏卡片通用面板样式（主组件内多个 status-card 共用） */
const sidePanelStyle = {
  background: 'linear-gradient(160deg, rgba(7, 36, 78, 0.9), rgba(4, 22, 55, 0.85))',
  border: '1px solid rgba(0, 180, 255, 0.35)',
  boxShadow: '0 4px 24px rgba(0, 10, 35, 0.6), inset 0 0 15px rgba(0, 180, 255, 0.1)',
}

/** 最新预警最多展示条数（被 AlertLatestCarousel 调用前裁剪） */
const ALERT_LATEST_LIMIT = 10

/** 主组件：监控大屏。包含地图（ZJ3DMap / CityDistrictMap / CountyBoundaryMap）+
 * 站点/预警/排口数据层 + 3 个内嵌弹窗（空气质量站、排口、站点数据）+ 侧栏数据卡片。 */
export default function Monitor() {
  const navigate = useNavigate()
  const {
    regionContext,
    setRegionSelection,
  } = useAppStore()
  const roleLevel = regionContext?.roleLevel || 'town'
  const selection = regionContext?.selection
  const mapSelection = regionContext?.mapSelection
  const isProvinceView = !mapSelection?.cityCode
  const activeCity = cities.find(city => city.adcode === mapSelection?.cityCode)
  const activeCounty = districts.find(item => String(item.adcode) === mapSelection?.countyCode)
  const [hoverRegion, setHoverRegion] = useState<string | null>(null)
  const [droneStations, setDroneStations] = useState<MonitorStation[]>([])
  const [radarStations, setRadarStations] = useState<MonitorStation[]>([])
  const [droneTaskStats, setDroneTaskStats] = useState({ pending: 0, flying: 0 })
  const [radarAlarmStats, setRadarAlarmStats] = useState({ oneHour: 0, threeHours: 0, day: 0 })
  // 雷达常规/突发告警点（hbdp/leida/alarmPointTop5，统一 hour=24）
  const [radarAlarmPoints, setRadarAlarmPoints] = useState<RadarAlarmPoint[]>([])
  // 近一小时污染物区间（stationAirRange，按站点类型分组）
  const [airRanges, setAirRanges] = useState<StationAirRange[]>([])
  // 站点数据弹窗（固定站/移动站）
  const [stationModal, setStationModal] = useState<{ open: boolean; type: 'fixed' | 'mobile' }>({ open: false, type: 'fixed' })
  // 预警处置：dashboard 面板数据（统计 + 近一小时最新预警，接口异常时回退 mock）
  const [alertDashboard, setAlertDashboard] = useState<AlertDashboardVO | null>(null)
  const [airPoints, setAirPoints] = useState<AirQualityPoint[]>([])
  // 预警点位打点（alertEvent/list 经纬度，同经纬度已聚合）
  const [alertPoints, setAlertPoints] = useState<AlertMapPoint[]>([])
  // 企业排口打点（hbdp/emissionOutlet/list，全量；zoom>=13 图标 / >=16 两行文字）
  const [emissionOutletPoints, setEmissionOutletPoints] = useState<EmissionOutletPoint[]>([])
  const [pointMode, setPointMode] = useState<'alert' | 'air'>('air')
  const [showDronePoints, setShowDronePoints] = useState(true)
  const [showRadarPoints, setShowRadarPoints] = useState(true)
  const [showEmissionOutletPoints, setShowEmissionOutletPoints] = useState(true)
  const [searchKeyword, setSearchKeyword] = useState('')
  const [searchResults, setSearchResults] = useState<GlobalSearchItem[]>([])
  const [searchLoading, setSearchLoading] = useState(false)
  const [searchOpen, setSearchOpen] = useState(false)
  const [mapFocusTarget, setMapFocusTarget] = useState<MapFocusTarget | null>(null)
  const searchTimerRef = useRef<number | null>(null)
  const searchRequestRef = useRef(0)
  const focusRequestRef = useRef(0)
  // 数据源列表总数（左下“在线数据源”展示）
  const [sourceTotal, setSourceTotal] = useState(0)
  const [airDetail, setAirDetail] = useState<AirPointDetail | null>(null)
  // 企业排口详情弹窗（点击排口圆点时填充，含锚定坐标）
  const [outletDetail, setOutletDetail] = useState<OutletPointDetail | null>(null)
  // 扁平化部门树（用于按区域名匹配 deptId）
  const allDepts = useMemo(() => flattenDepts(regionContext?.departments ?? []), [regionContext?.departments])

  useEffect(() => {
    const params = selection ? toRegionQuery(selection) : {}
    let cancelled = false
    Promise.allSettled([
      dockList(params),
      leidaList(params),
      listFlyJob({ ...params, pageNum: 1, pageSize: 100 }),
      leiDaBaojingTongji(params),
    ]).then(([dockResult, radarResult, taskResult, alarmResult]) => {
      if (dockResult.status === 'fulfilled') {
        const norm = normalizeStations(dockResult.value?.data, 'drone')
        setDroneStations(norm)
      } else {
        setDroneStations([])
      }
      if (radarResult.status === 'fulfilled') setRadarStations(normalizeStations(radarResult.value.data, 'radar'))
      if (taskResult.status === 'fulfilled') {
        const tasks = extractRecords(taskResult.value.data)
        setDroneTaskStats({
          pending: tasks.filter(item => ['pending', 'waiting', '待执行', '待飞'].includes(firstText(item, ['jobStatus', 'status', 'taskStatus']))).length,
          flying: tasks.filter(item => ['flying', 'running', 'processing', '执行中', '飞行中'].includes(firstText(item, ['jobStatus', 'status', 'taskStatus']))).length,
        })
      }
      if (alarmResult.status === 'fulfilled' && alarmResult.value.data && typeof alarmResult.value.data === 'object') {
        const stats = alarmResult.value.data as UnknownRecord
        setRadarAlarmStats({
          oneHour: sumWindowStats(stats, 'hour1'),
          threeHours: sumWindowStats(stats, 'hour3'),
          day: sumWindowStats(stats, 'hour24'),
        })
      }
      // monitor 按雷达逐一查询细网格 Top 5% 常规/突发点；radar 页仍使用 alarmPoint。
      const radarBsiIds = radarResult.status === 'fulfilled'
        ? extractRecords(radarResult.value.data)
          .map(item => firstText(item, ['bsiId', 'bsId', 'id']))
          .filter(Boolean)
        : []
      if (!radarBsiIds.length) {
        if (!cancelled) setRadarAlarmPoints([])
        return
      }
      Promise.all(radarBsiIds.map(bsiId => alarmPointTop5({ BsiId: bsiId, hour: 24 }).catch(() => null)))
        .then(results => {
          if (cancelled) return
          const merged = new Map<string, RadarAlarmPoint>()
          results.forEach(res => {
            if (res?.resultCode !== 0 || !res.data || typeof res.data !== 'object') return
            const groups = [
              { points: res.data.regularPoints, fallbackType: 1 as const },
              { points: res.data.suddenPoints, fallbackType: 2 as const },
            ]
            groups.forEach(({ points, fallbackType }) => {
              if (!Array.isArray(points)) return
              points.forEach(item => {
                const lng = Number(item.dapLng)
                const lat = Number(item.dapLat)
                const rawType = Number(item.type)
                const type: 1 | 2 = rawType === 1 || rawType === 2 ? rawType : fallbackType
                if (!Number.isFinite(lng) || !Number.isFinite(lat)) return
                const key = `${lng.toFixed(6)}-${lat.toFixed(6)}-${type}`
                if (!merged.has(key)) merged.set(key, { lng, lat, type, name: item.address })
              })
            })
          })
          setRadarAlarmPoints([...merged.values()])
        })
    })
    return () => { cancelled = true }
  }, [selection])

  const droneOnline = droneStations.filter(item => item.online).length
  const radarOnline = radarStations.filter(item => item.online).length

  // 原雷达/无人机场接口（leidaList/dockList）的地图打点
  const legacyDevicePoints = useMemo<MapDevicePoint[]>(() => {
    const candidates = [
      ...droneStations.map(item => ({ ...item, type: 'drone' as const })),
      ...radarStations.map(item => ({ ...item, type: 'radar' as const })),
    ]
    return candidates.flatMap(item => {
      const { lng, lat } = item
      if (
        typeof lng !== 'number'
        || typeof lat !== 'number'
        || !Number.isFinite(lng)
        || !Number.isFinite(lat)
        || lng < -180
        || lng > 180
        || lat < -90
        || lat > 90
      ) return []
      return [{
        id: item.id,
        type: item.type,
        name: item.name,
        address: item.address,
        online: item.online,
        lng,
        lat,
      }]
    })
  }, [droneStations, radarStations])

  const cityDistricts = useMemo(() => {
    if (!activeCity) return []
    return districts.filter(item => item.parent === Number(activeCity.adcode))
  }, [activeCity])

  // 近一小时污染物值区间（stationAirRange）：全域统计，不随区域切换
  useEffect(() => {
    let cancelled = false
    airDataStationAirRange()
      .then(res => { if (!cancelled) setAirRanges(Array.isArray(res.data) ? res.data : []) })
      .catch(() => { if (!cancelled) setAirRanges([]) })
    return () => { cancelled = true }
  }, [])

  // 预警处置：dashboard 接口（统计 + 最新预警），5 分钟静默轮询
  usePolling(() => {
    alertEventApi.dashboard()
      .then(res => setAlertDashboard(res.data ?? null))
      .catch(() => setAlertDashboard(null))
  }, 5 * 60 * 1000)

  // 地图打点（数据源列表 needAqi=1）：仅打空气质量站微站（AQI 六级图标）；
  // 雷达/无人机场由 leida/list、wurenji/dockList 独立接口打点，不在此处增量补充
  useEffect(() => {
    const cityDeptId = findCityDeptId(allDepts, selection?.cityName)
    const districtDeptId = selection?.countyName
      ? findDistrictDeptId(allDepts, selection.countyName, selection.cityName)
      : undefined
    const params: DataSourceQuery = { pageNum: 1, pageSize: 999, needAqi: 1 }
    if (districtDeptId != null) params.districtId = Number(districtDeptId)
    else if (cityDeptId != null) params.cityId = Number(cityDeptId)

    let cancelled = false
    dataSourceApi.list(params)
      .then(res => {
        if (cancelled) return
        const records = (res.data?.records ?? []).filter(
          item => Number.isFinite(item.lng) && Number.isFinite(item.lat),
        )
        // 左下“在线数据源”展示列表总数
        setSourceTotal(Number(res.data?.total) || 0)

        // 空气质量微站：按 aqiLevel 打六级图标，无 aqiLevel 的微站由 mapAirLayers 用 aq-none.png 占位
        const airStations: AirQualityPoint[] = records
          .filter(item => item.dataType === 'air_quality_station')
          .map(item => ({
            id: Number(item.id) || undefined,
            stationType: item.stationType,
            name: item.shortName ?? item.deviceName,
            lng: item.lng as number,
            lat: item.lat as number,
            value: item.aqi ?? null,
            iaqi: null,
            aqiLevel: item.aqiLevel,
            pm25Iaqi: item.pm25Iaqi ?? null,
            pm10Iaqi: item.pm10Iaqi ?? null,
            so2Iaqi: item.so2Iaqi ?? null,
            no2Iaqi: item.no2Iaqi ?? null,
            coIaqi: item.coIaqi ?? null,
            o3Iaqi: item.o3Iaqi ?? null,
          }))
        setAirPoints(airStations)
      })
      .catch(() => {
        if (!cancelled) {
          setAirPoints([])
          setSourceTotal(0)
        }
      })
    return () => { cancelled = true }
  }, [allDepts, selection])

  // 预警点位打点（alertEvent/list）：按区域 deptId 过滤，同经纬度聚合计数；5 分钟静默轮询（与 dashboard 同节奏）
  const cityDeptId = findCityDeptId(allDepts, selection?.cityName)
  const districtDeptId = selection?.countyName
    ? findDistrictDeptId(allDepts, selection.countyName, selection.cityName)
    : undefined
  usePolling(() => {
    const params: AlertEventQuery = { pageNum: 1, pageSize: 999 }
    if (districtDeptId != null) params.districtId = Number(districtDeptId)
    else if (cityDeptId != null) params.cityId = Number(cityDeptId)
    alertEventApi.list(params)
      .then(res => {
        const records = res.data?.records ?? []
        // 同经纬度多条预警聚合为一个点，图标上方显示个数
        const aggregated = new Map<string, AlertMapPoint>()
        records.forEach(item => {
          if (typeof item.lng !== 'number' || typeof item.lat !== 'number'
            || !Number.isFinite(item.lng) || !Number.isFinite(item.lat)) return
          const key = `${item.lng.toFixed(6)}-${item.lat.toFixed(6)}`
          const existing = aggregated.get(key)
          if (existing) {
            existing.count = (existing.count ?? 1) + 1
            return
          }
          aggregated.set(key, {
            id: item.id,
            name: item.deviceName || item.location || item.ruleName,
            level: resolveAlertLevel(item.alertLevel),
            lng: item.lng,
            lat: item.lat,
            count: 1,
          })
        })
        setAlertPoints([...aggregated.values()])
      })
      .catch(() => setAlertPoints([]))
  }, 5 * 60 * 1000, [allDepts, selection])

  // 企业排口打点（hbdp/emissionOutlet/list）：全量加载，不按区域过滤；zoom>=13 才显示图标、>=15 才显示两行文字
  useEffect(() => {
    let cancelled = false
    emissionOutletList()
      .then(res => {
        if (cancelled) return
        const list = res.data ?? []
        const points: EmissionOutletPoint[] = list
          .map(item => ({
            id: item.id,
            outletName: item.outletName,
            companyName: item.companyName,
            licenseNo: item.licenseNo,
            manageCategory: item.manageCategory,
            pollutants: item.pollutants,
            outletCount: item.outletCount,
            onlineMonitorInfo: item.onlineMonitorInfo,
            lng: Number(item.longitude),
            lat: Number(item.latitude),
          }))
          .filter(p => Number.isFinite(p.lng) && Number.isFinite(p.lat))
        setEmissionOutletPoints(points)
      })
      .catch(() => { if (!cancelled) setEmissionOutletPoints([]) })
    return () => { cancelled = true }
  }, [])

  // 点击地图空气质量打点：弹窗锚定在点击位置，展示综合 AQI 与各污染物分指数 IAQI（数据已随列表返回）
  const handleAirPointClick = (point: AirQualityPoint, pos?: AirPointClickPos) => {
    setOutletDetail(null)
    setAirDetail({
      id: point.id,
      name: point.name,
      aqi: point.value,
      aqiLevel: point.aqiLevel ?? '',
      values: {
        pm25Iaqi: point.pm25Iaqi ?? null,
        pm10Iaqi: point.pm10Iaqi ?? null,
        so2Iaqi: point.so2Iaqi ?? null,
        no2Iaqi: point.no2Iaqi ?? null,
        coIaqi: point.coIaqi ?? null,
        o3Iaqi: point.o3Iaqi ?? null,
      },
      pos,
    })
  }

  // 点击地图企业排口圆点：弹窗锚定在点击位置，展示排口/企业/许可证等详情
  const handleOutletClick = (point: EmissionOutletPoint, pos?: OutletPointClickPos) => {
    setAirDetail(null)
    setOutletDetail({ ...point, pos })
  }

  // 固定站/移动站区间数据（stationAirRange 按站点类型拆分）
  const fixedRange = airRanges.find(item => item.stationType === 'fixed')
  const mobileRange = airRanges.find(item => item.stationType === 'mobile')
  // 站点卡片标题栏展示的最新数据时间（取固定/移动站中较新的一条）
  const latestAirTime = useMemo(() => {
    const times = [fixedRange, mobileRange]
      .map(item => (item as UnknownRecord | undefined)?.latestDataTime)
      .filter((item): item is string => typeof item === 'string' && !!item)
    const sorted = times.sort()
    return sorted.length ? sorted[sorted.length - 1] : undefined
  }, [fixedRange, mobileRange])

  // 最新预警：取前 10 条用于轮播展示
  const latestAlerts = useMemo(
    () => (alertDashboard?.latestAlerts ?? []).slice(0, ALERT_LATEST_LIMIT),
    [alertDashboard],
  )

  const selectedRegionName = selection?.countyName || selection?.cityName || selection?.provinceName || '浙江省'

  const selectCity = (adcode?: string) => {
    if (roleLevel !== 'admin') return
    const city = cities.find(item => item.adcode === adcode)
    const nextSelection: RegionSelection = city
      ? {
          provinceCode: '330000',
          provinceName: '浙江省',
          cityCode: city.adcode,
          cityName: city.name,
        }
      : { provinceCode: '330000', provinceName: '浙江省' }
    setRegionSelection(nextSelection)
    setHoverRegion(null)
  }

  const selectDistrict = (name?: string) => {
    if (!name && activeCity && (roleLevel === 'admin' || roleLevel === 'city')) {
      setRegionSelection({
        provinceCode: '330000',
        provinceName: '浙江省',
        cityCode: activeCity.adcode,
        cityName: activeCity.name,
      })
      setHoverRegion(null)
      return
    }
    const item = cityDistricts.find(district => district.name === name)
    if (!item || !activeCity || (roleLevel !== 'admin' && roleLevel !== 'city')) return
    setRegionSelection({
      provinceCode: '330000',
      provinceName: '浙江省',
      cityCode: activeCity.adcode,
      cityName: activeCity.name,
      countyCode: String(item.adcode),
      countyName: item.name,
    })
    setHoverRegion(null)
  }

  const handleCityClick = (cityName: string, adcode: number) => {
    const city = cities.find(item => item.name === cityName || Number(item.adcode) === Number(adcode))
    if (city) selectCity(city.adcode)
  }

  const runGlobalSearch = async (value: string) => {
    const keyword = value.trim()
    if (!keyword) return
    const requestId = ++searchRequestRef.current
    setSearchLoading(true)
    try {
      const res = await globalSearch(keyword)
      if (requestId !== searchRequestRef.current) return
      const results = Array.isArray(res.data)
        ? res.data.filter(item => {
            const lng = Number(item.longitude)
            const lat = Number(item.latitude)
            return Number.isFinite(lng) && Number.isFinite(lat)
          })
        : []
      setSearchResults(results)
      setSearchOpen(true)
    } catch {
      if (requestId !== searchRequestRef.current) return
      setSearchResults([])
      setSearchOpen(true)
    } finally {
      if (requestId === searchRequestRef.current) setSearchLoading(false)
    }
  }

  const handleSearchChange = (value: string) => {
    setSearchKeyword(value)
    if (searchTimerRef.current != null) window.clearTimeout(searchTimerRef.current)
    searchRequestRef.current += 1
    if (!value.trim()) {
      setSearchResults([])
      setSearchOpen(false)
      setSearchLoading(false)
      return
    }
    setSearchLoading(true)
    searchTimerRef.current = window.setTimeout(() => {
      void runGlobalSearch(value)
    }, 800)
  }

  const handleSearchSubmit = () => {
    if (searchTimerRef.current != null) window.clearTimeout(searchTimerRef.current)
    void runGlobalSearch(searchKeyword)
  }

  const handleSearchClear = () => {
    if (searchTimerRef.current != null) window.clearTimeout(searchTimerRef.current)
    searchRequestRef.current += 1
    setSearchKeyword('')
    setSearchResults([])
    setSearchOpen(false)
    setSearchLoading(false)
  }

  const handleSearchLocate = (item: GlobalSearchItem) => {
    const lng = Number(item.longitude)
    const lat = Number(item.latitude)
    if (!Number.isFinite(lng) || !Number.isFinite(lat)) return
    setMapFocusTarget({ lng, lat, zoom: 17, requestId: ++focusRequestRef.current })
    setSearchKeyword(item.name?.trim() || '未命名地址')
    setSearchOpen(false)
    setAirDetail(null)
    setOutletDetail(null)
  }

  useEffect(() => () => {
    if (searchTimerRef.current != null) window.clearTimeout(searchTimerRef.current)
    searchRequestRef.current += 1
  }, [])

  return (
    <div className="monitor-screen w-full h-full flex overflow-hidden text-[#e7f7ff]">
      {/* 左侧面板：三个独立卡片（与右侧无人机场/光量子雷达卡片同款样式） */}
      <aside className="station-panel w-310px shrink-0 flex flex-col overflow-hidden">
        <AirStationRangeCard
          title="空气质量站（固定站）"
          range={fixedRange}
          latestTime={latestAirTime}
          onView={() => setStationModal({ open: true, type: 'fixed' })}
        />

        <AirStationRangeCard
          title="空气质量站（移动站）"
          range={mobileRange}
          latestTime={latestAirTime}
          onView={() => setStationModal({ open: true, type: 'mobile' })}
        />

        {/* 预警处置：填充剩余高度，点击进入预警中心（边框/背景与右侧卡片同源 sidePanelStyle） */}
        <section className="status-card flex-1 min-h-0 flex flex-col overflow-hidden" style={sidePanelStyle}>
          <div className="panel-title-divider flex items-center gap-1.5 mb-2 pb-2">
            <span className="w-3px h-11px bg-[#ff6868]" />
            <span className="text-[#7bd7ff] text-12px font-bold">预警处置</span>
            <button
              type="button"
              onClick={() => navigate('/alert')}
              className="ml-auto shrink-0 text-10px px-2.5 py-0.5 rounded-3px border border-[#2f9bff] text-[#7bd7ff] bg-[#1890ff]/15 cursor-pointer transition-all hover:text-white hover:border-[#00f0ff]"
            >
              进入
            </button>
          </div>

          {/* 状态统计：2×2 卡片式展示，重背景色块 + 纯白文字 */}
          <div className="grid grid-cols-2 gap-2 mb-2">
            <AlertStatCard label="预警" count={alertDashboard?.effectiveCount ?? 0} bg="rgba(239,68,68,0.75)" />
            <AlertStatCard label="待处置" count={alertDashboard?.pendingCount ?? 0} bg="rgba(255,154,32,0.75)" />
            <AlertStatCard label="处置中" count={alertDashboard?.processingCount ?? 0} bg="rgba(37,155,255,0.75)" />
            <AlertStatCard label="已完成" count={alertDashboard?.completedCount ?? 0} bg="rgba(56,193,114,0.75)" />
          </div>

          {/* 今日派单 / 今日处置 */}
          <div className="grid grid-cols-2 gap-2 mb-2">
            <AlertStatCard label="今日派单" count={alertDashboard?.todayDispatchCount ?? 0} bg="rgba(99,102,241,0.75)" />
            <AlertStatCard label="今日处置" count={alertDashboard?.todayClosedCount ?? 0} bg="rgba(168,85,247,0.75)" />
          </div>

          <div className="text-[#7bd7ff] text-11px font-bold mb-1.5 shrink-0">最新预警</div>
          {latestAlerts.length ? (
            <AlertLatestCarousel items={latestAlerts} onNavigate={() => navigate('/alert')} />
          ) : (
            <div className="text-10px text-[#7088a8] text-center py-4">暂无预警数据</div>
          )}
        </section>

        {stationModal.open && (
          <StationDataModal
            stationType={stationModal.type}
            onClose={() => setStationModal(prev => ({ ...prev, open: false }))}
          />
        )}
      </aside>

      {/* 主地图展示区域 */}
      <main
        data-device-point-count={legacyDevicePoints.length}
        className="monitor-map-stage flex-1 relative overflow-hidden min-w-0 rounded-12px border border-[#00d4ff]/35 shadow-[0_0_24px_rgba(0,180,255,0.15)]"
      >
        {isProvinceView ? (
          <ZJ3DMap
            selectedCity={selection?.cityName}
            devicePoints={legacyDevicePoints}
            airPoints={airPoints}
            alertPoints={alertPoints}
            radarAlarmPoints={radarAlarmPoints}
            emissionOutletPoints={emissionOutletPoints}
            onOutletClick={handleOutletClick}
            showAlertPoints={pointMode === 'alert'}
            showAirPoints={pointMode === 'air'}
            showDronePoints={showDronePoints}
            showRadarPoints={showRadarPoints}
            showEmissionOutletPoints={showEmissionOutletPoints}
            focusTarget={mapFocusTarget}
            onCityClick={handleCityClick}
            onCityHover={setHoverRegion}
            onAirPointClick={handleAirPointClick}
          />
        ) : activeCounty ? (
          <CountyBoundaryMap
            county={activeCounty}
            devicePoints={legacyDevicePoints}
            airPoints={airPoints}
            alertPoints={alertPoints}
            radarAlarmPoints={radarAlarmPoints}
            emissionOutletPoints={emissionOutletPoints}
            onOutletClick={handleOutletClick}
            showAlertPoints={pointMode === 'alert'}
            showAirPoints={pointMode === 'air'}
            showDronePoints={showDronePoints}
            showRadarPoints={showRadarPoints}
            showEmissionOutletPoints={showEmissionOutletPoints}
            focusTarget={mapFocusTarget}
            onAirPointClick={handleAirPointClick}
          />
        ) : activeCity ? (
          <CityDistrictMap
            city={activeCity}
            districtItems={cityDistricts}
            selectedDistrict={selection?.countyName}
            devicePoints={legacyDevicePoints}
            airPoints={airPoints}
            alertPoints={alertPoints}
            radarAlarmPoints={radarAlarmPoints}
            emissionOutletPoints={emissionOutletPoints}
            onOutletClick={handleOutletClick}
            showAlertPoints={pointMode === 'alert'}
            showAirPoints={pointMode === 'air'}
            showDronePoints={showDronePoints}
            showRadarPoints={showRadarPoints}
            showEmissionOutletPoints={showEmissionOutletPoints}
            focusTarget={mapFocusTarget}
            onDistrictClick={selectDistrict}
            onDistrictHover={setHoverRegion}
            onAirPointClick={handleAirPointClick}
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-[#dffbff]">区域地图加载失败</div>
        )}

        {/* 左上图例组：空气质量检测站 + 无人机场 */}
        <MapLegendGroup
          position="left"
          cards={[
            {
              title: '空气质量检测站',
              accentColor: '#00f0ff',
              modifier: 'air',
              items: [
                { icon: '/marker/aq-good.png', label: '优(1~50)' },
                { icon: '/marker/aq-moderate.png', label: '良(51~100)' },
                { icon: '/marker/aq-light.png', label: '轻度污染(101~150)' },
                { icon: '/marker/aq-medium.png', label: '中度污染(151~200)' },
                { icon: '/marker/aq-heavy.png', label: '重度污染(201~300)' },
                { icon: '/marker/aq-severe.png', label: '严重污染(>300)' },
                { icon: '/marker/aq-good.png', label: '移动站' },
                { icon: '/marker/aq-fixed-good.png', label: '固定站' },
              ],
            },
            {
              title: '无人机场',
              accentColor: '#1ad4ef',
              modifier: 'drone',
              items: [
                { icon: '/marker/drone-on.png', label: '在线' },
                { icon: '/marker/drone-off.png', label: '离线' },
                { placeholderClassName: 'w-10px h-2px bg-[#00d4ff]', label: '飞行路线' },
                { icon: '/marker/drone-fly.png', label: '飞行中无人机' },
              ],
            },
          ]}
        />

        {/* 底部全局搜索：结果仅展示名称，点击后定位地图并短暂高亮 */}
        <GlobalMapSearch
          keyword={searchKeyword}
          results={searchResults}
          loading={searchLoading}
          open={searchOpen}
          onChange={handleSearchChange}
          onSubmit={handleSearchSubmit}
          onClear={handleSearchClear}
          onSelect={handleSearchLocate}
          onFocus={() => { if (searchKeyword.trim() && !searchLoading) setSearchOpen(true) }}
          onClose={() => setSearchOpen(false)}
        />

        {/* 底部水平居中：打点显示控件条（预警↔空气互斥按钮组 + 无人机/雷达 Switch），位于底部导航条正上方不被遮挡 */}
        <MapPointDisplayBar
          pointMode={pointMode}
          onPointModeChange={setPointMode}
          showDronePoints={showDronePoints}
          onShowDroneChange={setShowDronePoints}
          showRadarPoints={showRadarPoints}
          onShowRadarChange={setShowRadarPoints}
          showEmissionOutletPoints={showEmissionOutletPoints}
          onShowEmissionOutletChange={setShowEmissionOutletPoints}
        />

        {/* 右上图例组：光量子雷达站 + 预警点位（位于省/市控制组下方） */}
        <MapLegendGroup
          position="right"
          cards={[
            {
              title: '光量子雷达站',
              accentColor: '#c17cff',
              modifier: 'radar',
              items: [
                { icon: '/marker/radar-on.png', label: '在线' },
                { icon: '/marker/radar-off.png', label: '离线' },
              ],
            },
            {
              title: '预警点位',
              accentColor: '#ff6868',
              modifier: 'warning',
              items: [
                { icon: '/marker/warn-l1.png', label: '一级预警' },
                { icon: '/marker/warn-l2.png', label: '二级预警' },
                { icon: '/marker/warn-l3.png', label: '三级预警' },
              ],
            },
          ]}
        />

        {/* 右上浮层：省/市/区控制组 */}
        <RegionControls
          roleLevel={roleLevel}
          cityOptions={cities.map(city => ({ adcode: city.adcode, name: city.name }))}
          districtOptions={cityDistricts}
          selectedCityCode={selection?.cityCode}
          selectedDistrictName={selection?.countyName}
          townName={selection?.townName}
          onCityChange={selectCity}
          onDistrictChange={selectDistrict}
        />

        {/* 地图 Hover 提示 */}
        {hoverRegion && hoverRegion !== selectedRegionName && (
          <div className="absolute top-14 left-1/2 -translate-x-1/2 z-20 px-4 py-1.5 rounded-lg border border-[#00d4ff]/60 bg-[rgba(4,22,52,0.92)] shadow-[0_6px_20px_rgba(0,10,35,0.4)]">
            <span className="text-[#e5fcff] text-12px">点击选择 </span><span className="text-[#00f0ff] text-13px font-bold">{hoverRegion}</span>
          </div>
        )}

        {/* 左下浮层：数据源概况 */}
        <SourceSummary onlineSourceCount={sourceTotal} />

        {/* 右下浮层：监测分布总结 */}
        <DistributionSummary
          regionName={selectedRegionName}
          airStationCount={airPoints.length}
          radarStationCount={radarStations.length}
          droneStationCount={droneStations.length}
        />
      </main>

      {/* 右侧面板：无人机场 & 光量子雷达 (完全对齐原型图) */}
      <aside className="status-panel w-310px shrink-0 flex flex-col overflow-hidden rounded-12px border border-[#00d4ff]/35 bg-[rgba(6,30,70,0.65)] p-3 space-y-3 shadow-[0_0_20px_rgba(0,180,255,0.15)]">
        {/* 无人机场 */}
        <section className="status-card status-card--drone flex-1 flex flex-col overflow-hidden rounded-10px p-3.5" style={sidePanelStyle}>
          <div className="status-card__title flex items-center gap-2 mb-2">
            <span className="w-3px h-15px bg-[#1ad4ef] rounded-xs shadow-[0_0_8px_#1ad4ef]" />
            <span className="text-white text-14px font-bold">无人机场</span>
          </div>

          <div className="status-card__overview">
            <DialGraphic gifSrc={droneSpinGif} alt="无人机" />
            <div className="status-card__headline">
              <div className="status-card__value">
                <strong>{droneStations.length}</strong>
                <span>架</span>
              </div>
              <div className="status-card__availability">
                <div><i className="is-online" /><span>在线</span><b>{droneOnline}</b></div>
                <div><i className="is-offline" /><span>离线</span><b className="is-warning">{droneStations.length - droneOnline}</b></div>
              </div>
            </div>
          </div>

          <div className="status-card__statistics">
            <div className="status-card__section-label">任务统计</div>
            <div className="status-card__row">
              <span><i className="is-blue" />待飞任务</span>
              <b className="is-yellow">{droneTaskStats.pending}</b>
            </div>
            <div className="status-card__row">
              <span><i className="is-blue" />飞行中</span>
              <b>{droneTaskStats.flying}</b>
            </div>
          </div>

          <div className="mt-2 max-h-72px overflow-y-auto space-y-1">
            {droneStations.slice(0, 5).map(station => (
              <div key={station.id} className="flex items-center justify-between text-10px text-[#b2d9ff]">
                <span className="truncate pr-2 cursor-pointer" title={getStationTooltip(station)}>{station.name}</span>
                <span className="shrink-0 flex items-center gap-1.5">
                  <span
                    className="text-10px font-medium px-1.5 py-0.2 rounded-full inline-flex items-center gap-1 border shrink-0"
                    style={
                      station.online
                        ? {
                            color: '#00ff88',
                            backgroundColor: 'rgba(0, 255, 136, 0.15)',
                            borderColor: 'rgba(0, 255, 136, 0.4)',
                          }
                        : {
                            color: '#94a3b8',
                            backgroundColor: 'rgba(148, 163, 184, 0.15)',
                            borderColor: 'rgba(148, 163, 184, 0.3)',
                          }
                    }
                  >
                    <span className={`w-1 h-1 rounded-full ${station.online ? 'bg-[#00ff88] shadow-[0_0_4px_#00ff88]' : 'bg-[#94a3b8]'}`} />
                    {station.online ? '在线' : '离线'}
                  </span>
                  {station.modeLabel && (
                    <span
                      className="text-10px font-medium px-1 py-0.2 rounded border shrink-0"
                      style={{
                        color: getDockModeColor(station.modeCode),
                        borderColor: `${getDockModeColor(station.modeCode)}55`,
                        backgroundColor: `${getDockModeColor(station.modeCode)}20`,
                      }}
                    >
                      {station.modeLabel}
                    </span>
                  )}
                </span>
              </div>
            ))}
            {!droneStations.length && <div className="text-10px text-[#7088a8]">暂无站点数据</div>}
          </div>

          <button
            type="button"
            onClick={() => navigate('/drone')}
            className="status-card__button mt-auto text-11px transition-all cursor-pointer"
          >
            详情
          </button>
        </section>

        {/* 光量子雷达 */}
        <section className="status-card status-card--radar flex-1 flex flex-col overflow-hidden rounded-10px p-3.5" style={sidePanelStyle}>
          <div className="status-card__title flex items-center gap-2 mb-2">
            <span className="w-3px h-15px bg-[#c17cff] rounded-xs shadow-[0_0_8px_#c17cff]" />
            <span className="text-white text-14px font-bold">光量子雷达</span>
          </div>

          <div className="status-card__overview">
            <DialGraphic gifSrc={radarSpinGif} alt="光量子雷达" />
            <div className="status-card__headline">
              <div className="status-card__value">
                <strong>{radarStations.length}</strong>
                <span>个</span>
              </div>
              <div className="status-card__availability">
                <div><i className="is-online" /><span>在线</span><b>{radarOnline}</b></div>
                <div><i className="is-warning-dot" /><span>离线</span><b className="is-warning">{radarStations.length - radarOnline}</b></div>
              </div>
            </div>
          </div>

          <div className="status-card__statistics">
            <div className="status-card__section-label">告警统计</div>
            <div className="status-card__row">
              <span><i className="is-orange" />近1小时</span>
              <b className="is-yellow">{radarAlarmStats.oneHour}</b>
            </div>
            <div className="status-card__row">
              <span><i className="is-orange" />近3小时</span>
              <b>{radarAlarmStats.threeHours}</b>
            </div>
            <div className="status-card__row">
              <span><i className="is-orange" />近24小时</span>
              <b>{radarAlarmStats.day}</b>
            </div>
          </div>

          <div className="mt-2 max-h-120px overflow-y-auto space-y-1 pr-1">
            {radarStations.map(station => (
              <div key={station.id} className="flex items-center justify-between text-10px text-[#b2d9ff] hover:bg-white/5 px-1 py-0.5 rounded transition-colors">
                <span className="truncate pr-2 cursor-pointer" title={getStationTooltip(station)}>{station.name}</span>
                <span className={station.online ? 'text-[#22f0a2] shrink-0' : 'text-[#8ca3bd] shrink-0'}>{station.online ? '在线' : '离线'}</span>
              </div>
            ))}
            {!radarStations.length && <div className="text-10px text-[#7088a8]">暂无站点数据</div>}
          </div>

          <button
            type="button"
            onClick={() => navigate('/radar')}
            className="status-card__button mt-auto text-11px transition-all cursor-pointer"
          >
            详情
          </button>
        </section>
      </aside>

      {/* 空气质量打点详情弹窗（全局最高 z-index 浮层，锚定在图标点击位置） */}
      {airDetail && (
        <AirStationDetailPopup
          key={airDetail.id ?? airDetail.name}
          detail={airDetail}
          onClose={() => setAirDetail(null)}
        />
      )}

      {/* 企业排口详情弹窗（全局最高 z-index 浮层，锚定在圆点点击位置） */}
      {outletDetail && (
        <OutletDetailPopup
          key={outletDetail.id ?? outletDetail.outletName}
          detail={outletDetail}
          onClose={() => setOutletDetail(null)}
        />
      )}
    </div>
  )
}

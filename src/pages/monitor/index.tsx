import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Select } from 'antd'
import dayjs from 'dayjs'
import CityDistrictMap from '@/components/CityDistrictMap'
import CountyBoundaryMap from '@/components/CountyBoundaryMap'
import ZJ3DMap from '@/components/ZJ3DMap'
import { useAppStore } from '@/stores'
import { cities, districts } from '@/utils/city'
import type { RegionSelection } from '@/types/region'
import { toRegionQuery } from '@/utils/region'
import { dockList, leidaList, listFlyJob } from '@/servers/mapBox'
import { leiDaBaojingTongji } from '@/servers/api'
import { airDataLatest } from '@/servers/airData'
import { dataSourceApi } from '@/servers/business'
import type { DataSourceQuery } from '@/types/business'
import type { MapDevicePoint } from '@/types/mapDevice'
import type { AirDataLatestVO, AirQualityPoint } from '@/types/airData'
import { FIELD_LABEL, flattenDepts, findCityDeptId, findDistrictDeptId } from '@/utils/airQuality'
import droneSpinGif from '@/assets/images/drone-spin.gif'
import radarSpinGif from '@/assets/images/radar-spin.gif'
import './index.less'

interface MonitorStation {
  id: string
  name: string
  address: string
  online: boolean
  lng?: number
  lat?: number
}

/** 格式化站点数值（保留一位小数，空值显示 --） */
function formatAirValue(value: unknown): string {
  const num = Number(value)
  if (value == null || !Number.isFinite(num)) return '--'
  return String(Math.round(num * 10) / 10)
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
  const raw = firstText(item, ['online', 'onlineStatus', 'status', 'deviceStatus', 'dockStatus', 'bsiStatus']).toLowerCase()
  // 如果API未返回状态字段，默认在线
  if (!raw) return true
  if (kind === 'radar') {
    // 雷达API的status字段语义与无人机不同（可能表示运行模式等），仅在明确离线标识时才判定离线
    return !['0', 'false', 'offline', 'off', 'fault', 'error', '离线', '故障', '异常', '停用'].includes(raw)
  }
  return ['1', 'true', 'online', 'normal', 'running', '在线', '正常', '运行'].includes(raw)
}

function normalizeStations(value: unknown, kind: 'drone' | 'radar'): MonitorStation[] {
  return extractRecords(value).map((item, index) => ({
    id: firstText(item, ['id', 'dockId', 'dockCode', 'bsiId', 'stationId'], `${kind}-${index}`),
    name: firstText(
      item,
      kind === 'drone'
        ? ['dockName', 'name', 'stationName', 'deviceName']
        : ['bsiName', 'stationName', 'name', 'deviceName'],
      kind === 'drone' ? `无人机站 ${index + 1}` : `雷达站 ${index + 1}`,
    ),
    address: firstText(item, ['address', 'location', 'siteAddress', 'district', 'areaName'], '地址未维护'),
    online: stationOnline(item, kind),
    lng: Number(firstText(
      item,
      kind === 'drone'
        ? ['dockLng', 'lng', 'longitude']
        : ['bsiLng', 'lng', 'longitude'],
      'NaN',
    )),
    lat: Number(firstText(
      item,
      kind === 'drone'
        ? ['dockLat', 'lat', 'latitude']
        : ['bsiLat', 'lat', 'latitude'],
      'NaN',
    )),
  }))
}

function DialGraphic({ gifSrc, alt }: { gifSrc: string; alt: string }) {
  return (
    <div className="monitor-dial-gif relative w-96px h-96px shrink-0 flex items-center justify-center">
      <img src={gifSrc} alt={alt} className="w-full h-full object-contain" draggable={false} />
    </div>
  )
}

function AirStationCard({ station, fields }: { station: AirDataLatestVO; fields: string[] }) {
  return (
    <div className="station-card w-full text-left rounded-8px p-3 border bg-[#07244c] border-[#144982]">
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2 min-w-0">
          <span className="w-6px h-6px bg-[#00f0ff] shadow-[0_0_6px_#00f0ff] shrink-0" />
          <span className="text-white text-13px font-bold truncate" title={station.deviceName}>{station.deviceName}</span>
        </div>
        <span className="text-[#5c92c1] text-10px font-mono shrink-0">{station.dataTime ? dayjs(station.dataTime).format('MM / DD HH:mm') : '--'}</span>
      </div>
      <div className="grid grid-cols-3 gap-1 text-center">
        {fields.map(field => (
          <div key={field}>
            <div className="text-[#00ffff] font-mono font-bold text-15px">
              {formatAirValue(station[field as keyof AirDataLatestVO])}
            </div>
            <div className="text-[#5ca2d9] text-10px mt-0.5">{FIELD_LABEL[field] || field}</div>
          </div>
        ))}
      </div>
    </div>
  )
}

const sidePanelStyle = {
  background: 'linear-gradient(160deg, rgba(7, 36, 78, 0.9), rgba(4, 22, 55, 0.85))',
  border: '1px solid rgba(0, 180, 255, 0.35)',
  boxShadow: '0 4px 24px rgba(0, 10, 35, 0.6), inset 0 0 15px rgba(0, 180, 255, 0.1)',
}

/** 站点卡片固定展示的 6 种污染物字段 */
const STATION_FIELDS = ['pm25', 'o3', 'pm10', 'so2', 'no2', 'co']
/** 点击打点详情弹窗展示的污染物分指数 IAQI 字段 */
const IAQI_DETAIL_FIELDS: { key: string; label: string }[] = [
  { key: 'pm25Iaqi', label: 'PM2.5' },
  { key: 'pm10Iaqi', label: 'PM10' },
  { key: 'so2Iaqi', label: 'SO₂' },
  { key: 'no2Iaqi', label: 'NO₂' },
  { key: 'coIaqi', label: 'CO' },
  { key: 'o3Iaqi', label: 'O₃' },
]

interface AirPointDetail {
  name: string
  aqi: number | null
  aqiLevel: string
  values: Record<string, number | null>
}

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
  const [stationList, setStationList] = useState<AirDataLatestVO[]>([])
  const [airPoints, setAirPoints] = useState<AirQualityPoint[]>([])
  // 数据源列表返回的雷达站/无人机传感器站（作为增量补充打点）
  const [sourceDevicePoints, setSourceDevicePoints] = useState<MapDevicePoint[]>([])
  const [airDetail, setAirDetail] = useState<AirPointDetail | null>(null)
  // 扁平化部门树（用于按区域名匹配 deptId）
  const allDepts = useMemo(() => flattenDepts(regionContext?.departments ?? []), [regionContext?.departments])

  useEffect(() => {
    const params = selection ? toRegionQuery(selection) : {}
    Promise.allSettled([
      dockList(params),
      leidaList(params),
      listFlyJob({ ...params, pageNum: 1, pageSize: 100 }),
      leiDaBaojingTongji(params),
    ]).then(([dockResult, radarResult, taskResult, alarmResult]) => {
      if (dockResult.status === 'fulfilled') setDroneStations(normalizeStations(dockResult.value.data, 'drone'))
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
        const count = (keys: string[]) => Number(firstText(stats, keys, '0')) || 0
        setRadarAlarmStats({
          oneHour: count(['oneHour', 'hour1', 'oneHourCount', 'oneCount']),
          threeHours: count(['threeHours', 'hour3', 'threeHourCount', 'threeCount']),
          day: count(['day', 'hour24', 'dayCount', 'todayCount']),
        })
      }
    })
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

  // 数据源列表的雷达/无人机站作增量补充（按类型+坐标去重，避免与原接口重复打点）
  const deviceMapPoints = useMemo<MapDevicePoint[]>(() => {
    const pointKey = (point: MapDevicePoint) => `${point.type}:${point.lng.toFixed(4)},${point.lat.toFixed(4)}`
    const seen = new Set(legacyDevicePoints.map(pointKey))
    const extra = sourceDevicePoints.filter(point => !seen.has(pointKey(point)))
    return [...legacyDevicePoints, ...extra]
  }, [legacyDevicePoints, sourceDevicePoints])

  const cityDistricts = useMemo(() => {
    if (!activeCity) return []
    return districts.filter(item => item.parent === Number(activeCity.adcode))
  }, [activeCity])

  // 空气质量监测站列表（/latest）：后台暂未要求传地市，但按需要一并传递当前市 deptId
  useEffect(() => {
    const cityDeptId = findCityDeptId(allDepts, selection?.cityName)
    const params = cityDeptId != null ? { deptId: Number(cityDeptId) } : {}
    let cancelled = false
    airDataLatest(params)
      .then(res => { if (!cancelled) setStationList(Array.isArray(res.data) ? res.data : []) })
      .catch(() => { if (!cancelled) setStationList([]) })
    return () => { cancelled = true }
  }, [allDepts, selection])

  // 地图打点（数据源列表 needAqi=1）：按 dataType 分流——
  // air_quality_station 微站→AQI 六级图标；radar_station→雷达图标；drone_sensor→无人机场图标
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

        // 空气质量微站：按 aqiLevel 打六级图标，图标上方显示综合 AQI 值
        const airStations: AirQualityPoint[] = records
          .filter(item => item.dataType === 'air_quality_station' && item.aqiLevel != null)
          .map(item => ({
            name: item.deviceName,
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

        // 雷达站/无人机传感器站：打设备图标（在线状态由 connectionStatus 决定）
        const devices: MapDevicePoint[] = records.flatMap(item => {
          if (item.dataType !== 'radar_station' && item.dataType !== 'drone_sensor') return []
          return [{
            id: String(item.id),
            type: item.dataType === 'radar_station' ? 'radar' as const : 'drone' as const,
            name: item.deviceName,
            address: item.location ?? '',
            lng: item.lng as number,
            lat: item.lat as number,
            online: item.connectionStatus === 'online',
          }]
        })
        setSourceDevicePoints(devices)
      })
      .catch(() => {
        if (!cancelled) {
          setAirPoints([])
          setSourceDevicePoints([])
        }
      })
    return () => { cancelled = true }
  }, [allDepts, selection])

  // 点击地图空气质量打点：直接展示该站点综合 AQI 与各污染物分指数 IAQI（数据已随列表返回）
  const handleAirPointClick = (point: AirQualityPoint) => {
    setAirDetail({
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
    })
  }

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

  return (
    <div className="monitor-screen w-full h-full flex overflow-hidden text-[#e7f7ff]">
      {/* 左侧面板：空气质量检测站 */}
      <aside className="station-panel w-310px shrink-0 flex flex-col overflow-hidden rounded-12px border border-[#00d4ff]/35 bg-[rgba(6,30,70,0.65)] p-3 gap-3 shadow-[0_0_20px_rgba(0,180,255,0.15)]">
        <div className="station-panel__title flex items-center justify-between rounded-8px px-3.5 py-2.5 border border-[#00d4ff]/40 bg-[linear-gradient(135deg,rgba(12,65,135,0.95),rgba(6,40,95,0.9))] shadow-[0_0_12px_rgba(0,180,255,0.2)]">
          <div className="flex items-center gap-2">
            <span className="w-4px h-16px bg-[#00f0ff] rounded-xs shadow-[0_0_8px_#00f0ff]" />
            <span className="text-white text-15px font-bold tracking-wide">空气质量检测站</span>
          </div>
        </div>

        <div className="station-list flex-1 overflow-y-auto pr-1 space-y-2.5 scrollbar-thin">
          {stationList.map(station => (
            <AirStationCard key={station.id} station={station} fields={STATION_FIELDS} />
          ))}
          {!stationList.length && <div className="text-11px text-[#7088a8] text-center py-4">暂无站点数据</div>}
        </div>
      </aside>

      {/* 主地图展示区域 */}
      <main
        data-device-point-count={deviceMapPoints.length}
        className="monitor-map-stage flex-1 relative overflow-hidden min-w-0 rounded-12px border border-[#00d4ff]/35 shadow-[0_0_24px_rgba(0,180,255,0.15)]"
      >
        {isProvinceView ? (
          <ZJ3DMap
            selectedCity={selection?.cityName}
            devicePoints={deviceMapPoints}
            airPoints={airPoints}
            onCityClick={handleCityClick}
            onCityHover={setHoverRegion}
            onAirPointClick={handleAirPointClick}
          />
        ) : activeCounty ? (
          <CountyBoundaryMap county={activeCounty} devicePoints={deviceMapPoints} airPoints={airPoints} onAirPointClick={handleAirPointClick} />
        ) : activeCity ? (
          <CityDistrictMap
            city={activeCity}
            districtItems={cityDistricts}
            selectedDistrict={selection?.countyName}
            devicePoints={deviceMapPoints}
            airPoints={airPoints}
            onDistrictClick={selectDistrict}
            onDistrictHover={setHoverRegion}
            onAirPointClick={handleAirPointClick}
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-[#dffbff]">区域地图加载失败</div>
        )}

        {/* 左上图例组：空气质量检测站 + 无人机场 */}
        <div className="map-legend-deck map-legend-deck--left absolute top-3 left-3 z-20 flex items-start gap-3 text-11px">
          {/* 空气质量检测站 */}
          <div className="map-legend-card map-legend-card--air">
            <div className="text-[#7bd7ff] font-bold mb-1.5 flex items-center gap-1.5">
              <span className="w-3px h-11px bg-[#00f0ff]" />
              <span>空气质量检测站</span>
            </div>
            <div className="flex flex-col gap-1 text-[#d2ecff] text-10px">
              <div className="flex items-center gap-1"><img src="/marker/aq-good.png" className="w-14px h-14px" alt="" /><span>优(1~50)</span></div>
              <div className="flex items-center gap-1"><img src="/marker/aq-moderate.png" className="w-14px h-14px" alt="" /><span>良(51~100)</span></div>
              <div className="flex items-center gap-1"><img src="/marker/aq-light.png" className="w-14px h-14px" alt="" /><span>轻度污染(101~150)</span></div>
              <div className="flex items-center gap-1"><img src="/marker/aq-medium.png" className="w-14px h-14px" alt="" /><span>中度污染(151~200)</span></div>
              <div className="flex items-center gap-1"><img src="/marker/aq-heavy.png" className="w-14px h-14px" alt="" /><span>重度污染(201~300)</span></div>
              <div className="flex items-center gap-1"><img src="/marker/aq-severe.png" className="w-14px h-14px" alt="" /><span>严重污染(&gt;300)</span></div>
            </div>
          </div>

          {/* 无人机场 */}
          <div className="map-legend-card map-legend-card--drone">
            <div className="text-[#7bd7ff] font-bold mb-1.5 flex items-center gap-1.5">
              <span className="w-3px h-11px bg-[#1ad4ef]" />
              <span>无人机场</span>
            </div>
            <div className="flex flex-col gap-1 text-[#d2ecff] text-10px">
              <div className="flex items-center gap-1"><img src="/marker/drone-on.png" className="w-14px h-14px" alt="" /><span>在线</span></div>
              <div className="flex items-center gap-1"><img src="/marker/drone-off.png" className="w-14px h-14px" alt="" /><span>离线</span></div>
              <div className="flex items-center gap-1"><span className="w-10px h-2px bg-[#00d4ff]" /><span>飞行路线</span></div>
              <div className="flex items-center gap-1"><img src="/marker/drone-fly.png" className="w-14px h-14px" alt="" /><span>飞行中无人机</span></div>
            </div>
          </div>
        </div>

        {/* 右上图例组：光量子雷达站 + 预警点位（位于省/市控制组下方） */}
        <div className="map-legend-deck map-legend-deck--right absolute top-44px right-3 z-20 flex items-start gap-3 text-11px">
          {/* 光量子雷达站 */}
          <div className="map-legend-card map-legend-card--radar">
            <div className="text-[#7bd7ff] font-bold mb-1.5 flex items-center gap-1.5">
              <span className="w-3px h-11px bg-[#c17cff]" />
              <span>光量子雷达站</span>
            </div>
            <div className="flex flex-col gap-1 text-[#d2ecff] text-10px">
              <div className="flex items-center gap-1"><img src="/marker/radar-on.png" className="w-14px h-14px" alt="" /><span>在线</span></div>
              <div className="flex items-center gap-1"><img src="/marker/radar-off.png" className="w-14px h-14px" alt="" /><span>离线</span></div>
            </div>
          </div>

          {/* 预警点位 */}
          <div className="map-legend-card map-legend-card--warning">
            <div className="text-[#7bd7ff] font-bold mb-1.5 flex items-center gap-1.5">
              <span className="w-3px h-11px bg-[#ff6868]" />
              <span>预警点位</span>
            </div>
            <div className="flex flex-col gap-1 text-[#d2ecff] text-10px">
              <div className="flex items-center gap-1"><img src="/marker/warn-l1.png" className="w-14px h-14px" alt="" /><span>一级预警</span></div>
              <div className="flex items-center gap-1"><img src="/marker/warn-l2.png" className="w-14px h-14px" alt="" /><span>二级预警</span></div>
              <div className="flex items-center gap-1"><img src="/marker/warn-l3.png" className="w-14px h-14px" alt="" /><span>三级预警</span></div>
            </div>
          </div>
        </div>

        {/* 右上浮层：省/市/区控制组 */}
        <div className="region-controls absolute top-3 right-3 z-20 flex items-center gap-2 rounded-8px bg-[rgba(4,22,52,0.85)] p-1.5 border border-[#00d4ff]/30 shadow-[0_4px_12px_rgba(0,0,0,0.3)]">
          <Select value="浙江省" disabled className="w-88px screen-select" classNames={{ popup: { root: 'screen-select-popup' } }} size="small" options={[{ value: '浙江省', label: '浙江省' }]} />
          <Select
            value={selection?.cityCode}
            onChange={selectCity}
            disabled={roleLevel !== 'admin'}
            allowClear={roleLevel === 'admin'}
            placeholder="全省"
            className="w-92px screen-select"
            classNames={{ popup: { root: 'screen-select-popup' } }}
            size="small"
            options={cities.map(city => ({ value: city.adcode, label: city.name }))}
          />
          {selection?.cityCode && roleLevel !== 'admin' && (
            <Select
              value={selection.countyName}
              onChange={selectDistrict}
              disabled={roleLevel === 'county' || roleLevel === 'town'}
              allowClear={roleLevel === 'city'}
              placeholder="全市"
              className="w-100px screen-select"
              classNames={{ popup: { root: 'screen-select-popup' } }}
              size="small"
              options={cityDistricts.map(item => ({ value: item.name, label: item.name }))}
            />
          )}
          {roleLevel === 'town' && (
            <Select
              value={selection?.townName}
              disabled
              className="w-150px screen-select"
              classNames={{ popup: { root: 'screen-select-popup' } }}
              size="small"
              options={selection?.townName ? [{ value: selection.townName, label: selection.townName }] : []}
            />
          )}
        </div>

        {/* 地图 Hover 提示 */}
        {hoverRegion && hoverRegion !== selectedRegionName && (
          <div className="absolute top-14 left-1/2 -translate-x-1/2 z-20 px-4 py-1.5 rounded-lg border border-[#00d4ff]/60 bg-[rgba(4,22,52,0.92)] shadow-[0_6px_20px_rgba(0,10,35,0.4)]">
            <span className="text-[#e5fcff] text-12px">点击选择 </span><span className="text-[#00f0ff] text-13px font-bold">{hoverRegion}</span>
          </div>
        )}

        {/* 空气质量打点详情弹窗 */}
        {airDetail && (
          <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-30 w-290px p-3 rounded-8px border border-[#00d4ff]/45 bg-[rgba(4,22,52,0.94)] shadow-[0_8px_28px_rgba(0,10,35,0.55)]">
            <div className="flex items-center justify-between mb-2">
              <span className="text-[#00f0ff] text-13px font-bold truncate">{airDetail.name} 监测详情</span>
              <button
                type="button"
                className="text-[#7088a8] hover:text-white text-13px leading-none px-1 cursor-pointer"
                onClick={() => setAirDetail(null)}
              >
                ✕
              </button>
            </div>
            <div className="flex items-center gap-2 mb-2 pb-2 border-b border-[#00d4ff]/20">
              <span className="text-[#5ca2d9] text-11px">综合 AQI</span>
              <span className="text-[#00ffff] font-mono font-bold text-18px">{airDetail.aqi != null ? airDetail.aqi : '--'}</span>
              {airDetail.aqiLevel && (
                <span className="text-10px px-1.5 py-0.5 rounded bg-[#0a3a6b] text-[#7bd7ff] border border-[#00d4ff]/30">{airDetail.aqiLevel}</span>
              )}
            </div>
            <div className="grid grid-cols-3 gap-1.5 text-center">
              {IAQI_DETAIL_FIELDS.map(({ key, label }) => (
                <div key={key}>
                  <div className="text-[#00ffff] font-mono font-bold text-13px">{formatAirValue(airDetail.values[key])}</div>
                  <div className="text-[#5ca2d9] text-10px mt-0.5">{label}</div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* 左下浮层：数据源概况 */}
        <div className="source-summary absolute bottom-56px left-3 z-20 text-11px text-[#b2d9ff]/90 space-y-1 font-mono p-2.5 rounded-6px bg-[rgba(4,22,52,0.45)] border border-[#00d4ff]/25">
          <div>在线数据源：<span className="text-[#00ffff] font-bold">89</span></div>
          <div>数据总量：<span className="text-[#00ffff] font-bold">58675</span></div>
          <div>数据准确性：<span className="text-[#00ffff] font-bold">100%</span></div>
        </div>

        {/* 右下浮层：监测分布总结 */}
        <div className="distribution-summary absolute bottom-56px right-3 z-20 p-3 rounded-8px border border-[#00d4ff]/35 bg-[rgba(4,22,52,0.9)] shadow-lg max-w-340px">
          <div className="text-[#00f0ff] text-13px font-bold mb-1">{selectedRegionName}环境监测分布</div>
          <div className="text-[#b2d9ff]/80 text-11px leading-relaxed">
            共 <span className="text-[#00f0ff] font-bold font-mono">11</span> 个空气质量检测站<br />
            <span className="text-[#00f0ff] font-bold font-mono">{radarStations.length}</span> 个光量子雷达站 | <span className="text-[#00f0ff] font-bold font-mono">{droneStations.length}</span> 个无人机场
          </div>
        </div>
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
                <span className="truncate pr-2" title={`${station.name} · ${station.address}`}>{station.name}</span>
                <span className={station.online ? 'text-[#22f0a2]' : 'text-[#8ca3bd]'}>{station.online ? '在线' : '离线'}</span>
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

          <div className="mt-2 max-h-72px overflow-y-auto space-y-1">
            {radarStations.slice(0, 5).map(station => (
              <div key={station.id} className="flex items-center justify-between text-10px text-[#b2d9ff]">
                <span className="truncate pr-2" title={`${station.name} · ${station.address}`}>{station.name}</span>
                <span className={station.online ? 'text-[#22f0a2]' : 'text-[#8ca3bd]'}>{station.online ? '在线' : '离线'}</span>
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
    </div>
  )
}

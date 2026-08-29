import { useEffect, useMemo, useRef, useState, type CSSProperties } from 'react'
import { useNavigate } from 'react-router-dom'
import { Modal, Select, Spin, Switch, Table } from 'antd'
import { CloseOutlined, SearchOutlined } from '@ant-design/icons'
import type { ColumnsType } from 'antd/es/table'
import { Chart } from '@antv/g2'
import dayjs from 'dayjs'
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
import { airDataLatest, airDataStationAirRange } from '@/servers/airData'
import { alertEventApi, dataSourceApi } from '@/servers/business'
import type { AlertDashboardItem, AlertDashboardVO, AlertEventQuery, DataSourceQuery } from '@/types/business'
import type { MapDevicePoint } from '@/types/mapDevice'
import type { RadarAlarmPoint } from '@/utils/mapRadarAlarmLayers'
import type { EmissionOutletPoint, OutletPointClickPos } from '@/utils/mapEmissionOutletLayers'
import { resolveAlertLevel, type AlertMapPoint } from '@/utils/mapAlertLayers'
import type { AirDataLatestVO, AirQualityPoint, AirTrendItem, StationAirRange } from '@/types/airData'
import type { AirPointClickPos } from '@/utils/mapAirLayers'
import { flattenDepts, findCityDeptId, findDistrictDeptId } from '@/utils/airQuality'
import type { MapFocusTarget } from '@/types/mapFocus'
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

/** 格式化站点数值（保留一位小数，空值显示 --） */
function formatAirValue(value: unknown): string {
  const num = Number(value)
  if (value == null || !Number.isFinite(num)) return '--'
  return String(Math.round(num * 10) / 10)
}

/** 格式化 min-max 区间（无数据显示 --，min=max 时只显示单个值） */
function formatRange(min: number | null | undefined, max: number | null | undefined): string {
  const hasMin = min != null && Number.isFinite(min)
  const hasMax = max != null && Number.isFinite(max)
  if (!hasMin && !hasMax) return '--'
  if (hasMin && !hasMax) return String(min)
  if (!hasMin && hasMax) return String(max)
  if (min === max) return String(min)
  return `${min}~${max}`
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

function DialGraphic({ gifSrc, alt }: { gifSrc: string; alt: string }) {
  return (
    <div className="monitor-dial-gif relative w-96px h-96px shrink-0 flex items-center justify-center">
      <img src={gifSrc} alt={alt} className="w-full h-full object-contain" draggable={false} />
    </div>
  )
}

const sidePanelStyle = {
  background: 'linear-gradient(160deg, rgba(7, 36, 78, 0.9), rgba(4, 22, 55, 0.85))',
  border: '1px solid rgba(0, 180, 255, 0.35)',
  boxShadow: '0 4px 24px rgba(0, 10, 35, 0.6), inset 0 0 15px rgba(0, 180, 255, 0.1)',
}

/** 近一小时区间展示的 8 种污染物字段（名称与单位分开处理，以便样式精细控制） */
const AIR_RANGE_FIELDS: { key: string; name: string; unit: string }[] = [
  { key: 'pm25', name: 'PM2.5', unit: '(μg/m³)' },
  { key: 'pm10', name: 'PM10', unit: '(μg/m³)' },
  { key: 'so2', name: 'SO₂', unit: '(μg/m³)' },
  { key: 'no2', name: 'NO₂', unit: '(μg/m³)' },
  { key: 'co', name: 'CO', unit: '(mg/m³)' },
  { key: 'o3', name: 'O₃', unit: '(μg/m³)' },
  { key: 'vocs', name: 'VOCs', unit: '(μg/m³)' },
  { key: 'tsp', name: 'TSP', unit: '(μg/m³)' },
]
/** 站点类型中文映射（stationAirRange 按站点类型分组返回） */
const STATION_TYPE_LABEL: Record<string, string> = { fixed: '固定站', mobile: '移动站' }

/** 提取标题中文与括号（括号及内部文字淡化/小号处理） */
function renderTitleWithBracket(title: string) {
  const match = title.match(/^(.*?)（(.*?)）$/)
  if (match) {
    return (
      <span className="truncate flex items-baseline">
        <span>{match[1]}</span>
        <span className="text-11px text-[#9de2ff] font-normal ml-0.5">（{match[2]}）</span>
      </span>
    )
  }
  return <span className="truncate">{title}</span>
}

/** 空气质量站（固定站/移动站）区间卡片：统一青色（#18e8ff）数据点击后查看站点数据详情 */
function AirStationRangeCard({ title, range, latestTime, onView }: {
  title: string
  range?: StationAirRange
  latestTime?: string
  onView: () => void
}) {
  const values = (range ?? {}) as unknown as Record<string, number | null>
  return (
    <section className="status-card h-200px shrink-0 flex flex-col overflow-hidden" style={sidePanelStyle}>
      <div className="panel-title-divider flex items-center gap-1.5 text-[#7bd7ff] text-12px font-bold mb-2 pb-2">
        <span className="w-3px h-11px bg-[#00f0ff]" />
        {renderTitleWithBracket(title)}
        {latestTime && (
          <span className="ml-auto shrink-0 text-[#5c92c1] text-10px font-mono font-normal">
            {dayjs(latestTime).format('YYYY/MM/DD HH:mm')}
          </span>
        )}
      </div>
      {/* 8 条指标各自独立色块包裹 */}
      <div className="flex-1 min-h-0 grid grid-cols-2 content-start gap-2.5">
        {AIR_RANGE_FIELDS.map(field => (
          <div key={field.key} className="flex items-center justify-between rounded-4px border border-[#2f7fd6]/60 bg-[#1c64be]/55 px-2 py-1.5">
            <span className="text-10px whitespace-nowrap flex items-baseline">
              <span className="text-[#edf6ff] font-semibold">{field.name}</span>
              <span className="text-9px text-[#a3d4ff]/85 font-normal ml-0.5">{field.unit}</span>
            </span>
            <button
              type="button"
              onClick={onView}
              className="text-[#18e8ff] text-11px font-mono cursor-pointer bg-transparent border-none p-0 hover:text-white hover:underline"
            >
              {range ? formatRange(values[`${field.key}Min`], values[`${field.key}Max`]) : '--'}
            </button>
          </div>
        ))}
      </div>
    </section>
  )
}

/** 最新预警轮播参数：单条高度（含间距）与最大可视条数（实际条数按可用高度动态计算，避免列表被卡片裁切） */
const ALERT_CAROUSEL_ITEM_HEIGHT = 46
const ALERT_CAROUSEL_MAX_VISIBLE = 5
/** 最新预警最多展示条数 */
const ALERT_LATEST_LIMIT = 10

/** 预警处置统计卡片：重背景色块 + 纯白文字，完全靠背景色区分状态 */
function AlertStatCard({ label, count, bg }: { label: string; count: number; bg: string }) {
  return (
    <div className="flex items-center gap-2 rounded-6px px-2.5 py-1.5" style={{ background: bg, border: '1px solid rgba(255,255,255,0.18)' }}>
      <b className="font-mono text-18px leading-none text-white">{count}</b>
      <span className="text-white text-10px">{label}</span>
    </div>
  )
}

/** 最新预警轮播：每 3 秒向上滚动一条，列表复制一份后滚过一圈无动画归位，实现无缝循环；
 * 可视条数按容器实际可用高度动态反算，保证列表高度始终是条目高度整数倍且不被卡片裁切 */
function AlertLatestCarousel({ items, onNavigate }: { items: AlertDashboardItem[]; onNavigate: () => void }) {
  const [tick, setTick] = useState(0)
  const containerRef = useRef<HTMLDivElement>(null)
  const [visible, setVisible] = useState(3)

  useEffect(() => {
    const el = containerRef.current
    if (!el) return
    const measure = () => setVisible(Math.max(1, Math.min(ALERT_CAROUSEL_MAX_VISIBLE, Math.floor(el.clientHeight / ALERT_CAROUSEL_ITEM_HEIGHT))))
    measure()
    const observer = new ResizeObserver(measure)
    observer.observe(el)
    return () => observer.disconnect()
  }, [])

  const enabled = items.length > visible

  useEffect(() => {
    if (!enabled) return
    const timer = window.setInterval(() => setTick(t => t + 1), 3000)
    return () => window.clearInterval(timer)
  }, [enabled])

  // 可视条数变化时偏移取模归位，避免滚动位置超出新可视范围
  const offset = enabled ? tick % (items.length + 1) : 0
  const displayItems = enabled ? [...items, ...items] : items

  return (
    <div ref={containerRef} className="min-h-0 flex-1">
      {/* 内层视口高度精确为条目高度整数倍，底部不会露出半条被裁切的条目 */}
      <div className="overflow-hidden" style={{ height: visible * ALERT_CAROUSEL_ITEM_HEIGHT }}>
        <div
          style={{
            transform: `translateY(-${offset * ALERT_CAROUSEL_ITEM_HEIGHT}px)`,
            transition: offset !== 0 ? 'transform 0.5s ease' : 'none',
          }}
        >
          {displayItems.map((item, idx) => (
            <div
              key={`${item.alertTime}-${idx}`}
              onClick={onNavigate}
              className="h-40px mb-1.5 rounded-6px border border-[#2f7fd6]/60 bg-[#1c64be]/55 px-2.5 py-1 cursor-pointer transition-colors hover:border-[#2f9bff]"
            >
              <div className="flex items-center gap-1.5">
                <span className="shrink-0 w-5px h-5px rounded-full bg-[#ff6868] shadow-[0_0_6px_#ff6868]" />
                <span className="flex-1 min-w-0 text-[#d2ecff] text-11px font-bold truncate" title={item.ruleName}>{item.ruleName}</span>
                <span className="shrink-0 text-[#5c92c1] text-9px font-mono">{item.alertTime ? dayjs(item.alertTime).format('HH:mm') : '--'}</span>
              </div>
              <div className="mt-0.5 pl-6.5 text-10px text-[#5c92c1] truncate" title={item.location}>{item.location}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

/** 站点数据弹窗表格展示的污染物字段（时间列单独渲染站点名 + 时间） */
const STATION_DATA_FIELDS: { key: 'pm10' | 'pm25' | 'o3' | 'so2' | 'no2' | 'co' | 'vocs' | 'tsp'; label: string }[] = [
  { key: 'pm10', label: 'PM10' },
  { key: 'pm25', label: 'PM2.5' },
  { key: 'o3', label: 'O3' },
  { key: 'so2', label: 'SO2' },
  { key: 'no2', label: 'NO2' },
  { key: 'co', label: 'CO' },
  { key: 'vocs', label: 'VOCs' },
  { key: 'tsp', label: 'TSP' },
]

/** 站点数据弹窗表格列：基站名称 + 8 种污染物，与其他页面统一使用 antd Table + tech-table-wrapper */
const STATION_DATA_COLUMNS: ColumnsType<AirDataLatestVO> = [
  {
    title: '基站名称',
    dataIndex: 'shortName',
    key: 'shortName',
    width: 180,
    render: (value: unknown, record: AirDataLatestVO) => (
      <span className="text-[#d2ecff]">{String(value ?? record.deviceName ?? '--')}</span>
    ),
  },
  ...STATION_DATA_FIELDS.map(field => ({
    title: field.label,
    dataIndex: field.key,
    key: field.key,
    align: 'center' as const,
    render: (value: unknown) => formatAirValue(value),
  })),
]

/** 空气质量站数据弹窗：固定站/移动站 Tab 切换，调用 airData/latest 接口（关闭即卸载重置状态） */
function StationDataModal({ stationType, onClose }: { stationType: 'fixed' | 'mobile'; onClose: () => void }) {
  const [tab, setTab] = useState(stationType)
  const [rows, setRows] = useState<AirDataLatestVO[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    // 标准的列表数据拉取模式，忽略 set-state-in-effect 规则
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setLoading(true)
    airDataLatest({ stationType: tab })
      .then(res => { if (!cancelled) setRows(Array.isArray(res.data) ? res.data : []) })
      .catch(() => { if (!cancelled) setRows([]) })
      .finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [tab])

  return (
    <Modal open onCancel={onClose} footer={null} title={null} width={1060} centered className="station-data-modal">
      <div className="flex justify-center gap-3 mb-3">
        {(['fixed', 'mobile'] as const).map(type => (
          <button
            key={type}
            type="button"
            onClick={() => setTab(type)}
            className={`px-6 py-1.5 rounded-4px text-13px font-bold border transition-all cursor-pointer ${
              tab === type
                ? 'text-white border-[#2f9bff] bg-[linear-gradient(135deg,#1890ff,#00c6fb)] shadow-[0_0_10px_rgba(24,144,255,0.5)]'
                : 'text-[#9fcbe8] border-[#144982] bg-[#0a2f5e]/60 hover:text-white'
            }`}
          >
            {STATION_TYPE_LABEL[type]}
          </button>
        ))}
      </div>
      <div className="tech-table-wrapper" style={{ flex: 'none' }}>
        <Table
          columns={STATION_DATA_COLUMNS}
          dataSource={rows}
          rowKey="id"
          loading={loading}
          size="small"
          pagination={false}
          scroll={{ x: 900, y: 380 }}
        />
      </div>
    </Modal>
  )
}
/** AQI 页签字段：IAQI 卡片与趋势图字段合一（可勾选，color 为趋势线颜色） */
const AIR_AQI_FIELDS: { valueKey: string; trendKey: keyof AirTrendItem; label: string; color: string }[] = [
  { valueKey: 'pm25Iaqi', trendKey: 'pm25', label: 'PM2.5', color: '#00ddfa' },
  { valueKey: 'pm10Iaqi', trendKey: 'pm10', label: 'PM10', color: '#f8973c' },
  { valueKey: 'so2Iaqi', trendKey: 'so2', label: 'SO₂', color: '#7ed957' },
  { valueKey: 'no2Iaqi', trendKey: 'no2', label: 'NO₂', color: '#fad93e' },
  { valueKey: 'coIaqi', trendKey: 'co', label: 'CO', color: '#c17cff' },
  { valueKey: 'o3Iaqi', trendKey: 'o3', label: 'O₃', color: '#ff6b81' },
]

/** 浓度页签字段：直接读取 aqiDetail 返回的 8 项 *Avg。 */
const AIR_CONCENTRATION_FIELDS: { valueKey: string; trendKey: keyof AirTrendItem; label: string; unit: string; color: string }[] = [
  { valueKey: 'pm25Avg', trendKey: 'pm25', label: 'PM2.5', unit: 'μg/m³', color: '#00ddfa' },
  { valueKey: 'pm10Avg', trendKey: 'pm10', label: 'PM10', unit: 'μg/m³', color: '#f8973c' },
  { valueKey: 'so2Avg', trendKey: 'so2', label: 'SO₂', unit: 'μg/m³', color: '#7ed957' },
  { valueKey: 'no2Avg', trendKey: 'no2', label: 'NO₂', unit: 'μg/m³', color: '#fad93e' },
  { valueKey: 'coAvg', trendKey: 'co', label: 'CO', unit: 'mg/m³', color: '#c17cff' },
  { valueKey: 'o3Avg', trendKey: 'o3', label: 'O₃', unit: 'μg/m³', color: '#ff6b81' },
  { valueKey: 'vocsAvg', trendKey: 'vocs', label: 'VOCs', unit: 'μg/m³', color: '#35c4a8' },
  { valueKey: 'tspAvg', trendKey: 'tsp', label: 'TSP', unit: 'μg/m³', color: '#5c8dff' },
]

interface AirPointDetail {
  /** 数据源 ID（用于查询 aqiDetail 近 12 小时趋势） */
  id?: number
  name: string
  aqi: number | null
  aqiLevel: string
  values: Record<string, number | null>
  /** 点击时的屏幕像素坐标（弹窗锚定位置，缺失时居中） */
  pos?: AirPointClickPos
}

/** 企业排口详情弹窗数据（点击排口圆点时填充） */
interface OutletPointDetail extends EmissionOutletPoint {
  /** 点击时的屏幕像素坐标（弹窗锚定位置，缺失时居中） */
  pos?: OutletPointClickPos
}

/** 将单条趋势对象解析为 AirTrendItem（字段名兼容） */
function parseTrendRow(row: UnknownRecord): AirTrendItem | null {
  const hourText = firstText(row, ['hour', 'time', 'dataTime'])
  if (!hourText) return null
  const numVal = (key: string) => {
    const raw = row[key]
    const num = Number(raw)
    return raw != null && Number.isFinite(num) ? num : null
  }
  return {
    hour: hourText,
    pm25: numVal('pm25'),
    pm10: numVal('pm10'),
    so2: numVal('so2'),
    no2: numVal('no2'),
    co: numVal('co'),
    o3: numVal('o3'),
    vocs: numVal('vocs'),
    tsp: numVal('tsp'),
  }
}

/** 从 aqiDetail 返回中提取趋势数组（兼容直接返回数组、*Trend 独立数组或包一层对象的结构） */
function extractTrendRows(value: unknown, mode: 'concentration' | 'aqi'): AirTrendItem[] {
  // 直接数组：按旧格式 { hour, pm25, pm10, ... } 解析
  if (Array.isArray(value)) {
    return value
      .filter(item => !!item && typeof item === 'object')
      .map(item => parseTrendRow(item as UnknownRecord))
      .filter((item): item is AirTrendItem => !!item)
  }

  if (!value || typeof value !== 'object') return []
  const record = value as UnknownRecord

  // 后端实际结构：{ so2Trend: [{hour,value},...], no2Trend: [...], ... }
  const pollutantKeys: (keyof AirTrendItem)[] = mode === 'aqi'
    ? ['pm25', 'pm10', 'so2', 'no2', 'co', 'o3']
    : ['pm25', 'pm10', 'so2', 'no2', 'co', 'o3', 'vocs', 'tsp']
  const TREND_FIELD_MAP = Object.fromEntries(
    pollutantKeys.map(key => [`${key}${mode === 'aqi' ? 'IaqiTrend' : 'Trend'}`, key]),
  ) as Record<string, keyof AirTrendItem>
  const merged = new Map<string, AirTrendItem>()
  let hasTrendFields = false
  Object.entries(TREND_FIELD_MAP).forEach(([trendKey, itemKey]) => {
    const arr = record[trendKey]
    if (!Array.isArray(arr)) return
    hasTrendFields = true
    arr.forEach((item: unknown) => {
      if (!item || typeof item !== 'object') return
      const row = item as UnknownRecord
      const hourText = firstText(row, ['hour', 'time', 'dataTime'])
      if (!hourText) return
      const rawValue = row.value
      const num = Number(rawValue)
      const val = rawValue != null && Number.isFinite(num) ? num : null
      let existing = merged.get(hourText)
      if (!existing) {
        existing = { hour: hourText, pm25: null, pm10: null, so2: null, no2: null, co: null, o3: null, vocs: null, tsp: null }
        merged.set(hourText, existing)
      }
      ;(existing as unknown as UnknownRecord)[itemKey] = val
    })
  })
  if (hasTrendFields) {
    return Array.from(merged.values())
  }

  // 兼容旧结构：{ trendList: [...], trend: [...], list: [...], rows: [...], data: [...], hours: [...] }
  for (const key of ['trendList', 'trend', 'list', 'rows', 'data', 'hours']) {
    const nested = record[key]
    if (Array.isArray(nested)) {
      return nested
        .filter(item => !!item && typeof item === 'object')
        .map(item => parseTrendRow(item as UnknownRecord))
        .filter((item): item is AirTrendItem => !!item)
    }
  }

  return []
}

/** 弹窗固定宽高（定位计算与内容布局均基于此尺寸，避免加载前后尺寸抖动） */
const AIR_POPUP_WIDTH = 400
const AIR_POPUP_HEIGHT = 372
/** 弹窗与点击位置的间距 */
const AIR_POPUP_GAP = 14

/** 空气质量站监测详情弹窗：AQI/浓度切换，指标卡片与近 12 小时趋势图联动。 */
function AirStationDetailPopup({ detail, onClose }: { detail: AirPointDetail; onClose: () => void }) {
  const popupRef = useRef<HTMLDivElement>(null)
  const [mode, setMode] = useState<'concentration' | 'aqi'>('aqi')
  // 勾选项默认第一项（PM2.5），trendKey 即趋势数据字段
  const [checkedKeys, setCheckedKeys] = useState<(keyof AirTrendItem)[]>(['pm25'])
  const [concentrationTrend, setConcentrationTrend] = useState<AirTrendItem[]>([])
  const [aqiTrend, setAqiTrend] = useState<AirTrendItem[]>([])
  const [responseData, setResponseData] = useState<UnknownRecord | null>(null)
  const [loading, setLoading] = useState(detail.id != null)
  const chartBoxRef = useRef<HTMLDivElement>(null)

  const activeFields = mode === 'aqi' ? AIR_AQI_FIELDS : AIR_CONCENTRATION_FIELDS
  const trend = mode === 'aqi' ? aqiTrend : concentrationTrend

  // 点击弹窗外部区域时自动关闭弹窗
  useEffect(() => {
    const handlePointerDown = (event: MouseEvent | TouchEvent) => {
      if (popupRef.current && !popupRef.current.contains(event.target as Node)) {
        onClose()
      }
    }
    const timer = setTimeout(() => {
      document.addEventListener('mousedown', handlePointerDown)
      document.addEventListener('touchstart', handlePointerDown)
    }, 0)
    return () => {
      clearTimeout(timer)
      document.removeEventListener('mousedown', handlePointerDown)
      document.removeEventListener('touchstart', handlePointerDown)
    }
  }, [onClose])

  // 弹窗立即展示（卡片数据随点击已返回），趋势接口异步加载并带 loading（初始 true，按站点 key 重挂载时重置）
  useEffect(() => {
    let cancelled = false
    if (detail.id == null) return
    dataSourceApi.aqiDetail(detail.id)
      .then(res => {
        if (cancelled) return
        const payload = res.data && typeof res.data === 'object' ? res.data as UnknownRecord : null
        setResponseData(payload)
        setConcentrationTrend(extractTrendRows(payload, 'concentration'))
        setAqiTrend(extractTrendRows(payload, 'aqi'))
        setLoading(false)
      })
      .catch(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [detail])

  // 勾选切换：允许多选；仅剩一项勾选时不允许取消
  const toggleField = (trendKey: keyof AirTrendItem) => {
    setCheckedKeys(prev => {
      if (prev.includes(trendKey)) return prev.length > 1 ? prev.filter(key => key !== trendKey) : prev
      return [...prev, trendKey]
    })
  }

  const switchMode = (nextMode: 'concentration' | 'aqi') => {
    const nextFields = nextMode === 'aqi' ? AIR_AQI_FIELDS : AIR_CONCENTRATION_FIELDS
    const availableKeys = new Set(nextFields.map(field => field.trendKey))
    setMode(nextMode)
    setCheckedKeys(prev => {
      const next = prev.filter(key => availableKeys.has(key))
      return next.length ? next : [nextFields[0].trendKey]
    })
  }

  // 趋势图：按勾选项重绘（勾选卡片即图例，隐藏 G2 自带图例）
  useEffect(() => {
    const container = chartBoxRef.current
    if (!container || !trend.length) return undefined
    const checkedFields = activeFields.filter(field => checkedKeys.includes(field.trendKey))
    const longData = trend.flatMap(row => checkedFields.map(field => ({
      hour: row.hour,
      label: field.label,
      value: row[field.trendKey as keyof AirTrendItem] ?? null,
    })))
    const chart = new Chart({ container, autoFit: true })
    chart.theme({ type: 'classicDark' })
    chart.line()
      .data(longData)
      .encode('x', 'hour')
      .encode('y', 'value')
      .encode('color', 'label')
      .style({ lineWidth: 2 })
    chart.scale({ color: { range: checkedFields.map(field => field.color) } })
    chart.axis({
      x: { title: false, labelFontSize: 9, labelFill: '#5ca2d9', line: true, lineStroke: '#16436e' },
      y: { title: false, labelFontSize: 9, labelFill: '#5ca2d9', grid: true, gridStroke: '#123252' },
    })
    chart.legend(false)
    chart.render()
    return () => { chart.destroy() }
  }, [trend, checkedKeys, activeFields])

  // 弹窗固定宽高，优先展示在点击位置上方，上方放不下时翻转到下方；无坐标时居中
  const pos = detail.pos
  const showAbove = pos != null && pos.y >= AIR_POPUP_HEIGHT + AIR_POPUP_GAP
  const anchorStyle: CSSProperties = pos
    ? {
        left: `min(max(${AIR_POPUP_WIDTH / 2 + 8}px, ${pos.x}px), calc(100% - ${AIR_POPUP_WIDTH / 2 + 8}px))`,
        top: showAbove ? pos.y - AIR_POPUP_GAP : pos.y + AIR_POPUP_GAP,
        transform: `translate(-50%, ${showAbove ? '-100%' : '0'})`,
      }
    : { left: '50%', top: '50%', transform: 'translate(-50%, -50%)' }

  return (
    <div
      ref={popupRef}
      className="absolute z-[99999] p-3 rounded-8px border border-[#00d4ff]/45 bg-[rgba(4,22,52,0.94)] shadow-[0_8px_28px_rgba(0,10,35,0.55)] flex flex-col box-border"
      style={{ ...anchorStyle, width: AIR_POPUP_WIDTH, height: AIR_POPUP_HEIGHT }}
    >
      <div className="flex items-center justify-between mb-2 shrink-0">
        <span className="text-[#00f0ff] text-13px font-bold truncate">{detail.name} 监测详情</span>
        <div className="flex items-center gap-1.5">
          <div className="flex rounded-4px border border-[#2f7fd6]/60 bg-[#082b58] p-0.5">
            {(['concentration', 'aqi'] as const).map(item => (
              <button
                key={item}
                type="button"
                onClick={() => switchMode(item)}
                className={`px-2 py-0.5 rounded-3px text-10px cursor-pointer border-none ${mode === item ? 'bg-[#e8f5ff] text-[#145da0]' : 'bg-transparent text-[#7eb5de]'}`}
              >
                {item === 'concentration' ? '浓度' : 'AQI'}
              </button>
            ))}
          </div>
          <button type="button" className="text-[#7088a8] hover:text-white text-13px leading-none px-1 cursor-pointer" onClick={onClose}>✕</button>
        </div>
      </div>
      <div className="flex items-center gap-2 mb-2 pb-2 border-b border-[#00d4ff]/20 shrink-0 min-h-30px">
        {mode === 'aqi' ? (
          <>
            <span className="text-[#5ca2d9] text-11px">综合 AQI</span>
            <span className="text-[#00ffff] font-mono font-bold text-18px">{formatAirValue(responseData?.aqi ?? detail.aqi)}</span>
            {(responseData?.aqiLevel || detail.aqiLevel) && <span className="text-10px px-1.5 py-0.5 rounded bg-[#0a3a6b] text-[#7bd7ff] border border-[#00d4ff]/30">{String(responseData?.aqiLevel ?? detail.aqiLevel)}</span>}
          </>
        ) : (
          <>
            <span className="text-[#5ca2d9] text-11px">8 项污染物当前均值</span>
          </>
        )}
      </div>
      {/* 指标卡片：点击切换勾选，联动下方趋势图 */}
      <div className={`grid ${mode === 'concentration' ? 'grid-cols-4' : 'grid-cols-3'} gap-1.5 shrink-0`}>
        {activeFields.map(({ valueKey, trendKey, label, color }) => {
          const checked = checkedKeys.includes(trendKey)
          const value = responseData?.[valueKey] ?? (mode === 'aqi' ? detail.values[valueKey] : null)
          const unit = mode === 'concentration' ? (AIR_CONCENTRATION_FIELDS.find(field => field.trendKey === trendKey)?.unit ?? '') : ''
          return (
            <button
              key={trendKey}
              type="button"
              onClick={() => toggleField(trendKey)}
              className={`relative text-center rounded-6px border px-1 py-1.5 cursor-pointer transition-all bg-[rgba(8,40,84,0.55)] ${checked ? 'border-[#00d4ff]/80 shadow-[0_0_8px_rgba(0,212,255,0.3)]' : 'border-[#00d4ff]/15 opacity-70'}`}
            >
              {checked && <span className="absolute top-0.5 right-1 text-9px font-bold" style={{ color }}>✓</span>}
              <div className="font-mono font-bold text-14px" style={{ color: checked ? color : '#8ca3bd' }}>{loading ? '…' : formatAirValue(value)}</div>
              <div className="text-[#5ca2d9] text-10px mt-0.5">{label}</div>
              {unit && <div className="text-[#496f91] text-8px leading-none mt-0.5">{unit}</div>}
            </button>
          )
        })}
      </div>
      {/* 近 12 小时趋势图（趋势接口异步加载，加载中显示 loading） */}
      <div className="mt-2 pt-2 border-t border-[#00d4ff]/20 flex-1 min-h-0 flex flex-col">
        <div className="flex items-center justify-between text-10px mb-1 shrink-0">
          <span className="text-[#5ca2d9]">近12小时{mode === 'concentration' ? '浓度' : 'AQI'}趋势图</span>
        </div>
        <div className="relative flex-1 min-h-0">
          {loading && (
            <div className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-1.5 text-[#5ca2d9] text-11px">
              <Spin size="small" />
              <span>趋势数据加载中…</span>
            </div>
          )}
          <div ref={chartBoxRef} className={`w-full h-full ${loading ? 'invisible' : ''}`} />
        </div>
      </div>
    </div>
  )
}

/** 企业排口详情弹窗：展示排口名称、企业名称、许可证编号、管理类别、污染因子与经纬度 */
const OUTLET_POPUP_WIDTH = 320
const OUTLET_POPUP_GAP = 14

function OutletDetailPopup({ detail, onClose }: { detail: OutletPointDetail; onClose: () => void }) {
  const popupRef = useRef<HTMLDivElement>(null)

  // 点击弹窗外部区域时自动关闭弹窗
  useEffect(() => {
    const handlePointerDown = (event: MouseEvent | TouchEvent) => {
      if (popupRef.current && !popupRef.current.contains(event.target as Node)) {
        onClose()
      }
    }
    const timer = setTimeout(() => {
      document.addEventListener('mousedown', handlePointerDown)
      document.addEventListener('touchstart', handlePointerDown)
    }, 0)
    return () => {
      clearTimeout(timer)
      document.removeEventListener('mousedown', handlePointerDown)
      document.removeEventListener('touchstart', handlePointerDown)
    }
  }, [onClose])

  // 优先展示在点击位置上方，上方放不下时翻转到下方；无坐标时居中
  const pos = detail.pos
  const anchorStyle: CSSProperties = pos
    ? {
        left: `min(max(${OUTLET_POPUP_WIDTH / 2 + 8}px, ${pos.x}px), calc(100% - ${OUTLET_POPUP_WIDTH / 2 + 8}px))`,
        top: Math.max(pos.y - OUTLET_POPUP_GAP, 8),
        transform: pos.y > 220 ? `translate(-50%, -100%)` : 'translate(-50%, 0)',
      }
    : { left: '50%', top: '50%', transform: 'translate(-50%, -50%)' }

  const rows: { label: string; value: string }[] = [
    { label: '企业名称', value: detail.companyName || '--' },
    { label: '许可证编号', value: detail.licenseNo || '--' },
    { label: '管理类别', value: detail.manageCategory || '--' },
    { label: '污染因子', value: detail.pollutants || '--' },
    { label: '经纬度', value: `${detail.lng.toFixed(6)}，${detail.lat.toFixed(6)}` },
  ]

  return (
    <div
      ref={popupRef}
      className="absolute z-[99999] p-3 rounded-8px border border-[#9aa7b4]/45 bg-[rgba(10,18,32,0.94)] shadow-[0_8px_28px_rgba(0,10,35,0.55)] box-border"
      style={{ ...anchorStyle, width: OUTLET_POPUP_WIDTH }}
    >
      <div className="flex items-center justify-between mb-2 pb-2 border-b border-[#9aa7b4]/25">
        <span className="text-[#d0d8e0] text-13px font-bold truncate">{detail.outletName || '企业排口'}</span>
        <button
          type="button"
          className="text-[#7088a8] hover:text-white text-13px leading-none px-1 cursor-pointer"
          onClick={onClose}
        >
          ✕
        </button>
      </div>
      <div className="flex flex-col gap-1.5">
        {rows.map(row => (
          <div key={row.label} className="flex items-start gap-2 text-11px leading-1.6">
            <span className="text-[#7088a8] shrink-0 w-56px">{row.label}</span>
            <span className="text-[#d0d8e0] break-all">{row.value}</span>
          </div>
        ))}
      </div>
    </div>
  )
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
  useEffect(() => {
    let cancelled = false
    const load = () => {
      alertEventApi.dashboard()
        .then(res => { if (!cancelled) setAlertDashboard(res.data ?? null) })
        .catch(() => { if (!cancelled) setAlertDashboard(null) })
    }
    load()
    const timer = window.setInterval(load, 5 * 60 * 1000)
    return () => { cancelled = true; window.clearInterval(timer) }
  }, [])

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

  // 预警点位打点（alertEvent/list）：按区域 deptId 过滤，同经纬度聚合计数；1 分钟静默轮询（与 dashboard 同节奏）
  useEffect(() => {
    const cityDeptId = findCityDeptId(allDepts, selection?.cityName)
    const districtDeptId = selection?.countyName
      ? findDistrictDeptId(allDepts, selection.countyName, selection.cityName)
      : undefined
    let cancelled = false
    const load = () => {
      const params: AlertEventQuery = { pageNum: 1, pageSize: 999 }
      if (districtDeptId != null) params.districtId = Number(districtDeptId)
      else if (cityDeptId != null) params.cityId = Number(cityDeptId)
      alertEventApi.list(params)
        .then(res => {
          if (cancelled) return
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
        .catch(() => { if (!cancelled) setAlertPoints([]) })
    }
    load()
    const timer = window.setInterval(load, 5 * 60 * 1000)
    return () => { cancelled = true; window.clearInterval(timer) }
  }, [allDepts, selection])

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
              <div className="mt-1 pt-1 border-t border-[#2f7fd6]/30 flex items-center gap-1"><img src="/marker/aq-good.png" className="w-14px h-14px" alt="" /><span>移动站</span></div>
              <div className="flex items-center gap-1"><img src="/marker/aq-fixed-good.png" className="w-14px h-14px" alt="" /><span>固定站</span></div>
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

        {/* 底部全局搜索：结果仅展示名称，点击后定位地图并短暂高亮 */}
        <div className="global-map-search absolute bottom-94px left-1/2 -translate-x-1/2 z-30 w-460px">
          {searchOpen && (
            <div className="global-map-search__results">
              {searchResults.length ? searchResults.map((item, index) => {
                const lng = Number(item.longitude)
                const lat = Number(item.latitude)
                return (
                  <button
                    type="button"
                    key={`${item.type ?? 'item'}-${item.sourceId ?? index}-${lng}-${lat}`}
                    className="global-map-search__option"
                    onMouseDown={event => event.preventDefault()}
                    onClick={() => handleSearchLocate(item)}
                  >
                    <span className="global-map-search__name">{item.name?.trim() || '未命名地址'}</span>
                  </button>
                )
              }) : (
                <div className="global-map-search__empty">未找到匹配位置</div>
              )}
            </div>
          )}
          <div className="global-map-search__input-wrap">
            <SearchOutlined className="global-map-search__icon" />
            <input
              value={searchKeyword}
              className="global-map-search__input"
              placeholder="请输入要搜索的名称"
              aria-label="全局地图搜索"
              onChange={event => handleSearchChange(event.target.value)}
              onFocus={() => { if (searchKeyword.trim() && !searchLoading) setSearchOpen(true) }}
              onKeyDown={event => {
                if (event.key === 'Enter') handleSearchSubmit()
                if (event.key === 'Escape') setSearchOpen(false)
              }}
            />
            {searchLoading ? (
              <Spin size="small" />
            ) : searchKeyword ? (
              <button type="button" className="global-map-search__clear" aria-label="清空搜索" onClick={handleSearchClear}>
                <CloseOutlined />
              </button>
            ) : null}
          </div>
        </div>

        {/* 底部水平居中：打点显示控件条（预警↔空气互斥按钮组 + 无人机/雷达 Switch），位于底部导航条正上方不被遮挡 */}
        <div className="point-display-bar absolute bottom-52px left-1/2 -translate-x-1/2 z-20 flex items-center gap-2 rounded-8px bg-[rgba(4,22,52,0.85)] px-2 py-1.5 border border-[#00d4ff]/30 shadow-[0_4px_12px_rgba(0,0,0,0.3)]">
          {/* 预警点位 ↔ 空气质量监测站：互斥单选（页面 state 保证同刻只显一类） */}
          <button
            type="button"
            onClick={() => setPointMode('alert')}
            className={`text-11px px-3 py-1 rounded-4px border cursor-pointer transition-all bg-transparent ${pointMode === 'alert'
              ? 'border-[#00f0ff] text-white bg-[#1890ff]/35 shadow-[0_0_8px_rgba(0,240,255,0.35)]'
              : 'border-[#2f9bff]/60 text-[#7bd7ff] hover:text-white hover:border-[#00f0ff]'}`}
          >
            预警点位
          </button>
          <button
            type="button"
            onClick={() => setPointMode('air')}
            className={`text-11px px-3 py-1 rounded-4px border cursor-pointer transition-all bg-transparent ${pointMode === 'air'
              ? 'border-[#00f0ff] text-white bg-[#1890ff]/35 shadow-[0_0_8px_rgba(0,240,255,0.35)]'
              : 'border-[#2f9bff]/60 text-[#7bd7ff] hover:text-white hover:border-[#00f0ff]'}`}
          >
            空气质量监测站
          </button>
          <span className="w-1px h-16px bg-[#2f9bff]/40 mx-1" />
          {/* 无人机 / 雷达 / 排口：独立开关（图层 show/hide，不重建） */}
          <div className="flex items-center gap-1.5 text-[#d2ecff] text-11px">
            <span>无人机</span>
            <Switch size="small" checked={showDronePoints} onChange={setShowDronePoints} />
          </div>
          <div className="flex items-center gap-1.5 text-[#d2ecff] text-11px">
            <span>雷达</span>
            <Switch size="small" checked={showRadarPoints} onChange={setShowRadarPoints} />
          </div>
          <div className="flex items-center gap-1.5 text-[#d2ecff] text-11px">
            <span>排口</span>
            <Switch size="small" checked={showEmissionOutletPoints} onChange={setShowEmissionOutletPoints} />
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

        {/* 左下浮层：数据源概况（在线数据源取 dataSource/list 的 total，其余暂无数据源先显示 0） */}
        <div className="source-summary absolute bottom-56px left-3 z-20 text-11px text-[#b2d9ff]/90 space-y-1 font-mono p-2.5 rounded-6px bg-[rgba(4,22,52,0.45)] border border-[#00d4ff]/25">
          <div>在线数据源：<span className="text-[#00ffff] font-bold">{sourceTotal}</span></div>
          <div>数据总量：<span className="text-[#00ffff] font-bold">0</span></div>
          <div>数据准确性：<span className="text-[#00ffff] font-bold">0%</span></div>
        </div>

        {/* 右下浮层：监测分布总结 */}
        <div className="distribution-summary absolute bottom-56px right-3 z-20 p-3 rounded-8px border border-[#00d4ff]/35 bg-[rgba(4,22,52,0.9)] shadow-lg max-w-340px">
          <div className="text-[#00f0ff] text-13px font-bold mb-1">{selectedRegionName}环境监测分布</div>
          <div className="text-[#b2d9ff]/80 text-11px leading-relaxed">
            共 <span className="text-[#00f0ff] font-bold font-mono">{airPoints.length}</span> 个空气质量检测站<br />
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

/** 空气质量浓度版 popup
 *  - 只显示 8 项浓度卡片 + 近 12 小时浓度折线
 *  - 不显示综合 AQI、AQI tab、IAQI 卡片、浓度/AQI 切换
 *  - 右下角"加入对比" checkbox（受控，由父级维护选中集合）
 *  - 标题：固/移 + 站点名称（无 AQI/级别）
 *  - 浓度数据来源：dataSourceApi.aqiDetail(dataSourceId) → 解析 *Trend
 *  - 单位：CO 用 mg/m³，其他 μg/m³
 */
import { useEffect, useRef, useState, type CSSProperties } from 'react'
import { Checkbox, Spin } from 'antd'
import { Chart } from '@antv/g2'
import { dataSourceApi } from '@/servers/business'
import type { AirTrendItem } from '@/types/airData'
import { POLLUTANTS, type PollutantConfig } from '../constants'
import type { AirStationViewModel, PollutantKey } from '../types'
import { parseAqiDetailAverages } from '../data/compareRepository'

interface AirStationConcentrationPopupProps {
  station: AirStationViewModel
  /** 弹窗锚定像素坐标 */
  pos?: { x: number; y: number }
  onClose: () => void
  /** 是否已加入对比 */
  compared: boolean
  onCompareToggle: (deviceId: string, checked: boolean) => void
  /** 播放中当前帧的值（覆盖 station.values；不传则用 station.values） */
  liveValues?: Record<PollutantKey, number | null> | null
  /** 是否处于播放状态（顶部加 "当前帧" 标识） */
  isPlayback?: boolean
}

const POPUP_WIDTH = 360
const POPUP_HEIGHT = 320
const POPUP_GAP = 14

const TREND_FIELD_MAP: Record<string, keyof AirTrendItem> = {
  pm25Trend: 'pm25',
  pm10Trend: 'pm10',
  so2Trend: 'so2',
  no2Trend: 'no2',
  coTrend: 'co',
  o3Trend: 'o3',
  vocsTrend: 'vocs',
  tspTrend: 'tsp',
}

function formatNum(value: unknown): string {
  const num = Number(value)
  if (value == null || !Number.isFinite(num)) return '--'
  return String(Math.round(num * 10) / 10)
}

function parseTrend(payload: unknown): AirTrendItem[] {
  if (!payload || typeof payload !== 'object') return []
  const record = payload as Record<string, unknown>
  const merged = new Map<string, AirTrendItem>()
  Object.entries(TREND_FIELD_MAP).forEach(([trendKey, itemKey]) => {
    const arr = record[trendKey]
    if (!Array.isArray(arr)) return
    arr.forEach((item: unknown) => {
      if (!item || typeof item !== 'object') return
      const row = item as Record<string, unknown>
      const hour = (row.hour ?? row.time ?? row.dataTime) as string | undefined
      if (!hour) return
      const raw = row.value
      const num = Number(raw)
      const val = raw != null && Number.isFinite(num) ? num : null
      let existing = merged.get(hour)
      if (!existing) {
        existing = { hour, pm25: null, pm10: null, so2: null, no2: null, co: null, o3: null, vocs: null, tsp: null }
        merged.set(hour, existing)
      }
      ;(existing as unknown as Record<string, unknown>)[itemKey] = val
    })
  })
  return Array.from(merged.values())
}

export default function AirStationConcentrationPopup({
  station,
  pos,
  onClose,
  compared,
  onCompareToggle,
  liveValues,
  isPlayback,
}: AirStationConcentrationPopupProps) {
  const popupRef = useRef<HTMLDivElement>(null)
  const chartBoxRef = useRef<HTMLDivElement>(null)
  const [trend, setTrend] = useState<AirTrendItem[]>([])
  const [detailValues, setDetailValues] = useState<Partial<Record<PollutantKey, number | null>>>({})
  const [loading, setLoading] = useState(Boolean(station.dataSourceId))
  const [error, setError] = useState<string | null>(null)

  // 点击弹窗外部关闭
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

  // 拉 12h 浓度趋势
  useEffect(() => {
    if (!station.dataSourceId) return
    let cancelled = false
    const loadTrend = async () => {
      setLoading(true)
      setError(null)
      try {
        const res = await dataSourceApi.aqiDetail(station.dataSourceId)
        if (cancelled) return
        const data = res?.data
        setTrend(parseTrend(data))
        setDetailValues(parseAqiDetailAverages(data))
        setLoading(false)
      } catch (error) {
        if (cancelled) return
        setError(error instanceof Error ? error.message : '趋势数据加载失败')
        setLoading(false)
      }
    }
    void loadTrend()
    return () => { cancelled = true }
  }, [station.dataSourceId])

  // 折线图：8 条线
  useEffect(() => {
    const container = chartBoxRef.current
    if (!container || !trend.length) return undefined
    const longData = trend.flatMap((row) =>
      POLLUTANTS.map((p: PollutantConfig) => ({
        hour: row.hour,
        label: p.label,
        value: row[p.key] ?? null,
      })),
    )
    const chart = new Chart({ container, autoFit: true })
    chart.theme({ type: 'classicDark' })
    chart.line()
      .data(longData)
      .encode('x', 'hour')
      .encode('y', 'value')
      .encode('color', 'label')
      .style({ lineWidth: 1.5 })
    chart.scale({ color: { range: POLLUTANTS.map(p => p.color) } })
    chart.axis({
      x: { title: false, labelFontSize: 9, labelFill: '#5ca2d9', line: true, lineStroke: '#16436e' },
      y: { title: false, labelFontSize: 9, labelFill: '#5ca2d9', grid: true, gridStroke: '#123252' },
    })
    chart.legend({ color: { position: 'bottom', itemLabelFontSize: 9, itemLabelFill: '#7eb5de' } })
    chart.render()
    return () => { chart.destroy() }
  }, [trend])

  const prefix = station.stationType === 'fixed' ? '固' : station.stationType === 'mobile' ? '移' : '--'

  const anchorStyle: CSSProperties = pos
    ? {
        left: `min(max(${POPUP_WIDTH / 2 + 8}px, ${pos.x}px), calc(100% - ${POPUP_WIDTH / 2 + 8}px))`,
        top: pos.y >= POPUP_HEIGHT + POPUP_GAP ? pos.y - POPUP_GAP : pos.y + POPUP_GAP,
        transform: `translate(-50%, ${pos.y >= POPUP_HEIGHT + POPUP_GAP ? '-100%' : '0'})`,
      }
    : { left: '50%', top: '50%', transform: 'translate(-50%, -50%)' }

  return (
    <div
      ref={popupRef}
      className="map-point-popup absolute p-3 rounded-8px border border-[#00d4ff]/45 bg-[rgba(4,22,52,0.94)] shadow-[0_8px_28px_rgba(0,10,35,0.55)] flex flex-col box-border"
      style={{ ...anchorStyle, width: POPUP_WIDTH, height: POPUP_HEIGHT }}
    >
      {/* 标题行：固/移 + 名称 + ✕ */}
      <div className="flex items-center justify-between mb-2 shrink-0">
        <div className="flex items-center gap-2 min-w-0">
          <span className="air-station-badge" data-station-type={station.stationType}>{prefix}</span>
          <span className="text-[#00f0ff] text-13px font-bold truncate">{station.name}</span>
          {isPlayback && (
            <span className="text-9px px-1.5 py-0.5 rounded bg-[rgba(255,200,60,0.18)] border border-[rgba(255,200,60,0.45)] text-[#fad93e] shrink-0">
              当前帧
            </span>
          )}
        </div>
        <button
          type="button"
          className="text-[#7088a8] hover:text-white text-13px leading-none px-1 cursor-pointer"
          aria-label="关闭站点详情"
          onClick={onClose}
        >
          ✕
        </button>
      </div>

      {/* 8 项浓度卡片：2 行 × 4 列 */}
      <div className="grid grid-cols-4 gap-1.5 mb-2 shrink-0">
        {POLLUTANTS.map(p => {
          // 回放帧（包括帧内缺测）优先；非回放优先使用详情接口当前均值，再退到站点最新缓存。
          const v = liveValues
            ? liveValues[p.key]
            : detailValues[p.key] ?? station.values[p.key]
          return (
            <div key={p.key} className="text-center rounded-6px border border-[#00d4ff]/15 bg-[rgba(8,40,84,0.55)] px-1 py-1.5">
              <div className="font-mono font-bold text-13px" style={{ color: p.color }}>
                {loading && !liveValues ? '…' : formatNum(v)}
              </div>
              <div className="text-[#5ca2d9] text-10px mt-0.5">{p.label}</div>
              <div className="text-[#496f91] text-8px leading-none mt-0.5">{p.unit}</div>
            </div>
          )
        })}
      </div>

      {/* 12h 折线 */}
      <div className="pt-2 border-t border-[#00d4ff]/20 flex-1 min-h-0 flex flex-col">
        <div className="flex items-center justify-between text-10px mb-1 shrink-0">
          <span className="text-[#5ca2d9]">近12小时浓度趋势图</span>
          {error && <span className="text-[#ff7a45]">{error}</span>}
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

      {/* 右下角：加入对比 checkbox */}
      <div className="absolute bottom-2 right-2 z-10">
        <Checkbox
          checked={compared}
          onChange={e => onCompareToggle(station.deviceId, e.target.checked)}
          className="text-10px text-[#cce9ff]"
        >
          <span className="text-10px text-[#cce9ff]">加入对比</span>
        </Checkbox>
      </div>
    </div>
  )
}

import { useEffect, useRef, useState, type CSSProperties } from 'react'
import { Spin } from 'antd'
import { Chart } from '@antv/g2'
import { dataSourceApi } from '@/servers/business'
import {
  AIR_POPUP_WIDTH,
  AIR_POPUP_HEIGHT,
  AIR_POPUP_GAP,
  AIR_AQI_FIELDS,
  AIR_CONCENTRATION_FIELDS,
  formatAirValue,
  extractTrendRows,
  type AirPointDetail,
  type AirPopupMode,
  type AirFieldConfig,
} from './shared'
import type { AirTrendItem } from '@/types/airData'

type UnknownRecord = Record<string, unknown>

interface AirStationDetailPopupProps {
  detail: AirPointDetail
  onClose: () => void
}

export default function AirStationDetailPopup({ detail, onClose }: AirStationDetailPopupProps) {
  const popupRef = useRef<HTMLDivElement>(null)
  const [mode, setMode] = useState<AirPopupMode>('aqi')
  // 勾选项默认第一项（PM2.5），trendKey 即趋势数据字段
  const [checkedKeys, setCheckedKeys] = useState<(keyof AirTrendItem)[]>(['pm25'])
  const [concentrationTrend, setConcentrationTrend] = useState<AirTrendItem[]>([])
  const [aqiTrend, setAqiTrend] = useState<AirTrendItem[]>([])
  const [responseData, setResponseData] = useState<UnknownRecord | null>(null)
  const [loading, setLoading] = useState(detail.id != null)
  const chartBoxRef = useRef<HTMLDivElement>(null)

  const activeFields: AirFieldConfig[] = mode === 'aqi' ? AIR_AQI_FIELDS : AIR_CONCENTRATION_FIELDS
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

  // 弹窗立即展示（卡片数据随点击已返回），趋势接口异步加载并带 loading
  useEffect(() => {
    let cancelled = false
    if (detail.id == null) return
    dataSourceApi
      .aqiDetail(detail.id)
      .then((res) => {
        if (cancelled) return
        const payload = res.data && typeof res.data === 'object' ? (res.data as UnknownRecord) : null
        setResponseData(payload)
        setConcentrationTrend(extractTrendRows(payload, 'concentration'))
        setAqiTrend(extractTrendRows(payload, 'aqi'))
        setLoading(false)
      })
      .catch(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [detail])

  // 勾选切换：允许多选；仅剩一项勾选时不允许取消
  const toggleField = (trendKey: keyof AirTrendItem) => {
    setCheckedKeys((prev) => {
      if (prev.includes(trendKey)) return prev.length > 1 ? prev.filter((key) => key !== trendKey) : prev
      return [...prev, trendKey]
    })
  }

  const switchMode = (nextMode: AirPopupMode) => {
    const nextFields = nextMode === 'aqi' ? AIR_AQI_FIELDS : AIR_CONCENTRATION_FIELDS
    const availableKeys = new Set(nextFields.map((field) => field.trendKey))
    setMode(nextMode)
    setCheckedKeys((prev) => {
      const next = prev.filter((key) => availableKeys.has(key))
      return next.length ? next : [nextFields[0].trendKey]
    })
  }

  // 趋势图：按勾选项重绘（勾选卡片即图例，隐藏 G2 自带图例）
  useEffect(() => {
    const container = chartBoxRef.current
    if (!container || !trend.length) return undefined
    const checkedFields = activeFields.filter((field) => checkedKeys.includes(field.trendKey))
    const longData = trend.flatMap((row) =>
      checkedFields.map((field) => ({
        hour: row.hour,
        label: field.label,
        value: row[field.trendKey as keyof AirTrendItem] ?? null,
      })),
    )
    const chart = new Chart({ container, autoFit: true })
    chart.theme({ type: 'classicDark' })
    chart.line()
      .data(longData)
      .encode('x', 'hour')
      .encode('y', 'value')
      .encode('color', 'label')
      .style({ lineWidth: 2 })
    chart.scale({ color: { range: checkedFields.map((field) => field.color) } })
    chart.axis({
      x: { title: false, labelFontSize: 9, labelFill: '#5ca2d9', line: true, lineStroke: '#16436e' },
      y: { title: false, labelFontSize: 9, labelFill: '#5ca2d9', grid: true, gridStroke: '#123252' },
    })
    chart.legend(false)
    chart.render()
    return () => {
      chart.destroy()
    }
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
      className="map-point-popup absolute p-3 rounded-8px border border-[#00d4ff]/45 bg-[rgba(4,22,52,0.94)] shadow-[0_8px_28px_rgba(0,10,35,0.55)] flex flex-col box-border"
      style={{ ...anchorStyle, width: AIR_POPUP_WIDTH, height: AIR_POPUP_HEIGHT }}
    >
      <div className="flex items-center justify-between mb-2 shrink-0">
        <span className="text-[#00f0ff] text-13px font-bold truncate">{detail.name} 监测详情</span>
        <div className="flex items-center gap-1.5">
          <div className="flex rounded-4px border border-[#2f7fd6]/60 bg-[#082b58] p-0.5">
            {(['concentration', 'aqi'] as const).map((item) => (
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
          <button
            type="button"
            className="text-[#7088a8] hover:text-white text-13px leading-none px-1 cursor-pointer"
            onClick={onClose}
          >
            ✕
          </button>
        </div>
      </div>
      <div className="flex items-center gap-2 mb-2 pb-2 border-b border-[#00d4ff]/20 shrink-0 min-h-30px">
        {mode === 'aqi' ? (
          <>
            <span className="text-[#5ca2d9] text-11px">综合 AQI</span>
            <span className="text-[#00ffff] font-mono font-bold text-18px">
              {formatAirValue(responseData?.aqi ?? detail.aqi)}
            </span>
            {(responseData?.aqiLevel || detail.aqiLevel) && (
              <span className="text-10px px-1.5 py-0.5 rounded bg-[#0a3a6b] text-[#7bd7ff] border border-[#00d4ff]/30">
                {String(responseData?.aqiLevel ?? detail.aqiLevel)}
              </span>
            )}
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
          const unit =
            mode === 'concentration'
              ? AIR_CONCENTRATION_FIELDS.find((field) => field.trendKey === trendKey)?.unit ?? ''
              : ''
          return (
            <button
              key={trendKey}
              type="button"
              onClick={() => toggleField(trendKey)}
              className={`relative text-center rounded-6px border px-1 py-1.5 cursor-pointer transition-all bg-[rgba(8,40,84,0.55)] ${checked ? 'border-[#00d4ff]/80 shadow-[0_0_8px_rgba(0,212,255,0.3)]' : 'border-[#00d4ff]/15 opacity-70'}`}
            >
              {checked && (
                <span className="absolute top-0.5 right-1 text-9px font-bold" style={{ color }}>
                  ✓
                </span>
              )}
              <div className="font-mono font-bold text-14px" style={{ color: checked ? color : '#8ca3bd' }}>
                {loading ? '…' : formatAirValue(value)}
              </div>
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

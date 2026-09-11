/** 对比折线区
 *  - 单站：8 条污染物折线（多污染物）
 *  - 多站：N 条站折线，污染物 = 父级 tab 选中
 *  - 时间范围：
 *    - 空：dataSourceApi.aqiDetail 取近 12h
 *    - 有：复用父级 airData/series 全站历史帧，不重复逐站请求
 *  - 多站并发 4，过期 requestId 丢弃
 *  - 关闭按钮：清空全部已选站点（父级处理）
 *  - 缺测点保留 null，G2 断点
 *  - tooltip 明示单位（CO mg/m³，其他 μg/m³）
 */
import { useEffect, useMemo, useRef, useState } from 'react'
import { Chart } from '@antv/g2'
import { Spin } from 'antd'
import MapPanelHeader from '@/components/MapPanelHeader'
import dayjs, { type Dayjs } from 'dayjs'
import { POLLUTANTS, POLLUTANT_BY_KEY } from '../constants'
import type { AirPlaybackFrame, AirStationViewModel, PollutantKey } from '../types'
import { fetchStation12h, runWithConcurrency, type ComparePoint, type CompareSeries } from '../data/compareRepository'
import { AGGREGATIONS, type AirAggregation } from '../utils/aggregation'

interface AirComparePanelProps {
  aggregation: AirAggregation
  stations: AirStationViewModel[] // 已选对比站点（按选择顺序）
  /** 当前 tab 污染物（用于多站单污染分支） */
  activePollutant: PollutantKey
  /** 父级时间范围；null = 近 12h */
  timeRange: [Dayjs, Dayjs] | null
  historyFrames: AirPlaybackFrame[]
  historyLoading: boolean
  historyError: string | null
  onClose: () => void
  /** 单站从 stations 里移除（与 popup 同步） */
  onRemoveStation?: (deviceId: string) => void
}

const COMPARE_COLORS = ['#00ddfa', '#f8973c', '#7ed957', '#fad93e', '#c17cff', '#ff6b81', '#35c4a8', '#5c8dff', '#5cd9ff', '#a0e000', '#ff9b80', '#9c80ff']

export default function AirComparePanel({
  aggregation,
  stations,
  activePollutant,
  timeRange,
  historyFrames,
  historyLoading,
  historyError,
  onClose,
  onRemoveStation,
}: AirComparePanelProps) {
  const chartBoxRef = useRef<HTMLDivElement>(null)
  const [detailSeries, setSeries] = useState<CompareSeries[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const requestIdRef = useRef(0)

  const isSingle = stations.length === 1
  const series = useMemo(() => timeRange
    ? historyLoading || historyError ? [] : stations.map(station => ({
      deviceId: station.deviceId, stationName: station.name, stationType: station.stationType,
      points: historyFrames.map(frame => ({ time: frame.startTime, values: frame.valuesByDeviceId[station.deviceId] ?? {} })),
    }))
    : detailSeries, [timeRange, historyLoading, historyError, stations, historyFrames, detailSeries])

  useEffect(() => {
    const myReqId = ++requestIdRef.current
    if (timeRange) return
    let cancelled = false
    const loadSeries = async () => {
      setLoading(true)
      setError(null)
      const tasks = stations.map(station => ({ station }))
      const fetchOne = async ({ station }: { station: AirStationViewModel }) => {
        const points: ComparePoint[] = await fetchStation12h(station.dataSourceId)
        return {
          deviceId: station.deviceId,
          stationName: station.name,
          stationType: station.stationType,
          points,
        } as CompareSeries
      }
      try {
        const results = await runWithConcurrency(tasks, 4, fetchOne)
        if (cancelled || myReqId !== requestIdRef.current) return
        setSeries(results)
        setLoading(false)
      } catch (error) {
        if (cancelled || myReqId !== requestIdRef.current) return
        setError(error instanceof Error ? error.message : '对比数据加载失败')
        setSeries([])
        setLoading(false)
      }
    }
    void loadSeries()

    return () => { cancelled = true }
  }, [stations, timeRange])

  // 折线图渲染
  useEffect(() => {
    const container = chartBoxRef.current
    if (!container || series.length === 0) return undefined

    const chartData = isSingle ? (() => {
      // 单站：8 条污染物折线
      const s = series[0]
      return {
        longData: s.points.flatMap(pt =>
        POLLUTANTS.map(p => {
          const v = pt.values[p.key]
          return { time: pt.time, label: p.label, value: v ?? null, unit: p.unit }
        }),
        ),
        colorRange: POLLUTANTS.map(p => p.color),
        yTitle: '浓度',
      }
    })() : (() => {
      // 多站：每站一条线，取 activePollutant
      const p = POLLUTANT_BY_KEY[activePollutant]
      return {
        longData: series.flatMap(s =>
          s.points.map(pt => ({
            time: pt.time,
            label: s.stationName,
            value: pt.values[activePollutant] ?? null,
            unit: p.unit,
          })),
        ),
        colorRange: series.map((_, i) => COMPARE_COLORS[i % COMPARE_COLORS.length]),
        yTitle: `${p.label} (${p.unit})`,
      }
    })()
    const { longData, colorRange, yTitle } = chartData
    const times = [...new Set(longData.map(point => point.time))]
    const tickStride = Math.max(1, Math.ceil(times.length / 8))
    const multipleDays = times.length > 1 && times[0].slice(0, 10) !== times[times.length - 1].slice(0, 10)

    const chart = new Chart({ container, autoFit: true })
    chart.theme({ type: 'classicDark' })
    chart.line()
      .data(longData)
      .encode('x', 'time')
      .encode('y', 'value')
      .encode('color', 'label')
      .style({ lineWidth: 1.8 })
    chart.scale({ x: { domain: times }, color: { range: colorRange } })
    chart.axis({
      x: {
        title: false, labelFontSize: 9, labelFill: '#7eb5de', line: true, lineStroke: '#16436e',
        tickFilter: (_datum: unknown, index: number) => index % tickStride === 0,
        labelFormatter: (value: string) => value.length > 10 && dayjs(value).isValid()
          ? dayjs(value).format(multipleDays ? 'MM-DD HH:mm' : 'HH:mm') : value,
      },
      y: { title: yTitle, titleFontSize: 9, titleFill: '#7eb5de', labelFontSize: 9, labelFill: '#5ca2d9', grid: true, gridStroke: '#123252' },
    })
    chart.legend({ color: { position: 'bottom', itemLabelFontSize: 9, itemLabelFill: '#7eb5de' } })
    chart.render()
    return () => { chart.destroy() }
  }, [series, isSingle, activePollutant])

  return (
    <>
      <MapPanelHeader title={<div className="air-compare-heading"><span>空气质量趋势分析</span>
        <span className={`air-mode-tag${isSingle ? ' is-active' : ''}`} aria-current={isSingle}>单站点多污染物</span>
        <span className={`air-mode-tag${!isSingle ? ' is-active' : ''}`} aria-current={!isSingle}>多站点单污染物</span>
        <span className="air-compare-step">步长 {AGGREGATIONS[timeRange ? aggregation : 'hourly'].stepLabel}</span>
        {!isSingle && <span className="air-compare-factor">{POLLUTANT_BY_KEY[activePollutant].label}</span>}
      </div>} subtitle={timeRange ? historyError : error} extra={<>
        {(timeRange ? historyLoading : loading) && <Spin size="small" />}
        <button type="button" className="map-overlay-close" onClick={onClose} aria-label="关闭并清空所有对比" title="关闭并清空所有对比">✕</button>
      </>} />
      <div className="air-quality-compare-station-chips">
          {stations.map((s, idx) => {
            const prefix = s.stationType === 'fixed' ? '固' : s.stationType === 'mobile' ? '移' : '--'
            return (
              <span
                key={s.deviceId}
                className="air-quality-compare-station-chip"
                style={!isSingle ? { borderColor: COMPARE_COLORS[idx % COMPARE_COLORS.length] } : undefined}
              >
                {prefix} {s.name}
                {onRemoveStation && (
                  <button
                    type="button"
                    className="text-[#7088a8] hover:text-white text-12px leading-none ml-1 cursor-pointer"
                    onClick={() => onRemoveStation(s.deviceId)}
                    title="从对比移除"
                  >
                    ✕
                  </button>
                )}
              </span>
            )
          })}
      </div>
      <div className="relative flex-1 min-h-0">
        {!(timeRange ? historyLoading : loading) && series.every(item => item.points.length === 0) && (
          <div className="absolute inset-0 flex items-center justify-center text-[#5ca2d9] text-12px">
            {(timeRange ? historyError : error) || '暂无对比数据'}
          </div>
        )}
        <div ref={chartBoxRef} className="w-full h-full" />
      </div>
    </>
  )
}

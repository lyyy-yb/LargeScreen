import { useEffect, useState } from 'react'
import { Button, DatePicker, Select, Slider, message } from 'antd'
import { CaretRightOutlined, PauseOutlined } from '@ant-design/icons'
import dayjs, { type Dayjs } from 'dayjs'
import { disabledFutureDate } from '@/utils/helpers'
import { AGGREGATIONS, latestBucket, normalizeRange, rangeError, recentRange, type AirAggregation, type AirTimeRange } from '../utils/aggregation'

interface AirTimePlayerProps {
  currentFrameIdx: number
  frameCount: number
  currentFrameTime?: string
  loading?: boolean
  isMock?: boolean
  timeRange: AirTimeRange | null
  aggregation: AirAggregation
  onAggregationChange: (type: AirAggregation) => void
  onTimeRangeChange: (range: AirTimeRange | null) => void
  onFrameChange: (index: number) => void
}

export default function AirTimePlayer({ currentFrameIdx, frameCount, currentFrameTime, loading, isMock, timeRange, aggregation, onAggregationChange, onTimeRangeChange, onFrameChange }: AirTimePlayerProps) {
  const [isPlaying, setIsPlaying] = useState(false)
  const config = AGGREGATIONS[aggregation]
  const playing = isPlaying && !loading && frameCount > 1 && currentFrameIdx < frameCount - 1
  useEffect(() => {
    if (!playing) return
    const timer = window.setTimeout(() => {
      const next = currentFrameIdx + 1
      onFrameChange(next)
      if (next >= frameCount - 1) setIsPlaying(false)
    }, 1000)
    return () => window.clearTimeout(timer)
  }, [playing, currentFrameIdx, frameCount, onFrameChange])
  const changeRange = (values: [Dayjs | null, Dayjs | null] | null) => {
    setIsPlaying(false)
    if (!values?.[0] || !values[1]) { onTimeRangeChange(null); return }
    const next = normalizeRange(values as AirTimeRange, aggregation)
    const error = rangeError(next, aggregation)
    if (error) { message.warning(error); return }
    onTimeRangeChange(next)
  }
  const presets = aggregation === 'minute' ? [{ label: '最近1小时', value: () => recentRange(aggregation, 60) }]
    : aggregation === 'hourly' ? [24, 48].map(count => ({ label: `最近${count}小时`, value: () => recentRange(aggregation, count) }))
      : [{ label: '最近30天', value: () => recentRange(aggregation, 30) }]
  const getBounds = (from?: Dayjs) => {
    const latest = latestBucket(aggregation)
    const upper = from?.startOf(config.unit).add(config.limit - 1, config.unit)
    return { lower: from?.startOf(config.unit).subtract(config.limit - 1, config.unit), upper: upper && upper.isBefore(latest) ? upper : latest }
  }
  return (
    <div className={`air-quality-time-player${timeRange ? ' has-playback' : ''}`}>
      <div className="air-quality-time-strip map-overlay-toolbar">
        <Select aria-label="统计类型" value={aggregation} onChange={value => { setIsPlaying(false); onAggregationChange(value) }}
          size="small" className="screen-select air-aggregation-select" classNames={{ popup: { root: 'screen-select-popup' } }}
          options={Object.entries(AGGREGATIONS).map(([value, item]) => ({ value, label: item.label }))} />
        <DatePicker.RangePicker key={aggregation}
          showTime={aggregation === 'daily' ? false : { format: aggregation === 'hourly' ? 'HH' : 'HH:mm', defaultOpenValue: [dayjs().startOf(config.unit), dayjs().startOf(config.unit)] }}
          format={config.format} value={timeRange} onChange={changeRange} presets={presets}
          allowEmpty={[false, false]} placeholder={['开始时间', '结束时间']} size="small"
          className="air-quality-range-picker screen-range-picker" classNames={{ popup: { root: 'air-time-picker-popup' } }}
          disabledDate={(date, info) => {
            const { lower, upper } = getBounds(info.from)
            return disabledFutureDate(date) || date.isAfter(upper, 'day') || !!(lower && date.isBefore(lower, 'day'))
          }}
          disabledTime={(date, _partial, info) => {
            if (!date || aggregation === 'daily') return {}
            const { lower, upper } = getBounds(info.from)
            const outside = (value: Dayjs) => !!(lower && value.isBefore(lower)) || value.isAfter(upper)
            return {
              disabledHours: () => Array.from({ length: 24 }, (_, hour) => hour).filter(hour => {
                const start = date.hour(hour).startOf('hour')
                return (lower && start.endOf('hour').isBefore(lower)) || start.isAfter(upper)
              }),
              disabledMinutes: (hour: number) => aggregation === 'hourly' ? [] : Array.from({ length: 60 }, (_, minute) => minute).filter(minute => outside(date.hour(hour).minute(minute).startOf('minute'))),
            }
          }}
          renderExtraFooter={() => `含起止时段 · 最多 ${config.limit} 个${config.label} · 仅已完成时段`}
        />
      </div>
      {timeRange && (
        <div className="air-quality-playback-strip map-overlay-toolbar">
          {isMock && <span className="air-quality-mock-badge">模拟回放</span>}
          <Button type="primary" size="small" className="air-quality-play-btn" aria-label={playing ? '暂停播放' : '开始播放'}
            icon={playing ? <PauseOutlined /> : <CaretRightOutlined />} disabled={frameCount <= 1 || loading}
            onClick={() => { if (playing) setIsPlaying(false); else { if (currentFrameIdx >= frameCount - 1) onFrameChange(0); setIsPlaying(true) } }} />
          <div className="air-quality-player-step">步长 {config.stepLabel}</div>
          <div className="air-quality-player-slider"><Slider min={0} max={Math.max(1, frameCount - 1)} value={currentFrameIdx}
            onChange={index => { setIsPlaying(false); onFrameChange(index) }} disabled={frameCount <= 1 || loading}
            tooltip={{ formatter: () => currentFrameTime ? dayjs(currentFrameTime).format(config.format) : '--' }} /></div>
          <div className="air-quality-player-frame-info">{frameCount ? currentFrameIdx + 1 : 0} / {frameCount}
            {currentFrameTime && <span className="ml-2">{dayjs(currentFrameTime).format(config.format)}</span>}</div>
        </div>
      )}
    </div>
  )
}

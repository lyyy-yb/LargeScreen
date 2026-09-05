/** 左栏：今日空气质量站预警
 *  - 顶部 4 等级（一/二/三/四级）数量卡
 *  - 下面最近 20 条预警列表
 *  - 3 分钟轮询
 *  - 0 条显示空态，单项失败显示局部错误
 *  - 固定筛选：dataType=air_quality_station、今日整天、第一页、每页 10000 条
 *  - 单次取回后在前端统计四级数量并截取最近 20 条，避免同周期重复请求 5 次
 */
import { useEffect, useState } from 'react'
import { Spin } from 'antd'
import MapPanelHeader from '@/components/MapPanelHeader'
import AlertLevelBadge from '@/components/AlertLevelBadge'
import dayjs from 'dayjs'
import { alertEventApi } from '@/servers/business'
import type { AlertEventDTO } from '@/types/business'
import { ALERT_LEVEL_VISUAL, type AlertLevelVisual } from '../constants'

interface LevelCounts {
  level1: number
  level2: number
  level3: number
  level4: number
}

const EMPTY_COUNTS: LevelCounts = { level1: 0, level2: 0, level3: 0, level4: 0 }

function pickTime(item: AlertEventDTO): string {
  return item.lastTriggerTime ?? item.createTime ?? ''
}

function pickValue(item: AlertEventDTO): string {
  const v = item.lastTriggerValue
  if (v != null && v !== '') return String(v)
  return ''
}

function formatTime(text: string): string {
  if (!text) return '--'
  const d = dayjs(text)
  if (!d.isValid()) return text
  return d.format('HH:mm')
}

export default function AirQualityAlertPanel({ onLocate }: { onLocate: (item: AlertEventDTO) => void }) {
  const [counts, setCounts] = useState<LevelCounts>(EMPTY_COUNTS)
  const [list, setList] = useState<AlertEventDTO[]>([])
  const [total, setTotal] = useState(0)
  const [listError, setListError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    const fetchAll = async () => {
      setLoading(true)
      try {
        const res = await alertEventApi.list({
          pageNum: 1,
          pageSize: 10_000,
          dataType: 'air_quality_station',
          includeHistory: false,
          startTime: dayjs().startOf('day').format('YYYY-MM-DD HH:mm:ss'),
          endTime: dayjs().endOf('day').format('YYYY-MM-DD HH:mm:ss'),
        })
        if (cancelled) return
        const rows = Array.isArray(res.data?.records) ? res.data.records : []
        const sorted = rows.slice().sort((a, b) => pickTime(b).localeCompare(pickTime(a)))
        const nextCounts: LevelCounts = { ...EMPTY_COUNTS }
        rows.forEach(item => {
          if (item.alertLevel in nextCounts) {
            nextCounts[item.alertLevel as keyof LevelCounts]++
          }
        })
        setCounts(nextCounts)
        setList(sorted.slice(0, 20))
        setTotal(Number(res.data?.total) || rows.length)
        setListError(null)
      } catch (error) {
        if (cancelled) return
        setList([])
        setCounts({ ...EMPTY_COUNTS })
        setTotal(0)
        setListError(error instanceof Error ? error.message : '预警列表请求失败')
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    fetchAll()
    const timer = setInterval(fetchAll, 3 * 60 * 1000)
    return () => { cancelled = true; clearInterval(timer) }
  }, [])

  return (
    <>
      <MapPanelHeader title="预警条目" accent="#ff6868" extra={<>{loading && <Spin size="small" />}<span>今日共 {total} 条</span></>} />

      {/* 4 等级数量 */}
      <div className="air-quality-alert-levels">
        {ALERT_LEVEL_VISUAL.map((lv: AlertLevelVisual) => (
          <div
            key={lv.level}
            className="air-quality-alert-level-card"
            style={{ background: lv.bgColor, borderColor: lv.borderColor }}
          >
            <div className="air-quality-alert-level-card-label">{lv.text}</div>
            <div className="air-quality-alert-level-card-value">{counts[lv.level]}</div>
          </div>
        ))}
      </div>

      {/* 列表 */}
      <div className="air-quality-alert-list">
        {listError && <div className="air-quality-empty text-[#ff7a45]">{listError}</div>}
        {!listError && list.length === 0 && (
          <div className="air-quality-empty">今日暂无空气质量站预警</div>
        )}
        {list.map((item, idx) => {
          const borderColor = ALERT_LEVEL_VISUAL.find(lv => lv.level === item.alertLevel)?.borderColor ?? 'rgba(0,212,255,0.3)'
          const canLocate = item.lng != null && item.lat != null && Number.isFinite(Number(item.lng)) && Number.isFinite(Number(item.lat)) && Math.abs(Number(item.lng)) <= 180 && Math.abs(Number(item.lat)) <= 90
          return (
            <button type="button"
              key={`${item.id}-${idx}`}
              className="air-quality-alert-item"
              style={{ borderLeftColor: borderColor }}
              disabled={!canLocate}
              title={canLocate ? '定位此预警站点（缩放 16 级）' : '暂无有效坐标，无法定位'}
              onClick={() => onLocate(item)}
            >
              <div className="air-quality-alert-item-header">
                <AlertLevelBadge level={item.alertLevel} />
                <span className="air-quality-alert-item-time">{formatTime(pickTime(item))}</span>
              </div>
              <div className="air-quality-alert-item-station" title={item.deviceName}>{item.deviceName}</div>
              <div className="air-quality-alert-item-rule">{item.ruleName}</div>
              <div className="air-alert-trigger">{item.triggerReason || (pickValue(item) ? `当前值 ${pickValue(item)}` : '暂无触发原因')}</div>
              <div className="air-quality-alert-item-location">{item.location || '—'}</div>
            </button>
          )
        })}
      </div>
    </>
  )
}

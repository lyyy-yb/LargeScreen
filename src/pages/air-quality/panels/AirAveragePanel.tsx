import MapPanelHeader from '@/components/MapPanelHeader'
import type { MicroStationAvgVO } from '@/types/airData'
import { POLLUTANT_KEYS } from '../types'
import { POLLUTANT_BY_KEY } from '../constants'

export default function AirAveragePanel({ average, loading, error }: { average: MicroStationAvgVO | null; loading: boolean; error: string | null }) {
  return <section className="screen-glass-panel air-quality-range-panel flex flex-col">
    <MapPanelHeader title="污染物浓度" extra={<span className="air-quality-data-badge">区域均值</span>} />
    <div className="air-average-caption" title={average ? `${average.startTime} — ${average.endTime}` : undefined}>{error || `上一完整小时 · 可见微站 ${average?.stationCount ?? '--'} 个`}</div>
    <div className="air-quality-range-grid">
      {POLLUTANT_KEYS.map(key => {
        const value = average?.[key] == null || !Number.isFinite(Number(average[key])) ? null : Number(average[key])
        const pollutant = POLLUTANT_BY_KEY[key]
        const level = { color: '#8edaff', label: value == null ? '暂无数据' : '等级待配置' }
        return <div key={key} className="air-quality-range-card" title="均值来自后台 microStationAvg；接口未提供浓度等级阈值，不推断 AQI 等级">
          <div className="air-quality-range-card-label">{pollutant.label}</div>
          <div className="air-quality-range-card-value" style={{ color: level.color }}>{loading ? '…' : value == null ? '--' : Number(value.toFixed(1))}</div>
          <div className="air-quality-range-card-unit">{pollutant.unit}</div>
          <span className="air-average-level" style={{ color: level.color, background: `${level.color}22` }}>{level.label}</span>
        </div>
      })}
    </div>
  </section>
}

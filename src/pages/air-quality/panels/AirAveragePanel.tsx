import { useMemo } from 'react'
import MapPanelHeader from '@/components/MapPanelHeader'
import type { AirDataLatestVO } from '@/types/airData'
import { POLLUTANT_BY_KEY } from '../constants'
import { concentrationMeans, demoConcentrationLevel } from '../utils/concentration'

export default function AirAveragePanel({ records, loading, error }: { records: AirDataLatestVO[]; loading: boolean; error: string | null }) {
  const means = useMemo(() => concentrationMeans(records), [records])
  return <section className="screen-glass-panel air-quality-range-panel flex flex-col">
    <MapPanelHeader title="污染物浓度" extra={<span className="air-quality-mock-badge">模拟评级</span>} />
    {error && <div className="air-average-caption">更新失败</div>}
    <div className="air-quality-range-grid">
      {means.map(({ key, count, value }) => {
        const pollutant = POLLUTANT_BY_KEY[key]
        const level = demoConcentrationLevel(key, value)
        return <div key={key} className="air-quality-range-card" title={`${count} 个有效站点参与均值；等级为演示阈值，不代表实际 AQI`}>
          <div className="air-quality-range-card-label">{pollutant.label}</div>
          <div className="air-quality-range-card-value" style={{ color: level.color }}>{loading ? '…' : value == null ? '--' : Number(value.toFixed(1))}</div>
          <div className="air-quality-range-card-unit">{pollutant.unit}</div>
          <span className="air-average-level" style={{ color: level.color, background: `${level.color}22` }}>{level.label}</span>
        </div>
      })}
    </div>
  </section>
}

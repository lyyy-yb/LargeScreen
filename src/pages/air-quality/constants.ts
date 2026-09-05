/** 8 项污染物常量、颜色、单位。
 *  颜色：与 monitor 的 AIR_CONCENTRATION_FIELDS 保持一致，避免视觉跳变。
 *  单位：CO 用 mg/m³，其他 μg/m³（国标 GB 3095-2012 / 行业默认）。
 */
import type { PollutantKey } from './types'

export interface PollutantConfig {
  key: PollutantKey
  label: string
  color: string
  unit: string
}

export const POLLUTANTS: PollutantConfig[] = [
  { key: 'pm25', label: 'PM2.5', color: '#00ddfa', unit: 'μg/m³' },
  { key: 'pm10', label: 'PM10', color: '#f8973c', unit: 'μg/m³' },
  { key: 'so2', label: 'SO₂', color: '#7ed957', unit: 'μg/m³' },
  { key: 'no2', label: 'NO₂', color: '#fad93e', unit: 'μg/m³' },
  { key: 'co', label: 'CO', color: '#c17cff', unit: 'mg/m³' },
  { key: 'o3', label: 'O₃', color: '#ff6b81', unit: 'μg/m³' },
  { key: 'vocs', label: 'VOCs', color: '#35c4a8', unit: 'μg/m³' },
  { key: 'tsp', label: 'TSP', color: '#5c8dff', unit: 'μg/m³' },
]

export const POLLUTANT_BY_KEY: Record<PollutantKey, PollutantConfig> = Object.fromEntries(
  POLLUTANTS.map(p => [p.key, p]),
) as Record<PollutantKey, PollutantConfig>

/** 默认选中：PM2.5 */
export const DEFAULT_POLLUTANT: PollutantKey = 'pm25'

/** 预警等级：level1/2/3/4 → 一/二/三/四级，颜色与监控大屏预警处置卡片保持一致 */
export interface AlertLevelVisual {
  level: 'level1' | 'level2' | 'level3' | 'level4'
  text: string
  color: string
  bgColor: string
  borderColor: string
}

export const ALERT_LEVEL_VISUAL: AlertLevelVisual[] = [
  { level: 'level1', text: '一级', color: '#ffffff', bgColor: 'rgba(255, 60, 60, 0.85)', borderColor: 'rgba(255, 100, 100, 0.6)' },
  { level: 'level2', text: '二级', color: '#ffffff', bgColor: 'rgba(255, 140, 40, 0.85)', borderColor: 'rgba(255, 170, 80, 0.6)' },
  { level: 'level3', text: '三级', color: '#ffffff', bgColor: 'rgba(255, 200, 60, 0.85)', borderColor: 'rgba(255, 220, 100, 0.6)' },
  { level: 'level4', text: '四级', color: '#ffffff', bgColor: 'rgba(60, 130, 240, 0.85)', borderColor: 'rgba(100, 160, 255, 0.6)' },
]

/** 热力图 5 级色阶（值域五等分，默认配色；后续可替换为业务阈值） */
export const HEATMAP_LEVEL_COLORS: string[] = [
  'rgba(0, 255, 136, 0.55)',   // 1 级：绿
  'rgba(255, 224, 102, 0.6)',  // 2 级：黄
  'rgba(255, 166, 77, 0.7)',   // 3 级：橙
  'rgba(255, 77, 77, 0.78)',   // 4 级：红
  'rgba(179, 0, 0, 0.88)',     // 5 级：深红
]

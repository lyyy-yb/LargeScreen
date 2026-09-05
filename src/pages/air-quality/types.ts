/** 空气质量大屏页面专用类型
 *  - 不复用 monitor 的 AirQualityPoint，单独建 ViewModel，避免与 monitor 现有弹窗、地图图层耦合
 *  - 站点元数据来自 dataSource，8 项浓度来自 airData/latest，必须合并
 */

/** 8 项污染物 key。顺序固定：PM2.5/PM10/SO2/NO2/CO/O3/VOCs/TSP */
export type PollutantKey = 'pm25' | 'pm10' | 'so2' | 'no2' | 'co' | 'o3' | 'vocs' | 'tsp'

export const POLLUTANT_KEYS: PollutantKey[] = ['pm25', 'pm10', 'so2', 'no2', 'co', 'o3', 'vocs', 'tsp']

/** 站点类型：fixed/mobile/unknown（unknown 用于 stationType 缺失或异常值） */
export type AirStationType = 'fixed' | 'mobile' | 'unknown'

/** 站点统一 ViewModel。
 *  - dataSourceId: 用于 aqiDetail 12h 趋势
 *  - deviceId: 用于 dataManage airStationDetail 历史
 *  - values: 8 项当前浓度，null 表示无数据
 *  - dataTime: 当前值所属时刻（airData/latest 接口语义为"上一完整小时"，标注以便 UI 提示） */
export interface AirStationViewModel {
  dataSourceId: number
  deviceId: string
  name: string
  stationType: AirStationType
  lng: number
  lat: number
  aqi: number | null
  aqiLevel: string
  values: Record<PollutantKey, number | null>
  dataTime: string | null
}

/** 等级文本 → 颜色（AQI 6 级，沿用 monitor 视觉） */
export interface AqiLevelVisual {
  key: 'good' | 'moderate' | 'light' | 'medium' | 'heavy' | 'severe'
  text: string
  color: string
}

export const AQI_LEVEL_VISUAL: Record<string, AqiLevelVisual> = {
  优: { key: 'good', text: '优', color: '#00ff88' },
  良: { key: 'moderate', text: '良', color: '#ffe066' },
  轻度污染: { key: 'light', text: '轻度污染', color: '#ffa64d' },
  中度污染: { key: 'medium', text: '中度污染', color: '#ff7a45' },
  重度污染: { key: 'heavy', text: '重度污染', color: '#ff4d4d' },
  严重污染: { key: 'severe', text: '严重污染', color: '#b30000' },
}

/** 步长枚举（业务时间跨度；不是播放速度） */
export type PlaybackStep = '1s' | '5s' | '10s' | '30s' | '1min' | '5min' | '10min' | '30min' | '1h' | '3h' | '6h' | '12h' | '1d' | '7d' | '1month'

/** 步长对应毫秒数 */
export const PLAYBACK_STEP_MS: Record<PlaybackStep, number> = {
  '1s': 1_000,
  '5s': 5_000,
  '10s': 10_000,
  '30s': 30_000,
  '1min': 60_000,
  '5min': 5 * 60_000,
  '10min': 10 * 60_000,
  '30min': 30 * 60_000,
  '1h': 3_600_000,
  '3h': 3 * 3_600_000,
  '6h': 6 * 3_600_000,
  '12h': 12 * 3_600_000,
  '1d': 86_400_000,
  '7d': 7 * 86_400_000,
  '1month': 30 * 86_400_000, // 自然月用 dayjs.add(1,'month') 计算，不使用此值
}

/** 回放帧（来自 provider，可来自真实接口或 mock） */
export interface AirPlaybackFrame {
  index: number
  startTime: string
  endTime: string
  /** deviceId → 8 项浓度 */
  valuesByDeviceId: Record<string, Record<PollutantKey, number | null>>
}

/** 回放 provider 接口（真实接口缺失时用 mock 实现） */
export interface AirPlaybackProvider {
  getFrames(query: import('./utils/aggregation').AirHistoryQuery, stations: AirStationViewModel[]): Promise<AirPlaybackFrame[]>
}

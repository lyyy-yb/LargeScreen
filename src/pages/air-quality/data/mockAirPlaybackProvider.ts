/** 全站历史回放 mock provider
 *  - 计划 §3 / §0 第 5 条：全站历史接口缺失，播放区显式使用 mock
 *  - 同一 deviceId + frameTime 种子生成确定性数据
 *  - 以真实 station.values 为基线做小幅时序变化（±15% 噪声 + 缓慢漂移）
 *  - 真实值全空时给演示值，确保播放器可演示
 *  - mock 数据只进入回放帧；不污染：
 *    - 当前最新值（popup 卡片 8 项）
 *    - popup 12h 真实趋势
 *    - 左侧预警 / 右上范围
 *  - 播放器区域显示"模拟回放"标识
 *  - 后端提供批量历史接口后，实现 apiAirPlaybackProvider 替换注入点即可
 */
import { POLLUTANT_KEYS, type AirPlaybackFrame, type AirPlaybackProvider, type AirStationViewModel, type PollutantKey } from '../types'
import { historyBuckets } from '../utils/aggregation'

/** 字符串哈希 → 32-bit unsigned int（确定性种子） */
function hashSeed(...parts: string[]): number {
  let h = 2166136261 >>> 0
  for (const part of parts) {
    for (let i = 0; i < part.length; i++) {
      h ^= part.charCodeAt(i)
      h = Math.imul(h, 16777619) >>> 0
    }
  }
  return h >>> 0
}

/** 0..1 伪随机（基于种子） */
function rand01(seed: number): number {
  // xorshift32
  let x = seed >>> 0
  x ^= x << 13; x >>>= 0
  x ^= x >> 17; x >>>= 0
  x ^= x << 5; x >>>= 0
  return (x >>> 0) / 0xffffffff
}

interface MockedStationValues {
  /** 帧时刻对应的基线值（null 表示仍无数据，给演示值） */
  baseline: Record<PollutantKey, number>
  /** 是否有真实基线（false 时给演示值） */
  hasBaseline: boolean
}

/** 站点的"基线值"决定回放期间的数值水平。
 *  - 优先用 station.values 中已知的非空值
 *  - 全空时给演示值（PM2.5 35 μg/m³，CO 0.8 mg/m³，TSP 60 等） */
function buildBaseline(station: AirStationViewModel): MockedStationValues {
  const out: Record<PollutantKey, number> = { pm25: NaN, pm10: NaN, so2: NaN, no2: NaN, co: NaN, o3: NaN, vocs: NaN, tsp: NaN }
  let hasAny = false
  POLLUTANT_KEYS.forEach(key => {
    const raw = station.values[key]
    if (raw != null && Number.isFinite(Number(raw))) {
      out[key] = Number(raw)
      hasAny = true
    }
  })
  if (!hasAny) {
    // 演示默认值：典型的城市空气质量背景水平
    out.pm25 = 35
    out.pm10 = 55
    out.so2 = 10
    out.no2 = 28
    out.co = 0.8
    out.o3 = 70
    out.vocs = 120
    out.tsp = 80
  }
  return { baseline: out, hasBaseline: hasAny }
}

export interface MockProviderOptions {
  /** mock 噪声幅度（相对基线），默认 ±15% */
  noise?: number
  /** 漂移振幅（占基线比例），默认 0.1（10% 缓慢起伏） */
  drift?: number
}

export function createMockAirPlaybackProvider(options: MockProviderOptions = {}): AirPlaybackProvider {
  const noise = options.noise ?? 0.15
  const drift = options.drift ?? 0.1

  return {
    async getFrames(query, stations) {
      const buckets = historyBuckets(query)
      const frameCount = buckets.length
      if (frameCount === 0) return []

      // 为每个站点计算基线（一次，复用）
      const stationsWithBaseline = stations.map(s => ({
        station: s,
        baseline: buildBaseline(s),
      }))

      // 生成帧
      const frames: AirPlaybackFrame[] = []
      for (let i = 0; i < frameCount; i++) {
        const range = buckets[i]
        const valuesByDeviceId: Record<string, Record<PollutantKey, number | null>> = {}
        stationsWithBaseline.forEach(({ station, baseline }) => {
          const values = {} as Record<PollutantKey, number | null>
          POLLUTANT_KEYS.forEach(key => {
            const base = baseline.baseline[key]
            if (!Number.isFinite(base)) {
              values[key] = null
              return
            }
            // 用 deviceId + frame 时间 + 污染物 key 混合种子，确保确定性
            const seed = hashSeed(station.deviceId, range.start.toISOString(), key)
            // 漂移：sin 曲线（按帧序 + 设备 hash 偏移）
            const phase = rand01(seed ^ 0x5bd1e995) * Math.PI * 2
            const driftValue = Math.sin((i / Math.max(1, frameCount)) * Math.PI * 2 + phase) * drift
            // 噪声：±noise 范围
            const noiseValue = (rand01(seed ^ 0xa3c59ac4) * 2 - 1) * noise
            const factor = 1 + driftValue + noiseValue
            const value = base * factor
            values[key] = Math.max(0, Math.round(value * 10) / 10)
          })
          valuesByDeviceId[station.deviceId] = values
        })
        frames.push({
          index: i,
          startTime: range.start.toISOString(),
          endTime: range.end.toISOString(),
          valuesByDeviceId,
        })
      }
      return frames
    },
  }
}

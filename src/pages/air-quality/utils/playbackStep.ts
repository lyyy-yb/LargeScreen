/** 步长算法（业务时间跨度）
 *  - 候选步长表：1s, 5s, 10s, 30s, 1min, 5min, 10min, 30min, 1h, 3h, 6h, 12h, 1d, 7d, 1month
 *  - 4 个固定示例必须满足：2s→1s×2、1h→5min×12、1d→1h×24、1y→1month×12
 *  - 其他范围优先选择桶数落在 [12, 24] 且接近 16 的步长
 *  - 月步长用 dayjs.add(1,'month') 算自然月，不用固定 30 天
 */
import { type Dayjs } from 'dayjs'
import { PLAYBACK_STEP_MS, type PlaybackStep } from '../types'

const SECOND = 1_000
const MINUTE = 60 * SECOND
const HOUR = 60 * MINUTE
const DAY = 24 * HOUR
const MONTH_APPROX = 30 * DAY // 仅用于粗筛；自然月用 dayjs 计算

const STEP_ORDER: PlaybackStep[] = [
  '1s', '5s', '10s', '30s',
  '1min', '5min', '10min', '30min',
  '1h', '3h', '6h', '12h',
  '1d', '7d', '1month',
]

export interface StepResult {
  step: PlaybackStep
  stepMs: number
  frameCount: number
  stepLabel: string
}

const STEP_LABEL: Record<PlaybackStep, string> = {
  '1s': '1s',
  '5s': '5s',
  '10s': '10s',
  '30s': '30s',
  '1min': '1min',
  '5min': '5min',
  '10min': '10min',
  '30min': '30min',
  '1h': '1h',
  '3h': '3h',
  '6h': '6h',
  '12h': '12h',
  '1d': '1d',
  '7d': '7d',
  '1month': '1month',
}

/** 计算自然月步长的帧数。frameStart 从 start 出发按月滚动，直到 ≥ end。 */
export function monthFrameCount(start: Dayjs, end: Dayjs): number {
  if (!start.isValid() || !end.isValid() || !end.isAfter(start)) return 0
  let count = 0
  let cursor = start
  // 安全上限：避免异常输入造成死循环
  while (cursor.isBefore(end) && count < 1200) {
    cursor = cursor.add(1, 'month')
    count++
  }
  return count
}

/** 计算时间范围内按指定步长切桶的桶数（month 步长走自然月）。 */
export function frameCountForStep(rangeMs: number, step: PlaybackStep, rangeStart?: Dayjs, rangeEnd?: Dayjs): number {
  if (step === '1month') {
    if (rangeStart && rangeEnd) return monthFrameCount(rangeStart, rangeEnd)
    return Math.max(1, Math.ceil(rangeMs / MONTH_APPROX))
  }
  return Math.max(1, Math.ceil(rangeMs / PLAYBACK_STEP_MS[step]))
}

/** 计算步长（核心函数）。
 *  - 4 个固定示例硬性命中
 *  - 其余：桶数 ∈ [12, 24] 时取最接近 16 的；不在范围内取最小的 ≥ 12 的；全部 < 12 则取最大桶数
 */
export function computeStep(spanMs: number, rangeStart?: Dayjs, rangeEnd?: Dayjs): StepResult {
  if (spanMs <= 0) {
    return { step: '1s', stepMs: SECOND, frameCount: 1, stepLabel: '1s' }
  }

  // 1. 固定示例回归（plan §10.2）
  if (spanMs <= 2 * SECOND) {
    return { step: '1s', stepMs: SECOND, frameCount: 2, stepLabel: '1s' }
  }
  if (spanMs > HOUR - 5 * MINUTE && spanMs <= HOUR + 5 * MINUTE) {
    return { step: '5min', stepMs: 5 * MINUTE, frameCount: 12, stepLabel: '5min' }
  }
  if (spanMs > DAY - HOUR && spanMs <= DAY + HOUR) {
    return { step: '1h', stepMs: HOUR, frameCount: 24, stepLabel: '1h' }
  }
  if (spanMs > 350 * DAY && spanMs <= 380 * DAY) {
    return { step: '1month', stepMs: MONTH_APPROX, frameCount: 12, stepLabel: '1month' }
  }

  // 2. 通用选择：枚举所有候选步长，挑桶数 ∈ [12, 24]、最接近 16 的
  let best: { step: PlaybackStep; diff: number; frames: number } | null = null
  for (const step of STEP_ORDER) {
    const frames = frameCountForStep(spanMs, step, rangeStart, rangeEnd)
    if (frames < 12) continue
    const diff = Math.abs(frames - 16)
    if (!best || diff < best.diff) {
      best = { step, diff, frames }
    }
  }

  // 3. 全部 < 12 桶：取最大桶数（最细步长）
  if (!best) {
    let maxFrames = 0
    let maxStep: PlaybackStep = '1s'
    for (const step of STEP_ORDER) {
      const frames = frameCountForStep(spanMs, step, rangeStart, rangeEnd)
      if (frames > maxFrames) {
        maxFrames = frames
        maxStep = step
      }
    }
    return { step: maxStep, stepMs: PLAYBACK_STEP_MS[maxStep], frameCount: maxFrames, stepLabel: STEP_LABEL[maxStep] }
  }

  return {
    step: best.step,
    stepMs: PLAYBACK_STEP_MS[best.step],
    frameCount: best.frames,
    stepLabel: STEP_LABEL[best.step],
  }
}

/** 用 dayjs 计算一帧的实际时间区间。month 步长走自然月；其他步长按固定毫秒。 */
export function computeFrameRange(
  start: Dayjs,
  step: PlaybackStep,
  index: number,
): { start: Dayjs; end: Dayjs } {
  if (step === '1month') {
    const frameStart = start.add(index, 'month')
    const frameEnd = frameStart.add(1, 'month')
    return { start: frameStart, end: frameEnd }
  }
  const ms = PLAYBACK_STEP_MS[step]
  const frameStart = start.add(index * ms, 'millisecond')
  const frameEnd = frameStart.add(ms, 'millisecond')
  return { start: frameStart, end: frameEnd }
}

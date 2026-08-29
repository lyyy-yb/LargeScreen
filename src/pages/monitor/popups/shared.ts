/**
 * monitor 弹窗共享：常量、字段表、类型、utils
 * 给 AirStationDetailPopup / OutletDetailPopup 共用
 */

import type { AirTrendItem, AirQualityPoint, StationAirRange } from '@/types/airData'
import type { AirPointClickPos } from '@/utils/mapAirLayers'
import type { OutletPointClickPos } from '@/utils/mapEmissionOutletLayers'
import type { EmissionOutletPoint } from '@/utils/mapEmissionOutletLayers'

// ---------- 弹窗尺寸常量 ----------

export const AIR_POPUP_WIDTH = 400
export const AIR_POPUP_HEIGHT = 372
export const AIR_POPUP_GAP = 14

export const OUTLET_POPUP_WIDTH = 320
export const OUTLET_POPUP_GAP = 14

// ---------- 字段表（AQI / 浓度） ----------

export interface AirFieldConfig {
  valueKey: string
  trendKey: keyof AirTrendItem
  label: string
  color: string
  unit?: string
}

export const AIR_AQI_FIELDS: AirFieldConfig[] = [
  { valueKey: 'pm25Iaqi', trendKey: 'pm25', label: 'PM2.5', color: '#00ddfa' },
  { valueKey: 'pm10Iaqi', trendKey: 'pm10', label: 'PM10', color: '#f8973c' },
  { valueKey: 'so2Iaqi', trendKey: 'so2', label: 'SO₂', color: '#7ed957' },
  { valueKey: 'no2Iaqi', trendKey: 'no2', label: 'NO₂', color: '#fad93e' },
  { valueKey: 'coIaqi', trendKey: 'co', label: 'CO', color: '#c17cff' },
  { valueKey: 'o3Iaqi', trendKey: 'o3', label: 'O₃', color: '#ff6b81' },
]

export const AIR_CONCENTRATION_FIELDS: AirFieldConfig[] = [
  { valueKey: 'pm25Avg', trendKey: 'pm25', label: 'PM2.5', unit: 'μg/m³', color: '#00ddfa' },
  { valueKey: 'pm10Avg', trendKey: 'pm10', label: 'PM10', unit: 'μg/m³', color: '#f8973c' },
  { valueKey: 'so2Avg', trendKey: 'so2', label: 'SO₂', unit: 'μg/m³', color: '#7ed957' },
  { valueKey: 'no2Avg', trendKey: 'no2', label: 'NO₂', unit: 'μg/m³', color: '#fad93e' },
  { valueKey: 'coAvg', trendKey: 'co', label: 'CO', unit: 'mg/m³', color: '#c17cff' },
  { valueKey: 'o3Avg', trendKey: 'o3', label: 'O₃', unit: 'μg/m³', color: '#ff6b81' },
  { valueKey: 'vocsAvg', trendKey: 'vocs', label: 'VOCs', unit: 'μg/m³', color: '#35c4a8' },
  { valueKey: 'tspAvg', trendKey: 'tsp', label: 'TSP', unit: 'μg/m³', color: '#5c8dff' },
]

// ---------- 类型 ----------

export type AirPopupMode = 'concentration' | 'aqi'

/** 空气质量点位详情（AirStationDetailPopup 输入） */
export interface AirPointDetail {
  /** 数据源 ID（用于查询 aqiDetail 近 12 小时趋势） */
  id?: number
  name: string
  aqi: number | null
  aqiLevel: string
  values: Record<string, number | null>
  /** 点击时的屏幕像素坐标（弹窗锚定位置，缺失时居中） */
  pos?: AirPointClickPos
}

/** 企业排口点位详情（OutletDetailPopup 输入） */
export interface OutletPointDetail extends EmissionOutletPoint {
  /** 点击时的屏幕像素坐标（弹窗锚定位置，缺失时居中） */
  pos?: OutletPointClickPos
}

// ---------- utils ----------

/** 格式化站点数值（保留一位小数，空值显示 --） */
export function formatAirValue(value: unknown): string {
  const num = Number(value)
  if (value == null || !Number.isFinite(num)) return '--'
  return String(Math.round(num * 10) / 10)
}

/** 从 record 多个候选 key 中取第一个非空字符串 */
export function firstText(item: Record<string, unknown>, keys: string[], fallback = ''): string {
  for (const key of keys) {
    const value = item[key]
    if (value != null && String(value).trim() !== '') return String(value)
  }
  return fallback
}

/** 趋势行解析：兼容 hour / time / dataTime 字段名 */
export function parseTrendRow(row: Record<string, unknown>): AirTrendItem | null {
  const hourText = firstText(row, ['hour', 'time', 'dataTime'])
  if (!hourText) return null
  const numVal = (key: string) => {
    const raw = row[key]
    const num = Number(raw)
    return raw != null && Number.isFinite(num) ? num : null
  }
  return {
    hour: hourText,
    pm25: numVal('pm25'),
    pm10: numVal('pm10'),
    so2: numVal('so2'),
    no2: numVal('no2'),
    co: numVal('co'),
    o3: numVal('o3'),
    vocs: numVal('vocs'),
    tsp: numVal('tsp'),
  }
}

/** 从 aqiDetail 返回中提取趋势数组（兼容直接数组 / 独立 *Trend 字段 / 旧结构包装） */
export function extractTrendRows(value: unknown, mode: 'concentration' | 'aqi'): AirTrendItem[] {
  // 直接数组：按旧格式 { hour, pm25, pm10, ... } 解析
  if (Array.isArray(value)) {
    return value
      .filter((item) => !!item && typeof item === 'object')
      .map((item) => parseTrendRow(item as Record<string, unknown>))
      .filter((item): item is AirTrendItem => !!item)
  }

  if (!value || typeof value !== 'object') return []
  const record = value as Record<string, unknown>

  // 后端实际结构：{ so2Trend: [{hour,value},...], no2Trend: [...], ... }
  const pollutantKeys: (keyof AirTrendItem)[] = mode === 'aqi'
    ? ['pm25', 'pm10', 'so2', 'no2', 'co', 'o3']
    : ['pm25', 'pm10', 'so2', 'no2', 'co', 'o3', 'vocs', 'tsp']
  const TREND_FIELD_MAP = Object.fromEntries(
    pollutantKeys.map((key) => [`${key}${mode === 'aqi' ? 'IaqiTrend' : 'Trend'}`, key]),
  ) as Record<string, keyof AirTrendItem>
  const merged = new Map<string, AirTrendItem>()
  let hasTrendFields = false
  Object.entries(TREND_FIELD_MAP).forEach(([trendKey, itemKey]) => {
    const arr = record[trendKey]
    if (!Array.isArray(arr)) return
    hasTrendFields = true
    arr.forEach((item: unknown) => {
      if (!item || typeof item !== 'object') return
      const row = item as Record<string, unknown>
      const hourText = firstText(row, ['hour', 'time', 'dataTime'])
      if (!hourText) return
      const rawValue = row.value
      const num = Number(rawValue)
      const val = rawValue != null && Number.isFinite(num) ? num : null
      let existing = merged.get(hourText)
      if (!existing) {
        existing = { hour: hourText, pm25: null, pm10: null, so2: null, no2: null, co: null, o3: null, vocs: null, tsp: null }
        merged.set(hourText, existing)
      }
      ;(existing as unknown as Record<string, unknown>)[itemKey] = val
    })
  })
  if (hasTrendFields) {
    return Array.from(merged.values())
  }

  // 兼容旧结构：{ trendList: [...], trend: [...], list: [...], rows: [...], data: [...], hours: [...] }
  for (const key of ['trendList', 'trend', 'list', 'rows', 'data', 'hours']) {
    const nested = record[key]
    if (Array.isArray(nested)) {
      return nested
        .filter((item) => !!item && typeof item === 'object')
        .map((item) => parseTrendRow(item as Record<string, unknown>))
        .filter((item): item is AirTrendItem => !!item)
    }
  }

  return []
}

/** 通用类型，给 main 文件复用 */
export type UnknownRecord = Record<string, unknown>

/** 占位：re-export 业务类型以备 main 引用（实际 main 也已 import） */
export type { AirTrendItem, AirQualityPoint, StationAirRange }

import { useEffect } from 'react'
import type { AlertMapLayers } from '@/utils/mapAlertLayers'
import type { AirMapLayers } from '@/utils/mapAirLayers'
import type { DeviceMapLayers } from '@/utils/mapDeviceLayers'
import type { RadarAlarmLayers } from '@/utils/mapRadarAlarmLayers'
import type { EmissionOutletLayers } from '@/utils/mapEmissionOutletLayers'

/**
 * 地图覆盖层显隐开关（monitor 三级地图共用）：
 * 全部基于持久图层的 show()/hide()（O(1)，不销毁重建、不闪屏）。
 * 预警 ↔ 空气质量互斥由页面 state 保证（同一时刻只显一类）。
 */
export interface LayerVisibilityRefs {
  alertLayersRef: { current: AlertMapLayers | null }
  airLayersRef: { current: AirMapLayers | null }
  deviceLayersRef: { current: DeviceMapLayers | null }
  radarAlarmLayersRef: { current: RadarAlarmLayers | null }
  /** 企业排口打点（图层 + 文字层一并显隐，缩放门控仍生效） */
  emissionOutletLayersRef: { current: EmissionOutletLayers | null }
}

export interface LayerVisibilityFlags {
  /** 预警点位（iconLayer + countLayer 一并显隐） */
  showAlertPoints: boolean
  /** 空气质量检测站 */
  showAirPoints: boolean
  /** 无人机图标层 */
  showDronePoints: boolean
  /** 雷达：DOM 扫描盘 + 雷达突发告警点一并显隐 */
  showRadarPoints: boolean
  /** 企业排口打点（图标层 + 文字层一并显隐） */
  showEmissionOutletPoints: boolean
}

/**
 * 将页面显隐开关接到地图图层 ref 上。
 * @param ready 图层是否已创建完成（场景重建时会 false→true 重置，显隐态随之重新应用到新图层）
 */
export function useLayerVisibility(
  refs: LayerVisibilityRefs,
  flags: LayerVisibilityFlags,
  ready: boolean,
) {
  const { alertLayersRef, airLayersRef, deviceLayersRef, radarAlarmLayersRef, emissionOutletLayersRef } = refs
  const { showAlertPoints, showAirPoints, showDronePoints, showRadarPoints, showEmissionOutletPoints } = flags

  // 预警：同时切图标层与计数层
  useEffect(() => {
    const a = alertLayersRef.current
    if (!a) return
    if (showAlertPoints) { a.iconLayer.show(); a.countLayer.show() } else { a.iconLayer.hide(); a.countLayer.hide() }
  }, [alertLayersRef, showAlertPoints, ready])

  // 空气质量检测站（图标层直接显隐；站名文字层由缩放阈值 + 开关双条件控制）
  useEffect(() => {
    const p = airLayersRef.current
    if (!p) return
    if (showAirPoints) p.iconLayer.show(); else p.iconLayer.hide()
    p.setNameVisible(showAirPoints)
  }, [airLayersRef, showAirPoints, ready])

  // 无人机图标层（deviceLayers 内 iconLayer 仅含 drone 点）
  useEffect(() => {
    const d = deviceLayersRef.current?.iconLayer
    if (!d) return
    if (showDronePoints) d.show(); else d.hide()
  }, [deviceLayersRef, showDronePoints, ready])

  // 雷达：扫描盘（DOM overlay，show/hide 为补丁实现）+ 雷达突发告警点（标准 ILayer）；
  // 常规/突发点位名称层由缩放阈值 + 开关双条件控制
  useEffect(() => {
    const d = deviceLayersRef.current
    const r = radarAlarmLayersRef.current
    if (showRadarPoints) { d?.radarLayer.show(); r?.layer.show() } else { d?.radarLayer.hide(); r?.layer.hide() }
    d?.setNameVisible(showRadarPoints)
    r?.setNameVisible(showRadarPoints)
  }, [deviceLayersRef, radarAlarmLayersRef, showRadarPoints, ready])

  // 企业排口打点：开关只更新基础显隐态，图标/文字的缩放门控仍然生效。
  useEffect(() => {
    const e = emissionOutletLayersRef.current
    if (!e) return
    e.setVisible(showEmissionOutletPoints)
  }, [emissionOutletLayersRef, showEmissionOutletPoints, ready])
}

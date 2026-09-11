/**
 * 预警中心 4 Tab 共享的常量字典与状态映射
 * - 5 个选项字典：dataTypeOptions / ruleTypeOptions / alertLevelOptions / taskTypeOptions / fieldOptions
 * - 3 个 status 映射：ALERT_STATUS_LABEL_MAP / TASK_STATUS_LABEL_MAP / ALERT_STATUS_COLOR_MAP
 *
 * 设计原则：只放真正"跨 Tab 共享"的数据；单 Tab 私有的（如 TrendsTab 的 LEVEL_COLOR_MAP）
 * 仍保留在各自 Tab 文件内。
 */

import type { SelectOption, AlertLevelOption } from '../../modals/RuleModal'

// ---------- 选项字典 ----------

export const DATA_TYPE_OPTIONS: SelectOption[] = [
  { value: 'air_quality_station', label: '空气质量检测站' },
  { value: 'mobile_monitor_car', label: '走航车' },
  { value: 'drone_sensor', label: '无人机传感器' },
  { value: 'power_monitor', label: '用电监控' },
  { value: 'radar_station', label: '雷达站' },
]

export const RULE_TYPE_OPTIONS: SelectOption[] = [
  { value: 'threshold', label: '数值阈值预警' },
  { value: 'change_rate', label: '变化率预警' },
  { value: 'continuous', label: '连续超标预警' },
  { value: 'offline', label: '离线预警' },
]

export const ALERT_LEVEL_OPTIONS: AlertLevelOption[] = [
  { value: 'level1', label: '一级预警', color: '#FF4D4F' },
  { value: 'level2', label: '二级预警', color: '#FA8C16' },
  { value: 'level3', label: '三级预警', color: '#FAAD14' },
  { value: 'level4', label: '四级预警', color: '#1890FF' },
]

export const TASK_TYPE_OPTIONS: SelectOption[] = [
  { value: 'on_site_check', label: '现场核查' },
  { value: 'data_verification', label: '数据校验' },
  { value: 'vehicle_dispatch', label: '车辆调度' },
  { value: 'flight_dispatch', label: '飞行调度' },
  { value: 'enterprise_inspection', label: '企业巡查' },
]

export const FIELD_OPTIONS: Record<string, SelectOption[]> = {
  air_quality_station: [
    { value: 'pm25', label: 'PM2.5' },
    { value: 'pm10', label: 'PM10' },
    { value: 'tsp', label: 'TSP' },
    { value: 'o3', label: 'O₃' },
    { value: 'so2', label: 'SO₂' },
    { value: 'no2', label: 'NO₂' },
    { value: 'co', label: 'CO' },
    { value: 'vocs', label: 'VOCs' },
  ],
  mobile_monitor_car: [
    { value: 'pm25', label: 'PM2.5' },
    { value: 'tsp', label: 'TSP' },
  ],
  drone_sensor: [
    { value: 'pm25', label: 'PM2.5' },
    { value: 'pm10', label: 'PM10' },
  ],
  power_monitor: [
    { value: 'power', label: '功率' },
    { value: 'powerFactor', label: '功率因数' },
  ],
  radar_station: [
    { value: 'alarmLevel', label: '报警级别' },
    { value: 'alarmCount', label: '报警次数' },
  ],
}

// ---------- 状态映射（跨 Tab 共享） ----------

/** 预警事件 status（alerts 表 + TrendsTab 状态列） */
export const ALERT_STATUS_LABEL_MAP: Record<string, string> = {
  undispatched: '待派发',
  pending: '待处置',
  processing: '处置中',
  completed: '已处置',
  closed: '已关闭',
  cleared: '已清除',
}

export const ALERT_STATUS_COLOR_MAP: Record<string, string> = {
  undispatched: 'orange', pending: 'orange', processing: 'blue', completed: 'green', closed: 'default', cleared: 'default',
}

/** 处置任务 status（tasks 表） */
export const TASK_STATUS_LABEL_MAP: Record<string, { label: string; color: string }> = {
  pending: { label: '待接收', color: 'orange' },
  processing: { label: '处置中', color: 'blue' },
  committed: { label: '已提交', color: 'cyan' },
  completed: { label: '已完成', color: 'green' },
}

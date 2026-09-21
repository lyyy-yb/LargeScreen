import { Tag } from 'antd'
import type { TableColumnsType } from 'antd'
import type { AirDataDetailVO, AirDataLevel, DroneTaskDataSource, DroneTaskVO, MobileMonitorDetailVO } from '@/types/dataManage'
import { DATA_SOURCE_MAP, LEVEL_COLOR, LEVEL_LABEL, fmt, renderTaskStatus } from './shared'

/** 微站数据列定义（分钟级/小时级/日级通用） */
export const stationColumns: TableColumnsType<AirDataDetailVO> = [
  { title: '监测时间', dataIndex: 'dataTime', key: 'dataTime', width: 170 },
  {
    title: '数据级别',
    dataIndex: 'dataLevel',
    key: 'dataLevel',
    width: 110,
    align: 'center' as const,
    render: (v: AirDataLevel) => <Tag color={LEVEL_COLOR[v]}>{LEVEL_LABEL[v] ?? v}</Tag>,
  },
  { title: 'PM2.5(μg/m³)', dataIndex: 'pm25', key: 'pm25', width: 110, align: 'center' as const, render: (v: number | null) => fmt(v) },
  { title: 'PM10(μg/m³)', dataIndex: 'pm10', key: 'pm10', width: 110, align: 'center' as const, render: (v: number | null) => fmt(v) },
  { title: 'SO₂(μg/m³)', dataIndex: 'so2', key: 'so2', width: 110, align: 'center' as const, render: (v: number | null) => fmt(v) },
  { title: 'NO₂(μg/m³)', dataIndex: 'no2', key: 'no2', width: 110, align: 'center' as const, render: (v: number | null) => fmt(v) },
  { title: 'O₃(μg/m³)', dataIndex: 'o3', key: 'o3', width: 110, align: 'center' as const, render: (v: number | null) => fmt(v) },
  { title: 'CO(mg/m³)', dataIndex: 'co', key: 'co', width: 110, align: 'center' as const, render: (v: number | null) => fmt(v) },
  { title: 'VOCs(μg/m³)', dataIndex: 'vocs', key: 'vocs', width: 110, align: 'center' as const, render: (v: number | null) => fmt(v) },
  { title: 'TSP(μg/m³)', dataIndex: 'tsp', key: 'tsp', width: 110, align: 'center' as const, render: (v: number | null) => fmt(v) },
  { title: '温度(℃)', dataIndex: 'temperature', key: 'temperature', width: 90, align: 'center' as const, render: (v: number | null) => fmt(v) },
  { title: '湿度(%)', dataIndex: 'humidity', key: 'humidity', width: 90, align: 'center' as const, render: (v: number | null) => fmt(v) },
  { title: '气压(KPa)', dataIndex: 'pressure', key: 'pressure', width: 100, align: 'center' as const, render: (v: number | null) => fmt(v) },
  { title: '风速(m/s)', dataIndex: 'windSpeed', key: 'windSpeed', width: 100, align: 'center' as const, render: (v: number | null) => fmt(v) },
  { title: '风向(°)', dataIndex: 'windDirection', key: 'windDirection', width: 100, align: 'center' as const, render: (v: number | null) => fmt(v) },
  { title: '样本数', dataIndex: 'sampleCount', key: 'sampleCount', width: 90, align: 'center' as const, render: (v: number | null) => fmt(v) },
]

/**
 * 无人机任务行操作回调：
 * - onViewApiResult：api 任务的"查看采集结果"按钮
 * - onUploadImport：import 任务的"上传资源"按钮
 * - onViewImport：import 任务的"查看资源"按钮
 *
 * 注：columns 工厂需要这组回调才能在 render 中真正触发弹窗，
 *    这样上层（DataManage 页面）只需传 props 进来，不必用 ref 全局 dispatch。
 */
export interface DroneTaskRowActions {
  onViewApiResult: (task: DroneTaskVO) => void
  onUploadImport: (task: DroneTaskVO) => void
  onViewImport: (task: DroneTaskVO) => void
}

/**
 * 操作按钮：统一使用全局 .tech-action-btn 系列（详见 src/assets/css/global.less:1429）
 * - 查看（详情类）  → btn-detail（蓝色）
 * - 上传（新建类）  → btn-success（绿色）
 */
function techBtn(label: string, kind: 'detail' | 'success' | 'danger', onClick: () => void) {
  return (
    <button type="button" className={`tech-action-btn btn-${kind}`} onClick={onClick}>
      {label}
    </button>
  )
}

/** 无人机任务列定义（工厂：依赖行操作回调） */
export function droneColumns(actions: DroneTaskRowActions): TableColumnsType<DroneTaskVO> {
  return [
    { title: '任务ID', dataIndex: 'taskId', key: 'taskId', width: 160 },
    { title: '任务名称', dataIndex: 'taskName', key: 'taskName', width: 180 },
    { title: '机场编码', dataIndex: 'dockCode', key: 'dockCode', width: 140 },
    {
      title: '任务状态',
      dataIndex: 'taskStatus',
      key: 'taskStatus',
      width: 100,
      align: 'center' as const,
      render: renderTaskStatus,
    },
    { title: '执行时间', dataIndex: 'taskTime', key: 'taskTime', width: 170 },
    { title: '结果数', dataIndex: 'resultCount', key: 'resultCount', width: 90, align: 'center' as const },
    {
      title: '数据来源',
      dataIndex: 'dataSource',
      key: 'dataSource',
      width: 110,
      align: 'center' as const,
      render: (v: DroneTaskDataSource) => DATA_SOURCE_MAP[v] ?? v,
    },
    { title: '失败原因', dataIndex: 'failReason', key: 'failReason', width: 180, render: (v: string) => v || '-' },
    { title: '创建人', dataIndex: 'createBy', key: 'createBy', width: 110 },
    {
      title: '操作',
      key: 'action',
      width: 220,
      render: (_, row: DroneTaskVO) => {
        if (row.dataSource === 'api') {
          return (
            <div className="flex items-center gap-2">
              {techBtn('查看', 'detail', () => actions.onViewApiResult(row))}
            </div>
          )
        }
        if (row.dataSource === 'import') {
          return (
            <div className="flex items-center gap-2">
              {techBtn('上传', 'success', () => actions.onUploadImport(row))}
              {techBtn('查看', 'detail', () => actions.onViewImport(row))}
            </div>
          )
        }
        return '-'
      },
    },
  ]
}

/**
 * 走航任务表格列定义：
 * 后端只返回有数据的日期数组，车辆编码/车辆名称在查询时已知，需逐行重复展示。
 */
export const carColumns: TableColumnsType<{ mnCode: string; mnName: string; date: string }> = [
  { title: '车辆编码', dataIndex: 'mnCode', key: 'mnCode', width: 180 },
  { title: '车辆名称', dataIndex: 'mnName', key: 'mnName', width: 220 },
  { title: '数据日期', dataIndex: 'date', key: 'date', width: 180 },
]

/** 走航任务派生行：把后端返回的 date 数组展开成表格行（编码/名称逐行重复） */
export function buildCarRows(
  carDetail: MobileMonitorDetailVO | null,
  fallbackCode: string,
  carName: string,
) {
  return (carDetail?.dataDates ?? []).map(d => ({
    date: d,
    mnCode: carDetail?.deviceId ?? carDetail?.mnCode ?? fallbackCode ?? '-',
    mnName: carName,
  }))
}

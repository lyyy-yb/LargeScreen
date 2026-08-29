import { useCallback, useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { App, Button, Checkbox, DatePicker, Input, Select, Table, Tag, Upload } from 'antd'
import { ArrowLeftOutlined, DownloadOutlined, UploadOutlined } from '@ant-design/icons'
import dayjs, { type Dayjs } from 'dayjs'
import { dataManageApi } from '@/servers/dataManage'
import { dataSourceApi } from '@/servers/business'
import { dockList } from '@/servers/mapBox'
import { useAppStore } from '@/stores'
import { normalizeDock, type NormalizedDock } from '@/utils/dock'
import { disabledFutureDate } from '@/utils/helpers'
import { toRegionQuery } from '@/utils/region'
import type {
  AirDataDetailVO,
  AirDataLevel,
  DroneTaskDataSource,
  DroneTaskStatus,
  DroneTaskVO,
  MobileMonitorDetailVO,
} from '@/types/dataManage'
import type { DataSourceDTO } from '@/types/business'

const { RangePicker } = DatePicker

type TabKey = 'station' | 'mobile' | 'drone'

/** 查询条件变更后防抖触发接口查询的时长（项目 debounce 工具默认 300ms，此处按需用 500ms） */
const QUERY_DEBOUNCE = 500

/** 默认时间范围：昨天 00:00:00 ~ 今天 00:00:00（默认查一天） */
function defaultDayRange(): [Dayjs, Dayjs] {
  return [dayjs().subtract(1, 'day').startOf('day'), dayjs().startOf('day')]
}

/**
 * 查询条件变化后防抖自动查询（无需查询/重置按钮）
 * 用 effect + setTimeout 实现：条件变化即重置定时器，停止输入 500ms 后才真正请求
 * @param enabled 是否启用（仅当前页签激活时查询）
 * @param query 查询条件（需为稳定引用，用 useMemo 包装）
 * @param run 实际执行的查询函数
 */
function useDebouncedQuery(enabled: boolean, query: unknown, run: () => void, delay = QUERY_DEBOUNCE) {
  useEffect(() => {
    if (!enabled) return
    const timer = setTimeout(run, delay)
    return () => clearTimeout(timer)
    // run 随 state 变化产生新引用，此处只依赖查询条件本身，故忽略
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, query, delay])
}

/** 数据级别：'' 表示全部（后端不传 level） */
const LEVEL_OPTIONS: { value: AirDataLevel | ''; label: string }[] = [
  { value: '', label: '全部' },
  { value: 'minute', label: '分钟级' },
  { value: 'hourly', label: '小时级汇总' },
  { value: 'daily', label: '日级汇总' },
]

const LEVEL_LABEL: Record<AirDataLevel, string> = {
  minute: '分钟级',
  hourly: '小时级汇总',
  daily: '日级汇总',
}

const LEVEL_COLOR: Record<AirDataLevel, string> = {
  minute: 'blue',
  hourly: 'orange',
  daily: 'purple',
}

/**
 * 无人机任务状态：与 /drone 飞行任务（listFlyJob.jobStatus）同一套字符串枚举，仅四个值
 * 0-等待中 1-进行中 a-已完成 f-失败
 * 来源：src/pages/drone/index.tsx 的 statusObj
 */
const TASK_STATUS_MAP: Record<DroneTaskStatus, { label: string; color: string }> = {
  '0': { label: '等待中', color: 'default' },
  '1': { label: '进行中', color: 'processing' },
  'a': { label: '已完成', color: 'success' },
  'f': { label: '失败', color: 'error' },
}

const TASK_STATUS_OPTIONS: { value: DroneTaskStatus; label: string }[] = [
  { value: '0', label: '等待中' },
  { value: '1', label: '进行中' },
  { value: 'a', label: '已完成' },
  { value: 'f', label: '失败' },
]

/** 表格状态渲染：后端可能返回数字或字符串，统一转字符串后再查表 */
function renderTaskStatus(v: unknown) {
  const meta = TASK_STATUS_MAP[String(v) as DroneTaskStatus]
  return <Tag color={meta?.color}>{meta?.label ?? String(v ?? '-')}</Tag>
}

const DATA_SOURCE_MAP: Record<DroneTaskDataSource, string> = {
  api: '第三方接口',
  import: '本地导入',
}

const DATE_TIME_FMT = 'YYYY-MM-DD HH:mm:ss'
const DATE_FMT = 'YYYY-MM-DD'

/** 数值格式化：分钟级/小时级部分污染物为 null，统一渲染为 - */
const fmt = (v: number | null | undefined) => (v == null ? '-' : v)

/** 下载 Blob 文件（模板下载/导出共用） */
function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = filename
  document.body.appendChild(anchor)
  anchor.click()
  anchor.remove()
  URL.revokeObjectURL(url)
}

/** 后端异常时也会返回 JSON 格式的 blob，先识别再提示 */
async function isJsonErrorBlob(blob: Blob): Promise<boolean> {
  if (!blob.type.includes('application/json')) return false
  try {
    const body = JSON.parse(await blob.text()) as { msg?: string; message?: string }
    return !(body == null)
  } catch {
    return true
  }
}

export default function DataManage() {
  const navigate = useNavigate()
  const { message } = App.useApp()
  const roleKey = useAppStore(state => state.regionContext?.roleKey)
  const querySelection = useAppStore(state => state.regionContext?.querySelection)
  // 乡镇业务人员无监控大屏权限，不显示返回按钮
  const showBackToMonitor = roleKey !== 'town_business'

  const [activeTab, setActiveTab] = useState<TabKey>('station')

  // ============ 微站数据 ============
  const [stations, setStations] = useState<DataSourceDTO[]>([])
  /** 不传 deviceId 时后端返回数据权限内的全部设备数据 */
  const [stationDeviceId, setStationDeviceId] = useState<string>('')
  const [level, setLevel] = useState<AirDataLevel | ''>('minute')
  const [stationRange, setStationRange] = useState<[Dayjs, Dayjs] | null>(defaultDayRange)
  const [stationRows, setStationRows] = useState<AirDataDetailVO[]>([])
  const [stationTotal, setStationTotal] = useState(0)
  const [stationPage, setStationPage] = useState(1)
  const [stationSize, setStationSize] = useState(15)
  const [stationLoading, setStationLoading] = useState(false)
  const [stationExporting, setStationExporting] = useState(false)

  // ============ 走航任务 ============
  const [cars, setCars] = useState<DataSourceDTO[]>([])
  const [carCode, setCarCode] = useState<string>('')
  const [carRange, setCarRange] = useState<[Dayjs, Dayjs] | null>(defaultDayRange)
  const [carDetail, setCarDetail] = useState<MobileMonitorDetailVO | null>(null)
  const [carLoading, setCarLoading] = useState(false)
  const [carExporting, setCarExporting] = useState(false)

  // ============ 无人机任务 ============
  /** 无人机机场下拉（与 /drone 页面同一接口 /dpSys/hbdp/wurenji/dockList，带区域与数据权限） */
  const [docks, setDocks] = useState<NormalizedDock[]>([])
  const [docksLoading, setDocksLoading] = useState(false)
  const [droneDockCode, setDroneDockCode] = useState('')
  const [droneTaskName, setDroneTaskName] = useState('')
  const [droneStatus, setDroneStatus] = useState<DroneTaskStatus>()
  const [includeThirdParty, setIncludeThirdParty] = useState(true)
  const [droneRange, setDroneRange] = useState<[Dayjs, Dayjs] | null>(defaultDayRange)
  const [droneRows, setDroneRows] = useState<DroneTaskVO[]>([])
  const [droneTotal, setDroneTotal] = useState(0)
  const [dronePage, setDronePage] = useState(1)
  const [droneSize, setDroneSize] = useState(15)
  const [droneLoading, setDroneLoading] = useState(false)
  const [droneExporting, setDroneExporting] = useState(false)
  const [droneImporting, setDroneImporting] = useState(false)

  // 设备下拉：微站与走航车（大屏数据源列表，带数据权限）
  useEffect(() => {
    const loadDevices = async () => {
      try {
        const [stationRes, carRes] = await Promise.all([
          dataSourceApi.screenList('air_quality_station'),
          dataSourceApi.screenList('mobile_monitor_car'),
        ])
        const stationList = stationRes?.data ?? []
        const carList = carRes?.data ?? []
        setStations(stationList)
        setCars(carList)
        if (carList.length && !carCode) {
          setCarCode(carList[0].deviceId)
        }
      } catch {
        message.error('数据源列表加载失败')
      }
    }
    loadDevices()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const stationQuery = useMemo(
    () => ({
      deviceId: stationDeviceId || undefined,
      level: level || undefined,
      startTime: stationRange?.[0]?.format(DATE_TIME_FMT),
      endTime: stationRange?.[1]?.format(DATE_TIME_FMT),
    }),
    [stationDeviceId, level, stationRange],
  )

  const fetchStations = useCallback(
    async (page = stationPage, size = stationSize) => {
      // deviceId 非必传，不传时按数据权限查全部设备
      setStationLoading(true)
      try {
        const page$ = await dataManageApi.airStationDetail({
          ...stationQuery,
          pageNum: page,
          pageSize: size,
        })
        setStationRows(page$?.records ?? [])
        setStationTotal(page$?.total ?? 0)
        setStationPage(page)
        setStationSize(size)
      } catch (err) {
        setStationRows([])
        setStationTotal(0)
        message.error(err instanceof Error ? err.message : '微站数据加载失败')
      } finally {
        setStationLoading(false)
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [stationQuery, stationPage, stationSize, stationDeviceId],
  )

  const droneQuery = useMemo(
    () => ({
      dockCode: droneDockCode || undefined,
      taskName: droneTaskName || undefined,
      taskStatus: droneStatus,
      includeThirdParty,
      startTime: droneRange?.[0]?.format(DATE_TIME_FMT),
      endTime: droneRange?.[1]?.format(DATE_TIME_FMT),
    }),
    [droneDockCode, droneTaskName, droneStatus, includeThirdParty, droneRange],
  )

  const fetchDrone = useCallback(
    async (page = dronePage, size = droneSize) => {
      setDroneLoading(true)
      try {
        const page$ = await dataManageApi.droneTaskList({
          ...droneQuery,
          pageNum: page,
          pageSize: size,
        })
        setDroneRows(page$?.records ?? [])
        setDroneTotal(page$?.total ?? 0)
        setDronePage(page)
        setDroneSize(size)
      } catch (err) {
        setDroneRows([])
        setDroneTotal(0)
        message.error(err instanceof Error ? err.message : '无人机任务加载失败')
      } finally {
        setDroneLoading(false)
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [droneQuery, dronePage, droneSize],
  )

  const carQuery = useMemo(
    () => ({
      deviceId: carCode,
      startDate: carRange?.[0]?.format(DATE_FMT),
      endDate: carRange?.[1]?.format(DATE_FMT),
    }),
    [carCode, carRange],
  )

  const fetchCar = useCallback(async () => {
    // 走航车接口 deviceId 必传，未选择时静默跳过
    if (!carCode) return
    setCarLoading(true)
    try {
      const detail = await dataManageApi.mobileMonitorDetail(carQuery)
      setCarDetail(detail ?? null)
    } catch (err) {
      setCarDetail(null)
      message.error(err instanceof Error ? err.message : '走航任务加载失败')
    } finally {
      setCarLoading(false)
    }
  }, [carQuery, carCode, message])

  // 查询条件或页签变化时防抖自动查询（无需查询/重置按钮）
  useDebouncedQuery(activeTab === 'station', stationQuery, () => { void fetchStations(1, stationSize) })
  useDebouncedQuery(activeTab === 'mobile' && !!carCode, carQuery, () => { void fetchCar() })
  useDebouncedQuery(activeTab === 'drone', droneQuery, () => { void fetchDrone(1, droneSize) })

  /** 切换页签（数据加载由 useDebouncedQuery 按页签启用状态自动触发） */
  // 切页签：无人机机场列表在「用户点击切页签」时按需加载一次（不在 effect 内 setState）
  const loadDocks = useCallback(async () => {
    if (docks.length) return
    setDocksLoading(true)
    try {
      const res = await dockList(querySelection ? toRegionQuery(querySelection) : undefined)
      if (res?.resultCode === 0 && Array.isArray(res.data)) {
        setDocks((res.data as Record<string, unknown>[]).map(item => normalizeDock(item)))
      }
    } catch {
      setDocks([])
    } finally {
      setDocksLoading(false)
    }
  }, [docks.length, querySelection])

  const handleTabSwitch = (tab: TabKey) => {
    setActiveTab(tab)
    if (tab === 'drone' && !docks.length && !docksLoading) void loadDocks()
  }

  // ---------- 导出（全量，不带分页） ----------
  const handleExport = async (type: TabKey) => {
    const setExporting =
      type === 'station' ? setStationExporting : type === 'mobile' ? setCarExporting : setDroneExporting
    setExporting(true)
    try {
      let blob: unknown
      let filename: string
      if (type === 'station') {
        // deviceId 为空即导出全部设备（数据权限内）
        blob = await dataManageApi.airStationExport(stationQuery)
        filename = `微站数据_${stationDeviceId || '全部设备'}_${dayjsText()}.xlsx`
      } else if (type === 'mobile') {
        if (!carCode) {
          message.warning('请选择车辆编码')
          return
        }
        blob = await dataManageApi.mobileMonitorExport(carQuery)
        filename = `走航任务_${carCode}_${dayjsText()}.xlsx`
      } else {
        blob = await dataManageApi.droneTaskExport(droneQuery)
        filename = `无人机任务_${dayjsText()}.xlsx`
      }
      const file = blob as Blob
      if (await isJsonErrorBlob(file)) {
        message.error('导出失败')
        return
      }
      downloadBlob(file, filename)
      message.success('导出成功')
    } catch (err) {
      message.error(err instanceof Error ? err.message : '导出失败')
    } finally {
      setExporting(false)
    }
  }

  const handleDownloadTemplate = async () => {
    try {
      const blob = (await dataManageApi.droneTaskImportTemplate()) as unknown as Blob
      if (await isJsonErrorBlob(blob)) {
        message.error('模板下载失败')
        return
      }
      downloadBlob(blob, '无人机任务导入模板.xlsx')
    } catch {
      message.error('模板下载失败')
    }
  }

  const handleImport = async (file: File) => {
    setDroneImporting(true)
    try {
      const res = await dataManageApi.droneTaskImportData(file)
      const text = (res as unknown as { message?: string })?.message
      message.success(text || '导入成功')
      await fetchDrone(1, droneSize)
    } catch (err) {
      message.error(err instanceof Error ? err.message : '导入失败')
    } finally {
      setDroneImporting(false)
    }
  }

  // ---------- 表格列 ----------
  const stationColumns = [
    { title: '监测时间', dataIndex: 'dataTime', key: 'dataTime', width: 170 },
    {
      title: '数据级别',
      dataIndex: 'dataLevel',
      key: 'dataLevel',
      width: 110,
      align: 'center' as const,
      render: (v: AirDataLevel) => <Tag color={LEVEL_COLOR[v]}>{LEVEL_LABEL[v] ?? v}</Tag>,
    },
    {
      title: 'PM2.5(μg/m³)',
      dataIndex: 'pm25',
      key: 'pm25',
      width: 110,
      align: 'center' as const,
      render: (v: number | null) => fmt(v),
    },
    {
      title: 'PM10(μg/m³)',
      dataIndex: 'pm10',
      key: 'pm10',
      width: 110,
      align: 'center' as const,
      render: (v: number | null) => fmt(v),
    },
    {
      title: 'SO₂(μg/m³)',
      dataIndex: 'so2',
      key: 'so2',
      width: 110,
      align: 'center' as const,
      render: (v: number | null) => fmt(v),
    },
    {
      title: 'NO₂(μg/m³)',
      dataIndex: 'no2',
      key: 'no2',
      width: 110,
      align: 'center' as const,
      render: (v: number | null) => fmt(v),
    },
    {
      title: 'O₃(μg/m³)',
      dataIndex: 'o3',
      key: 'o3',
      width: 110,
      align: 'center' as const,
      render: (v: number | null) => fmt(v),
    },
    {
      title: 'CO(mg/m³)',
      dataIndex: 'co',
      key: 'co',
      width: 110,
      align: 'center' as const,
      render: (v: number | null) => fmt(v),
    },
    {
      title: 'VOCs(μg/m³)',
      dataIndex: 'vocs',
      key: 'vocs',
      width: 110,
      align: 'center' as const,
      render: (v: number | null) => fmt(v),
    },
    {
      title: 'TSP(μg/m³)',
      dataIndex: 'tsp',
      key: 'tsp',
      width: 110,
      align: 'center' as const,
      render: (v: number | null) => fmt(v),
    },
    {
      title: '温度(℃)',
      dataIndex: 'temperature',
      key: 'temperature',
      width: 90,
      align: 'center' as const,
      render: (v: number | null) => fmt(v),
    },
    {
      title: '湿度(%)',
      dataIndex: 'humidity',
      key: 'humidity',
      width: 90,
      align: 'center' as const,
      render: (v: number | null) => fmt(v),
    },
    {
      title: '气压(KPa)',
      dataIndex: 'pressure',
      key: 'pressure',
      width: 100,
      align: 'center' as const,
      render: (v: number | null) => fmt(v),
    },
    {
      title: '风速(m/s)',
      dataIndex: 'windSpeed',
      key: 'windSpeed',
      width: 100,
      align: 'center' as const,
      render: (v: number | null) => fmt(v),
    },
    {
      title: '风向(°)',
      dataIndex: 'windDirection',
      key: 'windDirection',
      width: 100,
      align: 'center' as const,
      render: (v: number | null) => fmt(v),
    },
    {
      title: '样本数',
      dataIndex: 'sampleCount',
      key: 'sampleCount',
      width: 90,
      align: 'center' as const,
      render: (v: number | null) => fmt(v),
    },
  ]

  const droneColumns = [
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
    {
      title: '失败原因',
      dataIndex: 'failReason',
      key: 'failReason',
      width: 180,
      render: (v: string) => v || '-',
    },
    { title: '创建人', dataIndex: 'createBy', key: 'createBy', width: 110 },
  ]

  /**
   * 走航任务表格数据：后端只返回有数据的日期数组，
   * 车辆编码/车辆名称在查询时已知，需逐行重复展示。
   */
  const carColumns = [
    { title: '车辆编码', dataIndex: 'mnCode', key: 'mnCode', width: 180 },
    { title: '车辆名称', dataIndex: 'mnName', key: 'mnName', width: 220 },
    { title: '数据日期', dataIndex: 'date', key: 'date', width: 180 },
  ]

  const carName = cars.find(c => c.deviceId === carCode)?.shortName
    || cars.find(c => c.deviceId === carCode)?.deviceName
    || carDetail?.mnName
    || '-'

  const carRows = (carDetail?.dataDates ?? []).map(d => ({
    date: d,
    mnCode: carDetail?.deviceId ?? carDetail?.mnCode ?? carCode ?? '-',
    mnName: carName,
  }))

  return (
    <div className="alert-page-container">
      <div className="alert-header-bar">
        <div className="header-left">
          {showBackToMonitor && (
            <Button
              type="text"
              icon={<ArrowLeftOutlined />}
              onClick={() => navigate('/monitor')}
              className="!text-[#03FBFD] hover:!text-white !px-2 !h-28px"
            >
              返回监控大屏
            </Button>
          )}
        </div>
      </div>

      {/* 标题 + Tabs 同一行，与 alert 页布局一致 */}
      <div className="alert-title-tabs-row">
        <div className="alert-center-title">
          <span className="title-diamond">◆</span>
          <span>数据管理</span>
          <span className="title-diamond">◆</span>
        </div>
        <div className="tech-tabs-bar">
          <div
            className={`tech-tab-item ${activeTab === 'station' ? 'active' : ''}`}
            onClick={() => handleTabSwitch('station')}
          >
            微站数据
          </div>
          <div
            className={`tech-tab-item ${activeTab === 'mobile' ? 'active' : ''}`}
            onClick={() => handleTabSwitch('mobile')}
          >
            走航任务
          </div>
          <div
            className={`tech-tab-item ${activeTab === 'drone' ? 'active' : ''}`}
            onClick={() => handleTabSwitch('drone')}
          >
            无人机任务
          </div>
        </div>
      </div>

      {/* ========== 微站数据 ========== */}
      {activeTab === 'station' && (
        <>
          <div className="flex items-center gap-3 flex-wrap flex-shrink-0 mb-2">
            <Select
              className="!w-260px model_from_sel"
              classNames={{ popup: { root: 'alert-rule-dropdown' } }}
              placeholder="全部设备"
              value={stationDeviceId || undefined}
              onChange={v => setStationDeviceId(v ?? '')}
              showSearch
              allowClear
              optionFilterProp="label"
              options={[
                { value: '', label: '全部设备' },
                ...stations.map(s => ({ value: s.deviceId, label: s.shortName || s.deviceName })),
              ]}
            />
            <div className="flex items-center gap-2">
              <span className="text-[#03FBFD] text-sm">数据级别：</span>
              {LEVEL_OPTIONS.map(opt => (
                <button
                  key={opt.value || 'all'}
                  onClick={() => setLevel(opt.value)}
                  className={`px-3 py-1 rounded text-sm transition-all ${
                    level === opt.value
                      ? 'bg-cyan-500/15 border border-cyan-400 text-[#03FBFD] font-semibold'
                      : 'bg-black/30 border border-cyan-500/30 text-white'
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
            <RangePicker
              showTime
              className="model_from_input"
              value={stationRange}
              onChange={v => setStationRange(v as [Dayjs, Dayjs] | null)}
              placeholder={['开始时间', '结束时间']}
              disabledDate={disabledFutureDate}
            />
            <div className="ml-auto flex items-center gap-3">
              <Button
                icon={<DownloadOutlined />}
                loading={stationExporting}
                onClick={() => handleExport('station')}
              >
                导出
              </Button>
            </div>
          </div>

          <div className="tech-table-wrapper">
            <Table
              dataSource={stationRows}
              columns={stationColumns}
              rowKey="id"
              size="small"
              loading={stationLoading}
              scroll={{ x: 'max-content' }}
              pagination={{
                current: stationPage,
                pageSize: stationSize,
                total: stationTotal,
                showSizeChanger: true,
                showTotal: total => `共 ${total} 条`,
                onChange: (page, size) => fetchStations(page, size),
              }}
            />
          </div>
        </>
      )}

      {/* ========== 走航任务 ========== */}
      {activeTab === 'mobile' && (
        <>
          <div className="flex items-center gap-3 flex-wrap flex-shrink-0 mb-2">
            <Select
              className="!w-260px model_from_sel"
              classNames={{ popup: { root: 'alert-rule-dropdown' } }}
              placeholder="选择车辆编码"
              value={carCode}
              onChange={setCarCode}
              showSearch
              optionFilterProp="label"
              options={cars.map(c => ({ value: c.deviceId, label: c.shortName || c.deviceName }))}
            />
            <RangePicker
              className="model_from_input"
              value={carRange}
              onChange={v => setCarRange(v as [Dayjs, Dayjs] | null)}
              placeholder={['开始日期', '结束日期']}
              disabledDate={disabledFutureDate}
            />
            <div className="ml-auto flex items-center gap-3">
              <Button icon={<DownloadOutlined />} loading={carExporting} onClick={() => handleExport('mobile')}>
                导出
              </Button>
            </div>
          </div>

          <div className="tech-table-wrapper">
            <Table
              dataSource={carRows}
              columns={carColumns}
              rowKey="date"
              size="small"
              loading={carLoading}
              pagination={false}
              locale={{ emptyText: carCode ? '该时间范围内暂无数据' : '请选择车辆编码后查询' }}
            />
          </div>
        </>
      )}

      {/* ========== 无人机任务 ========== */}
      {activeTab === 'drone' && (
        <>
          <div className="flex items-center gap-3 flex-wrap flex-shrink-0 mb-2">
            <Select
              className="!w-260px model_from_sel"
              classNames={{ popup: { root: 'alert-rule-dropdown' } }}
              placeholder="全部机场"
              value={droneDockCode || undefined}
              onChange={v => setDroneDockCode(v ?? '')}
              showSearch
              allowClear
              optionFilterProp="label"
              loading={docksLoading}
              notFoundContent={docksLoading ? undefined : '当前数据权限内暂无机场'}
              options={[
                { value: '', label: '全部机场' },
                ...docks.map(d => ({
                  value: d.dockCode,
                  label: `${d.dockName}（${d.dockCode}）`,
                })),
              ]}
            />
            <Input
              className="model_from_input !w-180px"
              placeholder="任务名称（模糊）"
              value={droneTaskName}
              onChange={e => setDroneTaskName(e.target.value)}
              allowClear
            />
            <Select
              className="!w-130px model_from_sel"
              classNames={{ popup: { root: 'alert-rule-dropdown' } }}
              placeholder="任务状态"
              value={droneStatus}
              onChange={setDroneStatus}
              allowClear
              options={TASK_STATUS_OPTIONS}
            />
            <Checkbox
              checked={includeThirdParty}
              onChange={e => setIncludeThirdParty(e.target.checked)}
              className="text-white whitespace-nowrap"
            >
              包含第三方数据
            </Checkbox>
            <RangePicker
              showTime
              className="model_from_input"
              value={droneRange}
              onChange={v => setDroneRange(v as [Dayjs, Dayjs] | null)}
              placeholder={['开始时间', '结束时间']}
              disabledDate={disabledFutureDate}
            />
            <div className="ml-auto flex items-center gap-3">
              <Button icon={<DownloadOutlined />} loading={droneExporting} onClick={() => handleExport('drone')}>
                导出
              </Button>
              <Button icon={<DownloadOutlined />} onClick={handleDownloadTemplate}>
                下载模板
              </Button>
              <Upload
                beforeUpload={file => {
                  handleImport(file)
                  return false
                }}
                showUploadList={false}
                accept=".xlsx,.xls"
              >
                <Button icon={<UploadOutlined />} loading={droneImporting}>
                  导入
                </Button>
              </Upload>
            </div>
          </div>

          <div className="tech-table-wrapper">
            <Table
              dataSource={droneRows}
              columns={droneColumns}
              rowKey="taskId"
              size="small"
              loading={droneLoading}
              scroll={{ x: 1320 }}
              pagination={{
                current: dronePage,
                pageSize: droneSize,
                total: droneTotal,
                showSizeChanger: true,
                showTotal: total => `共 ${total} 条`,
                onChange: (page, size) => fetchDrone(page, size),
              }}
            />
          </div>
        </>
      )}
    </div>
  )
}

/** 导出文件名时间戳 */
function dayjsText() {
  const d = new Date()
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}${pad(d.getHours())}${pad(d.getMinutes())}`
}

import { useCallback, useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { App, Button, Checkbox, DatePicker, Input, Select, Table, Upload } from 'antd'
import { ArrowLeftOutlined, DownloadOutlined, UploadOutlined } from '@ant-design/icons'
import { type Dayjs } from 'dayjs'
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
  DroneTaskStatus,
  DroneTaskVO,
  MobileMonitorDetailVO,
} from '@/types/dataManage'
import type { DataSourceDTO } from '@/types/business'
import {
  type TabKey,
  DATE_FMT,
  DATE_TIME_FMT,
  LEVEL_OPTIONS,
  TASK_STATUS_OPTIONS,
  defaultDayRange,
  downloadBlob,
  isJsonErrorBlob,
  useDebouncedQuery,
} from './shared'
import { buildCarRows, carColumns, droneColumns, stationColumns } from './columns'

const { RangePicker } = DatePicker

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

  // ---------- 表格列（已抽到 ./columns） ----------
  const carName = cars.find(c => c.deviceId === carCode)?.shortName
    || cars.find(c => c.deviceId === carCode)?.deviceName
    || carDetail?.mnName
    || '-'

  const carRows = buildCarRows(carDetail, carCode, carName)

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

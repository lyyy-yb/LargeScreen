import { Input, Select, Switch, Table, DatePicker } from 'antd'
import type { TableColumnsType } from 'antd'
import type { Dayjs } from 'dayjs'
import AlertLevelBadge from '@/components/AlertLevelBadge'
import { disabledFutureDate } from '@/utils/helpers'
import { DATA_TYPE_OPTIONS, ALERT_LEVEL_OPTIONS } from './shared/tabConstants'
import type { AlertEvent } from '../modals/AlertDetailModal'

const { RangePicker } = DatePicker

export interface AlertTabHandlers {
  onOpenDetail: (r: AlertEvent) => void
  onOpenDispatch: (r: AlertEvent) => void
  onConfirm: (id: string) => void
  onReturn: (id: string) => void
  onClear: (id: string) => void
  onDelete: (id: string) => void
  onApplySearch: (v?: string) => void
}

export interface AlertTabProps {
  // 数据
  alerts: AlertEvent[]
  loading: boolean
  // 分页
  page: number
  size: number
  total: number
  setPage: (n: number) => void
  setSize: (n: number) => void
  // 搜索
  searchDevice: string
  setSearchDevice: (s: string) => void
  appliedDevice: string
  // 筛选
  filterDataType: string | undefined
  setFilterDataType: (v: string | undefined) => void
  filterLevel: string | undefined
  setFilterLevel: (v: string | undefined) => void
  filterStatus: string | undefined
  setFilterStatus: (v: string | undefined) => void
  includeHistory: boolean
  setIncludeHistory: (v: boolean) => void
  timeRange: [Dayjs | null, Dayjs | null] | null
  setTimeRange: (r: [Dayjs | null, Dayjs | null] | null) => void
  // 展示用上下文
  isTown: boolean
  selectionCityName?: string
  // handler
  handlers: AlertTabHandlers
}

export default function AlertTab({
  alerts,
  loading,
  page,
  size,
  total,
  setPage,
  setSize,
  searchDevice,
  setSearchDevice,
  filterDataType,
  setFilterDataType,
  filterLevel,
  setFilterLevel,
  filterStatus,
  setFilterStatus,
  includeHistory,
  setIncludeHistory,
  timeRange,
  setTimeRange,
  isTown,
  handlers,
}: AlertTabProps) {
  const alertCols: TableColumnsType<AlertEvent> = [
    { title: '预警ID', dataIndex: 'id', width: 70 },
    { title: '规则名称', dataIndex: 'ruleName', width: 160 },
    {
      title: '预警级别',
      dataIndex: 'alertLevel',
      width: 95,
      render: (level: string) => <AlertLevelBadge level={level} />,
    },
    { title: '设备名称', dataIndex: 'deviceName', width: 120 },
    { title: '监测位置', dataIndex: 'location', width: 110 },
    {
      title: '处置状态',
      dataIndex: 'status',
      width: 85,
      render: (t: string) => {
        const m: Record<string, { l: string; cls: string }> = {
          undispatched: { l: '待派发', cls: 'status-pending' },
          pending: { l: '待处置', cls: 'status-pending' },
          processing: { l: '处置中', cls: 'status-processing' },
          completed: { l: '已处置', cls: 'status-completed' },
          closed: { l: '已关闭', cls: 'status-default' },
          cleared: { l: '已清除', cls: 'status-default' },
        }
        const item = m[t] || { l: t || '未知', cls: 'status-default' }
        return <span className={`pill-badge ${item.cls}`}>{item.l}</span>
      },
    },
    { title: '预警时间', dataIndex: 'createdAt', width: 150 },
    {
      title: '操作',
      width: isTown ? 80 : 200,
      align: 'center' as const,
      render: (_: unknown, r: AlertEvent) => (
        <div className="flex items-center gap-1.5 justify-center whitespace-nowrap">
          <button
            type="button"
            className="tech-action-btn btn-detail"
            onClick={() => handlers.onOpenDetail(r)}
          >
            详情
          </button>
          {!isTown && r.status === 'undispatched' && (
            <>
              <button
                type="button"
                className="tech-action-btn btn-dispatch"
                onClick={() => handlers.onOpenDispatch(r)}
              >
                派发
              </button>
              <button
                type="button"
                className="tech-action-btn btn-danger"
                onClick={() => handlers.onClear(r.id)}
              >
                清除
              </button>
            </>
          )}
          {!isTown && r.status === 'completed' && (
            <>
              <button
                type="button"
                className="tech-action-btn btn-success"
                onClick={() => handlers.onConfirm(r.id)}
              >
                确认
              </button>
              <button
                type="button"
                className="tech-action-btn btn-dispatch"
                onClick={() => handlers.onReturn(r.id)}
              >
                退回
              </button>
            </>
          )}
          {!isTown && (r.status === 'closed' || r.status === 'completed' || r.status === 'cleared') && (
            <button
              type="button"
              className="tech-action-btn btn-danger"
              onClick={() => handlers.onDelete(r.id)}
            >
              删除
            </button>
          )}
        </div>
      ),
    },
  ]

  return (
    <>
      {/* 筛选行：搜索框 300ms 防抖（防抖由父组件 useDebounce 接管）；Select / RangePicker / Switch 即时触发 */}
      <div className="flex items-center gap-3 flex-shrink-0 px-2 pt-2 pb-2">
        <Input
          className="model_from_input !w-200px"
          placeholder="搜索设备/数据源名称"
          value={searchDevice}
          onChange={(e) => setSearchDevice(e.target.value)}
          allowClear
        />
        <Select
          className="!w-150px model_from_sel"
          classNames={{ popup: { root: 'alert-rule-dropdown' } }}
          placeholder="筛选接入类型"
          value={filterDataType}
          onChange={(v) => {
            setFilterDataType(v)
            setPage(1)
          }}
          options={DATA_TYPE_OPTIONS}
          allowClear
        />
        <Select
          className="!w-140px model_from_sel"
          classNames={{ popup: { root: 'alert-rule-dropdown' } }}
          placeholder="筛选预警级别"
          value={filterLevel}
          onChange={(v) => {
            setFilterLevel(v)
            setPage(1)
          }}
          options={ALERT_LEVEL_OPTIONS}
          allowClear
        />
        <Select
          className="!w-140px model_from_sel"
          classNames={{ popup: { root: 'alert-rule-dropdown' } }}
          placeholder="筛选处置状态"
          value={filterStatus}
          onChange={(v) => {
            setFilterStatus(v)
            setPage(1)
          }}
          options={[
            { value: 'undispatched', label: '待派发' },
            { value: 'pending', label: '待处置' },
            { value: 'processing', label: '处置中' },
            { value: 'completed', label: '已处置' },
          ]}
          allowClear
        />
        <div className="flex items-center gap-1.5">
          <span className="text-12px text-white/60 whitespace-nowrap">历史预警</span>
          <Switch
            size="small"
            className="tech-switch"
            checked={includeHistory}
            onChange={(v) => {
              setIncludeHistory(v)
              setPage(1)
            }}
          />
        </div>
        <RangePicker
          className="model_from_input !w-320px"
          classNames={{ popup: { root: 'alert-rule-dropdown' } }}
          showTime
          format="YYYY-MM-DD HH:mm:ss"
          placeholder={['预警开始时间', '预警结束时间']}
          value={timeRange}
          onChange={(v) => {
            setTimeRange(v)
            setPage(1)
          }}
          allowClear
          disabledDate={disabledFutureDate}
        />
      </div>

      {/* 表格 */}
      <Table
        dataSource={alerts}
        columns={alertCols}
        rowKey="id"
        loading={loading}
        pagination={{
          current: page,
          pageSize: size,
          total,
          showSizeChanger: true,
          onChange: (p, s) => {
            setPage(p)
            setSize(s)
          },
        }}
        size="small"
      />
    </>
  )
}

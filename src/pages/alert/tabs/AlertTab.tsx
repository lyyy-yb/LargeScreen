import { Button, Input, Select, Switch, Table, DatePicker } from 'antd'
import type { TableColumnsType } from 'antd'
import type { Dayjs } from 'dayjs'
import {
  CheckCircleOutlined,
  SendOutlined,
  EyeOutlined,
  DeleteOutlined,
  RollbackOutlined,
  SearchOutlined,
  AlertFilled,
} from '@ant-design/icons'
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
      width: 90,
      render: (t: string) => {
        const item = ALERT_LEVEL_OPTIONS.find((o) => o.value === t) || {
          label: '二级预警',
          color: '#FA8C16',
        }
        return (
          <span className="flex items-center gap-1 font-semibold" style={{ color: item.color }}>
            <AlertFilled style={{ color: item.color, fontSize: 13 }} />
            {item.label}
          </span>
        )
      },
    },
    { title: '设备名称', dataIndex: 'deviceName', width: 120 },
    { title: '监测位置', dataIndex: 'location', width: 110 },
    {
      title: '处置状态',
      dataIndex: 'status',
      width: 80,
      render: (t: string) => {
        const m: Record<string, { l: string; c: string }> = {
          undispatched: { l: '待派发', c: 'gold' },
          pending: { l: '待处置', c: 'orange' },
          processing: { l: '处置中', c: 'blue' },
          completed: { l: '已处置', c: 'green' },
          closed: { l: '已关闭', c: 'default' },
          cleared: { l: '已清除', c: 'default' },
        }
        return <span style={{ color: m[t]?.c === 'default' ? 'rgba(255,255,255,0.45)' : undefined }}>{m[t]?.l}</span>
      },
    },
    { title: '预警时间', dataIndex: 'createdAt', width: 150 },
    {
      title: '操作',
      width: isTown ? 70 : 160,
      fixed: 'right' as const,
      render: (_: unknown, r: AlertEvent) => (
        <div className="flex items-center gap-1 whitespace-nowrap">
          <Button
            type="link"
            size="small"
            icon={<EyeOutlined />}
            className="!text-[#03FBFD] hover:!text-white !p-0"
            onClick={() => handlers.onOpenDetail(r)}
          >
            详情
          </Button>
          {!isTown && r.status === 'undispatched' && (
            <>
              <Button
                type="link"
                size="small"
                icon={<SendOutlined />}
                className="!text-[#1890FF] hover:!text-blue-300 !p-0"
                onClick={() => handlers.onOpenDispatch(r)}
              >
                派发
              </Button>
              <Button
                type="link"
                size="small"
                danger
                icon={<DeleteOutlined />}
                className="!p-0"
                onClick={() => handlers.onClear(r.id)}
              >
                清除
              </Button>
            </>
          )}
          {!isTown && r.status === 'completed' && (
            <>
              <Button
                type="link"
                size="small"
                icon={<CheckCircleOutlined />}
                className="!text-[#52C41A] hover:!text-green-300 !p-0"
                onClick={() => handlers.onConfirm(r.id)}
              >
                确认
              </Button>
              <Button
                type="link"
                size="small"
                icon={<RollbackOutlined />}
                className="!text-[#FA8C16] hover:!text-orange-300 !p-0"
                onClick={() => handlers.onReturn(r.id)}
              >
                退回
              </Button>
            </>
          )}
          {!isTown && (r.status === 'closed' || r.status === 'completed' || r.status === 'cleared') && (
            <Button
              type="link"
              size="small"
              danger
              icon={<DeleteOutlined />}
              className="!p-0"
              onClick={() => handlers.onDelete(r.id)}
            >
              删除
            </Button>
          )}
        </div>
      ),
    },
  ]

  return (
    <>
      {/* 筛选行 */}
      <div className="flex items-center gap-3 flex-shrink-0 px-2 pt-2">
        <Input
          className="model_from_input !w-200px"
          placeholder="搜索设备/数据源名称"
          value={searchDevice}
          onChange={(e) => setSearchDevice(e.target.value)}
          onPressEnter={() => handlers.onApplySearch()}
          allowClear
          onClear={() => handlers.onApplySearch('')}
          suffix={
            <SearchOutlined
              className="text-[#03FBFD] cursor-pointer"
              onClick={() => handlers.onApplySearch()}
            />
          }
        />
        <Select
          className="!w-160px model_from_sel"
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
          className="!w-150px model_from_sel"
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
          className="!w-150px model_from_sel"
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
          className="model_from_input !w-340px"
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
        scroll={{ x: 950 }}
      />
    </>
  )
}

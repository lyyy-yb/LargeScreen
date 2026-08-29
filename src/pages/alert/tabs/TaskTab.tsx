import { Button, Select, Table, Tag } from 'antd'
import type { TableColumnsType } from 'antd'
import {
  EyeOutlined,
  EditOutlined,
  CheckCircleOutlined,
  SendOutlined,
  RollbackOutlined,
  DeleteOutlined,
} from '@ant-design/icons'
import { DATA_TYPE_OPTIONS, TASK_TYPE_OPTIONS, TASK_STATUS_LABEL_MAP } from './shared/tabConstants'
import type { DisposalTask } from '../modals/TaskDetailModal'

export interface TaskTabHandlers {
  onOpenDetail: (r: DisposalTask) => void
  onUpdateStatus: (id: string, status: string) => void
  onOpenCommit: (r: DisposalTask) => void
  onDispatchToTown: (r: DisposalTask) => void
  onConfirm: (alertId: string) => void
  onReturn: (alertId: string) => void
  onOpenDisposalView: (r: DisposalTask) => void
  onDelete: (id: string) => void
}

export interface TaskTabProps {
  tasks: DisposalTask[]
  loading: boolean
  page: number
  size: number
  total: number
  setPage: (n: number) => void
  setSize: (n: number) => void
  // 筛选
  filterDataType: string | undefined
  setFilterDataType: (v: string | undefined) => void
  filterType: string | undefined
  setFilterType: (v: string | undefined) => void
  filterStatus: string | undefined
  setFilterStatus: (v: string | undefined) => void
  // 上下文
  isTown: boolean
  handlers: TaskTabHandlers
}

export default function TaskTab({
  tasks,
  loading,
  page,
  size,
  total,
  setPage,
  setSize,
  filterDataType,
  setFilterDataType,
  filterType,
  setFilterType,
  filterStatus,
  setFilterStatus,
  isTown,
  handlers,
}: TaskTabProps) {
  const taskCols: TableColumnsType<DisposalTask> = [
    { title: '任务ID', dataIndex: 'id', width: 70 },
    { title: '关联预警', dataIndex: 'alertId', width: 80 },
    {
      title: '任务类型',
      dataIndex: 'taskType',
      width: 90,
      render: (t: string) => TASK_TYPE_OPTIONS.find((o) => o.value === t)?.label || t,
    },
    {
      title: '状态',
      dataIndex: 'status',
      width: 80,
      render: (t: string) => {
        const m = TASK_STATUS_LABEL_MAP[t]
        return <Tag color={m?.color ?? 'default'}>{m?.label ?? t}</Tag>
      },
    },
    { title: '处置人', dataIndex: 'assigneeName', width: 80, render: (t: string) => t || '未分配' },
    { title: '要求时间', dataIndex: 'requireTime', width: 150 },
    {
      title: '操作',
      width: 210,
      fixed: 'right' as const,
      render: (_: unknown, r: DisposalTask) => (
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
          {!isTown && r.status === 'pending' && (
            <Button
              type="link"
              size="small"
              icon={<CheckCircleOutlined />}
              className="!text-[#52C41A] hover:!text-green-300 !p-0"
              onClick={() => handlers.onUpdateStatus(r.id, 'processing')}
            >
              接收
            </Button>
          )}
          {!isTown && r.status === 'processing' && (
            <>
              <Button
                type="link"
                size="small"
                icon={<EditOutlined />}
                className="!text-[#1890FF] hover:!text-blue-300 !p-0"
                onClick={() => handlers.onOpenCommit(r)}
              >
                处置
              </Button>
              <Button
                type="link"
                size="small"
                icon={<SendOutlined />}
                className="!text-[#FA8C16] hover:!text-orange-300 !p-0"
                onClick={() => handlers.onDispatchToTown(r)}
              >
                下派
              </Button>
            </>
          )}
          {!isTown && r.status === 'committed' && (
            <>
              <Button
                type="link"
                size="small"
                icon={<CheckCircleOutlined />}
                className="!text-[#52C41A] hover:!text-green-300 !p-0"
                onClick={() => handlers.onConfirm(r.alertId)}
              >
                确认
              </Button>
              <Button
                type="link"
                size="small"
                icon={<RollbackOutlined />}
                className="!text-[#FA8C16] hover:!text-orange-300 !p-0"
                onClick={() => handlers.onReturn(r.alertId)}
              >
                退回
              </Button>
            </>
          )}
          {(r.status === 'committed' || r.status === 'completed') && r.disposalContent && (
            <Button
              type="link"
              size="small"
              icon={<EyeOutlined />}
              className="!text-[#03FBFD] hover:!text-white !p-0"
              onClick={() => handlers.onOpenDisposalView(r)}
            >
              查看
            </Button>
          )}
          {!isTown && r.status === 'completed' && (
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
          className="!w-160px model_from_sel"
          classNames={{ popup: { root: 'alert-rule-dropdown' } }}
          placeholder="筛选任务类型"
          value={filterType}
          onChange={(v) => {
            setFilterType(v)
            setPage(1)
          }}
          options={TASK_TYPE_OPTIONS}
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
            { value: 'pending', label: '待接收' },
            { value: 'processing', label: '处置中' },
            { value: 'committed', label: '已提交' },
            { value: 'completed', label: '已完成' },
          ]}
          allowClear
        />
      </div>

      {/* 表格 */}
      <Table
        dataSource={tasks}
        columns={taskCols}
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
        scroll={{ x: 900 }}
      />
    </>
  )
}

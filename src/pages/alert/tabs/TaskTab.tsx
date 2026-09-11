import { Button, Select, Table } from 'antd'
import type { TableColumnsType } from 'antd'
import { DATA_TYPE_OPTIONS, TASK_TYPE_OPTIONS } from './shared/tabConstants'
import type { DisposalTask } from '../modals/TaskDetailModal'

export interface TaskTabHandlers {
  onOpenDetail: (r: DisposalTask) => void
  onOpenFollowUp: (r: DisposalTask) => void
  onUpdateStatus: (id: string, status: string) => void
  onOpenCommit: (r: DisposalTask) => void
  onDispatchToTown: (r: DisposalTask) => void
  onConfirm: (alertId: string) => void
  onReturn: (alertId: string) => void
  onDelete: (id: string) => void
}

export interface TaskTabProps {
  tasks: DisposalTask[]
  loading: boolean
  refreshing: boolean
  onRefresh: () => void
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
  refreshing,
  onRefresh,
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
      width: 90,
      render: (t: string) => {
        const m: Record<string, { l: string; cls: string }> = {
          pending: { l: '待接收', cls: 'status-pending' },
          processing: { l: '处置中', cls: 'status-processing' },
          committed: { l: '已提交', cls: 'status-processing' },
          completed: { l: '已完成', cls: 'status-completed' },
          inspecting: { l: '现场核查中', cls: 'status-inspecting' },
        }
        const item = m[t] || { l: t || '未知', cls: 'status-default' }
        return <span className={`pill-badge ${item.cls}`}>{item.l}</span>
      },
    },
    { title: '处置人', dataIndex: 'assigneeName', width: 90, render: (t: string) => t || '未分配' },
    {
      title: '要求时间',
      dataIndex: 'requireTime',
      width: 160,
      render: (t: string, r: DisposalTask) => {
        if (!t) return '-'
        // 如果超期且未完成，突出警告提示（对标图二红字警告）
        const isOverdue = r.status !== 'completed' && new Date(t).getTime() < Date.now()
        if (isOverdue) {
          return (
            <span className="text-[#ff4d4f] flex items-center gap-1 font-mono text-12px">
              <span className="font-bold">⚠</span>
              {t}
            </span>
          )
        }
        return <span className="text-[#c2e5ff] font-mono text-12px">{t}</span>
      },
    },
    {
      title: '操作',
      width: 290,
      align: 'center' as const,
      render: (_: unknown, r: DisposalTask) => (
        <div className="flex items-center gap-1.5 justify-center whitespace-nowrap">
          <button
            type="button"
            className="tech-action-btn btn-detail"
            onClick={() => handlers.onOpenDetail(r)}
          >
            详情
          </button>
          {r.status === 'completed' && (
            <button type="button" className="tech-action-btn btn-dispatch" onClick={() => handlers.onOpenFollowUp(r)}>后续处置</button>
          )}
          {!isTown && r.status === 'pending' && (
            <button
              type="button"
              className="tech-action-btn btn-receive"
              onClick={() => handlers.onUpdateStatus(r.id, 'processing')}
            >
              接收
            </button>
          )}
          {!isTown && r.status === 'processing' && (
            <>
              <button
                type="button"
                className="tech-action-btn btn-detail"
                onClick={() => handlers.onOpenCommit(r)}
              >
                处置
              </button>
              <button
                type="button"
                className="tech-action-btn btn-dispatch"
                onClick={() => handlers.onDispatchToTown(r)}
              >
                下派
              </button>
            </>
          )}
          {!isTown && r.status === 'committed' && (
            <>
              <button
                type="button"
                className="tech-action-btn btn-success"
                onClick={() => handlers.onConfirm(r.alertId)}
              >
                确认
              </button>
              <button
                type="button"
                className="tech-action-btn btn-dispatch"
                onClick={() => handlers.onReturn(r.alertId)}
              >
                退回
              </button>
            </>
          )}
          {!isTown && r.status === 'completed' && (
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
      {/* 筛选行 */}
      <div className="flex items-center gap-3 flex-shrink-0 px-2 pt-2 pb-2">
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
        <Button type="primary" className="alert-refresh-button !ml-auto flex-shrink-0" disabled={refreshing} onClick={onRefresh}>{refreshing ? '刷新中…' : '刷新'}</Button>
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
      />
    </>
  )
}

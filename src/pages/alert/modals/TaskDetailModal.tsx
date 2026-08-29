import { Modal } from 'antd'

export interface DisposalTask {
  id: string
  alertId: string
  dataType: string
  taskType: string
  status: string
  assigneeName: string
  requesterName: string
  requireTime: string
  createdAt: string
  disposalContent?: string
  photos?: string[]
  completedAt?: string
  cityId?: number
  districtId?: number
  townId?: number
}

export interface SelectOption {
  value: string
  label: string
}

type DeptNameLookup = (deptId?: number) => string | undefined

interface TaskDetailModalProps {
  open: boolean
  task: DisposalTask | null
  onClose: () => void
  /** 用于 "所属区域" 字段拼接（由主文件 useCallback 提供） */
  deptNameOf: DeptNameLookup
  dataTypeOptions: SelectOption[]
  taskTypeOptions: SelectOption[]
}

const taskStatusText = (status: string): string =>
  (
    {
      pending: '待接收',
      processing: '处置中',
      committed: '已提交',
      completed: '已完成',
    } as Record<string, string>
  )[status] ?? status

const taskRegionOf = (task: DisposalTask, deptNameOf: DeptNameLookup) =>
  [deptNameOf(task.cityId), deptNameOf(task.districtId), deptNameOf(task.townId)]
    .filter(Boolean)
    .join(' / ') || '—'

export default function TaskDetailModal({
  open,
  task,
  onClose,
  deptNameOf,
  dataTypeOptions,
  taskTypeOptions,
}: TaskDetailModalProps) {
  return (
    <Modal
      title={<span className="text-[#03FBFD] font-bold">任务详情</span>}
      open={open}
      onCancel={onClose}
      width={550}
      footer={null}
      styles={{ body: { padding: '20px 24px' } }}
    >
      {task && (
        <div
          className="space-y-2 p-3 rounded"
          style={{ backgroundColor: 'rgba(3,251,253,0.05)', border: '1px solid rgba(3,251,253,0.15)' }}
        >
          {(
            [
              ['任务ID', task.id],
              ['关联预警', task.alertId],
              ['接入类型', dataTypeOptions.find((o) => o.value === task.dataType)?.label || task.dataType],
              ['任务类型', taskTypeOptions.find((o) => o.value === task.taskType)?.label || ''],
              ['状态', taskStatusText(task.status)],
              ['处置人', task.assigneeName || '未分配'],
              ['派发人', task.requesterName],
              ['所属区域', taskRegionOf(task, deptNameOf)],
              ['要求时间', task.requireTime],
              ['创建时间', task.createdAt],
              ...(task.completedAt ? [['完成时间', task.completedAt]] : []),
            ] as const
          ).map(([k, v]) => (
            <div key={k} className="flex justify-between">
              <span className="text-[#03FBFD]">{k}</span>
              <span className="text-white/75 text-right max-w-[62%]">{v}</span>
            </div>
          ))}
          {task.disposalContent && (
            <div className="mt-2 pt-2" style={{ borderTop: '1px solid rgba(3,251,253,0.15)' }}>
              <span className="text-[#03FBFD] block mb-1">处置内容</span>
              <p className="text-white/75">{task.disposalContent}</p>
            </div>
          )}
        </div>
      )}
    </Modal>
  )
}

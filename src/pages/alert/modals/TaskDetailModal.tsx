import { useEffect, useState } from 'react'
import { Alert, Button, Modal, Spin, Tag } from 'antd'
import { disposalTaskApi } from '@/servers/business'
import { requireSuccess } from '@/servers/alertFollowUp'
import type { DisposalVerificationDTO } from '@/types/business'
import { normalizePhotos } from '../data/normalizePhotos'
import EvidenceSections from '../components/EvidenceSections'
import FollowUpRecords from '../components/FollowUpRecords'
import { DetailGrid, LinkedAlert, TaskResult } from '../components/DetailSections'
import { TASK_STATUS_LABEL_MAP } from '../tabs/shared/tabConstants'

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
  verificationResult?: string
  verifications?: DisposalVerificationDTO[] | null
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

export default function TaskDetailModal({ open, task, onClose, deptNameOf, dataTypeOptions, taskTypeOptions }: TaskDetailModalProps) {
  return <Modal title="任务详情" open={open} onCancel={onClose} width={760} footer={null}
    className="alert-evidence-modal evidence-fullscreen-modal" destroyOnHidden>
    {open && task && <TaskDetailContent key={task.id} taskId={task.id} deptNameOf={deptNameOf}
      dataTypeOptions={dataTypeOptions} taskTypeOptions={taskTypeOptions} />}
  </Modal>
}

function TaskDetailContent({ taskId, deptNameOf, dataTypeOptions, taskTypeOptions }: {
  taskId: string
} & Pick<TaskDetailModalProps, 'deptNameOf' | 'dataTypeOptions' | 'taskTypeOptions'>) {
  const [task, setTask] = useState<DisposalTask | null>(null)
  const [error, setError] = useState('')
  const [revision, setRevision] = useState(0)
  useEffect(() => {
    let active = true
    disposalTaskApi.detail(Number(taskId)).then(requireSuccess).then(data => {
      if (!data) throw new Error('任务不存在或已删除')
      if (active) setTask({ ...data, id: String(data.id), alertId: String(data.alertId),
        assigneeName: data.assigneeName || '', requesterName: data.requesterName || '',
        requireTime: data.requireTime || '', createdAt: data.createTime || '', photos: normalizePhotos(data.photos) })
    }).catch(err => { if (active) setError(err instanceof Error ? err.message : '任务详情加载失败') })
    return () => { active = false }
  }, [taskId, revision])
  if (error) return <Alert type="error" title={error} action={<Button onClick={() => { setError(''); setRevision(value => value + 1) }}>重试</Button>} />
  if (!task) return <Spin />
  const status = task ? TASK_STATUS_LABEL_MAP[task.status] : undefined
  return <div>
      <section className="evidence-section"><h3>基础信息</h3>
        <DetailGrid items={[
          ['任务 ID', task.id], ['关联预警', task.alertId], ['状态', <Tag color={status?.color}>{status?.label || task.status}</Tag>],
          ['接入类型', dataTypeOptions.find(item => item.value === task.dataType)?.label || task.dataType],
          ['任务类型', taskTypeOptions.find(item => item.value === task.taskType)?.label || task.taskType],
          ['处置人', task.assigneeName || '未分配'], ['派发人', task.requesterName],
          ['所属区域', [deptNameOf(task.cityId), deptNameOf(task.districtId), deptNameOf(task.townId)].filter(Boolean).join(' / ')],
          ['创建时间', task.createdAt], ['要求完成时间', task.requireTime], ['完成时间', task.completedAt],
        ]} />
      </section>
      <LinkedAlert alertId={task.alertId} />
      <EvidenceSections alertId={task.alertId} />
      <section className="evidence-section"><h3>现场核查结果</h3><TaskResult task={task} deptNameOf={deptNameOf} /></section>
      <FollowUpRecords alertId={task.alertId} />
    </div>
}

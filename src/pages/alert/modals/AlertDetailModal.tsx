import { Modal, Tag } from 'antd'

export interface AlertEvent {
  id: string
  ruleName: string
  alertLevel: string
  dataType: string
  deviceName: string
  location: string
  triggerReason: string
  createdAt: string
  /** 状态（undispatched/pending/processing/committed/completed/closed/cleared） */
  status: string
  /** 区域部门 ID（后端不再返回名称，展示时用部门树反查） */
  cityId?: number
  districtId?: number
  townId?: number
  assignedCity?: string
}

export interface AlertLevelOption {
  value: string
  label: string
  color?: string
}

interface AlertDetailModalProps {
  open: boolean
  alert: AlertEvent | null
  onClose: () => void
  alertLevelOptions: AlertLevelOption[]
}

export default function AlertDetailModal({
  open,
  alert,
  onClose,
  alertLevelOptions,
}: AlertDetailModalProps) {
  const level = alert ? alertLevelOptions.find((o) => o.value === alert.alertLevel) : null
  return (
    <Modal
      title={<span className="text-[#03FBFD] font-bold">预警详情</span>}
      open={open}
      onCancel={onClose}
      width={550}
      footer={null}
      styles={{ body: { padding: '20px 24px' } }}
    >
      {alert && (
        <div
          className="space-y-2 p-3 rounded"
          style={{ backgroundColor: 'rgba(3,251,253,0.05)', border: '1px solid rgba(3,251,253,0.15)' }}
        >
          {(
            [
              ['预警ID', alert.id],
              ['规则', alert.ruleName],
              ['设备', alert.deviceName],
              ['位置', alert.location],
              ['时间', alert.createdAt],
              ['原因', alert.triggerReason],
            ] as const
          ).map(([k, v]) => (
            <div key={k} className="flex justify-between">
              <span className="text-[#03FBFD]">{k}</span>
              <span className="text-white/75 text-right max-w-[60%]">{v}</span>
            </div>
          ))}
          <div className="flex justify-between">
            <span className="text-[#03FBFD]">级别</span>
            <Tag color={level?.color}>{level?.label}</Tag>
          </div>
        </div>
      )}
    </Modal>
  )
}

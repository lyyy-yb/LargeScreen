import { Modal, Tag } from 'antd'
import EvidenceSections from '../components/EvidenceSections'
import FollowUpRecords from '../components/FollowUpRecords'
import { AlertFacts, AlertTaskResults } from '../components/DetailSections'
import { ALERT_STATUS_LABEL_MAP, ALERT_STATUS_COLOR_MAP } from '../tabs/shared/tabConstants'

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
  deptNameOf?: (id?: number) => string | undefined
}

export default function AlertDetailModal({ open, alert, onClose, deptNameOf }: AlertDetailModalProps) {
  return <Modal title={<span>预警详情 {alert && <Tag color={ALERT_STATUS_COLOR_MAP[alert.status]}>{ALERT_STATUS_LABEL_MAP[alert.status] || alert.status}</Tag>}</span>}
    open={open} onCancel={onClose} width={760} footer={null} className="alert-evidence-modal evidence-fullscreen-modal" destroyOnHidden>
    {open && alert && <div key={alert.id}>
      <section className="evidence-section"><h3>基础信息</h3><AlertFacts alert={alert} /></section>
      <EvidenceSections alertId={alert.id} />
      <AlertTaskResults alert={alert} deptNameOf={deptNameOf} />
      <FollowUpRecords alertId={alert.id} />
    </div>}
  </Modal>
}

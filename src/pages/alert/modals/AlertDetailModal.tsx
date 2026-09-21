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
  /**
   * 跨平台免登录 deep-link 模式：
   *   - 弹窗最大化（100vw × 100dvh，无圆角）
   *   - 隐藏右上角 X 关闭按钮（仍可 Esc / 点遮罩关闭）
   * 默认 false：保留原 90vw × 96dvh + 显示 X 的常规体验
   */
  nologinMode?: boolean
}

export default function AlertDetailModal({ open, alert, onClose, deptNameOf, nologinMode }: AlertDetailModalProps) {
  return <Modal title={<span>预警详情 {alert && <Tag color={ALERT_STATUS_COLOR_MAP[alert.status]}>{ALERT_STATUS_LABEL_MAP[alert.status] || alert.status}</Tag>}</span>}
    open={open}
    onCancel={onClose}
    width={760}
    footer={null}
    className={
      nologinMode
        ? 'alert-evidence-modal evidence-fullscreen-modal nologin-fullscreen'
        : 'alert-evidence-modal evidence-fullscreen-modal'
    }
    closable={!nologinMode}
    destroyOnHidden>
    {open && alert && <div key={alert.id}>
      <section className="evidence-section"><h3>基础信息</h3><AlertFacts alert={alert} /></section>
      <EvidenceSections alertId={alert.id} />
      <AlertTaskResults alert={alert} deptNameOf={deptNameOf} />
      <FollowUpRecords alertId={alert.id} />
    </div>}
  </Modal>
}

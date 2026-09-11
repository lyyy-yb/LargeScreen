import { useState } from 'react'
import { App, Button, Form, Input, Modal } from 'antd'
import { alertFollowUpApi, requireSuccess } from '@/servers/alertFollowUp'
import { disposalTaskApi } from '@/servers/business'
import EvidenceImages, { type EvidenceUploadFile } from '../components/EvidenceImages'
import type { DisposalTask } from './TaskDetailModal'

interface Props { task: DisposalTask | null; onClose: () => void; onSaved: (task: DisposalTask) => void; onBusyChange?: (busy: boolean) => void }

function FollowUpForm({ task, onClose, onSaved, onBusyChange }: Props & { task: DisposalTask }) {
  const { message } = App.useApp()
  const [files, setFiles] = useState<EvidenceUploadFile[]>([])
  const [saving, setSaving] = useState(false)
  const submit = async ({ content }: { content: string }) => {
    if (saving || task.status !== 'completed') return
    setSaving(true)
    onBusyChange?.(true)
    try {
      const current = requireSuccess(await disposalTaskApi.detail(Number(task.id)))
      if (current?.status !== 'completed') throw new Error('该任务已不处于已完成状态，请刷新列表后重试')
      await alertFollowUpApi.create(task.alertId, content.trim(), files.flatMap(file => file.originFileObj ? [file.originFileObj] : []))
      message.success('后续处置记录已提交')
      onSaved(task)
      onClose()
    } catch (err) { message.error(err instanceof Error ? err.message : '后续处置提交失败，请重试') }
    finally { setSaving(false); onBusyChange?.(false) }
  }
  return <Form id={`follow-up-form-${task.id}`} layout="vertical" onFinish={submit} disabled={saving}>
    <p className="evidence-muted">任务 #{task.id} · 关联预警 #{task.alertId}</p>
    <Form.Item name="content" label="描述" rules={[{ required: true, whitespace: true, message: '请输入处置描述' }]}>
      <Input.TextArea rows={5} placeholder="请输入处置描述" maxLength={2000} showCount />
    </Form.Item>
    <EvidenceImages files={files} onChange={setFiles} disabled={saving} />
  </Form>
}

export default function FollowUpModal(props: Props) {
  const [busy, setBusy] = useState(false)
  return <Modal open={!!props.task} title="后续处置" width={720} className="alert-evidence-modal evidence-follow-up-modal"
    footer={<><Button onClick={props.onClose} disabled={busy}>取消</Button><Button type="primary" htmlType="submit"
      form={`follow-up-form-${props.task?.id}`} loading={busy}>提交</Button></>}
    onCancel={() => { if (!busy) props.onClose() }} closable={!busy} keyboard={!busy} maskClosable={false} destroyOnHidden>
    {props.task && <FollowUpForm key={props.task.id} {...props} task={props.task} onBusyChange={setBusy} />}
  </Modal>
}

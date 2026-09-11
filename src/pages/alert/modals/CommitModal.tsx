import { useEffect, useState } from 'react'
import { Modal, Form, Input, DatePicker, Button, App } from 'antd'
import dayjs from 'dayjs'
import { disposalTaskApi } from '@/servers/business'
import { requireSuccess } from '@/servers/alertFollowUp'
import { disabledFutureDate } from '@/utils/helpers'
import type { DisposalTask } from './TaskDetailModal'

interface CommitModalProps {
  open: boolean
  task: DisposalTask | null
  onClose: () => void
  onSaved: () => void
}

export default function CommitModal({ open, task, onClose, onSaved }: CommitModalProps) {
  const { message } = App.useApp()
  const [form] = Form.useForm()
  const [submitting, setSubmitting] = useState(false)

  // 打开时按 task 重置 form 并预填完成时间
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (!open) return
    form.resetFields()
    form.setFieldsValue({ completedAt: dayjs() })
  }, [open, task?.id])

  const handleOk = () => {
    form
      .validateFields()
      .then(async (values) => {
        if (!task) return
        setSubmitting(true)
        try {
          requireSuccess(await disposalTaskApi.edit({
            id: Number(task.id),
            alertId: Number(task.alertId),
            dataType: task.dataType,
            taskType: task.taskType,
            status: 'committed',
            assigneeName: task.assigneeName,
            requesterName: task.requesterName,
            requireTime: task.requireTime,
            disposalContent: values.disposalContent,
            photos: task.photos,
            completedAt: values.completedAt?.format('YYYY-MM-DD HH:mm:ss'),
            cityId: task.cityId,
            districtId: task.districtId,
            townId: task.townId,
          }))
          message.success('处置结果已提交')
          onSaved()
          onClose()
        } catch {
          message.error('处置结果提交失败')
        } finally {
          setSubmitting(false)
        }
      })
      .catch(() => {
        /* 表单校验失败，由表单项自行提示 */
      })
  }

  return (
    <Modal
      title={<span className="alert-rule-modal-title">提交处置结果</span>}
      open={open}
      onCancel={onClose}
      width={560}
      className="alert-rule-modal"
      footer={[
        <Button key="cancel" onClick={onClose}>
          取消
        </Button>,
        <Button key="ok" type="primary" loading={submitting} onClick={handleOk}>
          提交
        </Button>,
      ]}
    >
      <Form
        form={form}
        layout="horizontal"
        labelCol={{ style: { width: 90, textAlign: 'right', color: '#03FBFD', paddingRight: 10 } }}
        className="alert-rule-form pt-2"
      >
        <Form.Item
          label="处置内容"
          name="disposalContent"
          rules={[{ required: true, message: '请输入处置内容' }]}
        >
          <Input.TextArea
            className="model_from_input"
            rows={3}
            placeholder="请输入处置过程与结果说明"
          />
        </Form.Item>
        <Form.Item
          label="完成时间"
          name="completedAt"
          rules={[{ required: true, message: '请选择完成时间' }]}
        >
          <DatePicker
            className="model_from_input w-full"
            showTime
            format="YYYY-MM-DD HH:mm:ss"
            placeholder="请选择完成时间"
            disabledDate={disabledFutureDate}
          />
        </Form.Item>
      </Form>
    </Modal>
  )
}

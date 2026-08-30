import { useEffect, useState } from 'react'
import { Button, Form, Input, message, Modal, Select } from 'antd'
import { cities as allCities, districts as allDistricts } from '@/utils/city'
import { wuranyuanAdd } from '@/servers/api'

export interface CreatePollutionInitial {
  weizhi?: string
  lng?: number
  lat?: number
  city?: string
  quxian?: string
}

export interface CreatePollutionModalProps {
  open: boolean
  initial: CreatePollutionInitial | null
  leixingOptions: { value: string; label: string }[]
  onClose: () => void
  onCreated: () => void
}

/**
 * 新建污染源弹窗（告警点确认后打开，预填经纬度与地址，对齐 antd-demo CreateModel）
 * cityItems/districtItems 从 @/utils/city 直接取，无需父组件注入
 */
export default function CreatePollutionModal({
  open,
  initial,
  leixingOptions,
  onClose,
  onCreated,
}: CreatePollutionModalProps) {
  const [form] = Form.useForm()
  const [submitting, setSubmitting] = useState(false)
  // 城市选中值用 useWatch 跟随表单（setFieldsValue 预填也会触发），区县选项联动
  const modalCity = Form.useWatch('city', form) as string | undefined

  useEffect(() => {
    if (!open) return
    form.resetFields()
    form.setFieldsValue({
      weizhi: initial?.weizhi,
      lng: initial?.lng != null ? String(initial.lng) : undefined,
      lat: initial?.lat != null ? String(initial.lat) : undefined,
      city: initial?.city,
      quxian: initial?.quxian,
      level: '1',
    })
  }, [open, initial, form])

  // 区县选项随所选城市联动
  const countyOpts = allDistricts
    .filter(item => !modalCity || item.parent === Number(allCities.find(city => city.name === modalCity)?.adcode))
    .map(item => item.name)

  const handleOk = async () => {
    let values
    try {
      values = await form.validateFields()
    } catch {
      return
    }
    setSubmitting(true)
    try {
      await wuranyuanAdd({ ...values, lng: Number(values.lng), lat: Number(values.lat), type: '0' })
      message.success('新增污染源成功')
      onCreated()
      onClose()
      form.resetFields()
    } catch {
      message.error('保存失败，请重试')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Modal
      title={<span className="alert-rule-modal-title">新增污染源</span>}
      open={open}
      onCancel={onClose}
      width={780}
      className="alert-rule-modal"
      footer={[
        <Button key="cancel" onClick={onClose}>取消</Button>,
        <Button key="ok" type="primary" loading={submitting} onClick={handleOk}>确定</Button>,
      ]}
    >
      <Form
        form={form}
        layout="horizontal"
        labelCol={{ style: { width: 90, textAlign: 'right', color: '#03FBFD', paddingRight: 10 } }}
        className="alert-rule-form pt-2"
      >
        <Form.Item label="名称" name="name" rules={[{ required: true, message: '请输入名称' }]}>
          <Input className="model_from_input" placeholder="请输入名称" />
        </Form.Item>
        <div className="grid grid-cols-2 gap-x-2">
          <Form.Item label="城市" name="city" rules={[{ required: true, message: '请选择城市' }]}>
            <Select className="model_from_sel" popupClassName="alert-rule-dropdown" placeholder="请选择城市"
              options={allCities.map(item => ({ value: item.name, label: item.name }))} />
          </Form.Item>
          <Form.Item label="区县" name="quxian" rules={[{ required: true, message: '请选择区县' }]}>
            <Select className="model_from_sel" popupClassName="alert-rule-dropdown" placeholder="请选择区县"
              options={countyOpts.map(name => ({ value: name, label: name }))} />
          </Form.Item>
        </div>
        <div className="grid grid-cols-2 gap-x-2">
          <Form.Item label="乡镇街道" name="xiangzhen">
            <Input className="model_from_input" placeholder="请输入乡镇街道" />
          </Form.Item>
          <Form.Item label="详细地址" name="weizhi" rules={[{ required: true, message: '请输入详细地址' }]}>
            <Input className="model_from_input" placeholder="请输入详细地址" />
          </Form.Item>
        </div>
        <div className="grid grid-cols-2 gap-x-2">
          <Form.Item label="类型" name="leixing" rules={[{ required: true, message: '请选择类型' }]}>
            <Select className="model_from_sel" popupClassName="alert-rule-dropdown" placeholder="请选择类型" options={leixingOptions} />
          </Form.Item>
          <Form.Item label="行业" name="hangye">
            <Input className="model_from_input" placeholder="请输入行业" />
          </Form.Item>
        </div>
        <div className="grid grid-cols-2 gap-x-2">
          <Form.Item label="现状" name="xianzhuang">
            <Input className="model_from_input" placeholder="请输入现状" />
          </Form.Item>
          <Form.Item label="级别" name="level" rules={[{ required: true, message: '请选择级别' }]}>
            <Select className="model_from_sel" popupClassName="alert-rule-dropdown" options={[{ value: '1', label: '红' }, { value: '2', label: '黄' }, { value: '3', label: '绿' }]} />
          </Form.Item>
        </div>
        <div className="grid grid-cols-2 gap-x-2">
          <Form.Item label="经度" name="lng" rules={[{ required: true, message: '请输入经度' }]}>
            <Input type="number" className="model_from_input" placeholder="请输入经度" />
          </Form.Item>
          <Form.Item label="纬度" name="lat" rules={[{ required: true, message: '请输入纬度' }]}>
            <Input type="number" className="model_from_input" placeholder="请输入纬度" />
          </Form.Item>
        </div>
        <Form.Item label="备注" name="beizhu">
          <Input.TextArea className="model_from_input" rows={2} placeholder="请输入备注" />
        </Form.Item>
      </Form>
    </Modal>
  )
}

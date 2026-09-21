import { useMemo, useRef, useState } from 'react'
import { DatePicker, Form, Input, InputNumber, Modal, Select, message } from 'antd'
import dayjs, { type Dayjs } from 'dayjs'
import { useAppStore, useAuthStore } from '@/stores'
import { addOption, buildDeptRegionOptions, flattenDepartments, nameEquals } from '@/utils/deptRegion'
import { alertEventApi } from '@/servers/business'
import { requireSuccess } from '@/servers/alertFollowUp'
import type { AlertEventDTO } from '@/types/business'
import { ALERT_LEVEL_OPTIONS, DATA_TYPE_OPTIONS } from '../tabs/shared/tabConstants'
import '../index.less'

export type ManualAlertInitial = Partial<Omit<AlertEventDTO, 'id' | 'ruleId' | 'status' | 'ruleName'>>
type FormValues = Omit<ManualAlertInitial, 'lastTriggerTime'> & { lastTriggerTime?: Dayjs; ruleName: string }

/** 挂载时接收来源快照；关闭后卸载，供雷达和其他转预警入口复用。 */
export default function CreateManualAlertModal({ initial, onClose, onCreated }: {
  initial: ManualAlertInitial
  onClose: () => void
  onCreated?: () => void
}) {
  const [form] = Form.useForm<FormValues>()
  const [submitting, setSubmitting] = useState(false)
  const submittingRef = useRef(false)
  const isRadar = initial.dataType === 'radar_station'
  const regionContext = useAppStore(state => state.regionContext)
  const userDept = useAuthStore(state => state.user?.dept)
  const { regions, accountRegion } = useMemo(() => {
    const departments = flattenDepartments([...(regionContext?.departments ?? []), ...(userDept ? [userDept] : [])])
    const options = buildDeptRegionOptions(departments)
    const selection = regionContext?.defaultSelection
    if (!selection || regionContext?.usedFallback || regionContext?.roleLevel === 'admin') {
      return { regions: options, accountRegion: {} }
    }
    const matches = (name?: string, label?: string) => nameEquals(name, label)
      || (!!name && !!label && label.includes('智造新城') && name.includes('智造新城'))
    const city = departments.find(dept => matches(dept.deptName, selection.cityName))
    const district = departments.find(dept => matches(dept.deptName, selection.countyName))
    // 部门接口按账号裁剪时，上级城市可能缺失；只用已知父部门 ID 补入。
    const cityId = city?.deptId ?? district?.parentId
    const districtId = district?.deptId
    const cityOptions = addOption(options.cityOptions, cityId, selection.cityName)
    return {
      regions: {
        ...options,
        cityOptions,
        getDistrictOptions: (selectedCity?: number | string) => Number(selectedCity) === cityId
          ? addOption(options.getDistrictOptions(selectedCity), districtId, district?.deptName ?? selection.countyName)
          : options.getDistrictOptions(selectedCity),
      },
      accountRegion: { cityId, districtId },
    }
  }, [regionContext, userDept])
  const cityId = Form.useWatch('cityId', form)
  const districtId = Form.useWatch('districtId', form)
  const required = [{ required: true, message: '请填写此项' }]
  const textRequired = [{ required: true, whitespace: true, message: '请填写此项' }]
  const regionOptions = (options: { value: string; label: string }[]) => options.map(item => ({ ...item, value: Number(item.value) }))

  const submit = async () => {
    if (submittingRef.current) return
    let values: FormValues
    try { values = await form.validateFields() } catch { return }
    if (submittingRef.current) return
    submittingRef.current = true
    setSubmitting(true)
    try {
      requireSuccess(await alertEventApi.add({
        ...values,
        ruleName: '手动触发',
        alertLevel: values.alertLevel!,
        dataType: isRadar ? 'radar_station' : values.dataType!,
        stationType: isRadar ? undefined : values.stationType,
        deviceName: values.deviceName!.trim(),
        location: values.location!.trim(),
        triggerReason: values.triggerReason!.trim(),
        lastTriggerTime: values.lastTriggerTime?.format('YYYY-MM-DD HH:mm:ss'),
        status: 'undispatched',
      }))
      message.success('新增手动预警成功')
      onCreated?.()
      onClose()
    } catch (error) {
      message.error(error instanceof Error ? error.message : '新增失败，请重试')
    } finally {
      submittingRef.current = false
      setSubmitting(false)
    }
  }

  return <Modal open title={<span className="alert-rule-modal-title">新增手动预警</span>} width={780} styles={{ body: { maxHeight: '70vh', overflowY: 'auto' } }} className="alert-rule-modal" zIndex={1200}
    onCancel={() => { if (!submittingRef.current) onClose() }} onOk={submit} confirmLoading={submitting}
    okText="新增预警" cancelText="取消" cancelButtonProps={{ disabled: submitting }} closable={!submitting} maskClosable={false}>
    <Form form={form} layout="horizontal" labelCol={{ style: { width: 90, color: '#03FBFD', paddingRight: 10 } }} className="alert-rule-form" disabled={submitting} initialValues={{
      triggerCount: 1, ...initial, ...accountRegion, ruleName: '手动触发',
      ...(isRadar ? { location: undefined, stationType: undefined } : {}),
      lastTriggerTime: initial.lastTriggerTime && dayjs(initial.lastTriggerTime).isValid() ? dayjs(initial.lastTriggerTime) : dayjs(),
    }}>
      <div className="grid grid-cols-2 gap-x-4">
        <Form.Item label="规则名称" name="ruleName"><Input disabled /></Form.Item>
        <Form.Item label="预警等级" name="alertLevel" rules={required}><Select options={ALERT_LEVEL_OPTIONS} placeholder="请选择预警等级" /></Form.Item>
        <Form.Item label="数据类型" name="dataType" rules={required}><Select options={DATA_TYPE_OPTIONS} disabled={isRadar || submitting} /></Form.Item>
        <Form.Item label="设备名称" name="deviceName" rules={textRequired}><Input /></Form.Item>
        <Form.Item label="设备编号" name="deviceId"><Input /></Form.Item>
        {!isRadar && <Form.Item label="站点类型" name="stationType"><Select allowClear options={[{ value: 'fixed', label: '固定站' }, { value: 'mobile', label: '移动站' }]} /></Form.Item>}
        <Form.Item label="城市" name="cityId"><Select allowClear options={regionOptions(regions.cityOptions)} onChange={() => form.setFieldsValue({ districtId: undefined, townId: undefined })} /></Form.Item>
        <Form.Item label="区县" name="districtId"><Select allowClear disabled={!cityId || submitting} options={regionOptions(regions.getDistrictOptions(cityId))} onChange={() => form.setFieldsValue({ townId: undefined })} /></Form.Item>
        <Form.Item label="乡镇街道" name="townId"><Select allowClear disabled={!districtId || submitting} options={regionOptions(regions.getTownOptions(districtId))} /></Form.Item>
        <Form.Item label="触发时间" name="lastTriggerTime" rules={required}><DatePicker showTime className="w-full" format="YYYY-MM-DD HH:mm:ss" /></Form.Item>
        <Form.Item label="经度" name="lng" rules={[...required, { type: 'number', min: -180, max: 180, message: '经度范围为 -180 至 180' }]}><InputNumber className="!w-full" min={-180} max={180} /></Form.Item>
        <Form.Item label="纬度" name="lat" rules={[...required, { type: 'number', min: -90, max: 90, message: '纬度范围为 -90 至 90' }]}><InputNumber className="!w-full" min={-90} max={90} /></Form.Item>
        <Form.Item label="触发次数" name="triggerCount" rules={[{ type: 'integer', min: 1, message: '请输入大于零的整数' }]}><InputNumber className="!w-full" min={1} precision={0} /></Form.Item>
        <Form.Item label="最近触发值" name="lastTriggerValue"><Input /></Form.Item>
      </div>
      <Form.Item label="点位地址" name="location" rules={textRequired}><Input /></Form.Item>
      <Form.Item label="触发原因" name="triggerReason" rules={textRequired}><Input.TextArea rows={3} /></Form.Item>
    </Form>
  </Modal>
}

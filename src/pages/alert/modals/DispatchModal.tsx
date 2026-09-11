import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Modal, Form, Input, Select, DatePicker, Button, App } from 'antd'
import dayjs from 'dayjs'
import { alertEventApi } from '@/servers/business'
import { requireSuccess } from '@/servers/alertFollowUp'
import { userList } from '@/servers/api'
import { addOption } from '@/utils/deptRegion'
import type { LockedRegion, DeptRegionOptions, RoleLevel, SelectOption } from './RuleModal'
import type { AlertEvent } from './AlertDetailModal'

interface DispatchModalProps {
  open: boolean
  alert: AlertEvent | null
  onClose: () => void
  onSaved: () => void
  roleLevel: RoleLevel
  canSelectRegion: boolean
  lockedRegion: LockedRegion
  deptRegionOptions: DeptRegionOptions
  taskTypeOptions: SelectOption[]
}

export default function DispatchModal({
  open,
  alert,
  onClose,
  onSaved,
  roleLevel,
  canSelectRegion,
  lockedRegion,
  deptRegionOptions,
  taskTypeOptions,
}: DispatchModalProps) {
  const { message } = App.useApp()
  const [form] = Form.useForm()
  const [submitting, setSubmitting] = useState(false)
  const [townUserOptions, setTownUserOptions] = useState<{ value: number; label: string }[]>([])
  const loadedUserTownIds = useRef(new Set<number>())

  // 表单 watcher 驱动级联选项
  const dispatchCityId = Form.useWatch('cityId', form)
  const dispatchDistrictId = Form.useWatch('districtId', form)
  const dispatchTownId = Form.useWatch('townId', form)

  const cityOptions = useMemo(
    () => addOption(deptRegionOptions.cityOptions, lockedRegion.cityId, lockedRegion.cityName),
    [deptRegionOptions.cityOptions, lockedRegion.cityId, lockedRegion.cityName],
  )
  const dispatchDistrictOptions = useMemo(
    () => deptRegionOptions.getDistrictOptions(dispatchCityId),
    [deptRegionOptions, dispatchCityId],
  )
  const dispatchTownOptions = useMemo(
    () => deptRegionOptions.getTownOptions(dispatchDistrictId),
    [deptRegionOptions, dispatchDistrictId],
  )

  const loadTownUsers = useCallback(async (townId?: number | string) => {
    const normalizedTownId = Number(townId)
    if (!Number.isFinite(normalizedTownId) || loadedUserTownIds.current.has(normalizedTownId)) return
    loadedUserTownIds.current.add(normalizedTownId)
    try {
      const response = await userList({ deptId: normalizedTownId, pageNum: 1, pageSize: 200 })
      if (response.code !== 200) {
        message.warning(response.msg || '获取乡镇用户列表失败')
        return
      }
      const options = (response.rows ?? [])
        .filter((user) => user.status === '0')
        .map((user) => ({ value: user.userId, label: user.nickName || user.userName }))
      setTownUserOptions(options)
      if (!options.length) message.info('该乡镇下暂无可选处置人员')
    } catch {
      message.warning('获取乡镇用户列表失败')
    }
  }, [])

  // 打开时初始化表单 + 加载已有乡镇用户
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (!open || !alert) return
    setTownUserOptions([])
    loadedUserTownIds.current.clear()
    form.resetFields()
    const defaults: Record<string, unknown> = {
      taskType: 'on_site_check',
      requireTime: dayjs().add(1, 'hour'),
    }
    // 默认选中预警事件所属区域
    if (alert.cityId != null) defaults.cityId = String(alert.cityId)
    if (alert.districtId != null) defaults.districtId = String(alert.districtId)
    if (alert.townId != null) defaults.townId = String(alert.townId)
    // 非 admin 角色强制锁定到当前用户所属区域
    if (roleLevel !== 'admin') {
      if (lockedRegion.cityId) defaults.cityId = lockedRegion.cityId
      if (roleLevel === 'county' && lockedRegion.districtId) defaults.districtId = lockedRegion.districtId
    }
    form.setFieldsValue(defaults)
    queueMicrotask(() => {
      const townValue = form.getFieldValue('townId')
      if (townValue) void loadTownUsers(townValue)
    })
  }, [open, alert?.id])

  const handleOk = () => {
    form
      .validateFields()
      .then(async (values) => {
        if (!alert) return
        setSubmitting(true)
        try {
          requireSuccess(await alertEventApi.dispatch({
            alertId: Number(alert.id),
            taskType: values.taskType,
            assigneeId: Number(values.assigneeId),
            townId: values.townId ? Number(values.townId) : undefined,
            requireTime: dayjs(values.requireTime).format('YYYY-MM-DD HH:mm:ss'),
            disposalContent: values.disposalContent,
          }))
          message.success('派发成功')
          onSaved()
          onClose()
        } catch {
          message.error('任务派发失败')
        } finally {
          setSubmitting(false)
        }
      }).catch(() => { /* 表单校验提示由 Form.Item 展示 */ })
  }

  return (
    <Modal
      title={<span className="alert-rule-modal-title">派发处置任务</span>}
      open={open}
      zIndex={1200}
      onCancel={onClose}
      width={720}
      className="alert-rule-modal"
      footer={[
        <Button key="cancel" onClick={onClose}>
          取消
        </Button>,
        <Button key="ok" type="primary" loading={submitting} onClick={handleOk}>
          确定
        </Button>,
      ]}
    >
      {alert && (
        <div
          className="flex items-center gap-4 mb-2 p-2 rounded text-sm"
          style={{ backgroundColor: 'rgba(3,251,253,0.05)', border: '1px solid rgba(3,251,253,0.15)' }}
        >
          <span className="text-[#03FBFD]">预警 #{alert.id}</span>
          <span className="text-white/80">{alert.ruleName}</span>
          <span className="text-white/60">{alert.deviceName}</span>
        </div>
      )}
      <Form
        form={form}
        layout="horizontal"
        labelCol={{ style: { width: 90, textAlign: 'right', color: '#03FBFD', paddingRight: 10 } }}
        className="alert-rule-form pt-2"
      >
        <div className="grid grid-cols-2 gap-x-2">
          <Form.Item
            label="任务类型"
            name="taskType"
            rules={[{ required: true, message: '请选择任务类型' }]}
          >
            <Select
              className="model_from_sel"
              classNames={{ popup: { root: 'alert-rule-dropdown' } }}
              placeholder="请选择任务类型"
              options={taskTypeOptions}
            />
          </Form.Item>
          <Form.Item label="地市" name="cityId" rules={[{ required: true, message: '请选择地市' }]}>
            <Select
              className="model_from_sel"
              classNames={{ popup: { root: 'alert-rule-dropdown' } }}
              placeholder="请选择地市"
              disabled={!canSelectRegion}
              showSearch
              optionFilterProp="label"
              options={cityOptions}
              onChange={() =>
                form.setFieldsValue({ districtId: undefined, townId: undefined, assigneeId: undefined })
              }
            />
          </Form.Item>
        </div>
        <div className="grid grid-cols-2 gap-x-2">
          <Form.Item label="区县" name="districtId" rules={[{ required: true, message: '请选择区县' }]}>
            <Select
              className="model_from_sel"
              classNames={{ popup: { root: 'alert-rule-dropdown' } }}
              placeholder={dispatchCityId ? '请选择区县' : '请先选择地市'}
              disabled={roleLevel === 'county' || roleLevel === 'town' || !dispatchCityId}
              showSearch
              optionFilterProp="label"
              options={dispatchDistrictOptions}
              onChange={() => form.setFieldsValue({ townId: undefined, assigneeId: undefined })}
            />
          </Form.Item>
          <Form.Item label="乡镇" name="townId" rules={[{ required: true, message: '请选择乡镇' }]}>
            <Select
              className="model_from_sel"
              classNames={{ popup: { root: 'alert-rule-dropdown' } }}
              placeholder={dispatchDistrictId ? '请选择乡镇' : '请先选择区县'}
              disabled={roleLevel === 'town' || !dispatchDistrictId}
              showSearch
              optionFilterProp="label"
              options={dispatchTownOptions}
              onChange={(value) => {
                form.setFieldsValue({ assigneeId: undefined })
                void loadTownUsers(value)
              }}
            />
          </Form.Item>
        </div>
        <div className="grid grid-cols-2 gap-x-2">
          <Form.Item
            label="处置人"
            name="assigneeId"
            rules={[{ required: true, message: '请选择处置人' }]}
          >
            <Select
              className="model_from_sel"
              classNames={{ popup: { root: 'alert-rule-dropdown' } }}
              placeholder={dispatchTownId ? '请选择处置人员' : '请先选择乡镇'}
              disabled={!dispatchTownId}
              showSearch
              optionFilterProp="label"
              options={townUserOptions}
            />
          </Form.Item>
          <Form.Item
            label="要求完成时间"
            name="requireTime"
            rules={[{ required: true, message: '请选择要求完成时间' }]}
          >
            <DatePicker
              className="model_from_input w-full"
              showTime
              format="YYYY-MM-DD HH:mm:ss"
              placeholder="请选择时间"
            />
          </Form.Item>
        </div>
        <Form.Item label="处置内容" name="disposalContent">
          <Input.TextArea
            className="model_from_input"
            rows={2}
            placeholder="请输入处置要求说明（可选）"
          />
        </Form.Item>
      </Form>
    </Modal>
  )
}

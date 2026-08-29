import { useEffect, useMemo, useState } from 'react'
import { Modal, Form, Input, InputNumber, Select, Radio, Space, Button, App } from 'antd'
import { warningRuleApi } from '@/servers/business'
import type { WarningRuleDTO } from '@/types/business'
import { addOption, type RegionOption } from '@/utils/deptRegion'

const { Option } = Select

// 规则实体的展示形态。Modal 内为唯一权威定义，外部（列表/列渲染）
// 通过 import type { AlertRule } from 此文件 复用。
export interface AlertRule {
  id: string
  ruleName: string
  dataType: string
  fieldName: string
  ruleType: string
  alertLevel: string
  priority: number
  enabled: boolean
  description: string
  config: Record<string, any>
  autoDispatch: boolean
  targetCityId?: number | string
  targetDistrictId?: number | string
  targetTownId?: number | string
}

export type RuleMode = 'add' | 'edit' | 'copy'

export interface LockedRegion {
  cityId?: string
  districtId?: string
  cityName?: string
  districtName?: string
}

export type RoleLevel = 'admin' | 'city' | 'county' | 'town'

export interface DeptRegionOptions {
  cityOptions: RegionOption[]
  getDistrictOptions: (cityId?: number | string) => RegionOption[]
  getTownOptions: (districtId?: number | string) => RegionOption[]
}

export interface SelectOption {
  value: string
  label: string
}

export interface AlertLevelOption extends SelectOption {
  color?: string
}

interface RuleModalProps {
  open: boolean
  mode: RuleMode
  sourceRule?: AlertRule | null
  onClose: () => void
  onSaved: () => void
  /** 当前用户的角色级别，决定可编辑性、目标区域锁定、按钮文案 */
  roleLevel: RoleLevel
  /** 是否可自主选择目标区域（admin 之外的角色通常锁定） */
  canSelectRegion: boolean
  /** 当前登录用户所属区域，用于 city/county 角色强制锁定 */
  lockedRegion: LockedRegion
  /** 部门区域选项，由父组件 useMemo 生成后传入 */
  deptRegionOptions: DeptRegionOptions
  /** 4 个选项字典（父组件与表格列共享，Modal 内部不再单独维护） */
  dataTypeOptions: SelectOption[]
  ruleTypeOptions: SelectOption[]
  alertLevelOptions: AlertLevelOption[]
  fieldOptions: Record<string, SelectOption[]>
}

// DTO → 展示形态转换（仅 Modal 使用）
function parseConfig(config: WarningRuleDTO['config']): Record<string, unknown> {
  if (!config) return {}
  if (typeof config === 'object') return config
  let value: unknown = config
  for (let i = 0; i < 3 && typeof value === 'string'; i++) {
    try {
      value = JSON.parse(value)
    } catch {
      break
    }
  }
  return value && typeof value === 'object' ? (value as Record<string, unknown>) : {}
}

export function toAlertRule(item: WarningRuleDTO): AlertRule {
  return {
    ...item,
    id: String(item.id),
    description: item.description ?? '',
    config: parseConfig(item.config),
    enabled: item.enabled === 1,
    autoDispatch: item.autoDispatch === 1,
    targetCityId: item.targetCityId != null ? String(item.targetCityId) : undefined,
    targetDistrictId: item.targetDistrictId != null ? String(item.targetDistrictId) : undefined,
    targetTownId: item.targetTownId != null ? String(item.targetTownId) : undefined,
  }
}

export default function RuleModal({
  open,
  mode,
  sourceRule,
  onClose,
  onSaved,
  roleLevel,
  canSelectRegion,
  lockedRegion,
  deptRegionOptions,
  dataTypeOptions,
  ruleTypeOptions,
  alertLevelOptions,
  fieldOptions,
}: RuleModalProps) {
  const { message } = App.useApp()
  const [form] = Form.useForm()
  const [saving, setSaving] = useState(false)
  const [selectedDataType, setSelectedDataType] = useState('')
  const isTown = roleLevel === 'town'

  // 表单级 watcher（驱动级联选项）
  const targetCityId = Form.useWatch('targetCityId', form)
  const targetDistrictId = Form.useWatch('targetDistrictId', form)
  const watchedRuleType = Form.useWatch('ruleType', form)

  const cityOptions = useMemo(
    () => addOption(deptRegionOptions.cityOptions, lockedRegion.cityId, lockedRegion.cityName),
    [deptRegionOptions.cityOptions, lockedRegion.cityId, lockedRegion.cityName],
  )
  const districtOptions = useMemo(
    () => {
      const opts = addOption(
        deptRegionOptions.getDistrictOptions(targetCityId),
        lockedRegion.districtId,
        lockedRegion.districtName,
      )
      // 仅返回地市相关，跨地市不混入其他地市的区县
      return opts
    },
    [deptRegionOptions, lockedRegion.districtId, lockedRegion.districtName, targetCityId],
  )
  const targetTownOptions = useMemo(
    () => {
      const opts = deptRegionOptions.getTownOptions(targetDistrictId)
      return opts
    },
    [deptRegionOptions, targetDistrictId],
  )

  // 把编辑/复制的 rule 展开成表单值
  const buildFormValues = (rule: AlertRule) => {
    let townArr: (string | number)[] | undefined
    if (rule.targetTownId) {
      const townStr = String(rule.targetTownId)
      townArr = townStr === 'all' ? ['all'] : townStr.split(',').filter(Boolean).map(v => String(v))
    }
    const ruleTimeWindow = rule.config?.timeWindow
    return {
      ...rule,
      ...rule.config,
      targetTownId: townArr,
      ruleTimeWindow: ruleTimeWindow || undefined,
    }
  }

  // 初始化表单：open 翻转时按 mode 触发
  useEffect(() => {
    if (!open) {
      form.resetFields()
      setSelectedDataType('')
      return
    }
    if (mode === 'add') {
      form.resetFields()
      setSelectedDataType('')
      const defaults: Record<string, unknown> = { autoDispatch: false }
      if (roleLevel !== 'admin') {
        defaults.targetCityId = lockedRegion.cityId
        if (roleLevel === 'county') defaults.targetDistrictId = lockedRegion.districtId
      }
      form.setFieldsValue(defaults)
      // 城市/区县角色：额外回填锁定区域
      if (roleLevel === 'city' || roleLevel === 'county') {
        queueMicrotask(() => {
          form.setFieldsValue({
            ...(lockedRegion.cityId ? { targetCityId: lockedRegion.cityId } : {}),
            ...(roleLevel === 'county' && lockedRegion.districtId
              ? { targetDistrictId: lockedRegion.districtId }
              : {}),
          })
        })
      }
      return
    }
    if (sourceRule) {
      const rule = sourceRule
      form.resetFields()
      setSelectedDataType(rule.dataType)
      const baseValues = buildFormValues(rule)
      form.setFieldsValue({
        ...baseValues,
        ...(mode === 'copy' ? { ruleName: `${rule.ruleName}-副本` } : {}),
        targetDistrictId: undefined,
        targetTownId: undefined,
      })
      // 异步拉详情覆盖回显
      const hide = message.loading('加载规则详情...', 0)
      ;(async () => {
        try {
          const res = await warningRuleApi.detail(Number(rule.id))
          const detail = res.data
          if (detail) {
            const detailRule = toAlertRule(detail)
            const finalRule = {
              ...rule,
              ...detailRule,
              targetCityId: detailRule.targetCityId ?? rule.targetCityId,
              targetDistrictId: detailRule.targetDistrictId ?? rule.targetDistrictId,
              targetTownId: detailRule.targetTownId ?? rule.targetTownId,
            }
            requestAnimationFrame(() => {
              const regionValues = buildFormValues(finalRule)
              form.setFieldsValue({
                targetCityId: regionValues.targetCityId,
                targetDistrictId: regionValues.targetDistrictId,
                targetTownId: regionValues.targetTownId,
              })
            })
          }
        } catch {
          // 列表数据已包含编辑所需字段，详情接口异常时保留列表数据回显
        } finally {
          hide()
        }
      })()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, mode, sourceRule?.id])

  const handleOk = () => {
    form.validateFields().then(async (values) => {
      const config: Record<string, unknown> = {}
      if (values.ruleType === 'threshold' || values.ruleType === 'change_rate') {
        config.threshold = values.threshold
        config.operator = values.operator
        if (values.ruleTimeWindow) config.timeWindow = values.ruleTimeWindow
      } else if (values.ruleType === 'continuous') {
        config.count = values.count
        config.interval = values.interval
      } else if (values.ruleType === 'offline') {
        config.offlineTime = values.offlineTime
      }

      const districtValue = values.targetDistrictId === 'all' ? 'all' : values.targetDistrictId
      let townValue: string | undefined
      if (values.targetDistrictId === 'all') {
        townValue = undefined
      } else if (Array.isArray(values.targetTownId)) {
        townValue = values.targetTownId.includes('all') ? 'all' : values.targetTownId.join(',')
      } else {
        townValue = values.targetTownId
      }

      const payload = {
        ruleName: values.ruleName,
        dataType: values.dataType,
        fieldName: values.fieldName,
        ruleType: values.ruleType,
        alertLevel: values.alertLevel,
        priority: values.priority,
        enabled: values.enabled === false ? (0 as const) : (1 as const),
        description: values.description,
        config: JSON.stringify(config),
        autoDispatch: values.autoDispatch ? (1 as const) : (0 as const),
        targetCityId: values.targetCityId,
        targetDistrictId: districtValue,
        targetTownId: townValue,
      }
      try {
        setSaving(true)
        if (mode === 'edit' && sourceRule) {
          await warningRuleApi.edit({ ...payload, id: Number(sourceRule.id) })
        } else {
          await warningRuleApi.add(payload)
        }
        message.success(mode === 'edit' ? '更新成功' : '创建成功')
        onSaved()
        onClose()
      } catch {
        message.error('规则保存失败')
      } finally {
        setSaving(false)
      }
    })
  }

  const handleCancel = () => {
    onClose()
  }

  return (
    <Modal
      title={
        <span className="alert-rule-modal-title">
          {isTown ? '查看预警规则' : mode === 'edit' ? '编辑预警规则' : '新增预警规则'}
        </span>
      }
      open={open}
      onCancel={handleCancel}
      width={840}
      className="alert-rule-modal"
      footer={
        isTown
          ? [
              <Button key="close" onClick={handleCancel}>
                关闭
              </Button>,
            ]
          : [
              <Button key="cancel" onClick={handleCancel}>
                取消
              </Button>,
              <Button key="ok" type="primary" loading={saving} onClick={handleOk}>
                确定
              </Button>,
            ]
      }
    >
      <Form
        form={form}
        disabled={isTown}
        layout="horizontal"
        labelCol={{ style: { width: 110, textAlign: 'right', color: '#03FBFD', paddingRight: 12 } }}
        className="alert-rule-form pt-2"
      >
        <Form.Item label="规则名称" name="ruleName" rules={[{ required: true, message: '请输入' }]}>
          <Input className="model_from_input" placeholder="请输入规则名称" />
        </Form.Item>

        <div className="grid grid-cols-2 gap-x-2">
          <Form.Item label="数据类型" name="dataType" rules={[{ required: true, message: '请选择' }]}>
            <Select
              className="model_from_sel"
              classNames={{ popup: { root: 'alert-rule-dropdown' } }}
              placeholder="请选择"
              onChange={(v: string) => {
                setSelectedDataType(v)
                form.setFieldsValue({ fieldName: '' })
              }}
            >
              {dataTypeOptions.map((o) => (
                <Option key={o.value} value={o.value}>
                  {o.label}
                </Option>
              ))}
            </Select>
          </Form.Item>
          <Form.Item label="监测字段" name="fieldName" rules={[{ required: true, message: '请选择' }]}>
            <Select
              className="model_from_sel"
              classNames={{ popup: { root: 'alert-rule-dropdown' } }}
              placeholder="请选择"
            >
              {selectedDataType &&
                fieldOptions[selectedDataType]?.map((o) => (
                  <Option key={o.value} value={o.value}>
                    {o.label}
                  </Option>
                ))}
            </Select>
          </Form.Item>
        </div>

        <div className="grid grid-cols-2 gap-x-2">
          <Form.Item label="规则类型" name="ruleType" rules={[{ required: true, message: '请选择' }]}>
            <Select
              className="model_from_sel"
              classNames={{ popup: { root: 'alert-rule-dropdown' } }}
              placeholder="请选择"
            >
              {ruleTypeOptions.map((o) => (
                <Option key={o.value} value={o.value}>
                  {o.label}
                </Option>
              ))}
            </Select>
          </Form.Item>

          {(watchedRuleType === 'threshold' || watchedRuleType === 'change_rate') && (
            <Form.Item label="间隔时间" required>
              <Space.Compact style={{ width: '100%' }}>
                <Form.Item
                  name="ruleTimeWindow"
                  noStyle
                  rules={[{ required: true, message: '请输入' }]}
                >
                  <InputNumber
                    min={1}
                    step={1}
                    precision={0}
                    style={{ width: '100%' }}
                    className="model_from_input"
                    placeholder="分钟"
                  />
                </Form.Item>
                <span className="flex items-center px-2 h-32px text-white/60 bg-white/5 border border-l-0 border-white/10 rounded-r shrink-0">
                  分
                </span>
              </Space.Compact>
            </Form.Item>
          )}
        </div>

        <Form.Item noStyle shouldUpdate={(p, c) => p.ruleType !== c.ruleType}>
          {() => {
            const rt = form.getFieldValue('ruleType')
            if (rt === 'threshold' || rt === 'change_rate') {
              return (
                <div className="grid grid-cols-2 gap-x-2">
                  <Form.Item label={rt === 'threshold' ? '阈值' : '变化率'} required>
                    <div className="grid grid-cols-[1.2fr_1fr] gap-2">
                      <Form.Item name="operator" noStyle rules={[{ required: true, message: '请选择' }]}>
                        <Select
                          className="model_from_sel"
                          classNames={{ popup: { root: 'alert-rule-dropdown' } }}
                          placeholder="比较符"
                        >
                          <Option value=">">大于&gt;</Option>
                          <Option value="<">小于&lt;</Option>
                          <Option value=">=">大于等于&ge;</Option>
                          <Option value="<=">小于等于&le;</Option>
                        </Select>
                      </Form.Item>
                      <Form.Item name="threshold" noStyle rules={[{ required: true, message: '请输入' }]}>
                        <InputNumber step={1} className="w-full model_from_input" placeholder="数值" />
                      </Form.Item>
                    </div>
                  </Form.Item>
                  <div />
                </div>
              )
            }
            if (rt === 'continuous') {
              return (
                <div className="grid grid-cols-2 gap-x-2">
                  <Form.Item label="连续配置" required>
                    <div className="grid grid-cols-2 gap-2">
                      <Form.Item name="count" noStyle rules={[{ required: true, message: '请输入' }]}>
                        <InputNumber step={1} className="w-full model_from_input" placeholder="次数" />
                      </Form.Item>
                      <Form.Item
                        name="interval"
                        noStyle
                        rules={[{ required: true, message: '请输入' }]}
                      >
                        <InputNumber step={1} className="w-full model_from_input" placeholder="间隔(分)" />
                      </Form.Item>
                    </div>
                  </Form.Item>
                  <div />
                </div>
              )
            }
            if (rt === 'offline') {
              return (
                <div className="grid grid-cols-2 gap-x-2">
                  <Form.Item
                    label="离线时长"
                    name="offlineTime"
                    rules={[{ required: true, message: '请输入' }]}
                  >
                    <InputNumber step={1} className="w-full model_from_input" placeholder="离线(分)" />
                  </Form.Item>
                  <div />
                </div>
              )
            }
            return null
          }}
        </Form.Item>

        <div className="grid grid-cols-2 gap-x-2">
          <Form.Item label="优先级" name="priority" rules={[{ required: true, message: '请输入' }]}>
            <InputNumber min={1} max={10} step={1} className="w-full model_from_input" placeholder="数值" />
          </Form.Item>
          <Form.Item label="预警级别" name="alertLevel" rules={[{ required: true, message: '请选择' }]}>
            <Select
              className="model_from_sel"
              classNames={{ popup: { root: 'alert-rule-dropdown' } }}
              placeholder="请选择"
            >
              {alertLevelOptions.map((o) => (
                <Option key={o.value} value={o.value}>
                  {o.label}
                </Option>
              ))}
            </Select>
          </Form.Item>
        </div>

        <div className="grid grid-cols-2 gap-x-2">
          <Form.Item label="目标地市" name="targetCityId" rules={[{ required: true, message: '请选择' }]}>
            <Select
              className="model_from_sel"
              classNames={{ popup: { root: 'alert-rule-dropdown' } }}
              placeholder="请选择目标地市"
              disabled={!canSelectRegion}
              showSearch
              optionFilterProp="label"
              onChange={() => {
                form.setFieldsValue({ targetDistrictId: undefined, targetTownId: undefined })
              }}
              options={cityOptions}
            />
          </Form.Item>
          <Form.Item label="目标区县" name="targetDistrictId" rules={[{ required: true, message: '请选择' }]}>
            <Select
              className="model_from_sel"
              classNames={{ popup: { root: 'alert-rule-dropdown' } }}
              placeholder={targetCityId ? '请选择目标区县' : '请先选择地市'}
              disabled={roleLevel === 'county' || roleLevel === 'town' || !targetCityId}
              showSearch
              optionFilterProp="label"
              onChange={() => {
                form.setFieldsValue({ targetTownId: undefined })
              }}
              options={districtOptions}
            />
          </Form.Item>
        </div>

        <div className="grid grid-cols-2 gap-x-2">
          <Form.Item
            label="是否直接下发"
            name="autoDispatch"
            rules={[{ required: true, message: '请选择' }]}
          >
            <Radio.Group className="flex items-center gap-4 h-8">
              <Radio value={true} className="!text-white">
                是
              </Radio>
              <Radio value={false} className="!text-white">
                否
              </Radio>
            </Radio.Group>
          </Form.Item>
          <Form.Item noStyle shouldUpdate={(p, c) => p.targetDistrictId !== c.targetDistrictId}>
            {() => {
              const districtVal = form.getFieldValue('targetDistrictId')
              const isAllDistrict = districtVal === 'all'
              return (
                <Form.Item label="目标乡镇" name="targetTownId">
                  <Select
                    className="model_from_sel"
                    classNames={{ popup: { root: 'alert-rule-dropdown' } }}
                    mode="multiple"
                    placeholder={
                      isAllDistrict
                        ? '区县已选全部'
                        : districtVal
                        ? '请选择目标乡镇'
                        : '请先选择区县'
                    }
                    disabled={roleLevel === 'town' || !districtVal || isAllDistrict}
                    showSearch
                    optionFilterProp="label"
                    maxTagCount="responsive"
                    onChange={(vals: string[]) => {
                      if (vals.includes('all') && vals.length > 1) {
                        const prev = form.getFieldValue('targetTownId') || []
                        if (!prev.includes('all')) {
                          form.setFieldsValue({ targetTownId: ['all'] })
                        } else {
                          form.setFieldsValue({
                            targetTownId: vals.filter((v) => v !== 'all'),
                          })
                        }
                      }
                    }}
                    options={targetTownOptions}
                  />
                </Form.Item>
              )
            }}
          </Form.Item>
        </div>

        <Form.Item label="描述" name="description">
          <Input.TextArea className="model_from_input" rows={3} placeholder="请输入描述" />
        </Form.Item>
      </Form>
    </Modal>
  )
}

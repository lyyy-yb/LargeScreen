import { useCallback, useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { Button, Table, Modal, Form, Input, Select, Switch, InputNumber, App } from 'antd'
import { PlusOutlined, EditOutlined, EyeOutlined, DeleteOutlined, ArrowLeftOutlined } from '@ant-design/icons'
import { cleanRuleApi } from '@/servers/business'
import type { CleanRuleDTO } from '@/types/business'

const { Option } = Select

interface CleanRule {
  id: number | string
  ruleName: string
  dataType: string
  fieldName: string
  ruleType: string
  action: string
  enabled: boolean
  priority: number
  description: string
  config: Record<string, unknown>
}

function parseConfig(config: CleanRuleDTO['config']): Record<string, unknown> {
  if (!config) return {}
  if (typeof config === 'object') return config
  try {
    return JSON.parse(config) as Record<string, unknown>
  } catch {
    return {}
  }
}

const dataTypeOptions = [
  { value: 'air_quality_station', label: '空气质量检测站' },
  { value: 'mobile_monitor_car', label: '走航车' },
  { value: 'drone_video', label: '无人机视频' },
  { value: 'drone_sensor', label: '无人机传感器' },
  { value: 'power_monitor', label: '用电监控' },
  { value: 'radar_station', label: '雷达站' },
  { value: 'manual_import', label: '人工采集导入' },
]

const ruleTypeOptions = [
  { value: 'required', label: '必填字段校验' },
  { value: 'format', label: '数据格式校验' },
  { value: 'range', label: '数值范围校验' },
  { value: 'type', label: '数据类型校验' },
  { value: 'enum', label: '枚举值校验' },
]

const actionOptions = [
  { value: 'discard', label: '丢弃' },
  { value: 'correct', label: '修正' },
  { value: 'mark', label: '标记' },
  { value: 'fill', label: '补全' },
  { value: 'alert', label: '告警' },
]

const fieldOptions: Record<string, { value: string; label: string }[]> = {
  air_quality_station: [
    { value: 'pm25', label: 'PM2.5' }, { value: 'pm10', label: 'PM10' },
    { value: 'tsp', label: 'TSP' }, { value: 'so2', label: 'SO\u2082' },
    { value: 'no2', label: 'NO\u2082' }, { value: 'co', label: 'CO' },
    { value: 'o3', label: 'O\u2083' }, { value: 'vocs', label: 'VOCs' },
    { value: 'monitorTime', label: '监测时间' },
  ],
  mobile_monitor_car: [
    { value: 'latitude', label: '纬度' }, { value: 'longitude', label: '经度' },
    { value: 'pm25', label: 'PM2.5' }, { value: 'pm10', label: 'PM10' },
    { value: 'tsp', label: 'TSP' }, { value: 'speed', label: '速度' },
    { value: 'monitorTime', label: '监测时间' },
  ],
  drone_video: [
    { value: 'videoUrl', label: '视频地址' }, { value: 'fileSize', label: '文件大小' },
    { value: 'duration', label: '时长' }, { value: 'resolution', label: '分辨率' },
    { value: 'shootTime', label: '拍摄时间' },
  ],
  drone_sensor: [
    { value: 'latitude', label: '纬度' }, { value: 'longitude', label: '经度' },
    { value: 'altitude', label: '高度' }, { value: 'pm25', label: 'PM2.5' },
    { value: 'pm10', label: 'PM10' }, { value: 'battery', label: '电量' },
    { value: 'monitorTime', label: '监测时间' },
  ],
  power_monitor: [
    { value: 'voltage', label: '电压' }, { value: 'current', label: '电流' },
    { value: 'power', label: '功率' }, { value: 'powerFactor', label: '功率因数' },
    { value: 'energy', label: '用电量' }, { value: 'monitorTime', label: '监测时间' },
  ],
  radar_station: [
    { value: 'latitude', label: '纬度' }, { value: 'longitude', label: '经度' },
    { value: 'alarmLevel', label: '报警级别' }, { value: 'monitorArea', label: '监测面积' },
    { value: 'alarmTime', label: '报警时间' },
  ],
  manual_import: [
    { value: 'checkTime', label: '检测时间' }, { value: 'latitude', label: '纬度' },
    { value: 'longitude', label: '经度' }, { value: 'address', label: '地址' },
    { value: 'pm25', label: 'PM2.5' }, { value: 'pm10', label: 'PM10' },
    { value: 'tsp', label: 'TSP' }, { value: 'checker', label: '检测人员' },
  ],
}

export default function CleanRule() {
  const navigate = useNavigate()
  const { message, modal } = App.useApp()
  const [data, setData] = useState<CleanRule[]>([])
  const [loading, setLoading] = useState(false)
  const [pageNum, setPageNum] = useState(1)
  const [pageSize, setPageSize] = useState(15)
  const [total, setTotal] = useState(0)
  const [searchName, setSearchName] = useState('')
  const [appliedName, setAppliedName] = useState('')
  const [filterDataType, setFilterDataType] = useState<string | undefined>(undefined)
  const [filterRuleType, setFilterRuleType] = useState<string | undefined>(undefined)
  const [filterAction, setFilterAction] = useState<string | undefined>(undefined)
  const [filterEnabled, setFilterEnabled] = useState<0 | 1 | undefined>(undefined)

  const loadList = useCallback(async () => {
    setLoading(true)
    try {
      const res = await cleanRuleApi.list({
        pageNum,
        pageSize,
        ruleName: appliedName || undefined,
        dataType: filterDataType,
        ruleType: filterRuleType,
        action: filterAction,
        enabled: filterEnabled,
      })
      const result = res.data
      setData((result?.records ?? []).map(item => ({
        ...item,
        description: item.description ?? '',
        enabled: item.enabled === 1,
        config: parseConfig(item.config),
      })))
      setTotal(result?.total ?? 0)
    } catch {
      setData([])
      setTotal(0)
    } finally {
      setLoading(false)
    }
  }, [pageNum, pageSize, appliedName, filterDataType, filterRuleType, filterAction, filterEnabled])

  useEffect(() => {
    queueMicrotask(() => void loadList())
  }, [loadList])

  const applySearch = (value?: string) => {
    setAppliedName((value ?? searchName).trim())
    setPageNum(1)
  }
  const [isModalVisible, setIsModalVisible] = useState(false)
  const [isDetailModalVisible, setIsDetailModalVisible] = useState(false)
  const [detailLoading, setDetailLoading] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [editingItem, setEditingItem] = useState<CleanRule | null>(null)
  const [form] = Form.useForm()
  const [selectedDataType, setSelectedDataType] = useState<string>('')

  const showAddModal = () => {
    setEditingItem(null)
    setSelectedDataType('')
    form.resetFields()
    setIsModalVisible(true)
  }

  const showEditModal = (record: CleanRule) => {
    setEditingItem(record)
    setSelectedDataType(record.dataType)
    const cfg = parseConfig(record.config)
    form.setFieldsValue({
      ...record,
      min: typeof cfg.min === 'number' ? cfg.min : undefined,
      max: typeof cfg.max === 'number' ? cfg.max : undefined,
      enumValues: Array.isArray(cfg.values) ? cfg.values.join(',') : cfg.values,
      pattern: typeof cfg.pattern === 'string' ? cfg.pattern : undefined,
    })
    setIsModalVisible(true)
  }

  const showDetailModal = async (record: CleanRule) => {
    setEditingItem(record)
    setIsDetailModalVisible(true)
    setDetailLoading(true)
    try {
      const res = await cleanRuleApi.detail(Number(record.id))
      if (res.data) {
        setEditingItem({
          ...res.data,
          description: res.data.description ?? '',
          enabled: res.data.enabled === 1,
          config: parseConfig(res.data.config),
        })
      }
    } catch { /* 详情获取失败时保留表格行数据 */ } finally {
      setDetailLoading(false)
    }
  }

  const handleOk = () => {
    form.validateFields().then(async (values) => {
      setSubmitting(true)
      try {
        const config: Record<string, unknown> = {}
        if (values.ruleType === 'range') {
          config.min = values.min
          config.max = values.max
        } else if (values.ruleType === 'enum') {
          config.values = values.enumValues?.split(',').map((v: string) => v.trim()) || []
        } else if (values.ruleType === 'format') {
          config.pattern = values.pattern
        }
        const payload = {
          ...values,
          enabled: (values.enabled ? 1 : 0) as 0 | 1,
          config: JSON.stringify(config),
        }
        if (editingItem) {
          await cleanRuleApi.edit({ ...payload, id: Number(editingItem.id) })
          message.success('编辑成功')
        } else {
          await cleanRuleApi.add(payload)
          message.success('新增成功')
        }
        setIsModalVisible(false)
        form.resetFields()
        loadList()
      } catch {
        message.error('保存失败，请重试')
      } finally {
        setSubmitting(false)
      }
    }).catch(() => {})
  }

  const handleDelete = (id: string | number) => {
    modal.confirm({
      title: '确认删除',
      content: '确定要删除该清洗规则吗？',
      okText: '确定',
      cancelText: '取消',
      onOk: async () => {
        try {
          await cleanRuleApi.remove(Number(id))
          message.success('删除成功')
          loadList()
        } catch {
          message.error('删除失败')
        }
      },
    })
  }

  const toggleStatus = async (id: string | number, enabled: boolean) => {
    try {
      await cleanRuleApi.changeStatus(Number(id), enabled ? 0 : 1)
      loadList()
    } catch {
      message.error('状态更新失败')
    }
  }

  const handleDataTypeChange = (value: string) => {
    setSelectedDataType(value)
    form.setFieldsValue({ fieldName: '' })
  }

  const columns = [
    { title: '规则名称', dataIndex: 'ruleName', key: 'ruleName', width: 180 },
    { title: '数据类型', dataIndex: 'dataType', key: 'dataType', width: 120, render: (text: string) => dataTypeOptions.find(opt => opt.value === text)?.label || text },
    { title: '字段名称', dataIndex: 'fieldName', key: 'fieldName', width: 100, render: (text: string, record: CleanRule) => fieldOptions[record.dataType]?.find(opt => opt.value === text)?.label || text },
    { title: '规则类型', dataIndex: 'ruleType', key: 'ruleType', width: 110, render: (text: string) => ruleTypeOptions.find(opt => opt.value === text)?.label || text },
    { title: '处理动作', dataIndex: 'action', key: 'action', width: 80, render: (text: string) => actionOptions.find(opt => opt.value === text)?.label || text },
    { title: '优先级', dataIndex: 'priority', key: 'priority', width: 60, align: 'center' as const },
    { title: '状态', dataIndex: 'enabled', key: 'enabled', width: 70, render: (text: boolean, record: CleanRule) => (<Switch checked={text} onChange={() => toggleStatus(record.id, text)} checkedChildren="启用" unCheckedChildren="禁用" />) },
    {
      title: '操作', key: 'actions', width: 160, align: 'center' as const, render: (_: unknown, record: CleanRule) => (
        <div className="flex items-center gap-1 justify-center">
          <Button type="link" size="small" icon={<EyeOutlined />} className="!text-[#03FBFD] !p-0 hover:!text-white" onClick={() => showDetailModal(record)}>详情</Button>
          <Button type="link" size="small" icon={<EditOutlined />} className="!text-[#03FBFD] !p-0 hover:!text-white" onClick={() => showEditModal(record)}>编辑</Button>
          <Button type="link" size="small" danger icon={<DeleteOutlined />} className="!p-0" onClick={() => handleDelete(record.id)}>删除</Button>
        </div>
      )
    },
  ]

  return (
    <div className="alert-page-container">
      <div className="alert-header-bar">
        <div className="header-left">
          <Button
            type="text"
            icon={<ArrowLeftOutlined />}
            onClick={() => navigate('/monitor')}
            className="!text-[#03FBFD] hover:!text-white !px-2 !h-28px"
          >
            返回监控大屏
          </Button>
        </div>

        <div className="header-right">
          <Button
            type="primary"
            icon={<PlusOutlined />}
            onClick={showAddModal}
            style={{
              background: 'linear-gradient(90deg, #1890ff 0%, #03fbfd 100%)',
              borderColor: '#03fbfd',
              fontWeight: 600,
              boxShadow: '0 0 10px rgba(3, 251, 253, 0.3)',
            }}
          >
            新增规则
          </Button>
        </div>
      </div>

      <div className="flex items-center justify-center flex-shrink-0 mb-2">
        <div className="alert-center-title" style={{ position: 'static', transform: 'none' }}>
          <span className="title-diamond">◆</span>
          <span>数据清洗规则管理</span>
          <span className="title-diamond">◆</span>
        </div>
      </div>

      <div className="flex items-center gap-3 flex-shrink-0 mb-3">
        <Input.Search
          placeholder="搜索规则名称"
          value={searchName}
          onChange={e => setSearchName(e.target.value)}
          onSearch={applySearch}
          onClear={() => applySearch('')}
          allowClear
          className="max-w-220px model_from_input"
        />
        <Select
          className="w-160px model_from_sel" classNames={{ popup: { root: 'alert-rule-dropdown' } }}
          placeholder="筛选数据类型"
          value={filterDataType}
          onChange={v => { setFilterDataType(v); setPageNum(1) }}
          options={dataTypeOptions}
          allowClear
        />
        <Select
          className="w-160px model_from_sel" classNames={{ popup: { root: 'alert-rule-dropdown' } }}
          placeholder="筛选规则类型"
          value={filterRuleType}
          onChange={v => { setFilterRuleType(v); setPageNum(1) }}
          options={ruleTypeOptions}
          allowClear
        />
        <Select
          className="w-160px model_from_sel" classNames={{ popup: { root: 'alert-rule-dropdown' } }}
          placeholder="筛选处理动作"
          value={filterAction}
          onChange={v => { setFilterAction(v); setPageNum(1) }}
          options={actionOptions}
          allowClear
        />
        <Select
          className="w-140px model_from_sel" classNames={{ popup: { root: 'alert-rule-dropdown' } }}
          placeholder="筛选状态"
          value={filterEnabled}
          onChange={v => { setFilterEnabled(v); setPageNum(1) }}
          options={[
            { value: 1, label: '启用' },
            { value: 0, label: '禁用' },
          ]}
          allowClear
        />
      </div>

      <div className="tech-table-wrapper">
        <Table
          dataSource={data}
          columns={columns}
          rowKey="id"
          loading={loading}
          pagination={{
            current: pageNum,
            pageSize,
            total,
            showSizeChanger: true,
            onChange: (p, ps) => { setPageNum(p); setPageSize(ps) },
          }}
          size="small"
          scroll={{ x: 880 }}
        />
      </div>

      <Modal
        title={<span className="alert-rule-modal-title">{editingItem ? '编辑规则' : '新增规则'}</span>}
        open={isModalVisible}
        onCancel={() => { setIsModalVisible(false); form.resetFields() }}
        width={860}
        className="alert-rule-modal"
        footer={[
          <Button key="cancel" onClick={() => { setIsModalVisible(false); form.resetFields() }}>取消</Button>,
          <Button key="ok" type="primary" loading={submitting} onClick={handleOk}>确定</Button>,
        ]}
      >
        <Form
          form={form}
          layout="horizontal"
          labelCol={{ style: { width: 100, textAlign: 'right', color: '#03FBFD', paddingRight: 10 } }}
          className="alert-rule-form pt-2"
        >
          <Form.Item label="规则名称" name="ruleName" rules={[{ required: true, message: '请输入规则名称' }]}>
            <Input className="model_from_input" placeholder="请输入规则名称" />
          </Form.Item>

          <div className="grid grid-cols-2 gap-x-2">
            <Form.Item label="数据类型" name="dataType" rules={[{ required: true, message: '请选择数据类型' }]}>
              <Select className="model_from_sel" popupClassName="alert-rule-dropdown" placeholder="请选择数据类型" onChange={handleDataTypeChange}>
                {dataTypeOptions.map(opt => <Option key={opt.value} value={opt.value}>{opt.label}</Option>)}
              </Select>
            </Form.Item>
            <Form.Item label="字段名称" name="fieldName" rules={[{ required: true, message: '请选择字段名称' }]}>
              <Select className="model_from_sel" popupClassName="alert-rule-dropdown" placeholder="请选择字段名称">
                {selectedDataType && fieldOptions[selectedDataType]?.map(opt => <Option key={opt.value} value={opt.value}>{opt.label}</Option>)}
              </Select>
            </Form.Item>
          </div>

          <div className="grid grid-cols-2 gap-x-2">
            <Form.Item label="规则类型" name="ruleType" rules={[{ required: true, message: '请选择规则类型' }]}>
              <Select className="model_from_sel" popupClassName="alert-rule-dropdown" placeholder="请选择规则类型">
                {ruleTypeOptions.map(opt => <Option key={opt.value} value={opt.value}>{opt.label}</Option>)}
              </Select>
            </Form.Item>
            <Form.Item label="处理动作" name="action" rules={[{ required: true, message: '请选择处理动作' }]}>
              <Select className="model_from_sel" popupClassName="alert-rule-dropdown" placeholder="请选择处理动作">
                {actionOptions.map(opt => <Option key={opt.value} value={opt.value}>{opt.label}</Option>)}
              </Select>
            </Form.Item>
          </div>

          <div className="grid grid-cols-2 gap-x-2">
            <Form.Item label="优先级" name="priority" rules={[{ required: true, message: '请输入优先级' }]}>
              <InputNumber min={1} max={100} className="w-full model_from_input" placeholder="数值越小越优先" />
            </Form.Item>
            <Form.Item label="是否启用" name="enabled" valuePropName="checked" initialValue={true}>
              <Switch checkedChildren="启用" unCheckedChildren="禁用" />
            </Form.Item>
          </div>

          <Form.Item label="描述说明" name="description">
            <Input.TextArea className="model_from_input" rows={3} placeholder="请输入描述" />
          </Form.Item>

          <Form.Item noStyle shouldUpdate={(prevValues, currentValues) => prevValues.ruleType !== currentValues.ruleType}>
            {({ getFieldValue }) => {
              const ruleType = getFieldValue('ruleType')
              if (ruleType === 'range') {
                return (
                  <div className="grid grid-cols-2 gap-4">
                    <Form.Item label="最小值" name="min" rules={[{ required: true, message: '请输入最小值' }]}><InputNumber className="w-full" /></Form.Item>
                    <Form.Item label="最大值" name="max" rules={[{ required: true, message: '请输入最大值' }]}><InputNumber className="w-full" /></Form.Item>
                  </div>
                )
              } else if (ruleType === 'enum') {
                return <Form.Item label="允许值列表" name="enumValues" rules={[{ required: true, message: '请输入允许值，用逗号分隔' }]}><Input placeholder="例如：低,中,高" /></Form.Item>
              } else if (ruleType === 'format') {
                return <Form.Item label="正则表达式" name="pattern" rules={[{ required: true, message: '请输入正则表达式' }]}><Input placeholder="例如：^\\d+$" /></Form.Item>
              }
              return null
            }}
          </Form.Item>
        </Form>
      </Modal>

      <Modal
        title={<span className="alert-rule-modal-title">清洗规则详情</span>}
        open={isDetailModalVisible}
        onCancel={() => setIsDetailModalVisible(false)}
        footer={null}
        width={550}
        loading={detailLoading}
        className="alert-rule-modal"
      >
        {editingItem && (
          <div className="space-y-3 p-4 rounded text-white/85" style={{ backgroundColor: 'rgba(3,251,253,0.05)', border: '1px solid rgba(3,251,253,0.15)' }}>
            <div className="flex justify-between"><span className="text-[#03FBFD]">规则名称</span><span>{editingItem.ruleName}</span></div>
            <div className="flex justify-between"><span className="text-[#03FBFD]">数据类型</span><span>{dataTypeOptions.find(o => o.value === editingItem.dataType)?.label}</span></div>
            <div className="flex justify-between"><span className="text-[#03FBFD]">字段名称</span><span>{fieldOptions[editingItem.dataType]?.find(o => o.value === editingItem.fieldName)?.label || editingItem.fieldName}</span></div>
            <div className="flex justify-between"><span className="text-[#03FBFD]">规则类型</span><span>{ruleTypeOptions.find(o => o.value === editingItem.ruleType)?.label}</span></div>
            <div className="flex justify-between"><span className="text-[#03FBFD]">处理动作</span><span>{actionOptions.find(o => o.value === editingItem.action)?.label}</span></div>
            <div className="flex justify-between"><span className="text-[#03FBFD]">优先级</span><span>{editingItem.priority}</span></div>
            <div className="flex justify-between"><span className="text-[#03FBFD]">状态</span><span className={editingItem.enabled ? 'text-green-400' : 'text-gray-400'}>{editingItem.enabled ? '已启用' : '已禁用'}</span></div>
            <div><span className="text-[#03FBFD] block mb-1">描述</span><p className="text-white/70 text-sm">{editingItem.description}</p></div>
          </div>
        )}
      </Modal>
    </div>
  )
}

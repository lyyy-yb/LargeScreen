import { useState } from 'react'
import { Button, Table, Modal, Form, Input, Select, Switch, Card, InputNumber, message } from 'antd'
import { PlusOutlined, EditOutlined, EyeOutlined, AlertFilled, FilterOutlined } from '@ant-design/icons'

const { Option } = Select

interface CleanRule {
  id: string
  ruleName: string
  dataType: string
  fieldName: string
  ruleType: string
  action: string
  enabled: boolean
  priority: number
  description: string
  config: Record<string, any>
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
    { value: 'o3', label: 'O\u2083' }, { value: 'monitorTime', label: '监测时间' },
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

const mockData: CleanRule[] = [
  { id: '1', ruleName: 'PM2.5浓度范围校验', dataType: 'air_quality_station', fieldName: 'pm25', ruleType: 'range', action: 'discard', enabled: true, priority: 1, description: 'PM2.5浓度值必须在0-1000 \u03bcg/m\u00b3范围内', config: { min: 0, max: 1000 } },
  { id: '2', ruleName: 'GPS坐标有效性校验', dataType: 'mobile_monitor_car', fieldName: 'latitude', ruleType: 'range', action: 'mark', enabled: true, priority: 2, description: '纬度必须在-90到90之间', config: { min: -90, max: 90 } },
  { id: '3', ruleName: '高度范围校验', dataType: 'drone_sensor', fieldName: 'altitude', ruleType: 'range', action: 'alert', enabled: true, priority: 1, description: '飞行高度不能超过500米', config: { min: 0, max: 500 } },
  { id: '4', ruleName: '功率因数校验', dataType: 'power_monitor', fieldName: 'powerFactor', ruleType: 'range', action: 'correct', enabled: true, priority: 2, description: '功率因数必须在0-1之间', config: { min: 0, max: 1 } },
  { id: '5', ruleName: '监测时间必填', dataType: 'manual_import', fieldName: 'checkTime', ruleType: 'required', action: 'discard', enabled: true, priority: 1, description: '检测时间为必填字段', config: {} },
  { id: '6', ruleName: '报警级别枚举校验', dataType: 'radar_station', fieldName: 'alarmLevel', ruleType: 'enum', action: 'mark', enabled: false, priority: 3, description: '报警级别只能为低、中、高', config: { values: ['低', '中', '高'] } },
]

export default function CleanRule() {
  const [data, setData] = useState<CleanRule[]>(mockData)
  const [isModalVisible, setIsModalVisible] = useState(false)
  const [isDetailModalVisible, setIsDetailModalVisible] = useState(false)
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
    form.setFieldsValue(record)
    setIsModalVisible(true)
  }

  const showDetailModal = (record: CleanRule) => {
    setEditingItem(record)
    setIsDetailModalVisible(true)
  }

  const handleOk = () => {
    form.validateFields().then(values => {
      const config: Record<string, any> = {}
      if (values.ruleType === 'range') {
        config.min = values.min
        config.max = values.max
      } else if (values.ruleType === 'enum') {
        config.values = values.enumValues?.split(',').map((v: string) => v.trim()) || []
      } else if (values.ruleType === 'format') {
        config.pattern = values.pattern
      }
      const newRule: CleanRule = { ...values, id: editingItem?.id || String(Date.now()), config }
      if (editingItem) {
        setData(data.map(item => item.id === editingItem.id ? newRule : item))
        message.success('编辑成功')
      } else {
        setData([...data, newRule])
        message.success('新增成功')
      }
      setIsModalVisible(false)
      form.resetFields()
    })
  }

  const handleDelete = (id: string) => {
    Modal.confirm({
      title: '确认删除',
      content: '确定要删除该清洗规则吗？',
      okText: '确定',
      cancelText: '取消',
      onOk: () => { setData(data.filter(item => item.id !== id)); message.success('删除成功') },
    })
  }

  const toggleStatus = (id: string, enabled: boolean) => {
    setData(data.map(item => item.id === id ? { ...item, enabled: !enabled } : item))
  }

  const handleDataTypeChange = (value: string) => {
    setSelectedDataType(value)
    form.setFieldsValue({ fieldName: '' })
  }

  const columns = [
    { title: '规则名称', dataIndex: 'ruleName', key: 'ruleName', width: 180 },
    { title: '数据类型', dataIndex: 'dataType', key: 'dataType', width: 120, render: (text: string) => dataTypeOptions.find(opt => opt.value === text)?.label || text },
    { title: '字段名称', dataIndex: 'fieldName', key: 'fieldName', width: 100, render: (text: string, record: CleanRule) => fieldOptions[record.dataType]?.find(opt => opt.value === text)?.label || text },
    { title: '规则类型', dataIndex: 'ruleType', key: 'ruleType', width: 120, render: (text: string) => ruleTypeOptions.find(opt => opt.value === text)?.label || text },
    { title: '处理动作', dataIndex: 'action', key: 'action', width: 100, render: (text: string) => actionOptions.find(opt => opt.value === text)?.label || text },
    { title: '优先级', dataIndex: 'priority', key: 'priority', width: 80, align: 'center' as const },
    { title: '状态', dataIndex: 'enabled', key: 'enabled', width: 80, render: (text: boolean, record: CleanRule) => (<Switch checked={text} onChange={() => toggleStatus(record.id, text)} checkedChildren="启用" unCheckedChildren="禁用" />) },
    { title: '操作', key: 'actions', width: 200, render: (_: unknown, record: CleanRule) => (
      <div className="flex gap-2">
        <Button size="small" icon={<EyeOutlined />} onClick={() => showDetailModal(record)}>详情</Button>
        <Button size="small" icon={<EditOutlined />} onClick={() => showEditModal(record)}>编辑</Button>
        <Button size="small" icon={<AlertFilled />} danger onClick={() => handleDelete(record.id)}>删除</Button>
      </div>
    )},
  ]

  return (
    <div className="w-full h-full bg-gradient-to-br from-[#000a1a] via-[#001a33] to-[#002a5c] p-6 overflow-y-auto">
      <div className="flex justify-between items-center mb-6">
        <div className="flex items-center gap-3">
          <FilterOutlined className="text-purple-400 text-2xl" />
          <h2 className="text-2xl font-bold text-[#03FBFD]">数据清洗规则管理</h2>
        </div>
        <Button type="primary" icon={<PlusOutlined />} onClick={showAddModal}>新增规则</Button>
      </div>

      <Card className="bg-[rgba(0,56,129,0.6)] border border-[rgba(255,255,255,0.3)]">
        <Table dataSource={data} columns={columns} rowKey="id" pagination={{ pageSize: 10 }} size="small" />
      </Card>

      <Modal title={editingItem ? '编辑清洗规则' : '新增清洗规则'} open={isModalVisible} onOk={handleOk} onCancel={() => { setIsModalVisible(false); form.resetFields() }} width={600} okText="确定" cancelText="取消">
        <Form form={form} layout="vertical">
          <Form.Item label="规则名称" name="ruleName" rules={[{ required: true, message: '请输入规则名称' }]}>
            <Input placeholder="请输入规则名称" />
          </Form.Item>
          <Form.Item label="数据类型" name="dataType" rules={[{ required: true, message: '请选择数据类型' }]}>
            <Select placeholder="请选择数据类型" onChange={handleDataTypeChange}>
              {dataTypeOptions.map(opt => <Option key={opt.value} value={opt.value}>{opt.label}</Option>)}
            </Select>
          </Form.Item>
          <Form.Item label="字段名称" name="fieldName" rules={[{ required: true, message: '请选择字段名称' }]}>
            <Select placeholder="请选择字段名称">
              {selectedDataType && fieldOptions[selectedDataType]?.map(opt => (<Option key={opt.value} value={opt.value}>{opt.label}</Option>))}
            </Select>
          </Form.Item>
          <Form.Item label="规则类型" name="ruleType" rules={[{ required: true, message: '请选择规则类型' }]}>
            <Select placeholder="请选择规则类型">
              {ruleTypeOptions.map(opt => <Option key={opt.value} value={opt.value}>{opt.label}</Option>)}
            </Select>
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
          <Form.Item label="处理动作" name="action" rules={[{ required: true, message: '请选择处理动作' }]}>
            <Select placeholder="请选择处理动作">
              {actionOptions.map(opt => <Option key={opt.value} value={opt.value}>{opt.label}</Option>)}
            </Select>
          </Form.Item>
          <Form.Item label="优先级" name="priority" rules={[{ required: true, message: '请输入优先级' }]}>
            <InputNumber min={1} max={10} className="w-full" />
          </Form.Item>
          <Form.Item label="描述" name="description">
            <Input.TextArea placeholder="请输入描述" rows={3} />
          </Form.Item>
        </Form>
      </Modal>

      <Modal title="规则详情" open={isDetailModalVisible} onCancel={() => setIsDetailModalVisible(false)} width={600} footer={null}>
        {editingItem && (
          <div className="space-y-4">
            <div className="flex justify-between"><span className="text-gray-400">规则名称</span><span>{editingItem.ruleName}</span></div>
            <div className="flex justify-between"><span className="text-gray-400">数据类型</span><span>{dataTypeOptions.find(opt => opt.value === editingItem.dataType)?.label}</span></div>
            <div className="flex justify-between"><span className="text-gray-400">字段名称</span><span>{fieldOptions[editingItem.dataType]?.find(opt => opt.value === editingItem.fieldName)?.label}</span></div>
            <div className="flex justify-between"><span className="text-gray-400">规则类型</span><span>{ruleTypeOptions.find(opt => opt.value === editingItem.ruleType)?.label}</span></div>
            <div className="flex justify-between"><span className="text-gray-400">处理动作</span><span>{actionOptions.find(opt => opt.value === editingItem.action)?.label}</span></div>
            <div className="flex justify-between"><span className="text-gray-400">优先级</span><span>{editingItem.priority}</span></div>
            <div className="flex justify-between"><span className="text-gray-400">状态</span><span className={editingItem.enabled ? 'text-green-500' : 'text-gray-400'}>{editingItem.enabled ? '已启用' : '已禁用'}</span></div>
            <div className="flex justify-between"><span className="text-gray-400">规则配置</span><span className="font-mono text-sm">{JSON.stringify(editingItem.config)}</span></div>
            <div className="pt-2"><span className="text-gray-400 block mb-2">描述</span><p className="bg-[rgba(0,56,129,0.3)] p-3 rounded">{editingItem.description}</p></div>
          </div>
        )}
      </Modal>
    </div>
  )
}

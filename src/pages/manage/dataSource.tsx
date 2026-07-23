import { useState } from 'react'
import { Button, Table, Modal, Form, Input, Select, Switch, Card, message } from 'antd'
import { PlusOutlined, EditOutlined, EyeOutlined, CheckCircleOutlined, AlertFilled, SearchOutlined, DatabaseOutlined } from '@ant-design/icons'

const { Option } = Select

interface FieldConfig {
  name: string
  unit: string
}

interface DataSourceItem {
  id: string
  name: string
  type: string
  protocol: string
  status: string
  connectionStatus: string
  createdAt: string
  description: string
  fields?: FieldConfig[]
}

const typeOptions = [
  { value: 'air_quality_station', label: '空气质量检测站' },
  { value: 'mobile_monitor_car', label: '走航车' },
  { value: 'drone_video', label: '无人机视频' },
  { value: 'drone_sensor', label: '无人机传感器' },
  { value: 'power_monitor', label: '用电监控' },
  { value: 'radar_station', label: '雷达站' },
  { value: 'manual_import', label: '人工采集导入' },
]

const protocolOptions = [
  { value: 'http', label: 'HTTP/HTTPS' },
  { value: 'mqtt', label: 'MQTT' },
  { value: 'websocket', label: 'WebSocket' },
  { value: 'file', label: '文件导入' },
]

const mockData: DataSourceItem[] = [
  { id: '1', name: '杭州市环境监测站-1', type: 'air_quality_station', protocol: 'http', status: 'enabled', connectionStatus: 'online', createdAt: '2025-11-01 10:00:00', description: '实时监测PM2.5、PM10等污染物浓度' },
  { id: '2', name: '走航车-HYD1009', type: 'mobile_monitor_car', protocol: 'mqtt', status: 'enabled', connectionStatus: 'online', createdAt: '2025-11-02 14:30:00', description: '杭州区域走航监测' },
  { id: '3', name: '无人机机场-临平', type: 'drone_sensor', protocol: 'websocket', status: 'enabled', connectionStatus: 'online', createdAt: '2025-11-03 09:15:00', description: '无人机传感器数据接入' },
  { id: '4', name: '工厂用电监控-萧山', type: 'power_monitor', protocol: 'mqtt', status: 'enabled', connectionStatus: 'offline', createdAt: '2025-11-04 16:45:00', description: '工业用电数据监测' },
  { id: '5', name: '光量子雷达-西湖', type: 'radar_station', protocol: 'http', status: 'enabled', connectionStatus: 'online', createdAt: '2025-11-05 11:20:00', description: '污染物报警点位监测' },
  { id: '6', name: '人工采集数据', type: 'manual_import', protocol: '', status: 'enabled', connectionStatus: 'online', createdAt: '2025-11-06 08:00:00', description: '人工导入检测数据', fields: [] },
  {
    id: '7',
    name: '自定义采集-MS',
    type: 'manual_import',
    protocol: '',
    status: 'enabled',
    connectionStatus: 'online',
    createdAt: '2025-11-07 09:00:00',
    description: 'TVOCs人工采集数据',
    fields: [
      { name: '测量时间', unit: '' },
      { name: '经度', unit: '度' },
      { name: '纬度', unit: '度' },
      { name: 'TVOCs', unit: 'ppb' },
    ]
  },
  {
    id: '8',
    name: '自定义采集-NOX',
    type: 'manual_import',
    protocol: '',
    status: 'enabled',
    connectionStatus: 'online',
    createdAt: '2025-11-08 10:00:00',
    description: '氮氧化物人工采集数据',
    fields: [
      { name: '测量时间', unit: '' },
      { name: '经度', unit: '度' },
      { name: '纬度', unit: '度' },
      { name: 'NOX', unit: 'μg/m³' },
      { name: 'NO2', unit: 'μg/m³' },
      { name: 'NO', unit: 'μg/m³' },
    ]
  },
]

export default function DataSource() {
  const [data, setData] = useState<DataSourceItem[]>(mockData)
  const [isModalVisible, setIsModalVisible] = useState(false)
  const [isDetailModalVisible, setIsDetailModalVisible] = useState(false)
  const [editingItem, setEditingItem] = useState<DataSourceItem | null>(null)
  const [selectedType, setSelectedType] = useState<string>('')
  const [form] = Form.useForm()

  const handleTypeChange = (value: string) => {
    setSelectedType(value)
    if (value === 'manual_import') {
      form.setFieldValue('protocol', '')
    }
  }

  const showAddModal = () => {
    setEditingItem(null)
    setSelectedType('')
    form.resetFields()
    setIsModalVisible(true)
  }

  const showEditModal = (record: DataSourceItem) => {
    setEditingItem(record)
    setSelectedType(record.type)
    form.setFieldsValue({ ...record, fields: record.fields || [] })
    setIsModalVisible(true)
  }

  const showDetailModal = (record: DataSourceItem) => {
    setEditingItem(record)
    setIsDetailModalVisible(true)
  }

  const handleOk = () => {
    form.validateFields().then(values => {
      const fields = values.fields || []
      const cleanedFields = fields.filter((f: FieldConfig) => f && f.name && f.name.trim())
      if (editingItem) {
        setData(data.map(item => item.id === editingItem.id ? { ...item, ...values, fields: cleanedFields } : item))
        message.success('编辑成功')
      } else {
        const newItem: DataSourceItem = {
          ...values,
          id: String(Date.now()),
          connectionStatus: 'online',
          createdAt: new Date().toLocaleString('zh-CN'),
          fields: cleanedFields,
        }
        setData([...data, newItem])
        message.success('新增成功')
      }
      setIsModalVisible(false)
      form.resetFields()
    })
  }

  const handleDelete = (id: string) => {
    Modal.confirm({
      title: '确认删除',
      content: '确定要删除该数据源吗？',
      okText: '确定',
      cancelText: '取消',
      onOk: () => {
        setData(data.filter(item => item.id !== id))
        message.success('删除成功')
      },
    })
  }

  const toggleStatus = (id: string, status: string) => {
    setData(data.map(item => item.id === id ? { ...item, status: status === 'enabled' ? 'disabled' : 'enabled' } : item))
  }

  const getStatusIcon = (status: string) => {
    if (status === 'online') return <CheckCircleOutlined className="text-green-500" />
    if (status === 'offline') return <AlertFilled className="text-red-500" />
    return <SearchOutlined className="text-yellow-500" />
  }

  const getStatusText = (status: string) => {
    if (status === 'online') return '在线'
    if (status === 'offline') return '离线'
    return '异常'
  }

  const columns = [
    { title: '数据源名称', dataIndex: 'name', key: 'name', width: 150 },
    {
      title: '接入类型', dataIndex: 'type', key: 'type', width: 120,
      render: (text: string) => typeOptions.find(opt => opt.value === text)?.label || text
    },
    {
      title: '接入协议', dataIndex: 'protocol', key: 'protocol', width: 100,
      render: (text: string) => protocolOptions.find(opt => opt.value === text)?.label || text || '-'
    },
    {
      title: '连接状态', dataIndex: 'connectionStatus', key: 'connectionStatus', width: 100,
      render: (text: string) => (
        <span className="flex items-center gap-2">
          {getStatusIcon(text)}
          <span className={text === 'online' ? 'text-green-500' : text === 'offline' ? 'text-red-500' : 'text-yellow-500'}>
            {getStatusText(text)}
          </span>
        </span>
      )
    },
    {
      title: '启用状态', dataIndex: 'status', key: 'status', width: 100,
      render: (text: string, record: DataSourceItem) => (
        <Switch checked={text === 'enabled'} onChange={() => toggleStatus(record.id, text)} checkedChildren="启用" unCheckedChildren="禁用" />
      )
    },
    { title: '创建时间', dataIndex: 'createdAt', key: 'createdAt', width: 160 },
    {
      title: '操作', key: 'actions', width: 200,
      render: (_: unknown, record: DataSourceItem) => (
        <div className="flex gap-2">
          <Button size="small" icon={<EyeOutlined />} onClick={() => showDetailModal(record)}>详情</Button>
          <Button size="small" icon={<EditOutlined />} onClick={() => showEditModal(record)}>编辑</Button>
          <Button size="small" icon={<AlertFilled />} danger onClick={() => handleDelete(record.id)}>删除</Button>
        </div>
      )
    },
  ]

  return (
    <div className="w-full h-full bg-gradient-to-br from-[#000a1a] via-[#001a33] to-[#002a5c] p-6 overflow-y-auto">
      <div className="flex justify-between items-center mb-6">
        <div className="flex items-center gap-3">
          <DatabaseOutlined className="text-cyan-400 text-2xl" />
          <h2 className="text-2xl font-bold text-[#03FBFD]">数据接入管理</h2>
        </div>
        <Button type="primary" icon={<PlusOutlined />} onClick={showAddModal}>新增数据源</Button>
      </div>

      <Card className="bg-[rgba(0,56,129,0.6)] border border-[rgba(255,255,255,0.3)]">
        <Table dataSource={data} columns={columns} rowKey="id" pagination={{ pageSize: 10 }} size="small" />
      </Card>

      <Modal
        title={editingItem ? '编辑数据源' : '新增数据源'}
        open={isModalVisible}
        onOk={handleOk}
        onCancel={() => { setIsModalVisible(false); form.resetFields() }}
        width={600}
        okText="确定"
        cancelText="取消"
      >
        <Form form={form} layout="vertical">
          <Form.Item label="数据源名称" name="name" rules={[{ required: true, message: '请输入数据源名称' }]}>
            <Input placeholder="请输入数据源名称" />
          </Form.Item>
          <Form.Item label="接入类型" name="type" rules={[{ required: true, message: '请选择接入类型' }]}>
            <Select placeholder="请选择接入类型" onChange={handleTypeChange}>
              {typeOptions.map(opt => <Option key={opt.value} value={opt.value}>{opt.label}</Option>)}
            </Select>
          </Form.Item>
          {selectedType !== 'manual_import' && (
            <Form.Item label="接入协议" name="protocol" rules={[{ required: true, message: '请选择接入协议' }]}>
              <Select placeholder="请选择接入协议">
                {protocolOptions.map(opt => <Option key={opt.value} value={opt.value}>{opt.label}</Option>)}
              </Select>
            </Form.Item>
          )}
          {selectedType === 'manual_import' && (
            <Form.Item label="采集字段配置">
              <div className="border border-[rgba(255,255,255,0.2)] p-3 rounded">
                <div className="flex gap-2 mb-2">
                  <span className="text-sm flex-1">字段名称</span>
                  <span className="text-sm flex-1">单位</span>
                </div>
                <Form.List name="fields">
                  {(fields, { add, remove }) => (
                    <div className="space-y-2">
                      {fields.map((field) => (
                        <div key={field.key} className="flex gap-2">
                          <Form.Item {...field} name={[field.name, 'name']} noStyle rules={[{ required: true, message: '请输入字段名称' }]}>
                            <Input placeholder="字段名称（如：测量时间、TVOCs）" className="flex-1" />
                          </Form.Item>
                          <Form.Item {...field} name={[field.name, 'unit']} noStyle>
                            <Input placeholder="单位（如：ppb、μg/m³）" className="flex-1" />
                          </Form.Item>
                          <Button type="dashed" onClick={() => remove(field.name)} danger>删除</Button>
                        </div>
                      ))}
                      <Button type="dashed" onClick={() => add({ name: '', unit: '' })} block>添加字段</Button>
                    </div>
                  )}
                </Form.List>
              </div>
            </Form.Item>
          )}
          <Form.Item label="描述" name="description">
            <Input.TextArea placeholder="请输入描述" rows={3} />
          </Form.Item>
        </Form>
      </Modal>

      <Modal
        title="数据源详情"
        open={isDetailModalVisible}
        onCancel={() => setIsDetailModalVisible(false)}
        width={500}
        footer={null}
      >
        {editingItem && (
          <div className="space-y-4">
            <div className="flex justify-between"><span className="text-gray-400">数据源名称</span><span>{editingItem.name}</span></div>
            <div className="flex justify-between"><span className="text-gray-400">接入类型</span><span>{typeOptions.find(opt => opt.value === editingItem.type)?.label}</span></div>
            {editingItem.type !== 'manual_import' && (
              <div className="flex justify-between"><span className="text-gray-400">接入协议</span><span>{protocolOptions.find(opt => opt.value === editingItem.protocol)?.label || '-'}</span></div>
            )}
            {editingItem.type === 'manual_import' && editingItem.fields && editingItem.fields.length > 0 && (
              <div className="pt-2">
                <span className="text-gray-400 block mb-2">采集字段配置</span>
                <div className="bg-[rgba(0,56,129,0.3)] rounded p-3">
                  <table className="w-full">
                    <thead><tr><th className="text-left text-cyan-500 text-sm pb-2">字段名称</th><th className="text-left text-cyan-500 text-sm pb-2">单位</th></tr></thead>
                    <tbody>
                      {editingItem.fields.map((field, index) => (
                        <tr key={index}><td className="text-sm py-1">{field.name}</td><td className="text-sm py-1">{field.unit || '-'}</td></tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
            <div className="flex justify-between"><span className="text-gray-400">连接状态</span><span className={editingItem.connectionStatus === 'online' ? 'text-green-500' : 'text-red-500'}>{getStatusText(editingItem.connectionStatus)}</span></div>
            <div className="flex justify-between"><span className="text-gray-400">启用状态</span><span className={editingItem.status === 'enabled' ? 'text-green-500' : 'text-gray-400'}>{editingItem.status === 'enabled' ? '已启用' : '已禁用'}</span></div>
            <div className="flex justify-between"><span className="text-gray-400">创建时间</span><span>{editingItem.createdAt}</span></div>
            <div className="pt-2"><span className="text-gray-400 block mb-2">描述</span><p className="bg-[rgba(0,56,129,0.3)] p-3 rounded">{editingItem.description}</p></div>
          </div>
        )}
      </Modal>
    </div>
  )
}

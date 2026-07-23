import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Button, Table, Modal, Form, Input, Select, Switch, InputNumber, Tabs, Tag, message } from 'antd'
import { PlusOutlined, EditOutlined, EyeOutlined, AlertFilled, ArrowLeftOutlined, SearchOutlined, SendOutlined } from '@ant-design/icons'

const { Option } = Select

interface AlertRule {
  id: string; ruleName: string; dataType: string; fieldName: string;
  ruleType: string; alertLevel: string; priority: number; enabled: boolean;
  description: string; config: Record<string, any>; autoDispatch: boolean; targetCity: string;
}
interface AlertEvent {
  id: string; ruleName: string; alertLevel: string; dataType: string;
  deviceName: string; location: string; city: string; district: string;
  triggerReason: string; status: string; createdAt: string; assignedCity?: string;
}
interface DisposalTask {
  id: string; alertId: string; dataType: string; taskType: string; status: string;
  assigneeName: string; requesterName: string; requireTime: string; createdAt: string;
  disposalContent?: string; photos?: string[]; completedAt?: string;
  city: string; district: string; town?: string;
}

const dataTypeOptions = [
  { value: 'air_quality_station', label: '空气质量检测站' },
  { value: 'mobile_monitor_car', label: '走航车' },
  { value: 'drone_sensor', label: '无人机传感器' },
  { value: 'power_monitor', label: '用电监控' },
  { value: 'radar_station', label: '雷达站' },
]
const ruleTypeOptions = [
  { value: 'threshold', label: '数值阈值预警' },
  { value: 'change_rate', label: '变化率预警' },
  { value: 'continuous', label: '连续超标预警' },
  { value: 'offline', label: '离线预警' },
]
const alertLevelOptions = [
  { value: 'level1', label: '一级预警', color: '#FF4D4F' },
  { value: 'level2', label: '二级预警', color: '#FA8C16' },
  { value: 'level3', label: '三级预警', color: '#FAAD14' },
  { value: 'level4', label: '四级预警', color: '#1890FF' },
]
const taskTypeOptions = [
  { value: 'on_site_check', label: '现场核查' },
  { value: 'data_verification', label: '数据校验' },
  { value: 'vehicle_dispatch', label: '车辆调度' },
  { value: 'flight_dispatch', label: '飞行调度' },
  { value: 'enterprise_inspection', label: '企业巡查' },
]
const cityOptions = [
  { value: 'hangzhou', label: '杭州市' },
  { value: 'nanjing', label: '南京市' },
  { value: 'shanghai', label: '上海市' },
]
const townOptions = [
  { value: 'fengshan', label: '凤山街道' },
  { value: 'yangming', label: '阳明街道' },
  { value: 'lizhou', label: '梨洲街道' },
  { value: 'lanjiang', label: '兰江街道' },
  { value: 'langxia', label: '朗霞街道' },
  { value: 'ditang', label: '低塘街道' },
]

const fieldOptions: Record<string, { value: string; label: string }[]> = {
  air_quality_station: [
    { value: 'pm25', label: 'PM2.5' }, { value: 'pm10', label: 'PM10' },
    { value: 'tsp', label: 'TSP' }, { value: 'o3', label: 'O\u2083' },
  ],
  mobile_monitor_car: [{ value: 'pm25', label: 'PM2.5' }, { value: 'tsp', label: 'TSP' }],
  drone_sensor: [{ value: 'pm25', label: 'PM2.5' }, { value: 'pm10', label: 'PM10' }],
  power_monitor: [{ value: 'power', label: '功率' }, { value: 'powerFactor', label: '功率因数' }],
  radar_station: [{ value: 'alarmLevel', label: '报警级别' }, { value: 'alarmCount', label: '报警次数' }],
}

const mockRules: AlertRule[] = [
  { id: '1', ruleName: 'PM2.5浓度超标预警', dataType: 'air_quality_station', fieldName: 'pm25', ruleType: 'threshold', alertLevel: 'level2', priority: 1, enabled: true, description: 'PM2.5超过75触发', config: { threshold: 75, operator: '>' }, autoDispatch: false, targetCity: 'hangzhou' },
  { id: '2', ruleName: 'PM2.5严重超标预警', dataType: 'air_quality_station', fieldName: 'pm25', ruleType: 'threshold', alertLevel: 'level1', priority: 1, enabled: true, description: 'PM2.5超过150触发', config: { threshold: 150, operator: '>' }, autoDispatch: true, targetCity: 'hangzhou' },
  { id: '3', ruleName: '走航车TSP超标预警', dataType: 'mobile_monitor_car', fieldName: 'tsp', ruleType: 'threshold', alertLevel: 'level2', priority: 2, enabled: true, description: 'TSP超过300触发', config: { threshold: 300, operator: '>' }, autoDispatch: false, targetCity: 'hangzhou' },
  { id: '4', ruleName: '功率因数异常预警', dataType: 'power_monitor', fieldName: 'powerFactor', ruleType: 'threshold', alertLevel: 'level3', priority: 3, enabled: true, description: '功率因数低于0.9', config: { threshold: 0.9, operator: '<' }, autoDispatch: true, targetCity: 'hangzhou' },
  { id: '5', ruleName: 'PM2.5变化率预警', dataType: 'air_quality_station', fieldName: 'pm25', ruleType: 'change_rate', alertLevel: 'level2', priority: 2, enabled: true, description: '5分钟变化率超50%', config: { timeWindow: 5, rate: 50 }, autoDispatch: false, targetCity: 'hangzhou' },
]

const mockAlerts: AlertEvent[] = [
  { id: 'ALT001', ruleName: 'PM2.5浓度超标预警', alertLevel: 'level2', dataType: 'air_quality_station', deviceName: '杭州监测站-1', location: '西湖区', city: 'hangzhou', district: 'xihu', triggerReason: 'PM2.5达到85\u03bcg/m\u00b3，超过阈值75', status: 'pending', createdAt: '2025-11-24 14:30' },
  { id: 'ALT002', ruleName: 'PM2.5严重超标预警', alertLevel: 'level1', dataType: 'air_quality_station', deviceName: '杭州监测站-2', location: '萧山区工业园', city: 'hangzhou', district: 'xiaoshan', triggerReason: 'PM2.5达到168\u03bcg/m\u00b3，超过阈值150', status: 'processing', createdAt: '2025-11-24 13:45', assignedCity: 'hangzhou' },
  { id: 'ALT003', ruleName: '走航车TSP超标预警', alertLevel: 'level2', dataType: 'mobile_monitor_car', deviceName: 'HYD1009', location: '余杭区', city: 'hangzhou', district: 'yuhang', triggerReason: 'TSP达到356\u03bcg/m\u00b3，超过阈值300', status: 'pending', createdAt: '2025-11-24 12:20' },
  { id: 'ALT004', ruleName: '功率因数异常预警', alertLevel: 'level3', dataType: 'power_monitor', deviceName: '萧山工厂-1号', location: '萧山区', city: 'hangzhou', district: 'xiaoshan', triggerReason: '功率因数0.85，低于阈值0.9', status: 'completed', createdAt: '2025-11-24 10:15', assignedCity: 'hangzhou' },
  { id: 'ALT005', ruleName: 'PM2.5变化率预警', alertLevel: 'level2', dataType: 'air_quality_station', deviceName: '杭州监测站-3', location: '滨江区', city: 'hangzhou', district: 'binjiang', triggerReason: '5分钟变化率65%，超过阈值50%', status: 'pending', createdAt: '2025-11-24 08:45' },
]

const mockTasks: DisposalTask[] = [
  { id: 'TSK001', alertId: 'ALT002', dataType: 'air_quality_station', taskType: 'on_site_check', status: 'received', assigneeName: '张伟', requesterName: '李明', requireTime: '2025-11-24 15:30', createdAt: '2025-11-24 13:46', city: 'hangzhou', district: 'xiaoshan' },
  { id: 'TSK002', alertId: 'ALT003', dataType: 'mobile_monitor_car', taskType: 'vehicle_dispatch', status: 'processing', assigneeName: '王强', requesterName: '李明', requireTime: '2025-11-24 14:20', createdAt: '2025-11-24 12:21', city: 'hangzhou', district: 'yuhang' },
  { id: 'TSK003', alertId: 'ALT004', dataType: 'power_monitor', taskType: 'enterprise_inspection', status: 'completed', assigneeName: '陈刚', requesterName: '李明', requireTime: '2025-11-24 12:15', createdAt: '2025-11-24 10:16', disposalContent: '经现场核查，该企业设备老化导致功率因数偏低，已建议升级改造。', photos: ['p1.jpg', 'p2.jpg'], completedAt: '2025-11-24 11:45', city: 'hangzhou', district: 'xiaoshan' },
  { id: 'TSK004', alertId: 'ALT001', dataType: 'air_quality_station', taskType: 'data_verification', status: 'pending', assigneeName: '', requesterName: '李明', requireTime: '2025-11-24 16:00', createdAt: '2025-11-24 14:31', city: 'hangzhou', district: 'xihu' },
]

export default function AlertPage() {
  const navigate = useNavigate()
  const [rules, setRules] = useState<AlertRule[]>(mockRules)
  const [alerts, setAlerts] = useState<AlertEvent[]>(mockAlerts)
  const [tasks, setTasks] = useState<DisposalTask[]>(mockTasks)
  const [isRuleModalVisible, setIsRuleModalVisible] = useState(false)
  const [isAlertModalVisible, setIsAlertModalVisible] = useState(false)
  const [isTaskModalVisible, setIsTaskModalVisible] = useState(false)
  const [isDisposalModalVisible, setIsDisposalModalVisible] = useState(false)
  const [selectedAlert, setSelectedAlert] = useState<AlertEvent | null>(null)
  const [selectedTask, setSelectedTask] = useState<DisposalTask | null>(null)
  const [editingRule, setEditingRule] = useState<AlertRule | null>(null)
  const [form] = Form.useForm()
  const [selectedDataType, setSelectedDataType] = useState('')

  const showAddRuleModal = () => { setEditingRule(null); setSelectedDataType(''); form.resetFields(); setIsRuleModalVisible(true) }
  const showEditRuleModal = (r: AlertRule) => { setEditingRule(r); setSelectedDataType(r.dataType); form.setFieldsValue(r); setIsRuleModalVisible(true) }

  const handleRuleOk = () => {
    form.validateFields().then(values => {
      const config: Record<string, any> = {}
      if (values.ruleType === 'threshold') { config.threshold = values.threshold; config.operator = values.operator }
      else if (values.ruleType === 'change_rate') { config.timeWindow = values.timeWindow; config.rate = values.rate }
      else if (values.ruleType === 'continuous') { config.count = values.count; config.interval = values.interval }
      else if (values.ruleType === 'offline') { config.offlineTime = values.offlineTime }
      const newRule: AlertRule = { ...values, id: editingRule?.id || String(Date.now()), config }
      if (editingRule) setRules(rules.map(i => i.id === editingRule.id ? newRule : i))
      else setRules([...rules, newRule])
      setIsRuleModalVisible(false); form.resetFields(); message.success(editingRule ? '更新成功' : '创建成功')
    })
  }
  const handleDeleteRule = (id: string) => { Modal.confirm({ title: '确认删除', content: '确定删除该规则？', onOk: () => { setRules(rules.filter(i => i.id !== id)); message.success('删除成功') } }) }
  const toggleRule = (id: string, en: boolean) => setRules(rules.map(i => i.id === id ? { ...i, enabled: !en } : i))
  const confirmAlert = (id: string) => { setAlerts(alerts.map(i => i.id === id ? { ...i, status: 'processing' } : i)); message.success('已确认') }
  const closeAlert = (id: string) => { Modal.confirm({ title: '确认清除', content: '确定清除该预警？', onOk: () => setAlerts(alerts.map(i => i.id === id ? { ...i, status: 'closed' } : i)) }) }
  const dispatchTask = (alertId: string) => {
    const a = alerts.find(x => x.id === alertId)
    if (a) { const t: DisposalTask = { id: 'TSK' + Date.now().toString().slice(-3), alertId: a.id, dataType: a.dataType, taskType: 'on_site_check', status: 'pending', assigneeName: '', requesterName: '李明', requireTime: new Date(Date.now() + 3600000).toISOString().slice(0, 16).replace('T', ' '), createdAt: new Date().toISOString().slice(0, 19).replace('T', ' '), city: a.city, district: a.district }; setTasks([t, ...tasks]); setAlerts(alerts.map(i => i.id === alertId ? { ...i, status: 'processing' } : i)); Modal.success({ title: '派发成功' }) }
  }
  const updateTaskStatus = (id: string, s: string) => { setTasks(tasks.map(i => i.id === id ? { ...i, status: s } : i)); message.success('状态已更新') }
  const dispatchToTown = (task: DisposalTask) => {
    Modal.confirm({
      title: '任务下派',
      content: (
        <div className="space-y-2">
          <p>将任务 <b>{task.id}</b> 下派至乡镇处置：</p>
          <Select placeholder="选择乡镇" className="w-full" onChange={(v: string) => { (window as any).__townVal = v }}>
            {townOptions.map(o => <Option key={o.value} value={o.value}>{o.label}</Option>)}
          </Select>
        </div>
      ),
      onOk: () => {
        const town = townOptions.find(o => o.value === (window as any).__townVal)
        setTasks(tasks.map(i => i.id === task.id ? { ...i, town: town?.label || '乡镇', status: 'processing' } : i))
        message.success(`已下派至${town?.label || '乡镇'}`)
      },
    })
  }

  const ruleCols = [
    { title: '规则名称', dataIndex: 'ruleName', width: 160 },
    { title: '数据类型', dataIndex: 'dataType', width: 120, render: (t: string) => dataTypeOptions.find(o => o.value === t)?.label || t },
    { title: '字段', dataIndex: 'fieldName', width: 80, render: (t: string, r: AlertRule) => fieldOptions[r.dataType]?.find(o => o.value === t)?.label || t },
    { title: '规则类型', dataIndex: 'ruleType', width: 110, render: (t: string) => ruleTypeOptions.find(o => o.value === t)?.label || t },
    { title: '级别', dataIndex: 'alertLevel', width: 90, render: (t: string) => { const l = alertLevelOptions.find(o => o.value === t); return <Tag color={l?.color}>{l?.label}</Tag> } },
    { title: '优先级', dataIndex: 'priority', width: 60, align: 'center' as const },
    { title: '下发', dataIndex: 'autoDispatch', width: 60, render: (t: boolean) => <Tag color={t ? 'green' : 'gray'}>{t ? '是' : '否'}</Tag> },
    { title: '状态', dataIndex: 'enabled', width: 80, render: (t: boolean, r: AlertRule) => <Switch checked={t} size="small" onChange={() => toggleRule(r.id, t)} checkedChildren="启" unCheckedChildren="禁" /> },
    { title: '操作', width: 130, render: (_: unknown, r: AlertRule) => <div className="flex gap-1"><Button size="small" icon={<EditOutlined />} onClick={() => showEditRuleModal(r)}>编辑</Button><Button size="small" danger onClick={() => handleDeleteRule(r.id)}>删除</Button></div> },
  ]
  const alertCols = [
    { title: 'ID', dataIndex: 'id', width: 80 },
    { title: '规则名称', dataIndex: 'ruleName', width: 150 },
    { title: '级别', dataIndex: 'alertLevel', width: 90, render: (t: string) => { const l = alertLevelOptions.find(o => o.value === t); return <Tag color={l?.color}>{l?.label}</Tag> } },
    { title: '设备', dataIndex: 'deviceName', width: 120 },
    { title: '位置', dataIndex: 'location', width: 100 },
    { title: '状态', dataIndex: 'status', width: 80, render: (t: string) => { const m: Record<string, { l: string; c: string }> = { pending: { l: '待处置', c: 'orange' }, processing: { l: '处置中', c: 'blue' }, completed: { l: '已处置', c: 'green' }, closed: { l: '已关闭', c: 'default' } }; return <Tag color={m[t]?.c}>{m[t]?.l}</Tag> } },
    { title: '时间', dataIndex: 'createdAt', width: 130 },
    { title: '操作', width: 180, render: (_: unknown, r: AlertEvent) => <div className="flex gap-1"><Button size="small" icon={<EyeOutlined />} onClick={() => { setSelectedAlert(r); setIsAlertModalVisible(true) }}>详情</Button>{r.status === 'pending' && <><Button size="small" onClick={() => confirmAlert(r.id)}>确认</Button><Button size="small" type="primary" onClick={() => dispatchTask(r.id)}>派发</Button></>}{r.status !== 'closed' && r.status !== 'completed' && <Button size="small" danger onClick={() => closeAlert(r.id)}>清除</Button>}</div> },
  ]
  const taskCols = [
    { title: 'ID', dataIndex: 'id', width: 80 },
    { title: '预警', dataIndex: 'alertId', width: 80 },
    { title: '类型', dataIndex: 'taskType', width: 90, render: (t: string) => taskTypeOptions.find(o => o.value === t)?.label || t },
    { title: '状态', dataIndex: 'status', width: 80, render: (t: string) => { const m: Record<string, { l: string; c: string }> = { pending: { l: '待接收', c: 'orange' }, received: { l: '已接收', c: 'blue' }, processing: { l: '处置中', c: 'blue' }, completed: { l: '已完成', c: 'green' } }; return <Tag color={m[t]?.c}>{m[t]?.l}</Tag> } },
    { title: '处置人', dataIndex: 'assigneeName', width: 70, render: (t: string) => t || '未分配' },
    { title: '要求时间', dataIndex: 'requireTime', width: 130 },
    { title: '操作', width: 180, render: (_: unknown, r: DisposalTask) => <div className="flex gap-1"><Button size="small" onClick={() => { setSelectedTask(r); setIsTaskModalVisible(true) }}>详情</Button>{r.status === 'pending' && <Button size="small" onClick={() => updateTaskStatus(r.id, 'received')}>接收</Button>}{r.status === 'received' && <><Button size="small" onClick={() => updateTaskStatus(r.id, 'processing')}>处置</Button><Button size="small" icon={<SendOutlined />} onClick={() => dispatchToTown(r)}>下派</Button></>}{r.status === 'completed' && r.disposalContent && <Button size="small" type="primary" onClick={() => { setSelectedTask(r); setIsDisposalModalVisible(true) }}>查看</Button>}</div> },
  ]

  // 区域预警实时动向数据
  const alertTrends = [
    { time: '14:30', area: '西湖区', level: 'level2', content: 'PM2.5浓度85μg/m³超标', status: '待处置' },
    { time: '13:45', area: '萧山区', level: 'level1', content: 'PM2.5浓度168μg/m³严重超标', status: '处置中' },
    { time: '12:20', area: '余杭区', level: 'level2', content: 'TSP浓度356μg/m³超标', status: '待处置' },
    { time: '10:15', area: '萧山区', level: 'level3', content: '功率因数0.85异常', status: '已处置' },
    { time: '08:45', area: '滨江区', level: 'level2', content: 'PM2.5变化率65%超标', status: '待处置' },
    { time: '07:30', area: '临平区', level: 'level3', content: 'PM10浓度180μg/m³超标', status: '已处置' },
    { time: '06:15', area: '富阳区', level: 'level2', content: 'O₃浓度210μg/m³超标', status: '已关闭' },
  ]
  const levelColorMap: Record<string, string> = { level1: '#FF4D4F', level2: '#FA8C16', level3: '#FAAD14', level4: '#1890FF' }
  const statusColorMap: Record<string, string> = { '待处置': '#FA8C16', '处置中': '#1890FF', '已处置': '#52C41A', '已关闭': '#8C8C8C' }

  const tabItems = [
    { key: 'rules', label: '预警规则管理', children: <Table dataSource={rules} columns={ruleCols} rowKey="id" pagination={{ pageSize: 10 }} size="small" scroll={{ x: 900 }} /> },
    { key: 'alerts', label: '实时预警监控', children: <Table dataSource={alerts} columns={alertCols} rowKey="id" pagination={{ pageSize: 10 }} size="small" scroll={{ x: 900 }} /> },
    { key: 'tasks', label: '处置任务管理', children: <Table dataSource={tasks} columns={taskCols} rowKey="id" pagination={{ pageSize: 10 }} size="small" scroll={{ x: 800 }} /> },
    { key: 'trends', label: '区域预警实时动向', children: (
      <div className="space-y-2 p-2">
        {alertTrends.map((item, idx) => (
          <div key={idx} className="flex items-center gap-3 p-3 rounded-lg" style={{ backgroundColor: 'rgba(3,251,253,0.04)', border: '1px solid rgba(3,251,253,0.1)' }}>
            <div className="w-12 h-12 rounded-full flex items-center justify-center shrink-0" style={{ backgroundColor: levelColorMap[item.level] + '22', border: `2px solid ${levelColorMap[item.level]}` }}>
              <AlertFilled style={{ color: levelColorMap[item.level], fontSize: 18 }} />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <span className="text-white/90 text-14px font-medium">{item.area}</span>
                <Tag color={levelColorMap[item.level]}>{alertLevelOptions.find(o => o.value === item.level)?.label}</Tag>
              </div>
              <div className="text-white/50 text-12px mt-1 truncate">{item.content}</div>
            </div>
            <div className="text-right shrink-0">
              <div className="text-12px" style={{ color: statusColorMap[item.status] }}>{item.status}</div>
              <div className="text-white/40 text-11px mt-1">{item.time}</div>
            </div>
          </div>
        ))}
      </div>
    ) },
  ]

  return (
    <div className="w-full h-full p-4 overflow-auto" style={{ background: 'rgba(10,60,130,0.8)' }}>
      <div className="flex justify-between items-center mb-4">
        <div className="flex items-center gap-4">
          <Button type="text" icon={<ArrowLeftOutlined />} onClick={() => navigate('/monitor')} className="!text-[#03FBFD] hover:!text-white">返回监控大屏</Button>
          <h2 className="text-xl font-bold text-[#03FBFD]">预警中心</h2>
        </div>
        <Button type="primary" icon={<PlusOutlined />} onClick={showAddRuleModal}>新增预警规则</Button>
      </div>
      <Tabs items={tabItems} />
      <Modal title={<span className="text-[#03FBFD] font-bold">{editingRule ? '编辑规则' : '新增规则'}</span>} open={isRuleModalVisible} onOk={handleRuleOk} onCancel={() => { setIsRuleModalVisible(false); form.resetFields() }} width={600} styles={{ header: { backgroundColor: '#1a5ab0', borderBottom: '1px solid rgba(3,251,253,0.15)' }, body: { backgroundColor: '#1a5ab0', padding: '20px 24px' } }} style={{ top: 60 }}>
        <Form form={form} layout="vertical">
          <Form.Item label={<span className="text-[#03FBFD]">规则名称</span>} name="ruleName" rules={[{ required: true, message: '请输入' }]}><Input /></Form.Item>
          <Form.Item label={<span className="text-[#03FBFD]">数据类型</span>} name="dataType" rules={[{ required: true, message: '请选择' }]}>
            <Select onChange={(v: string) => { setSelectedDataType(v); form.setFieldsValue({ fieldName: '' }) }}>{dataTypeOptions.map(o => <Option key={o.value} value={o.value}>{o.label}</Option>)}</Select>
          </Form.Item>
          <Form.Item label={<span className="text-[#03FBFD]">监测字段</span>} name="fieldName" rules={[{ required: true, message: '请选择' }]}>
            <Select>{selectedDataType && fieldOptions[selectedDataType]?.map(o => <Option key={o.value} value={o.value}>{o.label}</Option>)}</Select>
          </Form.Item>
          <Form.Item label={<span className="text-[#03FBFD]">规则类型</span>} name="ruleType" rules={[{ required: true, message: '请选择' }]}>
            <Select>{ruleTypeOptions.map(o => <Option key={o.value} value={o.value}>{o.label}</Option>)}</Select>
          </Form.Item>
          <Form.Item noStyle shouldUpdate={(p, c) => p.ruleType !== c.ruleType}>
            {({ getFieldValue }) => {
              const rt = getFieldValue('ruleType')
              if (rt === 'threshold') return <div className="grid grid-cols-2 gap-4"><Form.Item label={<span className="text-[#03FBFD]">阈值</span>} name="threshold" rules={[{ required: true }]}><InputNumber className="w-full" /></Form.Item><Form.Item label={<span className="text-[#03FBFD]">比较符</span>} name="operator" rules={[{ required: true }]}><Select><Option value=">">大于</Option><Option value="<">小于</Option><Option value=">=">大于等于</Option><Option value="<=">小于等于</Option></Select></Form.Item></div>
              if (rt === 'change_rate') return <div className="grid grid-cols-2 gap-4"><Form.Item label={<span className="text-[#03FBFD]">窗口(分)</span>} name="timeWindow" rules={[{ required: true }]}><InputNumber className="w-full" /></Form.Item><Form.Item label={<span className="text-[#03FBFD]">变化率%</span>} name="rate" rules={[{ required: true }]}><InputNumber className="w-full" /></Form.Item></div>
              if (rt === 'continuous') return <div className="grid grid-cols-2 gap-4"><Form.Item label={<span className="text-[#03FBFD]">次数</span>} name="count" rules={[{ required: true }]}><InputNumber className="w-full" /></Form.Item><Form.Item label={<span className="text-[#03FBFD]">间隔(分)</span>} name="interval" rules={[{ required: true }]}><InputNumber className="w-full" /></Form.Item></div>
              if (rt === 'offline') return <Form.Item label={<span className="text-[#03FBFD]">离线(分)</span>} name="offlineTime" rules={[{ required: true }]}><InputNumber className="w-full" /></Form.Item>
              return null
            }}
          </Form.Item>
          <Form.Item label={<span className="text-[#03FBFD]">预警级别</span>} name="alertLevel" rules={[{ required: true }]}>
            <Select>{alertLevelOptions.map(o => <Option key={o.value} value={o.value}>{o.label}</Option>)}</Select>
          </Form.Item>
          <Form.Item label={<span className="text-[#03FBFD]">优先级</span>} name="priority" rules={[{ required: true }]}><InputNumber className="w-full" min={1} max={10} /></Form.Item>
          <Form.Item label={<span className="text-[#03FBFD]">直接下发</span>} name="autoDispatch" valuePropName="checked"><Switch checkedChildren="是" unCheckedChildren="否" /></Form.Item>
          <Form.Item label={<span className="text-[#03FBFD]">目标地市</span>} name="targetCity" rules={[{ required: true }]}>
            <Select>{cityOptions.map(o => <Option key={o.value} value={o.value}>{o.label}</Option>)}</Select>
          </Form.Item>
          <Form.Item label={<span className="text-[#03FBFD]">描述</span>} name="description"><Input.TextArea rows={2} /></Form.Item>
        </Form>
      </Modal>
      <Modal title={<span className="text-[#03FBFD] font-bold">预警详情</span>} open={isAlertModalVisible} onCancel={() => setIsAlertModalVisible(false)} width={550} footer={null} styles={{ header: { backgroundColor: '#1a5ab0', borderBottom: '1px solid rgba(3,251,253,0.15)' }, body: { backgroundColor: '#1a5ab0', padding: '20px 24px' } }}>
        {selectedAlert && <div className="space-y-2 p-3 rounded" style={{ backgroundColor: 'rgba(3,251,253,0.05)', border: '1px solid rgba(3,251,253,0.15)' }}>
          {[['预警ID', selectedAlert.id], ['规则', selectedAlert.ruleName], ['设备', selectedAlert.deviceName], ['位置', selectedAlert.location], ['时间', selectedAlert.createdAt], ['原因', selectedAlert.triggerReason]].map(([k, v]) => <div key={k} className="flex justify-between"><span className="text-[#03FBFD]">{k}</span><span className="text-white/75 text-right max-w-[60%]">{v}</span></div>)}
          <div className="flex justify-between"><span className="text-[#03FBFD]">级别</span><Tag color={alertLevelOptions.find(o => o.value === selectedAlert.alertLevel)?.color}>{alertLevelOptions.find(o => o.value === selectedAlert.alertLevel)?.label}</Tag></div>
        </div>}
      </Modal>
      <Modal title={<span className="text-[#03FBFD] font-bold">任务详情</span>} open={isTaskModalVisible} onCancel={() => setIsTaskModalVisible(false)} width={550} footer={null} styles={{ header: { backgroundColor: '#1a5ab0', borderBottom: '1px solid rgba(3,251,253,0.15)' }, body: { backgroundColor: '#1a5ab0', padding: '20px 24px' } }}>
        {selectedTask && <div className="space-y-2 p-3 rounded" style={{ backgroundColor: 'rgba(3,251,253,0.05)', border: '1px solid rgba(3,251,253,0.15)' }}>
          {[['任务ID', selectedTask.id], ['关联预警', selectedTask.alertId], ['类型', taskTypeOptions.find(o => o.value === selectedTask.taskType)?.label || ''], ['处置人', selectedTask.assigneeName || '未分配'], ['派发人', selectedTask.requesterName], ['要求时间', selectedTask.requireTime]].map(([k, v]) => <div key={k} className="flex justify-between"><span className="text-[#03FBFD]">{k}</span><span className="text-white/75">{v}</span></div>)}
          {selectedTask.disposalContent && <div className="mt-2 pt-2" style={{ borderTop: '1px solid rgba(3,251,253,0.15)' }}><span className="text-[#03FBFD] block mb-1">处置内容</span><p className="text-white/75">{selectedTask.disposalContent}</p></div>}
        </div>}
      </Modal>
      <Modal title={<span className="text-[#03FBFD] font-bold">查看处置</span>} open={isDisposalModalVisible} onCancel={() => setIsDisposalModalVisible(false)} width={600} footer={null} styles={{ header: { backgroundColor: '#1a5ab0', borderBottom: '1px solid rgba(3,251,253,0.15)' }, body: { backgroundColor: '#1a5ab0', padding: '20px 24px' } }}>
        {selectedTask && <div className="space-y-4">
          <div><span className="text-[#03FBFD] block mb-2">处置内容</span><div className="p-3 rounded text-white/75" style={{ backgroundColor: 'rgba(0,0,0,0.2)', border: '1px solid rgba(3,251,253,0.15)' }}>{selectedTask.disposalContent}</div></div>
          {selectedTask.photos && <div><span className="text-[#03FBFD] block mb-2">现场照片</span><div className="flex gap-3">{selectedTask.photos.map((_, i) => <div key={i} className="w-20 h-20 rounded flex items-center justify-center border text-white/50" style={{ backgroundColor: 'rgba(0,0,0,0.15)', borderColor: 'rgba(3,251,253,0.2)' }}><SearchOutlined className="text-xl" /></div>)}</div></div>}
          {selectedTask.completedAt && <div className="flex justify-between"><span className="text-[#03FBFD]">完成时间</span><span className="text-white/75">{selectedTask.completedAt}</span></div>}
        </div>}
      </Modal>
    </div>
  )
}

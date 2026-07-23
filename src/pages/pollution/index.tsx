import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Button, Table, Input, Modal, Form, Select, Upload, message, Space } from 'antd'
import type { TableColumnsType } from 'antd'
import { PlusOutlined, ArrowLeftOutlined, UploadOutlined, ExclamationCircleOutlined } from '@ant-design/icons'

const { Option } = Select

interface PollutionItem {
  id: string; name: string; city: string; quxian: string; xiangzhen: string;
  weizhi: string; leixing: string; hangye: string; xianzhuang: string;
  lng: number; lat: number; beizhu: string; level: string; createTime: string;
}

const leixingOptions = ['工业源', '交通源', '建筑施工', '餐饮']
const cityOpts = ['杭州', '宁波', '温州']
const levelObj: Record<string, string> = { '1': '红', '2': '黄', '3': '绿' }

const mockData: PollutionItem[] = [
  { id: '1', name: '浙江XX化工有限公司', city: '杭州', quxian: '萧山区', xiangzhen: '城厢街道', weizhi: '工业园区A区12号', leixing: '工业源', hangye: '化工', xianzhuang: '正常生产', lng: 120.264, lat: 30.264, beizhu: '', level: '1', createTime: '2025-11-20' },
  { id: '2', name: '杭州XX建材厂', city: '杭州', quxian: '余杭区', xiangzhen: '良渚街道', weizhi: '工业区B路88号', leixing: '工业源', hangye: '建材', xianzhuang: '正常生产', lng: 119.978, lat: 30.273, beizhu: '', level: '2', createTime: '2025-11-18' },
  { id: '3', name: 'XX物流中心仓库', city: '杭州', quxian: '萧山区', xiangzhen: '南阳街道', weizhi: '物流大道168号', leixing: '交通源', hangye: '物流', xianzhuang: '正常运营', lng: 120.264, lat: 30.184, beizhu: '', level: '2', createTime: '2025-11-15' },
  { id: '4', name: '富阳XX印染厂', city: '杭州', quxian: '富阳区', xiangzhen: '富春街道', weizhi: '化工园区C区3号', leixing: '工业源', hangye: '印染', xianzhuang: '停产整改', lng: 119.960, lat: 30.048, beizhu: '废气治理中', level: '1', createTime: '2025-11-10' },
  { id: '5', name: '杭州XX建筑工地', city: '杭州', quxian: '西湖区', xiangzhen: '转塘街道', weizhi: '文三路与学院路交叉口', leixing: '建筑施工', hangye: '建筑', xianzhuang: '施工中', lng: 120.130, lat: 30.259, beizhu: '扬尘管控中', level: '3', createTime: '2025-11-08' },
  { id: '6', name: '西湖餐饮一条街', city: '杭州', quxian: '西湖区', xiangzhen: '湖滨街道', weizhi: '延安路200号', leixing: '餐饮', hangye: '餐饮', xianzhuang: '正常营业', lng: 120.165, lat: 30.245, beizhu: '', level: '3', createTime: '2025-11-05' },
  { id: '7', name: '滨江XX电子厂', city: '杭州', quxian: '滨江区', xiangzhen: '西兴街道', weizhi: '科技路56号', leixing: '工业源', hangye: '电子', xianzhuang: '正常生产', lng: 120.210, lat: 30.208, beizhu: '', level: '2', createTime: '2025-11-01' },
  { id: '8', name: '钱塘交通干道', city: '杭州', quxian: '钱塘区', xiangzhen: '白杨街道', weizhi: '德胜快速路', leixing: '交通源', hangye: '交通', xianzhuang: '正常', lng: 120.350, lat: 30.310, beizhu: '', level: '2', createTime: '2025-10-28' },
]

export default function Pollution() {
  const navigate = useNavigate()
  const [data, setData] = useState<PollutionItem[]>(mockData)
  const [searchText, setSearchText] = useState('')
  const [visible, setVisible] = useState(false)
  const [curRow, setCurRow] = useState<PollutionItem | null>(null)
  const [form] = Form.useForm()
  const [pagination, setPagination] = useState({ current: 1, pageSize: 5 })

  const filteredData = data.filter(item =>
    !searchText || item.weizhi.includes(searchText) || item.name.includes(searchText)
  )

  const handleAdd = () => { setCurRow(null); form.resetFields(); setVisible(true) }
  const handleEdit = (row: PollutionItem) => { setCurRow(row); form.setFieldsValue(row); setVisible(true) }
  const handleDelete = (row: PollutionItem) => {
    Modal.confirm({
      title: '删除', icon: <ExclamationCircleOutlined style={{ color: 'red' }} />,
      content: `确认删除[ ${row.name} ]？删除后无法恢复！`, okText: '确认', cancelText: '取消',
      onOk: () => { setData(data.filter(i => i.id !== row.id)); message.success('删除成功') }
    })
  }
  const handleOk = () => {
    form.validateFields().then(values => {
      if (curRow) {
        setData(data.map(i => i.id === curRow.id ? { ...i, ...values } : i))
        message.success('更新成功')
      } else {
        setData([...data, { ...values, id: String(Date.now()), createTime: new Date().toISOString().slice(0, 10) }])
        message.success('新增成功')
      }
      setVisible(false); form.resetFields()
    })
  }

  const columns: TableColumnsType<PollutionItem> = [
    { title: '污染源名称', dataIndex: 'name', width: 180 },
    { title: '城市', dataIndex: 'city', width: 80, filters: cityOpts.map(c => ({ text: c, value: c })), onFilter: (v, r) => r.city === String(v) },
    { title: '区县', dataIndex: 'quxian', width: 90 },
    { title: '乡镇街道', dataIndex: 'xiangzhen', width: 100 },
    { title: '详细地址', dataIndex: 'weizhi', width: 150 },
    { title: '级别', dataIndex: 'level', width: 60, filters: [{ text: '红', value: '1' }, { text: '黄', value: '2' }, { text: '绿', value: '3' }], onFilter: (v, r) => r.level === String(v), render: (v: string) => <span className={v === '1' ? 'text-red-400' : v === '2' ? 'text-yellow-400' : 'text-green-400'}>{levelObj[v] || v}</span> },
    { title: '类型', dataIndex: 'leixing', width: 90, filters: leixingOptions.map(l => ({ text: l, value: l })), onFilter: (v, r) => r.leixing === String(v) },
    { title: '行业', dataIndex: 'hangye', width: 80 },
    { title: '现状', dataIndex: 'xianzhuang', width: 90 },
    { title: '经度', dataIndex: 'lng', width: 90 },
    { title: '纬度', dataIndex: 'lat', width: 90 },
    { title: '备注', dataIndex: 'beizhu', width: 100 },
    { title: '操作', fixed: 'right' as const, width: 130, render: (_: unknown, r: PollutionItem) => (
      <Space><Button size="small" onClick={() => handleEdit(r)}>编辑</Button><Button size="small" danger onClick={() => handleDelete(r)}>删除</Button></Space>
    ) },
  ]

  return (
    <div className="w-full h-full box-border p-5 overflow-auto" style={{ background: 'rgba(10,60,130,0.8)' }}>
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-4">
          <Button type="text" icon={<ArrowLeftOutlined />} onClick={() => navigate('/monitor')} className="!text-[#03FBFD] hover:!text-white">返回</Button>
          <h2 className="text-xl font-bold text-[#03FBFD]">污染源管理</h2>
        </div>
        <Space>
          <Button type="primary" icon={<PlusOutlined />} onClick={handleAdd}>新增</Button>
          <Upload accept=".xlsx" showUploadList={false} beforeUpload={() => { message.success('批量导入成功（模拟）'); return false }}>
            <Button icon={<UploadOutlined />}>批量导入</Button>
          </Upload>
          <Input.Search placeholder="搜索名称/地址" className="w-220px" onSearch={(v) => { setSearchText(v); setPagination({ ...pagination, current: 1 }) }} enterButton allowClear />
        </Space>
      </div>
      <Table
        dataSource={filteredData} columns={columns} rowKey="id" size="small"
        scroll={{ x: 1400, y: 'calc(100vh - 200px)' }}
        pagination={{ ...pagination, total: filteredData.length, showTotal: (t) => `共 ${t} 条`, showQuickJumper: true, onChange: (p, ps) => setPagination({ current: p, pageSize: ps }) }}
      />
      <Modal title={<span className="text-[#03FBFD] font-bold">{curRow ? '编辑污染源' : '新增污染源'}</span>} open={visible} onOk={handleOk} onCancel={() => { setVisible(false); form.resetFields() }} width={650} styles={{ header: { backgroundColor: '#1a5ab0', borderBottom: '1px solid rgba(3,251,253,0.15)' }, body: { backgroundColor: '#1a5ab0', padding: '20px 24px' } }}>
        <Form form={form} layout="vertical">
          <div className="grid grid-cols-2 gap-x-4">
            <Form.Item label={<span className="text-[#03FBFD]">名称</span>} name="name" rules={[{ required: true, message: '请输入' }]}><Input /></Form.Item>
            <Form.Item label={<span className="text-[#03FBFD]">城市</span>} name="city" rules={[{ required: true }]}><Select>{cityOpts.map(c => <Option key={c} value={c}>{c}</Option>)}</Select></Form.Item>
            <Form.Item label={<span className="text-[#03FBFD]">区县</span>} name="quxian" rules={[{ required: true }]}><Input /></Form.Item>
            <Form.Item label={<span className="text-[#03FBFD]">乡镇街道</span>} name="xiangzhen"><Input /></Form.Item>
            <Form.Item label={<span className="text-[#03FBFD]">详细地址</span>} name="weizhi" rules={[{ required: true }]}><Input /></Form.Item>
            <Form.Item label={<span className="text-[#03FBFD]">类型</span>} name="leixing" rules={[{ required: true }]}><Select>{leixingOptions.map(l => <Option key={l} value={l}>{l}</Option>)}</Select></Form.Item>
            <Form.Item label={<span className="text-[#03FBFD]">行业</span>} name="hangye"><Input /></Form.Item>
            <Form.Item label={<span className="text-[#03FBFD]">现状</span>} name="xianzhuang"><Input /></Form.Item>
            <Form.Item label={<span className="text-[#03FBFD]">经度</span>} name="lng" rules={[{ required: true }]}><Input type="number" /></Form.Item>
            <Form.Item label={<span className="text-[#03FBFD]">纬度</span>} name="lat" rules={[{ required: true }]}><Input type="number" /></Form.Item>
            <Form.Item label={<span className="text-[#03FBFD]">级别</span>} name="level" rules={[{ required: true }]}><Select><Option value="1">红</Option><Option value="2">黄</Option><Option value="3">绿</Option></Select></Form.Item>
            <Form.Item label={<span className="text-[#03FBFD]">备注</span>} name="beizhu"><Input /></Form.Item>
          </div>
        </Form>
      </Modal>
    </div>
  )
}

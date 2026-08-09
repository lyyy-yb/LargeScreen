import { useState, useEffect, useCallback, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { Button, Table, Input, Modal, Form, Select, Upload, message, Space } from 'antd'
import type { TableColumnsType } from 'antd'
import type { UploadProps } from 'antd'
import { PlusOutlined, ArrowLeftOutlined, UploadOutlined, ExclamationCircleOutlined } from '@ant-design/icons'
import { wuranyuanPage, wuranyuanAdd, wuranyuanEdit, wuranyuanDelete } from '@/servers/api'
import { useAppStore } from '@/stores'
import { toRegionQuery } from '@/utils/region'
import { cities, districts } from '@/utils/city'
import RegionSelector from '@/components/RegionSelector'
import { getLocalInfo } from '@/utils/storage'
import { TOKEN } from '@/utils/enum'

const { Option } = Select

interface PollutionItem {
  id: string; name: string; city: string; quxian: string; xiangzhen: string;
  weizhi: string; leixing: string; hangye: string; xianzhuang: string;
  lng: number; lat: number; beizhu: string; level: string; createTime: string;
}

const leixingOptions = ['工业源', '交通源', '建筑施工', '餐饮']
const cityOpts = cities.map(item => item.name)
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
  const regionContext = useAppStore(state => state.regionContext)
  const selection = regionContext?.selection
  const querySelection = regionContext?.querySelection
  const roleLevel = regionContext?.roleLevel
  const [data, setData] = useState<PollutionItem[]>([])
  const [loading, setLoading] = useState(false)
  const [submitting, setSubmitting] = useState(false)

  const loadList = useCallback(async () => {
    if (!querySelection) return
    setLoading(true)
    try {
      const res = await wuranyuanPage({ pageNo: 1, pageSize: 999, ...toRegionQuery(querySelection) })
      if (res?.resultCode === 0 || res?.code === 200) {
        const d = (res as any).data
        setData(d?.records ?? d ?? [])
        return
      }
    } catch {
      /* 接口异常时降级到本地 mock 数据 */
    } finally {
      setLoading(false)
    }
    const normalize = (value: string) => value.replace(/[市区县]$/, '')
    setData(mockData.filter(item =>
      (!querySelection.cityName || normalize(item.city) === normalize(querySelection.cityName)) &&
      (!querySelection.countyName || normalize(item.quxian) === normalize(querySelection.countyName)) &&
      (!querySelection.townName || normalize(item.xiangzhen) === normalize(querySelection.townName))
    ))
  }, [querySelection])

  useEffect(() => {
    queueMicrotask(() => void loadList())
  }, [loadList])
  const [searchText, setSearchText] = useState('')
  const [visible, setVisible] = useState(false)
  const [curRow, setCurRow] = useState<PollutionItem | null>(null)
  const [form] = Form.useForm()
  const formCity = Form.useWatch('city', form)
  const selectedFormCity = cities.find(item => item.name === formCity) || cities.find(item => item.name === selection?.cityName)
  const countyOptions = useMemo(
    () => districts.filter(item => item.parent === Number(selectedFormCity?.adcode)),
    [selectedFormCity],
  )
  const [pagination, setPagination] = useState({ current: 1, pageSize: 5 })

  // 城市筛选项按角色区分（对齐原项目 accessibleCity）：省级可见全部城市，市级及以下只可见本市
  const cityFilterOptions = useMemo(
    () => (roleLevel === 'admin' ? cityOpts : selection?.cityName ? [selection.cityName] : cityOpts),
    [roleLevel, selection],
  )

  const filteredData = data.filter(item =>
    !searchText || (item.weizhi || '').includes(searchText) || (item.name || '').includes(searchText)
  )

  const handleAdd = () => {
    setCurRow(null)
    form.resetFields()
    form.setFieldsValue({
      city: selection?.cityName,
      quxian: selection?.countyName,
      xiangzhen: selection?.townName,
    })
    setVisible(true)
  }
  const handleEdit = (row: PollutionItem) => { setCurRow(row); form.setFieldsValue(row); setVisible(true) }
  const handleDelete = (row: PollutionItem) => {
    Modal.confirm({
      title: '删除', icon: <ExclamationCircleOutlined style={{ color: 'red' }} />,
      content: `确认删除[ ${row.name} ]？删除后无法恢复！`, okText: '确认', cancelText: '取消',
      onOk: async () => {
        try {
          await wuranyuanDelete({ id: row.id })
          message.success('删除成功')
          loadList()
        } catch {
          message.error('删除失败')
        }
      }
    })
  }
  const handleOk = () => {
    form.validateFields().then(async (values) => {
      setSubmitting(true)
      try {
        if (curRow) {
          await wuranyuanEdit({ ...values, id: curRow.id })
          message.success('更新成功')
        } else {
          await wuranyuanAdd(values)
          message.success('新增成功')
        }
        setVisible(false); form.resetFields()
        loadList()
      } catch {
        message.error('保存失败，请重试')
      } finally {
        setSubmitting(false)
      }
    }).catch(() => {})
  }

  // 批量导入（对齐原项目：xlsx 上传到 /hbdp/wuranyuan/load，成功后刷新列表）
  const uploadProps: UploadProps = {
    name: 'file',
    action: '/dpSys/hbdp/wuranyuan/load',
    accept: '.xlsx',
    headers: { Authorization: `Bearer ${getLocalInfo<string>(TOKEN) || ''}` },
    showUploadList: false,
    onChange(info) {
      if (info.file.status === 'done') {
        message.success(`${info.file.name} 批量导入成功`)
        void loadList()
      } else if (info.file.status === 'error') {
        message.error(`${info.file.name} 批量导入失败`)
      }
    },
  }

  const columns: TableColumnsType<PollutionItem> = [
    { title: '污染源名称', dataIndex: 'name', width: 180 },
    { title: '城市', dataIndex: 'city', width: 80, filters: cityFilterOptions.map(c => ({ text: c, value: c })), onFilter: (v, r) => r.city === String(v) },
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
    <div className="alert-page-container">
      {/* 顶部标题与操作同一行 */}
      <div className="alert-header-bar">
        <div className="header-left">
          <Button
            type="text"
            icon={<ArrowLeftOutlined />}
            onClick={() => navigate('/monitor')}
            className="!text-[#03FBFD] hover:!text-white !px-2"
          >
            返回监控大屏
          </Button>
          <RegionSelector />
        </div>

        <div className="alert-center-title">
          <span className="title-diamond">◆</span>
          <span>污染源管理</span>
          <span className="title-diamond">◆</span>
        </div>

        <div className="header-right">
          <Space>
            <Button
              type="primary"
              icon={<PlusOutlined />}
              onClick={handleAdd}
              style={{
                background: 'linear-gradient(90deg, #1890ff 0%, #03fbfd 100%)',
                borderColor: '#03fbfd',
                fontWeight: 600,
                boxShadow: '0 0 10px rgba(3, 251, 253, 0.3)',
              }}
            >
              新增
            </Button>
            <Upload {...uploadProps}>
              <Button icon={<UploadOutlined />}>批量导入</Button>
            </Upload>
            <Input.Search placeholder="搜索名称/地址" className="w-220px" onSearch={(v) => { setSearchText(v); setPagination({ ...pagination, current: 1 }) }} enterButton allowClear />
          </Space>
        </div>
      </div>

      <div className="tech-table-wrapper">
        <Table
          dataSource={filteredData}
          columns={columns}
          rowKey="id"
          loading={loading}
          size="small"
          scroll={{ x: 1400, y: 'calc(100vh - 220px)' }}
          pagination={{ ...pagination, total: filteredData.length, showTotal: (t) => `共 ${t} 条`, showQuickJumper: true, onChange: (p, ps) => setPagination({ current: p, pageSize: ps }) }}
        />
      </div>

      <Modal
        title={<span className="alert-rule-modal-title">{curRow ? '编辑污染源' : '新增污染源'}</span>}
        open={visible}
        onCancel={() => { setVisible(false); form.resetFields() }}
        width={780}
        className="alert-rule-modal"
        footer={[
          <Button key="cancel" onClick={() => { setVisible(false); form.resetFields() }}>取消</Button>,
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
            <Form.Item label="城市" name="city" rules={[{ required: true }]}>
              <Select className="model_from_sel" popupClassName="alert-rule-dropdown" disabled={roleLevel !== 'admin'}>{cityOpts.map(c => <Option key={c} value={c}>{c}</Option>)}</Select>
            </Form.Item>
            <Form.Item label="区县" name="quxian" rules={[{ required: true }]}>
              <Select className="model_from_sel" popupClassName="alert-rule-dropdown" disabled={roleLevel === 'county' || roleLevel === 'town'}>
                {countyOptions.map(item => <Option key={item.adcode} value={item.name}>{item.name}</Option>)}
              </Select>
            </Form.Item>
          </div>

          <div className="grid grid-cols-2 gap-x-2">
            <Form.Item label="乡镇街道" name="xiangzhen">
              <Input className="model_from_input" disabled={roleLevel === 'town'} placeholder="请输入乡镇街道" />
            </Form.Item>
            <Form.Item label="详细地址" name="weizhi" rules={[{ required: true }]}>
              <Input className="model_from_input" placeholder="请输入详细地址" />
            </Form.Item>
          </div>

          <div className="grid grid-cols-2 gap-x-2">
            <Form.Item label="类型" name="leixing" rules={[{ required: true }]}>
              <Select className="model_from_sel" popupClassName="alert-rule-dropdown">{leixingOptions.map(l => <Option key={l} value={l}>{l}</Option>)}</Select>
            </Form.Item>
            <Form.Item label="行业" name="hangye">
              <Input className="model_from_input" placeholder="请输入行业" />
            </Form.Item>
          </div>

          <div className="grid grid-cols-2 gap-x-2">
            <Form.Item label="现状" name="xianzhuang">
              <Input className="model_from_input" placeholder="请输入现状" />
            </Form.Item>
            <Form.Item label="级别" name="level" rules={[{ required: true }]}>
              <Select className="model_from_sel" popupClassName="alert-rule-dropdown"><Option value="1">红</Option><Option value="2">黄</Option><Option value="3">绿</Option></Select>
            </Form.Item>
          </div>

          <div className="grid grid-cols-2 gap-x-2">
            <Form.Item label="经度" name="lng" rules={[{ required: true }]}>
              <Input type="number" className="model_from_input" placeholder="请输入经度" />
            </Form.Item>
            <Form.Item label="纬度" name="lat" rules={[{ required: true }]}>
              <Input type="number" className="model_from_input" placeholder="请输入纬度" />
            </Form.Item>
          </div>

          <Form.Item label="备注" name="beizhu">
            <Input.TextArea className="model_from_input" rows={2} placeholder="请输入备注" />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  )
}

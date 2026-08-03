import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Button, Table, Modal, Form, Input, Select, Switch, App } from 'antd'
import { PlusOutlined, EditOutlined, EyeOutlined, CheckCircleOutlined, AlertFilled, SearchOutlined, DeleteOutlined, ArrowLeftOutlined } from '@ant-design/icons'
import { dataSourceApi } from '@/servers/business'
import { deptList } from '@/servers/api'
import { useAppStore, useAuthStore } from '@/stores'
import { addOption, buildDeptRegionOptions, flattenDepartments, nameEquals } from '@/utils/deptRegion'
import type { DataSourceDTO } from '@/types/business'
import type { DeptInfo } from '@/types/auth'

const { Option } = Select

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

// 经纬度校验：数字格式（最多 6 位小数）且在合法范围内
const coordinateRule = (label: string, min: number, max: number) => ({
  validator: (_: unknown, value: unknown) => {
    const text = value == null ? '' : String(value).trim()
    if (!text) return Promise.reject(new Error(`请输入${label}`))
    if (!/^-?\d+(\.\d{1,6})?$/.test(text)) return Promise.reject(new Error(`${label}格式不正确，如 119.649522`))
    const num = Number(text)
    if (num < min || num > max) return Promise.reject(new Error(`${label}范围为 ${min} ~ ${max}`))
    return Promise.resolve()
  },
})

export default function DataSource() {
  const navigate = useNavigate()
  const { message, modal } = App.useApp()
  const regionContext = useAppStore(state => state.regionContext)
  const user = useAuthStore(state => state.user)
  const [data, setData] = useState<DataSourceDTO[]>([])
  const [loading, setLoading] = useState(false)
  const [total, setTotal] = useState(0)
  const [pageNum, setPageNum] = useState(1)
  const [pageSize, setPageSize] = useState(15)
  const [isModalVisible, setIsModalVisible] = useState(false)
  const [isDetailModalVisible, setIsDetailModalVisible] = useState(false)
  const [editingItem, setEditingItem] = useState<DataSourceDTO | null>(null)
  const [selectedType, setSelectedType] = useState<string>('')
  // 列表筛选：名称/接入类型/启用状态走服务端，连接状态后端未支持用前端过滤
  const [searchName, setSearchName] = useState('')
  const [appliedName, setAppliedName] = useState('')
  const [filterDataType, setFilterDataType] = useState<string | undefined>(undefined)
  const [filterConnStatus, setFilterConnStatus] = useState<string | undefined>(undefined)
  const [filterEnabled, setFilterEnabled] = useState<0 | 1 | undefined>(undefined)
  const [extraDepts, setExtraDepts] = useState<DeptInfo[]>([])
  const loadingDeptParentIds = useRef(new Set<number>())
  const deptListLoaded = useRef(false)
  const [form] = Form.useForm()

  const allDepts = useMemo(() => {
    const departments = flattenDepartments([
      ...(regionContext?.departments ?? []),
      ...extraDepts,
    ])
    const currentDept = user?.dept
    if (currentDept && !departments.some(dept => Number(dept.deptId) === Number(currentDept.deptId))) {
      flattenDepartments([currentDept]).forEach(dept => {
        if (!departments.some(item => Number(item.deptId) === Number(dept.deptId))) departments.push(dept)
      })
    }
    return departments
  }, [extraDepts, regionContext?.departments, user?.dept])
  const deptRegionOptions = useMemo(() => buildDeptRegionOptions(allDepts), [allDepts])
  const selection = regionContext?.selection
  // 与预警规则一致：非 admin 角色锁定所属地市/区县
  const lockedRegion = useMemo(() => {
    if (!regionContext || regionContext.roleLevel === 'admin') return {}
    const currentDept = allDepts.find(dept => Number(dept.deptId) === Number(user?.deptId ?? user?.dept?.deptId))
    const cityDept = allDepts.find(dept => nameEquals(dept.deptName, selection?.cityName ?? ''))
    const districtDept = allDepts.find(dept => nameEquals(dept.deptName, selection?.countyName ?? ''))

    if (regionContext.roleLevel === 'city') {
      const rawCityId = Number(cityDept?.deptId ?? currentDept?.deptId)
      return {
        cityId: rawCityId ? String(rawCityId) : undefined,
        cityName: selection?.cityName,
      }
    }

    const lockedDistrict = districtDept ?? currentDept
    const rawCityId = Number(cityDept?.deptId ?? lockedDistrict?.parentId)
    const rawDistrictId = Number(lockedDistrict?.deptId)
    return {
      cityId: rawCityId ? String(rawCityId) : undefined,
      cityName: selection?.cityName,
      districtId: rawDistrictId ? String(rawDistrictId) : undefined,
      districtName: selection?.countyName,
    }
  }, [allDepts, regionContext, selection?.cityName, selection?.countyName, user?.dept?.deptId, user?.deptId])
  const roleLevel = regionContext?.roleLevel ?? 'town'
  const canSelectRegion = regionContext?.roleLevel === 'admin'

  const watchedCityId = Form.useWatch('cityId', form)
  const watchedDistrictId = Form.useWatch('districtId', form)
  const cityOptions = useMemo(
    () => addOption(deptRegionOptions.cityOptions, lockedRegion.cityId, lockedRegion.cityName),
    [deptRegionOptions.cityOptions, lockedRegion.cityId, lockedRegion.cityName],
  )
  const districtOptions = useMemo(
    () => addOption(deptRegionOptions.getDistrictOptions(watchedCityId), lockedRegion.districtId, lockedRegion.districtName),
    [deptRegionOptions, lockedRegion.districtId, lockedRegion.districtName, watchedCityId],
  )
  const townOptions = useMemo(() => deptRegionOptions.getTownOptions(watchedDistrictId), [deptRegionOptions, watchedDistrictId])

  const loadDepartmentChildren = useCallback(async (parentId?: number) => {
    const normalizedParentId = Number(parentId)
    if (
      !Number.isFinite(normalizedParentId)
      || loadingDeptParentIds.current.has(normalizedParentId)
    ) return
    loadingDeptParentIds.current.add(normalizedParentId)
    try {
      const response = await deptList({ parentId: normalizedParentId })
      if (response.code !== 200 || !Array.isArray(response.data)) return
      const loaded = flattenDepartments(response.data)
      setExtraDepts(previous => {
        const knownIds = new Set(flattenDepartments(previous).map(dept => Number(dept.deptId)))
        const additions = loaded.filter(dept => !knownIds.has(Number(dept.deptId)))
        return additions.length ? [...previous, ...additions] : previous
      })
    } catch {
      // 无下级部门时保持空选项
    }
  }, [])

  // 页面初始进入时若无部门数据，先拉取根部门树
  useEffect(() => {
    if (deptListLoaded.current || allDepts.length) return
    deptListLoaded.current = true
    deptList().then(response => {
      if (response.code !== 200 || !Array.isArray(response.data)) return
      const loaded = flattenDepartments(response.data)
      setExtraDepts(previous => {
        const knownIds = new Set(flattenDepartments(previous).map(dept => Number(dept.deptId)))
        const additions = loaded.filter(dept => !knownIds.has(Number(dept.deptId)))
        return additions.length ? [...previous, ...additions] : previous
      })
    }).catch(() => { deptListLoaded.current = false })
  }, [allDepts.length])

  // 弹窗打开时按需懒加载区县/乡镇选项
  useEffect(() => {
    if (!isModalVisible) return
    queueMicrotask(() => {
      if (watchedCityId && !districtOptions.length) {
        void loadDepartmentChildren(Number(watchedCityId))
      }
      if (watchedDistrictId && !townOptions.length) {
        void loadDepartmentChildren(Number(watchedDistrictId))
      }
    })
  }, [isModalVisible, watchedCityId, watchedDistrictId, districtOptions.length, townOptions.length, loadDepartmentChildren])

  const fetchData = useCallback(async () => {
    setLoading(true)
    try {
      const res = await dataSourceApi.list({
        pageNum,
        pageSize,
        needAqi: 0,
        deviceName: appliedName || undefined,
        dataType: filterDataType,
        enabled: filterEnabled,
      })
      if (res.data) {
        setData(res.data.records ?? [])
        setTotal(res.data.total ?? 0)
      }
    } catch {
      message.error('获取数据源列表失败')
    } finally {
      setLoading(false)
    }
  }, [pageNum, pageSize, appliedName, filterDataType, filterEnabled, message])

  // 标准的列表数据拉取模式，忽略 set-state-in-effect 规则
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { fetchData() }, [fetchData])

  // 连接状态后端不支持查询参数，在当前页数据上过滤
  const displayData = useMemo(() => {
    if (!filterConnStatus) return data
    if (filterConnStatus === 'abnormal') {
      return data.filter(item => item.connectionStatus !== 'online' && item.connectionStatus !== 'offline')
    }
    return data.filter(item => item.connectionStatus === filterConnStatus)
  }, [data, filterConnStatus])

  const applySearch = (value?: string) => {
    setAppliedName((value ?? searchName).trim())
    setPageNum(1)
  }

  const handleDataTypeFilter = (value?: string) => {
    setFilterDataType(value)
    setPageNum(1)
  }

  const handleEnabledFilter = (value?: 0 | 1) => {
    setFilterEnabled(value)
    setPageNum(1)
  }

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
    // 非 admin 角色：新增时自动选中锁定的地市/区县（与新增预警规则一致）
    if (roleLevel !== 'admin') {
      form.setFieldsValue({
        ...(lockedRegion.cityId ? { cityId: lockedRegion.cityId } : {}),
        ...(roleLevel === 'county' && lockedRegion.districtId
          ? { districtId: lockedRegion.districtId }
          : {}),
      })
    }
    setIsModalVisible(true)
  }

  const showEditModal = async (record: DataSourceDTO) => {
    setEditingItem(record)
    setSelectedType(record.dataType)
    form.resetFields()
    // 先用表格行数据回填基础字段，避免弹窗打开时空白
    form.setFieldsValue({
      deviceName: record.deviceName,
      dataType: record.dataType,
      protocol: record.protocol,
      deviceId: record.deviceId,
      location: record.location,
      description: record.description,
      lng: record.lng != null && record.lng !== 0 ? String(record.lng) : undefined,
      lat: record.lat != null && record.lat !== 0 ? String(record.lat) : undefined,
      enabled: record.enabled === 1,
    })
    setIsModalVisible(true)
    // 优先用详情接口获取完整字段（列表行可能缺少区域/经纬度）
    let detail: DataSourceDTO = record
    try {
      const res = await dataSourceApi.detail(record.id)
      if (res.data) {
        detail = res.data
        setEditingItem(res.data)
      }
    } catch { /* 保留表格行数据 */ }
    // 先加载区域选项，再回填区域值，避免 Select 显示原始 ID
    if (detail.cityId) await loadDepartmentChildren(detail.cityId)
    if (detail.districtId) await loadDepartmentChildren(detail.districtId)
    form.setFieldsValue({
      deviceName: detail.deviceName,
      dataType: detail.dataType,
      protocol: detail.protocol,
      deviceId: detail.deviceId,
      location: detail.location,
      description: detail.description,
      lng: detail.lng != null && detail.lng !== 0 ? String(detail.lng) : undefined,
      lat: detail.lat != null && detail.lat !== 0 ? String(detail.lat) : undefined,
      enabled: detail.enabled === 1,
      cityId: detail.cityId ? String(detail.cityId) : undefined,
      districtId: detail.districtId ? String(detail.districtId) : undefined,
      townId: detail.townId ? String(detail.townId) : undefined,
    })
  }

  const showDetailModal = async (record: DataSourceDTO) => {
    setEditingItem(record)
    setIsDetailModalVisible(true)
    try {
      const res = await dataSourceApi.detail(record.id)
      if (res.data) setEditingItem(res.data)
    } catch { /* 详情获取失败时保留表格行数据 */ }
  }

  const handleOk = () => {
    form.validateFields().then(async values => {
      const regionPayload = {
        lng: Number(values.lng),
        lat: Number(values.lat),
        cityId: values.cityId ? Number(values.cityId) : 0,
        districtId: values.districtId ? Number(values.districtId) : 0,
        townId: values.townId ? Number(values.townId) : 0,
        enabled: (values.enabled ? 1 : 0) as 0 | 1,
      }
      // 归属部门取最深一级已选区域
      const deptId = regionPayload.townId || regionPayload.districtId || regionPayload.cityId
      try {
        if (editingItem) {
          await dataSourceApi.edit({ ...editingItem, ...values, ...regionPayload, deptId })
          message.success('编辑成功')
        } else {
          await dataSourceApi.add({ ...values, ...regionPayload, deptId, connectionStatus: 'online' })
          message.success('新增成功')
        }
        setIsModalVisible(false)
        form.resetFields()
        fetchData()
      } catch {
        message.error(editingItem ? '编辑失败' : '新增失败')
      }
    })
  }

  const handleDelete = (id: number) => {
    modal.confirm({
      title: '确认删除',
      content: '确定要删除该数据源吗？',
      okText: '确定',
      cancelText: '取消',
      onOk: async () => {
        try {
          await dataSourceApi.remove(id)
          message.success('删除成功')
          fetchData()
        } catch {
          message.error('删除失败')
        }
      },
    })
  }

  const toggleStatus = async (record: DataSourceDTO) => {
    const nextEnabled = record.enabled === 1 ? 0 : 1
    try {
      await dataSourceApi.changeStatus(record.id, nextEnabled as 0 | 1)
      message.success(nextEnabled === 1 ? '已启用' : '已禁用')
      fetchData()
    } catch {
      message.error('状态切换失败')
    }
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
    { title: '数据源名称', dataIndex: 'deviceName', key: 'deviceName', width: 150 },
    {
      title: '接入类型', dataIndex: 'dataType', key: 'dataType', width: 120,
      render: (text: string) => typeOptions.find(opt => opt.value === text)?.label || text
    },
    {
      title: '接入协议', dataIndex: 'protocol', key: 'protocol', width: 100,
      render: (text: string) => protocolOptions.find(opt => opt.value === text)?.label || text || '-'
    },
    {
      title: '连接状态', dataIndex: 'connectionStatus', key: 'connectionStatus', width: 90,
      render: (text: string) => (
        <span className="flex items-center gap-1">
          {getStatusIcon(text)}
          <span className={text === 'online' ? 'text-green-500' : text === 'offline' ? 'text-red-500' : 'text-yellow-500'}>
            {getStatusText(text)}
          </span>
        </span>
      )
    },
    {
      title: '状态', dataIndex: 'enabled', key: 'enabled', width: 80,
      render: (_: unknown, record: DataSourceDTO) => (
        <Switch checked={record.enabled === 1} onChange={() => toggleStatus(record)} checkedChildren="启用" unCheckedChildren="禁用" />
      )
    },
    { title: '创建时间', dataIndex: 'createTime', key: 'createTime', width: 150 },
    {
      title: '操作', key: 'actions', width: 160, align: 'center' as const,
      render: (_: unknown, record: DataSourceDTO) => (
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
            新增数据源
          </Button>
        </div>
      </div>

      <div className="flex items-center justify-center flex-shrink-0 mb-2">
        <div className="alert-center-title" style={{ position: 'static', transform: 'none' }}>
          <span className="title-diamond">◆</span>
          <span>数据接入管理</span>
          <span className="title-diamond">◆</span>
        </div>
      </div>

      <div className="flex items-center gap-3 flex-shrink-0 mb-2">
        <Input
          className="model_from_input !w-230px"
          placeholder="搜索数据源名称"
          value={searchName}
          onChange={e => setSearchName(e.target.value)}
          onPressEnter={() => applySearch()}
          allowClear
          onClear={() => applySearch('')}
          suffix={<SearchOutlined className="text-[#03FBFD] cursor-pointer" onClick={() => applySearch()} />}
        />
        <Select
          className="!w-170px model_from_sel" classNames={{ popup: { root: 'alert-rule-dropdown' } }}
          placeholder="筛选接入类型"
          value={filterDataType}
          onChange={handleDataTypeFilter}
          options={typeOptions}
          allowClear
        />
        <Select
          className="!w-150px model_from_sel" classNames={{ popup: { root: 'alert-rule-dropdown' } }}
          placeholder="筛选连接状态"
          value={filterConnStatus}
          onChange={value => setFilterConnStatus(value)}
          options={[
            { value: 'online', label: '在线' },
            { value: 'offline', label: '离线' },
            { value: 'abnormal', label: '异常' },
          ]}
          allowClear
        />
        <Select
          className="!w-130px model_from_sel" classNames={{ popup: { root: 'alert-rule-dropdown' } }}
          placeholder="筛选状态"
          value={filterEnabled}
          onChange={handleEnabledFilter}
          options={[
            { value: 1, label: '启用' },
            { value: 0, label: '禁用' },
          ]}
          allowClear
        />
      </div>

      <div className="tech-table-wrapper">
        <Table
          dataSource={displayData}
          columns={columns}
          rowKey="id"
          loading={loading}
          size="small"
          scroll={{ x: 850 }}
          pagination={{
            current: pageNum,
            pageSize,
            total,
            showSizeChanger: true,
            onChange: (page, size) => { setPageNum(page); setPageSize(size) },
          }}
        />
      </div>

      <Modal
        title={<span className="alert-rule-modal-title">{editingItem ? '编辑数据源' : '新增数据源'}</span>}
        open={isModalVisible}
        onCancel={() => { setIsModalVisible(false); form.resetFields() }}
        width={860}
        className="alert-rule-modal"
        footer={[
          <Button key="cancel" onClick={() => { setIsModalVisible(false); form.resetFields() }}>取消</Button>,
          <Button key="ok" type="primary" onClick={handleOk}>确定</Button>,
        ]}
      >
        <Form
          form={form}
          layout="horizontal"
          labelCol={{ style: { width: 100, textAlign: 'right', color: '#03FBFD', paddingRight: 10 } }}
          className="alert-rule-form pt-2"
        >
          <Form.Item label="数据源名称" name="deviceName" rules={[{ required: true, message: '请输入数据源名称' }]}>
            <Input className="model_from_input" placeholder="请输入数据源名称" />
          </Form.Item>
          <Form.Item label="设备编号" name="deviceId">
            <Input className="model_from_input" placeholder="请输入设备编号（MN码/唯一标识）" />
          </Form.Item>
          <div className="grid grid-cols-2 gap-x-2">
            <Form.Item label="接入类型" name="dataType" rules={[{ required: true, message: '请选择接入类型' }]}>
              <Select className="model_from_sel" classNames={{ popup: { root: 'alert-rule-dropdown' } }} placeholder="请选择接入类型" onChange={handleTypeChange}>
                {typeOptions.map(opt => <Option key={opt.value} value={opt.value}>{opt.label}</Option>)}
              </Select>
            </Form.Item>
            {selectedType !== 'manual_import' && (
              <Form.Item label="接入协议" name="protocol" rules={[{ required: true, message: '请选择接入协议' }]}>
                <Select className="model_from_sel" classNames={{ popup: { root: 'alert-rule-dropdown' } }} placeholder="请选择接入协议">
                  {protocolOptions.map(opt => <Option key={opt.value} value={opt.value}>{opt.label}</Option>)}
                </Select>
              </Form.Item>
            )}
          </div>
          <Form.Item label="安装位置" name="location">
            <Input className="model_from_input" placeholder="如：杭州超山森林公园监测站" />
          </Form.Item>
          <div className="grid grid-cols-2 gap-x-2">
            <Form.Item label="地市" name="cityId" rules={[{ required: true, message: '请选择地市' }]}>
              <Select
                className="model_from_sel" classNames={{ popup: { root: 'alert-rule-dropdown' } }}
                placeholder="请选择地市"
                disabled={!canSelectRegion}
                showSearch
                optionFilterProp="label"
                options={cityOptions}
                onChange={() => { form.setFieldsValue({ districtId: undefined, townId: undefined }) }}
              />
            </Form.Item>
            <Form.Item label="区县" name="districtId" rules={[{ required: true, message: '请选择区县' }]}>
              <Select
                className="model_from_sel" classNames={{ popup: { root: 'alert-rule-dropdown' } }}
                placeholder={watchedCityId ? '请选择区县' : '请先选择地市'}
                disabled={roleLevel === 'county' || roleLevel === 'town' || !watchedCityId}
                showSearch
                optionFilterProp="label"
                options={districtOptions}
                onChange={() => { form.setFieldsValue({ townId: undefined }) }}
              />
            </Form.Item>
          </div>
          <div className="grid grid-cols-2 gap-x-2">
            <Form.Item label="乡镇" name="townId">
              <Select
                className="model_from_sel" classNames={{ popup: { root: 'alert-rule-dropdown' } }}
                placeholder={watchedDistrictId ? '请选择乡镇' : '请先选择区县'}
                disabled={roleLevel === 'town' || !watchedDistrictId}
                showSearch
                optionFilterProp="label"
                options={townOptions}
                allowClear
              />
            </Form.Item>
            <Form.Item label="是否启用" name="enabled" valuePropName="checked" initialValue={true}>
              <Switch checkedChildren="启用" unCheckedChildren="禁用" />
            </Form.Item>
          </div>
          <div className="grid grid-cols-2 gap-x-2">
            <Form.Item label="经度" name="lng" rules={[coordinateRule('经度', -180, 180)]}>
              <Input className="model_from_input" placeholder="如：119.649522" />
            </Form.Item>
            <Form.Item label="纬度" name="lat" rules={[coordinateRule('纬度', -90, 90)]}>
              <Input className="model_from_input" placeholder="如：29.089524" />
            </Form.Item>
          </div>
          <Form.Item label="描述说明" name="description">
            <Input.TextArea className="model_from_input" rows={3} placeholder="请输入描述" />
          </Form.Item>
        </Form>
      </Modal>

      <Modal
        title={<span className="alert-rule-modal-title">数据源详情</span>}
        open={isDetailModalVisible}
        onCancel={() => setIsDetailModalVisible(false)}
        footer={null}
        width={550}
        className="alert-rule-modal"
      >
        {editingItem && (
          <div className="space-y-3 p-4 rounded text-white/85" style={{ backgroundColor: 'rgba(3,251,253,0.05)', border: '1px solid rgba(3,251,253,0.15)' }}>
            <div className="flex justify-between"><span className="text-[#03FBFD]">名称</span><span>{editingItem.deviceName}</span></div>
            <div className="flex justify-between"><span className="text-[#03FBFD]">设备编号</span><span>{editingItem.deviceId || '-'}</span></div>
            <div className="flex justify-between"><span className="text-[#03FBFD]">类型</span><span>{typeOptions.find(o => o.value === editingItem.dataType)?.label}</span></div>
            <div className="flex justify-between"><span className="text-[#03FBFD]">协议</span><span>{protocolOptions.find(o => o.value === editingItem.protocol)?.label || '-'}</span></div>
            <div className="flex justify-between"><span className="text-[#03FBFD]">连接状态</span><span className={editingItem.connectionStatus === 'online' ? 'text-green-400' : 'text-red-400'}>{getStatusText(editingItem.connectionStatus)}</span></div>
            <div className="flex justify-between"><span className="text-[#03FBFD]">安装位置</span><span>{editingItem.location || '-'}</span></div>
            <div className="flex justify-between"><span className="text-[#03FBFD]">经纬度</span><span>{editingItem.lng != null && editingItem.lat != null ? `${editingItem.lng}, ${editingItem.lat}` : '-'}</span></div>
            <div className="flex justify-between">
              <span className="text-[#03FBFD]">所属区域</span>
              <span>{[editingItem.cityId, editingItem.districtId, editingItem.townId].filter(id => id != null && Number(id) !== 0).map(id => allDepts.find(d => Number(d.deptId) === Number(id))?.deptName ?? String(id)).join(' / ') || '-'}</span>
            </div>
            <div className="flex justify-between"><span className="text-[#03FBFD]">创建时间</span><span>{editingItem.createTime || '-'}</span></div>
            <div><span className="text-[#03FBFD] block mb-1">描述</span><p className="text-white/70 text-sm">{editingItem.description || '-'}</p></div>
          </div>
        )}
      </Modal>
    </div>
  )
}

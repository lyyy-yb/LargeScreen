import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Button, Table, Modal, Form, Input, Select, Tag, message } from 'antd'
import { EyeOutlined, WarningOutlined, ImportOutlined, ArrowLeftOutlined } from '@ant-design/icons'
import { useAppStore } from '@/stores'

interface AirQualityRecord { id: string; monitorTime: string; pm25: number; o3: number; temperature: number; pressure: number; humidity: number; windSpeed: number; windDirection: string; rainfall: number; dataLevel: 'minute' | 'hour' }
interface MobileCarRecord { id: string; monitorTime: string; totalSuspendedParticulates: number; fineParticulates: number; latitude: number; longitude: number; roadDustLoad: number }
interface CustomCollectRecord { id: string; monitorTime: string; longitude: number; latitude: number; tvocs: number }
interface NoxCollectRecord { id: string; monitorTime: string; longitude: number; latitude: number; nox: number; no2: number; no: number }
interface DataRecord { id: string; name: string; deviceId: string; location: string; accessTime: string; status: string; lat?: number; lng?: number; duration?: string; fileSize?: string; resolution?: string; airQualityData?: AirQualityRecord; mobileCarData?: MobileCarRecord; customCollectData?: CustomCollectRecord; noxCollectData?: NoxCollectRecord }
interface DataSource { id: string; name: string; type: string; typeLabel: string; protocol: string; protocolLabel: string; connectionStatus: string; createdAt: string; description: string; records: DataRecord[] }

const typeOptions = [
  { value: 'air_quality_station', label: '空气质量检测站' },
  { value: 'mobile_monitor_car', label: '走航车' },
  { value: 'drone_video', label: '无人机视频' },
  { value: 'drone_sensor', label: '无人机传感器' },
  { value: 'power_monitor', label: '用电监控' },
  { value: 'radar_station', label: '雷达站' },
  { value: 'manual_import', label: '人工采集导入' },
]

export default function DataManage() {
  const navigate = useNavigate()
  const roleKey = useAppStore(state => state.regionContext?.roleKey)
  // 乡镇业务人员无监控大屏权限，不显示返回按钮
  const showBackToMonitor = roleKey !== 'town_business'
  const [dataSources] = useState<DataSource[]>([])
  const [selectedType, setSelectedType] = useState('')
  const [selectedStatus, setSelectedStatus] = useState('')
  const [searchText, setSearchText] = useState('')
  const [showDetailModal, setShowDetailModal] = useState(false)
  const [showAirQualityDetail, setShowAirQualityDetail] = useState(false)
  const [showImportModal, setShowImportModal] = useState(false)
  const [showAlertModal, setShowAlertModal] = useState(false)
  const [selectedSource, setSelectedSource] = useState<DataSource | null>(null)
  const [selectedRecord, setSelectedRecord] = useState<DataRecord | null>(null)
  const [selectedAirQuality, setSelectedAirQuality] = useState<AirQualityRecord | null>(null)
  const [importSource, setImportSource] = useState<DataSource | null>(null)
  const [dataLevelFilter, setDataLevelFilter] = useState<'all' | 'minute' | 'hour'>('all')
  const [alertForm] = Form.useForm()
  const [importForm] = Form.useForm()

  const getStatusIcon = (status: string) => {
    if (['online', '正常', '在线', '已审核', '已汇总'].includes(status)) return <span className="inline-block w-2 h-2 rounded-full bg-green-500" />
    if (['offline', '离线'].includes(status)) return <span className="inline-block w-2 h-2 rounded-full bg-red-500" />
    return <span className="inline-block w-2 h-2 rounded-full bg-blue-500" />
  }

  const filteredSources = dataSources.filter(s => {
    const typeMatch = !selectedType || s.type === selectedType
    const statusMatch = !selectedStatus || s.connectionStatus === selectedStatus
    const searchMatch = !searchText || s.name.toLowerCase().includes(searchText.toLowerCase()) || s.typeLabel.includes(searchText)
    return typeMatch && statusMatch && searchMatch
  })

  const filteredRecords = selectedSource?.records.filter(r => {
    if (selectedSource?.type !== 'air_quality_station') return true
    if (dataLevelFilter === 'all') return true
    return r.airQualityData?.dataLevel === dataLevelFilter
  }) || []

  const handleViewDetail = (source: DataSource) => { setSelectedSource(source); setDataLevelFilter('all'); setShowDetailModal(true) }
  const handleManualImport = (source: DataSource) => { setImportSource(source); importForm.resetFields(); setShowImportModal(true) }
  const handleConvertToAlert = (record: DataRecord) => { setSelectedRecord(record); alertForm.resetFields(); setShowAlertModal(true) }

  const submitAlert = (values: any) => { message.success(`已将「${selectedRecord?.name}」转为预警，级别：${values.alertLevel}`); setShowAlertModal(false) }
  const submitImport = () => { message.success('已成功导入数据'); setShowImportModal(false); importForm.resetFields() }

  const thStyle = { color: '#03FBFD', fontWeight: 500 } as const
  const tdStyle = { color: 'rgba(255,255,255,0.75)' } as const

  return (
    <div className="alert-page-container">
      <div className="alert-header-bar">
        <div className="header-left">
          {showBackToMonitor && (
            <Button
              type="text"
              icon={<ArrowLeftOutlined />}
              onClick={() => navigate('/monitor')}
              className="!text-[#03FBFD] hover:!text-white !px-2 !h-28px"
            >
              返回监控大屏
            </Button>
          )}
        </div>

        <div className="header-right" />
      </div>

      <div className="flex items-center justify-center flex-shrink-0 mb-2">
        <div className="alert-center-title" style={{ position: 'static', transform: 'none' }}>
          <span className="title-diamond">◆</span>
          <span>数据管理</span>
          <span className="title-diamond">◆</span>
        </div>
      </div>

      <div className="flex gap-4 mb-3 flex-shrink-0">
        <Input placeholder="搜索数据源名称、类型..." value={searchText} onChange={e => setSearchText(e.target.value)} className="max-w-xs model_from_input" />
        <Select placeholder="选择接入类型" value={selectedType} onChange={setSelectedType} className="w-180px model_from_sel" popupClassName="alert-rule-dropdown" allowClear>
          <Select.Option value="">全部数据源</Select.Option>
          {typeOptions.map(opt => <Select.Option key={opt.value} value={opt.value}>{opt.label}</Select.Option>)}
        </Select>
        <Select placeholder="选择连接状态" value={selectedStatus} onChange={setSelectedStatus} className="w-140px model_from_sel" popupClassName="alert-rule-dropdown" allowClear>
          <Select.Option value="">全部状态</Select.Option>
          <Select.Option value="online">在线</Select.Option>
          <Select.Option value="offline">离线</Select.Option>
        </Select>
      </div>

      <div className="tech-table-wrapper">
        <Table
          dataSource={filteredSources}
          columns={[
            { title: '数据源ID', dataIndex: 'id', key: 'id', width: 90 },
            { title: '数据源名称', dataIndex: 'name', key: 'name', width: 180 },
            { title: '接入类型', dataIndex: 'typeLabel', key: 'typeLabel', width: 120 },
            { title: '接入协议', dataIndex: 'protocolLabel', key: 'protocolLabel', width: 100, render: (v: string) => v || '-' },
            { title: '创建时间', dataIndex: 'createdAt', key: 'createdAt', width: 150 },
            {
              title: '连接状态', dataIndex: 'connectionStatus', key: 'connectionStatus', width: 90, align: 'center' as const,
              render: (status: string) => (
                <span className="flex items-center gap-1 justify-center">
                  {getStatusIcon(status)}
                  <span className={status === 'online' ? 'text-green-400' : 'text-red-400'}>{status === 'online' ? '在线' : '离线'}</span>
                </span>
              )
            },
            { title: '数据量', dataIndex: 'records', key: 'records', width: 80, align: 'center' as const, render: (records: any[]) => <Tag color="blue">{records?.length || 0} 条</Tag> },
            {
              title: '操作', key: 'actions', width: 130, align: 'center' as const,
              render: (_: any, source: DataSource) => (
                <div className="flex items-center gap-1 justify-center">
                  <Button type="link" size="small" icon={<EyeOutlined />} className="!text-[#03FBFD] !p-0 hover:!text-white" onClick={() => handleViewDetail(source)}>详情</Button>
                  {['air_quality_station', 'mobile_monitor_car', 'drone_video'].includes(source.type) || (source.type === 'manual_import') ? (
                    <Button type="link" size="small" icon={<ImportOutlined />} className="!text-[#52C41A] !p-0 hover:!text-green-300" onClick={() => handleManualImport(source)}>导入</Button>
                  ) : null}
                </div>
              )
            }
          ]}
          rowKey="id"
          size="small"
          pagination={{ defaultPageSize: 15, showSizeChanger: true }}
          scroll={{ x: 940 }}
        />
      </div>

      {/* 数据源详情弹窗 */}
      <Modal
        title={<span className="alert-rule-modal-title">{selectedSource ? `${selectedSource.name} - 数据列表` : '数据列表'}</span>}
        open={showDetailModal}
        onCancel={() => { setShowDetailModal(false); setSelectedSource(null) }}
        footer={null}
        width={1000}
        className="alert-rule-modal"
      >
        {selectedSource && (
          <div className="space-y-4">
            <div className="p-4 rounded bg-cyan-500/5 border border-cyan-500/15">
              <div className="grid grid-cols-4 gap-4 text-sm">
                <div><span className="text-[#03FBFD]">数据源ID：</span><span className="text-white/75">{selectedSource.id}</span></div>
                <div><span className="text-[#03FBFD]">接入类型：</span><span className="text-white/75">{selectedSource.typeLabel}</span></div>
                <div><span className="text-[#03FBFD]">接入协议：</span><span className="text-white/75">{selectedSource.protocolLabel || '-'}</span></div>
                <div><span className="text-[#03FBFD]">连接状态：</span><Tag color={selectedSource.connectionStatus === 'online' ? 'green' : 'red'}>{selectedSource.connectionStatus === 'online' ? '在线' : '离线'}</Tag></div>
              </div>
              <div className="mt-2"><span className="text-[#03FBFD]">描述：</span><span className="text-white/75">{selectedSource.description}</span></div>
            </div>

            {selectedSource.type === 'air_quality_station' && (
              <div className="flex items-center gap-4 p-3 rounded-lg bg-[rgba(0,56,129,0.8)] border border-cyan-500/20">
                <span className="text-[#03FBFD] font-semibold text-sm">数据级别筛选：</span>
                {(['all', 'minute', 'hour'] as const).map(level => (
                  <button key={level} onClick={() => setDataLevelFilter(level)} className={`px-4 py-2 rounded-lg text-sm transition-all ${dataLevelFilter === level ? 'bg-cyan-500/15 border border-cyan-400 text-[#03FBFD] font-semibold' : 'bg-black/30 border border-cyan-500/30 text-white'}`}>
                    {level === 'all' ? '全部' : level === 'minute' ? '分钟级' : '小时级'}
                  </button>
                ))}
              </div>
            )}

            <div className="tech-table-wrapper overflow-x-auto max-h-400px overflow-y-auto">
              {selectedSource.type === 'air_quality_station' ? (
                <table className="w-full" style={{ borderCollapse: 'collapse' }}>
                  <thead><tr style={{ borderBottom: '1px solid rgba(3,251,253,0.2)' }}>
                    <th className="p-2 text-left" style={thStyle}>监测时间</th><th className="p-2 text-center" style={thStyle}>级别</th><th className="p-2 text-center" style={thStyle}>PM2.5</th><th className="p-2 text-center" style={thStyle}>O3</th><th className="p-2 text-center" style={thStyle}>温度</th><th className="p-2 text-center" style={thStyle}>湿度</th><th className="p-2 text-center" style={thStyle}>风速</th><th className="p-2 text-center" style={thStyle}>操作</th>
                  </tr></thead>
                  <tbody>
                    {filteredRecords.map(r => r.airQualityData && (
                      <tr key={r.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
                        <td className="p-2" style={tdStyle}>{r.airQualityData.monitorTime}</td>
                        <td className="p-2 text-center"><Tag color={r.airQualityData.dataLevel === 'minute' ? 'blue' : 'orange'}>{r.airQualityData.dataLevel === 'minute' ? '分钟级' : '小时级'}</Tag></td>
                        <td className="p-2 text-center" style={tdStyle}>{r.airQualityData.pm25}</td>
                        <td className="p-2 text-center" style={tdStyle}>{r.airQualityData.o3}</td>
                        <td className="p-2 text-center" style={tdStyle}>{r.airQualityData.temperature}</td>
                        <td className="p-2 text-center" style={tdStyle}>{r.airQualityData.humidity}</td>
                        <td className="p-2 text-center" style={tdStyle}>{r.airQualityData.windSpeed}</td>
                        <td className="p-2 text-center"><Button size="small" onClick={() => { setSelectedAirQuality(r.airQualityData!); setShowAirQualityDetail(true) }}>详情</Button></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              ) : selectedSource.type === 'mobile_monitor_car' ? (
                <table className="w-full" style={{ borderCollapse: 'collapse' }}>
                  <thead><tr style={{ borderBottom: '1px solid rgba(3,251,253,0.2)' }}>
                    <th className="p-2 text-left" style={thStyle}>监测时间</th><th className="p-2 text-center" style={thStyle}>总悬浮颗粒物</th><th className="p-2 text-center" style={thStyle}>细微颗粒物</th><th className="p-2 text-center" style={thStyle}>纬度</th><th className="p-2 text-center" style={thStyle}>经度</th><th className="p-2 text-center" style={thStyle}>尘负荷</th>
                  </tr></thead>
                  <tbody>
                    {filteredRecords.map(r => r.mobileCarData && (
                      <tr key={r.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
                        <td className="p-2" style={tdStyle}>{r.mobileCarData.monitorTime}</td>
                        <td className="p-2 text-center" style={tdStyle}>{r.mobileCarData.totalSuspendedParticulates}</td>
                        <td className="p-2 text-center" style={tdStyle}>{r.mobileCarData.fineParticulates}</td>
                        <td className="p-2 text-center" style={tdStyle}>{r.mobileCarData.latitude}</td>
                        <td className="p-2 text-center" style={tdStyle}>{r.mobileCarData.longitude}</td>
                        <td className="p-2 text-center" style={tdStyle}>{r.mobileCarData.roadDustLoad}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              ) : selectedSource.name.includes('MS') ? (
                <table className="w-full" style={{ borderCollapse: 'collapse' }}>
                  <thead><tr style={{ borderBottom: '1px solid rgba(3,251,253,0.2)' }}>
                    <th className="p-2 text-left" style={thStyle}>测量时间</th><th className="p-2 text-center" style={thStyle}>经度</th><th className="p-2 text-center" style={thStyle}>纬度</th><th className="p-2 text-center" style={thStyle}>TVOCs(ppb)</th>
                  </tr></thead>
                  <tbody>
                    {filteredRecords.map(r => r.customCollectData && (
                      <tr key={r.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
                        <td className="p-2" style={tdStyle}>{r.customCollectData.monitorTime}</td>
                        <td className="p-2 text-center" style={tdStyle}>{r.customCollectData.longitude.toFixed(6)}</td>
                        <td className="p-2 text-center" style={tdStyle}>{r.customCollectData.latitude.toFixed(6)}</td>
                        <td className="p-2 text-center" style={tdStyle}>{r.customCollectData.tvocs.toFixed(6)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              ) : selectedSource.name.includes('NOX') ? (
                <table className="w-full" style={{ borderCollapse: 'collapse' }}>
                  <thead><tr style={{ borderBottom: '1px solid rgba(3,251,253,0.2)' }}>
                    <th className="p-2 text-left" style={thStyle}>测量时间</th><th className="p-2 text-center" style={thStyle}>NOX</th><th className="p-2 text-center" style={thStyle}>NO2</th><th className="p-2 text-center" style={thStyle}>NO</th><th className="p-2 text-center" style={thStyle}>经度</th><th className="p-2 text-center" style={thStyle}>纬度</th>
                  </tr></thead>
                  <tbody>
                    {filteredRecords.map(r => r.noxCollectData && (
                      <tr key={r.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
                        <td className="p-2" style={tdStyle}>{r.noxCollectData.monitorTime}</td>
                        <td className="p-2 text-center" style={tdStyle}>{r.noxCollectData.nox.toFixed(4)}</td>
                        <td className="p-2 text-center" style={tdStyle}>{r.noxCollectData.no2.toFixed(4)}</td>
                        <td className="p-2 text-center" style={tdStyle}>{r.noxCollectData.no.toFixed(4)}</td>
                        <td className="p-2 text-center" style={tdStyle}>{r.noxCollectData.longitude.toFixed(6)}</td>
                        <td className="p-2 text-center" style={tdStyle}>{r.noxCollectData.latitude.toFixed(6)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              ) : (
                <table className="w-full" style={{ borderCollapse: 'collapse' }}>
                  <thead><tr style={{ borderBottom: '1px solid rgba(3,251,253,0.2)' }}>
                    <th className="p-2 text-left" style={thStyle}>任务ID</th><th className="p-2 text-left" style={thStyle}>任务名称</th><th className="p-2 text-left" style={thStyle}>执行时间</th><th className="p-2 text-center" style={thStyle}>状态</th><th className="p-2 text-center" style={thStyle}>操作</th>
                  </tr></thead>
                  <tbody>
                    {filteredRecords.map(r => (
                      <tr key={r.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
                        <td className="p-2" style={tdStyle}>{r.id}</td>
                        <td className="p-2" style={tdStyle}>{r.name}</td>
                        <td className="p-2" style={tdStyle}>{r.accessTime}</td>
                        <td className="p-2 text-center"><span className="flex items-center gap-2 justify-center">{getStatusIcon(r.status)}<span>{r.status}</span></span></td>
                        <td className="p-2 text-center">
                          <Button size="small" onClick={() => setSelectedRecord(r)}>查看</Button>
                          {selectedSource.type === 'drone_video' && <Button size="small" icon={<WarningOutlined />} className="ml-2" danger onClick={() => handleConvertToAlert(r)}>转预警</Button>}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        )}
      </Modal>

      {/* 空气质量详情 */}
      <Modal title={<span className="text-[#03FBFD] font-bold">空气质量数据详情</span>} open={showAirQualityDetail} onCancel={() => { setShowAirQualityDetail(false); setSelectedAirQuality(null) }} footer={null} width={500}>
        {selectedAirQuality && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div><span className="text-[#03FBFD] font-medium">监测时间：</span><span className="text-white/75">{selectedAirQuality.monitorTime}</span></div>
              <div><span className="text-[#03FBFD] font-medium">数据级别：</span><Tag color={selectedAirQuality.dataLevel === 'minute' ? 'blue' : 'orange'}>{selectedAirQuality.dataLevel === 'minute' ? '分钟级' : '小时级'}</Tag></div>
            </div>
            <div className="grid grid-cols-3 gap-4 mt-4">
              <div className="p-3 rounded bg-blue-500/10 border border-blue-500/30"><div className="text-xs text-blue-400 mb-1">PM2.5</div><div className="text-2xl font-bold text-white">{selectedAirQuality.pm25}<span className="text-sm font-normal text-gray-400 ml-1">μg/m³</span></div></div>
              <div className="p-3 rounded bg-green-500/10 border border-green-500/30"><div className="text-xs text-green-400 mb-1">O3</div><div className="text-2xl font-bold text-white">{selectedAirQuality.o3}<span className="text-sm font-normal text-gray-400 ml-1">μg/m³</span></div></div>
              <div className="p-3 rounded bg-red-500/10 border border-red-500/30"><div className="text-xs text-red-400 mb-1">温度</div><div className="text-2xl font-bold text-white">{selectedAirQuality.temperature}<span className="text-sm font-normal text-gray-400 ml-1">℃</span></div></div>
              <div className="p-3 rounded bg-yellow-500/10 border border-yellow-500/30"><div className="text-xs text-yellow-400 mb-1">大气压力</div><div className="text-2xl font-bold text-white">{selectedAirQuality.pressure}<span className="text-sm font-normal text-gray-400 ml-1">kpa</span></div></div>
              <div className="p-3 rounded bg-cyan-500/10 border border-cyan-500/30"><div className="text-xs text-cyan-400 mb-1">湿度</div><div className="text-2xl font-bold text-white">{selectedAirQuality.humidity}<span className="text-sm font-normal text-gray-400 ml-1">%</span></div></div>
              <div className="p-3 rounded bg-purple-500/10 border border-purple-500/30"><div className="text-xs text-purple-400 mb-1">风速</div><div className="text-2xl font-bold text-white">{selectedAirQuality.windSpeed}<span className="text-sm font-normal text-gray-400 ml-1">m/s</span></div></div>
            </div>
            <div className="mt-4 pt-4 border-t border-white/10 flex justify-between">
              <span className="text-[#03FBFD]">主导风向：{selectedAirQuality.windDirection}</span>
              <span className="text-[#03FBFD]">雨量：{selectedAirQuality.rainfall} mm</span>
            </div>
          </div>
        )}
      </Modal>

      {/* 手工导入 */}
      <Modal title={<span className="alert-rule-modal-title">手工导入数据</span>} open={showImportModal} onCancel={() => { setShowImportModal(false); setImportSource(null) }} footer={null} width={650} className="alert-rule-modal">
        {importSource && (
          <Form form={importForm} layout="vertical" onFinish={submitImport} className="alert-rule-form pt-2">
            <div className="mb-4 p-3 rounded bg-cyan-500/8 border border-cyan-500/15">
              <div className="text-sm text-white/75"><span className="text-[#03FBFD]">目标数据源：</span>{importSource.name}</div>
            </div>
            <Form.Item name="monitorTime" label={<span className="text-[#03FBFD]">监测时间</span>} rules={[{ required: true, message: '请输入监测时间' }]}><Input className="model_from_input" placeholder="格式：2023-12-01 00:00:00" /></Form.Item>
            {importSource.type === 'air_quality_station' && (
              <div className="grid grid-cols-2 gap-4">
                <Form.Item name="pm25" label={<span className="text-[#03FBFD]">PM2.5 (μg/m³)</span>} rules={[{ required: true }]}><Input className="model_from_input" type="number" /></Form.Item>
                <Form.Item name="o3" label={<span className="text-[#03FBFD]">O3 (μg/m³)</span>} rules={[{ required: true }]}><Input className="model_from_input" type="number" /></Form.Item>
                <Form.Item name="temperature" label={<span className="text-[#03FBFD]">温度 (℃)</span>} rules={[{ required: true }]}><Input className="model_from_input" type="number" /></Form.Item>
                <Form.Item name="humidity" label={<span className="text-[#03FBFD]">湿度 (%)</span>} rules={[{ required: true }]}><Input className="model_from_input" type="number" /></Form.Item>
                <Form.Item name="windSpeed" label={<span className="text-[#03FBFD]">风速 (m/s)</span>} rules={[{ required: true }]}><Input className="model_from_input" type="number" /></Form.Item>
                <Form.Item name="windDirection" label={<span className="text-[#03FBFD]">主导风向</span>} rules={[{ required: true }]}><Select className="model_from_sel" popupClassName="alert-rule-dropdown" placeholder="请选择"><Select.Option value="北风">北风</Select.Option><Select.Option value="南风">南风</Select.Option><Select.Option value="东风">东风</Select.Option><Select.Option value="西风">西风</Select.Option></Select></Form.Item>
              </div>
            )}
            {importSource.type === 'mobile_monitor_car' && (
              <div className="grid grid-cols-2 gap-4">
                <Form.Item name="totalSuspendedParticulates" label={<span className="text-[#03FBFD]">总悬浮颗粒物</span>} rules={[{ required: true }]}><Input className="model_from_input" type="number" /></Form.Item>
                <Form.Item name="fineParticulates" label={<span className="text-[#03FBFD]">细微颗粒物</span>} rules={[{ required: true }]}><Input className="model_from_input" type="number" /></Form.Item>
                <Form.Item name="latitude" label={<span className="text-[#03FBFD]">纬度</span>} rules={[{ required: true }]}><Input className="model_from_input" type="number" /></Form.Item>
                <Form.Item name="longitude" label={<span className="text-[#03FBFD]">经度</span>} rules={[{ required: true }]}><Input className="model_from_input" type="number" /></Form.Item>
                <Form.Item name="roadDustLoad" label={<span className="text-[#03FBFD]">道路尘负荷</span>} rules={[{ required: true }]}><Input className="model_from_input" type="number" /></Form.Item>
              </div>
            )}
            {importSource.name.includes('MS') && (
              <div className="grid grid-cols-2 gap-4">
                <Form.Item name="longitude" label={<span className="text-[#03FBFD]">经度</span>} rules={[{ required: true }]}><Input className="model_from_input" type="number" /></Form.Item>
                <Form.Item name="latitude" label={<span className="text-[#03FBFD]">纬度</span>} rules={[{ required: true }]}><Input className="model_from_input" type="number" /></Form.Item>
                <Form.Item name="tvocs" label={<span className="text-[#03FBFD]">TVOCs (ppb)</span>} rules={[{ required: true }]}><Input className="model_from_input" type="number" /></Form.Item>
              </div>
            )}
            {importSource.name.includes('NOX') && (
              <div className="grid grid-cols-2 gap-4">
                <Form.Item name="nox" label={<span className="text-[#03FBFD]">NOX (μg/m³)</span>} rules={[{ required: true }]}><Input className="model_from_input" type="number" /></Form.Item>
                <Form.Item name="no2" label={<span className="text-[#03FBFD]">NO2 (μg/m³)</span>} rules={[{ required: true }]}><Input className="model_from_input" type="number" /></Form.Item>
                <Form.Item name="no" label={<span className="text-[#03FBFD]">NO (μg/m³)</span>} rules={[{ required: true }]}><Input className="model_from_input" type="number" /></Form.Item>
                <Form.Item name="longitude" label={<span className="text-[#03FBFD]">经度</span>} rules={[{ required: true }]}><Input className="model_from_input" type="number" /></Form.Item>
                <Form.Item name="latitude" label={<span className="text-[#03FBFD]">纬度</span>} rules={[{ required: true }]}><Input className="model_from_input" type="number" /></Form.Item>
              </div>
            )}
            <div className="flex justify-end gap-4 mt-4">
              <Button onClick={() => setShowImportModal(false)}>取消</Button>
              <Button type="primary" htmlType="submit">确认导入</Button>
            </div>
          </Form>
        )}
      </Modal>

      {/* 数据记录详情 */}
      <Modal title={<span className="alert-rule-modal-title">数据详情</span>} open={!!selectedRecord} onCancel={() => setSelectedRecord(null)} footer={null} className="alert-rule-modal">
        {selectedRecord && (
          <div className="space-y-3 p-4 rounded text-white/85" style={{ backgroundColor: 'rgba(3,251,253,0.05)', border: '1px solid rgba(3,251,253,0.15)' }}>
            <div className="text-sm text-white/75"><span className="text-[#03FBFD] font-medium">任务ID：</span>{selectedRecord.id}</div>
            <div className="text-sm text-white/75"><span className="text-[#03FBFD] font-medium">任务名称：</span>{selectedRecord.name}</div>
            <div className="text-sm text-white/75"><span className="text-[#03FBFD] font-medium">执行时间：</span>{selectedRecord.accessTime}</div>
            <div className="text-sm text-white/75"><span className="text-[#03FBFD] font-medium">状态：</span><Tag color={['正常', '在线', '已审核', '已汇总'].includes(selectedRecord.status) ? 'green' : selectedRecord.status === '离线' ? 'red' : 'blue'}>{selectedRecord.status}</Tag></div>
            {selectedRecord.lat != null && selectedRecord.lng != null && <div className="text-sm text-white/75"><span className="text-[#03FBFD] font-medium">坐标：</span>{selectedRecord.lat.toFixed(6)}, {selectedRecord.lng.toFixed(6)}</div>}
            {selectedRecord.duration && <div className="text-sm text-white/75"><span className="text-[#03FBFD] font-medium">视频时长：</span>{selectedRecord.duration}</div>}
            {selectedRecord.fileSize && <div className="text-sm text-white/75"><span className="text-[#03FBFD] font-medium">文件大小：</span>{selectedRecord.fileSize}</div>}
            {selectedRecord.resolution && <div className="text-sm text-white/75"><span className="text-[#03FBFD] font-medium">分辨率：</span>{selectedRecord.resolution}</div>}
          </div>
        )}
      </Modal>

      {/* 转预警 */}
      <Modal title={<span className="alert-rule-modal-title">转预警</span>} open={showAlertModal} onCancel={() => setShowAlertModal(false)} footer={null} width={600} className="alert-rule-modal">
        {selectedRecord && (
          <Form form={alertForm} layout="vertical" onFinish={submitAlert} className="alert-rule-form pt-2">
            <div className="mb-4 p-3 rounded bg-cyan-500/8 border border-cyan-500/15">
              <div className="text-sm text-white/75"><span className="text-[#03FBFD]">数据名称：</span>{selectedRecord.name}</div>
              <div className="text-sm text-white/75"><span className="text-[#03FBFD]">设备ID：</span>{selectedRecord.deviceId}</div>
            </div>
            <Form.Item name="alertLevel" label={<span className="text-[#03FBFD]">预警级别</span>} rules={[{ required: true, message: '请选择预警级别' }]}>
              <Select className="model_from_sel" popupClassName="alert-rule-dropdown" placeholder="请选择预警级别">
                <Select.Option value="level1">一级预警（严重）</Select.Option>
                <Select.Option value="level2">二级预警（较重）</Select.Option>
                <Select.Option value="level3">三级预警（一般）</Select.Option>
                <Select.Option value="level4">轻微预警（轻微）</Select.Option>
              </Select>
            </Form.Item>
            <Form.Item name="reason" label={<span className="text-[#03FBFD]">预警原因</span>} rules={[{ required: true, message: '请输入预警原因' }]}><Input.TextArea className="model_from_input" rows={3} placeholder="请输入污染情况描述" /></Form.Item>
            <Form.Item name="suggestion" label={<span className="text-[#03FBFD]">处置建议</span>}><Input.TextArea className="model_from_input" rows={2} placeholder="请输入处置建议（可选）" /></Form.Item>
            <div className="flex justify-end gap-4">
              <Button onClick={() => setShowAlertModal(false)}>取消</Button>
              <Button type="primary" htmlType="submit">确认转预警</Button>
            </div>
          </Form>
        )}
      </Modal>
    </div>
  )
}

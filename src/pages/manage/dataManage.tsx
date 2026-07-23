import { useState } from 'react'
import { Button, Modal, Form, Input, Select, Tag, message } from 'antd'
import { EyeOutlined, WarningOutlined, DatabaseOutlined } from '@ant-design/icons'

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

const generateMinuteData = (): DataRecord[] => {
  const records: DataRecord[] = []
  const base = new Date('2023-12-01T00:00:00')
  for (let i = 0; i < 30; i++) {
    const t = new Date(base.getTime() + i * 60000)
    const mt = t.toISOString().replace('T', ' ').slice(0, 19)
    records.push({ id: `R${String(i + 1).padStart(3, '0')}`, name: `监测数据-${mt}`, deviceId: 'AQ001', location: '杭州市西湖区', accessTime: mt, status: '正常', airQualityData: { id: `AQ${i}`, monitorTime: mt, pm25: Math.floor(Math.random() * 10) + 1, o3: Math.floor(Math.random() * 20) + 30, temperature: Math.floor(Math.random() * 5) + 5, pressure: 103, humidity: Math.floor(Math.random() * 10) + 30, windSpeed: parseFloat((Math.random() * 2 + 0.3).toFixed(1)), windDirection: ['北风', '西风', '西北风'][Math.floor(Math.random() * 3)], rainfall: 0, dataLevel: 'minute' } })
  }
  return records
}

const generateHourData = (): DataRecord[] => {
  const records: DataRecord[] = []
  const base = new Date('2023-12-01T00:00:00')
  for (let i = 0; i < 12; i++) {
    const t = new Date(base.getTime() + i * 3600000)
    const mt = t.toISOString().replace('T', ' ').slice(0, 13) + ':00:00'
    records.push({ id: `RH${String(i + 1).padStart(3, '0')}`, name: `小时汇总-${mt}`, deviceId: 'AQ001', location: '杭州市西湖区', accessTime: mt, status: '已汇总', airQualityData: { id: `AQH${i}`, monitorTime: mt, pm25: Math.floor(Math.random() * 8) + 2, o3: Math.floor(Math.random() * 15) + 35, temperature: Math.floor(Math.random() * 4) + 6, pressure: 103, humidity: Math.floor(Math.random() * 8) + 32, windSpeed: parseFloat((Math.random() * 1.5 + 0.5).toFixed(1)), windDirection: ['北风', '西风'][Math.floor(Math.random() * 2)], rainfall: 0, dataLevel: 'hour' } })
  }
  return records
}

const generateMobileCarData = (): DataRecord[] => {
  const records: DataRecord[] = []
  const base = new Date('2026-04-08T10:54:10')
  for (let i = 0; i < 30; i++) {
    const t = new Date(base.getTime() - i * 3000)
    const mt = t.toISOString().replace('T', ' ').slice(0, 19)
    records.push({ id: `MC${String(i + 1).padStart(3, '0')}`, name: `走航数据-${mt}`, deviceId: 'HYD1009', location: '杭州市余杭区', accessTime: mt, status: '正常', lat: 30.03, lng: 120.84, mobileCarData: { id: `MCR${i}`, monitorTime: mt, totalSuspendedParticulates: parseFloat((Math.random() * 30 + 25).toFixed(2)), fineParticulates: parseFloat((Math.random() * 15 + 10).toFixed(2)), latitude: parseFloat((30.03 + Math.random() * 0.01).toFixed(4)), longitude: parseFloat((120.84 + Math.random() * 0.01).toFixed(4)), roadDustLoad: parseFloat((Math.random() * 0.8 + 0.01).toFixed(2)) } })
  }
  return records
}

const generateMSData = (): DataRecord[] => {
  const records: DataRecord[] = []
  const base = new Date('2023-03-03T07:48:58')
  for (let i = 0; i < 33; i++) {
    const t = new Date(base.getTime() + i * 1000)
    const mt = t.toISOString().replace('T', ' ').slice(0, 19)
    records.push({ id: `MS${String(i + 1).padStart(3, '0')}`, name: `MS数据-${mt}`, deviceId: 'MS001', location: '杭州市', accessTime: mt, status: '正常', lat: 30.4123, lng: 120.2669, customCollectData: { id: `MSR${i}`, monitorTime: mt, longitude: parseFloat((120.2669 + Math.random() * 0.0001).toFixed(6)), latitude: parseFloat((30.4123 + Math.random() * 0.0001).toFixed(6)), tvocs: parseFloat((Math.random() * 5 + 30).toFixed(6)) } })
  }
  return records
}

const generateNOXData = (): DataRecord[] => {
  const records: DataRecord[] = []
  const base = new Date('2023-03-03T07:48:58')
  for (let i = 0; i < 33; i++) {
    const t = new Date(base.getTime() + i * 1000)
    const mt = t.toISOString().replace('T', ' ').slice(0, 19)
    records.push({ id: `NX${String(i + 1).padStart(3, '0')}`, name: `NOX数据-${mt}`, deviceId: 'NOX001', location: '杭州市', accessTime: mt, status: '正常', lat: 30.4123, lng: 120.2669, noxCollectData: { id: `NXR${i}`, monitorTime: mt, longitude: parseFloat((120.2669 + Math.random() * 0.0001).toFixed(6)), latitude: parseFloat((30.4123 + Math.random() * 0.0001).toFixed(6)), nox: parseFloat((Math.random() * 50 + 150).toFixed(6)), no2: parseFloat((Math.random() * 30 + 80).toFixed(6)), no: parseFloat((Math.random() * 30 + 40).toFixed(6)) } })
  }
  return records
}

const mockDataSources: DataSource[] = [
  { id: 'DS001', name: '杭州市环境监测站-1', type: 'air_quality_station', typeLabel: '空气质量检测站', protocol: 'http', protocolLabel: 'HTTP/HTTPS', connectionStatus: 'online', createdAt: '2025-11-01 10:00:00', description: '实时监测PM2.5、PM10等污染物浓度', records: [...generateMinuteData(), ...generateHourData()] },
  { id: 'DS002', name: '走航车-HYD1009', type: 'mobile_monitor_car', typeLabel: '走航车', protocol: 'mqtt', protocolLabel: 'MQTT', connectionStatus: 'online', createdAt: '2025-11-02 14:30:00', description: '杭州区域走航监测', records: generateMobileCarData() },
  { id: 'DS003', name: '无人机机场-临平', type: 'drone_sensor', typeLabel: '无人机传感器', protocol: 'websocket', protocolLabel: 'WebSocket', connectionStatus: 'online', createdAt: '2025-11-03 09:15:00', description: '无人机传感器数据接入', records: [{ id: 'R006', name: '无人机-001 飞行数据', deviceId: 'DRONE001', location: '杭州市临平区', accessTime: '2025-11-24 14:15:00', status: '飞行中', lat: 30.319126, lng: 120.141503 }, { id: 'R007', name: '无人机-002 飞行数据', deviceId: 'DRONE002', location: '杭州市上城区', accessTime: '2025-11-24 13:30:00', status: '已完成', lat: 30.275550, lng: 120.152300 }] },
  { id: 'DS004', name: '工厂用电监控-萧山', type: 'power_monitor', typeLabel: '用电监控', protocol: 'mqtt', protocolLabel: 'MQTT', connectionStatus: 'offline', createdAt: '2025-11-04 16:45:00', description: '工业用电数据监测', records: [{ id: 'R008', name: '萧山工厂-1号 小时数据', deviceId: 'PWR001', location: '杭州市萧山区', accessTime: '2025-11-24 14:10:00', status: '离线' }] },
  { id: 'DS005', name: '光量子雷达-西湖', type: 'radar_station', typeLabel: '雷达站', protocol: 'http', protocolLabel: 'HTTP/HTTPS', connectionStatus: 'online', createdAt: '2025-11-05 11:20:00', description: '污染物报警点位监测', records: [{ id: 'R009', name: '西湖区域扫描数据', deviceId: 'RADAR001', location: '杭州市西湖区', accessTime: '2025-11-24 14:05:00', status: '正常' }, { id: 'R010', name: '拱墅区扫描数据', deviceId: 'RADAR001', location: '杭州市拱墅区', accessTime: '2025-11-24 13:45:00', status: '正常' }] },
  { id: 'DS006', name: '自定义采集-MS', type: 'manual_import', typeLabel: '人工采集导入', protocol: '', protocolLabel: '', connectionStatus: 'online', createdAt: '2025-11-07 09:00:00', description: 'TVOCs人工采集数据', records: generateMSData() },
  { id: 'DS007', name: '自定义采集-NOX', type: 'manual_import', typeLabel: '人工采集导入', protocol: '', protocolLabel: '', connectionStatus: 'online', createdAt: '2025-11-08 10:00:00', description: '氮氧化物人工采集数据', records: generateNOXData() },
  { id: 'DS008', name: '无人机视频采集', type: 'drone_video', typeLabel: '无人机视频', protocol: 'websocket', protocolLabel: 'WebSocket', connectionStatus: 'online', createdAt: '2025-11-07 10:30:00', description: '无人机航拍视频数据', records: [{ id: 'R012', name: '无人机视频-20251124', deviceId: 'VIDEO001', location: '杭州市拱墅区', accessTime: '2025-11-24 09:30:00', status: '已上传', lat: 30.319126, lng: 120.141503, duration: '15:32', fileSize: '2.3GB', resolution: '4K' }, { id: 'R013', name: '无人机视频-20251123', deviceId: 'VIDEO001', location: '杭州市西湖区', accessTime: '2025-11-23 14:00:00', status: '已上传', lat: 30.275550, lng: 120.152300, duration: '12:18', fileSize: '1.8GB', resolution: '4K' }] },
]

export default function DataManage() {
  const [dataSources] = useState<DataSource[]>(mockDataSources)
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
    <div className="w-full h-full bg-gradient-to-br from-[#000a1a] via-[#001a33] to-[#002a5c] p-6 overflow-y-auto">
      <div className="flex items-center gap-3 mb-6">
        <DatabaseOutlined className="text-cyan-400 text-2xl" />
        <h2 className="text-2xl font-bold text-[#03FBFD]">数据管理</h2>
      </div>

      <div className="flex gap-4 mb-4">
        <Input placeholder="搜索数据源名称、类型..." value={searchText} onChange={e => setSearchText(e.target.value)} className="max-w-xs" />
        <Select placeholder="选择接入类型" value={selectedType} onChange={setSelectedType} className="w-180px" allowClear>
          <Select.Option value="">全部数据源</Select.Option>
          {typeOptions.map(opt => <Select.Option key={opt.value} value={opt.value}>{opt.label}</Select.Option>)}
        </Select>
        <Select placeholder="选择连接状态" value={selectedStatus} onChange={setSelectedStatus} className="w-140px" allowClear>
          <Select.Option value="">全部状态</Select.Option>
          <Select.Option value="online">在线</Select.Option>
          <Select.Option value="offline">离线</Select.Option>
        </Select>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-white" style={{ borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.2)' }}>
              <th className="p-3 text-left font-semibold">数据源ID</th>
              <th className="p-3 text-left font-semibold">数据源名称</th>
              <th className="p-3 text-left font-semibold">接入类型</th>
              <th className="p-3 text-left font-semibold">接入协议</th>
              <th className="p-3 text-left font-semibold">创建时间</th>
              <th className="p-3 text-center font-semibold">连接状态</th>
              <th className="p-3 text-center font-semibold">数据量</th>
              <th className="p-3 text-center font-semibold">操作</th>
            </tr>
          </thead>
          <tbody>
            {filteredSources.map(source => (
              <tr key={source.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.1)' }}>
                <td className="p-3">{source.id}</td>
                <td className="p-3">{source.name}</td>
                <td className="p-3">{source.typeLabel}</td>
                <td className="p-3">{source.protocolLabel || '-'}</td>
                <td className="p-3">{source.createdAt}</td>
                <td className="p-3 text-center"><span className="flex items-center gap-2 justify-center">{getStatusIcon(source.connectionStatus)}<span className={source.connectionStatus === 'online' ? 'text-green-500' : 'text-red-500'}>{source.connectionStatus === 'online' ? '在线' : '离线'}</span></span></td>
                <td className="p-3 text-center"><Tag color="blue">{source.records.length} 条</Tag></td>
                <td className="p-3 text-center">
                  <Button size="small" icon={<EyeOutlined />} onClick={() => handleViewDetail(source)}>详情</Button>
                  {['air_quality_station', 'mobile_monitor_car', 'drone_video'].includes(source.type) || (source.type === 'manual_import') ? <Button size="small" className="ml-2" onClick={() => handleManualImport(source)}>导入</Button> : null}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* 数据源详情弹窗 */}
      <Modal title={<span className="text-[#03FBFD] font-bold">{selectedSource?.name} - 数据列表</span>} open={showDetailModal} onCancel={() => { setShowDetailModal(false); setSelectedSource(null) }} footer={null} width={1000}>
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

            <div className="overflow-x-auto max-h-400px overflow-y-auto">
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
      <Modal title={<span className="text-[#03FBFD] font-bold">手工导入数据</span>} open={showImportModal} onCancel={() => { setShowImportModal(false); setImportSource(null) }} footer={null} width={600}>
        {importSource && (
          <Form form={importForm} layout="vertical" onFinish={submitImport}>
            <div className="mb-4 p-3 rounded bg-cyan-500/8 border border-cyan-500/15">
              <div className="text-sm text-white/75"><span className="text-[#03FBFD]">目标数据源：</span>{importSource.name}</div>
            </div>
            <Form.Item name="monitorTime" label="监测时间" rules={[{ required: true, message: '请输入监测时间' }]}><Input placeholder="格式：2023-12-01 00:00:00" /></Form.Item>
            {importSource.type === 'air_quality_station' && (
              <div className="grid grid-cols-2 gap-4">
                <Form.Item name="pm25" label="PM2.5 (μg/m³)" rules={[{ required: true }]}><Input type="number" /></Form.Item>
                <Form.Item name="o3" label="O3 (μg/m³)" rules={[{ required: true }]}><Input type="number" /></Form.Item>
                <Form.Item name="temperature" label="温度 (℃)" rules={[{ required: true }]}><Input type="number" /></Form.Item>
                <Form.Item name="humidity" label="湿度 (%)" rules={[{ required: true }]}><Input type="number" /></Form.Item>
                <Form.Item name="windSpeed" label="风速 (m/s)" rules={[{ required: true }]}><Input type="number" /></Form.Item>
                <Form.Item name="windDirection" label="主导风向" rules={[{ required: true }]}><Select placeholder="请选择"><Select.Option value="北风">北风</Select.Option><Select.Option value="南风">南风</Select.Option><Select.Option value="东风">东风</Select.Option><Select.Option value="西风">西风</Select.Option></Select></Form.Item>
              </div>
            )}
            {importSource.type === 'mobile_monitor_car' && (
              <div className="grid grid-cols-2 gap-4">
                <Form.Item name="totalSuspendedParticulates" label="总悬浮颗粒物" rules={[{ required: true }]}><Input type="number" /></Form.Item>
                <Form.Item name="fineParticulates" label="细微颗粒物" rules={[{ required: true }]}><Input type="number" /></Form.Item>
                <Form.Item name="latitude" label="纬度" rules={[{ required: true }]}><Input type="number" /></Form.Item>
                <Form.Item name="longitude" label="经度" rules={[{ required: true }]}><Input type="number" /></Form.Item>
                <Form.Item name="roadDustLoad" label="道路尘负荷" rules={[{ required: true }]}><Input type="number" /></Form.Item>
              </div>
            )}
            {importSource.name.includes('MS') && (
              <div className="grid grid-cols-2 gap-4">
                <Form.Item name="longitude" label="经度" rules={[{ required: true }]}><Input type="number" /></Form.Item>
                <Form.Item name="latitude" label="纬度" rules={[{ required: true }]}><Input type="number" /></Form.Item>
                <Form.Item name="tvocs" label="TVOCs (ppb)" rules={[{ required: true }]}><Input type="number" /></Form.Item>
              </div>
            )}
            {importSource.name.includes('NOX') && (
              <div className="grid grid-cols-2 gap-4">
                <Form.Item name="nox" label="NOX (μg/m³)" rules={[{ required: true }]}><Input type="number" /></Form.Item>
                <Form.Item name="no2" label="NO2 (μg/m³)" rules={[{ required: true }]}><Input type="number" /></Form.Item>
                <Form.Item name="no" label="NO (μg/m³)" rules={[{ required: true }]}><Input type="number" /></Form.Item>
                <Form.Item name="longitude" label="经度" rules={[{ required: true }]}><Input type="number" /></Form.Item>
                <Form.Item name="latitude" label="纬度" rules={[{ required: true }]}><Input type="number" /></Form.Item>
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
      <Modal title={<span className="text-[#03FBFD] font-bold">数据详情</span>} open={!!selectedRecord} onCancel={() => setSelectedRecord(null)} footer={null}>
        {selectedRecord && (
          <div className="space-y-3">
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
      <Modal title={<span className="text-[#03FBFD] font-bold">转预警</span>} open={showAlertModal} onCancel={() => setShowAlertModal(false)} footer={null} width={600}>
        {selectedRecord && (
          <Form form={alertForm} layout="vertical" onFinish={submitAlert}>
            <div className="mb-4 p-3 rounded bg-cyan-500/8 border border-cyan-500/15">
              <div className="text-sm text-white/75"><span className="text-[#03FBFD]">数据名称：</span>{selectedRecord.name}</div>
              <div className="text-sm text-white/75"><span className="text-[#03FBFD]">设备ID：</span>{selectedRecord.deviceId}</div>
            </div>
            <Form.Item name="alertLevel" label="预警级别" rules={[{ required: true, message: '请选择预警级别' }]}>
              <Select placeholder="请选择预警级别">
                <Select.Option value="level1">一级预警（严重）</Select.Option>
                <Select.Option value="level2">二级预警（较重）</Select.Option>
                <Select.Option value="level3">三级预警（一般）</Select.Option>
                <Select.Option value="level4">四级预警（轻微）</Select.Option>
              </Select>
            </Form.Item>
            <Form.Item name="reason" label="预警原因" rules={[{ required: true, message: '请输入预警原因' }]}><Input.TextArea rows={3} placeholder="请输入污染情况描述" /></Form.Item>
            <Form.Item name="suggestion" label="处置建议"><Input.TextArea rows={2} placeholder="请输入处置建议（可选）" /></Form.Item>
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

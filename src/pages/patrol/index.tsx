import { useState, useEffect, useRef, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { Button, Select, Tag, message } from 'antd'
import { ArrowLeftOutlined, CarOutlined } from '@ant-design/icons'
import { Scene, HeatmapLayer, Source } from '@antv/l7'
import type { ILayer } from '@antv/l7'
import L7MapView from '@/components/L7MapView'

const { Option } = Select

interface CarItem { id: string; mnCode: string; siteName: string; belongUnit: string; status: string }
interface TaskItem { date: string; car: string; distance: string; alerts: number }

const factorOptions = [
  { value: 'a34001', label: 'PM2.5' }, { value: 'a34002', label: 'PM10' },
  { value: 'a34004', label: 'TSP' }, { value: 'a34010', label: '尘负荷' },
]

const initCars: CarItem[] = [
  { id: '1', mnCode: 'HYD1009', siteName: '浙江环境总公司', belongUnit: '浙江环境总公司', status: '在线' },
  { id: '2', mnCode: 'HYD1010', siteName: '杭州走航车', belongUnit: '杭州市生态环境局', status: '离线' },
  { id: '3', mnCode: 'HYD1011', siteName: '宁波走航车', belongUnit: '宁波市生态环境局', status: '在线' },
  { id: '4', mnCode: 'HYD1012', siteName: '温州走航车', belongUnit: '温州市生态环境局', status: '离线' },
]

const taskHistory: TaskItem[] = [
  { date: '2025-11-24', car: 'HYD1009', distance: '45.2km', alerts: 3 },
  { date: '2025-11-23', car: 'HYD1011', distance: '38.7km', alerts: 1 },
  { date: '2025-11-22', car: 'HYD1009', distance: '52.1km', alerts: 5 },
  { date: '2025-11-21', car: 'HYD1012', distance: '29.8km', alerts: 2 },
  { date: '2025-11-20', car: 'HYD1010', distance: '41.3km', alerts: 0 },
  { date: '2025-11-19', car: 'HYD1009', distance: '47.6km', alerts: 4 },
  { date: '2025-11-18', car: 'HYD1011', distance: '35.2km', alerts: 1 },
]

const colorLegend = [
  { color: '#b60c1f', range: '[150,250)' },
  { color: '#f0603a', range: '[100,150)' },
  { color: '#f7a945', range: '[75,100)' },
  { color: '#ffe14d', range: '[50,75)' },
  { color: '#8cd452', range: '[25,50)' },
  { color: '#2ba84a', range: '[0,25)' },
]

// 模拟走航热力数据
const generateHeatData = () => {
  const data: any[] = []
  const baseLng = 120.15, baseLat = 30.25
  for (let i = 0; i < 200; i++) {
    data.push({
      lng: baseLng + (Math.random() - 0.5) * 0.12,
      lat: baseLat + (Math.random() - 0.5) * 0.08,
      value: Math.random() * 200 + 10,
    })
  }
  return data
}

export default function Patrol() {
  const navigate = useNavigate()
  const [cars, setCars] = useState<CarItem[]>(initCars)
  const [curCarCode, setCurCarCode] = useState('HYD1009')
  const [wakingCar, setWakingCar] = useState<string | null>(null)
  const [wageVal, setWageVal] = useState('a34001')
  const [showHeatmap, setShowHeatmap] = useState(false)
  const sceneRef = useRef<Scene | null>(null)
  const heatLayerRef = useRef<ILayer | null>(null)

  const handleWake = (mnCode: string) => {
    setWakingCar(mnCode)
    setTimeout(() => {
      setCars(prev => prev.map(i => i.mnCode === mnCode ? { ...i, status: '在线' } : i))
      setWakingCar(null)
      message.success(`${mnCode} 已唤醒`)
    }, 1500)
  }

  const handleSelectCar = (mnCode: string) => { setCurCarCode(mnCode) }
  const showDetailToMap = (date: string) => { setShowHeatmap(true); message.info(`加载 ${date} 走航数据`) }

  const handleSceneLoaded = useCallback((scene: Scene) => {
    sceneRef.current = scene
  }, [])

  useEffect(() => {
    const scene = sceneRef.current
    if (!scene) return
    // 移除旧图层
    if (heatLayerRef.current) {
      scene.removeLayer(heatLayerRef.current)
      heatLayerRef.current.destroy()
      heatLayerRef.current = null
    }
    if (!showHeatmap) return
    // 创建热力图
    const heatData = generateHeatData()
    const source = new Source(heatData, {
      parser: { type: 'json', x: 'lng', y: 'lat' },
      transforms: [{ type: 'grid', size: 80, field: 'value', method: 'mean' }],
    })
    const layer = new HeatmapLayer({ zIndex: 9, autoFit: false })
      .source(source)
      .shape('square')
      .style({ coverage: 0.9, angle: 0 })
      .color('mean', (v: number) => {
        if (v >= 150) return '#b60c1f'
        if (v >= 100) return '#f0603a'
        if (v >= 75) return '#f7a945'
        if (v >= 50) return '#ffe14d'
        if (v >= 25) return '#8cd452'
        return '#2ba84a'
      })
    scene.addLayer(layer)
    heatLayerRef.current = layer
  }, [showHeatmap, wageVal])

  const markers = [
    { lng: 120.15, lat: 30.27, name: 'HYD1009', color: '#22C55E', size: 12 },
    { lng: 120.21, lat: 30.25, name: 'HYD1010', color: '#EF4444', size: 12 },
  ]

  return (
    <div className="w-full h-full relative overflow-hidden" style={{ background: '#1a5ab0' }}>
      <L7MapView id="patrol-map" center={[120.15, 30.25]} zoom={11} minZoom={8} maxZoom={14} showTiles markers={markers} onSceneLoaded={handleSceneLoaded} />
      {/* 返回 */}
      <div className="absolute top-15px left-20px z-50">
        <Button type="text" icon={<ArrowLeftOutlined />} onClick={() => navigate('/monitor')} className="!text-[#03FBFD] !bg-[rgba(255,255,255,0.1)] hover:!bg-[rgba(255,255,255,0.2)] !rounded-2xl">返回监控大屏</Button>
      </div>
      {/* 顶部因子选择 */}
      <div className="absolute top-45px left-1/2 -translate-x-1/2 z-50 flex gap-2 bg-[rgba(0,56,129,0.8)] px-4 py-2 rounded-xl border border-[rgba(255,255,255,0.3)] items-center">
        <span className="text-[#A0C7FF] text-12px">监测因子</span>
        <Select value={wageVal} onChange={(v) => { setWageVal(v); setShowHeatmap(false) }} className="w-110px screen-select" classNames={{ popup: { root: 'screen-select-popup' } }} size="small">
          {factorOptions.map(o => <Option key={o.value} value={o.value}>{o.label}</Option>)}
        </Select>
      </div>
      {/* 左侧 - 车辆列表 */}
      <div className="absolute left-20px top-70px bottom-20px z-50 w-320px pointer-events-none">
        <div className="bg-[rgba(0,56,129,0.85)] h-full rounded-20px border border-[rgba(255,255,255,0.3)] px-4 py-3 overflow-y-auto pointer-events-auto">
          <div className="text-[#A0C7FF] text-16px font-bold mb-3">走航车辆</div>
          {cars.map(item => (
            <div key={item.id} className={`flex items-center gap-3 py-3 px-2 rounded-lg border-b border-dashed border-[rgba(255,255,255,0.2)] cursor-pointer transition-all ${curCarCode === item.mnCode ? 'bg-[rgba(1,194,255,0.2)]' : 'hover:bg-[rgba(255,255,255,0.05)]'}`} onClick={() => handleSelectCar(item.mnCode)}>
              <CarOutlined className="text-22px text-[#A0C7FF]" />
              <div className="flex-1">
                <div className="flex items-center justify-between">
                  <span className="text-[#A8D6FF] text-13px">{item.mnCode}</span>
                  <Tag color={item.status === '在线' ? 'success' : 'default'} className="!text-11px">{item.status}</Tag>
                </div>
                <div className="text-[#78AADC] text-11px mt-0.5">{item.belongUnit}</div>
                {item.status === '离线' && (
                  <button className="text-[#01C2FF] text-11px mt-1 hover:underline" onClick={(e) => { e.stopPropagation(); handleWake(item.mnCode) }}>
                    {wakingCar === item.mnCode ? '唤醒中...' : '唤醒'}
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
      {/* 右侧 - 历史任务 */}
      <div className="absolute right-20px top-70px bottom-20px z-50 w-320px pointer-events-none">
        <div className="bg-[rgba(0,56,129,0.85)] h-full rounded-20px border border-[rgba(255,255,255,0.3)] px-3 py-2 flex flex-col">
          <div className="text-[#A0C7FF] text-16px font-bold py-2 border-b border-dashed border-[rgba(255,255,255,0.3)]">历史任务</div>
          <div className="flex-1 overflow-y-auto pointer-events-auto py-1">
            {taskHistory.map((item, idx) => (
              <div key={idx} className="py-3 border-b border-dashed border-[rgba(255,255,255,0.15)] cursor-pointer hover:bg-[rgba(255,255,255,0.05)]" onClick={() => showDetailToMap(item.date)}>
                <div className="flex items-center justify-between">
                  <span className="text-[#A8D6FF] text-13px">{item.date} 走航</span>
                  {item.alerts > 0 && <Tag color="warning" className="!text-10px">{item.alerts}处异常</Tag>}
                </div>
                <div className="flex items-center justify-between mt-1 text-11px text-[rgba(168,214,255,0.5)]">
                  <span>车辆: {item.car}</span><span>里程: {item.distance}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
      {/* 热力图图例 */}
      {showHeatmap && (
        <div className="absolute right-2px bottom-2px z-50 bg-[rgba(0,56,129,0.9)] rounded-lg px-3 py-2 text-[#A0C7FF] text-12px pointer-events-auto">
          <div className="flex flex-col gap-1 w-120px">
            {colorLegend.map((item, i) => (
              <div key={i} className="flex items-center gap-2"><div className="w-14px h-14px rounded-sm" style={{ background: item.color }} /><span>{item.range}</span></div>
            ))}
          </div>
          <span className="text-10px">(\u03bcg/m\u00b3)</span>
          <div className="flex gap-2 mt-1">
            <Button type="text" size="small" className="!text-[#A0C7FF] !text-11px" onClick={() => setShowHeatmap(false)}>关闭</Button>
          </div>
        </div>
      )}
    </div>
  )
}

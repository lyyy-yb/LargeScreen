import { useState, useEffect, useRef, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { Button, Select, Tag, Spin, message } from 'antd'
import { ArrowLeftOutlined, CarOutlined } from '@ant-design/icons'
import dayjs from 'dayjs'
import { Scene, HeatmapLayer, Source } from '@antv/l7'
import type { ILayer } from '@antv/l7'
import L7MapView from '@/components/L7MapView'
import RegionSelector from '@/components/RegionSelector'
import { useAppStore } from '@/stores'
import { cities, districts } from '@/utils/city'
import { zouhangList, taskList as zouhangTaskList, taskDetail } from '@/servers/mapBox'

const { Option } = Select

interface CarItem { id: string; mnCode: string; siteName: string; belongUnit?: string; status?: string }

const factorOptions = [
  { value: 'a34001', label: 'PM2.5' }, { value: 'a34002', label: 'PM10' },
  { value: 'a34004', label: 'TSP' }, { value: 'a34010', label: '尘负荷' },
]

// 走航车辆数据来自真实接口，不使用 mock
const colorLegend = [
  { color: '#b60c1f', range: '[150,250)' },
  { color: '#f0603a', range: '[100,150)' },
  { color: '#f7a945', range: '[75,100)' },
  { color: '#ffe14d', range: '[50,75)' },
  { color: '#8cd452', range: '[25,50)' },
  { color: '#2ba84a', range: '[0,25)' },
]

export default function Patrol() {
  const navigate = useNavigate()
  const regionContext = useAppStore(state => state.regionContext)
  const mapSelection = regionContext?.mapSelection
  const [cars, setCars] = useState<CarItem[]>([])
  const [curCarCode, setCurCarCode] = useState('')
  const [wakingCar, setWakingCar] = useState<string | null>(null)
  const [wageVal, setWageVal] = useState('a34001')
  const [showHeatmap, setShowHeatmap] = useState(false)
  // 历史任务日期列表（原项目 taskList 返回 string[]）与走航轨迹明细（taskDetail）
  const [taskDates, setTaskDates] = useState<string[]>([])
  const [detailData, setDetailData] = useState<Record<string, unknown>[]>([])
  const [carsLoading, setCarsLoading] = useState(true)
  const [tasksLoading, setTasksLoading] = useState(false)
  const [loadingDate, setLoadingDate] = useState<string | null>(null)
  const sceneRef = useRef<Scene | null>(null)
  const heatLayerRef = useRef<ILayer | null>(null)

  // 走航车辆列表（原项目 leftBars：zouhangList，默认选中第一辆车）
  useEffect(() => {
    let cancelled = false
    // 标准的列表数据拉取模式，忽略 set-state-in-effect 规则
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setCarsLoading(true)
    zouhangList()
      .then(res => {
        if (cancelled) return
        if (res?.resultCode === 0 && Array.isArray(res.data) && res.data.length) {
          setCars(res.data)
          setCurCarCode(String(res.data[0].mnCode ?? ''))
        }
        // 接口返回空或异常：保持空列表，不兜底 mock
      })
      .catch(() => {
        if (cancelled) return
        // 接口异常：保持空列表，不兜底 mock
      })
      .finally(() => { if (!cancelled) setCarsLoading(false) })
    return () => { cancelled = true }
  }, [])

  // 历史任务（原项目 rightBar：年初~今天 + mnCode 查任务日期列表，切车重查）
  useEffect(() => {
    if (!curCarCode) return
    let cancelled = false
    // 标准的列表数据拉取模式，忽略 set-state-in-effect 规则
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setTasksLoading(true)
    zouhangTaskList({
      startDate: dayjs().startOf('year').format('YYYY-MM-DD'),
      endDate: dayjs().format('YYYY-MM-DD'),
      mnCode: curCarCode,
    })
      .then(res => {
        if (!cancelled) setTaskDates(res?.resultCode === 0 && Array.isArray(res.data) ? res.data : [])
      })
      .catch(() => { if (!cancelled) setTaskDates([]) })
      .finally(() => { if (!cancelled) setTasksLoading(false) })
    return () => { cancelled = true }
  }, [curCarCode])

  const handleWake = (mnCode: string) => {
    setWakingCar(mnCode)
    setTimeout(() => {
      setCars(prev => prev.map(i => i.mnCode === mnCode ? { ...i, status: '在线' } : i))
      setWakingCar(null)
      message.success(`${mnCode} 已唤醒`)
    }, 1500)
  }

  const handleSelectCar = (mnCode: string) => { setCurCarCode(mnCode); setTaskDates([]); setShowHeatmap(false); setDetailData([]) }

  // 点击历史任务 → taskDetail 查走航轨迹明细（原项目 showDetailToMap）
  const showDetailToMap = async (taskDate: string) => {
    if (loadingDate) return
    setLoadingDate(taskDate)
    try {
      const res = await taskDetail({ taskDate, mnCode: curCarCode })
      if (res?.resultCode === 0 && Array.isArray(res.data)) {
        const data = (res.data as Record<string, unknown>[]).filter(item => item.a81002 && item.a81001)
        if (!data.length) {
          message.warning('该走航任务暂无有效轨迹数据')
          return
        }
        setDetailData(data)
        setShowHeatmap(true)
      } else {
        message.warning('该走航任务暂无有效轨迹数据')
      }
    } catch {
      message.error('走航任务明细查询失败')
    } finally {
      setLoadingDate(null)
    }
  }

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
    if (!showHeatmap || !detailData.length) return
    // 与原项目一致：a81002=经度 a81001=纬度，100m 网格按当前因子均值聚合，autoFit 自动定位到走航范围
    const source = new Source(detailData, {
      parser: { type: 'json', x: 'a81002', y: 'a81001' },
      transforms: [{ type: 'grid', size: 100, field: wageVal, method: 'mean' }],
    })
    const layer = new HeatmapLayer({ zIndex: 9, autoFit: true })
      .source(source)
      .shape('square')
      .style({ coverage: 1, angle: 0 })
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
  }, [showHeatmap, detailData, wageVal])

  const mapCounty = districts.find(item => String(item.adcode) === mapSelection?.countyCode)
  const mapCity = cities.find(item => item.adcode === mapSelection?.cityCode)
  const mapCenter: [number, number] = mapCounty
    ? [mapCounty.lng, mapCounty.lat]
    : mapCity
      ? [mapCity.lng, mapCity.lat]
      : [120.582886, 29.991549]

  return (
    <div className="w-full h-full relative overflow-hidden" style={{ background: '#1a5ab0' }}>
      <L7MapView id="patrol-map" center={mapCenter} zoom={mapCounty ? 11 : mapCity ? 9 : 7.5} minZoom={6} maxZoom={14} showTiles onSceneLoaded={handleSceneLoaded} />
      {/* 返回 */}
      <div className="absolute top-15px left-20px z-50">
        <Button type="text" icon={<ArrowLeftOutlined />} onClick={() => navigate('/monitor')} className="!text-[#03FBFD] !bg-[rgba(255,255,255,0.1)] hover:!bg-[rgba(255,255,255,0.2)] !rounded-2xl">返回监控大屏</Button>
      </div>
      {/* 顶部因子选择 */}
      <div className="absolute top-45px left-1/2 -translate-x-1/2 z-50 flex gap-2 bg-[rgba(0,56,129,0.8)] px-4 py-2 rounded-xl border border-[rgba(255,255,255,0.3)] items-center">
        <RegionSelector />
        <span className="text-[#A0C7FF] text-12px">监测因子</span>
        <Select value={wageVal} onChange={(v) => setWageVal(v)} className="w-110px screen-select" classNames={{ popup: { root: 'screen-select-popup' } }} size="small">
          {factorOptions.map(o => <Option key={o.value} value={o.value}>{o.label}</Option>)}
        </Select>
      </div>
      {/* 左侧 - 车辆列表（卡片式，与 drone 页无人机机场列表一致） */}
      <div className="absolute left-20px top-70px bottom-20px z-50 w-320px pointer-events-none">
        <div className="bg-[rgba(0,56,129,0.85)] h-full rounded-20px border border-[rgba(255,255,255,0.3)] px-4 py-3 overflow-y-auto pointer-events-auto">
          <div className="text-[#A0C7FF] text-16px font-bold mb-3">走航车辆</div>
          {carsLoading && (
            <div className="flex flex-col items-center justify-center gap-2 py-6 text-[#A8D6FF] text-12px">
              <Spin size="small" />
              <span>车辆列表加载中…</span>
            </div>
          )}
          {cars.map(item => (
            <div key={item.id ?? item.mnCode} className={`relative mb-3 rounded-xl border p-3 cursor-pointer transition-all ${curCarCode === item.mnCode ? 'border-[#01C2FF] bg-[rgba(1,194,255,0.15)]' : 'border-[rgba(255,255,255,0.2)] bg-[rgba(0,0,0,0.2)] hover:bg-[rgba(255,255,255,0.05)]'}`} onClick={() => handleSelectCar(item.mnCode)}>
              <div className="flex items-center justify-between mb-1">
                <span className="text-[#A8D6FF] text-14px font-medium flex items-center gap-1"><CarOutlined className="text-[#01C2FF]" />{item.mnCode}</span>
                {item.status && <Tag color={item.status === '在线' ? 'success' : 'default'} className="!text-11px">{item.status}</Tag>}
              </div>
              <div className="text-[rgba(168,214,255,0.6)] text-12px">{item.belongUnit || item.siteName}</div>
              {item.status === '离线' && (
                <button className="text-[#01C2FF] text-12px mt-1 hover:underline" onClick={(e) => { e.stopPropagation(); handleWake(item.mnCode) }}>
                  {wakingCar === item.mnCode ? '唤醒中...' : '唤醒'}
                </button>
              )}
            </div>
          ))}
        </div>
      </div>
      {/* 右侧 - 历史任务（卡片式，与 drone 页飞行任务列表一致） */}
      <div className="absolute right-20px top-70px bottom-20px z-50 w-320px pointer-events-none">
        <div className="bg-[rgba(0,56,129,0.85)] h-full rounded-20px border border-[rgba(255,255,255,0.3)] px-3 py-2 flex flex-col pointer-events-auto">
          <div className="text-[#A0C7FF] text-16px font-bold py-2">历史任务</div>
          <div className="flex-1 overflow-y-auto space-y-2 py-1">
            {tasksLoading && <div className="flex items-center justify-center gap-2 py-2 text-[#A8D6FF] text-11px"><Spin size="small" />加载中…</div>}
            {!tasksLoading && taskDates.length === 0 && <div className="text-[rgba(168,214,255,0.4)] text-11px py-2 text-center">暂无历史任务</div>}
            {!!curCarCode && taskDates.map(date => (
              <div key={date} className="rounded-xl p-3 cursor-pointer transition-all bg-[rgba(0,0,0,0.2)] border border-[rgba(255,255,255,0.15)] hover:bg-[rgba(255,255,255,0.06)]" onClick={() => showDetailToMap(date)}>
                <div className="text-[#A8D6FF] text-13px flex items-center gap-1.5">{date} 走航{loadingDate === date && <Spin size="small" />}</div>
                <div className="text-[rgba(168,214,255,0.5)] text-11px mt-1">车辆: {curCarCode}</div>
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

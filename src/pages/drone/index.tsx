import { useState, useEffect, useCallback, useMemo, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { Button, Tag, Modal, Image, message } from 'antd'
import { ArrowLeftOutlined, RocketOutlined, VideoCameraOutlined, EnvironmentOutlined, DashboardOutlined, SendOutlined } from '@ant-design/icons'
import dayjs from 'dayjs'
import L7MapView from '@/components/L7MapView'
import { dockList, listFlyJob, listFlyPlan, listFlyResult } from '@/servers/mapBox'
import RegionSelector from '@/components/RegionSelector'
import { useAppStore } from '@/stores'
import { toRegionQuery } from '@/utils/region'
import { cities, districts } from '@/utils/city'
import FlyListModel from '@/components/MapBox/FlyListModel'
import type { RegionSelection } from '@/types/region'
import type { Scene } from '@antv/l7'

interface DockItem { dockCode: string; dockName: string; dockAddress: string; dockLat: number; dockLng: number; status: string }
interface TaskItem { jobID: string; jobName: string; jobTime: string; jobStatus: string; dockCode: string }
interface PlanItem { planId: string; planName: string; startDate: string; flyTime: string; dockCode: string; lineName: string }
interface FlyResultItem { resultsID: string; resultsTime: string; resultsType: string; resultsUrl: string }

interface SensorData { pm25: number; pm10: number; altitude: number; battery: number; speed: number; signal: number }
interface VideoItem { id: string; name: string; duration: string; resolution: string; size: string; date: string; status: string }
interface RoutePoint { name: string; lng: number; lat: number }

const mockSensor: SensorData = { pm25: 35, pm10: 68, altitude: 120, battery: 78, speed: 8.5, signal: 92 }

const mockVideos: VideoItem[] = [
  { id: 'V001', name: '临平道路巡查_20251124', duration: '12:35', resolution: '4K (3840×2160)', size: '1.2GB', date: '2025-11-24', status: '已完成' },
  { id: 'V002', name: '良渚绿化巡查_20251124', duration: '08:20', resolution: '1080P (1920×1080)', size: '680MB', date: '2025-11-24', status: '录制中' },
  { id: 'V003', name: '西湖景区航拍_20251123', duration: '15:42', resolution: '4K (3840×2160)', size: '1.8GB', date: '2025-11-23', status: '已完成' },
  { id: 'V004', name: '余杭工地监测_20251122', duration: '06:15', resolution: '1080P (1920×1080)', size: '420MB', date: '2025-11-22', status: '已完成' },
]

const mockRoutes: Record<string, RoutePoint[]> = {
  DOCK001: [
    { name: '起飞点-塘栖机场', lng: 120.299, lat: 30.419 },
    { name: '巡查点-望梅高架', lng: 120.310, lat: 30.405 },
    { name: '巡查点-京杭大运河', lng: 120.285, lat: 30.395 },
    { name: '返航点-塘栖机场', lng: 120.299, lat: 30.419 },
  ],
  DOCK002: [
    { name: '起飞点-良渚机场', lng: 120.141, lat: 30.319 },
    { name: '巡查点-良渚文化村', lng: 120.155, lat: 30.330 },
    { name: '巡查点-西溪湿地', lng: 120.120, lat: 30.280 },
    { name: '返航点-良渚机场', lng: 120.141, lat: 30.319 },
  ],
}

const statusObj: Record<string, { message: string; color: string }> = {
  '1': { message: '等待中', color: '#ffb024' },
  '2': { message: '进行中', color: '#399293' },
  '3': { message: '成功', color: '#02f8fa' },
  '4': { message: '取消', color: '#ef6c6a' },
  '5': { message: '失败', color: '#f12a27' },
  '6': { message: '任务中断', color: '#f37472' },
}

const createSensorData = (): SensorData => ({
  pm25: 25 + Math.round(Math.random() * 30),
  pm10: 50 + Math.round(Math.random() * 40),
  altitude: 80 + Math.round(Math.random() * 80),
  battery: 60 + Math.round(Math.random() * 35),
  speed: +(5 + Math.random() * 8).toFixed(1),
  signal: 75 + Math.round(Math.random() * 20),
})

const mockTasks: TaskItem[] = [
  { jobID: 'JOB001', jobName: '临平区道路巡查任务', jobTime: '2025-11-24 09:15', jobStatus: '3', dockCode: 'DOCK001' },
  { jobID: 'JOB002', jobName: '良渚街道绿化巡查', jobTime: '2025-11-24 14:30', jobStatus: '2', dockCode: 'DOCK002' },
  { jobID: 'JOB003', jobName: '西湖景区航拍任务', jobTime: '2025-11-23 10:00', jobStatus: '5', dockCode: 'DOCK002' },
  { jobID: 'JOB004', jobName: '余杭区工地监测', jobTime: '2025-11-22 15:45', jobStatus: '3', dockCode: 'DOCK001' },
]

const mockPlans: PlanItem[] = [
  { planId: 'PLAN005', planName: '绿化养护-望梅高架', startDate: '2025-11-25', flyTime: '09:00', dockCode: 'DOCK001', lineName: '绿化养护-望梅高架' },
  { planId: 'PLAN006', planName: '河道巡查-京杭大运河', startDate: '2025-11-26', flyTime: '14:00', dockCode: 'DOCK001', lineName: '河道巡查-京杭大运河' },
  { planId: 'PLAN007', planName: '工业园区监测-萧山', startDate: '2025-11-27', flyTime: '10:30', dockCode: 'DOCK002', lineName: '工业园区监测-萧山' },
  { planId: 'PLAN008', planName: '景区巡查-西溪湿地', startDate: '2025-11-28', flyTime: '08:00', dockCode: 'DOCK002', lineName: '景区巡查-西溪湿地' },
]

const ZHEJIANG_CENTER: [number, number] = [120.582886, 29.991549]

function isValidCoordinate(lng: number, lat: number) {
  return Number.isFinite(lng) && Number.isFinite(lat) &&
    lng >= -180 && lng <= 180 && lat >= -90 && lat <= 90
}

function getRegionCamera(selection?: RegionSelection) {
  const county = districts.find(item =>
    String(item.adcode) === selection?.countyCode ||
    (!!selection?.countyName && item.name === selection.countyName),
  )
  if (county) return { center: [county.lng, county.lat] as [number, number], zoom: 11.5 }

  const city = cities.find(item =>
    item.adcode === selection?.cityCode ||
    (!!selection?.cityName && item.name === selection.cityName),
  )
  if (city) return { center: [city.lng, city.lat] as [number, number], zoom: 9 }

  return { center: ZHEJIANG_CENTER, zoom: 7.5 }
}

export default function Drone() {
  const navigate = useNavigate()
  const [docks, setDocks] = useState<DockItem[]>([])
  const [dockCode, setDockCode] = useState<string | null>(null)
  const [sensorData, setSensorData] = useState<SensorData>(mockSensor)
  const [showVideos, setShowVideos] = useState(false)
  const [showRoute, setShowRoute] = useState(false)
  const regionContext = useAppStore(state => state.regionContext)
  const querySelection = regionContext?.querySelection
  const mapSelection = regionContext?.mapSelection
  const [refreshStatus, setRefreshStatus] = useState<string | null>(null)

  // 飞行任务 / 待执飞任务（与原项目一致：按选中机场 dockCode + 年初~今天时间范围真实查询）
  const [jobs, setJobs] = useState<TaskItem[]>([])
  const [plans, setPlans] = useState<PlanItem[]>([])
  // 任务结果弹窗（原项目 ResModal：listFlyResult 查图片/视频结果）
  const [resVisible, setResVisible] = useState(false)
  const [curJobID, setCurJobID] = useState('')
  const [jobResults, setJobResults] = useState<FlyResultItem[]>([])

  // 地图中心控制（首次加载数据后飞到机场）
  const [mapCenter, setMapCenter] = useState<[number, number] | undefined>(undefined)
  const [mapZoom, setMapZoom] = useState<number | undefined>(undefined)
  const mapSceneRef = useRef<Scene | null>(null)
  const moveMapTo = useCallback((center: [number, number], zoom: number) => {
    const scene = mapSceneRef.current
    if (scene) {
      scene.setZoom(zoom)
      scene.panTo(center)
    } else {
      setMapCenter(center)
      setMapZoom(zoom)
    }
  }, [])

  // 派遣无人机巡逻（右键菜单）
  const [flyVisible, setFlyVisible] = useState(false)
  const [flyLngLat, setFlyLngLat] = useState<{ lng: number; lat: number }>({ lng: 0, lat: 0 })
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; lng: number; lat: number } | null>(null)

  // 加载无人机数据
  useEffect(() => {
    let cancelled = false
    const loadDroneData = async () => {
      if (!querySelection) return
      const params = toRegionQuery(querySelection)
      let loadedDocks: DockItem[] = []
      try {
        const res = await dockList(params)
        if (res?.resultCode === 0 && Array.isArray(res.data)) {
          loadedDocks = (res.data as DockItem[]).map((item) => ({
            ...item,
            dockLng: Number(item.dockLng),
            dockLat: Number(item.dockLat),
            status: ((item as { status?: string }).status) || '未知',
          }))
        }
      } catch (e) {
        console.warn('无人机机场列表加载失败', e)
      }

      if (cancelled) return
      setDocks(loadedDocks)
      setDockCode(null)
      const firstDock = loadedDocks.find(item => isValidCoordinate(item.dockLng, item.dockLat))
      if (firstDock) {
        moveMapTo([firstDock.dockLng, firstDock.dockLat], 13)
      } else {
        const regionCamera = getRegionCamera(querySelection)
        moveMapTo(regionCamera.center, regionCamera.zoom)
      }
    }
    void loadDroneData()
    return () => { cancelled = true }
  }, [moveMapTo, querySelection])

  // 选中机场变化 → 查询该机场飞行任务/待执飞计划（默认年初至今天，与原项目 rightBar 一致；接口不可用时降级 mock）
  useEffect(() => {
    if (!dockCode) return
    let cancelled = false
    const param = { dockCode, startDate: dayjs().startOf('year').format('YYYY-MM-DD'), endDate: dayjs().format('YYYY-MM-DD') }
    listFlyJob(param)
      .then(res => {
        if (cancelled) return
        setJobs(res?.resultCode === 0 && Array.isArray(res.data) ? res.data : mockTasks.filter(i => i.dockCode === dockCode))
      })
      .catch(() => { if (!cancelled) setJobs(mockTasks.filter(i => i.dockCode === dockCode)) })
    listFlyPlan(param)
      .then(res => {
        if (cancelled) return
        setPlans(res?.resultCode === 0 && Array.isArray(res.data) ? res.data : mockPlans.filter(i => i.dockCode === dockCode))
      })
      .catch(() => { if (!cancelled) setPlans(mockPlans.filter(i => i.dockCode === dockCode)) })
    return () => { cancelled = true }
  }, [dockCode])

  // 点击飞行任务 → 查询任务结果（listFlyResult）并在弹窗呈现图片/视频
  const showJobResult = (jobID: string) => {
    setCurJobID(jobID)
    setResVisible(true)
  }
  useEffect(() => {
    if (!curJobID) return
    let cancelled = false
    listFlyResult({ jobID: curJobID })
      .then(res => {
        if (!cancelled) setJobResults(res?.resultCode === 0 && Array.isArray(res.data) ? res.data : [])
      })
      .catch(() => { if (!cancelled) setJobResults([]) })
    return () => { cancelled = true }
  }, [curJobID])

  // 模拟传感器实时数据
  useEffect(() => {
    if (!dockCode) return
    const timer = setInterval(() => {
      setSensorData(prev => ({
        pm25: Math.max(5, prev.pm25 + Math.round((Math.random() - 0.5) * 6)),
        pm10: Math.max(10, prev.pm10 + Math.round((Math.random() - 0.5) * 8)),
        altitude: Math.max(50, Math.min(200, prev.altitude + Math.round((Math.random() - 0.5) * 10))),
        battery: Math.max(10, prev.battery - (Math.random() > 0.7 ? 1 : 0)),
        speed: Math.max(0, +(prev.speed + (Math.random() - 0.5) * 2).toFixed(1)),
        signal: Math.max(60, Math.min(100, prev.signal + Math.round((Math.random() - 0.5) * 4))),
      }))
    }, 3000)
    return () => clearInterval(timer)
  }, [dockCode])

  const handleRefresh = (code: string) => {
    setRefreshStatus(code)
    setTimeout(() => {
      setDocks(prev => prev.map(i => i.dockCode === code ? { ...i, status: Math.random() > 0.5 ? '在线' : '离线' } : i))
      setRefreshStatus(null)
    }, 1000)
  }
  const flyTo = (item: DockItem) => {
    if (dockCode !== item.dockCode) {
      setJobs([])
      setPlans([])
    }
    setDockCode(item.dockCode)
    setSensorData(createSensorData())
    if (isValidCoordinate(item.dockLng, item.dockLat)) {
      moveMapTo([item.dockLng, item.dockLat], 13)
    }
    message.info(`定位到: ${item.dockName}`)
  }

  const markers = useMemo(
    () => docks
      .filter(item => isValidCoordinate(item.dockLng, item.dockLat))
      .map(d => ({ lng: d.dockLng, lat: d.dockLat, name: d.dockName, color: d.status === '在线' ? '#22C55E' : '#EF4444', size: 14 })),
    [docks],
  )
  const regionCamera = getRegionCamera(mapSelection ?? querySelection)

  // 地图右键 → 显示上下文菜单（无人机派遣入口）
  const handleSceneLoaded = useCallback((scene: Scene) => {
    mapSceneRef.current = scene
    // 阻止地图默认右键菜单
    scene.on('contextmenu', (ev: any) => {
      ev.originalEvent?.preventDefault()
      // 阻止事件冒泡到 window 的 contextmenu 监听，避免菜单刚打开就被关闭
      ev.originalEvent?.stopPropagation()
      if (ev.lngLat) {
        // 大屏存在 transform 缩放，需将视口坐标换算为地图容器内未缩放的设计坐标，否则菜单位置会按缩放倍数偏移
        const container = scene.getContainer()
        const oe = ev.originalEvent
        let x = ev.x
        let y = ev.y
        if (container && oe) {
          const rect = container.getBoundingClientRect()
          const sx = rect.width / container.offsetWidth || 1
          const sy = rect.height / container.offsetHeight || 1
          x = (oe.clientX - rect.left) / sx
          y = (oe.clientY - rect.top) / sy
        }
        const [w, h] = scene.getSize()
        x = Math.max(0, Math.min(x, w - 160))
        y = Math.max(0, Math.min(y, h - 46))
        setContextMenu({ x, y, lng: ev.lngLat.lng, lat: ev.lngLat.lat })
      }
    })
  }, [])

  // 点击其他区域 / 再次右键关闭右键菜单
  useEffect(() => {
    const close = () => setContextMenu(null)
    window.addEventListener('click', close)
    window.addEventListener('contextmenu', close)
    return () => { window.removeEventListener('click', close); window.removeEventListener('contextmenu', close) }
  }, [])

  return (
    <div className="w-full h-full relative overflow-hidden" style={{ background: '#1a5ab0' }}>
      <L7MapView id="drone-map" center={mapCenter ?? regionCamera.center} zoom={mapZoom ?? regionCamera.zoom} minZoom={6} maxZoom={14} showTiles markers={markers} markerIconUrl="/marker/drone-on.png" onSceneLoaded={handleSceneLoaded} />
      {/* 返回 */}
      <div className="absolute top-15px left-20px z-50">
        <Button type="text" icon={<ArrowLeftOutlined />} onClick={() => navigate('/monitor')} className="!text-[#03FBFD] !bg-[rgba(255,255,255,0.1)] hover:!bg-[rgba(255,255,255,0.2)] !rounded-2xl">返回监控大屏</Button>
      </div>
      {/* 顶部选择器 */}
      <div className="absolute top-45px left-1/2 -translate-x-1/2 z-50 flex gap-2 bg-[rgba(0,56,129,0.8)] px-4 py-2 rounded-xl border border-[rgba(255,255,255,0.3)]">
        <RegionSelector />
      </div>
      {/* 左侧 - 机场列表 */}
      <div className="absolute left-20px top-70px bottom-20px z-50 w-340px pointer-events-none">
        <div className="bg-[rgba(0,56,129,0.85)] h-full rounded-20px border border-[rgba(255,255,255,0.3)] px-4 py-3 overflow-y-auto pointer-events-auto">
          <div className="text-[#A0C7FF] text-16px font-bold mb-3">无人机机场</div>
          {docks.map(item => (
            <div key={item.dockCode} className={`relative mb-3 rounded-xl border p-3 cursor-pointer transition-all ${dockCode === item.dockCode ? 'border-[#01C2FF] bg-[rgba(1,194,255,0.15)]' : 'border-[rgba(255,255,255,0.2)] bg-[rgba(0,0,0,0.2)] hover:bg-[rgba(255,255,255,0.05)]'}`} onClick={() => flyTo(item)}>
              <div className="flex items-center justify-between mb-1">
                <span className="text-[#A8D6FF] text-14px font-medium flex items-center gap-1"><RocketOutlined className="text-[#01C2FF]" />{item.dockName}</span>
                <Tag color={item.status === '在线' ? 'success' : item.status === '离线' ? 'error' : 'default'}>{item.status}</Tag>
              </div>
              <div className="text-[rgba(168,214,255,0.6)] text-12px">{item.dockAddress}</div>
              {item.status === '未知' && (
                <button className="text-[#01C2FF] text-12px mt-1 hover:underline" onClick={(e) => { e.stopPropagation(); handleRefresh(item.dockCode) }}>
                  {refreshStatus === item.dockCode ? '刷新中...' : '刷新状态'}
                </button>
              )}
            </div>
          ))}
        </div>
      </div>
      {/* 底部中间 - 传感器数据面板 */}
      {dockCode && (
        <div className="absolute bottom-20px left-1/2 -translate-x-1/2 z-50 w-680px">
          <div className="bg-[rgba(0,56,129,0.9)] rounded-20px border border-[rgba(255,255,255,0.3)] px-5 py-3">
            <div className="flex items-center justify-between mb-2">
              <span className="text-[#A0C7FF] text-14px font-bold flex items-center gap-1"><DashboardOutlined className="text-[#01C2FF]" />无人机传感器数据</span>
              <span className="text-[rgba(168,214,255,0.5)] text-11px">实时更新中</span>
            </div>
            <div className="grid grid-cols-6 gap-3">
              {[
                { label: 'PM2.5', value: sensorData.pm25, unit: 'μg/m³', color: sensorData.pm25 > 75 ? '#FF4D4F' : sensorData.pm25 > 35 ? '#FAAD14' : '#52C41A' },
                { label: 'PM10', value: sensorData.pm10, unit: 'μg/m³', color: sensorData.pm10 > 150 ? '#FF4D4F' : sensorData.pm10 > 75 ? '#FAAD14' : '#52C41A' },
                { label: '高度', value: sensorData.altitude, unit: 'm', color: '#01C2FF' },
                { label: '电量', value: sensorData.battery, unit: '%', color: sensorData.battery < 20 ? '#FF4D4F' : sensorData.battery < 50 ? '#FAAD14' : '#52C41A' },
                { label: '速度', value: sensorData.speed, unit: 'm/s', color: '#01C2FF' },
                { label: '信号', value: sensorData.signal, unit: '%', color: sensorData.signal < 70 ? '#FAAD14' : '#52C41A' },
              ].map(item => (
                <div key={item.label} className="text-center">
                  <div className="text-18px font-bold" style={{ color: item.color }}>{item.value}</div>
                  <div className="text-[rgba(168,214,255,0.5)] text-10px">{item.unit}</div>
                  <div className="text-[#A8D6FF] text-11px mt-0.5">{item.label}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
      {/* 右侧 - 飞行任务 + 待执飞 */}
      <div className="absolute right-20px top-70px bottom-20px z-50 w-340px flex flex-col gap-3 pointer-events-none">
        <div className="bg-[rgba(0,56,129,0.85)] flex-1 rounded-20px px-3 py-2 flex flex-col overflow-hidden pointer-events-auto">
          <div className="text-[#A0C7FF] text-16px font-bold py-2">飞行任务</div>
          <div className="flex-1 overflow-y-auto space-y-2 py-1">
            {!dockCode && <div className="text-[rgba(168,214,255,0.4)] text-11px py-2 text-center">请先在左侧选择无人机机场</div>}
            {dockCode && jobs.length === 0 && <div className="text-[rgba(168,214,255,0.4)] text-11px py-2 text-center">暂无飞行任务</div>}
            {dockCode && jobs.map(item => (
              <div key={item.jobID} className="rounded-xl p-3 cursor-pointer transition-all bg-[rgba(0,0,0,0.2)] border border-[rgba(255,255,255,0.15)] hover:bg-[rgba(255,255,255,0.06)]" onClick={() => showJobResult(item.jobID)}>
                <div className="flex items-center justify-between mb-1">
                  <div className="text-[#A8D6FF] text-13px">{item.jobName}</div>
                  <span className="px-2 py-0.5 rounded text-12px text-white" style={{ backgroundColor: statusObj[item.jobStatus]?.color }}>{statusObj[item.jobStatus]?.message}</span>
                </div>
                <div className="text-[rgba(168,214,255,0.5)] text-11px">{item.jobTime}</div>
              </div>
            ))}
          </div>
        </div>
        <div className="bg-[rgba(0,56,129,0.85)] flex-1 rounded-20px px-3 py-2 flex flex-col overflow-hidden pointer-events-auto">
          <div className="text-[#A0C7FF] text-16px font-bold py-2">待执飞任务</div>
          <div className="flex-1 overflow-y-auto space-y-2 py-1">
            {!dockCode && <div className="text-[rgba(168,214,255,0.4)] text-11px py-2 text-center">请先在左侧选择无人机机场</div>}
            {dockCode && plans.length === 0 && <div className="text-[rgba(168,214,255,0.4)] text-11px py-2 text-center">暂无待执飞任务</div>}
            {dockCode && plans.map(item => (
              <div key={item.planId} className="rounded-xl p-3 transition-all bg-[rgba(0,0,0,0.2)] border border-[rgba(255,255,255,0.15)] hover:bg-[rgba(255,255,255,0.06)]">
                <div className="flex items-center justify-between mb-1">
                  <div className="text-[#A8D6FF] text-13px">{item.lineName}</div>
                  <div className="text-[#01C2FF] text-12px cursor-pointer hover:underline" onClick={() => message.info(`查看计划: ${item.planName}`)}>详情</div>
                </div>
                <div className="flex items-center justify-between">
                  <div className="text-[rgba(168,214,255,0.5)] text-11px">{item.dockCode} | {item.flyTime}</div>
                  <div className="text-[rgba(168,214,255,0.5)] text-11px">{item.startDate}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
      {/* 右侧底部 - 视频采集 + 飞行路线 */}
      <div className="absolute right-20px bottom-20px z-50 w-340px flex gap-2 pointer-events-none">
        <div className="flex-1 pointer-events-auto">
          <div className="bg-[rgba(0,56,129,0.85)] rounded-16px border border-[rgba(255,255,255,0.3)] px-3 py-2">
            <div className="flex items-center justify-between mb-1">
              <span className="text-[#A0C7FF] text-13px font-bold flex items-center gap-1"><VideoCameraOutlined className="text-[#01C2FF]" />视频采集</span>
              <button className="text-[#01C2FF] text-11px hover:underline" onClick={() => setShowVideos(!showVideos)}>{showVideos ? '收起' : '展开'}</button>
            </div>
            {showVideos && (
              <div className="max-h-200px overflow-y-auto">
                {mockVideos.map(v => (
                  <div key={v.id} className="flex items-center justify-between py-2 border-b border-dashed border-[rgba(255,255,255,0.1)]">
                    <div className="min-w-0 flex-1">
                      <div className="text-[#A8D6FF] text-11px truncate">{v.name}</div>
                      <div className="text-[rgba(168,214,255,0.4)] text-10px">{v.resolution} | {v.duration} | {v.size}</div>
                    </div>
                    <Tag color={v.status === '录制中' ? 'processing' : 'default'} className="!text-10px !m-0">{v.status}</Tag>
                  </div>
                ))}
              </div>
            )}
            {!showVideos && <div className="text-[rgba(168,214,255,0.4)] text-11px py-1">{mockVideos.length} 个视频文件</div>}
          </div>
        </div>
        <div className="flex-1 pointer-events-auto">
          <div className="bg-[rgba(0,56,129,0.85)] rounded-16px border border-[rgba(255,255,255,0.3)] px-3 py-2">
            <div className="flex items-center justify-between mb-1">
              <span className="text-[#A0C7FF] text-13px font-bold flex items-center gap-1"><EnvironmentOutlined className="text-[#01C2FF]" />飞行路线</span>
              <button className="text-[#01C2FF] text-11px hover:underline" onClick={() => setShowRoute(!showRoute)}>{showRoute ? '收起' : '展开'}</button>
            </div>
            {showRoute && dockCode && mockRoutes[dockCode] ? (
              <div className="space-y-1">
                {mockRoutes[dockCode].map((pt, i) => (
                  <div key={i} className="flex items-center gap-2 py-1">
                    <div className="w-5 h-5 rounded-full flex items-center justify-center text-10px text-white shrink-0" style={{ backgroundColor: i === 0 ? '#52C41A' : i === mockRoutes[dockCode!].length - 1 ? '#FF4D4F' : '#01C2FF' }}>{i + 1}</div>
                    <span className="text-[#A8D6FF] text-11px">{pt.name}</span>
                    <span className="text-[rgba(168,214,255,0.3)] text-10px ml-auto">{pt.lng.toFixed(3)},{pt.lat.toFixed(3)}</span>
                  </div>
                ))}
              </div>
            ) : showRoute && (
              <div className="text-[rgba(168,214,255,0.4)] text-11px py-1">请先选择机场查看路线</div>
            )}
            {!showRoute && <div className="text-[rgba(168,214,255,0.4)] text-11px py-1">{dockCode ? '已规划 ' + (mockRoutes[dockCode]?.length || 0) + ' 个航点' : '未选择机场'}</div>}
          </div>
        </div>
      </div>
      {/* 右键上下文菜单 - 无人机派遣 */}
      {contextMenu && (
        <div
          className="absolute z-[9999] min-w-150px rounded-lg shadow-xl overflow-hidden"
          style={{ left: contextMenu.x, top: contextMenu.y, background: 'rgba(4,22,52,0.95)', border: '1px solid rgba(0,180,255,0.35)', backdropFilter: 'blur(8px)' }}
          onClick={(e) => e.stopPropagation()}
        >
          <div
            className="flex items-center gap-2 px-4 py-2.5 cursor-pointer text-[#A8D6FF] text-13px hover:bg-[rgba(1,194,255,0.15)] transition-colors"
            onClick={() => {
              setFlyLngLat({ lng: contextMenu.lng, lat: contextMenu.lat })
              setContextMenu(null)
              setFlyVisible(true)
            }}
          >
            <SendOutlined className="text-[#01C2FF]" />
            <span>无人机派遣</span>
          </div>
        </div>
      )}
      {/* 派遣无人机巡逻弹窗（右键菜单触发） */}
      {flyVisible && (
        <FlyListModel
          visible={flyVisible}
          setVisible={setFlyVisible}
          curCity={mapSelection?.cityCode || ''}
          curDistrict={mapSelection?.countyCode || ''}
          lngLat={flyLngLat}
        />
      )}
      {/* 飞行任务结果弹窗（原项目 ResModal：listFlyResult 图片/视频结果） */}
      <Modal open={resVisible} onCancel={() => setResVisible(false)} footer={null} width={620} title={<span className="text-[#A8D6FF]">任务结果</span>}>
        <div className="max-h-68vh overflow-y-auto px-2 py-1">
          {jobResults.length === 0 && <div className="py-8 text-center text-[rgba(0,0,0,0.45)]">暂无任务结果数据</div>}
          {jobResults.map(item => (
            <div key={item.resultsID} className="flex items-center justify-between py-2 border-b border-dashed border-[rgba(0,0,0,0.08)]">
              {item.resultsType === 'p'
                ? <Image src={item.resultsUrl} width={260} />
                : <video src={item.resultsUrl} className="w-260px h-160px" controls />}
              <div className="text-12px text-[rgba(0,0,0,0.6)]">{item.resultsTime}</div>
            </div>
          ))}
        </div>
      </Modal>
    </div>
  )
}

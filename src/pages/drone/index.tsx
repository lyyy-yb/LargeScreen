import { useState, useEffect, useCallback, useMemo, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { Button, Image, Spin, message } from 'antd'
import { ArrowLeftOutlined, RocketOutlined, VideoCameraOutlined, EnvironmentOutlined, DashboardOutlined, SendOutlined, PlayCircleOutlined } from '@ant-design/icons'
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
import { normalizeDock, getDockModeColor, type NormalizedDock } from '@/utils/dock'

interface TaskItem { jobID: string; jobName: string; jobTime: string; jobStatus: string; dockCode: string }
interface PlanItem { planId: string; planName: string; startDate: string; flyTime: string; dockCode: string; lineName: string }
interface FlyResultItem { resultsID: string; resultsTime: string; resultsType: string; resultsUrl: string }

interface SensorData { pm25: number; pm10: number; altitude: number; battery: number; speed: number; signal: number }

const statusObj: Record<string, { message: string; color: string }> = {
  '1': { message: '等待中', color: '#ffb024' },
  '2': { message: '进行中', color: '#399293' },
  '3': { message: '成功', color: '#02f8fa' },
  '4': { message: '取消', color: '#ef6c6a' },
  '5': { message: '失败', color: '#f12a27' },
  '6': { message: '任务中断', color: '#f37472' },
}

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
  const [docks, setDocks] = useState<NormalizedDock[]>([])
  const [dockCode, setDockCode] = useState<string | null>(null)
  const [sensorData, setSensorData] = useState<SensorData | null>(null)
  const regionContext = useAppStore(state => state.regionContext)
  const querySelection = regionContext?.querySelection
  const mapSelection = regionContext?.mapSelection
  const [refreshStatus, setRefreshStatus] = useState<string | null>(null)

  // 飞行任务 / 待执飞任务（与原项目一致：按选中机场 dockCode + 年初~今天时间范围真实查询）
  const [jobs, setJobs] = useState<TaskItem[]>([])
  const [plans, setPlans] = useState<PlanItem[]>([])
  const [docksLoading, setDocksLoading] = useState(true)
  const [jobsLoading, setJobsLoading] = useState(false)
  const [plansLoading, setPlansLoading] = useState(false)
  // 当前选中的飞行任务，用于在视频采集面板展示 listFlyResult 图片/视频结果
  const [curJobID, setCurJobID] = useState('')
  const [jobResults, setJobResults] = useState<FlyResultItem[]>([])
  const [resultsLoading, setResultsLoading] = useState(false)

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
      let loadedDocks: NormalizedDock[] = []
      setDocksLoading(true)
      try {
        const res = await dockList(params)
        if (res?.resultCode === 0 && Array.isArray(res.data) && res.data.length > 0) {
          loadedDocks = (res.data as Record<string, unknown>[]).map(item => normalizeDock(item))
        }
        // 接口正常返回空数组（data=[] 或 resultCode 非 0）：保持空列表，
        // 由 UI 展示"暂无无人机机场"。不允许用 mock 假数据兜底。
      } catch (e) {
        console.warn('无人机机场列表加载失败', e)
        // 接口异常/失败：保持空列表，不兜底 mock
      }

      if (cancelled) return
      setDocksLoading(false)
      setDocks(loadedDocks)
      const firstDock = loadedDocks.find(item => isValidCoordinate(item.dockLng, item.dockLat))
      // 与原项目一致：默认选中第一台机场，右侧飞行任务/待执飞列表随之加载
      setDockCode(loadedDocks[0]?.dockCode ?? null)
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

  // 选中机场变化 → 查询该机场飞行任务/待执飞计划（默认年初至今天，与原项目 rightBar 一致）
  useEffect(() => {
    if (!dockCode) return
    let cancelled = false
    const param = { dockCode, startDate: dayjs().startOf('year').format('YYYY-MM-DD'), endDate: dayjs().format('YYYY-MM-DD') }
    // 标准的列表数据拉取模式，忽略 set-state-in-effect 规则
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setJobsLoading(true)
    setPlansLoading(true)
    listFlyJob(param)
      .then(res => {
        if (cancelled) return
        setJobs(res?.resultCode === 0 && Array.isArray(res.data) ? res.data : [])
      })
      .catch(() => { if (!cancelled) setJobs([]) })
      .finally(() => { if (!cancelled) setJobsLoading(false) })
    listFlyPlan(param)
      .then(res => {
        if (cancelled) return
        setPlans(res?.resultCode === 0 && Array.isArray(res.data) ? res.data : [])
      })
      .catch(() => { if (!cancelled) setPlans([]) })
      .finally(() => { if (!cancelled) setPlansLoading(false) })
    return () => { cancelled = true }
  }, [dockCode])

  // 点击飞行任务 → 选中该任务，视频采集面板自动加载其 listFlyResult 图片/视频
  const selectJob = (jobID: string) => {
    setCurJobID(jobID)
  }
  const openExternalUrl = (url: string) => {
    if (!url) return
    window.open(url, '_blank', 'noopener,noreferrer')
  }
  useEffect(() => {
    if (!curJobID) return
    let cancelled = false
    // 标准的列表数据拉取模式，忽略 set-state-in-effect 规则
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setResultsLoading(true)
    listFlyResult({ jobID: curJobID })
      .then(res => {
        if (!cancelled) setJobResults(res?.resultCode === 0 && Array.isArray(res.data) ? res.data : [])
      })
      .catch(() => { if (!cancelled) setJobResults([]) })
      .finally(() => { if (!cancelled) setResultsLoading(false) })
    return () => { cancelled = true }
  }, [curJobID])

  // 传感器数据来自真实接口（无对应接口前保持空），不使用任何模拟数据

  // 机场切换/首次加载后，自动选中最新一条飞行任务，让视频采集面板直接有数据
  useEffect(() => {
    if (jobs.length > 0 && !curJobID) {
      setCurJobID(jobs[0].jobID)
    }
  }, [jobs, curJobID])

  const handleRefresh = (code: string) => {
    setRefreshStatus(code)
    setTimeout(() => {
      setDocks(prev => prev.map(i => i.dockCode === code ? normalizeDock({ ...i, status: Math.random() > 0.5 }) : i))
      setRefreshStatus(null)
    }, 1000)
  }
  const flyTo = (item: NormalizedDock) => {
    if (dockCode !== item.dockCode) {
      setJobs([])
      setPlans([])
    }
    setDockCode(item.dockCode)
    if (isValidCoordinate(item.dockLng, item.dockLat)) {
      moveMapTo([item.dockLng, item.dockLat], 13)
    }
    message.info(`定位到: ${item.dockName}`)
  }

  const markers = useMemo(
    () => docks
      .filter(item => isValidCoordinate(item.dockLng, item.dockLat))
      .map(d => ({ lng: d.dockLng, lat: d.dockLat, name: d.dockName, color: d.online ? '#22C55E' : '#EF4444', size: 14 })),
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
          {docksLoading && (
            <div className="flex flex-col items-center justify-center gap-2 py-8 text-[#A8D6FF] text-12px">
              <Spin size="small" />
              <span>机场列表加载中…</span>
            </div>
          )}
          {!docksLoading && !docks.length && (
            <div className="text-[rgba(168,214,255,0.4)] text-11px py-2 text-center">暂无无人机机场</div>
          )}
          {docks.map(item => (
            <div
              key={item.dockCode}
              className={`relative mb-3 rounded-xl border p-3 cursor-pointer transition-all ${
                dockCode === item.dockCode
                  ? 'border-[#01C2FF] bg-[rgba(1,194,255,0.15)] shadow-[0_0_12px_rgba(1,194,255,0.2)]'
                  : 'border-[rgba(255,255,255,0.2)] bg-[rgba(0,0,0,0.2)] hover:bg-[rgba(255,255,255,0.05)]'
              }`}
              onClick={() => flyTo(item)}
            >
              {/* 最右上角 status 状态标签（进一步向上、向右对齐） */}
              <div className="absolute top-1.5 right-2 z-10">
                <span
                  className="text-11px font-medium px-2 py-0.5 rounded-full inline-flex items-center gap-1 border"
                  style={
                    item.online
                      ? {
                          color: '#00ff88',
                          backgroundColor: 'rgba(0, 255, 136, 0.15)',
                          borderColor: 'rgba(0, 255, 136, 0.4)',
                        }
                      : {
                          color: '#94a3b8',
                          backgroundColor: 'rgba(148, 163, 184, 0.15)',
                          borderColor: 'rgba(148, 163, 184, 0.3)',
                        }
                  }
                >
                  <span className={`w-1.5 h-1.5 rounded-full ${item.online ? 'bg-[#00ff88] shadow-[0_0_6px_#00ff88]' : 'bg-[#94a3b8]'}`} />
                  {item.statusText}
                </span>
              </div>

              {/* 名称 (第一行) */}
              <div className="mb-2 pr-18">
                <span className="text-[#A8D6FF] text-16px font-bold flex items-center gap-1.5 min-w-0 truncate">
                  <RocketOutlined className="text-[#01C2FF] shrink-0" />
                  <span className="truncate" title={item.dockName}>{item.dockName}</span>
                </span>
              </div>

              {/* 地址与 modeCode 同行 (modeCode 占右侧一列，与右上角 status 对齐) */}
              <div className="flex items-start justify-between gap-2">
                <div className="flex-1 text-[rgba(168,214,255,0.6)] text-12px line-clamp-2 min-h-[2.6em] leading-relaxed">
                  {item.dockAddress}
                </div>
                <div className="shrink-0 pt-0.5">
                  <span
                    className="text-11px font-medium px-2 py-0.5 rounded border inline-block text-center"
                    style={{
                      color: getDockModeColor(item.modeCode),
                      borderColor: `${getDockModeColor(item.modeCode)}55`,
                      backgroundColor: `${getDockModeColor(item.modeCode)}20`,
                    }}
                  >
                    {item.modeLabel}
                  </span>
                </div>
              </div>
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
              <span className="text-[rgba(168,214,255,0.5)] text-11px">{sensorData ? '实时更新中' : '暂无数据'}</span>
            </div>
            {sensorData ? (
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
            ) : (
              <div className="text-[rgba(168,214,255,0.4)] text-12px py-4 text-center">暂无传感器数据</div>
            )}
          </div>
        </div>
      )}
      {/* 右侧 - 飞行任务 + 待执飞 */}
      <div className="absolute right-20px top-70px bottom-20px z-50 w-380px flex flex-col gap-3 pointer-events-none">
        <div className="bg-[rgba(0,56,129,0.85)] flex-1 rounded-20px px-3 py-2 flex flex-col overflow-hidden pointer-events-auto">
          <div className="text-[#A0C7FF] text-16px font-bold py-2">飞行任务</div>
          <div className="flex-1 overflow-y-auto space-y-2 py-1">
            {!dockCode && <div className="text-[rgba(168,214,255,0.4)] text-11px py-2 text-center">请先在左侧选择无人机机场</div>}
            {dockCode && jobsLoading && <div className="flex items-center justify-center gap-2 py-2 text-[#A8D6FF] text-11px"><Spin size="small" />加载中…</div>}
            {dockCode && !jobsLoading && jobs.length === 0 && <div className="text-[rgba(168,214,255,0.4)] text-11px py-2 text-center">暂无飞行任务</div>}
            {dockCode && jobs.map(item => (
              <div
                key={item.jobID}
                className={`rounded-xl p-3 cursor-pointer transition-all border ${
                  curJobID === item.jobID
                    ? 'bg-[rgba(1,194,255,0.18)] border-[#01C2FF] shadow-[0_0_10px_rgba(1,194,255,0.18)]'
                    : 'bg-[rgba(0,0,0,0.2)] border-[rgba(255,255,255,0.15)] hover:bg-[rgba(255,255,255,0.06)]'
                }`}
                onClick={() => selectJob(item.jobID)}
              >
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
            {dockCode && plansLoading && <div className="flex items-center justify-center gap-2 py-2 text-[#A8D6FF] text-11px"><Spin size="small" />加载中…</div>}
            {dockCode && !plansLoading && plans.length === 0 && <div className="text-[rgba(168,214,255,0.4)] text-11px py-2 text-center">暂无待执飞任务</div>}
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
      <div className="absolute right-20px bottom-20px z-50 w-380px flex gap-3 pointer-events-none">
        {/* 视频采集：对接 listFlyResult，点击跳转外链 */}
        <div className="flex-1 pointer-events-auto min-w-0">
          <div className="bg-[rgba(0,56,129,0.85)] rounded-16px border border-[rgba(255,255,255,0.3)] px-3 py-2 h-full flex flex-col">
            <div className="flex items-center justify-between mb-2 shrink-0">
              <span className="text-[#A0C7FF] text-13px font-bold flex items-center gap-1.5">
                <VideoCameraOutlined className="text-[#01C2FF]" />视频采集
              </span>
              <span className="text-[#01C2FF] text-11px px-1.5 py-0.5 rounded-full bg-[rgba(1,194,255,0.12)] border border-[rgba(1,194,255,0.25)]">
                {jobResults.length}
              </span>
            </div>
            <div className="flex-1 overflow-y-auto max-h-210px min-h-80px space-y-2 pr-1">
              {!dockCode && (
                <div className="text-[rgba(168,214,255,0.5)] text-11px py-4 text-center">请先在左侧选择机场</div>
              )}
              {dockCode && resultsLoading && (
                <div className="flex flex-col items-center justify-center gap-2 py-4 text-[#A8D6FF] text-11px">
                  <Spin size="small" /><span>加载任务结果…</span>
                </div>
              )}
              {dockCode && !resultsLoading && !curJobID && (
                <div className="text-[rgba(168,214,255,0.5)] text-11px py-4 text-center">点击上方飞行任务查看采集结果</div>
              )}
              {dockCode && !resultsLoading && curJobID && jobResults.length === 0 && (
                <div className="text-[rgba(168,214,255,0.5)] text-11px py-4 text-center">该任务暂无视频/图片</div>
              )}
              {dockCode && !resultsLoading && jobResults.map(item => (
                <div
                  key={item.resultsID}
                  className="group rounded-lg overflow-hidden border border-[rgba(255,255,255,0.12)] bg-[rgba(0,0,0,0.25)] hover:border-[#01C2FF] hover:shadow-[0_0_8px_rgba(1,194,255,0.15)] transition-all cursor-pointer"
                  onClick={() => openExternalUrl(item.resultsUrl)}
                  title={item.resultsType === 'v' ? '点击播放视频' : '点击查看图片'}
                >
                  <div className="relative w-full h-86px overflow-hidden bg-[rgba(0,0,0,0.35)]">
                    {item.resultsType === 'p' ? (
                      <Image src={item.resultsUrl} preview={false} className="w-full h-full object-cover" fallback="" />
                    ) : (
                      <>
                        <video src={item.resultsUrl} className="w-full h-full object-cover" preload="metadata" />
                        <div className="absolute inset-0 flex items-center justify-center bg-[rgba(0,0,0,0.25)] group-hover:bg-[rgba(0,0,0,0.15)] transition-all">
                          <PlayCircleOutlined className="text-28px text-white/90 drop-shadow-md" />
                        </div>
                      </>
                    )}
                  </div>
                  <div className="px-2 py-1.5 flex items-center justify-between">
                    <span className="text-[#A8D6FF] text-11px truncate flex-1">{item.resultsType === 'v' ? '视频' : '图片'}</span>
                    <span className="text-[rgba(168,214,255,0.5)] text-10px shrink-0">{item.resultsTime}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
        {/* 飞行路线：用待执飞计划数据展示路线卡片 */}
        <div className="flex-1 pointer-events-auto min-w-0">
          <div className="bg-[rgba(0,56,129,0.85)] rounded-16px border border-[rgba(255,255,255,0.3)] px-3 py-2 h-full flex flex-col">
            <div className="flex items-center justify-between mb-2 shrink-0">
              <span className="text-[#A0C7FF] text-13px font-bold flex items-center gap-1.5">
                <EnvironmentOutlined className="text-[#01C2FF]" />飞行路线
              </span>
              <span className="text-[#01C2FF] text-11px px-1.5 py-0.5 rounded-full bg-[rgba(1,194,255,0.12)] border border-[rgba(1,194,255,0.25)]">
                {plans.length}
              </span>
            </div>
            <div className="flex-1 overflow-y-auto max-h-210px min-h-80px space-y-2 pr-1">
              {!dockCode && (
                <div className="text-[rgba(168,214,255,0.5)] text-11px py-4 text-center">请先在左侧选择机场</div>
              )}
              {dockCode && plansLoading && (
                <div className="flex flex-col items-center justify-center gap-2 py-4 text-[#A8D6FF] text-11px">
                  <Spin size="small" /><span>加载路线计划…</span>
                </div>
              )}
              {dockCode && !plansLoading && plans.length === 0 && (
                <div className="text-[rgba(168,214,255,0.5)] text-11px py-4 text-center">暂无飞行路线计划</div>
              )}
              {dockCode && !plansLoading && plans.map(item => (
                <div
                  key={item.planId}
                  className="rounded-lg p-2.5 border border-[rgba(255,255,255,0.12)] bg-[rgba(0,0,0,0.2)] hover:bg-[rgba(255,255,255,0.06)] transition-colors"
                >
                  <div className="flex items-center gap-1.5 mb-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-[#01C2FF] shrink-0" />
                    <span className="text-[#A8D6FF] text-12px font-medium truncate flex-1" title={item.lineName}>{item.lineName}</span>
                  </div>
                  <div className="text-[rgba(168,214,255,0.55)] text-10px leading-5">
                    <div className="truncate">机场：{item.dockCode}</div>
                    <div>时间：{item.flyTime || item.startDate}</div>
                  </div>
                </div>
              ))}
            </div>
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
      {/* 任务结果已内联到"视频采集"面板，不再使用弹窗 */}
    </div>
  )
}

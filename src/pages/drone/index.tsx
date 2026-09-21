import { useState, useEffect, useCallback, useMemo, useRef } from 'react'
import { Button, DatePicker, Image, Input, Modal, Popover, Spin, message } from 'antd'
import {
  RocketOutlined,
  VideoCameraOutlined,
  PictureOutlined,
  SendOutlined,
  PlayCircleOutlined,
  PauseCircleOutlined,
  ReloadOutlined,
  CloseOutlined,
  FilterOutlined,
} from '@ant-design/icons'
import dayjs, { type Dayjs } from 'dayjs'
import { disabledFutureDate } from '@/utils/helpers'
import './index.less'
import L7MapView from '@/components/L7MapView'
import { dockList, listFlyPlan, listFlyResult, listCleanedData } from '@/servers/mapBox'
import { dataManageApi } from '@/servers/dataManage'
import RegionSelector from '@/components/RegionSelector'
import MapPanelHeader from '@/components/MapPanelHeader'
import MapPopupPortal from '@/components/MapPopupPortal'
import { useAppStore } from '@/stores'
import { toRegionQuery } from '@/utils/region'
import FlyListModel from '@/components/MapBox/FlyListModel'
import type { Scene } from '@antv/l7'
import { normalizeDock, getDockModeColor, type NormalizedDock } from '@/utils/dock'
import type { DroneTaskVO, HbdpUploadResource } from '@/types/dataManage'
import type { PlanItem, FlyResultItem, DroneMediaItem, SensorData, CleanedSensorItem } from './shared'
import { isValidCoordinate, getRegionCamera, statusObj } from './shared'
import { useTrajectoryPlayback } from './useTrajectoryPlayback'
import { useResourceBlobUrl } from '@/utils/useResourceBlobUrl'

export default function Drone() {
  const [docks, setDocks] = useState<NormalizedDock[]>([])
  const [dockCode, setDockCode] = useState<string | null>(null)
  const [mapScene, setMapScene] = useState<Scene | null>(null)

  // 传感器清洗数据与轨迹数据列表
  const [sensorItems, setSensorItems] = useState<CleanedSensorItem[]>([])
  const [sensorLoading, setSensorLoading] = useState(false)

  const regionContext = useAppStore(state => state.regionContext)
  const querySelection = regionContext?.querySelection
  const mapSelection = regionContext?.mapSelection

  // 当前选中的机场对象
  const currentDock = useMemo(
    () => docks.find(d => d.dockCode === dockCode) ?? null,
    [docks, dockCode],
  )

  // 飞行任务 / 待执飞任务
  const [jobs, setJobs] = useState<DroneTaskVO[]>([])
  const [plans, setPlans] = useState<PlanItem[]>([])
  const [docksLoading, setDocksLoading] = useState(true)
  const [jobsLoading, setJobsLoading] = useState(false)
  const [plansLoading, setPlansLoading] = useState(false)

  // 当前选中的飞行任务，用于在视频采集面板展示图片/视频结果（默认不选中）
  const [curJobID, setCurJobID] = useState('')
  /** 视频采集面板：按当前任务 dataSource 拉取的成果（api = listFlyResult 直 URL；import = task/resources 经 Blob URL 渲染） */
  const [jobResults, setJobResults] = useState<DroneMediaItem[]>([])
  const [resultsLoading, setResultsLoading] = useState(false)

  // 搜索关键字
  const [jobSearchText, setJobSearchText] = useState('')
  const [planSearchText, setPlanSearchText] = useState('')

  // 飞行任务日期范围过滤（默认年初 → 今天）
  const [jobDateRange, setJobDateRange] = useState<[Dayjs, Dayjs]>(() => [
    dayjs().startOf('year'),
    dayjs(),
  ])
  const [jobFilterOpen, setJobFilterOpen] = useState(false)

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

  // 轨迹播放控制器（虚线未走、实线已走、起终点、移动无人机）
  const trajectory = useTrajectoryPlayback({
    scene: mapScene,
    items: sensorItems,
    autoPlay: true,
  })

  // 当前动画进度点位对应的传感器读数
  const activeSensorPoint = trajectory.currentPoint?.raw
  const displaySensorData: SensorData | null = activeSensorPoint ? {
    pm25: Number(activeSensorPoint.pm25 ?? 0),
    pm10: Number(activeSensorPoint.pm10 ?? 0),
    tsp: Number(activeSensorPoint.tsp ?? 0),
    vocs: Number(activeSensorPoint.vocs ?? 0),
    so2: Number(activeSensorPoint.so2 ?? 0),
    no2: Number(activeSensorPoint.no2 ?? 0),
    o3: Number(activeSensorPoint.o3 ?? 0),
    co: Number(activeSensorPoint.co ?? 0),
    altitude: Number(activeSensorPoint.altitude ?? 0),
    temperature: Number(activeSensorPoint.temperature ?? 0),
    humidity: Number(activeSensorPoint.humidity ?? 0),
    dataTime: activeSensorPoint.dataTime,
  } : null

  // 派遣无人机巡逻（右键菜单）
  const [flyVisible, setFlyVisible] = useState(false)
  const [flyLngLat, setFlyLngLat] = useState<{ lng: number; lat: number }>({ lng: 0, lat: 0 })
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; lng: number; lat: number } | null>(null)

  // 加载无人机机场数据
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
      } catch (e) {
        console.warn('无人机机场列表加载失败', e)
      }

      if (cancelled) return
      setDocksLoading(false)
      setDocks(loadedDocks)
      const firstDock = loadedDocks.find(item => isValidCoordinate(item.dockLng, item.dockLat))
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

  // 选中机场变化 / 日期范围变化 → 查询该机场飞行任务/待执飞计划
  useEffect(() => {
    if (!dockCode) return
    let cancelled = false
    const param = {
      dockCode,
      startDate: jobDateRange[0].format('YYYY-MM-DD'),
      endDate: jobDateRange[1].format('YYYY-MM-DD'),
    }

    setJobsLoading(true)
    setPlansLoading(true)
    dataManageApi.droneTaskList({
      dockCode,
      startTime: `${jobDateRange[0].format('YYYY-MM-DD')} 00:00:00`,
      endTime: `${jobDateRange[1].format('YYYY-MM-DD')} 23:59:59`,
      pageNum: 1,
      pageSize: 800,
      includeThirdParty: true,
    })
      .then(page => {
        if (cancelled) return
        const records = Array.isArray(page?.records) ? page.records : []
        setJobs(records)
      })
      .catch(() => {
        if (!cancelled) setJobs([])
      })
      .finally(() => { if (!cancelled) setJobsLoading(false) })

    listFlyPlan(param)
      .then(res => {
        if (cancelled) return
        setPlans(res?.resultCode === 0 && Array.isArray(res.data) ? res.data : [])
      })
      .catch(() => { if (!cancelled) setPlans([]) })
      .finally(() => { if (!cancelled) setPlansLoading(false) })

    return () => { cancelled = true }
  }, [dockCode, jobDateRange])

  // 加载传感器清洗数据与轨迹
  const loadSensorData = useCallback(async (siteCode: string, startTime: string, completedTime?: string | null) => {
    setSensorLoading(true)
    try {
      // 结束时间：为空或与开始时间相同则自动延展 2 小时
      const isEndTimeValid = completedTime && completedTime.trim() !== '' && completedTime !== startTime
      const endTime = isEndTimeValid
        ? completedTime
        : dayjs(startTime).add(2, 'hour').format('YYYY-MM-DD HH:mm:ss')
      const res = await listCleanedData({
        siteCode,
        startTime,
        endTime,
        pageSize: 4000,
      })
      const rawList: CleanedSensorItem[] = Array.isArray((res as any)?.rows)
        ? (res as any).rows
        : (Array.isArray((res as any)?.data) ? (res as any).data : [])
      setSensorItems(rawList)
      if (rawList.length === 0) {
        message.info('该飞行时段暂无传感器轨迹记录')
      } else {
        message.success(`已加载 ${rawList.length} 条轨迹点位并绘制航线`)
      }
    } catch (e) {
      console.warn('获取传感器清洗数据失败', e)
      setSensorItems([])
      message.error('获取传感器数据失败')
    } finally {
      setSensorLoading(false)
    }
  }, [])

  // 点击飞行任务 → 选中该任务，加载传感器轨迹与媒体采集成果
  const selectJob = (item: DroneTaskVO) => {
    setCurJobID(item.taskId)
    if (currentDock?.sensorDeviceId) {
      // 新接口（drone-task/list）不再返回 completedTime，
      // loadSensorData 内部会以 startTime + 2h 作为兜底结束时间
      void loadSensorData(currentDock.sensorDeviceId, item.taskTime, undefined)
    } else {
      setSensorItems([])
    }
  }

  // 媒体成果预览弹窗选中项
  const [previewItem, setPreviewItem] = useState<DroneMediaItem | null>(null)

  // 点击采集成果 → 弹出 Modal 预览
  const openMediaPreview = (item: DroneMediaItem) => {
    setPreviewItem(item)
  }

  /**
   * 根据当前选中任务的 dataSource 分流调用不同接口，统一写入 jobResults:
   * - api：GET /dpSys/hbdp/wurenji/listFlyResult?jobID=...，resultsUrl 是公网可访问 URL
   * - import：GET /dpSys/hbdp/wurenji/task/resources?taskId=...，resourceId 传渲染端再走带 token 的 preview
   */
  useEffect(() => {
    if (!curJobID) {
      setJobResults([])
      return
    }
    const curJob = jobs.find(j => j.taskId === curJobID)
    if (!curJob) {
      setJobResults([])
      return
    }
    let cancelled = false
    setResultsLoading(true)

    if (curJob.dataSource === 'import') {
      dataManageApi.getDroneTaskResources(curJobID)
        .then(res => {
          if (cancelled) return
          const list: HbdpUploadResource[] = Array.isArray(res) ? res : []
          const items: DroneMediaItem[] = list.map(r => ({
            resultsID: String(r.id),
            resultsType: r.fileType === 'video' ? 'v' : 'p',
            resultsTime: r.createTime || '',
            resourceId: r.id,
            fileName: r.fileName,
            source: 'import',
          }))
          setJobResults(items)
        })
        .catch(() => { if (!cancelled) setJobResults([]) })
        .finally(() => { if (!cancelled) setResultsLoading(false) })
    } else {
      // api 来源（含未知类型兜底走 listFlyResult）
      listFlyResult({ jobID: curJobID })
        .then(res => {
          if (cancelled) return
          const list: FlyResultItem[] = res?.resultCode === 0 && Array.isArray(res.data) ? res.data : []
          const items: DroneMediaItem[] = list.map(r => ({
            resultsID: r.resultsID,
            resultsType: r.resultsType,
            resultsUrl: r.resultsUrl,
            resultsTime: r.resultsTime,
            source: 'api',
          }))
          setJobResults(items)
        })
        .catch(() => { if (!cancelled) setJobResults([]) })
        .finally(() => { if (!cancelled) setResultsLoading(false) })
    }

    return () => { cancelled = true }
  }, [curJobID, jobs])

  // 纯前端搜索过滤
  const filteredJobs = useMemo(() => {
    if (!jobSearchText.trim()) return jobs
    const q = jobSearchText.trim().toLowerCase()
    return jobs.filter(j =>
      ((j.taskName || j.taskId) && (j.taskName || j.taskId).toLowerCase().includes(q)) ||
      (j.taskId && String(j.taskId).toLowerCase().includes(q)),
    )
  }, [jobs, jobSearchText])

  const filteredPlans = useMemo(() => {
    if (!planSearchText.trim()) return plans
    const q = planSearchText.trim().toLowerCase()
    return plans.filter(p =>
      (p.planName && p.planName.toLowerCase().includes(q)) ||
      (p.lineName && p.lineName.toLowerCase().includes(q)) ||
      (p.planId && String(p.planId).toLowerCase().includes(q)),
    )
  }, [plans, planSearchText])

  const flyTo = (item: NormalizedDock) => {
    if (dockCode !== item.dockCode) {
      setJobs([])
      setPlans([])
      setCurJobID('')
      setSensorItems([])
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
    setMapScene(scene)
    scene.on('contextmenu', (ev: any) => {
      ev.originalEvent?.preventDefault()
      ev.originalEvent?.stopPropagation()
      if (ev.lngLat) {
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

  useEffect(() => {
    const close = () => setContextMenu(null)
    window.addEventListener('click', close)
    window.addEventListener('contextmenu', close)
    return () => { window.removeEventListener('click', close); window.removeEventListener('contextmenu', close) }
  }, [])

  return (
    <div className="map-screen w-full h-full relative overflow-hidden" style={{ background: '#1a5ab0' }}>
      <L7MapView
        id="drone-map"
        center={mapCenter ?? regionCamera.center}
        zoom={mapZoom ?? regionCamera.zoom}
        minZoom={6}
        maxZoom={14}
        showTiles
        markers={markers}
        markerIconUrl="/marker/drone-on.png"
        onSceneLoaded={handleSceneLoaded}
      />
      {/* 顶部选择器 */}
      <div className="map-overlay-toolbar map-top-controls">
        <RegionSelector />
      </div>

      {/* 左侧 - 机场列表 */}
      <div className="absolute left-16px top-10px bottom-10px z-50 w-330px pointer-events-none">
        <div className="screen-glass-panel h-full flex flex-col pointer-events-auto">
          <MapPanelHeader title="无人机机场" extra={<span>{docks.length} 座</span>} />
          <div className="map-panel-scroll">
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

              <div className="mb-1.5 pr-18">
                <span className="text-[#A8D6FF] text-16px font-bold flex items-center gap-1.5 min-w-0 truncate">
                  <RocketOutlined className="text-[#01C2FF] shrink-0" />
                  <span className="truncate" title={item.dockName}>{item.dockName}</span>
                </span>
              </div>

              {/* 仅在有传感器编码时展示，取数组第一个作为对应传感器编码 */}
              {item.sensorDeviceId && (
                <div className="mb-2">
                  <span className="text-11px font-mono px-2 py-0.5 rounded bg-[rgba(1,194,255,0.12)] border border-[rgba(1,194,255,0.35)] text-[#00E5FF] inline-flex items-center gap-1.5 shadow-[0_0_8px_rgba(0,229,255,0.15)]">
                    <span className="w-1.5 h-1.5 rounded-full bg-[#00E5FF]" />
                    传感器: {item.sensorDeviceId}
                  </span>
                </div>
              )}

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
      </div>

      {/* 底部中间 - 传感器数据面板 */}
      {dockCode && (
        <div className="map-sensor-panel absolute bottom-60px left-1/2 -translate-x-1/2 z-40 min-w-720px">
          <div className="screen-glass-panel">
            <MapPanelHeader
              title={
                <div className="flex items-center gap-2">
                  <span>无人机传感器数据</span>
                  {currentDock?.sensorDeviceId && (
                    <span className="text-11px font-normal px-2 py-0.5 rounded bg-[rgba(1,194,255,0.15)] border border-[rgba(1,194,255,0.3)] text-[#00E5FF] font-mono">
                      设备: {currentDock.sensorDeviceId}
                    </span>
                  )}
                </div>
              }
              extra={
                <div className="flex items-center gap-3">
                  {trajectory.totalPoints > 0 && (
                    <div className="flex items-center gap-2 text-11px text-[#A8D6FF]">
                      <Button
                        size="small"
                        type="text"
                        icon={
                          trajectory.isPlaying ? (
                            <PauseCircleOutlined className="text-16px text-[#01C2FF]" />
                          ) : (
                            <PlayCircleOutlined className="text-16px text-[#01C2FF]" />
                          )
                        }
                        onClick={trajectory.isPlaying ? trajectory.pause : trajectory.play}
                        title={trajectory.isPlaying ? '暂停' : '播放'}
                      />
                      <Button
                        size="small"
                        type="text"
                        icon={<ReloadOutlined className="text-14px text-[#A8D6FF]" />}
                        onClick={trajectory.reset}
                        title="重新播放"
                      />
                      <span className="text-[rgba(168,214,255,0.7)] font-mono">
                        {trajectory.currentIndex + 1} / {trajectory.totalPoints}
                      </span>
                      {displaySensorData?.dataTime && (
                        <span className="text-[#01C2FF] font-mono text-11px">
                          {displaySensorData.dataTime}
                        </span>
                      )}
                      <div className="flex items-center gap-1 ml-1">
                        {([1, 2, 4] as const).map(s => (
                          <button
                            key={s}
                            type="button"
                            onClick={() => trajectory.setSpeed(s)}
                            className={`px-1.5 py-0.5 text-10px rounded cursor-pointer transition-colors border ${
                              trajectory.speed === s
                                ? 'bg-[#01C2FF] text-[#002B49] border-[#01C2FF] font-bold'
                                : 'bg-[rgba(0,0,0,0.3)] text-[#A8D6FF] border-[rgba(255,255,255,0.2)] hover:border-[#01C2FF]'
                            }`}
                          >
                            {s}x
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                  <span className="text-11px text-[rgba(168,214,255,0.7)]">
                    {sensorLoading
                      ? '加载中…'
                      : !currentDock?.sensorDeviceId
                        ? '未配置传感器'
                        : trajectory.totalPoints > 0
                          ? trajectory.isPlaying
                            ? '航线播放中'
                            : '播放已暂停'
                          : '暂无轨迹数据'}
                  </span>
                </div>
              }
            />
            {displaySensorData ? (
              <div className="space-y-1.5 pt-0.5">
                {/* 第一行：PM2.5 / PM10 / TSP / VOCs / SO₂ */}
                <div className="grid grid-cols-5 gap-2">
                  {[
                    {
                      label: 'PM2.5',
                      value: displaySensorData.pm25,
                      unit: 'μg/m³',
                      color:
                        displaySensorData.pm25 > 75
                          ? '#FF4D4F'
                          : displaySensorData.pm25 > 35
                            ? '#FAAD14'
                            : '#52C41A',
                    },
                    {
                      label: 'PM10',
                      value: displaySensorData.pm10,
                      unit: 'μg/m³',
                      color:
                        displaySensorData.pm10 > 150
                          ? '#FF4D4F'
                          : displaySensorData.pm10 > 75
                            ? '#FAAD14'
                            : '#52C41A',
                    },
                    {
                      label: 'TSP',
                      value: displaySensorData.tsp,
                      unit: 'μg/m³',
                      color: '#01C2FF',
                    },
                    {
                      label: 'VOCs',
                      value: displaySensorData.vocs,
                      unit: 'ppb',
                      color:
                        displaySensorData.vocs > 200
                          ? '#FF4D4F'
                          : displaySensorData.vocs > 100
                            ? '#FAAD14'
                            : '#52C41A',
                    },
                    {
                      label: 'SO₂',
                      value: displaySensorData.so2,
                      unit: 'μg/m³',
                      color:
                        displaySensorData.so2 > 150
                          ? '#FF4D4F'
                          : displaySensorData.so2 > 75
                            ? '#FAAD14'
                            : '#52C41A',
                    },
                  ].map(item => (
                    <div
                      key={item.label}
                      className="text-center py-1.5 px-2 rounded-lg bg-[rgba(0,0,0,0.2)] border border-[rgba(255,255,255,0.06)]"
                    >
                      <div className="text-16px font-bold font-mono leading-tight" style={{ color: item.color }}>
                        {item.value}
                      </div>
                      <div className="text-[rgba(168,214,255,0.5)] text-10px leading-tight">{item.unit}</div>
                      <div className="text-[#A8D6FF] text-11px mt-px font-medium leading-tight">{item.label}</div>
                    </div>
                  ))}
                </div>
                {/* 第二行：NO₂ / O₃ / CO / 高度 / 温度 */}
                <div className="grid grid-cols-5 gap-2">
                  {[
                    {
                      label: 'NO₂',
                      value: displaySensorData.no2,
                      unit: 'μg/m³',
                      color:
                        displaySensorData.no2 > 80
                          ? '#FF4D4F'
                          : displaySensorData.no2 > 40
                            ? '#FAAD14'
                            : '#52C41A',
                    },
                    {
                      label: 'O₃',
                      value: displaySensorData.o3,
                      unit: 'μg/m³',
                      color:
                        displaySensorData.o3 > 160
                          ? '#FF4D4F'
                          : displaySensorData.o3 > 100
                            ? '#FAAD14'
                            : '#52C41A',
                    },
                    {
                      label: 'CO',
                      value: displaySensorData.co,
                      unit: 'mg/m³',
                      color:
                        displaySensorData.co > 10
                          ? '#FF4D4F'
                          : displaySensorData.co > 5
                            ? '#FAAD14'
                            : '#52C41A',
                    },
                    {
                      label: '高度',
                      value: displaySensorData.altitude,
                      unit: 'm',
                      color: '#01C2FF',
                    },
                    {
                      label: '温度',
                      value: displaySensorData.temperature,
                      unit: '℃',
                      color: displaySensorData.temperature > 35 ? '#FAAD14' : '#00E5FF',
                    },
                  ].map(item => (
                    <div
                      key={item.label}
                      className="text-center py-1.5 px-2 rounded-lg bg-[rgba(0,0,0,0.2)] border border-[rgba(255,255,255,0.06)]"
                    >
                      <div className="text-16px font-bold font-mono leading-tight" style={{ color: item.color }}>
                        {item.value}
                      </div>
                      <div className="text-[rgba(168,214,255,0.5)] text-10px leading-tight">{item.unit}</div>
                      <div className="text-[#A8D6FF] text-11px mt-px font-medium leading-tight">{item.label}</div>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <div className="text-[rgba(168,214,255,0.45)] text-12px py-4 text-center">
                {sensorLoading
                  ? '正在查询清洗传感器数据与航线轨迹…'
                  : !currentDock?.sensorDeviceId
                    ? '当前机场未绑定传感器编码，无传感器数据'
                    : curJobID
                      ? '该飞行任务时间段内暂无传感器轨迹数据'
                      : '请在右侧选择飞行任务以查看航线与传感器数据'}
              </div>
            )}
          </div>
        </div>
      )}

      {/* 右侧容器 - [视频采集(选中飞行任务后在此左侧显示)] + [飞行任务 + 待执飞任务] */}
      <div className="absolute right-16px top-10px bottom-10px z-50 flex gap-3 pointer-events-none">
        {/* 视频采集面板：仅在选中飞行任务 curJobID 有值时显示在飞行任务左侧 */}
        {curJobID && (
          <div className="screen-glass-panel w-330px mt-45px mb-115px flex flex-col pointer-events-auto overflow-hidden">
            <MapPanelHeader title="视频采集" extra={
              <div className="flex items-center gap-2">
                <span className="text-[#01C2FF] text-11px px-2 py-0.5 rounded-full bg-[rgba(1,194,255,0.12)] border border-[rgba(1,194,255,0.25)]">
                  {jobResults.length} 个结果
                </span>
                <Button
                  type="text"
                  size="small"
                  icon={<CloseOutlined className="!text-[#A8D6FF] hover:!text-white" />}
                  onClick={() => setCurJobID('')}
                  title="关闭视频采集面板"
                />
              </div>
            } />
            <div className="flex-1 overflow-y-auto space-y-2.5 py-1 pr-1">
              {resultsLoading && (
                <div className="flex flex-col items-center justify-center gap-2 py-8 text-[#A8D6FF] text-11px">
                  <Spin size="small" /><span>加载任务采集结果…</span>
                </div>
              )}
              {!resultsLoading && jobResults.length === 0 && (
                <div className="text-[rgba(168,214,255,0.5)] text-11px py-8 text-center">该任务暂无关联视频或图片</div>
              )}
              {!resultsLoading && jobResults.map(item => (
                <DroneMediaThumbnail
                  key={item.resultsID}
                  item={item}
                  onClick={() => openMediaPreview(item)}
                />
              ))}
            </div>
          </div>
        )}

        {/* 飞行任务 + 待执飞任务 */}
        <div className="w-330px flex flex-col gap-3 pointer-events-none">
          <div className="screen-glass-panel flex-1 px-3.5 py-2 flex flex-col overflow-hidden pointer-events-auto">
            <MapPanelHeader title="飞行任务" extra={<span>{filteredJobs.length} 项</span>} tools={
              <div className="drone-task-search-row">
                <Input
                  placeholder="搜索名称/ID"
                  allowClear
                  size="small"
                  value={jobSearchText}
                  onChange={e => setJobSearchText(e.target.value)}
                  className="drone-header-search"
                />
                <Popover
                  trigger="click"
                  open={jobFilterOpen}
                  onOpenChange={setJobFilterOpen}
                  placement="bottomRight"
                  arrow={false}
                  content={
                    <div className="drone-date-filter">
                      <div className="drone-date-filter__title">选择日期范围</div>
                      <DatePicker.RangePicker
                        value={jobDateRange}
                        onChange={(values) => {
                          if (values && values[0] && values[1]) {
                            setJobDateRange([values[0], values[1]])
                          }
                        }}
                        format="YYYY-MM-DD"
                        allowClear={false}
                        disabledDate={disabledFutureDate}
                        size="small"
                      />
                      <div className="drone-date-filter__actions">
                        <Button
                          size="small"
                          onClick={() => setJobDateRange([dayjs().startOf('year'), dayjs()])}
                        >
                          重置
                        </Button>
                        <Button size="small" type="primary" onClick={() => setJobFilterOpen(false)}>
                          确定
                        </Button>
                      </div>
                    </div>
                  }
                >
                  <Button
                    type="text"
                    size="small"
                    icon={<FilterOutlined />}
                    className={`drone-filter-btn ${jobFilterOpen ? 'drone-filter-btn--active' : ''}`}
                    title={`日期范围：${jobDateRange[0].format('YYYY-MM-DD')} ~ ${jobDateRange[1].format('YYYY-MM-DD')}`}
                  />
                </Popover>
              </div>
            } />
            <div className="flex-1 overflow-y-auto space-y-2 py-1">
              {!dockCode && <div className="text-[rgba(168,214,255,0.4)] text-11px py-2 text-center">请先在左侧选择无人机机场</div>}
              {dockCode && jobsLoading && <div className="flex items-center justify-center gap-2 py-2 text-[#A8D6FF] text-11px"><Spin size="small" />加载中…</div>}
              {dockCode && !jobsLoading && filteredJobs.length === 0 && (
                <div className="text-[rgba(168,214,255,0.4)] text-11px py-3 text-center">
                  {jobSearchText ? '未搜索到匹配任务' : '暂无飞行任务'}
                </div>
              )}
              {dockCode && filteredJobs.map(item => (
                <div
                  key={item.taskId}
                  className={`rounded-xl p-3 cursor-pointer transition-all border ${
                    curJobID === item.taskId
                      ? 'bg-[rgba(1,194,255,0.18)] border-[#01C2FF] shadow-[0_0_10px_rgba(1,194,255,0.18)]'
                      : 'bg-[rgba(0,0,0,0.2)] border-[rgba(255,255,255,0.15)] hover:bg-[rgba(255,255,255,0.06)]'
                  }`}
                  onClick={() => selectJob(item)}
                >
                  <div className="flex items-center justify-between mb-1.5">
                    <div className="text-[#A8D6FF] text-13px font-medium truncate flex-1 pr-2" title={item.taskName || item.taskId}>
                      {item.taskName || item.taskId}
                    </div>
                    <span
                      className="px-2 py-0.5 rounded text-11px font-medium shrink-0"
                      style={{
                        backgroundColor: statusObj[item.taskStatus]?.color || 'rgba(255,255,255,0.2)',
                        color: ['a', '3'].includes(item.taskStatus) ? '#003881' : '#ffffff',
                      }}
                    >
                      {statusObj[item.taskStatus]?.message || '未知状态'}
                    </span>
                  </div>
                  <div className="flex items-center justify-between gap-2 text-[rgba(168,214,255,0.55)] text-11px font-normal">
                    <TimeRangeCell taskTime={item.taskTime} completedTime={item.completedTime} />
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="screen-glass-panel flex-1 px-3.5 py-2 flex flex-col overflow-hidden pointer-events-auto">
            <MapPanelHeader title="待执飞任务" extra={<span>{filteredPlans.length} 项</span>} tools={
              <Input
                placeholder="搜索名称/ID"
                allowClear
                size="small"
                value={planSearchText}
                onChange={e => setPlanSearchText(e.target.value)}
                className="drone-header-search"
              />
            } />
            <div className="flex-1 overflow-y-auto space-y-2 py-1">
              {!dockCode && <div className="text-[rgba(168,214,255,0.4)] text-11px py-2 text-center">请先在左侧选择无人机机场</div>}
              {dockCode && plansLoading && <div className="flex items-center justify-center gap-2 py-2 text-[#A8D6FF] text-11px"><Spin size="small" />加载中…</div>}
              {dockCode && !plansLoading && filteredPlans.length === 0 && (
                <div className="text-[rgba(168,214,255,0.4)] text-11px py-2 text-center">
                  {planSearchText ? '未搜索到匹配计划' : '暂无待执飞任务'}
                </div>
              )}
              {dockCode && filteredPlans.map(item => (
                <div key={item.planId} className="rounded-xl p-3 transition-all bg-[rgba(0,0,0,0.2)] border border-[rgba(255,255,255,0.15)] hover:bg-[rgba(255,255,255,0.06)]">
                  <div className="flex items-center justify-between mb-1">
                    <div className="text-[#A8D6FF] text-13px font-medium truncate flex-1 pr-2" title={item.lineName || item.planName || item.planId}>
                      {item.lineName || item.planName || item.planId}
                    </div>
                    <div className="text-[#01C2FF] text-12px cursor-pointer hover:underline shrink-0" onClick={() => message.info(`查看计划: ${item.planName || item.planId}`)}>
                      详情
                    </div>
                  </div>
                  <div className="flex items-center justify-between">
                    <div className="text-[rgba(168,214,255,0.5)] text-11px">{item.dockCode} | {item.flyTime || '全天'}</div>
                    <div className="text-[rgba(168,214,255,0.5)] text-11px">{item.startDate}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* 右键上下文菜单 - 无人机派遣 */}
      {contextMenu && (
        <MapPopupPortal>
        <div
          className="map-point-popup absolute min-w-150px rounded-lg shadow-xl overflow-hidden"
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
        </MapPopupPortal>
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

      {/* 媒体成果预览弹窗（视频采集成果预览 / 图片采集成果预览） */}
      {previewItem && (
        <Modal
          open
          onCancel={() => setPreviewItem(null)}
          footer={null}
          width={960}
          centered
          destroyOnClose
          title={
            <div className="flex items-center justify-between pr-8">
              <span className="text-[#03FBFD] text-17px font-bold flex items-center gap-2">
                {previewItem.resultsType === 'v' ? (
                  <VideoCameraOutlined className="text-[#01C2FF]" />
                ) : (
                  <PictureOutlined className="text-[#01C2FF]" />
                )}
                {previewItem.resultsType === 'v' ? '视频采集成果预览' : '图片采集成果预览'}
              </span>
              {previewItem.resultsTime && (
                <span className="text-[rgba(168,214,255,0.7)] text-12px font-normal">
                  采集时间：{previewItem.resultsTime}
                </span>
              )}
            </div>
          }
        >
          <div className="flex flex-col items-center justify-center p-4 min-h-[300px] overflow-hidden">
            <DroneMediaPreviewBody item={previewItem} />
          </div>
        </Modal>
      )}
    </div>
  )
}

/**
 * drone 视频采集列表缩略图
 * - api：直接用公网 URL，<Image> / 带 PlayCircle 的 <video>
 * - import：拿带 token 的 blob URL（useResourceBlobUrl）后再渲染
 *   - 加载中显示 Spin 占位（容器保持固定高度，避免高度抖动）
 */
function DroneMediaThumbnail({ item, onClick }: { item: DroneMediaItem; onClick: () => void }) {
  return (
    <div
      className="group rounded-lg overflow-hidden border border-[rgba(255,255,255,0.12)] bg-[rgba(0,0,0,0.25)] hover:border-[#01C2FF] hover:shadow-[0_0_8px_rgba(1,194,255,0.15)] transition-all cursor-pointer"
      onClick={onClick}
      title="点击打开弹窗预览/播放"
    >
      <div className="relative w-full h-110px overflow-hidden bg-[rgba(0,0,0,0.35)]">
        <MediaSourceView item={item} variant="thumb" />
      </div>
      <div className="px-2.5 py-1.5 flex items-center justify-between bg-[rgba(0,0,0,0.2)]">
        <span className="text-[#A8D6FF] text-11px truncate flex-1">{item.resultsType === 'v' ? '视频' : '图片'}</span>
        <span className="text-[rgba(168,214,255,0.5)] text-10px shrink-0">{item.resultsTime || '-'}</span>
      </div>
    </div>
  )
}

/**
 * drone 视频采集预览 Modal 内容
 * - api：直接 src；import：拿 blob URL
 * - 视频：controls autoPlay；图片：包在圆角渐变底框里给点击放大
 */
function DroneMediaPreviewBody({ item }: { item: DroneMediaItem }) {
  const isVideo = item.resultsType === 'v'
  if (isVideo) {
    return (
      <div className="w-full flex flex-col items-center gap-3">
        <div className="w-full rounded-2xl overflow-hidden shadow-[0_0_30px_rgba(0,0,0,0.5)] border border-[rgba(255,255,255,0.2)] bg-black">
          <MediaSourceView item={item} variant="preview" autoPlay />
        </div>
        <div className="text-[rgba(168,214,255,0.6)] text-12px">提示：支持画中画、全屏播放与倍速调节</div>
      </div>
    )
  }
  return (
    <div className="w-full flex flex-col items-center gap-3">
      <div className="p-2 rounded-2xl bg-[rgba(0,56,129,0.5)] border border-[rgba(255,255,255,0.2)] shadow-[0_0_30px_rgba(0,0,0,0.4)] flex items-center justify-center">
        <MediaSourceView item={item} variant="preview" />
      </div>
      <div className="text-[rgba(168,214,255,0.6)] text-12px">提示：点击图片可直接进行放大、旋转、全屏预览</div>
    </div>
  )
}

/**
 * 按数据源切换 URL 来源的统一渲染组件：
 * - api：resultsUrl 直接给 <video>/<Image>，不带 token
 * - import：自动调 useResourceBlobUrl(resourceId) 拉带 token 的 blob URL
 *
 * variant 控制两种用途：
 * - 'thumb'   —— 列表缩略图（视频带 PlayCircle overlay，图片 object-cover）
 * - 'preview' —— 二次预览（视频 controls autoPlay，图片可不加 preview mask，由父组件决定）
 */
function MediaSourceView({
  item,
  variant,
  autoPlay,
}: {
  item: DroneMediaItem
  variant: 'thumb' | 'preview'
  autoPlay?: boolean
}) {
  const isVideo = item.resultsType === 'v'
  // import 来源：跑 hook 拿 blob URL；api 来源传 null 跳过取数
  const { url: blobUrl, error: blobError } = useResourceBlobUrl(
    item.source === 'import' && item.resourceId != null ? item.resourceId : null,
  )
  const url = item.source === 'api' ? (item.resultsUrl ?? '') : blobUrl

  if (!url) {
    if (blobError) {
      return <Button size="small" type="link" disabled>加载失败</Button>
    }
    return <Spin size="small" />
  }
  if (isVideo) {
    if (variant === 'thumb') {
      return (
        <div className="w-full h-full relative">
          <video src={url} className="w-full h-full object-cover" preload="metadata" muted />
          <div className="absolute inset-0 flex items-center justify-center bg-[rgba(0,0,0,0.3)] group-hover:bg-[rgba(0,0,0,0.15)] transition-all">
            <PlayCircleOutlined className="text-36px text-white/90 drop-shadow-md group-hover:scale-110 transition-transform" />
          </div>
        </div>
      )
    }
    return <video src={url} controls autoPlay={autoPlay !== false} className="w-full max-h-[65vh] object-contain" />
  }
  if (variant === 'thumb') {
    return <Image src={url} preview={false} className="w-full h-full object-cover" fallback="" />
  }
  return (
    <Image
      src={url}
      preview={{
        mask: <div className="text-[#03FBFD] text-14px font-medium flex items-center gap-1">点击放大旋转预览</div>,
      }}
      className="max-h-[62vh] max-w-full object-contain rounded-xl"
    />
  )
}

/**
 * 飞行任务列表底部"开始 → 结束"时间区间
 * - 后端未返 completedTime 时按 taskTime + 1h 兜底
 * - 永远完整显示日期 + 时间，避免跨日时看不到日期
 */
function TimeRangeCell({ taskTime, completedTime }: { taskTime?: string; completedTime?: string }) {
  if (!taskTime) {
    return (
      <>
        <span className="flex-1 text-center">-</span>
      </>
    )
  }
  const endStr = completedTime || dayjs(taskTime).add(1, 'hour').format('YYYY-MM-DD HH:mm:ss')
  return (
    <>
      <span className="truncate flex-1 min-w-0" title={`开始：${taskTime}`}>
        {dayjs(taskTime).format('YYYY-MM-DD HH:mm:ss')}
      </span>
      <span className="shrink-0 text-[rgba(168,214,255,0.4)]">→</span>
      <span className="shrink-0 text-right" title={`结束：${endStr}`}>
        {endStr}
      </span>
    </>
  )
}

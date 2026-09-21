import { useState, useEffect, useCallback, useMemo, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { Button, DatePicker, Modal, QRCode, Select, Spin, message } from 'antd'
import './index.less'
import { EnvironmentOutlined, ExclamationCircleOutlined, InboxOutlined, SendOutlined } from '@ant-design/icons'
import { type Dayjs } from 'dayjs'
import L7MapView from '@/components/L7MapView'
import FlyListModel from '@/components/MapBox/FlyListModel'
import { leidaList, alarmPointAll, dockList, wrjPatrol, options4leixing, wuranListByLngLat } from '@/servers/mapBox'
import { cities, districts } from '@/utils/city'
import RegionSelector from '@/components/RegionSelector'
import { useAppStore } from '@/stores'
import { toRegionQuery, isBusinessRole } from '@/utils/region'
import { getPerspectiveIcon } from '@/utils/iconPerspective'
import { createRadarScanOverlay, type RadarScanOverlay } from '@/utils/radarScanOverlay'
import { PointLayer, type ILayer, type Scene } from '@antv/l7'
import { isDockDispatchable, normalizeDock, getDockModeColor, type NormalizedDock } from '@/utils/dock'
import type { AlarmItem, PollutionItem, RadarStation } from './shared'
import AlarmPointPopup from './popups/AlarmPointPopup'
import DispatchPointPopup from './popups/DispatchPointPopup'
import CreatePollutionModal from './modals/CreatePollutionModal'
import CreateManualAlertModal, { type ManualAlertInitial } from '@/pages/alert/modals/CreateManualAlertModal'
import { buildDeptRegionOptions } from '@/utils/deptRegion'
import AlarmPointPanel from './panels/AlarmPointPanel'
import MapPanelHeader from '@/components/MapPanelHeader'
import MapPopupPortal from '@/components/MapPopupPortal'
import RadarHeatView from '@/features/radar-heat/RadarHeatView'
import '@/features/radar-heat/index.less'

export default function Radar() {
  const [view, setView] = useState<'alarm'|'heat'>('alarm')
  return <div className="radar-view-container">
    {view === 'alarm' ? <RadarAlarmView/> : <RadarHeatView/>}
    <div className="radar-view-toggle map-overlay-toolbar" role="group" aria-label="雷达地图模式">
      <button aria-pressed={view==='alarm'} onClick={()=>setView('alarm')}>报警点位图</button>
      <button aria-pressed={view==='heat'} onClick={()=>setView('heat')}>浓度热力图</button>
    </div>
  </div>
}

function RadarAlarmView() {
  const navigate = useNavigate()
  const regionContext = useAppStore(state => state.regionContext)
  const querySelection = regionContext?.querySelection
  const mapSelection = regionContext?.mapSelection
  const [wxVisible, setWxVisible] = useState(false)
  const [wxInfo, setWxInfo] = useState<AlarmItem | null>(null)
  const [filterLeixing, setFilterLeixing] = useState('')
  const [modal, contextHolder] = Modal.useModal()
  const [tfList, setTfList] = useState<AlarmItem[]>([])
  const [cgList, setCgList] = useState<AlarmItem[]>([])
  const [alarmLoading, setAlarmLoading] = useState(false)
  const [pollutionList, setPollutionList] = useState<PollutionItem[]>([])
  const [pollutionLoading, setPollutionLoading] = useState(false)
  const [leixingFilters, setLeixingFilters] = useState<{ value: string; label: string }[]>([{ value: '', label: '全部' }])
  const [docks, setDocks] = useState<NormalizedDock[]>([])
  const [radarList, setRadarList] = useState<RadarStation[]>([])
  const [radarLoading, setRadarLoading] = useState(false)
  const [selectedBsiId, setSelectedBsiId] = useState('')
  // 三个快捷时间（近 1/3/24 小时）；custom 表示用日期范围（互斥）
  const [hourRange, setHourRange] = useState<1 | 3 | 24 | 'custom'>(24)
  // 自定义日期范围（包含时间，yyyy-MM-dd HH:mm:ss）
  const [customRange, setCustomRange] = useState<[Dayjs, Dayjs] | null>(null)
  const [sceneReady, setSceneReady] = useState(false)
  const sceneRef = useRef<Scene | null>(null)
  const radarLayersRef = useRef<{ scan: RadarScanOverlay | null; icon: ILayer | null }>({ scan: null, icon: null })
  const highlightLayerRef = useRef<ILayer | null>(null)

  const [flyVisible, setFlyVisible] = useState(false)
  const [flyLngLat, setFlyLngLat] = useState<{ lng: number; lat: number }>({ lng: 0, lat: 0 })
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; lng: number; lat: number; item?: AlarmItem } | null>(null)
  const [manualAlertInitial, setManualAlertInitial] = useState<ManualAlertInitial | null>(null)
  const lastMarkerContextMenuRef = useRef(0)
  const [alarmPopup, setAlarmPopup] = useState<{ item: AlarmItem; x: number; y: number } | null>(null)
  const [dispatchPopup, setDispatchPopup] = useState<{ x: number; y: number; lng: number; lat: number } | null>(null)
  const [createVisible, setCreateVisible] = useState(false)
  const [createInitial, setCreateInitial] = useState<{ weizhi?: string; lng?: number; lat?: number; city?: string; quxian?: string } | null>(null)
  const [pollutionVersion, setPollutionVersion] = useState(0)
  const lastMarkerClickRef = useRef(0)

  useEffect(() => {
    const loadData = async () => {
      if (!querySelection) return
      const params = toRegionQuery(querySelection)
      let list: NormalizedDock[] = []
      try {
        const dockRes = await dockList(params)
        if (dockRes?.resultCode === 0 && Array.isArray(dockRes.data) && dockRes.data.length) {
          list = dockRes.data.map((item: Record<string, unknown>) => normalizeDock(item))
        }
        // 接口返回空或异常：保持空列表，不兜底 mock
      } catch (e) { console.warn('无人机机场列表加载失败', e) }
      setDocks(list)
    }
    loadData()
  }, [querySelection])

  useEffect(() => {
    options4leixing({ type: '0' })
      .then(res => {
        if (res?.resultCode === 0 && Array.isArray(res.data)) {
          setLeixingFilters([{ value: '', label: '全部' }, ...res.data.map((v: string) => ({ value: v, label: v }))])
        }
      })
      .catch(() => {})
  }, [])

  useEffect(() => {
    const radar = radarList.find(item => String(item.bsiId) === String(selectedBsiId))
    if (!radar || !Number.isFinite(radar.bsiLng) || !Number.isFinite(radar.bsiLat)) return
    let cancelled = false
    const regionParams = querySelection ? toRegionQuery(querySelection) : {}
    // 标准的列表数据拉取模式，忽略 set-state-in-effect 规则
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setPollutionLoading(true)
    wuranListByLngLat({ ...regionParams, lat: radar.bsiLat, lng: radar.bsiLng, leixing: filterLeixing, type: '0' })
      .then(res => {
        if (cancelled) return
        const rawList: PollutionItem[] = res?.resultCode === 0 && Array.isArray(res.data) ? res.data : []
        // 后端字段可能为 null（如新增时未表现状/行业），统一兜底空串避免渲染报错
        let list: PollutionItem[] = rawList.map(item => ({
          ...item,
          name: item.name ?? '',
          weizhi: item.weizhi ?? '',
          leixing: item.leixing ?? '',
          hangye: item.hangye ?? '',
          xianzhuang: item.xianzhuang ?? '',
        }))
        // 后端未按区域过滤时的前端兼容过滤：市/区县角色只可见本区域内污染源
        if (querySelection?.cityName || querySelection?.countyName) {
          const normalize = (value?: string) => (value || '').replace(/[市区县]$/, '')
          list = list.filter(item =>
            (!querySelection.cityName || normalize(item.city) === normalize(querySelection.cityName) || (item.weizhi || '').includes(normalize(querySelection.cityName))) &&
            (!querySelection.countyName || normalize(item.quxian) === normalize(querySelection.countyName) || (item.weizhi || '').includes(normalize(querySelection.countyName)))
          )
        }
        setPollutionList(list)
      })
      .catch(e => {
        if (cancelled) return
        console.warn('附近污染源查询失败', e)
        setPollutionList([])
      })
      .finally(() => { if (!cancelled) setPollutionLoading(false) })
    return () => { cancelled = true }
  }, [radarList, selectedBsiId, querySelection, filterLeixing, pollutionVersion])

  // 进入页面查询雷达列表（借鉴原项目 antd-demo）：默认选中第一台雷达，后续自动飞到其位置
  useEffect(() => {
    let cancelled = false
    const params = querySelection ? toRegionQuery(querySelection) : {}
    // 标准的列表数据拉取模式，忽略 set-state-in-effect 规则
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setRadarLoading(true)
    leidaList(params)
      .then(res => {
        if (cancelled) return
        const list: RadarStation[] = (Array.isArray(res?.data) ? res.data : []).filter(
          (item: RadarStation) => Number.isFinite(item?.bsiLng) && Number.isFinite(item?.bsiLat),
        )
        setRadarList(list)
        setSelectedBsiId(list[0] ? String(list[0].bsiId) : '')
        // 无可用雷达时清空污染源列表，避免残留旧数据
        if (!list.length) setPollutionList([])
      })
      .catch(e => console.warn('雷达列表查询失败', e))
      .finally(() => { if (!cancelled) setRadarLoading(false) })
    return () => { cancelled = true }
  }, [querySelection])

  // 按选中雷达查询突发/常规告警点位（hour 随底部时间范围切换，默认 24；结果为空/失败时清空列表，不使用 mock 数据）
  useEffect(() => {
    let cancelled = false
    const buildAlarmParams = () => {
      if (hourRange === 'custom' && customRange) {
        return {
          BsiId: selectedBsiId,
          startTime: customRange[0].format('YYYY-MM-DD HH:mm:ss'),
          endTime: customRange[1].format('YYYY-MM-DD HH:mm:ss'),
        }
      }
      return { BsiId: selectedBsiId, hour: hourRange }
    }
    const loadAlarm = async () => {
      if (!selectedBsiId) {
        setCgList([])
        setTfList([])
        return
      }
      try {
        setAlarmLoading(true)
        const res = await alarmPointAll(buildAlarmParams())
        if (cancelled) return
        const data: AlarmItem[] = res?.resultCode === 0 && Array.isArray(res.data) ? res.data : []
        const cg: AlarmItem[] = []
        const tf: AlarmItem[] = []
        data.forEach((item: AlarmItem) => {
          if (item.type === 1) cg.push(item)
          else if (item.type === 2) tf.push(item)
        })
        setCgList(cg)
        setTfList(tf)
      } catch {
        if (cancelled) return
        setCgList([])
        setTfList([])
      } finally {
        if (!cancelled) setAlarmLoading(false)
      }
    }
    void loadAlarm()
    // 切换雷达后清除旧的定位高亮
    highlightLayerRef.current?.setData({ type: 'FeatureCollection', features: [] })
    return () => { cancelled = true }
  }, [selectedBsiId, hourRange, customRange])

  // 绘制雷达扫描动画 + 图标层（与原项目 showRadar 一致）
  const renderRadarLayers = useCallback(async (scene: Scene, list: RadarStation[]) => {
    if (radarLayersRef.current.scan) { radarLayersRef.current.scan.destroy(); radarLayersRef.current.scan = null }
    if (radarLayersRef.current.icon) { scene.removeLayer(radarLayersRef.current.icon); radarLayersRef.current.icon = null }
    if (!list.length) return
    if (!scene.hasImage('radar-station-icon')) {
      try {
        const warped = await getPerspectiveIcon('/marker/radar-on.png')
        scene.addImage('radar-station-icon', warped)
      } catch {
        await scene.addImage('radar-station-icon', '/marker/radar-on.png')
      }
    }
    const scanLayer = createRadarScanOverlay(
      scene,
      list.map(item => ({ id: item.bsiId, lng: item.bsiLng, lat: item.bsiLat })),
    )
    const iconLayer = new PointLayer({ zIndex: 10, name: 'radar-page-icon-layer', enablePropagation: false, pickingBuffer: 2 })
      .source(list, { parser: { type: 'json', x: 'bsiLng', y: 'bsiLat' } })
      .shape('radar-station-icon')
      .size(24)
    scene.addLayer(iconLayer)
    radarLayersRef.current = { scan: scanLayer, icon: iconLayer }
  }, [])

  // 雷达列表变化 → 重绘雷达图层
  useEffect(() => {
    if (!sceneReady || !sceneRef.current) return
    void renderRadarLayers(sceneRef.current, radarList)
  }, [sceneReady, radarList, renderRadarLayers])

  useEffect(() => () => {
    radarLayersRef.current.scan?.destroy()
    radarLayersRef.current.scan = null
    radarLayersRef.current.icon = null
    highlightLayerRef.current = null
    sceneRef.current = null
  }, [])

  // 选中雷达变化 → 自动飞到雷达位置（原项目 setZoomAndCenter(12, 雷达经纬度)）
  useEffect(() => {
    if (!sceneReady || !sceneRef.current || !selectedBsiId) return
    const target = radarList.find(item => String(item.bsiId) === String(selectedBsiId))
    if (target) sceneRef.current.setZoomAndCenter(12, [target.bsiLng, target.bsiLat])
  }, [sceneReady, radarList, selectedBsiId])

  const showWX = (obj: AlarmItem) => { setWxInfo(obj); setWxVisible(true) }

  // 高亮图层懒创建：首次定位时才 addLayer（与原项目 hightLayer 一致：animate(true) 扩散圆，size 40）
  const ensureHighlightLayer = (scene: Scene) => {
    if (highlightLayerRef.current) return highlightLayerRef.current
    const layer = new PointLayer({ zIndex: 20, name: 'radar-page-highlight-layer', enablePropagation: false, pickingBuffer: 2 })
      .source({ type: 'FeatureCollection', features: [] })
      .shape('circle')
      .animate(true)
      .color('rColor')
      .size(40)
    scene.addLayer(layer)
    highlightLayerRef.current = layer
    return layer
  }

  // 点击列表点位 → 飞到该点并高亮（借鉴原项目 antd-demo：panTo + hightLayer.setData）
  const flyTo = (obj: AlarmItem) => {
    const scene = sceneRef.current
    if (!scene || !Number.isFinite(obj.dapLng) || !Number.isFinite(obj.dapLat)) {
      message.warning('该点位缺少坐标信息，无法定位')
      return
    }
    scene.setZoomAndCenter(14, [obj.dapLng, obj.dapLat])
    const rColor = tfList.some(i => i.address === obj.address && i.dapLng === obj.dapLng) ? '#FF3936' : '#FFB024'
    ensureHighlightLayer(scene).setData([{ ...obj, rColor }], { parser: { type: 'json', x: 'dapLng', y: 'dapLat' } })
    message.info(`定位到: ${obj.address}`)
  }

  const showConfirm = (dockName: string, dockCode: string, obj: AlarmItem) => {
    modal.confirm({
      title: '请确认派遣任务', icon: <ExclamationCircleOutlined className="!text-[#faad14]" />,
      content: `派遣无人机[${dockName}]前往[${obj.address}]？`, okText: '确认', cancelText: '取消',
      onOk: async () => {
        try {
          if (!Number.isFinite(obj.dapLng) || !Number.isFinite(obj.dapLat)) throw new Error('点位缺少有效坐标')
          const response = await wrjPatrol({ dockCode, lng: obj.dapLng, lat: obj.dapLat })
          if (response?.resultCode !== 0) throw new Error(String(response?.message || '派遣请求失败'))
          message.success('派遣请求已受理，请通过飞行任务查看执行状态')
        } catch (error) {
          message.error(error instanceof Error ? error.message : '派遣失败，请稍后重试')
          throw error
        }
      }
    })
  }
  const showTitle = (title: string) => <span className="text-[#A8D6FF]">{title}</span>
  const showContent = (obj: AlarmItem) => (
    <div className="flex flex-col w-290px text-[#A8D6FF] gap-1">
      {docks.length ? docks.map(item => {
        const dispatchable = isDockDispatchable(item)
        return (
          <div key={item.dockCode} className="flex items-center justify-between py-1.5 border-b border-[rgba(255,255,255,0.08)] last:border-b-0">
            <div className="flex items-center gap-1.5 min-w-0 pr-2">
              <span className="text-sm text-[#A8D6FF] truncate">{item.dockName}</span>

              {/* 在线/离线 status Tag：与列表样式保持一致 */}
              <span
                className="text-10px font-medium px-1.5 py-0.2 rounded-full inline-flex items-center gap-1 border shrink-0"
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
                <span className={`w-1.2 h-1.2 rounded-full ${item.online ? 'bg-[#00ff88] shadow-[0_0_5px_#00ff88]' : 'bg-[#94a3b8]'}`} />
                {item.statusText}
              </span>

              {/* modeCode 模式 */}
              <span
                className="text-10px font-medium px-1 py-0.2 rounded border shrink-0"
                style={{
                  color: getDockModeColor(item.modeCode),
                  borderColor: `${getDockModeColor(item.modeCode)}55`,
                  backgroundColor: `${getDockModeColor(item.modeCode)}20`,
                }}
              >
                {item.modeLabel}
              </span>
            </div>

            {/* 选择按钮：非在线且空闲时 disabled 禁用 */}
            <Button
              size="small"
              disabled={!dispatchable}
              className="!text-[#01C2FF] !border-[#6788AF] !bg-[rgba(255,255,255,0.1)] !rounded-full shrink-0 disabled:!text-[rgba(255,255,255,0.3)] disabled:!border-[rgba(255,255,255,0.15)] disabled:!bg-[rgba(255,255,255,0.05)] disabled:!cursor-not-allowed"
              onClick={() => showConfirm(item.dockName, item.dockCode, obj)}
            >
              选择
            </Button>
          </div>
        )
      }) : (
        <div className="py-3 flex flex-col items-center gap-1">
          <InboxOutlined className="text-24px text-[#A8D6FF]/45" />
          <span className="text-12px text-[#A8D6FF]/60">当前区域暂无可用无人机机场</span>
        </div>
      )}
    </div>
  )

  // 点击地图告警点位 → 弹窗“是否确认为污染源”（对齐 antd-demo LayerPopup 交互）
  const handleMarkerClick = useCallback((feature: Record<string, unknown>, pos: { x: number; y: number }) => {
    lastMarkerClickRef.current = Date.now()
    const item: AlarmItem = {
      dapLng: Number(feature.lng),
      dapLat: Number(feature.lat),
      address: String(feature.name ?? ''),
      times: Number(feature.times) || 0,
      type: Number(feature.alarmType) || 1,
    }
    if (!Number.isFinite(item.dapLng) || !Number.isFinite(item.dapLat)) return
    setDispatchPopup(null)
    setContextMenu(null)
    setAlarmPopup({ item, x: pos.x, y: pos.y })
  }, [])

  const handleMarkerContextMenu = useCallback((feature: Record<string, unknown>, pos: { x: number; y: number }) => {
    const lng = Number(feature.lng)
    const lat = Number(feature.lat)
    if (!Number.isFinite(lng) || !Number.isFinite(lat)) return
    lastMarkerContextMenuRef.current = Date.now()
    const [width, height] = sceneRef.current?.getSize() ?? [1920, 1080]
    setAlarmPopup(null)
    setDispatchPopup(null)
    setContextMenu({
      x: Math.max(0, Math.min(pos.x, width - 180)), y: Math.max(0, Math.min(pos.y, height - 94)), lng, lat,
      item: { dapLng: lng, dapLat: lat, address: String(feature.name ?? ''), times: Number(feature.times) || 0, type: Number(feature.alarmType) || 1 },
    })
  }, [])

  const createManualAlert = (item: AlarmItem) => {
    const radar = radarList.find(station => String(station.bsiId) === selectedBsiId)
    const regions = buildDeptRegionOptions(regionContext?.departments ?? [])
    // 地址能确认归属时才回填，不把地图当前筛选区域当作点位归属。
    const city = regions.cityOptions.find(option => item.address.includes(option.label))
    const districtMatches = regions.cityOptions.flatMap(option => regions.getDistrictOptions(option.value)
      .filter(district => item.address.includes(district.label)).map(district => ({ city: option, district })))
    const match = districtMatches.length === 1 ? districtMatches[0] : undefined
    const cityId = match?.city.value ?? city?.value
    const districtId = match?.district.value
    const town = regions.getTownOptions(districtId).find(option => item.address.includes(option.label))
    setManualAlertInitial({
      dataType: 'radar_station', deviceId: radar ? String(radar.bsiId) : undefined,
      deviceName: radar?.bsiName,
      lng: item.dapLng, lat: item.dapLat,
      cityId: cityId ? Number(cityId) : undefined, districtId: districtId ? Number(districtId) : undefined,
      townId: town ? Number(town.value) : undefined,
      triggerReason: `雷达${item.type === 2 ? '突发' : '常规'}点位，监测时段内报警 ${item.times} 次，手动发起预警。`,
    })
    setContextMenu(null)
  }

  // 确认为污染源 → 打开新建污染源弹窗并预填经纬度与地址（对齐 antd-demo setToSource → ppObj → CreateModel）
  const confirmAsPollution = (item: AlarmItem) => {
    setAlarmPopup(null)
    setCreateInitial({
      weizhi: item.address,
      lng: item.dapLng,
      lat: item.dapLat,
      city: mapSelection?.cityName,
      quxian: mapSelection?.countyName,
    })
    setCreateVisible(true)
  }

  // 地图右键 → 显示上下文菜单（无人机派遣入口）；左键空白 → 派遣无人机弹窗
  const handleSceneLoaded = useCallback((scene: Scene) => {
    sceneRef.current = scene
    setSceneReady(true)
    // 左键点击地图空白处 → 派遣无人机弹窗（对齐 antd-demo showFlyPopup；刚点击过告警点位时跳过）
    scene.on('click', (ev: any) => {
      if (Date.now() - lastMarkerClickRef.current < 300) return
      if (!ev?.lngLat || typeof ev.x !== 'number' || typeof ev.y !== 'number') return
      setAlarmPopup(null)
      setContextMenu(null)
      setDispatchPopup({ x: ev.x, y: ev.y, lng: ev.lngLat.lng, lat: ev.lngLat.lat })
    })
    // 阻止地图默认右键菜单
    scene.on('contextmenu', (ev: any) => {
      ev.originalEvent?.preventDefault()
      // 阻止事件冒泡到 window 的 contextmenu 监听，避免菜单刚打开就被关闭
      ev.originalEvent?.stopPropagation()
      if (Date.now() - lastMarkerContextMenuRef.current < 300) return
      setAlarmPopup(null)
      setDispatchPopup(null)
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
    const closeContextMenu = () => { if (Date.now() - lastMarkerContextMenuRef.current >= 300) close() }
    window.addEventListener('contextmenu', closeContextMenu)
    return () => { window.removeEventListener('click', close); window.removeEventListener('contextmenu', closeContextMenu) }
  }, [])

  // 点击污染源卡片 → 地图定位到该污染源（原项目 rightBar：panTo）
  const locatePollution = (item: PollutionItem) => {
    const scene = sceneRef.current
    if (!scene || !Number.isFinite(item.lng) || !Number.isFinite(item.lat)) {
      message.warning('该污染源缺少坐标信息，无法定位')
      return
    }
    scene.setZoomAndCenter(14, [item.lng, item.lat])
  }

  const markers = useMemo(
    () => [
      ...tfList.map((i) => ({
        lng: i.dapLng,
        lat: i.dapLat,
        name: i.address,
        color: '#FF3936',
        size: 11,
        times: i.times,
        alarmType: i.type,
      })),
      ...cgList.map((i) => ({
        lng: i.dapLng,
        lat: i.dapLat,
        name: i.address,
        color: '#FFB024',
        size: 10,
        times: i.times,
        alarmType: i.type,
      })),
    ],
    [tfList, cgList],
  )
  const mapCounty = districts.find(item => String(item.adcode) === mapSelection?.countyCode)
  const mapCity = cities.find(item => item.adcode === mapSelection?.cityCode)
  const mapCenter: [number, number] = mapCounty
    ? [mapCounty.lng, mapCounty.lat]
    : mapCity
      ? [mapCity.lng, mapCity.lat]
      : [120.582886, 29.991549]
  const mapZoom = mapCounty ? 11 : mapCity ? 9 : 7.5

  return (
    <div className="map-screen w-full h-full relative overflow-hidden" style={{ background: '#1a5ab0' }}>
      <L7MapView id="radar-map" center={mapCenter} zoom={mapZoom} minZoom={6} maxZoom={14} showTiles markers={markers} onSceneLoaded={handleSceneLoaded} onMarkerClick={handleMarkerClick} onMarkerContextMenu={handleMarkerContextMenu} />
      {/* 顶部选择器 */}
      <div className="map-overlay-toolbar map-top-controls">
        <RegionSelector />
        <Select
          value={selectedBsiId || undefined}
          onChange={(value: string) => setSelectedBsiId(value)}
          placeholder="全部雷达"
          allowClear
          loading={radarLoading}
          className="w-150px screen-select"
          classNames={{ popup: { root: 'screen-select-popup' } }}
          size="small"
          options={radarList.map(item => ({ value: String(item.bsiId), label: item.bsiName || String(item.bsiId) }))}
        />
      </div>
      {/* 左侧 - 突发/常规点位 */}
      <div className="absolute left-16px top-10px bottom-10px z-50 w-330px flex flex-col gap-3 pointer-events-none">
        <AlarmPointPanel
          title="突发点位"
          subtitle="高频异常点位，建议优先处置"
          items={tfList}
          urgent
          loading={alarmLoading}
          hourRange={typeof hourRange === 'number' ? hourRange : undefined}
          onLocate={flyTo}
          onShare={showWX}
          dispatchContent={showContent}
          dispatchTitle={showTitle}
        />
        <AlarmPointPanel
          title="常规点位"
          subtitle="持续关注的例行监测点位"
          items={cgList}
          loading={alarmLoading}
          hourRange={typeof hourRange === 'number' ? hourRange : undefined}
          onLocate={flyTo}
          onShare={showWX}
          dispatchContent={showContent}
          dispatchTitle={showTitle}
        />
      </div>
      {/* 右侧 - 污染源管理 */}
      <div className="absolute right-16px top-10px bottom-10px z-50 w-330px pointer-events-none">
        <div className="screen-glass-panel h-full px-3 py-2.5 flex flex-col">
          <MapPanelHeader title="污染源管理" subtitle={`当前雷达附近共 ${pollutionList.length} 个污染源`} extra={
            <Select value={filterLeixing} onChange={setFilterLeixing} className="w-100px pointer-events-auto screen-select" classNames={{ popup: { root: 'screen-select-popup' } }} size="small" options={leixingFilters} />
          } />
          <div className="flex-1 min-h-0 overflow-y-auto pointer-events-auto py-1 space-y-2 pr-0.5">
            {pollutionLoading && (
              <div className="h-full flex flex-col items-center justify-center gap-2 text-[#c5e5ff]/50">
                <Spin size="small" />
                <span className="text-12px">附近污染源加载中…</span>
              </div>
            )}
            {!pollutionLoading && pollutionList.length === 0 && (
              <div className="h-full flex flex-col items-center justify-center gap-2 text-[#c5e5ff]/50">
                <InboxOutlined className="text-28px" />
                <span className="text-12px">当前雷达附近暂无污染源数据</span>
              </div>
            )}
            {pollutionList.map((item, idx) => (
              <article key={`${item.name}-${idx}`} className="rounded-11px border border-[rgba(133,213,255,0.17)] px-3 py-2.5 cursor-pointer bg-[rgba(17,91,167,0.5)] hover:bg-[rgba(27,112,191,0.68)] hover:border-[rgba(116,226,255,0.42)] transition-all" onClick={() => locatePollution(item)}>
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0 text-13px text-[#edf8ff] font-600 truncate">{item.name || '--'}</div>
                  {item.xianzhuang && (
                    <span className={`shrink-0 rounded-full px-2 py-0.5 text-9px ${item.xianzhuang.includes('停产') ? 'text-[#ffb36b] bg-[rgba(255,154,74,0.14)]' : 'text-[#66f0b3] bg-[rgba(45,221,152,0.13)]'}`}>{item.xianzhuang}</span>
                  )}
                </div>
                <div className="mt-1.5 flex items-start gap-1.5 text-10px text-[#c9e4f8]/64"><EnvironmentOutlined className="mt-0.5 text-[#71eaff]" /><span className="leading-15px line-clamp-2">{item.weizhi || '--'}</span></div>
                {(item.leixing || item.hangye) && (
                  <div className="flex items-center gap-1.5 mt-2">
                    {item.leixing && <span className="rounded-5px px-2 py-0.5 text-9px text-[#9cefff] bg-[rgba(54,200,234,0.1)] border border-[rgba(89,215,245,0.22)]">{item.leixing}</span>}
                    {item.hangye && <span className="rounded-5px px-2 py-0.5 text-9px text-[#d9bdff] bg-[rgba(174,105,233,0.1)] border border-[rgba(188,125,242,0.22)]">{item.hangye}</span>}
                  </div>
                )}
              </article>
            ))}
          </div>
          {/* 业务角色无污染源管理页权限，隐藏管理/新增入口 */}
          {!isBusinessRole(regionContext) && (
            <div className="flex items-center justify-between gap-2 pt-2 mt-1 border-t border-[rgba(137,219,255,0.16)] pointer-events-auto">
              <Button className="!flex-1 !rounded-full !text-[#8aefff] !border-[rgba(98,220,255,0.38)] !bg-[rgba(58,186,224,0.08)]" onClick={() => navigate('/pollution')}>管理污染源</Button>
              <Button type="primary" className="!flex-1 !rounded-full" onClick={() => navigate('/pollution')}>新增污染源</Button>
            </div>
          )}
        </div>
      </div>
      {/* 底部时间选择：3 个快捷按钮 + 1 个日期范围（互斥）。选了快捷按钮则清空日期范围；选了日期范围则不传 hour。 */}
      <div className="map-overlay-toolbar map-bottom-controls radar-time-controls">
        <span className="text-[#A0C7FF] text-12px whitespace-nowrap">时间范围</span>
        {([1, 3, 24] as const).map(h => (
          <Button
            key={h}
            size="small"
            onClick={() => {
              setHourRange(h)
              setCustomRange(null)
            }}
            className={hourRange === h
              ? '!text-[#D5F9F9] !border-[#01C2FF] !bg-[#01C2FF] font-600'
              : '!text-[#D5F9F9] !border-[#6788AF]'}
          >
            近{h}小时
          </Button>
        ))}
        <DatePicker.RangePicker
          size="small"
          showTime={{ format: 'HH:mm:ss' }}
          format="YYYY-MM-DD HH:mm:ss"
          value={customRange}
          onChange={(values) => {
            if (values && values[0] && values[1]) {
              setCustomRange([values[0], values[1]])
              setHourRange('custom')
            } else {
              setCustomRange(null)
              // 清空日期范围时回退到默认 24 小时
              setHourRange(24)
            }
          }}
          placeholder={['开始时间', '结束时间']}
          className="!w-380px radar-time-range-picker screen-range-picker"
          allowClear
        />
      </div>
      {/* 二维码弹窗 */}
      <Modal open={wxVisible} onCancel={() => setWxVisible(false)} footer={null} title={null} width={380}>
        <div className="text-center">
          <div className="text-[#D5F9F9] text-18px mb-3">扫码分享报警位置</div>
          <div className="flex justify-center py-2"><QRCode value={`http://wb.amap.com/?q=${wxInfo?.dapLat},${wxInfo?.dapLng}`} size={160} /></div>
          <div className="text-[#D5F9F9] text-14px mt-2">{wxInfo?.address}</div>
          <div className="text-left mt-3 space-y-1 text-13px"><p><span className="text-[#76FFFF]">经度：</span><span className="text-[#D5F9F9]">{wxInfo?.dapLng}</span></p><p><span className="text-[#76FFFF]">纬度：</span><span className="text-[#D5F9F9]">{wxInfo?.dapLat}</span></p></div>
        </div>
      </Modal>
      {/* 右键上下文菜单 - 无人机派遣 */}
      {contextMenu && (
        <MapPopupPortal>
        <div
          className="map-point-popup absolute min-w-150px rounded-lg shadow-xl overflow-hidden"
          style={{ left: contextMenu.x, top: contextMenu.y, background: 'rgba(4,22,52,0.95)', border: '1px solid rgba(0,180,255,0.35)', backdropFilter: 'blur(8px)' }}
          onClick={(e) => e.stopPropagation()}
        >
          {contextMenu.item && <button type="button"
            className="w-full flex items-center gap-2 px-4 py-2.5 cursor-pointer text-[#A8D6FF] text-13px bg-transparent border-0 hover:bg-[rgba(1,194,255,0.15)]"
            onClick={() => createManualAlert(contextMenu.item!)}>
            <ExclamationCircleOutlined className="text-[#01C2FF]" />新增手动预警
          </button>}
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
      {/* 告警点位点击弹窗：是否确认为污染源（对齐 antd-demo LayerPopup） */}
      {alarmPopup && (
        <MapPopupPortal>
        <AlarmPointPopup popup={alarmPopup} onCancel={() => setAlarmPopup(null)} onConfirm={confirmAsPollution} />
        </MapPopupPortal>
      )}
      {/* 地图空白处点击弹窗：派遣无人机（对齐 antd-demo showFlyPopup） */}
      {dispatchPopup && (
        <MapPopupPortal>
        <DispatchPointPopup
          popup={dispatchPopup}
          onDispatch={lngLat => {
            setFlyLngLat(lngLat)
            setDispatchPopup(null)
            setFlyVisible(true)
          }}
        />
        </MapPopupPortal>
      )}
      {/* 新建污染源弹窗（告警点确认后预填坐标打开） */}
      <CreatePollutionModal
        open={createVisible}
        initial={createInitial}
        leixingOptions={leixingFilters.filter(item => item.value)}
        onClose={() => setCreateVisible(false)}
        onCreated={() => setPollutionVersion(version => version + 1)}
      />
      {/* 派遣无人机巡逻弹窗（右键菜单/地图点击弹窗触发） */}
      {flyVisible && (
        <FlyListModel
          visible={flyVisible}
          setVisible={setFlyVisible}
          curCity={mapSelection?.cityCode || ''}
          curDistrict={mapSelection?.countyCode || ''}
          lngLat={flyLngLat}
        />
      )}
      {manualAlertInitial && <CreateManualAlertModal initial={manualAlertInitial} onClose={() => setManualAlertInitial(null)} />}
      {contextHolder}
    </div>
  )
}

import { useState, useEffect, useCallback, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { Button, Select, Modal, Popover, QRCode, message } from 'antd'
import { ArrowLeftOutlined, EnvironmentOutlined, ExclamationCircleOutlined, InboxOutlined, SendOutlined, WarningFilled } from '@ant-design/icons'
import L7MapView from '@/components/L7MapView'
import FlyListModel from '@/components/MapBox/FlyListModel'
import { leidaList, alarmPointAll, dockList, options4leixing, wuranListByLngLat } from '@/servers/mapBox'
import { cities, districts } from '@/utils/city'
import RegionSelector from '@/components/RegionSelector'
import { useAppStore } from '@/stores'
import { toRegionQuery, isBusinessRole } from '@/utils/region'
import { getPerspectiveIcon } from '@/utils/iconPerspective'
import { createRadarScanOverlay, type RadarScanOverlay } from '@/utils/radarScanOverlay'
import { PointLayer, type ILayer, type Scene } from '@antv/l7'

interface AlarmItem { dapLat: number; dapLng: number; times: number; address: string; type: number }
interface PollutionItem { name: string; weizhi: string; leixing: string; hangye: string; xianzhuang: string; lng: number; lat: number; city?: string; quxian?: string }
interface RadarStation { bsiId: string; bsiName: string; bsiLng: number; bsiLat: number; bsiLocation?: string; status?: string }

const mockDocks = [
  { dockName: '临平交通-塘栖机场', dockCode: 'DOCK001' },
  { dockName: '良渚街道综合信息指挥室', dockCode: 'DOCK002' },
]

interface AlarmPointPanelProps {
  title: string
  subtitle: string
  items: AlarmItem[]
  urgent?: boolean
  onLocate: (item: AlarmItem) => void
  onShare: (item: AlarmItem) => void
  dispatchContent: (item: AlarmItem) => React.ReactNode
  dispatchTitle: (title: string) => React.ReactNode
}

function AlarmPointPanel({
  title,
  subtitle,
  items,
  urgent = false,
  onLocate,
  onShare,
  dispatchContent,
  dispatchTitle,
}: AlarmPointPanelProps) {
  const accent = urgent ? '#ff7272' : '#ffd45c'
  return (
    <section
      className="flex-1 min-h-0 rounded-16px border px-3 py-2.5 overflow-hidden flex flex-col"
      style={{
        background: 'linear-gradient(145deg, rgba(6,64,137,0.94), rgba(4,48,111,0.9))',
        borderColor: 'rgba(112,211,255,0.35)',
        boxShadow: 'inset 0 0 22px rgba(69,184,255,0.08)',
      }}
    >
      <header className="flex items-center justify-between pb-2 mb-1 border-b border-[rgba(137,219,255,0.2)]">
        <div>
          <div className="flex items-center gap-2 text-[#edfaff] text-15px font-700">
            <WarningFilled style={{ color: accent }} />
            <span>{title}</span>
          </div>
          <div className="mt-0.5 pl-22px text-9px text-[#c5e5ff]/52">{subtitle}</div>
        </div>
        <span className="min-w-26px h-22px px-2 rounded-full flex items-center justify-center text-11px font-mono font-700" style={{ color: accent, background: `${accent}1f`, border: `1px solid ${accent}55` }}>{items.length}</span>
      </header>
      <div className="flex-1 min-h-0 overflow-y-auto pointer-events-auto space-y-1.5 pt-1 pr-0.5">
        {items.map((item, idx) => (
          <article
            key={`${item.address}-${idx}`}
            className="rounded-10px border border-[rgba(133,213,255,0.16)] px-2.5 py-2 bg-[rgba(17,91,167,0.52)] hover:bg-[rgba(27,112,191,0.68)] hover:border-[rgba(116,226,255,0.42)] transition-all"
          >
            <div className="flex items-start justify-between gap-2">
              <button type="button" onClick={() => onLocate(item)} className="min-w-0 text-left flex-1 cursor-pointer">
                <div className="text-[#edf8ff] text-12px font-600 leading-17px truncate">{item.address}</div>
                <div className="mt-0.5 text-9px text-[#bdddf8]/52">最近 24 小时监测</div>
              </button>
              <div className="shrink-0 flex items-baseline gap-1 rounded-7px px-2 py-1 bg-[rgba(3,42,98,0.38)]">
                <span className="text-15px font-mono font-800" style={{ color: accent }}>{item.times}</span>
                <span className="text-8px text-[#c8e4fa]/55">次</span>
              </div>
            </div>
            <div className="flex items-center gap-1.5 mt-1.5">
              <Button size="small" icon={<EnvironmentOutlined />} onClick={() => onShare(item)} className="!h-23px !px-2 !text-10px !text-[#8aefff] !border-[rgba(98,220,255,0.38)] !bg-[rgba(58,186,224,0.08)]">分享位置</Button>
              <Popover content={dispatchContent(item)} title={dispatchTitle(item.address)} placement="right" trigger="click" styles={{ container: { backgroundColor: 'rgba(5,60,130,0.97)' } }}>
                <Button size="small" icon={<SendOutlined />} className="!h-23px !px-2 !text-10px !text-[#f1d6ff] !border-[rgba(197,137,255,0.4)] !bg-[rgba(166,91,224,0.08)]">派遣无人机</Button>
              </Popover>
            </div>
          </article>
        ))}
      </div>
    </section>
  )
}

export default function Radar() {
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
  const [pollutionList, setPollutionList] = useState<PollutionItem[]>([])
  // 污染源类型筛选（与原项目一致：options4leixing 接口动态获取）
  const [leixingFilters, setLeixingFilters] = useState<{ value: string; label: string }[]>([{ value: '', label: '全部' }])
  const [docks, setDocks] = useState(mockDocks)
  // 雷达列表与当前选中雷达（借鉴原项目：进页查雷达列表并自动飞到雷达位置）
  const [radarList, setRadarList] = useState<RadarStation[]>([])
  const [selectedBsiId, setSelectedBsiId] = useState('')
  const [sceneReady, setSceneReady] = useState(false)
  const sceneRef = useRef<Scene | null>(null)
  const radarLayersRef = useRef<{ scan: RadarScanOverlay | null; icon: ILayer | null }>({ scan: null, icon: null })
  // 定位高亮图层（借鉴原项目：点击列表点位后在该点绘制扩散动画圆）
  const highlightLayerRef = useRef<ILayer | null>(null)

  // 派遣无人机巡逻（右键菜单）
  const [flyVisible, setFlyVisible] = useState(false)
  const [flyLngLat, setFlyLngLat] = useState<{ lng: number; lat: number }>({ lng: 0, lat: 0 })
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; lng: number; lat: number } | null>(null)

  // 加载无人机场数据（突发/常规点位由选中雷达的 alarmPoint 查询驱动，见下方 useEffect）
  useEffect(() => {
    const loadData = async () => {
      if (!querySelection) return
      const params = toRegionQuery(querySelection)
      const isHangzhouScope = !querySelection.cityName || querySelection.cityName === '杭州市'
      setDocks(isHangzhouScope && !querySelection.countyName ? mockDocks : [])
      try {
        const dockRes = await dockList(params)
        if (dockRes?.resultCode === 0 && Array.isArray(dockRes.data) && dockRes.data.length) {
          setDocks(dockRes.data)
        }
      } catch (e) { console.warn('无人机API不可用，使用mock', e) }
    }
    loadData()
  }, [querySelection])

  // 污染源类型选项（原项目 rightBar：options4leixing({type:'0'}) 前置“全部”）
  useEffect(() => {
    options4leixing({ type: '0' })
      .then(res => {
        if (res?.resultCode === 0 && Array.isArray(res.data)) {
          setLeixingFilters([{ value: '', label: '全部' }, ...res.data.map((v: string) => ({ value: v, label: v }))])
        }
      })
      .catch(() => { /* 类型接口不可用时保留默认“全部” */ })
  }, [])

  // 污染源列表（原项目：按选中雷达经纬度查附近污染源 wuranListByLngLat；新版本权限改造：
  // 附带当前角色区域参数限制可见范围，并在前端按 querySelection 兼容过滤，切换雷达/区域/类型时重查）
  useEffect(() => {
    const radar = radarList.find(item => String(item.bsiId) === String(selectedBsiId))
    if (!radar || !Number.isFinite(radar.bsiLng) || !Number.isFinite(radar.bsiLat)) return
    let cancelled = false
    const regionParams = querySelection ? toRegionQuery(querySelection) : {}
    wuranListByLngLat({ ...regionParams, lat: radar.bsiLat, lng: radar.bsiLng, leixing: filterLeixing, type: '0' })
      .then(res => {
        if (cancelled) return
        let list: PollutionItem[] = res?.resultCode === 0 && Array.isArray(res.data) ? res.data : []
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
    return () => { cancelled = true }
  }, [radarList, selectedBsiId, querySelection, filterLeixing])

  // 进入页面查询雷达列表（借鉴原项目 antd-demo）：默认选中第一台雷达，后续自动飞到其位置
  useEffect(() => {
    let cancelled = false
    const params = querySelection ? toRegionQuery(querySelection) : {}
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
    return () => { cancelled = true }
  }, [querySelection])

  // 按选中雷达查询突发/常规告警点位（与 monitor 统一默认 hour=24；结果为空/失败时清空列表，不使用 mock 数据）
  useEffect(() => {
    let cancelled = false
    const loadAlarm = async () => {
      if (!selectedBsiId) {
        setCgList([])
        setTfList([])
        return
      }
      try {
        const res = await alarmPointAll({ BsiId: selectedBsiId, hour: 24 })
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
      }
    }
    void loadAlarm()
    // 切换雷达后清除旧的定位高亮
    highlightLayerRef.current?.setData({ type: 'FeatureCollection', features: [] })
    return () => { cancelled = true }
  }, [selectedBsiId])

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
    const rColor = tfList.some(i => i.address === obj.address && i.dapLng === obj.dapLng) ? '#FFB024' : '#FF3936'
    ensureHighlightLayer(scene).setData([{ ...obj, rColor }], { parser: { type: 'json', x: 'dapLng', y: 'dapLat' } })
    message.info(`定位到: ${obj.address}`)
  }

  const showConfirm = (dockName: string, dockCode: string, obj: AlarmItem) => {
    modal.confirm({
      title: '请确认派遣任务', icon: <ExclamationCircleOutlined className="!text-[#faad14]" />,
      content: `派遣无人机[${dockName}]前往[${obj.address}]？`, okText: '确认', cancelText: '取消',
      onOk: () => message.success('派遣成功！无人机正在起飞...')
    })
  }
  const showTitle = (title: string) => <span className="text-[#A8D6FF]">{title}</span>
  const showContent = (obj: AlarmItem) => (
    <div className="flex-col w-260px text-[#A8D6FF]">
      {docks.length ? docks.map(item => (
        <div key={item.dockCode} className="flex items-center justify-between py-1">
          <span className="text-sm">{item.dockName}</span>
          <Button size="small" className="!text-[#01C2FF] !border-[#6788AF] !bg-[rgba(255,255,255,0.1)] !rounded-full" onClick={() => showConfirm(item.dockName, item.dockCode, obj)}>选择</Button>
        </div>
      )) : (
        <div className="py-3 flex flex-col items-center gap-1">
          <InboxOutlined className="text-24px text-[#A8D6FF]/45" />
          <span className="text-12px text-[#A8D6FF]/60">当前区域暂无可用无人机机场</span>
        </div>
      )}
    </div>
  )

  // 地图右键 → 显示上下文菜单（无人机派遣入口）
  const handleSceneLoaded = useCallback((scene: Scene) => {
    sceneRef.current = scene
    setSceneReady(true)
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

  // 点击污染源卡片 → 地图定位到该污染源（原项目 rightBar：panTo）
  const locatePollution = (item: PollutionItem) => {
    const scene = sceneRef.current
    if (!scene || !Number.isFinite(item.lng) || !Number.isFinite(item.lat)) {
      message.warning('该污染源缺少坐标信息，无法定位')
      return
    }
    scene.setZoomAndCenter(14, [item.lng, item.lat])
  }

  const markers = [
    ...tfList.map(i => ({ lng: i.dapLng, lat: i.dapLat, name: i.address, color: '#FFB024', size: 14 })),
    ...cgList.map(i => ({ lng: i.dapLng, lat: i.dapLat, name: i.address, color: '#FF3936', size: 10 })),
  ]
  const mapCounty = districts.find(item => String(item.adcode) === mapSelection?.countyCode)
  const mapCity = cities.find(item => item.adcode === mapSelection?.cityCode)
  const mapCenter: [number, number] = mapCounty
    ? [mapCounty.lng, mapCounty.lat]
    : mapCity
      ? [mapCity.lng, mapCity.lat]
      : [120.582886, 29.991549]
  const mapZoom = mapCounty ? 11 : mapCity ? 9 : 7.5

  return (
    <div className="w-full h-full relative overflow-hidden" style={{ background: '#1a5ab0' }}>
      <L7MapView id="radar-map" center={mapCenter} zoom={mapZoom} minZoom={6} maxZoom={14} showTiles markers={markers} onSceneLoaded={handleSceneLoaded} />
      {/* 返回按钮 */}
      <div className="absolute top-15px left-20px z-50">
        <Button type="text" icon={<ArrowLeftOutlined />} onClick={() => navigate('/monitor')} className="!text-[#03FBFD] !bg-[rgba(255,255,255,0.1)] hover:!bg-[rgba(255,255,255,0.2)] !rounded-2xl">返回监控大屏</Button>
      </div>
      {/* 顶部选择器 */}
      <div className="absolute top-45px left-1/2 -translate-x-1/2 z-50 flex gap-2 bg-[rgba(0,56,129,0.8)] px-4 py-2 rounded-xl border border-[rgba(255,255,255,0.3)]">
        <RegionSelector />
        <Select
          value={selectedBsiId || undefined}
          onChange={(value: string) => setSelectedBsiId(value)}
          placeholder="全部雷达"
          allowClear
          className="w-150px screen-select"
          classNames={{ popup: { root: 'screen-select-popup' } }}
          size="small"
          options={radarList.map(item => ({ value: String(item.bsiId), label: item.bsiName || String(item.bsiId) }))}
        />
      </div>
      {/* 左侧 - 突发/常规点位 */}
      <div className="absolute left-20px top-70px bottom-58px z-50 w-360px flex flex-col gap-3 pointer-events-none">
        <AlarmPointPanel
          title="突发点位"
          subtitle="高频异常点位，建议优先处置"
          items={tfList}
          urgent
          onLocate={flyTo}
          onShare={showWX}
          dispatchContent={showContent}
          dispatchTitle={showTitle}
        />
        <AlarmPointPanel
          title="常规点位"
          subtitle="持续关注的例行监测点位"
          items={cgList}
          onLocate={flyTo}
          onShare={showWX}
          dispatchContent={showContent}
          dispatchTitle={showTitle}
        />
      </div>
      {/* 右侧 - 污染源管理 */}
      <div className="absolute right-20px top-70px bottom-58px z-50 w-360px pointer-events-none">
        <div className="h-full rounded-16px border border-[rgba(112,211,255,0.35)] px-3 py-2.5 flex flex-col bg-[linear-gradient(145deg,rgba(6,64,137,0.94),rgba(4,48,111,0.9))] shadow-[inset_0_0_22px_rgba(69,184,255,0.08)]">
          <div className="flex items-center justify-between pb-2 mb-1 border-b border-[rgba(137,219,255,0.2)]">
            <div>
              <div className="text-[#edfaff] text-15px font-700">污染源管理</div>
              <div className="text-9px text-[#c5e5ff]/52 mt-0.5">当前雷达附近共 {pollutionList.length} 个污染源</div>
            </div>
            <Select value={filterLeixing} onChange={setFilterLeixing} className="w-100px pointer-events-auto screen-select" classNames={{ popup: { root: 'screen-select-popup' } }} size="small" options={leixingFilters} />
          </div>
          <div className="flex-1 min-h-0 overflow-y-auto pointer-events-auto py-1 space-y-2 pr-0.5">
            {pollutionList.length === 0 && (
              <div className="h-full flex flex-col items-center justify-center gap-2 text-[#c5e5ff]/50">
                <InboxOutlined className="text-28px" />
                <span className="text-12px">当前雷达附近暂无污染源数据</span>
              </div>
            )}
            {pollutionList.map((item, idx) => (
              <article key={`${item.name}-${idx}`} className="rounded-11px border border-[rgba(133,213,255,0.17)] px-3 py-2.5 cursor-pointer bg-[rgba(17,91,167,0.5)] hover:bg-[rgba(27,112,191,0.68)] hover:border-[rgba(116,226,255,0.42)] transition-all" onClick={() => locatePollution(item)}>
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0 text-13px text-[#edf8ff] font-600 truncate">{item.name}</div>
                  <span className={`shrink-0 rounded-full px-2 py-0.5 text-9px ${item.xianzhuang.includes('停产') ? 'text-[#ffb36b] bg-[rgba(255,154,74,0.14)]' : 'text-[#66f0b3] bg-[rgba(45,221,152,0.13)]'}`}>{item.xianzhuang}</span>
                </div>
                <div className="mt-1.5 flex items-start gap-1.5 text-10px text-[#c9e4f8]/64"><EnvironmentOutlined className="mt-0.5 text-[#71eaff]" /><span className="leading-15px line-clamp-2">{item.weizhi}</span></div>
                <div className="flex items-center gap-1.5 mt-2">
                  <span className="rounded-5px px-2 py-0.5 text-9px text-[#9cefff] bg-[rgba(54,200,234,0.1)] border border-[rgba(89,215,245,0.22)]">{item.leixing}</span>
                  <span className="rounded-5px px-2 py-0.5 text-9px text-[#d9bdff] bg-[rgba(174,105,233,0.1)] border border-[rgba(188,125,242,0.22)]">{item.hangye}</span>
                </div>
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
      {/* 底部时间选择 */}
      <div className="absolute bottom-58px left-1/2 -translate-x-1/2 z-50 bg-[rgba(0,56,129,0.8)] px-4 py-2 rounded-xl border border-[rgba(255,255,255,0.3)] flex items-center gap-3">
        <span className="text-[#A0C7FF] text-12px">时间范围</span>
        <Button size="small" className="!text-[#01C2FF] !border-[#6788AF]">近1小时</Button>
        <Button size="small" className="!text-[#01C2FF] !border-[#6788AF]">近3小时</Button>
        <Button size="small" className="!text-[#01C2FF] !border-[#6788AF]">近24小时</Button>
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
      {contextHolder}
    </div>
  )
}

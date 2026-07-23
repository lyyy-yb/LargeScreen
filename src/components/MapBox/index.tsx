import { useEffect, useRef, useState } from 'react'
import { Scene, RasterLayer, PointLayer, LayerPopup, Popup, ILayer } from '@antv/l7'
import { Map as L7Map } from '@antv/l7-maps'
import { useAppStore } from '@/stores/useAppStore'
import { leidaList, alarmPointAll, dockList, wuranList } from '@/servers/mapBox'
import { cities, districts } from '@/utils/city'
import { wuLeixingObj, customDiv, customLeiDiv } from '@/utils/assemble'
import FlyListModel from './FlyListModel'

// Mock数据（API不可用时回退）
const mockRadarList = [
  { bsiId: 'R001', bsiName: '西湖雷达站', bsiLocation: '西湖区文三路', bsiLng: 120.130, bsiLat: 30.259, bsiDeployTime: 365 },
  { bsiId: 'R002', bsiName: '萧山雷达站', bsiLocation: '萧山区市心路', bsiLng: 120.264, bsiLat: 30.184, bsiDeployTime: 280 },
  { bsiId: 'R003', bsiName: '余杭雷达站', bsiLocation: '余杭区文一西路', bsiLng: 119.978, bsiLat: 30.273, bsiDeployTime: 190 },
]
const mockAlarmPoints = [
  { dapLat: 30.264, dapLng: 120.264, times: 25, address: '萧山区工业园区', type: 2 },
  { dapLat: 30.184, dapLng: 120.264, times: 18, address: '萧山区物流中心', type: 2 },
  { dapLat: 30.246, dapLng: 120.210, times: 5, address: '西湖区文三路科技街', type: 1 },
  { dapLat: 30.226, dapLng: 120.197, times: 3, address: '上城区延安路商业区', type: 1 },
  { dapLat: 30.319, dapLng: 120.141, times: 8, address: '拱墅区万达广场', type: 1 },
]
const mockDockList = [
  { dockName: '临平交通-塘栖机场', dockCode: 'DOCK001', dockLng: 120.10, dockLat: 30.25, dockCity: '杭州' },
  { dockName: '良渚街道综合信息指挥室', dockCode: 'DOCK002', dockLng: 120.05, dockLat: 30.35, dockCity: '杭州' },
]
const mockWuranList = [
  { name: '浙江XX化工有限公司', weizhi: '萧山区工业园区A区12号', leixing: '工业', level: 3, lng: 120.264, lat: 30.264, createTime: '2025-01-15' },
  { name: '杭州XX建材厂', weizhi: '余杭区工业区B路88号', leixing: '工业', level: 2, lng: 119.978, lat: 30.273, createTime: '2025-02-20' },
  { name: 'XX餐饮店', weizhi: '西湖区文三路168号', leixing: '餐饮', level: 1, lng: 120.130, lat: 30.259, createTime: '2025-03-10' },
]

interface MapBoxProps {
  /** 地图容器ID */
  mapId?: string
  /** 当前城市adcode */
  curCity?: string
  /** 当前区县adcode */
  curDistrict?: string
  /** 是否显示雷达图层 */
  showRadar?: boolean
  /** 是否显示污染源图层 */
  showPollution?: boolean
  /** 是否显示无人机机场图层 */
  showDrone?: boolean
  /** 是否显示告警点位图层 */
  showAlarm?: boolean
  /** 告警时间筛选(小时) */
  bjCheck?: number | null
  /** 时间范围筛选 */
  timeData?: [string, string] | null
  /** 当前选中雷达ID */
  bsiId?: string
  /** 雷达列表变化回调 */
  onRadarLoad?: (list: any[]) => void
  /** 告警点位变化回调 */
  onAlarmLoad?: (cgList: any[], tfList: any[]) => void
  /** 是否显示派遣弹窗 */
  showFlyDispatch?: boolean
  className?: string
}

export default function MapBox({
  mapId = 'lMapBox',
  curCity = '',
  curDistrict = '',
  showRadar = true,
  showPollution = true,
  showDrone = true,
  showAlarm = true,
  bjCheck = 1,
  timeData = null,
  bsiId = '',
  onRadarLoad,
  onAlarmLoad,
  showFlyDispatch = false,
  className = '',
}: MapBoxProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const sceneRef = useRef<Scene | null>(null)
  const { setMapInstance, setLeftLoading, accessibleDistrict } = useAppStore()
  const [flyVisible, setFlyVisible] = useState(false)
  const [lngLat, setLngLat] = useState<{ lng: number; lat: number }>({ lng: 0, lat: 0 })

  // 图层引用
  const radarLayerRef = useRef<ILayer | null>(null)
  const radarIconLayerRef = useRef<ILayer | null>(null)
  const alarmLayerRef = useRef<ILayer | null>(null)
  const pollutionLayerRef = useRef<ILayer | null>(null)
  const droneLayerRef = useRef<ILayer | null>(null)

  // 初始化地图
  function initMap() {
    if (!containerRef.current) return
    const scene = new Scene({
      id: containerRef.current,
      map: new L7Map({
        style: 'blank',
        center: [120.19382669582967, 30.258134],
        minZoom: 5,
        maxZoom: 16,
        zoom: 10,
      }),
      logoVisible: false,
    })

    scene.on('loaded', () => {
      sceneRef.current = scene
      setMapInstance(scene)

      // 卫星瓦片
      const offMapUrl = `${window.location.origin}/offMap/api/tilesets/zjw/{z}/{x}/{y}.jpg`
      const tileLayer = new RasterLayer({ zIndex: 1 }).source(offMapUrl, {
        parser: { type: 'rasterTile', tileSize: 256, zoomOffset: 0 },
      })
      scene.addLayer(tileLayer)

      // 地图点击 → 派遣无人机
      scene.on('click', (ev: any) => {
        if (showFlyDispatch && ev.lngLat) {
          const popup = new Popup({
            html: '<button id="A_R_PAIQIAN" class="marker_popup_btn" style="margin-left:60px">派遣无人机</button>',
            lngLat: ev.lngLat,
          })
          scene.addPopup(popup)
          setLngLat(ev.lngLat)
          setTimeout(() => {
            document.getElementById('A_R_PAIQIAN')?.addEventListener('click', () => setFlyVisible(true))
          }, 300)
        }
      })

      // 加载各图层数据
      const cityName = cities.find(_ => `${_.adcode}` === curCity)?.name || ''
      const districtName = districts.find(_ => `${_.adcode}` === curDistrict)?.name || ''
      const params = { city: cityName, district: districtName }

      if (showRadar) loadRadar(scene, params)
      if (showPollution) loadPollution(scene, params)
      if (showDrone) loadDrone(scene, params)
    })

    return scene
  }

  // 加载雷达
  const loadRadar = async (scene: Scene, params: object) => {
    try {
      const res = await leidaList(params)
      if (res?.resultCode === 0 && Array.isArray(res.data)) {
        renderRadar(scene, res.data)
        onRadarLoad?.(res.data)
        // 加载告警点位
        if (showAlarm && (bsiId || res.data[0])) loadAlarm(scene, bsiId || res.data[0].bsiId)
        return
      }
    } catch (e) { console.warn('雷达API不可用，使用mock', e) }
    // Mock回退
    renderRadar(scene, mockRadarList)
    onRadarLoad?.(mockRadarList)
    if (showAlarm) loadAlarm(scene, bsiId || 'R001')
  }

  // 渲染雷达图层
  const renderRadar = (scene: Scene, list: any[]) => {
    // 清除旧图层
    if (radarLayerRef.current) { radarLayerRef.current.destroy(); radarLayerRef.current = null }
    if (radarIconLayerRef.current) { radarIconLayerRef.current.destroy(); radarIconLayerRef.current = null }

    const leiList = list.map(item => ({ ...item, imgName: 'bsc' }))

    // 雷达扫描动画
    const radarAnimLayer = new PointLayer({ zIndex: 9, name: 's-radar-layer', enablePropagation: false, pickingBuffer: 2 })
      .source(leiList, { parser: { type: 'json', x: 'bsiLng', y: 'bsiLat' } })
      .shape('radar')
      .size(6000)
      .color('rgba(2, 248, 250, 0.50)')
      .style({ speed: 1, unit: 'meter' })
      .animate(true)
    scene.addLayer(radarAnimLayer)
    radarLayerRef.current = radarAnimLayer

    // 雷达图标
    const radarIconLayer = new PointLayer({ zIndex: 10, name: 's-radar-layer2', enablePropagation: false, pickingBuffer: 2 })
      .source(leiList, { parser: { type: 'json', x: 'bsiLng', y: 'bsiLat' } })
      .shape('imgName', ['bsc'])
      .size(30)
    scene.addLayer(radarIconLayer)
    radarIconLayerRef.current = radarIconLayer

    // 雷达Popup
    const radarPopup = new LayerPopup({
      items: [{ layer: radarIconLayer, customContent: (feature: any) => customLeiDiv(feature) }],
      trigger: 'click',
    })
    scene.addPopup(radarPopup)
  }

  // 加载告警点位
  const loadAlarm = async (scene: Scene, radarBsiId: string) => {
    setLeftLoading(true)
    try {
      const params: any = { BsiId: radarBsiId, hour: bjCheck, startTime: '', endTime: '' }
      if (timeData) { params.startTime = timeData[0]; params.endTime = timeData[1] }
      const res = await alarmPointAll(params)
      if (res?.resultCode === 0 && Array.isArray(res.data)) {
        const cgRList: any[] = [], tfRList: any[] = [], showList: any[] = []
        res.data.forEach((item: any) => {
          if (item.type === 1) { cgRList.push(item); showList.push({ ...item, rColor: '#FFB024', imgName: 'warn' }) }
          else if (item.type === 2) { tfRList.push(item); showList.push({ ...item, rColor: '#FF3936', imgName: 'error' }) }
        })
        onAlarmLoad?.(cgRList, tfRList)
        renderAlarm(scene, showList)
        setLeftLoading(false)
        return
      }
    } catch (e) { console.warn('告警API不可用，使用mock', e) }
    // Mock回退
    const cgRList = mockAlarmPoints.filter(p => p.type === 1)
    const tfRList = mockAlarmPoints.filter(p => p.type === 2)
    const showList = mockAlarmPoints.map(p => ({ ...p, rColor: p.type === 2 ? '#FF3936' : '#FFB024', imgName: p.type === 2 ? 'error' : 'warn' }))
    onAlarmLoad?.(cgRList, tfRList)
    renderAlarm(scene, showList)
    setLeftLoading(false)
  }

  // 渲染告警点位
  const renderAlarm = (scene: Scene, points: any[]) => {
    if (alarmLayerRef.current) { alarmLayerRef.current.destroy(); alarmLayerRef.current = null }
    const imageLayer = new PointLayer({ zIndex: 11, enablePropagation: false, pickingBuffer: 2 })
      .source(points, { parser: { type: 'json', x: 'dapLng', y: 'dapLat' } })
      .shape('circle')
      .color('rColor')
      .size(10)
    scene.addLayer(imageLayer)
    alarmLayerRef.current = imageLayer

    const alarmPopup = new LayerPopup({
      items: [{ layer: imageLayer, customContent: (feature: any) => customDiv(feature, accessibleDistrict !== 'all') }],
      trigger: 'click',
    })
    scene.addPopup(alarmPopup)
  }

  // 加载污染源
  const loadPollution = async (scene: Scene, params: object) => {
    try {
      const res = await wuranList(params)
      if (res?.resultCode === 0 && Array.isArray(res.data)) {
        const list = res.data.map((item: any) => ({ ...item, imgName: `${wuLeixingObj[item.leixing] || 'w'}${item.level}` }))
        renderPollution(scene, list)
        return
      }
    } catch (e) { console.warn('污染源API不可用，使用mock', e) }
    // Mock回退
    const list = mockWuranList.map(item => ({ ...item, imgName: `${wuLeixingObj[item.leixing] || 'w'}${item.level}` }))
    renderPollution(scene, list)
  }

  // 渲染污染源
  const renderPollution = (scene: Scene, list: any[]) => {
    if (pollutionLayerRef.current) { pollutionLayerRef.current.destroy(); pollutionLayerRef.current = null }
    const imageLayer = new PointLayer({ zIndex: 10, enablePropagation: false, pickingBuffer: 2 })
      .source(list, { parser: { type: 'json', x: 'lng', y: 'lat' } })
      .shape('imgName')
      .size(10)
    scene.addLayer(imageLayer)
    pollutionLayerRef.current = imageLayer

    const wuPopup = new LayerPopup({
      items: [{ layer: imageLayer, customContent: (feature: any) => customDiv(feature, accessibleDistrict !== 'all') }],
      trigger: 'click',
    })
    scene.addPopup(wuPopup)
  }

  // 加载无人机机场
  const loadDrone = async (scene: Scene, params: object) => {
    try {
      const res = await dockList(params)
      if (res?.resultCode === 0 && Array.isArray(res.data)) {
        const list = res.data.map((item: any) => ({ ...item, imgName: 'wrjC' }))
        renderDrone(scene, list)
        return
      }
    } catch (e) { console.warn('无人机API不可用，使用mock', e) }
    // Mock回退
    const list = mockDockList.map(item => ({ ...item, imgName: 'wrjC' }))
    renderDrone(scene, list)
  }

  // 渲染无人机机场
  const renderDrone = (scene: Scene, list: any[]) => {
    if (droneLayerRef.current) { droneLayerRef.current.destroy(); droneLayerRef.current = null }
    const imageLayer = new PointLayer({ zIndex: 10, enablePropagation: false, pickingBuffer: 2 })
      .source(list, { parser: { type: 'json', x: 'dockLng', y: 'dockLat' } })
      .shape('imgName', ['wrjC'])
      .size(18)
    scene.addLayer(imageLayer)
    droneLayerRef.current = imageLayer

    const dronePopup = new LayerPopup({
      items: [{ layer: imageLayer, customContent: (feature: any) => customDiv(feature) }],
      trigger: 'click',
    })
    scene.addPopup(dronePopup)
  }

  // 初始化
  useEffect(() => {
    const scene = initMap()
    return () => {
      if (scene) { scene.destroy(); setMapInstance(null) }
    }
    // L7 场景只初始化一次，筛选变化由下方的数据重载 effect 处理。
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // 区域变化时重新加载
  useEffect(() => {
    const scene = sceneRef.current
    if (!scene || !curCity) return
    const cityName = cities.find(_ => `${_.adcode}` === curCity)?.name || ''
    const districtName = districts.find(_ => `${_.adcode}` === curDistrict)?.name || ''
    const params = { city: cityName, district: districtName }
    if (showRadar) loadRadar(scene, params)
    if (showPollution) loadPollution(scene, params)
    if (showDrone) loadDrone(scene, params)
    // 加载函数依赖当前场景引用，不作为重建场景的依赖。
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [curCity, curDistrict])

  return (
    <div className={`relative w-full h-full ${className}`}>
      <div id={mapId} ref={containerRef} className="w-full h-full" style={{ background: '#1a5ab0' }} />
      {flyVisible && (
        <FlyListModel
          visible={flyVisible}
          setVisible={setFlyVisible}
          curCity={curCity}
          curDistrict={curDistrict}
          lngLat={lngLat}
        />
      )}
    </div>
  )
}

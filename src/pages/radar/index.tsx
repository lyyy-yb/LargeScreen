import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { Button, Select, Modal, Popover, QRCode, message } from 'antd'
import { ArrowLeftOutlined, EnvironmentOutlined, ExclamationCircleOutlined, SendOutlined, WarningFilled } from '@ant-design/icons'
import L7MapView from '@/components/L7MapView'
import { leidaList, alarmPointAll, wuranList, dockList } from '@/servers/mapBox'
import { cities } from '@/utils/city'

const { Option } = Select

interface AlarmItem { dapLat: number; dapLng: number; times: number; address: string; type: number }
interface PollutionItem { name: string; weizhi: string; leixing: string; hangye: string; xianzhuang: string; lng: number; lat: number }

const mockTfList: AlarmItem[] = [
  { dapLat: 30.264, dapLng: 120.264, times: 25, address: '萧山区工业园区', type: 1 },
  { dapLat: 30.184, dapLng: 120.264, times: 18, address: '萧山区物流中心', type: 1 },
  { dapLat: 30.273, dapLng: 119.978, times: 15, address: '余杭区工业区', type: 1 },
  { dapLat: 30.048, dapLng: 119.960, times: 8, address: '富阳区化工园区', type: 1 },
]
const mockCgList: AlarmItem[] = [
  { dapLat: 30.246, dapLng: 120.210, times: 5, address: '西湖区文三路科技街', type: 0 },
  { dapLat: 30.226, dapLng: 120.197, times: 3, address: '上城区延安路商业区', type: 0 },
  { dapLat: 30.319, dapLng: 120.141, times: 8, address: '拱墅区万达广场', type: 0 },
  { dapLat: 30.259, dapLng: 120.130, times: 2, address: '西湖区西溪湿地', type: 0 },
  { dapLat: 30.208, dapLng: 120.211, times: 12, address: '滨江区滨江天街', type: 0 },
]
const mockPollutionList: PollutionItem[] = [
  { name: '浙江XX化工有限公司', weizhi: '萧山区工业园区A区12号', leixing: '工业源', hangye: '化工', xianzhuang: '正常生产', lng: 120.264, lat: 30.264 },
  { name: '杭州XX建材厂', weizhi: '余杭区工业区B路88号', leixing: '工业源', hangye: '建材', xianzhuang: '正常生产', lng: 119.978, lat: 30.273 },
  { name: 'XX物流中心仓库', weizhi: '萧山区物流大道168号', leixing: '交通源', hangye: '物流', xianzhuang: '正常运营', lng: 120.264, lat: 30.184 },
  { name: '富阳XX印染厂', weizhi: '富阳区化工园区C区3号', leixing: '工业源', hangye: '印染', xianzhuang: '停产整改', lng: 119.960, lat: 30.048 },
  { name: '杭州XX建筑工地', weizhi: '西湖区文三路与学院路', leixing: '建筑施工', hangye: '建筑', xianzhuang: '施工中', lng: 120.130, lat: 30.259 },
]
const mockDocks = [
  { dockName: '临平交通-塘栖机场', dockCode: 'DOCK001' },
  { dockName: '良渚街道综合信息指挥室', dockCode: 'DOCK002' },
]
const leixingFilters = [
  { value: '', label: '全部' }, { value: '工业源', label: '工业源' },
  { value: '交通源', label: '交通源' }, { value: '建筑施工', label: '建筑施工' }, { value: '餐饮', label: '餐饮' },
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
                <div className="mt-0.5 text-9px text-[#bdddf8]/52">最近 1 小时监测</div>
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
  const [curProvince, setCurProvince] = useState('浙江省')
  const [curCity, setCurCity] = useState('杭州市')
  const [curDistrict, setCurDistrict] = useState('')
  const [wxVisible, setWxVisible] = useState(false)
  const [wxInfo, setWxInfo] = useState<AlarmItem | null>(null)
  const [filterLeixing, setFilterLeixing] = useState('')
  const [modal, contextHolder] = Modal.useModal()
  const [tfList, setTfList] = useState<AlarmItem[]>(mockTfList)
  const [cgList, setCgList] = useState<AlarmItem[]>(mockCgList)
  const [pollutionList, setPollutionList] = useState<PollutionItem[]>(mockPollutionList)
  const [docks, setDocks] = useState(mockDocks)

  // 加载雷达和告警数据
  useEffect(() => {
    const loadData = async () => {
      const cityName = cities.find(_ => _.name === curCity)?.name || curCity
      const districtName = curDistrict || ''
      const params = { city: cityName, district: districtName }
      try {
        const radarRes = await leidaList(params)
        if (radarRes?.resultCode === 0 && Array.isArray(radarRes.data)) {
          if (radarRes.data[0]) {
            const alarmRes = await alarmPointAll({ BsiId: radarRes.data[0].bsiId, hour: 1 })
            if (alarmRes?.resultCode === 0 && Array.isArray(alarmRes.data)) {
              const cg: AlarmItem[] = [], tf: AlarmItem[] = []
              alarmRes.data.forEach((item: any) => {
                if (item.type === 1) cg.push(item)
                else if (item.type === 2) tf.push(item)
              })
              setCgList(cg.length ? cg : mockCgList)
              setTfList(tf.length ? tf : mockTfList)
            }
          }
        }
      } catch (e) { console.warn('雷达API不可用，使用mock', e) }
      try {
        const wuRes = await wuranList(params)
        if (wuRes?.resultCode === 0 && Array.isArray(wuRes.data) && wuRes.data.length) {
          setPollutionList(wuRes.data)
        }
      } catch (e) { console.warn('污染源API不可用，使用mock', e) }
      try {
        const dockRes = await dockList(params)
        if (dockRes?.resultCode === 0 && Array.isArray(dockRes.data) && dockRes.data.length) {
          setDocks(dockRes.data)
        }
      } catch (e) { console.warn('无人机API不可用，使用mock', e) }
    }
    loadData()
  }, [curCity, curDistrict])

  const showWX = (obj: AlarmItem) => { setWxInfo(obj); setWxVisible(true) }
  const flyTo = (obj: AlarmItem) => { message.info(`定位到: ${obj.address}`) }

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
      {docks.map(item => (
        <div key={item.dockCode} className="flex items-center justify-between py-1">
          <span className="text-sm">{item.dockName}</span>
          <Button size="small" className="!text-[#01C2FF] !border-[#6788AF] !bg-[rgba(255,255,255,0.1)] !rounded-full" onClick={() => showConfirm(item.dockName, item.dockCode, obj)}>选择</Button>
        </div>
      ))}
    </div>
  )

  const filteredPollution = filterLeixing ? pollutionList.filter(i => i.leixing === filterLeixing) : pollutionList

  const markers = [
    ...tfList.map(i => ({ lng: i.dapLng, lat: i.dapLat, name: i.address, color: '#FFB024', size: 14 })),
    ...cgList.map(i => ({ lng: i.dapLng, lat: i.dapLat, name: i.address, color: '#FF3936', size: 10 })),
  ]

  return (
    <div className="w-full h-full relative overflow-hidden" style={{ background: '#1a5ab0' }}>
      <L7MapView id="radar-map" center={[120.15, 30.22]} zoom={10} minZoom={8} maxZoom={14} showTiles markers={markers} />
      {/* 返回按钮 */}
      <div className="absolute top-15px left-20px z-50">
        <Button type="text" icon={<ArrowLeftOutlined />} onClick={() => navigate('/monitor')} className="!text-[#03FBFD] !bg-[rgba(255,255,255,0.1)] hover:!bg-[rgba(255,255,255,0.2)] !rounded-2xl">返回监控大屏</Button>
      </div>
      {/* 顶部选择器 */}
      <div className="absolute top-45px left-1/2 -translate-x-1/2 z-50 flex gap-2 bg-[rgba(0,56,129,0.8)] px-4 py-2 rounded-xl border border-[rgba(255,255,255,0.3)]">
        <Select value={curProvince} onChange={setCurProvince} className="w-100px screen-select" classNames={{ popup: { root: 'screen-select-popup' } }} size="small"><Option value="浙江省">浙江省</Option></Select>
        <Select value={curCity} onChange={setCurCity} className="w-100px screen-select" classNames={{ popup: { root: 'screen-select-popup' } }} size="small"><Option value="杭州市">杭州市</Option><Option value="宁波市">宁波市</Option></Select>
        <Select value={curDistrict} onChange={setCurDistrict} className="w-100px screen-select" classNames={{ popup: { root: 'screen-select-popup' } }} size="small" allowClear placeholder="区县"><Option value="西湖区">西湖区</Option><Option value="萧山区">萧山区</Option><Option value="余杭区">余杭区</Option><Option value="滨江区">滨江区</Option><Option value="富阳区">富阳区</Option></Select>
        <Select defaultValue="" className="w-120px screen-select" classNames={{ popup: { root: 'screen-select-popup' } }} size="small"><Option value="">全部雷达</Option><Option value="RD01">西湖雷达站</Option><Option value="RD02">萧山雷达站</Option></Select>
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
              <div className="text-9px text-[#c5e5ff]/52 mt-0.5">当前区域共 {filteredPollution.length} 个污染源</div>
            </div>
            <Select value={filterLeixing} onChange={setFilterLeixing} className="w-100px pointer-events-auto screen-select" classNames={{ popup: { root: 'screen-select-popup' } }} size="small" options={leixingFilters} />
          </div>
          <div className="flex-1 min-h-0 overflow-y-auto pointer-events-auto py-1 space-y-2 pr-0.5">
            {filteredPollution.map((item, idx) => (
              <article key={`${item.name}-${idx}`} className="rounded-11px border border-[rgba(133,213,255,0.17)] px-3 py-2.5 cursor-pointer bg-[rgba(17,91,167,0.5)] hover:bg-[rgba(27,112,191,0.68)] hover:border-[rgba(116,226,255,0.42)] transition-all" onClick={() => message.info(`定位: ${item.name}`)}>
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
          <div className="flex items-center justify-between gap-2 pt-2 mt-1 border-t border-[rgba(137,219,255,0.16)] pointer-events-auto">
            <Button className="!flex-1 !rounded-full !text-[#8aefff] !border-[rgba(98,220,255,0.38)] !bg-[rgba(58,186,224,0.08)]" onClick={() => navigate('/pollution')}>管理污染源</Button>
            <Button type="primary" className="!flex-1 !rounded-full" onClick={() => navigate('/pollution')}>新增污染源</Button>
          </div>
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
      {contextHolder}
    </div>
  )
}

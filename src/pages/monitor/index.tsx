import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Select } from 'antd'
import dayjs from 'dayjs'
import CityDistrictMap from '@/components/CityDistrictMap'
import ZJ3DMap from '@/components/ZJ3DMap'
import { useAppStore } from '@/stores'
import { cities, districts, type CityItem, type DistrictItem } from '@/utils/city'

interface RegionMetric {
  name: string
  adcode: string
  pm25: number
  o3: number
  temp: number
  humidity: number
}

function permissionAllows(permission: string, name: string, adcode: string | number) {
  if (!permission || permission.toLowerCase() === 'all') return true
  const shortName = name.replace(/[市区县]$/, '')
  return permission.includes(String(adcode)) || permission.includes(name) || permission.includes(shortName)
}

function buildMetrics(items: Array<CityItem | DistrictItem>): RegionMetric[] {
  return items.map((item, index) => ({
    name: item.name,
    adcode: String(item.adcode),
    pm25: Number((5.6 + (index * 7) % 46).toFixed(1)),
    o3: Number((28.4 + (index * 3.7) % 22).toFixed(1)),
    temp: Number((16.2 + (index * 1.3) % 8).toFixed(1)),
    humidity: Number((46.8 + (index * 2.9) % 24).toFixed(1)),
  }))
}

function qualityMeta(pm25: number) {
  if (pm25 <= 15) return { label: '优', color: '#22f0a2' }
  if (pm25 <= 35) return { label: '良', color: '#f5d34f' }
  return { label: '轻度污染', color: '#ff9f43' }
}

function DonutChart({ percent, color, children }: { percent: number; color: string; children: React.ReactNode }) {
  const radius = 26
  const circumference = 2 * Math.PI * radius
  const offset = circumference * (1 - Math.min(percent, 100) / 100)
  return (
    <div className="relative w-64px h-64px shrink-0">
      <svg className="w-full h-full -rotate-90" viewBox="0 0 64 64">
        <circle cx="32" cy="32" r={radius} fill="none" stroke="rgba(255,255,255,0.16)" strokeWidth="5" />
        <circle cx="32" cy="32" r={radius} fill="none" stroke={color} strokeWidth="5"
          strokeDasharray={circumference} strokeDashoffset={offset} strokeLinecap="round" />
      </svg>
      <div className="absolute inset-0 flex items-center justify-center">{children}</div>
    </div>
  )
}

function StatRow({ dot, label, value }: { dot: string; label: string; value: string | number }) {
  return (
    <div className="flex items-center justify-between py-1">
      <div className="flex items-center gap-2">
        <span className="w-2 h-2 rounded-full" style={{ backgroundColor: dot }} />
        <span className="text-[#d5efff]/75 text-12px">{label}</span>
      </div>
      <span className="text-white text-13px font-mono font-bold">{value}</span>
    </div>
  )
}

function RegionStationCard({
  item,
  selected,
  updatedAt,
  onClick,
}: {
  item: RegionMetric
  selected: boolean
  updatedAt: string
  onClick: () => void
}) {
  const quality = qualityMeta(item.pm25)
  return (
    <button
      type="button"
      aria-pressed={selected}
      onClick={onClick}
      className="w-full text-left rounded-12px px-3 py-2.5 border transition-all cursor-pointer"
      style={{
        background: selected
          ? 'linear-gradient(135deg, rgba(28,137,211,0.96), rgba(12,86,159,0.94))'
          : 'linear-gradient(135deg, rgba(17,89,164,0.82), rgba(11,70,137,0.76))',
        borderColor: selected ? 'rgba(111,238,255,0.96)' : 'rgba(126,205,255,0.26)',
        boxShadow: selected ? '0 0 18px rgba(55,220,255,0.24), inset 3px 0 #6ff0ff' : 'none',
      }}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex items-center gap-2">
          <span className="w-7px h-7px rounded-full shrink-0" style={{ background: quality.color, boxShadow: `0 0 8px ${quality.color}` }} />
          <span className="text-[#edfaff] text-13px font-600 truncate">{item.name}</span>
          <span className="rounded-full px-1.5 py-0.5 text-9px shrink-0" style={{ color: quality.color, background: `${quality.color}1f` }}>{quality.label}</span>
        </div>
        <span className="text-[#b8dcf7]/55 text-9px font-mono shrink-0">{updatedAt}</span>
      </div>
      <div className="grid grid-cols-4 gap-1 mt-2">
        {[
          ['PM2.5', item.pm25, quality.color],
          ['O₃', item.o3, '#73efff'],
          ['温度', `${item.temp}°`, '#dcefff'],
          ['湿度', `${item.humidity}%`, '#dcefff'],
        ].map(([label, value, color]) => (
          <div key={String(label)} className="rounded-6px bg-[rgba(4,42,93,0.32)] px-1.5 py-1 text-center">
            <div className="text-9px text-[#c6e7ff]/58">{label}</div>
            <div className="text-12px font-mono font-700 mt-0.5" style={{ color: String(color) }}>{value}</div>
          </div>
        ))}
      </div>
    </button>
  )
}

const panelStyle = {
  background: 'linear-gradient(150deg, rgba(12,79,151,0.94), rgba(6,54,119,0.90))',
  border: '1px solid rgba(113,211,255,0.32)',
  boxShadow: 'inset 0 0 24px rgba(58,181,255,0.08)',
}

export default function Monitor() {
  const navigate = useNavigate()
  const {
    accessibleCity,
    accessibleDistrict,
    setCurrentCity,
    setCurrentDistrict,
  } = useAppStore()
  const isProvinceAccount = accessibleCity.toLowerCase() === 'all'
  const permittedCities = useMemo(() => {
    const matched = cities.filter(city => permissionAllows(accessibleCity, city.name, city.adcode))
    return matched.length ? matched : [cities[0]]
  }, [accessibleCity])
  const accountCity = permittedCities[0]
  const [selectedCityCode, setSelectedCityCode] = useState(accountCity.adcode)
  const [selectedDistrict, setSelectedDistrict] = useState('')
  const [hoverRegion, setHoverRegion] = useState<string | null>(null)
  const [pm25Filter, setPm25Filter] = useState('PM2.5')
  const [updatedAt, setUpdatedAt] = useState(dayjs().format('HH:mm'))

  useEffect(() => {
    const timer = window.setInterval(() => setUpdatedAt(dayjs().format('HH:mm')), 60_000)
    return () => window.clearInterval(timer)
  }, [])

  const effectiveCityCode = isProvinceAccount && permittedCities.some(city => city.adcode === selectedCityCode)
    ? selectedCityCode
    : accountCity.adcode
  const activeCity = permittedCities.find(city => city.adcode === effectiveCityCode) || accountCity
  const cityDistricts = useMemo(() => {
    const allDistricts = districts.filter(item => item.parent === Number(activeCity.adcode))
    if (accessibleDistrict.toLowerCase() === 'all') return allDistricts
    const permitted = allDistricts.filter(item => permissionAllows(accessibleDistrict, item.name, item.adcode))
    return permitted.length ? permitted : allDistricts
  }, [accessibleDistrict, activeCity.adcode])

  const effectiveDistrict = cityDistricts.find(item => item.name === selectedDistrict)?.name || cityDistricts[0]?.name || ''

  useEffect(() => {
    setCurrentCity(activeCity.adcode)
    setCurrentDistrict(isProvinceAccount ? '' : cityDistricts.find(item => item.name === effectiveDistrict)?.adcode.toString() || '')
  }, [activeCity.adcode, cityDistricts, effectiveDistrict, isProvinceAccount, setCurrentCity, setCurrentDistrict])

  const listMetrics = useMemo(
    () => buildMetrics(isProvinceAccount ? permittedCities : cityDistricts),
    [cityDistricts, isProvinceAccount, permittedCities]
  )
  const selectedRegionName = isProvinceAccount ? activeCity.name : effectiveDistrict

  const selectCity = (adcode: string) => {
    setSelectedCityCode(adcode)
    setHoverRegion(null)
  }

  const selectDistrict = (name: string) => {
    const item = cityDistricts.find(district => district.name === name)
    if (!item) return
    setSelectedDistrict(name)
    setCurrentDistrict(String(item.adcode))
    setHoverRegion(null)
  }

  const handleCityClick = (cityName: string, adcode: number) => {
    const city = permittedCities.find(item => item.name === cityName || Number(item.adcode) === Number(adcode))
    if (city) selectCity(city.adcode)
  }

  return (
    <div
      className="w-full h-full flex overflow-hidden text-[#e7f7ff]"
      style={{ background: 'linear-gradient(180deg, #216fbb 0%, #155fa9 48%, #0e4f91 100%)' }}
    >
      <aside className="w-310px shrink-0 flex flex-col overflow-hidden border-r border-[rgba(110,210,255,0.18)] bg-[rgba(5,61,126,0.35)]">
        <div className="px-4 pt-3 pb-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-3px h-18px bg-[#62efff] rounded shadow-[0_0_10px_rgba(98,239,255,0.7)]" />
              <span className="text-[#effcff] text-15px font-bold">{isProvinceAccount ? '城市监测概况' : '区县监测站'}</span>
            </div>
            <span className="px-2 py-0.5 rounded-full text-10px text-[#83edff] bg-[rgba(78,217,255,0.12)] border border-[rgba(104,232,255,0.3)]">{listMetrics.length} 个区域</span>
          </div>
          <div className="mt-1.5 pl-11px text-10px text-[#c3e5ff]/60">点击列表或地图可切换当前选中区域</div>
        </div>
        <div className="flex-1 overflow-y-auto px-3 pb-3 space-y-2">
          {listMetrics.map(item => (
            <RegionStationCard
              key={item.adcode}
              item={item}
              selected={item.name === selectedRegionName}
              updatedAt={updatedAt}
              onClick={() => isProvinceAccount ? selectCity(item.adcode) : selectDistrict(item.name)}
            />
          ))}
        </div>
      </aside>

      <main className="flex-1 relative overflow-hidden min-w-0">
        {isProvinceAccount ? (
          <ZJ3DMap selectedCity={activeCity.name} onCityClick={handleCityClick} onCityHover={setHoverRegion} />
        ) : (
          <CityDistrictMap
            city={activeCity}
            districtItems={cityDistricts}
            selectedDistrict={effectiveDistrict}
            onDistrictClick={selectDistrict}
            onDistrictHover={setHoverRegion}
          />
        )}

        <div className="absolute top-3 left-3 z-20 flex items-center gap-2">
          <Select value={pm25Filter} onChange={setPm25Filter} className="w-100px screen-select" classNames={{ popup: { root: 'screen-select-popup' } }} size="small"
            options={['PM2.5', 'O3', 'NOX', 'TVOCs'].map(value => ({ value, label: value }))} />
          <span className="rounded-full px-2.5 py-1 text-10px text-[#ddf9ff] border border-[rgba(125,230,255,0.38)] bg-[rgba(7,69,139,0.78)]">
            {isProvinceAccount ? '省级视图 · 选择城市' : `${activeCity.name} · 选择区县`}
          </span>
        </div>

        <div className="absolute top-54px left-1/2 -translate-x-1/2 z-20 flex items-center gap-3 px-3.5 py-1.5 rounded-full border border-[rgba(132,230,255,0.3)] bg-[rgba(7,65,132,0.82)] shadow-[0_5px_18px_rgba(3,39,93,0.2)]">
          {[
            ['#21f0a4', '空气质量站'],
            ['#1ad4ef', '无人机机场'],
            ['#c17cff', '光量子雷达'],
            ['#ff6868', '预警点位'],
          ].map(([color, label]) => (
            <div key={label} className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full" style={{ background: color }} /><span className="text-[#d9f1ff] text-10px">{label}</span></div>
          ))}
        </div>

        <div className="absolute top-3 right-3 z-20 flex items-center gap-2 rounded-8px bg-[rgba(7,65,132,0.74)] p-1.5 border border-[rgba(118,221,255,0.22)]">
          <Select value="浙江省" disabled className="w-88px screen-select" classNames={{ popup: { root: 'screen-select-popup' } }} size="small" options={[{ value: '浙江省', label: '浙江省' }]} />
          <Select
            value={activeCity.adcode}
            onChange={selectCity}
            disabled={!isProvinceAccount}
            className="w-92px screen-select"
            classNames={{ popup: { root: 'screen-select-popup' } }}
            size="small"
            options={permittedCities.map(city => ({ value: city.adcode, label: city.name }))}
          />
          {!isProvinceAccount && (
            <Select
              value={effectiveDistrict || undefined}
              onChange={selectDistrict}
              className="w-100px screen-select"
              classNames={{ popup: { root: 'screen-select-popup' } }}
              size="small"
              options={cityDistricts.map(item => ({ value: item.name, label: item.name }))}
            />
          )}
        </div>

        {hoverRegion && hoverRegion !== selectedRegionName && (
          <div className="absolute top-14 left-1/2 -translate-x-1/2 z-20 px-4 py-1.5 rounded-lg border border-[rgba(142,239,255,0.55)] bg-[rgba(7,58,122,0.92)] shadow-[0_6px_20px_rgba(0,25,76,0.28)]">
            <span className="text-[#e5fcff] text-12px">点击选择 </span><span className="text-[#62efff] text-13px font-bold">{hoverRegion}</span>
          </div>
        )}

        <div className="absolute bottom-3 left-3 z-20 flex items-center gap-4 px-4 py-2 rounded-lg border border-[rgba(132,228,255,0.26)] text-11px bg-[rgba(6,60,126,0.84)]">
          <span className="text-[#d0ebff]/75">在线数据源：<b className="text-[#68efff] font-mono">89</b></span>
          <span className="text-[#d0ebff]/75">数据总量：<b className="text-[#68efff] font-mono">58675</b></span>
          <span className="text-[#d0ebff]/75">数据完整性：<b className="text-[#22f0a2] font-mono">100%</b></span>
        </div>

        <div className="absolute bottom-3 right-3 z-20 px-4 py-2 rounded-lg border border-[rgba(132,228,255,0.26)] bg-[rgba(6,60,126,0.84)] max-w-350px">
          <div className="text-[#67efff] text-12px font-bold mb-1">{isProvinceAccount ? '浙江省环境监测分布' : `${activeCity.name}环境监测分布`}</div>
          <div className="text-[#d0ebff]/72 text-10px leading-17px">
            {isProvinceAccount ? `覆盖 ${permittedCities.length} 个地市` : `覆盖 ${cityDistricts.length} 个区县`} · 4 个光量子雷达站 · 5 个无人机机场
          </div>
        </div>
      </main>

      <aside className="w-300px shrink-0 flex flex-col overflow-hidden border-l border-[rgba(110,210,255,0.18)] bg-[rgba(5,61,126,0.32)]">
        <section className="flex-1 flex flex-col overflow-hidden px-3.5 pt-3 pb-2">
          <div className="flex items-center gap-2 mb-2"><div className="w-3px h-17px bg-[#21d4ef] rounded" /><span className="text-[#effcff] text-15px font-bold">无人机机场</span></div>
          <div className="flex-1 flex flex-col rounded-12px px-4 py-3" style={panelStyle}>
            <div className="flex items-center justify-between mb-2">
              <div><span className="text-white text-28px font-bold font-mono">1583</span><span className="text-[#c3e5ff]/68 text-12px ml-1">架</span></div>
              <DonutChart percent={64} color="#21d4ef"><span className="text-18px">🛸</span></DonutChart>
            </div>
            <div className="grid grid-cols-2 gap-x-4"><StatRow dot="#22f0a2" label="在线" value="64" /><StatRow dot="#94a3b8" label="离线" value="1583" /><StatRow dot="#21d4ef" label="待飞任务" value="98" /><StatRow dot="#21d4ef" label="飞行中" value="5433" /></div>
            <button onClick={() => navigate('/drone')} className="mt-auto mx-auto px-9 py-1.5 rounded-full text-11px text-[#8cf5ff] border border-[rgba(76,225,245,0.5)] bg-[rgba(30,186,217,0.1)] hover:bg-[rgba(30,186,217,0.2)] cursor-pointer">查看详情</button>
          </div>
        </section>

        <section className="flex-1 flex flex-col overflow-hidden px-3.5 pt-1 pb-3">
          <div className="flex items-center gap-2 mb-2"><div className="w-3px h-17px bg-[#c17cff] rounded" /><span className="text-[#effcff] text-15px font-bold">光量子雷达</span></div>
          <div className="flex-1 flex flex-col rounded-12px px-4 py-3" style={panelStyle}>
            <div className="flex items-center justify-between mb-2">
              <div><span className="text-white text-28px font-bold font-mono">78</span><span className="text-[#22f0a2] text-14px ml-1">↑</span></div>
              <DonutChart percent={78} color="#c17cff"><span className="text-18px">📡</span></DonutChart>
            </div>
            <div className="grid grid-cols-2 gap-x-4"><StatRow dot="#22f0a2" label="在线" value="64" /><StatRow dot="#ff9f43" label="离线" value="14" /></div>
            <div className="mt-1 space-y-0.5"><StatRow dot="#21d4ef" label="近1小时" value="98" /><StatRow dot="#21d4ef" label="近3小时" value="5433" /><StatRow dot="#21d4ef" label="近24小时" value="5433" /></div>
            <button onClick={() => navigate('/radar')} className="mt-auto mx-auto px-9 py-1.5 rounded-full text-11px text-[#e0bdff] border border-[rgba(193,124,255,0.52)] bg-[rgba(165,91,223,0.1)] hover:bg-[rgba(165,91,223,0.2)] cursor-pointer">查看详情</button>
          </div>
        </section>
      </aside>
    </div>
  )
}

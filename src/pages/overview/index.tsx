import { useState, useCallback } from 'react'
import { Select } from 'antd'
import { RadarChartOutlined, RocketOutlined, CarOutlined } from '@ant-design/icons'
import { Scene, Popup } from '@antv/l7'
import { Choropleth } from '@antv/l7plot'
import { cities, provinces } from '@/utils/city'
import L7MapView from '@/components/L7MapView'

// 各市部署数据（模拟）
const deployData: Record<string, { leida: number; wurenji: number; zouhangche: number }> = {
  '杭州市': { leida: 2, wurenji: 2, zouhangche: 2 },
  '宁波市': { leida: 1, wurenji: 1, zouhangche: 1 },
  '温州市': { leida: 0, wurenji: 1, zouhangche: 1 },
  '嘉兴市': { leida: 1, wurenji: 0, zouhangche: 0 },
  '湖州市': { leida: 0, wurenji: 0, zouhangche: 1 },
  '绍兴市': { leida: 1, wurenji: 1, zouhangche: 0 },
  '金华市': { leida: 0, wurenji: 0, zouhangche: 1 },
  '衢州市': { leida: 0, wurenji: 0, zouhangche: 0 },
  '舟山市': { leida: 0, wurenji: 1, zouhangche: 0 },
  '台州市': { leida: 1, wurenji: 0, zouhangche: 1 },
  '丽水市': { leida: 0, wurenji: 0, zouhangche: 0 },
}

const assemblePopupHtml = (item: { leida: number; wurenji: number; zouhangche: number }) => {
  const fields = [
    { field: 'leida', alias: '雷达' },
    { field: 'wurenji', alias: '无人机' },
    { field: 'zouhangche', alias: '走航车' },
  ]
  return `<ul style="display:flex;gap:12px;margin:0;padding:4px 8px;list-style:none;">
    ${fields.map(f => `<li style="text-align:center;">
      <div style="color:#A0C7FF;font-size:11px;">${f.alias}</div>
      <div style="color:#03FBFD;font-size:16px;font-weight:bold;">${item[f.field as keyof typeof item] || 0}</div>
    </li>`).join('')}
  </ul>`
}

export default function Overview() {
  const [selectedProvince, setSelectedProvince] = useState('zhejiang')
  const [selectedCity, setSelectedCity] = useState('all')

  const handleSceneLoaded = useCallback((scene: Scene) => {
    // 1. 中国行政区（国家级）
    const chinaChoropleth = new Choropleth({
      source: {
        data: provinces.map(p => ({ ...p, adcode: Number(p.adcode) })),
        joinBy: { sourceField: 'adcode', geoField: 'adcode' },
      },
      map: { type: 'map' },
      viewLevel: { level: 'country', adcode: 100000 },
      color: {
        field: 'adcode',
        value: ['#5584bf', '#3667a4', '#4784bf', '#5d93d7'],
        scale: { type: 'cat' },
      },
      style: {
        opacity: 1,
        stroke: '#ccc',
        lineWidth: 0.6,
        lineOpacity: 0.1,
      },
      chinaBorder: false,
    })
    chinaChoropleth.addToScene(scene)

    // 2. 浙江省域图（市级填色）
    const newCities = cities.map(item => {
      const deploy = deployData[item.name] || { leida: 0, wurenji: 0, zouhangche: 0 }
      const rItem = { ...item, adcode: Number(item.adcode), ...deploy }
      // 城市信息 Popup
      const popup = new Popup({
        title: item.name,
        html: assemblePopupHtml(rItem),
        lngLat: { lng: item.lng, lat: item.lat },
        className: 'city-popup',
        closeButton: false,
        autoClose: false,
      })
      scene.addPopup(popup)
      return rItem
    })

    const cityChoropleth = new Choropleth({
      source: {
        data: newCities,
        joinBy: { sourceField: 'adcode', geoField: 'adcode' },
      },
      map: { type: 'map' },
      viewLevel: { level: 'province', adcode: 330000 },
      color: { field: 'bg' },
      style: {
        opacity: 1,
        stroke: '#ccc',
        lineWidth: 0.6,
        lineOpacity: 1,
      },
      chinaBorder: false,
      label: {
        visible: true,
        field: 'name',
        style: {
          fill: '#204b4c',
          opacity: 0.8,
          fontSize: 10,
          stroke: '#bcf2f3',
          strokeWidth: 1,
          textAllowOverlap: false,
          padding: [5, 5],
        },
      },
      state: {
        active: { stroke: '#35c9cc', lineWidth: 1 },
      },
    })
    cityChoropleth.addToScene(scene)
  }, [])

  return (
    <div className="w-full h-full relative overflow-hidden" style={{ background: '#1a5ab0' }}>
      {/* L7 地图 + Choropleth 行政区填色 */}
      <div className="absolute inset-0">
        <L7MapView
          id="overview-map"
          center={[120.582886, 29.991549]}
          zoom={7.5}
          minZoom={6}
          maxZoom={12}
          showTiles={false}
          onSceneLoaded={handleSceneLoaded}
        />
      </div>

      {/* 顶部选择器 */}
      <div className="absolute top-10px left-1/2 -translate-x-1/2 z-50 flex gap-12px">
        <Select
          value={selectedProvince}
          onChange={setSelectedProvince}
          className="w-120px top-s-antd-sel"
          classNames={{ popup: { root: "model_from_sel_opt" } }}
          options={[{ label: '浙江省', value: 'zhejiang' }]}
        />
        <Select
          value={selectedCity}
          onChange={setSelectedCity}
          className="w-100px top-s-antd-sel"
          classNames={{ popup: { root: "model_from_sel_opt" } }}
          options={[{ label: '全部', value: 'all' }, ...cities.map(c => ({ label: c.name, value: c.adcode }))]}
        />
      </div>

      {/* 三栏布局 */}
      <div className="absolute inset-0 top-0 bottom-0 flex pointer-events-none">
        {/* 左侧面板 */}
        <div className="w-340px p-16px flex flex-col gap-16px z-10 pointer-events-auto">
          {/* 雷达部署情况 */}
          <div className="bg-[rgba(10,60,130,0.85)] rounded-20px border-1 border-solid border-[rgba(255,255,255,0.2)] shadow-[0_0_10px_0_rgba(180,203,234,0.16)] px-8px py-6px backdrop-blur-sm">
            <div className="box-header-bg color-#A0C7FF text-18px line-height-60px pb-10px px-15px">雷达部署情况</div>
            <div className="px-15px flex items-center gap-20px py-10px">
              <div className="flex items-center gap-8px">
                <RadarChartOutlined className="text-24px text-[#A0C7FF]" />
                <div>
                  <div className="text-[#03FBFD] text-24px font-bold">4<span className="text-14px">台</span></div>
                  <div className="text-[#A0C7FF] text-12px">雷达站点</div>
                </div>
              </div>
              <div className="flex items-center gap-8px">
                <div className="w-24px h-24px rounded-full bg-[rgba(3,251,253,0.2)] flex items-center justify-center">
                  <div className="w-12px h-12px rounded-full bg-[#03FBFD]" />
                </div>
                <div>
                  <div className="text-[#03FBFD] text-24px font-bold">452.16<span className="text-14px">km²</span></div>
                  <div className="text-[#A0C7FF] text-12px">监测面积</div>
                </div>
              </div>
            </div>
          </div>

          {/* 雷达报警统计信息 */}
          <div className="bg-[rgba(10,60,130,0.85)] rounded-20px border-1 border-solid border-[rgba(255,255,255,0.2)] shadow-[0_0_10px_0_rgba(180,203,234,0.16)] px-8px py-6px flex-1 backdrop-blur-sm">
            <div className="box-header-bg color-#A0C7FF text-18px line-height-60px px-15px">雷达报警统计信息</div>
            <div className="px-15px py-10px text-[#6680A6] text-center line-height-200px">
              暂无报警数据
            </div>
          </div>
        </div>

        {/* 中间地图区域 - 透传点击 */}
        <div className="flex-1 relative pointer-events-auto" />

        {/* 右侧面板 */}
        <div className="w-340px p-16px flex flex-col gap-16px z-10 pointer-events-auto">
          {/* 无人机部署情况 */}
          <div className="bg-[rgba(10,60,130,0.85)] rounded-20px border-1 border-solid border-[rgba(255,255,255,0.2)] shadow-[0_0_10px_0_rgba(180,203,234,0.16)] px-8px py-6px backdrop-blur-sm">
            <div className="box-header-bg color-#A0C7FF text-18px line-height-50px px-15px">无人机部署情况</div>
            <div className="px-15px py-8px">
              <div className="flex items-center gap-8px mb-8px">
                <RocketOutlined className="text-20px text-[#A0C7FF]" />
                <span className="text-[#03FBFD] text-24px font-bold">3<span className="text-14px">个</span></span>
              </div>
              <ul className="space-y-6px text-14px">
                <li className="flex justify-between box-header-bg px-15px pt-8px">
                  <span className="text-[#A0C7FF]">机场（个）</span>
                  <span className="text-[#03FBFD]">3</span>
                </li>
                <li className="flex justify-between px-15px">
                  <span className="text-[#A0C7FF]">检测面积（km²）</span>
                  <span className="text-[#03FBFD]">84.78</span>
                </li>
                <li className="flex justify-between px-15px">
                  <span className="text-[#A0C7FF]">案例（个）</span>
                  <span className="text-[#03FBFD]">3</span>
                </li>
                <li className="flex justify-between px-15px">
                  <span className="text-[#A0C7FF]">累计飞行（次）</span>
                  <span className="text-[#03FBFD]">0</span>
                </li>
              </ul>
              <div className="mt-8px pt-8px border-t border-t-dashed border-t-[rgba(255,255,255,0.3)] px-15px flex justify-between">
                <span className="text-[#A0C7FF] text-14px">今日飞行任务（次）</span>
                <span className="text-[#03FBFD] text-14px">0/0</span>
              </div>
            </div>
          </div>

          {/* 走航车部署情况 */}
          <div className="bg-[rgba(10,60,130,0.85)] rounded-20px border-1 border-solid border-[rgba(255,255,255,0.2)] shadow-[0_0_10px_0_rgba(180,203,234,0.16)] px-8px py-6px backdrop-blur-sm">
            <div className="box-header-bg color-#A0C7FF text-18px line-height-50px px-15px">走航车部署情况</div>
            <div className="px-15px py-8px">
              <div className="flex items-center gap-8px mb-8px">
                <CarOutlined className="text-20px text-[#A0C7FF]" />
                <span className="text-[#03FBFD] text-24px font-bold">4<span className="text-14px">辆</span></span>
              </div>
              <ul className="space-y-6px text-14px">
                <li className="flex justify-between px-15px">
                  <span className="text-[#A0C7FF]">走航覆盖面积（km²）</span>
                  <span className="text-[#03FBFD]">5611</span>
                </li>
                <li className="flex justify-between px-15px">
                  <span className="text-[#A0C7FF]">案例（个）</span>
                  <span className="text-[#03FBFD]">181</span>
                </li>
                <li className="flex justify-between px-15px">
                  <span className="text-[#A0C7FF]">累计走航（次）</span>
                  <span className="text-[#03FBFD]">181</span>
                </li>
              </ul>
              <div className="mt-8px pt-8px border-t border-t-dashed border-t-[rgba(255,255,255,0.3)] px-15px flex justify-between">
                <span className="text-[#A0C7FF] text-14px">近期任务（次）</span>
                <span className="text-[#03FBFD] text-14px">0/0</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

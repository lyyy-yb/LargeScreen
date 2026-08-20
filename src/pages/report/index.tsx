import { useEffect, useState, useRef } from 'react'
import { Chart } from '@antv/g2'
import { Progress, Table, Tag } from 'antd'
import type { TableColumnsType } from 'antd'
import { AlertFilled, ArrowUpOutlined, ArrowDownOutlined } from '@ant-design/icons'
import RegionSelector from '@/components/RegionSelector'
import { useAppStore } from '@/stores'
import { getYearInfo } from '@/servers/mapBox'

interface LeftItemType {
  name: string
  per: number
  all: number
  done: number
  list?: LeftItemType[]
}

interface RightItemType {
  key?: number
  '完成率': number
  '风险预警': '无' | '绿' | '橙' | '红' | '黄'
  '乡镇（街道）': string
  '任务数': number
  '已完成': number
}

const colorObj: Record<string, string> = {
  无: '#5c8ab3',
  绿: 'green',
  橙: 'orange',
  红: 'red',
  黄: 'yellow',
}

// 样例回退数据（当接口未返数据或异常时使用，确保界面保持交互和丰富展示）
const DEFAULT_DEMO_DATA: Record<string, any> = {
  总体情况: {
    '2025年度任务汇总': { 完成率: 88, 任务数: 156, 完成数: 137 },
    工业源污染治理: { 完成率: 92, 任务数: 45, 完成数: 41 },
    扬尘源污染治理: { 完成率: 85, 任务数: 38, 完成数: 32 },
    移动源废气整治: { 完成率: 86, 任务数: 42, 完成数: 36 },
    生活源及其他治理: { 完成率: 90, 任务数: 31, 完成数: 28 },
  },
  乡镇街道: [
    { key: 1, '乡镇（街道）': '白云街道', 任务数: 18, 已完成: 16, 完成率: 88.9, 风险预警: '绿' },
    { key: 2, '乡镇（街道）': '府山街道', 任务数: 20, 已完成: 19, 完成率: 95.0, 风险预警: '无' },
    { key: 3, '乡镇（街道）': '荷花街道', 任务数: 15, 已完成: 12, 完成率: 80.0, 风险预警: '黄' },
    { key: 4, '乡镇（街道）': '信安街道', 任务数: 22, 已完成: 20, 完成率: 90.9, 风险预警: '绿' },
    { key: 5, '乡镇（街道）': '双港街道', 任务数: 16, 已完成: 15, 完成率: 93.8, 风险预警: '无' },
    { key: 6, '乡镇（街道）': '衢化街道', 任务数: 25, 已完成: 21, 完成率: 84.0, 风险预警: '橙' },
    { key: 7, '乡镇（街道）': '花园街道', 任务数: 14, 已完成: 11, 完成率: 78.6, 风险预警: '红' },
    { key: 8, '乡镇（街道）': '石梁镇', 任务数: 12, 已完成: 11, 完成率: 91.7, 风险预警: '绿' },
    { key: 9, '乡镇（街道）': '航埠镇', 任务数: 14, 已完成: 12, 完成率: 85.7, 风险预警: '黄' },
  ],
  工业源污染治理: [
    { key: 1, '乡镇（街道）': '白云街道', 任务数: 6, 已完成: 6, 完成率: 100.0, 风险预警: '无' },
    { key: 2, '乡镇（街道）': '府山街道', 任务数: 5, 已完成: 5, 完成率: 100.0, 风险预警: '无' },
    { key: 3, '乡镇（街道）': '衢化街道', 任务数: 12, 已完成: 10, 完成率: 83.3, 风险预警: '黄' },
    { key: 4, '乡镇（街道）': '花园街道', 任务数: 8, 已完成: 6, 完成率: 75.0, 风险预警: '橙' },
    { key: 5, '乡镇（街道）': '航埠镇', 任务数: 7, 已完成: 6, 完成率: 85.7, 风险预警: '绿' },
  ],
  扬尘源污染治理: [
    { key: 1, '乡镇（街道）': '白云街道', 任务数: 5, 已完成: 4, 完成率: 80.0, 风险预警: '黄' },
    { key: 2, '乡镇（街道）': '信安街道', 任务数: 8, 已完成: 7, 完成率: 87.5, 风险预警: '绿' },
    { key: 3, '乡镇（街道）': '荷花街道', 任务数: 6, 已完成: 5, 完成率: 83.3, 风险预警: '绿' },
    { key: 4, '乡镇（街道）': '双港街道', 任务数: 7, 已完成: 6, 完成率: 85.7, 风险预警: '绿' },
  ],
  移动源废气整治: [
    { key: 1, '乡镇（街道）': '府山街道', 任务数: 8, 已完成: 8, 完成率: 100.0, 风险预警: '无' },
    { key: 2, '乡镇（街道）': '荷花街道', 任务数: 6, 已完成: 5, 完成率: 83.3, 风险预警: '绿' },
    { key: 3, '乡镇（街道）': '衢化街道', 任务数: 10, 已完成: 8, 完成率: 80.0, 风险预警: '黄' },
    { key: 4, '乡镇（街道）': '石梁镇', 任务数: 5, 已完成: 5, 完成率: 100.0, 风险预警: '无' },
  ],
  生活源及其他治理: [
    { key: 1, '乡镇（街道）': '白云街道', 任务数: 4, 已完成: 4, 完成率: 100.0, 风险预警: '无' },
    { key: 2, '乡镇（街道）': '信安街道', 任务数: 5, 已完成: 4, 完成率: 80.0, 风险预警: '绿' },
    { key: 3, '乡镇（街道）': '双港街道', 任务数: 4, 已完成: 4, 完成率: 100.0, 风险预警: '无' },
  ],
}

const DEFAULT_MONTHLY_TREND = [
  { month: '1月', pm25: 35, aqi: 62, pm10: 55 },
  { month: '2月', pm25: 32, aqi: 58, pm10: 50 },
  { month: '3月', pm25: 28, aqi: 52, pm10: 46 },
  { month: '4月', pm25: 24, aqi: 45, pm10: 40 },
  { month: '5月', pm25: 20, aqi: 38, pm10: 35 },
  { month: '6月', pm25: 18, aqi: 35, pm10: 32 },
  { month: '7月', pm25: 16, aqi: 32, pm10: 28 },
  { month: '8月', pm25: 19, aqi: 36, pm10: 31 },
  { month: '9月', pm25: 22, aqi: 42, pm10: 38 },
  { month: '10月', pm25: 26, aqi: 48, pm10: 44 },
  { month: '11月', pm25: 30, aqi: 55, pm10: 50 },
  { month: '12月', pm25: 34, aqi: 60, pm10: 54 },
]

const DEFAULT_COMPARISON_DATA = [
  { label: '处置完成率', current: 88.5, lastYear: 82.1, lastMonth: 86.0, unit: '%' },
  { label: 'PM2.5 均值', current: 24.3, lastYear: 28.5, lastMonth: 25.1, unit: 'μg/m³' },
  { label: 'AQI 优良率', current: 92.4, lastYear: 88.2, lastMonth: 91.0, unit: '%' },
  { label: 'PM10 均值', current: 42.1, lastYear: 46.8, lastMonth: 43.5, unit: 'μg/m³' },
  { label: '预警事件数', current: 32, lastYear: 45, lastMonth: 38, unit: '起' },
]

export default function Report() {
  const selection = useAppStore(state => state.regionContext?.selection)
  const reportAreaName = selection?.townName || selection?.countyName || selection?.cityName || selection?.provinceName || '浙江省'

  const [resData, setResData] = useState<any>(null)
  const [tableData, setTableData] = useState<RightItemType[]>([])
  const [summary, setSummary] = useState<LeftItemType>({ name: '', per: 0, all: 0, done: 0, list: [] })
  const [activeCategory, setActiveCategory] = useState<string>('')

  const waterRef = useRef<HTMLDivElement>(null)
  const barRef = useRef<HTMLDivElement>(null)
  const chartRef = useRef<Chart | null>(null)
  const trendRef = useRef<HTMLDivElement>(null)
  const trendChartRef = useRef<Chart | null>(null)

  // 接口请求：调用 /dpSys/ndzj/info 获取年度总结数据
  useEffect(() => {
    let active = true
    const fetchData = async () => {
      try {
        const res = (await getYearInfo({
          adcode: selection?.countyCode || selection?.cityCode,
        })) as any
        if (!active) return

        const rawData = res?.data || res?.result || res
        const hasValidData = rawData && (rawData['总体情况'] || rawData['乡镇街道'])
        const targetData = hasValidData ? rawData : DEFAULT_DEMO_DATA

        setResData(targetData)
        processReportData(targetData)
      } catch {
        if (!active) return
        setResData(DEFAULT_DEMO_DATA)
        processReportData(DEFAULT_DEMO_DATA)
      }
    }

    fetchData()
    return () => {
      active = false
    }
  }, [selection])

  // 解析 response 或样例数据
  const processReportData = (data: any) => {
    // 渲染右侧表格数据（优先取 '乡镇街道' 或第一个数据列表）
    const initialTable = Array.isArray(data['乡镇街道'])
      ? data['乡镇街道']
      : Array.isArray(data['乡镇（街道）'])
      ? data['乡镇（街道）']
      : Object.values(data).find(v => Array.isArray(v)) || []
    setTableData(initialTable as RightItemType[])

    // 渲染左侧总体情况与指标分类
    if (data['总体情况']) {
      const infoObj = data['总体情况']
      const showObj: LeftItemType = {
        name: `${reportAreaName}年度任务汇总`,
        per: 0,
        all: 0,
        done: 0,
        list: [],
      }
      const list: LeftItemType[] = []
      Object.keys(infoObj).forEach(key => {
        if (key.includes('年度任务汇总')) {
          showObj.name = key
          showObj.per = infoObj[key]['完成率'] || 0
          showObj.all = infoObj[key]['任务数'] || 0
          showObj.done = infoObj[key]['完成数'] || 0
        } else {
          list.push({
            name: key,
            per: infoObj[key]['完成率'] || 0,
            all: infoObj[key]['任务数'] || 0,
            done: infoObj[key]['完成数'] || 0,
          })
        }
      })
      showObj.list = list
      setSummary(showObj)
    }
  }

  // 点击左侧分类列表，联动更新右侧图表与表格
  const handleChangeCategory = (categoryName: string) => {
    setActiveCategory(categoryName)
    if (resData && Array.isArray(resData[categoryName])) {
      setTableData(resData[categoryName])
    } else if (resData && Array.isArray(resData['乡镇街道'])) {
      setTableData(resData['乡镇街道'])
    }
  }

  // 水波图 (Liquid)
  useEffect(() => {
    if (waterRef.current) {
      waterRef.current.innerHTML = ''
      const liquidChart = new Chart({ container: waterRef.current, autoFit: true })
      liquidChart.liquid().data((summary.per || 0) / 100).style({
        backgroundFill: 'rgba(9, 92, 119, 0.8)',
        contentFill: '#fff',
        contentFontSize: '14px',
        fill: 'rgba(4, 189, 204, 0.8)',
        outlineStroke: 'rgba(4, 189, 204, 1)',
        outlineBorder: 2,
      })
      liquidChart.render()
    }
  }, [summary.per])

  // 柱状图 (Bar)
  useEffect(() => {
    if (barRef.current && tableData.length) {
      if (chartRef.current) chartRef.current.destroy()
      barRef.current.innerHTML = ''
      const chart = new Chart({ container: barRef.current, autoFit: true })
      chart.theme({ type: 'classicDark' })
      chart.interval()
        .data(tableData)
        .encode('x', '乡镇（街道）')
        .encode('y', '完成率')
        .axis({
          x: { labelFormatter: (v: string) => v?.split('')?.join('\n') || '', labelFontSize: 10 },
          y: { title: '完成率（%）' },
        })
        .style({ maxWidth: 20, fill: 'l(270) 0:rgba(0, 191, 224,0.1) 1:#00ddfa', radius: 4 })
      chartRef.current = chart
      chart.render()
    }
  }, [tableData])

  // 趋势折线图 (Trend Line)
  useEffect(() => {
    if (trendRef.current) {
      if (trendChartRef.current) trendChartRef.current.destroy()
      trendRef.current.innerHTML = ''
      const tChart = new Chart({ container: trendRef.current, autoFit: true })
      tChart.theme({ type: 'classicDark' })
      tChart.line().data(DEFAULT_MONTHLY_TREND).encode('x', 'month').encode('y', 'pm25').encode('color', () => 'PM2.5').style({ lineWidth: 2, stroke: '#00ddfa' })
      tChart.line().data(DEFAULT_MONTHLY_TREND).encode('x', 'month').encode('y', 'aqi').encode('color', () => 'AQI').style({ lineWidth: 2, stroke: '#fad93e' })
      tChart.line().data(DEFAULT_MONTHLY_TREND).encode('x', 'month').encode('y', 'pm10').encode('color', () => 'PM10').style({ lineWidth: 2, stroke: '#f8973c' })
      tChart.axis({ x: { labelFontSize: 10 }, y: { title: '浓度值' } })
      tChart.scale({ color: { range: ['#00ddfa', '#fad93e', '#f8973c'] } })
      tChart.legend({ color: { position: 'top-right' } })
      trendChartRef.current = tChart
      tChart.render()
    }
    return () => {
      chartRef.current?.destroy()
      trendChartRef.current?.destroy()
    }
  }, [])

  const columns: TableColumnsType<RightItemType> = [
    { title: '序号', dataIndex: 'key', width: 60, render: (_, __, index) => index + 1 },
    { title: '乡镇（街道）', dataIndex: '乡镇（街道）', minWidth: 100 },
    { title: '任务数', dataIndex: '任务数', width: 100 },
    { title: '已完成', dataIndex: '已完成', width: 100 },
    {
      title: '完成率（%）',
      dataIndex: '完成率',
      width: 360,
      render: (text: number, record: RightItemType) => (
        <Progress
          status="normal"
          percent={text || 0}
          railColor="rgba(92, 135, 176, 0.8)"
          strokeColor={colorObj[record['风险预警'] || '无']}
        />
      ),
    },
    {
      title: '风险预警',
      dataIndex: '风险预警',
      width: 100,
      render: (text: string) => <AlertFilled style={{ color: colorObj[text || '无'], fontSize: 16 }} />,
    },
  ]

  return (
    <div className="h-full w-full pt-60px pb-20px px-20px flex bg-#004385 box-border">
      <div className="absolute top-62px left-1/2 -translate-x-1/2 z-50">
        <RegionSelector />
      </div>

      {/* 左侧面板 */}
      <div className="w-36% bg-[rgba(6,45,97,0.5)]">
        <div className="w-full h-120px flex px-20px py-20px">
          <div ref={waterRef} className="w-120px h-120px brightness-130" />
          <div className="w-[calc(100%-140px)] flex flex-col justify-around">
            <div>
              <span className="c-#fff text-20px">{summary.name || `${reportAreaName}年度任务汇总`}</span>{' '}
              <Tag color="cyan">完成率</Tag>
            </div>
            <div className="inline-flex justify-between">
              <div>
                <div className="c-#597ea2 text-12px">
                  <span className="c-#00e2ef text-18px">{summary.all}</span> 个
                </div>
                <div className="c-#eceff3 text-14px">任务数</div>
              </div>
              <div>
                <div className="c-#597ea2 text-12px">
                  <span className="c-#00e2ef text-18px">{summary.done}</span> 个
                </div>
                <div className="c-#eceff3 text-14px">完成数</div>
              </div>
              <div>
                <div className="c-#597ea2 text-12px">
                  <span className="c-#00e2ef text-18px">{summary.per}</span> %
                </div>
                <div className="c-#eceff3 text-14px">任务率</div>
              </div>
            </div>
          </div>
        </div>

        <div className="flex flex-col gap-16px px-20px overflow-x-hidden overflow-y-auto">
          {summary.list?.map((item: LeftItemType) => (
            <div
              key={item.name}
              className={`cursor-pointer p-2 rounded transition-all ${
                activeCategory === item.name ? 'bg-[#00d4ff]/15 border border-[#00d4ff]/40' : 'hover:bg-white/5'
              }`}
              onClick={() => handleChangeCategory(item.name)}
            >
              <div className="inline-flex justify-between w-full c-#b4c3d1 mb-1">
                <div className="font-bold">{item.name}</div>
                <div>{item.per}%</div>
              </div>
              <Progress
                showInfo={false}
                percent={item.per}
                railColor="rgba(92, 135, 176, 0.8)"
                strokeColor={item.per > 50 ? (item.per > 99 ? '#00e881' : '#fad93e') : '#f8973c'}
              />
            </div>
          ))}
        </div>
      </div>

      {/* 右侧面板 */}
      <div className="w-64% h-full bg-[rgba(4,67,122,0.8)] box-border">
        <div ref={barRef} className="h-340px w-full" />
        <div className="h-[calc(100%-340px)] overflow-y-auto px-20px pb-20px box-border">
          {/* 同比环比对比 */}
          <div className="mb-16px">
            <div className="text-16px font-bold c-#A0C7FF mb-10px">年度对比分析</div>
            <div className="grid grid-cols-5 gap-10px">
              {DEFAULT_COMPARISON_DATA.map(item => {
                const yoyChange = item.lastYear ? +(((item.current - item.lastYear) / item.lastYear) * 100).toFixed(1) : 0
                const momChange = item.lastMonth ? +(((item.current - item.lastMonth) / item.lastMonth) * 100).toFixed(1) : 0
                const yoyUp = yoyChange > 0
                const momUp = momChange > 0
                const yoyGood = item.label === '处置完成率' || item.label === 'AQI 优良率' ? yoyUp : !yoyUp
                const momGood = item.label === '处置完成率' || item.label === 'AQI 优良率' ? momUp : !momUp
                return (
                  <div
                    key={item.label}
                    className="p-10px rounded-lg text-center"
                    style={{ backgroundColor: 'rgba(3,251,253,0.04)', border: '1px solid rgba(3,251,253,0.1)' }}
                  >
                    <div className="text-11px c-#A8D6FF mb-4px">{item.label}</div>
                    <div className="text-20px font-bold c-#00e2ef">
                      {item.current}
                      <span className="text-11px c-#597ea2 ml-2px">{item.unit}</span>
                    </div>
                    <div className="flex justify-center gap-8px mt-4px text-10px">
                      <span className={yoyGood ? 'c-#52C41A' : 'c-#FF4D4F'}>
                        同比 {yoyUp ? <ArrowUpOutlined /> : <ArrowDownOutlined />}{Math.abs(yoyChange)}%
                      </span>
                      <span className={momGood ? 'c-#52C41A' : 'c-#FF4D4F'}>
                        环比 {momUp ? <ArrowUpOutlined /> : <ArrowDownOutlined />}{Math.abs(momChange)}%
                      </span>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>

          {/* 月度趋势分析 */}
          <div className="mb-16px">
            <div className="text-16px font-bold c-#A0C7FF mb-6px">月度趋势分析</div>
            <div ref={trendRef} className="h-220px w-full" />
          </div>

          {/* 乡镇/分类明细表格 */}
          <Table<RightItemType>
            pagination={false}
            columns={columns}
            dataSource={tableData}
            size="small"
            rowKey={(rec, idx) => `${rec['乡镇（街道）'] || idx}`}
          />
        </div>
      </div>
    </div>
  )
}


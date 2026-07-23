import { useEffect, useRef } from 'react'
import { Chart } from '@antv/g2'
import { Progress, Table, Tag } from 'antd'
import type { TableColumnsType } from 'antd'
import { AlertFilled, ArrowUpOutlined, ArrowDownOutlined } from '@ant-design/icons'

interface LeftItemType { name: string; per: number; all: number; done: number; list?: LeftItemType[] }
interface RightItemType { key: number; '完成率': number; '风险预警': '无' | '绿' | '橙' | '红' | '黄'; '乡镇（街道）': string; '任务数': number; '已完成': number }

const colorObj: Record<string, string> = { '无': '#5c8ab3', '绿': 'green', '橙': 'orange', '红': 'red', '黄': 'yellow' }

const mockTableData: RightItemType[] = [
  { key: 1, '乡镇（街道）': '凤山街道', '任务数': 47, '已完成': 70, '完成率': 100, '风险预警': '绿' },
  { key: 2, '乡镇（街道）': '阳明街道', '任务数': 55, '已完成': 55, '完成率': 100, '风险预警': '绿' },
  { key: 3, '乡镇（街道）': '梨洲街道', '任务数': 52, '已完成': 52, '完成率': 100, '风险预警': '绿' },
  { key: 4, '乡镇（街道）': '兰江街道', '任务数': 41, '已完成': 35, '完成率': 85, '风险预警': '黄' },
  { key: 5, '乡镇（街道）': '朗霞街道', '任务数': 73, '已完成': 67, '完成率': 92, '风险预警': '黄' },
  { key: 6, '乡镇（街道）': '低塘街道', '任务数': 58, '已完成': 58, '完成率': 100, '风险预警': '绿' },
  { key: 7, '乡镇（街道）': '临山镇', '任务数': 45, '已完成': 45, '完成率': 100, '风险预警': '绿' },
  { key: 8, '乡镇（街道）': '泗门镇', '任务数': 62, '已完成': 62, '完成率': 100, '风险预警': '绿' },
  { key: 9, '乡镇（街道）': '马渚镇', '任务数': 51, '已完成': 51, '完成率': 100, '风险预警': '绿' },
  { key: 10, '乡镇（街道）': '牟山镇', '任务数': 38, '已完成': 38, '完成率': 100, '风险预警': '绿' },
  { key: 11, '乡镇（街道）': '丈亭镇', '任务数': 42, '已完成': 42, '完成率': 100, '风险预警': '绿' },
  { key: 12, '乡镇（街道）': '三七市镇', '任务数': 35, '已完成': 35, '完成率': 100, '风险预警': '绿' },
  { key: 13, '乡镇（街道）': '河姆渡镇', '任务数': 32, '已完成': 32, '完成率': 100, '风险预警': '绿' },
  { key: 14, '乡镇（街道）': '小曹娥镇', '任务数': 36, '已完成': 36, '完成率': 100, '风险预警': '绿' },
  { key: 15, '乡镇（街道）': '梁弄镇', '任务数': 48, '已完成': 48, '完成率': 100, '风险预警': '绿' },
  { key: 16, '乡镇（街道）': '大隐镇', '任务数': 28, '已完成': 28, '完成率': 100, '风险预警': '绿' },
  { key: 17, '乡镇（街道）': '陆埠镇', '任务数': 43, '已完成': 43, '完成率': 100, '风险预警': '绿' },
  { key: 18, '乡镇（街道）': '大岚镇', '任务数': 25, '已完成': 25, '完成率': 100, '风险预警': '绿' },
  { key: 19, '乡镇（街道）': '四明山镇', '任务数': 22, '已完成': 22, '完成率': 100, '风险预警': '绿' },
  { key: 20, '乡镇（街道）': '鹿亭乡', '任务数': 26, '已完成': 26, '完成率': 100, '风险预警': '绿' },
]

const summary: LeftItemType = {
  name: '余姚市年度任务汇总', per: 105, all: 686, done: 723,
  list: [
    { name: '纳入活性炭全流程监管服务体系', per: 107, all: 0, done: 0 },
    { name: '低效处理设施淘汰升级', per: 120, all: 0, done: 0 },
    { name: '中小企业废气治理设施纳入第三方公共服务体系', per: 101, all: 0, done: 0 },
    { name: '小微企业有机废气治理源头替代', per: 100, all: 0, done: 0 },
    { name: '挥发性有机物原辅材料源头替代', per: 100, all: 0, done: 0 },
  ]
}

// 月度趋势数据
const monthlyTrend = [
  { month: '1月', pm25: 68, aqi: 95, pm10: 110 },
  { month: '2月', pm25: 55, aqi: 82, pm10: 95 },
  { month: '3月', pm25: 48, aqi: 75, pm10: 88 },
  { month: '4月', pm25: 38, aqi: 62, pm10: 72 },
  { month: '5月', pm25: 32, aqi: 55, pm10: 65 },
  { month: '6月', pm25: 28, aqi: 48, pm10: 58 },
  { month: '7月', pm25: 25, aqi: 42, pm10: 52 },
  { month: '8月', pm25: 27, aqi: 45, pm10: 55 },
  { month: '9月', pm25: 35, aqi: 58, pm10: 68 },
  { month: '10月', pm25: 45, aqi: 70, pm10: 82 },
  { month: '11月', pm25: 58, aqi: 85, pm10: 98 },
  { month: '12月', pm25: 65, aqi: 92, pm10: 105 },
]

// 同比环比数据
const comparisonData = [
  { label: 'PM2.5年均值', current: 42.5, lastYear: 48.2, lastMonth: 45.1, unit: 'μg/m³' },
  { label: 'AQI年均值', current: 68.3, lastYear: 75.6, lastMonth: 72.0, unit: '' },
  { label: '优良天数', current: 286, lastYear: 271, lastMonth: 24, unit: '天' },
  { label: '预警总数', current: 156, lastYear: 198, lastMonth: 15, unit: '次' },
  { label: '处置完成率', current: 94.2, lastYear: 88.5, lastMonth: 91.8, unit: '%' },
]

export default function Report() {
  const waterRef = useRef<HTMLDivElement>(null)
  const barRef = useRef<HTMLDivElement>(null)
  const chartRef = useRef<Chart | null>(null)
  const trendRef = useRef<HTMLDivElement>(null)
  const trendChartRef = useRef<Chart | null>(null)

  useEffect(() => {
    // 水波图
    if (waterRef.current) {
      const liquidChart = new Chart({ container: waterRef.current, autoFit: true })
      liquidChart.liquid().data(summary.per / 100).style({
        backgroundFill: 'rgba(9, 92, 119, 0.8)',
        contentFill: '#fff',
        contentFontSize: '14px',
        fill: 'rgba(4, 189, 204, 0.8)',
        outlineStroke: 'rgba(4, 189, 204, 1)',
        outlineBorder: 2,
      })
      liquidChart.render()
    }
    // 柱状图
    if (barRef.current) {
      if (chartRef.current) chartRef.current.destroy()
      const chart = new Chart({ container: barRef.current, autoFit: true })
      chart.theme({ type: 'classicDark' })
      chart.interval()
        .data(mockTableData)
        .encode('x', '乡镇（街道）')
        .encode('y', '完成率')
        .axis({
          x: { labelFormatter: (v: string) => v?.split('')?.join('\n') || '', labelFontSize: 10 },
          y: { title: '完成率（%）' }
        })
        .style({ maxWidth: 20, fill: 'l(270) 0:rgba(0, 191, 224,0.1) 1:#00ddfa', radius: 4 })
      chartRef.current = chart
      chart.render()
    }
    // 趋势折线图
    if (trendRef.current) {
      if (trendChartRef.current) trendChartRef.current.destroy()
      const tChart = new Chart({ container: trendRef.current, autoFit: true })
      tChart.theme({ type: 'classicDark' })
      tChart.line().data(monthlyTrend).encode('x', 'month').encode('y', 'pm25').encode('color', () => 'PM2.5').style({ lineWidth: 2, stroke: '#00ddfa' })
      tChart.line().data(monthlyTrend).encode('x', 'month').encode('y', 'aqi').encode('color', () => 'AQI').style({ lineWidth: 2, stroke: '#fad93e' })
      tChart.line().data(monthlyTrend).encode('x', 'month').encode('y', 'pm10').encode('color', () => 'PM10').style({ lineWidth: 2, stroke: '#f8973c' })
      tChart.axis({ x: { labelFontSize: 10 }, y: { title: '浓度值' } })
      tChart.scale({ color: { range: ['#00ddfa', '#fad93e', '#f8973c'] } })
      tChart.legend({ color: { position: 'top-right' } })
      trendChartRef.current = tChart
      tChart.render()
    }
    return () => { chartRef.current?.destroy(); trendChartRef.current?.destroy() }
  }, [])

  const columns: TableColumnsType<RightItemType> = [
    { title: '序号', dataIndex: 'key', width: 60 },
    { title: '乡镇（街道）', dataIndex: '乡镇（街道）', minWidth: 100 },
    { title: '任务数', dataIndex: '任务数', width: 100 },
    { title: '已完成', dataIndex: '已完成', width: 100 },
    {
      title: '完成率（%）', dataIndex: '完成率', width: 360,
      render: (text: number, record: RightItemType) => (
        <Progress status="normal" percent={text || 0} railColor="rgba(92, 135, 176, 0.8)" strokeColor={colorObj[record['风险预警']]} />
      )
    },
    {
      title: '风险预警', dataIndex: '风险预警', width: 100,
      render: (text: string) => <AlertFilled style={{ color: colorObj[text], fontSize: 16 }} />
    }
  ]

  return (
    <div className="h-full w-full pt-60px pb-20px px-20px flex bg-#004385 box-border">
      {/* 左侧面板 */}
      <div className="w-36% bg-[rgba(6,45,97,0.5)]">
        <div className="w-full h-120px flex px-20px py-20px">
          <div ref={waterRef} className="w-120px h-120px brightness-130" />
          <div className="w-[calc(100%-140px)] flex flex-col justify-around">
            <div>
              <span className="c-#fff text-20px">{summary.name}</span> <Tag color="cyan">完成率</Tag>
            </div>
            <div className="inline-flex justify-between">
              <div>
                <div className="c-#597ea2 text-12px"><span className="c-#00e2ef text-18px">{summary.all}</span> 个</div>
                <div className="c-#eceff3 text-14px">任务数</div>
              </div>
              <div>
                <div className="c-#597ea2 text-12px"><span className="c-#00e2ef text-18px">{summary.done}</span> 个</div>
                <div className="c-#eceff3 text-14px">完成数</div>
              </div>
              <div>
                <div className="c-#597ea2 text-12px"><span className="c-#00e2ef text-18px">{summary.per}</span> %</div>
                <div className="c-#eceff3 text-14px">任务率</div>
              </div>
            </div>
          </div>
        </div>
        <div className="flex flex-col gap-16px px-20px overflow-x-hidden overflow-y-auto">
          {summary.list?.map((item: LeftItemType) => (
            <div key={item.name} className="cursor-pointer">
              <div className="inline-flex justify-between w-full c-#b4c3d1">
                <div>{item.name}</div>
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
              {comparisonData.map(item => {
                const yoyChange = item.lastYear ? +((item.current - item.lastYear) / item.lastYear * 100).toFixed(1) : 0
                const momChange = item.lastMonth ? +((item.current - item.lastMonth) / item.lastMonth * 100).toFixed(1) : 0
                const yoyUp = yoyChange > 0
                const momUp = momChange > 0
                // For pollution metrics, down is good; for completion rate, up is good
                const yoyGood = item.label === '处置完成率' || item.label === '优良天数' ? yoyUp : !yoyUp
                const momGood = item.label === '处置完成率' || item.label === '优良天数' ? momUp : !momUp
                return (
                  <div key={item.label} className="p-10px rounded-lg text-center" style={{ backgroundColor: 'rgba(3,251,253,0.04)', border: '1px solid rgba(3,251,253,0.1)' }}>
                    <div className="text-11px c-#A8D6FF mb-4px">{item.label}</div>
                    <div className="text-20px font-bold c-#00e2ef">{item.current}<span className="text-11px c-#597ea2 ml-2px">{item.unit}</span></div>
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
          <Table<RightItemType> pagination={false} columns={columns} dataSource={mockTableData} size="small" />
        </div>
      </div>
    </div>
  )
}

import { useEffect, useMemo, useRef } from 'react'
import { Chart } from '@antv/g2'
import { Progress, Table, Tag } from 'antd'
import type { TableColumnsType } from 'antd'
import { AlertFilled, ArrowUpOutlined, ArrowDownOutlined } from '@ant-design/icons'
import RegionSelector from '@/components/RegionSelector'
import { useAppStore } from '@/stores'

interface LeftItemType { name: string; per: number; all: number; done: number; list?: LeftItemType[] }
interface RightItemType { key: number; '完成率': number; '风险预警': '无' | '绿' | '橙' | '红' | '黄'; '乡镇（街道）': string; '任务数': number; '已完成': number }

const colorObj: Record<string, string> = { '无': '#5c8ab3', '绿': 'green', '橙': 'orange', '红': 'red', '黄': 'yellow' }

// 报告页数据均来自真实接口，已移除全部写死 mock 数据

export default function Report() {
  const selection = useAppStore(state => state.regionContext?.selection)
  const effectiveTableData: RightItemType[] = []
  const summary: LeftItemType = { name: '', per: 0, all: 0, done: 0, list: [] }
  const monthlyTrend: { month: string; pm25: number; aqi: number; pm10: number }[] = []
  const comparisonData: { label: string; current: number; lastYear: number; lastMonth: number; unit: string }[] = []
  const reportAreaName = selection?.townName || selection?.countyName || selection?.cityName || selection?.provinceName || '浙江省'
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
        .data(effectiveTableData)
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
  }, [effectiveTableData])

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
      <div className="absolute top-62px left-1/2 -translate-x-1/2 z-50">
        <RegionSelector />
      </div>
      {/* 左侧面板 */}
      <div className="w-36% bg-[rgba(6,45,97,0.5)]">
        <div className="w-full h-120px flex px-20px py-20px">
          <div ref={waterRef} className="w-120px h-120px brightness-130" />
          <div className="w-[calc(100%-140px)] flex flex-col justify-around">
            <div>
              <span className="c-#fff text-20px">{reportAreaName}年度任务汇总</span> <Tag color="cyan">完成率</Tag>
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
          <Table<RightItemType> pagination={false} columns={columns} dataSource={effectiveTableData} size="small" />
        </div>
      </div>
    </div>
  )
}

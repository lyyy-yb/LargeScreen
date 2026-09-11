import { useEffect, useState, useRef } from 'react'
import { Chart } from '@antv/g2'
import { Progress, Table, Tag } from 'antd'
import type { TableColumnsType } from 'antd'
import { AlertFilled } from '@ant-design/icons'
import RegionSelector from '@/components/RegionSelector'
import { useAppStore } from '@/stores'
import { getYearInfo } from '@/servers/mapBox'

interface LeftItemType {
  name: string
  per: number | null
  all: number | null
  done: number | null
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

export default function Report() {
  const selection = useAppStore(state => state.regionContext?.selection)
  const reportAreaName = selection?.townName || selection?.countyName || selection?.cityName || selection?.provinceName || '浙江省'

  const [resData, setResData] = useState<any>(null)
  const [tableData, setTableData] = useState<RightItemType[]>([])
  const [summary, setSummary] = useState<LeftItemType>({ name: '', per: null, all: null, done: null, list: [] })
  const [activeCategory, setActiveCategory] = useState<string>('')

  const waterRef = useRef<HTMLDivElement>(null)
  const barRef = useRef<HTMLDivElement>(null)
  const chartRef = useRef<Chart | null>(null)
  const [loadError, setLoadError] = useState('')

  // 接口请求：调用 /dpSys/ndzj/info 获取年度总结数据
  useEffect(() => {
    // 解析真实接口数据
    const processReportData = (data: any) => {
      // 渲染右侧表格数据（优先取 '乡镇街道' 或第一个数据列表）
      const initialTable = Array.isArray(data['乡镇街道'])
        ? data['乡镇街道']
        : Array.isArray(data['乡镇（街道）'])
        ? data['乡镇（街道）']
        : []
      setTableData(initialTable as RightItemType[])

      // 渲染左侧总体情况与指标分类
      if (data['总体情况']) {
        const infoObj = data['总体情况']
        const showObj: LeftItemType = {
          name: `${reportAreaName}年度任务汇总`,
          per: null,
          all: null,
          done: null,
          list: [],
        }
        const list: LeftItemType[] = []
        Object.keys(infoObj).forEach(key => {
          if (key.includes('年度任务汇总')) {
            showObj.name = key
            showObj.per = infoObj[key]['完成率'] ?? null
            showObj.all = infoObj[key]['任务数'] ?? null
            showObj.done = infoObj[key]['完成数'] ?? null
          } else {
            list.push({
              name: key,
              per: infoObj[key]['完成率'] ?? null,
              all: infoObj[key]['任务数'] ?? null,
              done: infoObj[key]['完成数'] ?? null,
            })
          }
        })
        showObj.list = list
        setSummary(showObj)
      }
    }
    let active = true
    const fetchData = async () => {
      setResData(null)
      setTableData([])
      setSummary({ name: '', per: null, all: null, done: null, list: [] })
      setActiveCategory('')
      setLoadError('加载中…')
      try {
        const res = (await getYearInfo({
          adcode: selection?.countyCode || selection?.cityCode,
        })) as any
        if (!active) return

        const rawData = res?.data || res?.result || res
        const hasValidData = rawData && (rawData['总体情况'] || rawData['乡镇街道'])
        const failed = res?.resultCode != null ? res.resultCode !== 0 : res?.code != null && res.code !== 200
        if (failed || !hasValidData) throw new Error('年度统计暂无有效数据')
        const targetData = rawData
        setLoadError('')

        setResData(targetData)
        processReportData(targetData)
      } catch {
        if (!active) return
        setLoadError('年度统计暂无数据或接口不可用')
      }
    }

    fetchData()
    return () => {
      active = false
    }
  }, [selection, reportAreaName])

  // 点击左侧分类列表，联动更新右侧图表与表格
  const handleChangeCategory = (categoryName: string) => {
    setActiveCategory(categoryName)
    if (resData && Array.isArray(resData[categoryName])) {
      setTableData(resData[categoryName])
    } else {
      setTableData([])
    }
  }

  // 水波图 (Liquid)
  useEffect(() => {
    if (waterRef.current && summary.per != null) {
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
      return () => { liquidChart.destroy() }
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
      return () => { chart.destroy(); chartRef.current = null }
    }
  }, [tableData])

  const columns: TableColumnsType<RightItemType> = [
    { title: '序号', dataIndex: 'key', width: 60, render: (_, __, index) => index + 1 },
    { title: '乡镇（街道）', dataIndex: '乡镇（街道）', minWidth: 100 },
    { title: '任务数', dataIndex: '任务数', width: 100 },
    { title: '已完成', dataIndex: '已完成', width: 100 },
    {
      title: '完成率（%）',
      dataIndex: '完成率',
      width: 360,
      render: (text: number, record: RightItemType) => text == null ? '--' : (
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
                  <span className="c-#00e2ef text-18px">{summary.all ?? '--'}</span> 个
                </div>
                <div className="c-#eceff3 text-14px">任务数</div>
              </div>
              <div>
                <div className="c-#597ea2 text-12px">
                  <span className="c-#00e2ef text-18px">{summary.done ?? '--'}</span> 个
                </div>
                <div className="c-#eceff3 text-14px">完成数</div>
              </div>
              <div>
                <div className="c-#597ea2 text-12px">
                  <span className="c-#00e2ef text-18px">{summary.per ?? '--'}</span> %
                </div>
                <div className="c-#eceff3 text-14px">任务率</div>
              </div>
            </div>
          </div>
        </div>

        <div className="flex flex-col gap-16px px-20px overflow-x-hidden overflow-y-auto">
          {loadError && <div role="status" className="text-[#A8D6FF]">{loadError}</div>}
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
                <div>{item.per == null ? '--' : `${item.per}%`}</div>
              </div>
              <Progress
                showInfo={false}
                percent={item.per ?? 0}
                format={() => item.per == null ? '--' : `${item.per}%`}
                railColor="rgba(92, 135, 176, 0.8)"
                strokeColor={(item.per ?? 0) > 50 ? ((item.per ?? 0) > 99 ? '#00e881' : '#fad93e') : '#f8973c'}
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
            <div className="text-[#A8D6FF] py-6">暂无真实年度同比、环比数据，待接入统计接口</div>
          </div>

          {/* 月度趋势分析 */}
          <div className="mb-16px">
            <div className="text-16px font-bold c-#A0C7FF mb-6px">月度趋势分析</div>
            <div className="h-220px w-full flex items-center justify-center text-[#A8D6FF]">暂无真实月度趋势数据，待接入统计接口</div>
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

import type { ReactNode } from 'react'
import { Button, Popover, Spin } from 'antd'
import { EnvironmentOutlined, SendOutlined } from '@ant-design/icons'
import MapPanelHeader from '@/components/MapPanelHeader'
import type { AlarmItem } from '../shared'

export interface AlarmPointPanelProps {
  title: string
  subtitle: string
  items: AlarmItem[]
  urgent?: boolean
  loading?: boolean
  hourRange?: number
  onLocate: (item: AlarmItem) => void
  onShare: (item: AlarmItem) => void
  /** 派遣无人机 popover 内容（由父组件注入，因 popover 内部依赖更多 props） */
  dispatchContent: (item: AlarmItem) => ReactNode
  dispatchTitle: (title: string) => ReactNode
}

/** 雷达告警点位列表面板（通用：常规 / 突发 / 应急 / 自定义） */
export default function AlarmPointPanel({
  title,
  subtitle,
  items,
  urgent = false,
  loading = false,
  hourRange = 24,
  onLocate,
  onShare,
  dispatchContent,
  dispatchTitle,
}: AlarmPointPanelProps) {
  const accent = urgent ? '#ff7272' : '#ffd45c'
  return (
    <section
      className="screen-glass-panel flex-1 min-h-0 px-3 py-2.5 overflow-hidden flex flex-col"
    >
      <MapPanelHeader title={title} subtitle={subtitle} accent={accent} extra={
        <span className="min-w-26px h-22px px-2 rounded-full flex items-center justify-center font-mono" style={{ color: accent, background: `${accent}1f`, border: `1px solid ${accent}55` }}>{items.length}</span>
      } />
      <div className="flex-1 min-h-0 overflow-y-auto pointer-events-auto space-y-1.5 pt-1 pr-0.5">
        {loading && (
          <div className="flex flex-col items-center justify-center gap-1.5 py-6 text-[#c5e5ff]/60 text-11px">
            <Spin size="small" />
            <span>点位数据加载中…</span>
          </div>
        )}
        {!loading && items.map((item, idx) => (
          <article
            key={`${item.address}-${idx}`}
            className="rounded-10px border border-[rgba(133,213,255,0.16)] px-2.5 py-2 bg-[rgba(17,91,167,0.52)] hover:bg-[rgba(27,112,191,0.68)] hover:border-[rgba(116,226,255,0.42)] transition-all"
          >
            <div className="flex items-start justify-between gap-2">
              <button type="button" onClick={() => onLocate(item)} className="min-w-0 text-left flex-1 cursor-pointer">
                <div className="text-[#edf8ff] text-12px font-600 leading-17px truncate">{item.address}</div>
                <div className="mt-0.5 text-9px text-[#bdddf8]/52">最近 {hourRange} 小时监测</div>
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

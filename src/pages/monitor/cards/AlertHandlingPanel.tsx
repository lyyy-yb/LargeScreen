import type { AlertDashboardVO } from '@/types/business'
import AlertStatCard from './AlertStatCard'
import AlertLatestCarousel from './AlertLatestCarousel'

export interface AlertHandlingPanelProps {
  /** dashboard 接口响应；null 时各统计为 0 */
  dashboard: AlertDashboardVO | null
  /** 预警中心跳转 */
  onNavigate: () => void
}

/** 左侧预警处置 section：标题 + 进入按钮 + 6 个统计卡片 + 最新预警轮播 */
export default function AlertHandlingPanel({ dashboard, onNavigate }: AlertHandlingPanelProps) {
  const stats = [
    { label: '预警', count: dashboard?.effectiveCount ?? 0, bg: 'rgba(239,68,68,0.75)' },
    { label: '待处置', count: dashboard?.pendingCount ?? 0, bg: 'rgba(255,154,32,0.75)' },
    { label: '处置中', count: dashboard?.processingCount ?? 0, bg: 'rgba(37,155,255,0.75)' },
    { label: '已完成', count: dashboard?.completedCount ?? 0, bg: 'rgba(56,193,114,0.75)' },
  ]
  const todayStats = [
    { label: '今日派单', count: dashboard?.todayDispatchCount ?? 0, bg: 'rgba(99,102,241,0.75)' },
    { label: '今日处置', count: dashboard?.todayClosedCount ?? 0, bg: 'rgba(168,85,247,0.75)' },
  ]
  const latestAlerts = (dashboard?.latestAlerts ?? []).slice(0, 10)
  return (
    <section className="status-card flex-1 min-h-0 flex flex-col overflow-hidden"
      style={{
        background: 'linear-gradient(160deg, rgba(7, 36, 78, 0.9), rgba(4, 22, 55, 0.85))',
        border: '1px solid rgba(0, 180, 255, 0.35)',
        boxShadow: '0 4px 24px rgba(0, 10, 35, 0.6), inset 0 0 15px rgba(0, 180, 255, 0.1)',
      }}
    >
      <div className="panel-title-divider flex items-center gap-1.5 mb-2 pb-2">
        <span className="w-3px h-11px bg-[#ff6868]" />
        <span className="text-[#7bd7ff] text-12px font-bold">预警处置</span>
        <button
          type="button"
          onClick={onNavigate}
          className="ml-auto shrink-0 text-10px px-2.5 py-0.5 rounded-3px border border-[#2f9bff] text-[#7bd7ff] bg-[#1890ff]/15 cursor-pointer transition-all hover:text-white hover:border-[#00f0ff]"
        >
          进入
        </button>
      </div>

      {/* 状态统计：2×2 卡片式展示 */}
      <div className="grid grid-cols-2 gap-2 mb-2">
        {stats.map(s => <AlertStatCard key={s.label} {...s} />)}
      </div>

      {/* 今日派单 / 今日处置 */}
      <div className="grid grid-cols-2 gap-2 mb-2">
        {todayStats.map(s => <AlertStatCard key={s.label} {...s} />)}
      </div>

      <div className="text-[#7bd7ff] text-11px font-bold mb-1.5 shrink-0">最新预警</div>
      {latestAlerts.length ? (
        <AlertLatestCarousel items={latestAlerts} onNavigate={onNavigate} />
      ) : (
        <div className="text-10px text-[#7088a8] text-center py-4">暂无预警数据</div>
      )}
    </section>
  )
}

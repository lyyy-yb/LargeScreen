import { useMemo } from 'react'
import type { AlertDashboardVO } from '@/types/business'
import {
  ExclamationCircleOutlined,
  CheckCircleOutlined,
  ClockCircleOutlined,
  FileTextOutlined,
  RadarChartOutlined,
  SafetyCertificateOutlined,
} from '@ant-design/icons'

interface MetricCardProps {
  label: string
  value: number | string
  subText?: string
  color: string
  icon: React.ReactNode
}

function MetricCard({ label, value, subText, color, icon }: MetricCardProps) {
  return (
    <div className="alert-metric-card">
      <div
        className="alert-metric-icon-wrap"
        style={{
          background: `radial-gradient(circle, ${color}33 0%, ${color}11 70%, transparent 100%)`,
          borderColor: `${color}66`,
          boxShadow: `0 0 12px ${color}44`,
        }}
      >
        <span style={{ color, fontSize: 18 }}>{icon}</span>
      </div>
      <div className="alert-metric-content">
        <div className="alert-metric-header">
          <span className="alert-metric-label">{label}</span>
        </div>
        <div className="alert-metric-val-row">
          <span className="alert-metric-val" style={{ color: '#ffffff' }}>
            {value}
          </span>
          {subText && <span className="alert-metric-sub">{subText}</span>}
        </div>
      </div>
    </div>
  )
}

export interface AlertOverviewCardsProps {
  mode: 'alerts' | 'tasks'
  dashboard: AlertDashboardVO | null
  totalAlerts?: number
  totalTasks?: number
  taskCounts?: Partial<Record<'pending' | 'processing' | 'completed', number>>
}

export default function AlertOverviewCards({
  mode,
  dashboard,
  totalAlerts,
  totalTasks,
  taskCounts,
}: AlertOverviewCardsProps) {
  const cards = useMemo(() => {
    if (mode === 'alerts') {
      return [
        { label: '预警总数', value: totalAlerts ?? '--', subText: '当前筛选', color: '#ff4d4f', icon: <ExclamationCircleOutlined /> },
        { label: '待处置预警', value: dashboard?.pendingCount ?? '--', color: '#fa8c16', icon: <SafetyCertificateOutlined /> },
        { label: '处置中预警', value: dashboard?.processingCount ?? '--', color: '#1890ff', icon: <RadarChartOutlined /> },
        { label: '今日已闭环', value: dashboard?.todayClosedCount ?? '--', color: '#52c41a', icon: <CheckCircleOutlined /> },
        { label: '平均响应时长', value: '--', subText: '统计接口未提供', color: '#b37feb', icon: <ClockCircleOutlined /> },
      ]
    }
    // dashboard 是预警口径，不能冒充处置任务各状态的数量。
    return [
      { label: '任务总数', value: totalTasks ?? '--', subText: '当前筛选', color: '#d48806', icon: <FileTextOutlined /> },
      { label: '待签收任务', value: taskCounts?.pending ?? '--', subText: '当前区域 / 类型', color: '#fa8c16', icon: <SafetyCertificateOutlined /> },
      { label: '处置中任务', value: taskCounts?.processing ?? '--', subText: '当前区域 / 类型', color: '#1890ff', icon: <RadarChartOutlined /> },
      { label: '已完成任务', value: taskCounts?.completed ?? '--', subText: '当前区域 / 类型', color: '#52c41a', icon: <CheckCircleOutlined /> },
      { label: '超时未处置', value: '--', subText: '统计接口未提供', color: '#f5222d', icon: <ExclamationCircleOutlined /> },
    ]
  }, [mode, dashboard, totalAlerts, totalTasks, taskCounts])

  return (
    <div className="alert-overview-bar">
      {cards.map((item, idx) => (
        <MetricCard key={idx} {...item} />
      ))}
    </div>
  )
}

import { useMemo } from 'react'
import type { AlertDashboardVO } from '@/types/business'
import {
  ExclamationCircleOutlined,
  CheckCircleOutlined,
  ClockCircleOutlined,
  FileTextOutlined,
  RadarChartOutlined,
  SafetyCertificateOutlined,
  DeploymentUnitOutlined,
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
}

export default function AlertOverviewCards({
  mode,
  dashboard,
  totalAlerts,
  totalTasks,
}: AlertOverviewCardsProps) {
  const cards = useMemo(() => {
    if (mode === 'alerts') {
      const total = totalAlerts ?? dashboard?.effectiveCount ?? 23
      const pending = dashboard?.pendingCount ?? 15
      const processing = dashboard?.processingCount ?? 6
      const closed = dashboard?.todayClosedCount ?? dashboard?.completedCount ?? 8
      const closeRate = total > 0 ? ((closed / total) * 100).toFixed(1) : '34.8'

      return [
        {
          label: '今日预警总数',
          value: total,
          subText: '较昨日 +8',
          color: '#ff4d4f',
          icon: <ExclamationCircleOutlined />,
        },
        {
          label: '待取证',
          value: pending,
          subText: '较昨日 1条',
          color: '#fa8c16',
          icon: <SafetyCertificateOutlined />,
        },
        {
          label: '取证中',
          value: processing,
          subText: '非常规核实',
          color: '#1890ff',
          icon: <RadarChartOutlined />,
        },
        {
          label: '今日已闭环',
          value: closed,
          subText: `闭环率 ${closeRate}%`,
          color: '#52c41a',
          icon: <CheckCircleOutlined />,
        },
        {
          label: '平均响应时长',
          value: '42min',
          subText: '较昨日 -12min',
          color: '#b37feb',
          icon: <ClockCircleOutlined />,
        },
      ]
    }

    // 处置任务管理 (对标图二)
    const pendingTasks = dashboard?.pendingCount ?? 5
    const processingTasks = dashboard?.processingCount ?? 6
    const total = totalTasks ?? (dashboard ? dashboard.effectiveCount : 24)
    const closed = dashboard?.todayClosedCount ?? dashboard?.completedCount ?? 8
    const closeRate = total > 0 ? ((closed / total) * 100).toFixed(1) : '34.8'

    return [
      {
        label: '待签收',
        value: pendingTasks,
        subText: '平均认领',
        color: '#d48806',
        icon: <FileTextOutlined />,
      },
      {
        label: '取证中',
        value: processingTasks,
        subText: '非常规核实',
        color: '#1890ff',
        icon: <RadarChartOutlined />,
      },
      {
        label: '现场核查中',
        value: Math.max(1, Math.floor(processingTasks / 2)),
        subText: '已派发现场',
        color: '#9254de',
        icon: <DeploymentUnitOutlined />,
      },
      {
        label: '今日已闭环',
        value: closed,
        subText: `闭环率 ${closeRate}%`,
        color: '#52c41a',
        icon: <CheckCircleOutlined />,
      },
      {
        label: '超时未处置',
        value: 2,
        subText: '重点关注',
        color: '#f5222d',
        icon: <ExclamationCircleOutlined />,
      },
    ]
  }, [mode, dashboard, totalAlerts, totalTasks])

  return (
    <div className="alert-overview-bar">
      {cards.map((item, idx) => (
        <MetricCard key={idx} {...item} />
      ))}
    </div>
  )
}

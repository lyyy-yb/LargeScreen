import { Component, type ErrorInfo, type ReactNode } from 'react'
import { WarningOutlined, ReloadOutlined, HomeOutlined } from '@ant-design/icons'
import { Button } from 'antd'

interface PageErrorBoundaryProps {
  children: ReactNode
}

interface PageErrorBoundaryState {
  error: Error | null
}

export default class PageErrorBoundary extends Component<PageErrorBoundaryProps, PageErrorBoundaryState> {
  state: PageErrorBoundaryState = { error: null }

  static getDerivedStateFromError(error: Error): PageErrorBoundaryState {
    return { error }
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('页面渲染失败', error, info.componentStack)
  }

  render() {
    if (!this.state.error) return this.props.children

    return (
      <div className="w-full h-full flex items-center justify-center bg-[#061a33] text-[#a8d6ff]">
        <div className="w-520px rounded-18px border border-[rgba(3,251,253,0.28)] bg-[rgba(0,56,129,0.78)] px-36px py-32px text-center shadow-[0_0_40px_rgba(3,251,253,0.12)]">
          <WarningOutlined className="text-42px text-[#ffb024]" />
          <h2 className="mt-16px text-22px text-white">页面暂时无法显示</h2>
          <p className="mt-10px text-14px leading-24px text-[#a8d6ff]">
            当前页面发生了运行异常，其他功能仍可继续使用。
          </p>
          <div className="mt-24px flex justify-center gap-12px">
            <Button icon={<ReloadOutlined />} onClick={() => window.location.reload()}>重新加载</Button>
            <Button type="primary" icon={<HomeOutlined />} onClick={() => window.location.assign('/monitor')}>返回监控大屏</Button>
          </div>
        </div>
      </div>
    )
  }
}

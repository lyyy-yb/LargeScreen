import { Spin } from 'antd'

export default function PageLoading() {
  return (
    <div className="w-full h-full flex items-center justify-center bg-[#001a33]">
      <div className="flex flex-col items-center gap-16px">
        <Spin size="large" />
        <span className="text-[#A8D6FF] text-14px">加载中...</span>
      </div>
    </div>
  )
}

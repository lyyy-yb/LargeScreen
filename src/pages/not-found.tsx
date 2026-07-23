import { useNavigate } from 'react-router-dom'
import { Button } from 'antd'
import { HomeOutlined } from '@ant-design/icons'

export default function NotFound() {
  const navigate = useNavigate()

  return (
    <div className="w-100vw h-100vh bg-gradient-to-br from-[#000a1a] via-[#001a33] to-[#002a5c] flex items-center justify-center">
      <div className="text-center">
        <div className="text-120px font-bold bg-gradient-to-r from-cyan-400 to-blue-500 bg-clip-text text-transparent">
          404
        </div>
        <div className="text-24px text-white/60 mt-4 mb-8">页面未找到</div>
        <Button
          type="primary"
          size="large"
          icon={<HomeOutlined />}
          onClick={() => navigate('/monitor')}
          className="bg-gradient-to-r from-cyan-500 to-blue-500 border-none"
        >
          返回首页
        </Button>
      </div>
    </div>
  )
}

import { useNavigate } from 'react-router-dom'
import { Button } from 'antd'
import { StopOutlined, HomeOutlined } from '@ant-design/icons'

export default function Forbidden() {
  const navigate = useNavigate()

  return (
    <div className="w-100vw h-100vh bg-gradient-to-br from-[#000a1a] via-[#001a33] to-[#002a5c] flex items-center justify-center relative overflow-hidden">
      <div className="absolute inset-0 opacity-10 pointer-events-none">
        <div className="absolute top-1/4 left-1/4 w-400px h-400px bg-red-500/20 rounded-full blur-100px" />
      </div>
      <div className="text-center relative z-10">
        <StopOutlined className="text-80px text-red-400/80 mb-4" />
        <div className="text-80px font-bold bg-gradient-to-r from-red-400 to-orange-400 bg-clip-text text-transparent leading-90px">
          403
        </div>
        <div className="text-20px text-white/60 mt-4 mb-8">无权限访问该页面</div>
        <Button
          type="primary"
          size="large"
          icon={<HomeOutlined />}
          onClick={() => navigate('/monitor')}
          className="bg-gradient-to-r from-cyan-500 to-blue-500 border-none h-48px px-32px rounded-24px"
        >
          返回首页
        </Button>
      </div>
    </div>
  )
}

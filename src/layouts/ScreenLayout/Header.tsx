import { useNavigate } from 'react-router-dom'
import { Avatar, Dropdown, Space } from 'antd'
import type { MenuProps } from 'antd'
import { UserOutlined, SettingOutlined } from '@ant-design/icons'
import { useAuthStore } from '@/stores'
import hBg from '@/assets/images/bg/h-bg.png'

export default function Header() {
  const navigate = useNavigate()
  const { username, logout } = useAuthStore()

  const handleLogout = () => {
    logout()
    navigate('/login')
  }

  const manageItems: MenuProps['items'] = [
    {
      label: <div className="px-10px py-4px text-black">数据接入</div>,
      key: 'DATA_SOURCE',
    },
    {
      label: <div className="px-10px py-4px text-black">清洗规则</div>,
      key: 'CLEAN_RULE',
    },
    {
      label: <div className="px-10px py-4px text-black">数据管理</div>,
      key: 'DATA_MANAGE',
    },
  ]

  const userItems: MenuProps['items'] = [
    {
      label: <div className="px-10px py-4px">登出</div>,
      key: 'LOGOUT',
    },
  ]

  const onManageClick: MenuProps['onClick'] = ({ key }) => {
    switch (key) {
      case 'DATA_SOURCE':
        navigate('/manage/data-source')
        break
      case 'CLEAN_RULE':
        navigate('/manage/clean-rule')
        break
      case 'DATA_MANAGE':
        navigate('/manage/data-manage')
        break
    }
  }

  const onUserClick: MenuProps['onClick'] = ({ key }) => {
    if (key === 'LOGOUT') {
      handleLogout()
    }
  }

  return (
    <header className="h-40px shrink-0 relative flex justify-center bg-gradient-to-r from-[#3d8ad4] via-[#1a5ab0] to-[#3d8ad4]">
      {/* 标题图片 - 与demo一致的装饰性标题 */}
      <img
        src={hBg}
        className="z-99 object-contain h-80px"
        draggable={false}
        alt="颗粒物量子溯源管控平台"
      />

      {/* 右侧操作区 */}
      <div className="absolute right-0 pr-16px top-4px pointer-events-auto z-1000 flex gap-16px">
        <Dropdown menu={{ items: manageItems, onClick: onManageClick }}>
          <Space className="cursor-pointer">
            <SettingOutlined className="text-#FFFFFF text-lg" />
            <span className="c-#FFFFFF">管理</span>
          </Space>
        </Dropdown>
        <Dropdown menu={{ items: userItems, onClick: onUserClick }}>
          <Space onClick={e => e.preventDefault()} className="cursor-pointer">
            <span className="c-#FFFFFF">{username || '用户'}</span>
            <Avatar style={{ backgroundColor: '#0efbfd' }} icon={<UserOutlined />} />
          </Space>
        </Dropdown>
      </div>
    </header>
  )
}

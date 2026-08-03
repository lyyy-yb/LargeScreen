import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Avatar, Dropdown, Space } from 'antd'
import type { MenuProps } from 'antd'
import { UserOutlined, SettingOutlined } from '@ant-design/icons'
import dayjs from 'dayjs'
import { useAppStore, useAuthStore } from '@/stores'
import hBg from '@/assets/images/bg/h-bg.png'

export default function Header() {
  const navigate = useNavigate()
  const { username, logout } = useAuthStore()
  const resetRegionContext = useAppStore(state => state.resetRegionContext)
  const [currentTime, setCurrentTime] = useState(() => dayjs().format('YYYY / MM / DD HH:mm'))

  useEffect(() => {
    const timer = window.setInterval(
      () => setCurrentTime(dayjs().format('YYYY / MM / DD HH:mm')),
      60_000,
    )
    return () => window.clearInterval(timer)
  }, [])

  const handleLogout = () => {
    logout()
    resetRegionContext()
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
    <header className="screen-header h-52px shrink-0 relative flex justify-center bg-gradient-to-r from-[#3d8ad4] via-[#1a5ab0] to-[#3d8ad4]">
      <time className="absolute left-18px top-10px z-100 text-[#2af3ff] text-13px font-mono tracking-wide">
        {currentTime}
      </time>

      {/* 标题图片 - 与demo一致的装饰性标题 */}
      <img
        src={hBg}
        className="z-99 pointer-events-none object-contain h-86px"
        draggable={false}
        alt="颗粒物量子溯源管控平台"
      />

      {/* 右侧操作区 */}
      <div className="absolute right-0 pr-16px top-10px pointer-events-auto z-1000 flex gap-16px">
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

import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Avatar, Dropdown, Space } from 'antd'
import type { MenuProps } from 'antd'
import { UserOutlined, SettingOutlined } from '@ant-design/icons'
import dayjs from 'dayjs'
import { useAppStore, useAuthStore } from '@/stores'
import { isBusinessRole } from '@/utils/region'
import hBg from '@/assets/images/bg/h-bg.png'

function resolveAvatarUrl(avatar?: string | null): string | undefined {
  if (!avatar) return undefined
  if (avatar.startsWith('http://') || avatar.startsWith('https://') || avatar.startsWith('blob:') || avatar.startsWith('data:')) {
    return avatar
  }
  const cleanPath = avatar.startsWith('/') ? avatar : `/${avatar}`
  if (cleanPath.startsWith('/profile')) {
    return `http://218.244.154.247:7089/prod-api${cleanPath}`
  }
  return cleanPath
}

export default function Header() {
  const navigate = useNavigate()
  const { username, logout } = useAuthStore()
  const user = useAuthStore(state => state.user)
  const resetRegionContext = useAppStore(state => state.resetRegionContext)
  const regionContext = useAppStore(state => state.regionContext)
  const [currentTime, setCurrentTime] = useState(() => dayjs().format('YYYY / MM / DD  HH:mm:ss'))

  const avatarUrl = resolveAvatarUrl(user?.avatar)
  const displayName = user?.nickName || username || '用户'

  useEffect(() => {
    const updateTime = () => setCurrentTime(dayjs().format('YYYY / MM / DD  HH:mm:ss'))
    const timer = window.setInterval(updateTime, 1000)
    return () => window.clearInterval(timer)
  }, [])

  const handleLogout = () => {
    logout()
    resetRegionContext()
    navigate('/login')
  }

  const manageItems: MenuProps['items'] = [
    // 业务人员（city_business/district_business）无数据接入与清洗规则权限，仅保留数据管理
    ...(isBusinessRole(regionContext)
      ? []
      : [
          {
            label: <div className="px-10px py-4px text-black">数据接入</div>,
            key: 'DATA_SOURCE',
          },
          {
            label: <div className="px-10px py-4px text-black">清洗规则</div>,
            key: 'CLEAN_RULE',
          },
        ]),
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
      {/* 左侧时间：秒级实时更新，垂直居中对齐，科技冰蓝字体 */}
      <div className="absolute left-20px top-0 bottom-0 z-100 flex items-center">
        <time
          className="text-[#d8f0ff] text-13px font-mono font-medium tracking-wide flex items-center leading-none select-none"
          style={{ textShadow: '0 0 8px rgba(180, 230, 255, 0.45)' }}
        >
          {currentTime}
        </time>
      </div>

      {/* 标题图片 - 装饰性标题 */}
      <img
        src={hBg}
        className="z-99 pointer-events-none object-contain h-86px"
        draggable={false}
        alt="颗粒物量子溯源管控平台"
      />

      {/* 右侧操作区：垂直居中微调 */}
      <div className="absolute right-0 pr-20px top-0 bottom-0 pointer-events-auto z-1000 flex items-center gap-14px">
        <Dropdown menu={{ items: manageItems, onClick: onManageClick }}>
          <Space className="cursor-pointer px-2.5 py-1 rounded-4px bg-[rgba(255,255,255,0.08)] hover:bg-[rgba(255,255,255,0.18)] transition-colors border border-[rgba(255,255,255,0.2)]">
            <SettingOutlined className="text-[#d8f0ff] text-base" />
            <span className="text-[#d8f0ff] text-13px">管理</span>
          </Space>
        </Dropdown>
        <Dropdown menu={{ items: userItems, onClick: onUserClick }}>
          <Space
            onClick={e => e.preventDefault()}
            className="cursor-pointer px-2.5 py-1 rounded-4px bg-[rgba(255,255,255,0.08)] hover:bg-[rgba(255,255,255,0.18)] transition-colors border border-[rgba(255,255,255,0.2)]"
          >
            <span className="text-[#d8f0ff] text-13px">{displayName}</span>
            <Avatar
              size={24}
              src={avatarUrl}
              style={{ backgroundColor: '#0efbfd', color: '#004385' }}
              icon={!avatarUrl ? <UserOutlined /> : undefined}
            />
          </Space>
        </Dropdown>
      </div>
    </header>
  )
}

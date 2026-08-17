import { useEffect, useState } from 'react'
import { Button, Modal, Spin } from 'antd'
import { ExclamationCircleOutlined } from '@ant-design/icons'
import { dockList, wrjPatrol } from '@/servers/mapBox'
import { cities, districts } from '@/utils/city'
import { useAppStore } from '@/stores'
import { toRegionQuery } from '@/utils/region'
import { isDockDispatchable, normalizeDock, getDockModeColor, type NormalizedDock } from '@/utils/dock'

interface FlyListModelProps {
  visible: boolean
  setVisible: (v: boolean) => void
  curCity: string
  curDistrict: string
  lngLat: { lng: number; lat: number }
}

export default function FlyListModel({ visible, setVisible, curCity, curDistrict, lngLat }: FlyListModelProps) {
  const querySelection = useAppStore(state => state.regionContext?.querySelection)
  const [docks, setDocks] = useState<NormalizedDock[]>([])
  const [loading, setLoading] = useState(false)
  const [modal, contextHolder] = Modal.useModal()

  useEffect(() => {
    const loadDocks = async () => {
      const cityName = cities.find(_ => `${_.adcode}` === curCity)?.name || ''
      const districtName = districts.find(_ => `${_.adcode}` === curDistrict)?.name || ''
      setLoading(true)
      try {
        const res = await dockList(querySelection
          ? toRegionQuery(querySelection)
          : { city: cityName, district: districtName })
        if (res?.resultCode === 0 && Array.isArray(res.data) && res.data.length > 0) {
          setDocks(res.data.map(item => normalizeDock(item)))
          return
        }
      } catch (e) { console.warn('机场列表加载失败', e) }
      setDocks([])
    }

    void loadDocks().finally(() => setLoading(false))
  }, [curCity, curDistrict, querySelection])

  const showConfirm = (dockName: string, dockCode: string) => {
    const inData = { dockCode, ...lngLat }
    modal.confirm({
      title: '请确认派遣任务',
      icon: <ExclamationCircleOutlined className="!c-#faad14" />,
      content: `您将派遣无人机：[${dockName}]，前往地址：[${lngLat.lng}, ${lngLat.lat}]，请再次确认`,
      okText: '确认',
      cancelText: '取消',
      onOk: () => patrol(inData),
    })
  }

  const patrol = async (data: object) => {
    try {
      const res = await wrjPatrol(data)
      if (res?.resultCode === 0) {
        Modal.success({ title: '派遣成功', content: String(res.data || res.message || '无人机已派遣') })
        setVisible(false)
        return
      }
    } catch (e) { console.warn('派遣API不可用', e) }
    Modal.success({ title: '派遣失败', content: '网络异常，请稍后重试' })
    setVisible(false)
  }

  return (
    <Modal
      open={visible}
      title="选择无人机机场"
      onCancel={() => setVisible(false)}
      destroyOnClose
      footer={null}
    >
      <div className="flex flex-col w-full text-[#A8D6FF] gap-2 py-1">
        {loading && (
          <div className="flex flex-col items-center justify-center gap-2 py-6 text-[#8aa8c8]">
            <Spin size="small" />
            <span>机场列表加载中…</span>
          </div>
        )}
        {!loading && docks.map(item => {
          const dispatchable = isDockDispatchable(item)
          return (
            <div key={item.dockCode} className="w-full flex items-center justify-between py-2 border-b border-[rgba(255,255,255,0.1)] last:border-b-0">
              <div className="flex items-center gap-2 min-w-0 pr-2">
                <span className="text-14px font-medium text-[#A8D6FF] truncate">{item.dockName}</span>

                {/* 在线/离线 status Tag：与列表样式保持完全一致 */}
                <span
                  className="text-11px font-medium px-2 py-0.5 rounded-full inline-flex items-center gap-1 border shrink-0"
                  style={
                    item.online
                      ? {
                          color: '#00ff88',
                          backgroundColor: 'rgba(0, 255, 136, 0.15)',
                          borderColor: 'rgba(0, 255, 136, 0.4)',
                        }
                      : {
                          color: '#94a3b8',
                          backgroundColor: 'rgba(148, 163, 184, 0.15)',
                          borderColor: 'rgba(148, 163, 184, 0.3)',
                        }
                  }
                >
                  <span className={`w-1.5 h-1.5 rounded-full ${item.online ? 'bg-[#00ff88] shadow-[0_0_6px_#00ff88]' : 'bg-[#94a3b8]'}`} />
                  {item.statusText}
                </span>

                {/* modeCode 模式 */}
                <span
                  className="text-11px font-medium px-1.5 py-0.2 rounded border shrink-0"
                  style={{
                    color: getDockModeColor(item.modeCode),
                    borderColor: `${getDockModeColor(item.modeCode)}55`,
                    backgroundColor: `${getDockModeColor(item.modeCode)}20`,
                  }}
                >
                  {item.modeLabel}
                </span>
              </div>
              <Button
                size="small"
                type="primary"
                disabled={!dispatchable}
                onClick={() => showConfirm(item.dockName, item.dockCode)}
              >
                选择
              </Button>
            </div>
          )
        })}
        {!loading && docks.length === 0 && <div className="w-full text-center py-8 text-[#999]">暂无数据</div>}
      </div>
      {contextHolder}
    </Modal>
  )
}

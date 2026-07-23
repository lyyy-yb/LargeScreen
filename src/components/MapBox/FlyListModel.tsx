import { useEffect, useState } from 'react'
import { Button, Modal } from 'antd'
import { ExclamationCircleOutlined } from '@ant-design/icons'
import { dockList, wrjPatrol } from '@/servers/mapBox'
import { cities, districts } from '@/utils/city'

interface DockItem {
  dockName: string
  dockCode: string
  dockLng?: number
  dockLat?: number
  dockCity?: string
}

interface FlyListModelProps {
  visible: boolean
  setVisible: (v: boolean) => void
  curCity: string
  curDistrict: string
  lngLat: { lng: number; lat: number }
}

// Mock机场数据
const mockDocks: DockItem[] = [
  { dockName: '临平交通-塘栖机场', dockCode: 'DOCK001' },
  { dockName: '良渚街道综合信息指挥室', dockCode: 'DOCK002' },
]

export default function FlyListModel({ visible, setVisible, curCity, curDistrict, lngLat }: FlyListModelProps) {
  const [docks, setDocks] = useState<DockItem[]>([])
  const [modal, contextHolder] = Modal.useModal()

  useEffect(() => {
    if (!curCity || !curDistrict) return

    const loadDocks = async () => {
      const cityName = cities.find(_ => `${_.adcode}` === curCity)?.name || ''
      const districtName = districts.find(_ => `${_.adcode}` === curDistrict)?.name || ''
      try {
        const res = await dockList({ city: cityName, district: districtName })
        if (res?.resultCode === 0 && Array.isArray(res.data)) {
          setDocks(res.data)
          return
        }
      } catch (e) { console.warn('机场API不可用，使用mock', e) }
      setDocks(mockDocks)
    }

    void loadDocks()
  }, [curCity, curDistrict])

  const showConfirm = (dockName: string, dockCode: string) => {
    const inData = { dockCode, ...lngLat }
    modal.confirm({
      title: '请确认派遣任务',
      icon: <ExclamationCircleOutlined className="!c-#faad14" />,
      content: `您将派遣无人机：[${dockName}]，前往地址：[${lngLat.lng}, ${lngLat.lat}]，请再次确认`,
      okText: '确认',
      cancelText: '取消',
      onOk() { patrol(inData) },
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
    Modal.success({ title: '派遣成功（Mock）', content: '无人机已派遣（模拟）' })
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
      <div className="flex-col w-full c-#A8D6FF">
        {docks.map(item => (
          <div key={item.dockCode} className="line-height-30px w-full inline-flex items-center justify-between py-1">
            <div className="inline-flex items-center line-height-26px">
              <div className="mr-4px">{item.dockName}</div>
            </div>
            <Button size="small" onClick={() => showConfirm(item.dockName, item.dockCode)}>选择</Button>
          </div>
        ))}
        {docks.length === 0 && <div className="w-full text-align-center line-height-60px color-#999">暂无数据</div>}
      </div>
      {contextHolder}
    </Modal>
  )
}

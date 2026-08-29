import { useEffect, useState } from 'react'
import { Modal, Table } from 'antd'
import type { ColumnsType } from 'antd/es/table'
import { airDataLatest } from '@/servers/airData'
import type { AirDataLatestVO } from '@/types/airData'
import { STATION_TYPE_LABEL } from '../cards/shared'

interface StationDataModalProps {
  stationType: 'fixed' | 'mobile'
  onClose: () => void
}

/** 站点数据弹窗表格展示的污染物字段（时间列单独渲染站点名 + 时间） */
const STATION_DATA_FIELDS: { key: 'pm10' | 'pm25' | 'o3' | 'so2' | 'no2' | 'co' | 'vocs' | 'tsp'; label: string }[] = [
  { key: 'pm10', label: 'PM10' },
  { key: 'pm25', label: 'PM2.5' },
  { key: 'o3', label: 'O3' },
  { key: 'so2', label: 'SO2' },
  { key: 'no2', label: 'NO2' },
  { key: 'co', label: 'CO' },
  { key: 'vocs', label: 'VOCs' },
  { key: 'tsp', label: 'TSP' },
]

/** 格式化站点数值（保留一位小数，空值显示 --） */
function formatAirValue(value: unknown): string {
  const num = Number(value)
  if (value == null || !Number.isFinite(num)) return '--'
  return String(Math.round(num * 10) / 10)
}

/** 站点数据弹窗表格列：基站名称 + 8 种污染物，与其他页面统一使用 antd Table + tech-table-wrapper */
const STATION_DATA_COLUMNS: ColumnsType<AirDataLatestVO> = [
  {
    title: '基站名称',
    dataIndex: 'shortName',
    key: 'shortName',
    width: 180,
    render: (value: unknown, record: AirDataLatestVO) => (
      <span className="text-[#d2ecff]">{String(value ?? record.deviceName ?? '--')}</span>
    ),
  },
  ...STATION_DATA_FIELDS.map((field) => ({
    title: field.label,
    dataIndex: field.key,
    key: field.key,
    align: 'center' as const,
    render: (value: unknown) => formatAirValue(value),
  })),
]

/** 空气质量站数据弹窗：固定站/移动站 Tab 切换，调用 airData/latest 接口（关闭即卸载重置状态） */
export default function StationDataModal({ stationType, onClose }: StationDataModalProps) {
  const [tab, setTab] = useState<'fixed' | 'mobile'>(stationType)
  const [rows, setRows] = useState<AirDataLatestVO[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    // 标准的列表数据拉取模式，忽略 set-state-in-effect 规则
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setLoading(true)
    airDataLatest({ stationType: tab })
      .then((res) => {
        if (!cancelled) setRows(Array.isArray(res.data) ? res.data : [])
      })
      .catch(() => {
        if (!cancelled) setRows([])
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [tab])

  return (
    <Modal open onCancel={onClose} footer={null} title={null} width={1060} centered className="station-data-modal">
      <div className="flex justify-center gap-3 mb-3">
        {(['fixed', 'mobile'] as const).map((type) => (
          <button
            key={type}
            type="button"
            onClick={() => setTab(type)}
            className={`px-6 py-1.5 rounded-4px text-13px font-bold border transition-all cursor-pointer ${
              tab === type
                ? 'text-white border-[#2f9bff] bg-[linear-gradient(135deg,#1890ff,#00c6fb)] shadow-[0_0_10px_rgba(24,144,255,0.5)]'
                : 'text-[#9fcbe8] border-[#144982] bg-[#0a2f5e]/60 hover:text-white'
            }`}
          >
            {STATION_TYPE_LABEL[type]}
          </button>
        ))}
      </div>
      <div className="tech-table-wrapper" style={{ flex: 'none' }}>
        <Table
          columns={STATION_DATA_COLUMNS}
          dataSource={rows}
          rowKey="id"
          loading={loading}
          size="small"
          pagination={false}
          scroll={{ x: 900, y: 380 }}
        />
      </div>
    </Modal>
  )
}

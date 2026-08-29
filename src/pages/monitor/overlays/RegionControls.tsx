import { Select } from 'antd'

export interface CityOption {
  adcode: string
  name: string
}

export interface DistrictOption {
  name: string
}

export interface RegionControlsProps {
  roleLevel: string
  cityOptions: CityOption[]
  districtOptions: DistrictOption[]
  selectedCityCode?: string
  selectedDistrictName?: string
  townName?: string
  onCityChange: (adcode?: string) => void
  onDistrictChange: (name?: string) => void
}

/** 地图右上角浮层：浙江省/市/区/乡镇 select 联动 */
export default function RegionControls({
  roleLevel,
  cityOptions,
  districtOptions,
  selectedCityCode,
  selectedDistrictName,
  townName,
  onCityChange,
  onDistrictChange,
}: RegionControlsProps) {
  const isAdmin = roleLevel === 'admin'
  const isCountyOrTown = roleLevel === 'county' || roleLevel === 'town'
  return (
    <div className="region-controls absolute top-3 right-3 z-20 flex items-center gap-2 rounded-8px bg-[rgba(4,22,52,0.85)] p-1.5 border border-[#00d4ff]/30 shadow-[0_4px_12px_rgba(0,0,0,0.3)]">
      <Select
        value="浙江省"
        disabled
        className="w-88px screen-select"
        classNames={{ popup: { root: 'screen-select-popup' } }}
        size="small"
        options={[{ value: '浙江省', label: '浙江省' }]}
      />
      <Select
        value={selectedCityCode}
        onChange={onCityChange}
        disabled={!isAdmin}
        allowClear={isAdmin}
        placeholder="全省"
        className="w-92px screen-select"
        classNames={{ popup: { root: 'screen-select-popup' } }}
        size="small"
        options={cityOptions.map(city => ({ value: city.adcode, label: city.name }))}
      />
      {selectedCityCode && !isAdmin && (
        <Select
          value={selectedDistrictName}
          onChange={onDistrictChange}
          disabled={isCountyOrTown}
          allowClear={roleLevel === 'city'}
          placeholder="全市"
          className="w-100px screen-select"
          classNames={{ popup: { root: 'screen-select-popup' } }}
          size="small"
          options={districtOptions.map(item => ({ value: item.name, label: item.name }))}
        />
      )}
      {roleLevel === 'town' && (
        <Select
          value={townName}
          disabled
          className="w-150px screen-select"
          classNames={{ popup: { root: 'screen-select-popup' } }}
          size="small"
          options={townName ? [{ value: townName, label: townName }] : []}
        />
      )}
    </div>
  )
}

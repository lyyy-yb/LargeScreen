import { Select } from 'antd'
import { useMemo } from 'react'
import { useAppStore } from '@/stores'
import { cities, districts } from '@/utils/city'
import type { RegionSelection } from '@/types/region'

interface RegionSelectorProps {
  className?: string
  size?: 'small' | 'middle' | 'large'
  showTown?: boolean
}

export default function RegionSelector({
  className = '',
  size = 'small',
  showTown = true,
}: RegionSelectorProps) {
  const { regionContext, setRegionSelection } = useAppStore()
  const roleLevel = regionContext?.roleLevel
  const selection = regionContext?.selection
  const cityDistricts = useMemo(
    () => districts.filter(item => item.parent === Number(selection?.cityCode)),
    [selection?.cityCode],
  )

  if (!regionContext || !selection) return null

  const selectCity = (cityCode?: string) => {
    if (roleLevel !== 'admin') return
    const city = cities.find(item => item.adcode === cityCode)
    const next: RegionSelection = city
      ? {
          provinceCode: '330000',
          provinceName: '浙江省',
          cityCode: city.adcode,
          cityName: city.name,
        }
      : { provinceCode: '330000', provinceName: '浙江省' }
    setRegionSelection(next)
  }

  const selectCounty = (countyName?: string) => {
    if (!selection.cityCode || !selection.cityName || (roleLevel !== 'admin' && roleLevel !== 'city')) return
    const county = cityDistricts.find(item => item.name === countyName)
    setRegionSelection({
      provinceCode: '330000',
      provinceName: '浙江省',
      cityCode: selection.cityCode,
      cityName: selection.cityName,
      ...(county ? { countyCode: String(county.adcode), countyName: county.name } : {}),
    })
  }

  return (
    <div className={`flex items-center gap-2 ${className}`}>
      <Select
        value={selection.provinceName}
        disabled
        size={size}
        className="w-100px screen-select"
        options={[{ value: '浙江省', label: '浙江省' }]}
      />
      <Select
        value={selection.cityCode}
        onChange={selectCity}
        disabled={roleLevel !== 'admin'}
        allowClear={roleLevel === 'admin'}
        placeholder="全省"
        size={size}
        className="w-100px screen-select"
        options={cities.map(item => ({ value: item.adcode, label: item.name }))}
      />
      {selection.cityCode && (
        <Select
          value={selection.countyName}
          onChange={selectCounty}
          disabled={roleLevel === 'county' || roleLevel === 'town'}
          allowClear={roleLevel === 'admin' || roleLevel === 'city'}
          placeholder="全市"
          size={size}
          className="w-110px screen-select"
          options={cityDistricts.map(item => ({ value: item.name, label: item.name }))}
        />
      )}
      {showTown && roleLevel === 'town' && selection.townName && (
        <Select
          value={selection.townName}
          disabled
          size={size}
          className="w-160px screen-select"
          options={[{ value: selection.townName, label: selection.townName }]}
        />
      )}
    </div>
  )
}

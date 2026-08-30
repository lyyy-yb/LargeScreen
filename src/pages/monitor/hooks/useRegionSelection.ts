import { useCallback, useMemo, useState } from 'react'
import { cities, districts } from '@/utils/city'
import type { CityItem, DistrictItem } from '@/utils/city'
import { useAppStore } from '@/stores'
import type { RegionSelection } from '@/types/region'

export interface UseRegionSelectionResult {
  /** store 中的 selection（用于发起数据查询的入参） */
  selection: RegionSelection | undefined
  /** 当前用户角色级别 */
  roleLevel: string
  /** 地图是否处于省一级别（未选 city） */
  isProvinceView: boolean
  /** 当前选中的市 */
  activeCity: CityItem | undefined
  /** 当前选中的区县 */
  activeCounty: DistrictItem | undefined
  /** 当前市下的所有区县列表（用于渲染市视图） */
  cityDistricts: DistrictItem[]
  /** 用于汇总面板标题的最终区域名（county > city > province > '浙江省'） */
  selectedRegionName: string
  /** 地图 hover 时的临时区域名（用于展示 "点击选择 xxx" 提示） */
  hoverRegion: string | null
  /** 选择市：仅 admin 角色可调用；选完后自动清空 hoverRegion */
  selectCity: (adcode?: string) => void
  /**
   * 选择区县：
   * - name 缺失：回退到当前市（仅 admin/city 角色）
   * - name 匹配当前市下某区：写入 store
   */
  selectDistrict: (name?: string) => void
  /** 地图点击省份 3D map 城市时调用：按名称/adcode 匹配后 selectCity */
  handleCityClick: (cityName: string, adcode: number) => void
  /** 设置 hover 区域名（地图 mouseover 时调用） */
  setHoverRegion: (name: string | null) => void
}

const PROVINCE_CODE = '330000'
const PROVINCE_NAME = '浙江省'

/**
 * 监控大屏区域选择 hook：从 store 读取 selection/roleLevel，
 * 派生 activeCity/activeCounty/cityDistricts/selectedRegionName，
 * 并提供 selectCity/selectDistrict/handleCityClick 三个选择操作。
 */
export function useRegionSelection(): UseRegionSelectionResult {
  const { regionContext, setRegionSelection } = useAppStore()
  const roleLevel = regionContext?.roleLevel || 'town'
  const selection = regionContext?.selection
  const mapSelection = regionContext?.mapSelection

  const [hoverRegion, setHoverRegion] = useState<string | null>(null)

  const isProvinceView = !mapSelection?.cityCode
  const activeCity = cities.find(city => city.adcode === mapSelection?.cityCode)
  const activeCounty = districts.find(item => String(item.adcode) === mapSelection?.countyCode)

  const cityDistricts = useMemo(() => {
    if (!activeCity) return []
    return districts.filter(item => item.parent === Number(activeCity.adcode))
  }, [activeCity])

  const selectedRegionName = selection?.countyName
    || selection?.cityName
    || selection?.provinceName
    || PROVINCE_NAME

  const selectCity = useCallback((adcode?: string) => {
    if (roleLevel !== 'admin') return
    const city = cities.find(item => item.adcode === adcode)
    const nextSelection: RegionSelection = city
      ? {
          provinceCode: PROVINCE_CODE,
          provinceName: PROVINCE_NAME,
          cityCode: city.adcode,
          cityName: city.name,
        }
      : { provinceCode: PROVINCE_CODE, provinceName: PROVINCE_NAME }
    setRegionSelection(nextSelection)
    setHoverRegion(null)
  }, [roleLevel, setRegionSelection])

  const selectDistrict = useCallback((name?: string) => {
    if (!name && activeCity && (roleLevel === 'admin' || roleLevel === 'city')) {
      setRegionSelection({
        provinceCode: PROVINCE_CODE,
        provinceName: PROVINCE_NAME,
        cityCode: activeCity.adcode,
        cityName: activeCity.name,
      })
      setHoverRegion(null)
      return
    }
    const item = cityDistricts.find(district => district.name === name)
    if (!item || !activeCity || (roleLevel !== 'admin' && roleLevel !== 'city')) return
    setRegionSelection({
      provinceCode: PROVINCE_CODE,
      provinceName: PROVINCE_NAME,
      cityCode: activeCity.adcode,
      cityName: activeCity.name,
      countyCode: String(item.adcode),
      countyName: item.name,
    })
    setHoverRegion(null)
  }, [activeCity, cityDistricts, roleLevel, setRegionSelection])

  const handleCityClick = useCallback((cityName: string, adcode: number) => {
    const city = cities.find(item => item.name === cityName || Number(item.adcode) === Number(adcode))
    if (city) selectCity(city.adcode)
  }, [selectCity])

  return {
    selection,
    roleLevel,
    isProvinceView,
    activeCity,
    activeCounty,
    cityDistricts,
    selectedRegionName,
    hoverRegion,
    selectCity,
    selectDistrict,
    handleCityClick,
    setHoverRegion,
  }
}

import { create } from 'zustand'
import { devtools } from 'zustand/middleware'
import type { Scene } from '@antv/l7'
import { getLocalInfo, setLocalInfo } from '@/utils/storage'
import type { RegionContext, RegionSelection } from '@/types/region'

const ACCESSIBLE_CITY_KEY = 'ACCESSIBLE_CITY'
const ACCESSIBLE_DISTRICT_KEY = 'ACCESSIBLE_DISTRICT'
const ACCESSIBLE_FEATURE_KEY = 'ACCESSIBLE_FEATURE'

export interface CfjTypeItem {
  color: string
  sNum: number
  eNum: number
}

export type CfjType = {
  [key: string]: CfjTypeItem[]
}

interface AppState {
  // 地图实例
  mapInstance: Scene | null
  setMapInstance: (instance: Scene | null) => void

  // 当前区域
  currentProvince: string
  currentCity: string
  currentDistrict: string
  setCurrentProvince: (province: string) => void
  setCurrentCity: (city: string) => void
  setCurrentDistrict: (district: string) => void

  // 颜色配置
  colorCfjObj: CfjType
  setColorCfjObj: (obj: CfjType) => void

  // 加载状态
  globalLoading: boolean
  setGlobalLoading: (loading: boolean) => void

  // 污染源更新触发器
  shouldUpdateWu: number
  setShouldUpdateWu: (v: number) => void
  shouldUpdateWu2: number
  setShouldUpdateWu2: (v: number) => void

  // 权限区域
  accessibleCity: string
  setAccessibleCity: (v: string) => void
  accessibleDistrict: string
  setAccessibleDistrict: (v: string) => void
  accessibleFeature: string
  setAccessibleFeature: (v: string) => void

  regionContext: RegionContext | null
  setRegionContext: (context: RegionContext) => void
  setRegionSelection: (selection: RegionSelection) => void
  resetRegionContext: () => void

  // 左侧加载状态
  leftLoading: boolean
  setLeftLoading: (v: boolean) => void
}

export const useAppStore = create<AppState>()(
  devtools(
    (set) => ({
      mapInstance: null,
      setMapInstance: (mapInstance) => set({ mapInstance }),

      currentProvince: '330000',
      currentCity: '',
      currentDistrict: '',
      setCurrentProvince: (currentProvince) => set({ currentProvince }),
      setCurrentCity: (currentCity) => set({ currentCity }),
      setCurrentDistrict: (currentDistrict) => set({ currentDistrict }),

      colorCfjObj: {},
      setColorCfjObj: (colorCfjObj) => set({ colorCfjObj }),

      globalLoading: false,
      setGlobalLoading: (globalLoading) => set({ globalLoading }),

      shouldUpdateWu: 0,
      setShouldUpdateWu: (shouldUpdateWu) => set({ shouldUpdateWu }),
      shouldUpdateWu2: 0,
      setShouldUpdateWu2: (shouldUpdateWu2) => set({ shouldUpdateWu2 }),

      accessibleCity: getLocalInfo<string>(ACCESSIBLE_CITY_KEY) || 'all',
      setAccessibleCity: (accessibleCity) => {
        setLocalInfo(ACCESSIBLE_CITY_KEY, accessibleCity)
        set({ accessibleCity })
      },
      accessibleDistrict: getLocalInfo<string>(ACCESSIBLE_DISTRICT_KEY) || 'all',
      setAccessibleDistrict: (accessibleDistrict) => {
        setLocalInfo(ACCESSIBLE_DISTRICT_KEY, accessibleDistrict)
        set({ accessibleDistrict })
      },
      accessibleFeature: getLocalInfo<string>(ACCESSIBLE_FEATURE_KEY) || 'all',
      setAccessibleFeature: (accessibleFeature) => {
        setLocalInfo(ACCESSIBLE_FEATURE_KEY, accessibleFeature)
        set({ accessibleFeature })
      },

      regionContext: null,
      setRegionContext: (regionContext) => {
        const { roleLevel, selection } = regionContext
        const accessibleCity = roleLevel === 'admin' ? 'all' : selection.cityName || 'all'
        const accessibleDistrict =
          roleLevel === 'admin' || roleLevel === 'city' ? 'all' : selection.countyName || 'all'
        setLocalInfo(ACCESSIBLE_CITY_KEY, accessibleCity)
        setLocalInfo(ACCESSIBLE_DISTRICT_KEY, accessibleDistrict)
        set({
          regionContext,
          currentProvince: selection.provinceCode,
          currentCity: selection.cityCode || '',
          currentDistrict: selection.countyCode || '',
          accessibleCity,
          accessibleDistrict,
        })
      },
      setRegionSelection: (selection) => set(state => {
        if (!state.regionContext) return state
        const withoutTown = (value: RegionSelection): RegionSelection => ({
          ...value,
          townDeptId: undefined,
          townName: undefined,
        })
        const mapSelection = state.regionContext.roleLevel === 'admin'
          ? {
              provinceCode: state.regionContext.defaultSelection.provinceCode,
              provinceName: state.regionContext.defaultSelection.provinceName,
            }
          : state.regionContext.roleLevel === 'city'
            ? withoutTown(state.regionContext.defaultSelection)
            : withoutTown(state.regionContext.defaultSelection)
        return {
          regionContext: {
            ...state.regionContext,
            selection,
            mapSelection,
            querySelection: selection,
          },
          currentProvince: selection.provinceCode,
          currentCity: selection.cityCode || '',
          currentDistrict: selection.countyCode || '',
        }
      }),
      resetRegionContext: () => set({
        regionContext: null,
        currentProvince: '330000',
        currentCity: '',
        currentDistrict: '',
        accessibleCity: 'all',
        accessibleDistrict: 'all',
      }),

      leftLoading: false,
      setLeftLoading: (leftLoading) => set({ leftLoading }),
    }),
    { enabled: true, name: 'appStore' }
  )
)

export interface AlarmItem {
  dapLat: number
  dapLng: number
  times: number
  address: string
  type: number
}

export interface PollutionItem {
  name: string
  weizhi: string
  leixing: string
  hangye: string
  xianzhuang: string
  lng: number
  lat: number
  city?: string
  quxian?: string
}

export interface RadarStation {
  bsiId: string
  bsiName: string
  bsiLng: number
  bsiLat: number
  bsiLocation?: string
  status?: string
}

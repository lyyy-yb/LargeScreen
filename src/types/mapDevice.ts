export interface MapDevicePoint {
  id: string
  type: 'radar' | 'drone'
  name: string
  address: string
  lng: number
  lat: number
  online: boolean
}

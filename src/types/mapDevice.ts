export interface MapDevicePoint {
  id: string
  type: 'radar' | 'drone'
  name: string
  address: string
  lng: number
  lat: number
  online: boolean
  /** 雷达站点偏航角（度）。 */
  yaw?: number
  /** 雷达热力查询因子，不改变设备的真实属性。 */
  scanFactor?: import('@/features/radar-heat/model').RadarHeatFactor
}

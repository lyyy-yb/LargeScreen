/** monitor 全局搜索选中后的地图定位目标 */
export interface MapFocusTarget {
  lng: number
  lat: number
  zoom: number
  /** 保证连续点击同一结果时仍会重新定位 */
  requestId: number
}

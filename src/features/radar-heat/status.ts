/** 首页图层状态到浮层的只读订阅，不携带鉴权或扫描数值。 */
export type RadarHeatStatus = { name: string; state: 'loading' | 'ready' | 'empty' | 'error'; message?: string }
const items = new Map<string, RadarHeatStatus>()
const listeners = new Set<()=>void>()
let snapshot: RadarHeatStatus[] = []
export const radarHeatStatuses = {
  set(id:string,value:RadarHeatStatus|null) {
    if(value)items.set(id,value);else items.delete(id)
    snapshot=[...items.values()];listeners.forEach(listener=>listener())
  },
  subscribe(listener:()=>void){listeners.add(listener);return()=>{listeners.delete(listener)}},
  getSnapshot:()=>snapshot,
}

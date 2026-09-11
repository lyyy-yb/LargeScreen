import { PointLayer, type Scene } from '@antv/l7'
import type { MapDevicePoint } from '@/types/mapDevice'
import { radarHeatProvider } from './apiStream'
import { radarHeatStatuses } from './status'
import { createRadarHeatLayer } from './render'

export function createMonitorRadarHeat(scene:Scene) {
  let visible=true,disposed=false,key=''
  let points:MapDevicePoint[]=[]
  let active:Array<{stop:()=>void;heat:ReturnType<typeof createRadarHeatLayer>}>=[]
  scene.addImage('monitor-heat-radar','/marker/radar-on.png')
  const icons=new PointLayer({zIndex:34,name:'monitor-heat-radar-icons',enablePicking:false})
    .source([],{parser:{type:'json',x:'lng',y:'lat'}}).shape('monitor-heat-radar').size(9).style({depth:false})
  scene.addLayer(icons)
  const clear=()=>{active.forEach(item=>{item.stop();item.heat.destroy()});active=[]}
  const start=()=>{
    clear()
    if(!visible || disposed)return
    active=points.map(point=>{
      const site={id:point.id,name:point.name,lng:point.lng,lat:point.lat,yaw:point.yaw}
      const heat=createRadarHeatLayer(scene,site)
      let stopped=false
      radarHeatStatuses.set(site.id,{name:site.name,state:'loading'})
      const stop=radarHeatProvider.subscribe({site,factor:point.scanFactor??'source',pollLatest:true},{
        onFrame:frame=>{void heat.setFrame(frame).then(()=>{if(!stopped)radarHeatStatuses.set(site.id,{name:site.name,state:'ready'})}).catch(()=>{if(!stopped)radarHeatStatuses.set(site.id,{name:site.name,state:'error',message:'扫描图层绘制失败'})})},
        onEmpty:()=>{heat.clear();radarHeatStatuses.set(site.id,{name:site.name,state:'empty'})},
        onError:error=>{heat.clear();radarHeatStatuses.set(site.id,{name:site.name,state:'error',message:error.message})},
      })
      return {heat,stop:()=>{stopped=true;stop();radarHeatStatuses.set(site.id,null)}}
    })
  }
  return {
    setData(next:MapDevicePoint[]){
      const radars=next.filter(point=>point.type==='radar' && Number.isFinite(point.lng) && Number.isFinite(point.lat))
      const nextKey=JSON.stringify(radars.map(p=>[p.id,p.lng,p.lat,p.scanFactor,p.yaw]))
      if(key===nextKey)return
      key=nextKey;points=radars
      icons.setData(points,{parser:{type:'json',x:'lng',y:'lat'}})
      start()
    },
    setVisible(next:boolean){if(next===visible)return;visible=next;if(visible){icons.show();start()}else{icons.hide();clear()}},
    destroy(){disposed=true;clear();scene.removeLayer(icons)},
  }
}

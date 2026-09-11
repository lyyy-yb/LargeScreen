import { ImageLayer, type ILayer, type Scene } from '@antv/l7'
import { radarHeatColor, type RadarHeatFrame, type RadarHeatSite } from './model'

export function drawRadarFrame(canvas: HTMLCanvasElement, frame: RadarHeatFrame) {
  const ctx=canvas.getContext('2d')
  if(!ctx)return
  const size=canvas.width, half=size/2
  ctx.clearRect(0,0,size,size)
  const radius=radarFrameRadius(frame)
  const scale=(half-2)/radius
  for(const ray of frame.rays) {
    const a=(ray.bearing-ray.width/2-90)*Math.PI/180
    const b=(ray.bearing+ray.width/2-90)*Math.PI/180
    ray.values.forEach((value,index)=>{
      if(value==null || !Number.isFinite(value))return
      const inner=(ray.distanceEdgesM?.[index] ?? ray.startM+index*ray.stepM)*scale
      const outer=(ray.distanceEdgesM?.[index+1] ?? ray.startM+(index+1)*ray.stepM)*scale+.35
      ctx.fillStyle=radarHeatColor(value,frame.factor)
      ctx.beginPath();ctx.arc(half,half,outer,a,b);ctx.arc(half,half,inner,b,a,true);ctx.closePath();ctx.fill()
    })
  }
}

export function radarFrameRadius(frame: RadarHeatFrame) {
  return Math.max(1,...frame.rays.map(ray=>ray.distanceEdgesM?.[ray.distanceEdgesM.length-1] ?? ray.startM+ray.stepM*ray.values.length))
}

/** 地理配准的栅格图层：随地图缩放/俯仰，不使用屏幕尺寸的装饰扫描圆。 */
export function createRadarHeatLayer(scene: Scene, site: RadarHeatSite) {
  const canvas=document.createElement('canvas');canvas.width=512;canvas.height=512
  let layer:ILayer|null=null, disposed=false, version=0, visible=true
  return {
    async setFrame(frame:RadarHeatFrame) {
      if(disposed || frame.siteId!==site.id)return
      const revision=++version
      drawRadarFrame(canvas,frame)
      const img=new Image();img.src=canvas.toDataURL('image/png')
      await img.decode()
      if(disposed || revision!==version)return
      const radius=radarFrameRadius(frame)
      const latDelta=radius/111320, lngDelta=latDelta/Math.cos(site.lat*Math.PI/180)
      const parser={type:'image' as const,extent:[site.lng-lngDelta,site.lat-latDelta,site.lng+lngDelta,site.lat+latDelta] as [number,number,number,number]}
      if(!layer) {
        layer=new ImageLayer({zIndex:8,name:`radar-heat-${site.id}`,enablePicking:false}).source(img,{parser}).style({opacity:.72})
        if(!visible)layer.hide()
        scene.addLayer(layer)
      } else layer.setData(img,{parser})
    },
    setVisible(next:boolean){visible=next;if(next)layer?.show();else layer?.hide()},
    clear(){version++;if(layer)scene.removeLayer(layer);layer=null},
    destroy(){disposed=true;version++;if(layer)scene.removeLayer(layer);layer=null},
  }
}

import dayjs from 'dayjs'
import { radarPeriods, radarPeriodDetail, type SpsDetail } from '@/servers/radarHeat'
import { readAuthenticatedSse } from '@/servers/sse'
import { decodeSpsDetail } from './spsAdapter'
import type { RadarHeatFactor, RadarHeatFrame, RadarHeatSite } from './model'

interface Query { site: RadarHeatSite; factor: RadarHeatFactor; range?: [number,number]; pollLatest?: boolean }
interface Sink { onFrame: (frame:RadarHeatFrame)=>void; onComplete?:()=>void; onError?:(error:Error)=>void; onEmpty?:()=>void }

export const radarHeatProvider = {
  subscribe(query:Query, sink:Sink) {
    const controller = new AbortController()
    let timer:ReturnType<typeof setTimeout> | undefined
    let firstFrameTimer:ReturnType<typeof setTimeout> | undefined
    let received = false
    const check = <T,>(response:{resultCode:number;data:T;message?:string;msg?:string}) => {
      if(response.resultCode!==0) throw new Error(response.message || response.msg || '雷达扫描查询失败')
      return response.data
    }
    const latest = async () => {
      const periods = check(await radarPeriods({radarId:query.site.id,limit:2}))
      if(controller.signal.aborted)return
      if(!Array.isArray(periods))throw new Error('扫描周期列表格式无效')
      if(!periods.length){sink.onEmpty?.();return}
      // 列表最近的已存储周期就是默认的“上一周期”，不是时间轴倒数第二帧。
      const sorted = [...periods].sort((a,b)=>b.startTime.localeCompare(a.startTime))
      const period = sorted[0]
      const detail = check(await radarPeriodDetail(period.periodId))
      if(!controller.signal.aborted)sink.onFrame(decodeSpsDetail(detail,query.site.id,query.site.yaw))
    }
    const run = async () => {
      try {
        if(query.factor!=='source')throw new Error('后台目前仅支持污染源 SPS，PM2.5 / PM10 暂未开放')
        if(query.range) {
          firstFrameTimer=setTimeout(()=>{
            if(controller.signal.aborted || received)return
            controller.abort()
            sink.onEmpty?.()
            sink.onComplete?.()
          },3000)
          const params = new URLSearchParams({radarId:query.site.id,dataType:'sps',startTime:dayjs(query.range[0]).format('YYYY-MM-DD HH:mm:ss'),endTime:dayjs(query.range[1]).format('YYYY-MM-DD HH:mm:ss')})
          await readAuthenticatedSse(`/dpSys/hbdp/radar/playback?${params}`,controller.signal,message=>{
            const envelope = JSON.parse(message.data)
            if(envelope?.code===401 || envelope?.resultCode===401)throw new Error(envelope.msg || envelope.message || '雷达 SSE 认证失败')
            const type = envelope?.type ?? message.event
            if(type==='error' || (envelope?.code && envelope.code!==200) || (envelope?.resultCode != null && envelope.resultCode!==0))throw new Error(envelope.message || envelope.msg || (typeof envelope.data==='string'?envelope.data:'雷达历史流返回错误'))
            if(type==='end'){if(!received)sink.onEmpty?.();return true}
            if(type==='heartbeat' || type==='ping')return false
            const payload = typeof envelope.data==='string'?JSON.parse(envelope.data):envelope.data
            // 历史 SSE 的 data 是整周期射线数组，周期元信息在外层；detail REST 则是完整对象。
            if(Array.isArray(payload) && (!envelope.periodId || !envelope.startTime || envelope.dataType!=='sps'))throw new Error('SSE 周期元信息缺失')
            const detail = Array.isArray(payload) ? {
              radarId:query.site.id, periodId:envelope.periodId, scanType:'PPI',
              startTime:envelope.startTime, endTime:payload[payload.length-1]?.dataTime,
              rayCount:payload.length, rays:payload,
            } : payload
            // 只交付完整周期详情，不把单条射线当成一帧，也不猜测未知包结构。
            const frame = decodeSpsDetail(detail as SpsDetail,query.site.id,query.site.yaw)
            if(envelope.periodId && frame.period!==envelope.periodId)throw new Error('SSE 周期标识不一致')
            received=true;clearTimeout(firstFrameTimer)
            if(!controller.signal.aborted)sink.onFrame(frame)
            return false
          })
        } else await latest()
        if(!controller.signal.aborted)sink.onComplete?.()
      } catch(error) {
        if(!controller.signal.aborted)sink.onError?.(error instanceof Error?error:new Error('雷达数据接收失败'))
      } finally {
        clearTimeout(firstFrameTimer)
        if(query.pollLatest && !query.range && !controller.signal.aborted)timer=setTimeout(()=>{void run()},60_000)
      }
    }
    void run()
    return ()=>{controller.abort();clearTimeout(timer);clearTimeout(firstFrameTimer)}
  },
}

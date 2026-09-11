import { useEffect, useMemo, useRef, useState } from 'react'
import { Button, DatePicker, Select, Slider, Spin } from 'antd'
import { CaretRightOutlined, PauseOutlined, StepBackwardOutlined, StepForwardOutlined } from '@ant-design/icons'
import dayjs, { type Dayjs } from 'dayjs'
import type { Scene } from '@antv/l7'
import L7MapView from '@/components/L7MapView'
import RegionSelector from '@/components/RegionSelector'
import { leidaList } from '@/servers/mapBox'
import { useAppStore } from '@/stores'
import { toRegionQuery } from '@/utils/region'
import { disabledFutureDate } from '@/utils/helpers'
import { RADAR_FACTORS, radarHeatRatio, type RadarHeatFactor, type RadarHeatFrame, type RadarHeatSite } from './model'
import { radarHeatProvider } from './apiStream'
import { resolveRadarSiteYaw } from './siteYaw'
import { SPS_START_ANGLE_OFFSET } from './spsAdapter'
import { createRadarHeatLayer, radarFrameRadius } from './render'
import './index.less'

export default function RadarHeatView() {
  const selection=useAppStore(state=>state.regionContext?.querySelection)
  const [sites,setSites]=useState<RadarHeatSite[]>([]),[siteId,setSiteId]=useState('')
  const [siteLoading,setSiteLoading]=useState(false),[error,setError]=useState('')
  const [factor,setFactor]=useState<RadarHeatFactor>('source')
  const [range,setRange]=useState<[Dayjs,Dayjs]|null>(null)
  const [historyMode,setHistoryMode]=useState(false)
  const [frames,setFrames]=useState<RadarHeatFrame[]>([]),[loading,setLoading]=useState(false)
  const [index,setIndex]=useState(0),[playing,setPlaying]=useState(false)
  const [scene,setScene]=useState<Scene|null>(null)
  const [refresh,setRefresh]=useState(0)
  const [empty,setEmpty]=useState(false)
  const layer=useRef<ReturnType<typeof createRadarHeatLayer>|null>(null)
  const site=sites.find(item=>item.id===siteId)??sites[0]
  const frame=frames[index]
  const playbackRef=useRef({index:0,count:0,loading:false})
  useEffect(()=>{playbackRef.current={index,count:frames.length,loading}},[index,frames.length,loading])
  const config=RADAR_FACTORS[factor]
  useEffect(()=>{
    let cancelled=false
    if(!selection)return
    const load=async()=>{
      setSiteLoading(true);setError('')
      try {
        const res=await leidaList(toRegionQuery(selection))
        if(cancelled)return
        if(res?.resultCode!==0)throw new Error('雷达列表加载失败')
        const records=Array.isArray(res.data)?res.data:[]
        setSites(records.flatMap((row:Record<string,unknown>)=>{
          const lng=Number(row.bsiLng),lat=Number(row.bsiLat)
          if(row.bsiLng==null || row.bsiLat==null || !Number.isFinite(lng) || !Number.isFinite(lat) || Math.abs(lng)>180 || Math.abs(lat)>85 || !row.bsiId)return []
          const name=String(row.bsiName||row.bsiId)
          return [{id:String(row.bsiId),name,lng,lat,yaw:resolveRadarSiteYaw(row.bsiYaw)}]
        }))
      } catch(e){if(!cancelled){setError(e instanceof Error?e.message:'雷达列表加载失败');setSites([])}}
      finally{if(!cancelled)setSiteLoading(false)}
    }
    void load();return ()=>{cancelled=true}
  },[selection])

  useEffect(()=>{
    if(!scene || !site)return
    const heat=createRadarHeatLayer(scene,site);layer.current=heat
    scene.setZoomAndCenter(12,[site.lng,site.lat])
    return ()=>{heat.destroy();if(layer.current===heat)layer.current=null}
  },[scene,site])
  useEffect(()=>{
    // 请求生命周期初始化；切站、切因子、切时间均清除旧帧，禁止不同流混合。
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setFrames([]);setIndex(0);setPlaying(false);setLoading(Boolean(site));setEmpty(false)
    layer.current?.clear()
    if(!site)return
    setError('')
    const queryRange:[number,number]|undefined=range?[range[0].valueOf(),range[1].valueOf()]:undefined
    let cancelled=false
    const cache=new Map<string,RadarHeatFrame>()
    const stop=radarHeatProvider.subscribe({site,factor,range:queryRange},{
      onFrame(next){
        if(cancelled || !next.complete)return
        if(!cache.has(next.period)&&cache.size>=200)throw new Error('历史数据超过200个周期，请缩小时间范围；当前仅保留已接收部分')
        cache.set(next.period,next);setFrames([...cache.values()])
      },
      onEmpty(){if(!cancelled){layer.current?.clear();setEmpty(true);setLoading(false);setPlaying(false)}},
      onComplete(){if(cancelled)return;setLoading(false)},
      onError(e){if(cancelled)return;setLoading(false);setPlaying(false);setError(e.message)},
    })
    return ()=>{cancelled=true;stop()}
  },[site,factor,range,refresh])
  useEffect(()=>{
    if(frame && frame.siteId===site?.id && frame.factor===factor && layer.current)void layer.current.setFrame(frame).catch(e=>setError(String(e)))
  },[frame,scene,site,factor])
  useEffect(()=>{
    if(!playing)return
    // 收帧不会重置节拍；追上缓存时等待，只有收到流结束才停止。
    const timer=window.setInterval(()=>{
      const current=playbackRef.current
      if(current.index<current.count-1)setIndex(current.index+1)
      else if(!current.loading)setPlaying(false)
    },1000)
    return ()=>window.clearInterval(timer)
  },[playing])
  const markers=useMemo(()=>site?[{lng:site.lng,lat:site.lat,name:site.name}]:[],[site])
  const changeRange=(values:[Dayjs|null,Dayjs|null]|null)=>{
    if(!values?.[0] || !values[1]){setRange(null);setPlaying(false);return}
    if(values[1].isAfter(dayjs()) || values[1].isBefore(values[0]) || values[1].diff(values[0],'day',true)>7){setError('请选择不超过7天、且不晚于当前时刻的范围');return}
    setError('');setPlaying(false);setRange([values[0],values[1]])
  }
  return <div className="map-screen radar-heat-view">
    <L7MapView id="radar-concentration-map" center={site?[site.lng,site.lat]:[120.2,29.3]} zoom={site?12:7} minZoom={6} maxZoom={17} showTiles
      markers={markers} markerIconUrl="/marker/radar-on.png" onSceneLoaded={setScene}/>
    <div className="map-overlay-toolbar map-top-controls radar-heat-top">
      <RegionSelector/>
      <Select aria-label="热力雷达" value={site?.id} loading={siteLoading} placeholder="选择雷达" className="screen-select" size="small" style={{width:200}}
        options={sites.map(item=>({value:item.id,label:item.name}))} onChange={value=>{setSiteId(value);setPlaying(false)}}/>
      <Select aria-label="扫描污染物" value={factor} className="screen-select" size="small" style={{width:100}}
        options={Object.entries(RADAR_FACTORS).map(([value,item])=>({value,label:value==='source'?item.label:`${item.label}（暂未支持）`,disabled:value!=='source'}))} onChange={value=>{setFactor(value);setPlaying(false)}}/>
    </div>
    <div className="radar-heat-information map-overlay-toolbar">
      <span className="radar-data-tag">{range?'SSE 历史数据':'后台扫描数据'}</span>
      <strong>{range?'历史扫描':'上一完整周期'}</strong>
      <time>{frame?dayjs(frame.time).format('YYYY-MM-DD HH:mm:ss'):loading?'查询扫描数据中…':error?'扫描数据加载失败':empty?'查无数据':'暂无扫描数据'}</time>
      {empty&&<small role="status">查无数据：流已空结束或查询3秒内未收到扫描周期，请调整范围后重试。</small>}
      <small>PPI · 整周期切换{frame?` · 半径 ${(radarFrameRadius(frame)/1000).toFixed(2)} km`:''}{loading?' · 接收中…':''}</small>
      {frame&&<small>起始角修正：{SPS_START_ANGLE_OFFSET}° · 站点偏航：{site?.yaw??0}°</small>}
      {error&&<span className="radar-heat-error">{error}</span>}
      {!site&&!siteLoading&&<span>当前区域没有可用雷达坐标</span>}
    </div>
    <div className="radar-heat-scale map-overlay-toolbar">
      <span>{config.label}</span><small>{config.unit} · 参考色标</small>
      <div className="radar-heat-scale-body"><div className="radar-heat-gradient"/><div className="radar-heat-ticks">{config.ticks.map(value=><span key={value} style={{bottom:`${radarHeatRatio(value,factor)*100}%`}}>{value}</span>)}</div></div>
    </div>
    <button type="button" className="radar-heat-previous radar-heat-mode-card screen-glass-panel" onClick={()=>{
      setPlaying(false)
      if(historyMode){setRange(null);setRefresh(n=>n+1)}
      setHistoryMode(!historyMode)
    }} aria-label={historyMode?'返回上一周期':'查看历史范围'}>
      <div className="radar-heat-mini-title">{historyMode?'上一周期':'历史范围'} <span>切换</span></div>
      <div className="radar-mode-preview" aria-hidden="true">
        <img src="/images/radar-mode-preview.png" alt="" />
        <span className="radar-preview-name-blur" />
        {!historyMode&&<div className="radar-preview-player"><CaretRightOutlined/><span/><i/></div>}
      </div>
      <div>{historyMode?'返回最近完成的扫描':'选择时间并播放历史扫描'}</div>
    </button>
    {historyMode&&<div className="radar-heat-controls map-overlay-toolbar">
      <div className="radar-heat-date-row"><span>历史范围</span>
        <DatePicker.RangePicker value={range} onChange={changeRange} showTime format="YYYY-MM-DD HH:mm:ss" className="screen-range-picker" size="small"
          disabledDate={disabledFutureDate} presets={[1,3,24].map(hours=>({label:`最近${hours}小时`,value:()=>[dayjs().subtract(hours,'hour'),dayjs()] as [Dayjs,Dayjs]}))}/>
      </div>
      {range&&<div className="radar-heat-player">
        <Button aria-label="上一扫描周期" icon={<StepBackwardOutlined/>} disabled={index===0} onClick={()=>{setPlaying(false);setIndex(i=>i-1)}}/>
        <Button type="primary" shape="circle" aria-label={playing?'暂停扫描回放':'播放扫描回放'} icon={playing?<PauseOutlined/>:<CaretRightOutlined/>}
          disabled={frames.length===0} onClick={()=>{if(index===frames.length-1&&!loading)setIndex(0);setPlaying(!playing)}}/>
        <Button aria-label="下一扫描周期" icon={<StepForwardOutlined/>} disabled={index>=frames.length-1} onClick={()=>{setPlaying(false);setIndex(i=>i+1)}}/>
        <Slider aria-label="扫描周期进度" min={0} max={Math.max(1,frames.length-1)} value={index} disabled={frames.length<2} onChange={value=>{setPlaying(false);setIndex(value)}}/>
        <span>{frames.length?index+1:0} / {frames.length} 已接收周期</span>{loading&&<><Spin size="small"/><span>{playing&&index>=frames.length-1?'等待下一完整周期':'继续接收中'}</span></>}
      </div>}
      <small>仅播放已接收的完整周期，追上接收进度时等待；播放到末尾停止。单次最多缓存200周期，超出时请缩小范围。</small>
    </div>}
  </div>
}

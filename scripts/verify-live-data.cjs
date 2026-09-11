// 离线契约回归：以下 fixture 仅用于测试，不进入页面数据源。
const assert=require('node:assert/strict')
const fs=require('node:fs'),path=require('node:path'),Module=require('node:module'),ts=require('typescript')
require.extensions['.ts']=(module,filename)=>module._compile(ts.transpileModule(fs.readFileSync(filename,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,esModuleInterop:true}}).outputText,filename)
const originalLoad=Module._load
let airResponse,airParams,periodsResponse,detailResponse,detailRequested,sourceResponse
Module._load=function(name,parent,isMain){
  if(name==='@/servers/airData')return {airDataSeries:async params=>{airParams=params;return airResponse}}
  if(name==='@/servers/radarHeat')return {radarPeriods:async()=>periodsResponse,radarPeriodDetail:async id=>{detailRequested=id;return detailResponse}}
  if(name==='@/servers/business')return {dataSourceApi:{list:async()=>sourceResponse}}
  if(name==='@/utils/storage')return {getLocalInfo:()=> 'test-only-token'}
  if(name.startsWith('@/'))name=path.resolve(__dirname,'../src',name.slice(2))
  return originalLoad.call(this,name,parent,isMain)
}
const {buildAirHistory,getAirHistory,AIR_RESOLUTION}=require('../src/pages/air-quality/data/apiAirPlaybackProvider.ts')
const {createSseParser,readAuthenticatedSse}=require('../src/servers/sse.ts')
const {decodeSpsDetail}=require('../src/features/radar-heat/spsAdapter.ts')
const {resolveRadarSiteYaw}=require('../src/features/radar-heat/siteYaw.ts')
const {radarHeatProvider}=require('../src/features/radar-heat/apiStream.ts')
const {fetchAllAirSources}=require('../src/pages/air-quality/data/airQualityRepository.ts')
const query={type:'hourly',startTime:'2026-08-01 08:00:00',endTime:'2026-08-01 09:59:59'}
const sources=[{deviceId:'a',lng:120,lat:30,values:{pm25:999}}]
const air={resolution:'hour',stations:[{deviceId:'a',lng:120.1,lat:30.1}],series:[
  {deviceId:'a',time:'2026-08-01 08:00:00',pm25:0,co:null},
  {deviceId:'other-region',time:'2026-08-01 09:00:00',pm25:200},
]}
const result=buildAirHistory(air,query,sources)
assert.equal(result.frames.length,2)
assert.equal(result.frames[0].valuesByDeviceId.a.pm25,0)
assert.equal(result.frames[1].valuesByDeviceId.a.pm25,null)
assert.equal(result.stations[0].lng,120.1)
assert.equal(result.frames[0].valuesByDeviceId.a.co,null)
assert.equal(buildAirHistory({...air,series:[]},query,sources).frames.length,0)
assert.throws(()=>buildAirHistory({...air,resolution:'day'},query,sources),/类型不匹配/)
assert.deepEqual(AIR_RESOLUTION,{minute:'minute',hourly:'hour',daily:'day'})
const messages=[],parser=createSseParser(message=>messages.push(message))
for(const char of ':心跳\r\nevent: frame\r\nid: 1\r\ndata: 第一行\r\ndata: 第二行\r\n\r\ndata: {"type":"end"}\n\n')parser.feed(char)
assert.equal(messages.length,2);assert.equal(messages[0].data,'第一行\n第二行');assert.equal(messages[0].id,'1')
assert.equal(messages[1].data,'{"type":"end"}')
for(const raw of [0,'0'])assert.equal(resolveRadarSiteYaw(raw),0)
for(const raw of [null,undefined,'',NaN])assert.equal(resolveRadarSiteYaw(raw),undefined)
assert.equal(resolveRadarSiteYaw(250),250)
assert.equal(resolveRadarSiteYaw(-90),270)
const site={id:'r1',lng:120,lat:30,name:'任意雷达站',yaw:resolveRadarSiteYaw(0)}
const detail={radarId:'r1',periodId:'p1',scanType:'PPI',startTime:'2026-08-01 08:00:00',endTime:'2026-08-01 08:05:00',rayCount:2,rays:[
  {dataTime:'2026-08-01 08:00:00',hangle:0,vangle:90,distanceArray:[0,.03,.07],valueArray:[null,0,.1]},
  {dataTime:'2026-08-01 08:00:01',hangle:1,vangle:90,distanceArray:'[0,0.03,0.07]',valueArray:'[0.1,"NaN",0.2]'},
]}
const scan=decodeSpsDetail(detail,'r1')
assert.equal(scan.complete,true);assert.deepEqual(scan.rays[0].distanceEdgesM,[0,30,70,110]);assert.equal(scan.rays[0].width,1)
assert.equal(scan.rays[0].values[0],null);assert.equal(scan.rays[0].values[1],0)
assert.equal(scan.rays[1].values[1],null)
// 恢复顺时针，不再镜像；兼容负角及多圈。
for (const [hangle, expected] of [[0,252],[90,342],[108,0],[135,27],[180,72],[270,162],[-90,162],[450,342]]) {
  const rotated=decodeSpsDetail({...detail,rayCount:1,rays:[{...detail.rays[0],hangle}]},'r1')
  assert.equal(rotated.rays[0].bearing,expected)
  assert.deepEqual(rotated.rays[0].values,scan.rays[0].values)
  assert.deepEqual(rotated.rays[0].distanceEdgesM,scan.rays[0].distanceEdgesM)
}
// 公共修正与基站无关；非零站点偏航在公共修正上叠加一次。
for (const radarId of ['r1','r2','r3']) {
  for (const [yaw,expected] of [[undefined,252],[0,252],[30,282],[252,144]]) {
    const rotated=decodeSpsDetail({...detail,radarId},radarId,yaw)
    assert.equal(rotated.rays[0].bearing,expected)
    assert.equal(rotated.rays[0].width,1)
    assert.deepEqual(rotated.rays[0].values,scan.rays[0].values)
    assert.deepEqual(rotated.rays[0].distanceEdgesM,scan.rays[0].distanceEdgesM)
  }
}
const crossing=decodeSpsDetail({...detail,rays:detail.rays.map((ray,i)=>({...ray,hangle:107+i}))},'r1')
assert.deepEqual(crossing.rays.map(ray=>ray.bearing),[359,0])
assert.ok(crossing.rays.every(ray=>ray.width===1))
assert.throws(()=>decodeSpsDetail(detail,'r1',NaN),/偏航角无效/)
assert.throws(()=>decodeSpsDetail({...detail,rayCount:3},'r1'),/不完整/)
assert.throws(()=>decodeSpsDetail(detail,'other-site'),/不匹配/)
assert.throws(()=>decodeSpsDetail({...detail,rays:[{...detail.rays[0],distanceArray:[0,.03]}],rayCount:1},'r1'),/数量不匹配/)
const originalFetch=global.fetch
const streamResponse=text=>new Response(text,{headers:{'content-type':'text/event-stream'}})
async function main(){
  sourceResponse={code:200,data:{records:[{deviceId:'a'}],total:1}}
  assert.equal((await fetchAllAirSources({dataType:'air_quality_station'})).length,1)
  sourceResponse={resultCode:0,data:{records:[],total:0}}
  assert.equal((await fetchAllAirSources({dataType:'air_quality_station'})).length,0)
  sourceResponse={code:500,msg:'站点查询失败'}
  await assert.rejects(fetchAllAirSources({dataType:'air_quality_station'}),/站点查询失败/)
  airResponse={resultCode:0,data:air};await getAirHistory(query,sources)
  assert.deepEqual(airParams,{resolution:'hour',startTime:query.startTime,endTime:query.endTime})
  airResponse={code:500,msg:'历史查询失败'};await assert.rejects(getAirHistory(query,sources),/历史查询失败/)
  let requested
  global.fetch=async(url,options)=>{requested={url,options};return streamResponse('data: {"type":"end"}\n\n')}
  await readAuthenticatedSse('/dpSys/test',new AbortController().signal,event=>JSON.parse(event.data).type==='end')
  assert.equal(requested.options.headers.Authorization,'Bearer test-only-token')
  assert.ok(!requested.url.includes('token'))
  global.fetch=async()=>new Response(JSON.stringify({code:401,msg:'认证失败'}),{headers:{'content-type':'application/json'}})
  await assert.rejects(readAuthenticatedSse('/dpSys/test',new AbortController().signal,()=>false),/认证失败/)
  global.fetch=async()=>streamResponse('data: {"type":"frame"}\n\n')
  await assert.rejects(readAuthenticatedSse('/dpSys/test',new AbortController().signal,()=>false),/未收到结束事件/)
  periodsResponse={resultCode:0,data:[{...detail,periodId:'older',startTime:'2026-07-01 00:00:00'},detail]}
  detailResponse={resultCode:0,data:detail}
  await new Promise((resolve,reject)=>radarHeatProvider.subscribe({site,factor:'source'},{onFrame:frame=>{assert.equal(frame.period,'p1');assert.equal(frame.rays[0].bearing,252)},onComplete:resolve,onError:reject}))
  assert.equal(detailRequested,'p1')
  detailResponse={code:500,msg:'SPS文件读取失败'}
  await new Promise(resolve=>radarHeatProvider.subscribe({site,factor:'source'},{onFrame:()=>assert.fail('不能回退模拟帧'),onError:error=>{assert.match(error.message,/文件读取失败/);resolve()}}))
  // 一帧先到、结束事件后到：允许 UI 在流结束前播放完整周期。
  let enqueue,streamDone=false,received=0
  global.fetch=async()=>new Response(new ReadableStream({start(controller){enqueue=controller}}),{headers:{'content-type':'text/event-stream'}})
  let stop
  const complete=new Promise((resolve,reject)=>{
    stop=radarHeatProvider.subscribe({site,factor:'source',range:[Date.parse(detail.startTime),Date.parse(detail.endTime)]},{onFrame:frame=>{received++;assert.equal(frame.complete,true);assert.equal(frame.rays[0].bearing,252);assert.equal(streamDone,false)},onComplete:resolve,onError:reject})
  })
  await new Promise(resolve=>setImmediate(resolve))
  enqueue.enqueue(new TextEncoder().encode(`data: ${JSON.stringify({type:'frame',periodId:'p1',dataType:'sps',startTime:detail.startTime,data:detail.rays})}\n\n`))
  await new Promise(resolve=>setImmediate(resolve));assert.equal(received,1)
  streamDone=true;enqueue.enqueue(new TextEncoder().encode('data: {"type":"end"}\n\n'))
  await complete;stop()
  let aborted=false,callbacks=0
  global.fetch=async(_url,options)=>new Promise((_resolve,reject)=>options.signal.addEventListener('abort',()=>{aborted=true;reject(new DOMException('Cancelled','AbortError'))},{once:true}))
  const cancel=radarHeatProvider.subscribe({site,factor:'source',range:[0,1000]},{onFrame:()=>callbacks++,onComplete:()=>callbacks++,onError:()=>callbacks++})
  cancel();await new Promise(resolve=>setImmediate(resolve))
  assert.equal(aborted,true);assert.equal(callbacks,0)
  let emptyCount=0
  global.fetch=async()=>streamResponse('data: {"type":"end"}\n\n')
  await new Promise((resolve,reject)=>radarHeatProvider.subscribe({site,factor:'source',range:[0,1000]},{onFrame:()=>assert.fail('空结束不应生成帧'),onEmpty:()=>emptyCount++,onComplete:resolve,onError:reject}))
  assert.equal(emptyCount,1)
  global.fetch=async(_url,options)=>new Promise((_resolve,reject)=>options.signal.addEventListener('abort',()=>reject(new DOMException('Cancelled','AbortError')),{once:true}))
  await new Promise((resolve,reject)=>radarHeatProvider.subscribe({site,factor:'source',range:[0,1000]},{onFrame:()=>assert.fail('超时不应生成帧'),onEmpty:()=>emptyCount++,onComplete:resolve,onError:reject}))
  assert.equal(emptyCount,2)
  if(process.argv[2]){
    const payload=JSON.parse(fs.readFileSync(process.argv[2],'utf8'))
    global.fetch=async()=>streamResponse(`data: ${JSON.stringify(payload)}\n\ndata: {"type":"end"}\n\n`)
    await new Promise((resolve,reject)=>radarHeatProvider.subscribe({site:{...site,id:'ZJHZCF_310000_06_01'},factor:'source',range:[0,1000]},{onFrame:frame=>{assert.equal(frame.rays.length,payload.data.length);console.log('实际报文解析通过:',frame.period,frame.rays.length,'条射线')},onComplete:resolve,onError:reject}))
  }
  console.log('PASS: 真实接口参数映射、历史缺测/区域隔离/GCJ02、SSE 分块与多行、鉴权头/认证错误/异常断流、完整周期校验、后台错误不回退、边接收边交付周期')
}
main().catch(error=>{console.error(error);process.exitCode=1}).finally(()=>{global.fetch=originalFetch;Module._load=originalLoad})

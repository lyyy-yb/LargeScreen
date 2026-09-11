const assert=require('node:assert/strict')
const fs=require('node:fs')
const ts=require('typescript')
require.extensions['.ts']=(module,filename)=>module._compile(ts.transpileModule(fs.readFileSync(filename,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,esModuleInterop:true}}).outputText,filename)
const {decodeRadarEnvelope,mergeRadarRays,radarHeatColor,radarHeatRatio}=require('../src/features/radar-heat/model.ts')
const site={id:'demo-radar',name:'测试雷达',lng:120,lat:30}
const mapping={factorFor:type=>type===2?'source':undefined,bearingFor:row=>Number(row.straightAngle),distanceMultiplier:1000,rayWidth:3}
const row={radarId:site.id,periodId:'period-a',dataTime:'2026-09-02T23:48:15',scanType:'PPI',dataType:'2',angleOfPitch:'90.2',straightAngle:'31.94',distanceData:[0,.03,201],data:Array.from({length:201},(_,i)=>i<4?'NaN':i===5?0:.02)}
const envelope={SiteId:site.id,DataType:2,ScanMode:'PPI',Period:'period-a',IsGZip:false,Json:JSON.stringify([row])}
const rays=decodeRadarEnvelope(envelope,mapping)
assert.equal(rays.length,1);assert.ok(Math.abs(rays[0].bearing-31.94)<1e-8);assert.equal(rays[0].stepM,30)
assert.equal(rays[0].values[0],null);assert.equal(rays[0].values[5],0)
assert.equal(decodeRadarEnvelope({...envelope,Json:JSON.stringify([{...row,distanceData:[0,.03,200]}])},mapping).length,0)
assert.throws(()=>decodeRadarEnvelope({...envelope,IsGZip:true},mapping),/压缩协议/)
assert.equal(decodeRadarEnvelope({...envelope,Json:JSON.stringify([{...row,scanType:'RHI'}])},mapping).length,0)
let merged=mergeRadarRays(null,rays)
merged=mergeRadarRays(merged,rays);assert.equal(merged.rays.length,1)
merged=mergeRadarRays(merged,[{...rays[0],bearing:35}]);assert.equal(merged.rays.length,2)
merged=mergeRadarRays(merged,[{...rays[0],period:'period-b'}]);assert.equal(merged.rays.length,1)
assert.equal(radarHeatColor(0,'source'),'rgb(0,133,17)')
assert.equal(radarHeatRatio(.15,'source'),4/6)
console.log('PASS: 报文解析、NaN/零值、距离/角度映射、重发去重、周期隔离和色标')

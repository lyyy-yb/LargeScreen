// 无额外测试依赖：用项目 TypeScript 编译器加载纯业务模块。
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const Module = require('node:module')
const ts = require('typescript')
const dayjs = require('dayjs')
require.extensions['.ts'] = (module, filename) => {
  const code = ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true },
  }).outputText
  module.paths = Module._nodeModulePaths(path.dirname(filename))
  module._compile(code, filename)
}
const { recentRange, rangeError, toHistoryQuery, historyBuckets } = require('../src/pages/air-quality/utils/aggregation.ts')
const { concentrationMeans, demoConcentrationLevel } = require('../src/pages/air-quality/utils/concentration.ts')
const { normalizeHeatWeights } = require('../src/pages/air-quality/utils/heatScale.ts')
const { createMockAirPlaybackProvider } = require('../src/pages/air-quality/data/mockAirPlaybackProvider.ts')
async function main() {
  const now = dayjs('2026-09-05 20:38:42')
  for (const [type, count, unit] of [['minute',60,'minute'], ['hourly',48,'hour'], ['daily',31,'day']]) {
    const range = recentRange(type, count, now)
    assert.equal(rangeError(range, type, now), null)
    assert.ok(rangeError([range[0].subtract(1, unit),range[1]], type, now))
    assert.ok(rangeError([range[0],now], type, now))
    const query = toHistoryQuery(range, type)
    assert.deepEqual(Object.keys(query).sort(), ['endTime','startTime','type'])
    assert.equal(historyBuckets(query).length, count)
    assert.equal((await createMockAirPlaybackProvider().getFrames(query, [])).length, count)
  }
  assert.equal(historyBuckets(toHistoryQuery(recentRange('hourly',24,now),'hourly')).length,24)
  assert.equal(historyBuckets(toHistoryQuery(recentRange('daily',30,now),'daily')).length,30)
  assert.equal(rangeError([now.subtract(2,'day'),now.subtract(3,'day')],'daily',now), '结束时间不能早于开始时间')
  const mean = concentrationMeans([
    {mnCode:'a',dataTime:'2026-09-05 18',pm25:100},
    {mnCode:'a',dataTime:'2026-09-05 19',pm25:0},
    {mnCode:'b',dataTime:'2026-09-05 19',pm25:20},
    {mnCode:'c',dataTime:'2026-09-05 19',pm25:null},
    {mnCode:'d',dataTime:'2026-09-05 19',pm25:''},
  ])
  assert.deepEqual(mean[0], {key:'pm25',count:2,value:10})
  assert.equal(mean.find(x=>x.key==='co').value,null)
  assert.equal(demoConcentrationLevel('pm25',null).label,'暂无数据')
  assert.equal(demoConcentrationLevel('pm25',300).label,'严重污染')
  assert.deepEqual(normalizeHeatWeights([0,null,10,100]).weights,[.1,.1,.1,1])
  console.log('PASS: 三种时间上限/未来限制、快捷区间、三字段查询、mock 帧数、均值缺测/零值/去重、模拟评级、热力权重')
}
main().catch(error=>{ console.error(error); process.exitCode=1 })

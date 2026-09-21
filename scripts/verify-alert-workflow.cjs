const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const Module = require('node:module')
const ts = require('typescript')
const calls = []
let response = { code: 200, data: [] }
const request = Object.fromEntries(['get', 'post', 'delete'].map(method => [method, async (...args) => { calls.push({ method, args }); if (response instanceof Error) throw response; return response }]))
const originalLoad = Module._load
let taskRecord = { id: 12, alertId: 9001, status: 'pending', assigneeId: 107, photos: ['/site.png'], disposalContent: '原内容' }
let editedTask
Module._load = function (name, parent, isMain) {
  if (name === '@/servers/business') return { disposalTaskApi: {
    detail: async () => ({ resultCode: 0, data: taskRecord }),
    edit: async data => { editedTask = data; return { resultCode: 0 } },
  } }
  if (name === '@/servers/alertFollowUp') return originalLoad.call(this, path.resolve(__dirname, '../src/servers/alertFollowUp.ts'), parent, isMain)
  if (name === './request' && /(alert(FollowUp|Evidence)|disposalPhoto)\.ts$/.test(parent?.filename || '')) return { request, redirectToLoginOnExpired() {} }
  return originalLoad.call(this, name, parent, isMain)
}
require.extensions['.ts'] = (module, filename) => {
  const code = ts.transpileModule(fs.readFileSync(filename, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true } }).outputText
  module.paths = Module._nodeModulePaths(path.dirname(filename)); module._compile(code, filename)
}
const { alertEvidenceApi } = require('../src/servers/alertEvidence.ts')
const { disposalPhotoApi } = require('../src/servers/disposalPhoto.ts')
const { alertFollowUpApi, requireSuccess } = require('../src/servers/alertFollowUp.ts')
const { normalizePhotos } = require('../src/pages/alert/data/normalizePhotos.ts')
const { canCollectEvidence, canEditSiteResult, saveSiteResult, saveBeforeDispatch } = require('../src/pages/alert/data/evidenceWorkflow.ts')
async function main() {
  const { isEvidenceMedia, isEvidenceVideo } = require('../src/pages/alert/data/evidenceMedia.ts')
  for (const [name, type] of [['a.gif', 'image/gif'], ['a.webp', 'image/webp'], ['a.heic', ''], ['a.mp4', 'video/mp4']]) {
    assert.equal(isEvidenceMedia({ name, type }), true)
  }
  assert.equal(isEvidenceMedia({ name: 'notes.txt', type: 'text/plain' }), false)
  assert.equal(isEvidenceMedia({ name: 'a.zip', type: 'application/zip' }), false)
  assert.equal(isEvidenceVideo({ name: 'a.MP4' }), true)
  const sequence = []
  await saveBeforeDispatch(true, async () => { sequence.push('save'); return true }, () => sequence.push('dispatch'))
  assert.deepEqual(sequence, ['save', 'dispatch'])
  sequence.length = 0
  await saveBeforeDispatch(true, async () => { sequence.push('failed'); return false }, () => sequence.push('dispatch'))
  assert.deepEqual(sequence, ['failed'])
  sequence.length = 0
  await saveBeforeDispatch(false, async () => { sequence.push('save'); return true }, () => sequence.push('dispatch'))
  assert.deepEqual(sequence, ['dispatch'])
  console.log('PASS: 修改后先保存再派发、保存失败阻止派发、无修改直接派发')
  const file = new File(['test'], 'test.png', { type: 'image/png' })
  response = { code: 200, data: { id: 12 } }
  let call
  const fullEvidence = {
    alertEventId: '9001', radarContent: '雷达说明', microStationContent: '小微站说明', droneContent: '无人机说明',
    radarFiles: [file, new File(['radar2'], 'radar2.png', { type: 'image/png' })], microStationFiles: [file], droneFiles: [],
  }
  const detail = { radar: { content: null, images: [{ id: 3, alertEventId: 9001, evidenceType: 'radar', filePath: '/9001/radar/test.png', fileName: 'test.png' }] }, microStation: { content: '你好', images: [] }, drone: { content: '无人机说明', images: [] } }
  response = { code: 200, data: detail }
  assert.deepEqual(await alertEvidenceApi.detail('9001'), detail)
  assert.equal(calls.at(-1).args[0], '/dpSys/hbdp/alert/evidence/detail')
  assert.deepEqual(calls.at(-1).args[1].params, { alertEventId: '9001' })
  await alertEvidenceApi.save(fullEvidence)
  call = calls.pop()
  assert.equal(call.args[0], '/dpSys/hbdp/alert/evidence/save')
  for (const field of ['alertEventId', 'radarContent', 'microStationContent', 'droneContent']) assert.equal(call.args[1].get(field), fullEvidence[field])
  for (const field of ['radarFiles', 'microStationFiles', 'droneFiles']) {
    const parts = call.args[1].getAll(field)
    assert.equal(parts.length, fullEvidence[field].length)
    for (let i = 0; i < parts.length; i++) {
      assert.ok(parts[i] instanceof File)
      assert.equal(parts[i].name, fullEvidence[field][i].name)
      assert.equal(await parts[i].text(), await fullEvidence[field][i].text())
    }
  }
  assert.equal(calls.some(item => item.args[0].endsWith('/evidence/upload')), false)
  await alertFollowUpApi.create('9001', '复测正常', [file, file])
  call = calls.pop()
  assert.equal(call.args[0], '/dpSys/hbdp/alert/follow-up')
  assert.deepEqual(call.args[2].params, { alertEventId: '9001', content: '复测正常' })
  assert.equal(call.args[1].getAll('files').length, 2)
  response = { code: 200, data: [] }
  assert.deepEqual(await alertFollowUpApi.list('9001'), [])
  await alertEvidenceApi.remove(12)
  assert.equal(calls.at(-1).args[0], '/dpSys/hbdp/alert/evidence/12')
  response = new Blob(['test'], { type: 'image/png' })
  assert.ok(await alertEvidenceApi.image(12) instanceof Blob)
  assert.equal(calls.at(-1).args[1].responseType, 'blob')
  response = new Blob([new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10])], { type: 'application/octet-stream' })
  assert.equal((await alertEvidenceApi.image(12)).type, 'image/png')
  response = new Blob([new Uint8Array([255, 216, 255, 224])])
  assert.equal((await disposalPhotoApi.image(71)).type, 'image/jpeg')
  assert.equal(calls.at(-1).args[0], '/dpSys/hbdp/disposalTask/image/71')
  assert.equal(calls.at(-1).args[1].responseType, 'blob')
  assert.equal((await alertFollowUpApi.image(12)).type, 'image/jpeg')
  response = new Blob(['GIF89a......'], { type: 'application/octet-stream' })
  assert.equal((await alertEvidenceApi.image(12)).type, 'image/gif')
  response = new Blob([new Uint8Array([0, 0, 0, 24]), 'ftypisom'], { type: 'application/octet-stream' })
  assert.equal((await alertEvidenceApi.image(12)).type, 'video/mp4')
  const movie = new File(['video-data'], 'evidence.mp4', { type: 'video/mp4' })
  response = { code: 200 }
  await alertEvidenceApi.save({ ...fullEvidence, droneFiles: [movie] })
  assert.equal(calls.at(-1).args[1].get('droneFiles').type, 'video/mp4')
  response = new Blob(['{"code":500}'], { type: 'application/json' })
  await assert.rejects(disposalPhotoApi.image(71), /图片加载失败/)
  await assert.rejects(alertFollowUpApi.image(1), /图片加载失败/)
  response = { code: 500, msg: '模拟拒绝' }
  await assert.rejects(alertEvidenceApi.detail('9001'), /模拟拒绝/)
  await assert.rejects(alertEvidenceApi.save(fullEvidence), /模拟拒绝/)
  await assert.rejects(alertFollowUpApi.create('9001', '复测正常', []), /模拟拒绝/)
  response = new Error('网络中断')
  await assert.rejects(alertEvidenceApi.detail('9001'), /网络中断/)
  assert.throws(() => requireSuccess({ resultCode: 1, message: '失败' }), /失败/)
  assert.equal(requireSuccess({ resultCode: 0, data: '成功' }), '成功')
  assert.equal(requireSuccess({ code: 200, data: '成功' }), '成功')
  assert.throws(() => requireSuccess({ code: 500, msg: '保存被拒绝' }), /保存被拒绝/)
  assert.throws(() => requireSuccess({ code: 500, resultCode: 0, msg: '冲突错误码' }), /冲突错误码/)
  assert.throws(() => requireSuccess({ code: 200, resultCode: 1, message: '业务失败' }), /业务失败/)
  assert.throws(() => requireSuccess({ data: null }), /操作失败/)
  assert.throws(() => requireSuccess({ code: 500, msg: "\n### Error updating database. Cause: java.sql.SQLIntegrityConstraintViolationException: Duplicate entry '04260800001' for key 'hbdp_data_source.uk_mn_code'" }), /设备编号（MN码）已存在/)
  assert.throws(() => requireSuccess({ code: 500, msg: '\n### SQL Exception' }), /^Error: 操作失败，请稍后重试或联系管理员$/)

  assert.deepEqual(normalizePhotos('["/a.png", "/b.png"]'), ['/a.png', '/b.png'])
  assert.deepEqual(normalizePhotos('/a.png, /b.png'), ['/a.png', '/b.png'])
  assert.deepEqual(normalizePhotos(undefined), [])
  for (const status of ['undispatched', 'pending', 'processing']) assert.equal(canCollectEvidence(status), true)
  for (const status of ['completed', 'closed', 'cleared']) assert.equal(canCollectEvidence(status), false)
  assert.equal(canEditSiteResult('undispatched'), false)
  for (const status of ['pending', 'processing']) {
    taskRecord = { ...taskRecord, status }
    await saveSiteResult(12, '9001', '现场复测完成')
    assert.deepEqual(editedTask, { ...taskRecord, disposalContent: '现场复测完成' })
  }
  taskRecord = { ...taskRecord, status: 'completed' }
  await assert.rejects(saveSiteResult(12, '9001', '新结果'), /状态已变化/)
  console.log('PASS: 三状态取证入口、现场核查填写状态、保存保留任务人员/照片/状态、阻止过期状态写入')
  console.log('PASS: 取证分类/单文件、后续处置多文件、预警关联参数、删除、鉴权图片 Blob、业务失败/网络失败不回退 mock、现场照片解析')
}
main().catch(error => { console.error(error); process.exitCode = 1 })

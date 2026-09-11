/** 仅供本地 Vite 验证：所有 HTTP 请求均由 adapter 拦截，绝不访问或修改线上业务数据。 */
import { useState } from 'react'
import { createRoot } from 'react-dom/client'
import { MemoryRouter } from 'react-router-dom'
import { App, Button, ConfigProvider, theme } from 'antd'
import zhCN from 'antd/es/locale/zh_CN'
import AlertPage from '../src/pages/alert'
import { request } from '../src/servers/request'
import { useAuthStore, useAppStore } from '../src/stores'
import 'uno.css'
import '../src/assets/css/global.less'

if (!import.meta.env.DEV) throw new Error('此验证入口仅允许开发环境使用')
useAuthStore.setState({ username: 'alert-workflow-test', user: null })
const selection = { provinceCode: '330000', provinceName: '浙江省' } as const
useAppStore.setState({ regionContext: { roleLevel: 'admin', selection, defaultSelection: selection, querySelection: selection, mapSelection: selection, usedFallback: false, initialized: true,
  departments: [{ deptId: 108, deptName: '衢州市' }, { deptId: 11172, parentId: 108, deptName: '智造新城' }, { deptId: 11173, parentId: 11172, deptName: '智造新城街道' }] } })
const alert = { id: 9001, ruleName: 'SO₂ 小时浓度高值', alertLevel: 'level1', dataType: 'air_quality_station', deviceName: '测试小微站', location: '测试工业园区', triggerReason: 'SO₂ 小时浓度超过预警阈值，需排查周边污染源。', status: 'undispatched', createTime: '2026-09-07 10:00:00', cityId: 108, districtId: 11172, townId: 11173 }
const closedAlert = { ...alert, id: 9003, status: 'closed', deviceName: '已完成任务测试站' }
const task = { id: 9002, alertId: 9003, taskType: 'on_site_check', dataType: 'air_quality_station', status: 'completed', assigneeName: '测试处置员', requesterName: '测试派发员', createTime: '2026-09-07 10:15:00', requireTime: '2026-09-07 16:00:00', completedAt: '2026-09-07 15:30:00', disposalContent: '已核查园区排口运行情况，完成设备检修并复测污染物浓度。', photos: [] }
const pendingAlert = { ...alert, id: 9004, status: 'pending', deviceName: '待处置测试站' }
const processingAlert = { ...alert, id: 9006, status: 'processing', deviceName: '处置中测试站' }
const tasks = [task, { ...task, id: 9005, alertId: 9004, status: 'pending', completedAt: '', disposalContent: '' }, { ...task, id: 9007, alertId: 9006, status: 'processing', completedAt: '', disposalContent: '已抵达现场' }]
const alerts = [alert, closedAlert, pendingAlert, processingAlert]
const contents = new Map<string, string>()
const images: Array<{ id: number; alertEventId: string; evidenceType: string; fileName: string; blob: Blob }> = []
const followUps: Array<{ id: number; alertEventId: string; content: string; createTime: string; images: Array<{ id: number; fileName: string }> }> = []
let nextId = 1
let failNext = false
const operations: string[] = []
request.instance.defaults.adapter = async config => {
  const url = config.url || ''
  const params = config.params || {}
  let data: unknown
  const ok = (value: unknown) => ({ resultCode: 0, message: 'success', data: value })
  const ajax = (value: unknown) => ({ code: 200, msg: '操作成功', data: value })
  const page = (records: unknown[]) => ok({ records, total: records.length, current: 1, size: 15 })
  if (failNext) { failNext = false; data = { code: 500, msg: '模拟接口失败，输入内容应保留' } }
  else if (url.endsWith('/evidence/detail')) {
    const detail: Record<string, unknown> = {}
    for (const [prefix, kind] of [['radar', 'radar'], ['microStation', 'micro_station'], ['drone', 'drone']]) {
      detail[prefix] = { content: contents.get(`${params.alertEventId}:${kind}`) || null, images: images.filter(image => image.alertEventId === String(params.alertEventId) && image.evidenceType === kind) }
    }
    data = ajax(detail)
  }
  else if (url.endsWith('/evidence/content')) {
    const key = `${params.alertEventId}:${params.evidenceType}`
    if (config.method === 'post') { contents.set(key, params.content); operations.push(`保存文字 ${key}`) }
    data = ajax(contents.get(key) || '')
  }
  else if (url.endsWith('/evidence/save')) {
    const body = config.data as FormData
    const alertId = String(body.get('alertEventId'))
    for (const [prefix, kind] of [['radar', 'radar'], ['microStation', 'micro_station'], ['drone', 'drone']]) {
      const uploads = body.getAll(`${prefix}Files`)
      for (const file of uploads) {
        if (!(file instanceof File)) throw new Error('Files 必须是图片文件')
        images.push({ id: nextId++, alertEventId: alertId, evidenceType: kind, fileName: file.name, blob: file })
      }
      contents.set(`${alertId}:${kind}`, String(body.get(`${prefix}Content`) || ''))
      operations.push(`完整保存 ${kind} ${uploads.length}张图片`)
    }
    data = ajax(null)
  }
  else if (/\/(evidence|follow-up)\/image\//.test(url)) {
    data = images.find(image => image.id === Number(url.split('/').pop()))?.blob || new Blob([], { type: 'application/json' })
  } else if (config.method === 'delete' && /\/evidence\/\d+$/.test(url)) {
    const id = Number(url.split('/').pop()); const index = images.findIndex(image => image.id === id)
    if (index >= 0) images.splice(index, 1)
    operations.push(`删除图片 ${id}`); data = ajax(null)
  } else if (url.endsWith('/evidence/list')) data = ajax(images.filter(image => image.alertEventId === String(params.alertEventId)))
  else if (url.endsWith('/follow-up/list')) data = ajax(followUps.filter(record => record.alertEventId === String(params.alertEventId)))
  else if (url.endsWith('/follow-up') && config.method === 'post') {
    const photos = (config.data as FormData).getAll('files').map(value => {
      const file = value as File
      const entry = { id: nextId++, alertEventId: String(params.alertEventId), evidenceType: 'follow-up', fileName: file.name, blob: file }
      images.push(entry); return { id: entry.id, fileName: file.name }
    })
    followUps.push({ id: nextId++, alertEventId: String(params.alertEventId), content: params.content, createTime: '2026-09-07 18:00:00', images: photos })
    operations.push(`后续处置 预警${params.alertEventId} ${photos.length}张图片`); data = ajax(null)
  } else if (url.endsWith('/alertEvent/dashboard')) data = ok({ effectiveCount: 1, pendingCount: 1, processingCount: 0, completedCount: 1, todayDispatchCount: 1, todayClosedCount: 1, latestAlerts: [] })
  else if (url.endsWith('/alertEvent/list')) data = page(alerts.filter(item => !params.status || item.status === params.status))
  else if (/\/alertEvent\/\d+$/.test(url)) data = ok(alerts.find(item => item.id === Number(url.split('/').pop())))
  else if (url.endsWith('/disposalTask/list')) data = page(tasks.filter(item => (!params.status || item.status === params.status) && (!params.alertId || item.alertId === params.alertId)))
  else if (/\/disposalTask\/\d+$/.test(url)) {
    const current = tasks.find(item => item.id === Number(url.split('/').pop()))
    data = ok(current && { ...current, verifications: current.id === 9002 ? [
      { id: 51, verifyBy: '现场核查员', verifyTime: '2026-09-08 10:30:00', verificationResult: '现场复测发现排口异常，已完成处理设施检查并要求整改。', photos: [{ id: 71, fileName: '核查照片.png' }] },
      { id: 52, verifyBy: '复核员', verifyTime: '2026-09-08 14:30:00', verificationResult: '整改后复测正常。', photos: [] },
    ] : [] })
  }
  else if (/\/disposalTask\/image\/\d+$/.test(url)) {
    operations.push(`读取核查照片 ${url.split('/').pop()}`)
    data = new Blob([Uint8Array.from(atob('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jRZkAAAAASUVORK5CYII='), value => value.charCodeAt(0))], { type: 'image/png' })
  }
  else if (url.endsWith('/disposalTask') && config.method === 'put') {
    const update = JSON.parse(config.data)
    Object.assign(tasks.find(item => item.id === update.id)!, update)
    operations.push(`核查结果 任务${update.id} 状态${update.status}`); data = ok(null)
  }
  else if (url.endsWith('/alertEvent/dispatch')) { alert.status = 'pending'; tasks.push({ ...task, id: 9008, alertId: 9001, status: 'pending', completedAt: '', disposalContent: '' }); operations.push('派发'); data = ok('派发成功') }
  else if (url.includes('/system/user/list')) data = { code: 200, rows: [{ userId: 1, nickName: '测试处置员', status: '0' }] }
  else throw new Error(`验证入口阻止了未配置请求：${url}`)
  return { data, status: 200, statusText: 'OK', headers: {}, config }
}

function Preview() {
  const [log, setLog] = useState('')
  return <><div style={{ position: 'fixed', bottom: 4, left: 8, zIndex: 2000, background: '#061d38', padding: 6, color: '#91c6df', fontSize: 12 }}>
    本地隔离验证 <Button size="small" onClick={() => { failNext = true }}>下次请求失败</Button>
    <Button size="small" onClick={() => setLog(operations.join('；'))}>查看请求记录</Button><span>{log}</span>
  </div><AlertPage /></>
}
createRoot(document.getElementById('root')!).render(<ConfigProvider locale={zhCN} theme={{ algorithm: theme.darkAlgorithm, token: { colorPrimary: '#03fbfd', colorBgBase: '#062B64', colorBgContainer: '#3669A4', colorBgElevated: '#062B64', colorText: '#fff' } }}><App><MemoryRouter><Preview /></MemoryRouter></App></ConfigProvider>)

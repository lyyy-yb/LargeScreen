import { useEffect, useRef, useState } from 'react'
import { Alert, App, Button, Input, Modal, Spin, Tag } from 'antd'
import { LockOutlined } from '@ant-design/icons'
import dayjs from 'dayjs'
import type { AlertEvent } from './AlertDetailModal'
import { EVIDENCE_GROUPS, emptyEvidence, loadEvidence, saveEvidence, type EvidenceKind, type EvidenceRecord } from '../data/evidenceRepository'
import EvidenceImages, { type EvidenceUploadFile } from '../components/EvidenceImages'
import { alertEvidenceApi } from '@/servers/alertEvidence'
import { alertEventApi } from '@/servers/business'
import { requireSuccess } from '@/servers/alertFollowUp'
import { useEvidence } from '../data/useEvidence'
import { AlertFacts } from '../components/DetailSections'
import { canCollectEvidence, canEditSiteResult, loadSiteTasks, saveSiteResult, saveBeforeDispatch } from '../data/evidenceWorkflow'
import type { DisposalTaskDTO } from '@/types/business'

interface Props { alert: AlertEvent; onClose: () => void; onDispatch: () => void; onSaved?: () => void; onBusyChange?: (busy: boolean) => void; onReadyChange?: (ready: boolean) => void }

function EvidenceEditor({ alert, initial, scope, onClose, onDispatch, onSaved, onBusyChange, onReadyChange, siteTasks, siteLoading, siteError, retrySite }: Props & {
  initial: EvidenceRecord; scope: string; siteTasks: DisposalTaskDTO[]; siteLoading: boolean; siteError: string; retrySite: () => void
}) {
  const { message } = App.useApp()
  const [name, setName] = useState(initial.taskName || `${alert.deviceName} ${alert.ruleName}`)
  const [sections, setSections] = useState(initial.sections)
  const [files, setFiles] = useState<Record<EvidenceKind, EvidenceUploadFile[]>>({
    radar: initial.sections.radar.images, station: initial.sections.station.images, drone: initial.sections.drone.images,
  })
  const [saving, setSaving] = useState(false)
  const knownImages = useRef(EVIDENCE_GROUPS.flatMap(({ key }) => initial.sections[key].images).filter(image => image.serverId != null))
  const [uncertainUpload, setUncertainUpload] = useState(false)
  const contentUnavailable = !!initial.contentErrors?.length
  const [siteResults, setSiteResults] = useState<Record<number, string>>({})
  const savingRef = useRef(false)
  const snapshot = (currentFiles: typeof files) => JSON.stringify({
    name, descriptions: EVIDENCE_GROUPS.map(({ key }) => sections[key].description),
    images: EVIDENCE_GROUPS.map(({ key }) => currentFiles[key].map(file => ({ uid: file.uid, caption: file.caption || '', filePath: file.filePath }))),
    siteResults,
  })
  const savedSnapshot = useRef(snapshot(files))
  useEffect(() => { onReadyChange?.(!contentUnavailable && !uncertainUpload && !siteLoading && !siteError); return () => onReadyChange?.(false) }, [onReadyChange, contentUnavailable, uncertainUpload, siteLoading, siteError])
  const persist = async (closeAfterSave = true): Promise<boolean> => {
    if (savingRef.current || contentUnavailable || uncertainUpload || siteLoading || siteError) return false
    if (!name.trim()) { message.warning('请输入任务名称'); return false }
    savingRef.current = true
    setSaving(true)
    onBusyChange?.(true)
    try {
      const current = requireSuccess(await alertEventApi.detail(Number(alert.id)))
      if (!current || !canCollectEvidence(current.status)) throw new Error('该预警已不可取证，请关闭弹窗并刷新列表')
      if (canEditSiteResult(alert.status) && !canEditSiteResult(current.status)) throw new Error('预警状态已变化，请重新打开取证弹窗')
      const nextFiles = { radar: [...files.radar], station: [...files.station], drone: [...files.drone] }
      const retained = new Set(EVIDENCE_GROUPS.flatMap(({ key }) => nextFiles[key]).map(image => String(image.serverId)))
      for (const image of [...knownImages.current]) {
        if (retained.has(String(image.serverId))) continue
        await alertEvidenceApi.remove(image.serverId!)
        knownImages.current = knownImages.current.filter(item => item.serverId !== image.serverId)
      }
      const [radar, station, drone] = EVIDENCE_GROUPS.map(({ key }) => ({
        description: sections[key].description.trim(), images: nextFiles[key].map(file => ({
          uid: file.uid, serverId: file.serverId, filePath: file.filePath, name: file.name, caption: file.caption, url: '',
        })),
      }))
      const localFiles = (kind: EvidenceKind) => nextFiles[kind].flatMap(file => file.originFileObj ? [file.originFileObj] : [])
      await alertEvidenceApi.save({
        alertEventId: alert.id,
        radarContent: radar.description, microStationContent: station.description, droneContent: drone.description,
        radarFiles: localFiles('radar'), microStationFiles: localFiles('station'), droneFiles: localFiles('drone'),
      })
      // 保存后重新取得服务端图片 ID，自动保存不关闭时也不会再次上传同一批图片。
      try {
        const refreshed = await loadEvidence(scope, alert.id)
        for (const { key } of EVIDENCE_GROUPS) {
          nextFiles[key] = refreshed.sections[key].images.map(image => ({ ...image,
            caption: nextFiles[key].find(file => file.serverId != null && file.serverId === image.serverId || file.name === image.name)?.caption,
          }))
        }
        setFiles({ ...nextFiles })
        knownImages.current = EVIDENCE_GROUPS.flatMap(({ key }) => nextFiles[key]).filter(image => image.serverId != null).map(image => ({ ...image, url: image.url || '' }))
      } catch {
        setUncertainUpload(true)
        throw new Error('取证已保存，但图片回显加载失败。请重新打开弹窗后继续，避免重复提交图片')
      }
      await saveEvidence(scope, { alertId: alert.id, taskName: name.trim(), updatedAt: dayjs().format('YYYY-MM-DD HH:mm:ss'), sections: { radar: { ...radar, images: nextFiles.radar.map(file => ({ ...file, url: file.url || '' })) }, station: { ...station, images: nextFiles.station.map(file => ({ ...file, url: file.url || '' })) }, drone: { ...drone, images: nextFiles.drone.map(file => ({ ...file, url: file.url || '' })) } } })
      for (const task of siteTasks) {
        const content = siteResults[task.id] ?? task.disposalContent ?? ''
        if (content !== (task.disposalContent || '')) await saveSiteResult(task.id, alert.id, content.trim())
      }
      message.success('取证记录已保存')
      onSaved?.()
      savedSnapshot.current = snapshot(nextFiles)
      if (closeAfterSave) onClose()
      return true
    } catch (err) { message.error(err instanceof Error ? err.message : '取证保存失败'); return false }
    finally { savingRef.current = false; setSaving(false); onBusyChange?.(false) }
  }
  const dispatch = async () => {
    if (savingRef.current) return
    await saveBeforeDispatch(snapshot(files) !== savedSnapshot.current, () => persist(false), onDispatch)
  }
  return <form id={`evidence-form-${alert.id}`} onSubmit={event => { event.preventDefault(); void persist() }}>
    {contentUnavailable && <Alert type="error" title="取证文字接口加载失败，图片可查看。为避免覆盖已有内容，暂不能保存，请稍后重新打开重试。" />}
    {uncertainUpload && <Alert type="warning" title="请关闭弹窗后重新打开，核对已上传图片后继续" />}
    <section className="evidence-section">
      <h3>基础信息</h3>
      <label className="evidence-field-label" htmlFor="evidence-task-name">任务名称 <span className="evidence-muted">（取证过程中可编辑，便于定位企业）</span></label>
      <Input id="evidence-task-name" value={name} maxLength={100} disabled={saving} placeholder="请输入取证任务名称" onChange={e => setName(e.target.value)} />
      <AlertFacts alert={alert} />
    </section>
    <section className="evidence-section">
      <h3>非现场取证</h3>
      {EVIDENCE_GROUPS.map(group => <div key={group.key} className="evidence-group">
        <h4>{group.title}</h4>
        <div className="evidence-split">
        <EvidenceImages files={files[group.key]} onChange={value => setFiles(previous => ({ ...previous, [group.key]: value }))}
          title={group.upload} hint={`${group.hint}；单个不超过 10 MB，最多 9 个`} captions disabled={saving} />
        <div className="evidence-description"><label className="evidence-field-label" htmlFor={`evidence-description-${group.key}`}>取证说明</label>
        <Input.TextArea id={`evidence-description-${group.key}`} aria-label={`${group.title}取证说明`} rows={3} maxLength={2000} value={sections[group.key].description}
          disabled={saving} placeholder={group.placeholder} onChange={e => setSections(previous => ({ ...previous, [group.key]: { ...previous[group.key], description: e.target.value } }))} />
        </div></div>
      </div>)}
    </section>
    {alert.status === 'undispatched' && <div className="evidence-dispatch">
      <div><strong>派发现场核查任务</strong><p>有修改时将先保存取证记录，再选择处置人员派发。</p></div>
      <Button type="primary" disabled={saving} onClick={() => void dispatch()}>派发处置任务</Button>
    </div>}
    <section className="evidence-section"><h3>现场核查结果 {!canEditSiteResult(alert.status) && <small>（待派发后激活）</small>}</h3>
      {canEditSiteResult(alert.status) ? siteLoading ? <Spin /> : siteError ? <Alert type="error" title={siteError} action={<Button onClick={retrySite}>重试</Button>} /> : siteTasks.length ? siteTasks.map(task => <div className="evidence-card" key={task.id}>
        <label className="evidence-field-label" htmlFor={`site-result-${task.id}`}>任务 #{task.id} · {task.assigneeName || '未分配处置人'}</label>
        <Input.TextArea id={`site-result-${task.id}`} rows={5} maxLength={4000} disabled={saving} value={siteResults[task.id] ?? task.disposalContent ?? ''}
          placeholder="请填写现场核查过程、排查情况和处置结果" onChange={event => setSiteResults(previous => ({ ...previous, [task.id]: event.target.value }))} />
      </div>) : <Alert type="info" title="暂无可填写的关联处置任务，请确认任务已派发后重新打开" />
        : <div className="evidence-locked"><LockOutlined /><strong>现场核查结果未激活</strong><p>派发后可在待处置、处置中状态填写现场核查结果</p></div>}
    </section>
  </form>
}

function EvidenceSession(props: Props) {
  const { data, loading, error, scope, retry } = useEvidence(props.alert.id)
  const [siteTasks, setSiteTasks] = useState<DisposalTaskDTO[]>([])
  const [siteLoading, setSiteLoading] = useState(canEditSiteResult(props.alert.status))
  const [siteError, setSiteError] = useState('')
  const [revision, setRevision] = useState(0)
  useEffect(() => {
    let active = true
    queueMicrotask(() => { if (active) { setSiteLoading(true); setSiteError('') } })
    const load = canEditSiteResult(props.alert.status) ? loadSiteTasks(props.alert.id) : Promise.resolve([])
    load.then(tasks => { if (active) setSiteTasks(tasks) }).catch(err => { if (active) setSiteError(err instanceof Error ? err.message : '关联任务加载失败') })
      .finally(() => { if (active) setSiteLoading(false) })
    return () => { active = false }
  }, [props.alert.id, props.alert.status, revision])
  if (loading) return <div className="evidence-loading"><Spin /></div>
  return <>
    {error && <Alert type="warning" title="取证记录加载失败，已显示空白表单，可继续填写"
      description={error} action={<Button onClick={retry}>重新加载（清空当前编辑）</Button>} />}
    <EvidenceEditor {...props} siteTasks={siteTasks} siteLoading={siteLoading} siteError={siteError} retrySite={() => setRevision(value => value + 1)}
      scope={scope} initial={data ?? emptyEvidence(props.alert.id, '')} />
  </>
}

export default function EvidenceModal({ alert, ...props }: Omit<Props, 'alert'> & { alert: AlertEvent | null }) {
  const [busy, setBusy] = useState(false)
  const [ready, setReady] = useState(false)
  return <Modal open={!!alert} title={<span>取证任务详情 <Tag color="gold">取证中</Tag></span>} className="alert-evidence-modal evidence-fullscreen-modal evidence-editor-modal"
    width={760} zIndex={1000} footer={<><Button disabled={busy} onClick={props.onClose}>取消</Button><Button type="primary" htmlType="submit"
      form={`evidence-form-${alert?.id}`} disabled={!ready} loading={busy}>保存取证记录</Button></>}
    onCancel={() => { if (!busy) props.onClose() }} closable={!busy} keyboard={!busy} mask={{ closable: false }} destroyOnHidden>
    {alert && <EvidenceSession key={alert.id} alert={alert} {...props} onBusyChange={setBusy} onReadyChange={setReady} />}
  </Modal>
}

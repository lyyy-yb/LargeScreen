import { normalizePhotos } from '../data/normalizePhotos'
import { useEffect, useState } from 'react'
import type { ReactNode } from 'react'
import { Alert, Button, Image, Spin, Timeline, Tag } from 'antd'
import AlertLevelBadge from '@/components/AlertLevelBadge'
import { alertEventApi, disposalTaskApi } from '@/servers/business'
import { requireSuccess } from '@/servers/alertFollowUp'
import type { AlertEventDTO, DisposalTaskDTO } from '@/types/business'
import type { AlertEvent } from '../modals/AlertDetailModal'
import type { DisposalTask } from '../modals/TaskDetailModal'
import AuthenticatedImage from './AuthenticatedImage'
import { ALERT_STATUS_LABEL_MAP, ALERT_STATUS_COLOR_MAP, DATA_TYPE_OPTIONS, TASK_STATUS_LABEL_MAP, TASK_TYPE_OPTIONS } from '../tabs/shared/tabConstants'

export function DetailGrid({ items }: { items: [string, ReactNode][] }) {
  return <dl className="evidence-info-grid">{items.map(([label, value]) => <div key={label}><dt>{label}</dt><dd>{value ?? '—'}</dd></div>)}</dl>
}

export function AlertFacts({ alert }: { alert: AlertEvent }) {
  return <><DetailGrid items={[
    ['预警 ID', alert.id], ['状态', <Tag color={ALERT_STATUS_COLOR_MAP[alert.status] || 'default'}>{ALERT_STATUS_LABEL_MAP[alert.status] || alert.status}</Tag>],
    ['预警级别', <AlertLevelBadge level={alert.alertLevel} />],
    ['规则名称', alert.ruleName], ['设备名称', alert.deviceName],
    ['接入类型', DATA_TYPE_OPTIONS.find(item => item.value === alert.dataType)?.label || alert.dataType],
    ['监测位置', alert.location], ['预警时间', alert.createdAt],
  ]} /><div className="evidence-note evidence-trigger"><span className="evidence-label">触发原因</span><p className="evidence-copy">{alert.triggerReason || '—'}</p></div></>
}

export function LinkedAlert({ alertId }: { alertId: string }) {
  const [data, setData] = useState<AlertEventDTO | null>(null)
  const [error, setError] = useState('')
  const [revision, setRevision] = useState(0)
  useEffect(() => {
    let active = true
    queueMicrotask(() => { if (active) { setData(null); setError('') } })
    alertEventApi.detail(Number(alertId)).then(requireSuccess).then(value => {
      if (!value) throw new Error('关联预警不存在或已删除')
      if (active) setData(value)
    }).catch(err => { if (active) setError(err instanceof Error ? err.message : '关联预警加载失败') })
    return () => { active = false }
  }, [alertId, revision])
  return <section className="evidence-section"><h3>关联预警信息</h3>
    {error ? <Alert type="error" title={error} action={<Button onClick={() => setRevision(value => value + 1)}>重试</Button>} />
      : data ? <AlertFacts alert={{ ...data, id: String(data.id), createdAt: data.createTime || '' }} /> : <Spin />}
  </section>
}

export function TaskResult({ task, deptNameOf = () => undefined }: { task: DisposalTask; deptNameOf?: (id?: number) => string | undefined }) {
  const done = task.status === 'committed' || task.status === 'completed'
  const verifications = (task.verifications || []).filter(record => record.delFlag !== '1')
  return <div className="evidence-task-result">
    <div className="evidence-card">
      <h4>任务 #{task.id} · {TASK_STATUS_LABEL_MAP[task.status]?.label || task.status}</h4>
      <DetailGrid items={[
        ['任务类型', TASK_TYPE_OPTIONS.find(item => item.value === task.taskType)?.label || task.taskType],
        ['处置人', task.assigneeName || '未分配'], ['派发人', task.requesterName],
        ['地市', deptNameOf(task.cityId)], ['区县', deptNameOf(task.districtId)], ['乡镇', deptNameOf(task.townId)],
        ['要求完成时间', task.requireTime],
      ]} />
      <div className={task.photos?.length ? 'evidence-split' : undefined}>
        {!!task.photos?.length && <div><Image.PreviewGroup>{task.photos.map((url, index) => <figure className="evidence-figure" key={`${url}-${index}`}><Image src={url} alt={`现场核查照片 ${index + 1}`} width="100%" /></figure>)}</Image.PreviewGroup></div>}
        <div><h4>{done ? '处置结果' : '处置内容'}</h4>
          <p className="evidence-copy">{task.disposalContent || (done ? '暂无处置结果说明' : '等待现场核查反馈')}</p></div>
      </div>
    </div>
    <div className="evidence-card"><h4>现场核查记录</h4>
      {!verifications.length ? <p className="evidence-copy">{task.verificationResult || '暂无现场核查记录'}</p>
        : verifications.map((record, index) => {
          const photos = (record.photos || []).filter(photo => photo.delFlag !== '1')
          return <section className={`evidence-section${verifications.length > 1 ? ' evidence-verification-card' : ''}`} key={record.id}>
            {verifications.length > 1 && <h4>第 {index + 1} 次核查</h4>}
            <DetailGrid items={[[ '核查人', record.verifyBy || '—' ], [ '核查时间', record.verifyTime || '—' ]]} />
            <div className={photos.length ? 'evidence-split' : undefined}>
              {!!photos.length && <div><Image.PreviewGroup>{photos.map((photo, photoIndex) => <figure className="evidence-figure" key={photo.id}>
                <AuthenticatedImage source="disposal" id={photo.id} name={photo.fileName || `现场核查照片 ${photoIndex + 1}`} />
                <figcaption>{photo.fileName || `现场核查照片 ${photoIndex + 1}`}</figcaption>
              </figure>)}</Image.PreviewGroup></div>}
              <div><h4>核查结果</h4><p className="evidence-copy">{record.verificationResult || '暂无核查结果说明'}</p>
                {!photos.length && <p className="evidence-muted">暂无核查照片</p>}</div>
            </div>
          </section>
        })}
    </div>
    <div className="evidence-card"><h4>任务进度</h4>
      <Timeline items={[
        ...(task.createdAt ? [{ color: '#00dfe8', content: <><time>{task.createdAt}</time> 任务创建 / 派发</> }] : []),
        ...(task.completedAt ? [{ color: '#00dfe8', content: <><time>{task.completedAt}</time> 现场处置完成</> }] : []),
        { color: task.status === 'completed' ? '#00ca84' : '#00dfe8', content: `当前状态：${TASK_STATUS_LABEL_MAP[task.status]?.label || task.status}` },
      ]} />
    </div>
  </div>
}

export function AlertTaskResults({ alert, deptNameOf }: { alert: AlertEvent; deptNameOf?: (id?: number) => string | undefined }) {
  const [tasks, setTasks] = useState<DisposalTaskDTO[] | null>(null)
  const [error, setError] = useState('')
  const [revision, setRevision] = useState(0)
  useEffect(() => {
    let active = true
    queueMicrotask(() => { if (active) { setTasks(null); setError('') } })
    const load = async () => {
      const records: DisposalTaskDTO[] = []
      let page = 1
      while (true) {
        const data = requireSuccess(await disposalTaskApi.list({ alertId: Number(alert.id), pageNum: page++, pageSize: 100 }))
        if (!active) return
        records.push(...data.records)
        if (!data.records.length || records.length >= data.total) break
      }
      // 列表不包含完整核查记录，按任务 ID 补查详情后再展示。
      const details: DisposalTaskDTO[] = []
      for (let start = 0; start < records.length; start += 6) {
        if (!active) return
        const batch = await Promise.all(records.slice(start, start + 6).map(async record => {
          const detail = requireSuccess(await disposalTaskApi.detail(record.id))
          if (!detail || String(detail.alertId) !== String(alert.id)) {
            throw new Error(`任务 #${record.id} 不存在或关联预警已变化，请重试`)
          }
          return detail
        }))
        details.push(...batch)
      }
      if (active) setTasks(details)
    }
    void load().catch(err => { if (active) setError(err instanceof Error ? err.message : '现场核查结果加载失败') })
    return () => { active = false }
  }, [alert.id, alert.status, revision])
  return <section className="evidence-section"><h3>现场核查结果</h3>
    {error ? <Alert type="error" title={error} action={<Button onClick={() => setRevision(value => value + 1)}>重试</Button>} />
        : tasks === null ? <Spin /> : !tasks.length ? <p className="evidence-muted">{alert.status === 'undispatched' ? '尚未派发现场核查任务' : '暂无关联处置任务'}</p>
          : tasks.map(task => <TaskResult key={task.id} deptNameOf={deptNameOf} task={{ ...task, id: String(task.id), alertId: String(task.alertId),
            createdAt: task.createTime || '', assigneeName: task.assigneeName || '', requesterName: task.requesterName || '',
            requireTime: task.requireTime || '', photos: normalizePhotos(task.photos) }} />)}
  </section>
}

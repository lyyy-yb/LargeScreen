import { useEffect, useState } from 'react'
import { Alert, Button, Image, Spin, Timeline } from 'antd'
import { alertFollowUpApi, type FollowUpRecord } from '@/servers/alertFollowUp'
import AuthenticatedImage from './AuthenticatedImage'

export default function FollowUpRecords({ alertId }: { alertId: string }) {
  const [records, setRecords] = useState<FollowUpRecord[] | null>(null)
  const [error, setError] = useState('')
  const [revision, setRevision] = useState(0)
  useEffect(() => {
    let active = true
    queueMicrotask(() => { if (active) { setRecords(null); setError('') } })
    alertFollowUpApi.list(alertId).then(data => { if (active) setRecords(data) })
      .catch(err => { if (active) setError(err instanceof Error ? err.message : '后续处置记录加载失败') })
    return () => { active = false }
  }, [alertId, revision])
  return <section className="evidence-section"><h3>后续处置记录</h3><div className="evidence-card">
    {error ? <Alert type="error" title={error} action={<Button onClick={() => setRevision(value => value + 1)}>重试</Button>} />
      : records === null ? <Spin /> : !records.length ? <p className="evidence-muted">暂无后续处置记录</p> : <Image.PreviewGroup>
        <Timeline items={[...records].sort((a, b) => (a.createTime || '').localeCompare(b.createTime || '')).map(record => ({
          key: String(record.id), color: '#00dfe8', content: <>
            <time>{record.createTime || '时间未提供'}</time>{record.createBy && <span className="evidence-author">{record.createBy}</span>}
            <div className={record.images?.length ? 'evidence-split' : undefined}>
            {!!record.images?.length && <div>
            {record.images?.map(photo => <figure className="evidence-figure" key={photo.id}><AuthenticatedImage id={photo.id} name={photo.fileName || '后续处置图片'} source="follow-up" /></figure>)}
            </div>}<p className="evidence-copy">{record.content}</p></div>
          </>,
        }))} />
      </Image.PreviewGroup>}
  </div></section>
}

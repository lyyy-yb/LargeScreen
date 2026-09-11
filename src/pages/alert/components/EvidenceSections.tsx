import { Alert, Button, Image, Spin } from 'antd'
import { EVIDENCE_GROUPS } from '../data/evidenceRepository'
import { useEvidence } from '../data/useEvidence'
import AuthenticatedImage from './AuthenticatedImage'

export default function EvidenceSections({ alertId }: { alertId: string }) {
  const { data, loading, error, retry } = useEvidence(alertId)
  return <section className="evidence-section">
    <h3>非现场取证</h3>
    {loading ? <Spin /> : error ? <Alert type="error" title={error} action={<Button onClick={retry}>重试</Button>} /> : <>
      {data?.taskName && <p><span className="evidence-label">取证任务名称</span> {data.taskName}</p>}
      {data?.updatedAt && <p className="evidence-muted">最近保存：{data.updatedAt}</p>}
      {!!data?.contentErrors?.length && <Alert type="error" title={data.contentErrors.join('；')} action={<Button onClick={retry}>重试</Button>} />}
      <Image.PreviewGroup>
        {EVIDENCE_GROUPS.map(group => <div className="evidence-group" key={group.key}>
          <h4>{group.title}</h4>
          <div className="evidence-split"><div>
          {!data?.sections[group.key].images.length && <p className="evidence-muted">暂无取证图片</p>}
          {data?.sections[group.key].images.map(file => <figure className="evidence-figure" key={file.uid}>
            {file.serverId != null && <AuthenticatedImage id={file.serverId} name={file.caption || file.name} source="evidence" />}
            {file.serverId == null && file.url && <Image src={file.url} alt={file.caption || file.name} width="100%" />}
            <figcaption>{file.caption || file.name}</figcaption>
          </figure>)}
          </div><div className="evidence-description"><span className="evidence-field-label">取证说明</span>
          {data?.sections[group.key].description ? <p className="evidence-copy">{data.sections[group.key].description}</p>
            : <p className="evidence-muted">暂无取证说明</p>}
          </div></div>
        </div>)}
      </Image.PreviewGroup>
    </>}
  </section>
}

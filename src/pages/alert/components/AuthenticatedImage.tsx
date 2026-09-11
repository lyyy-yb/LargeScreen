import { useEffect, useState } from 'react'
import { Button, Image, Spin } from 'antd'
import { alertEvidenceApi } from '@/servers/alertEvidence'
import { alertFollowUpApi } from '@/servers/alertFollowUp'
import { disposalPhotoApi } from '@/servers/disposalPhoto'

export default function AuthenticatedImage({ id, name, source }: { id: string | number; name: string; source: 'evidence' | 'follow-up' | 'disposal' }) {
  const [url, setUrl] = useState('')
  const [error, setError] = useState(false)
  const [revision, setRevision] = useState(0)
  const [video, setVideo] = useState(false)
  useEffect(() => {
    let active = true
    let objectUrl = ''
    queueMicrotask(() => { if (active) { setUrl(''); setError(false) } })
    const api = source === 'evidence' ? alertEvidenceApi : source === 'disposal' ? disposalPhotoApi : alertFollowUpApi
    api.image(id).then(blob => {
      if (!active) return
      objectUrl = URL.createObjectURL(blob)
      setVideo(blob.type === 'video/mp4')
      setUrl(objectUrl)
    }).catch(() => { if (active) setError(true) })
    return () => { active = false; if (objectUrl) URL.revokeObjectURL(objectUrl) }
  }, [id, source, revision])
  return error ? <Button onClick={() => setRevision(value => value + 1)}>预览加载失败，点击重试</Button>
    : url ? video ? <video className="evidence-video" src={url} controls preload="metadata" aria-label={name} onError={() => setError(true)} />
      : <Image src={url} alt={name} width="100%" onError={() => setError(true)} /> : <Spin />
}

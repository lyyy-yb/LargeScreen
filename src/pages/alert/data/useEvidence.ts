import { useEffect, useState } from 'react'
import { useAuthStore } from '@/stores'
import { loadEvidence, type EvidenceRecord } from './evidenceRepository'

export function useEvidence(alertId: string) {
  const scope = useAuthStore(state => String(state.user?.userId ?? state.username ?? 'anonymous'))
  const [data, setData] = useState<EvidenceRecord | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [revision, setRevision] = useState(0)
  useEffect(() => {
    let active = true
    queueMicrotask(() => { if (active) { setLoading(true); setError(''); setData(null) } })
    loadEvidence(scope, alertId).then(record => { if (active) setData(record) })
      .catch(err => { if (active) setError(err instanceof Error ? err.message : '取证记录读取失败') })
      .finally(() => { if (active) setLoading(false) })
    return () => { active = false }
  }, [alertId, scope, revision])
  return { data, loading, error, scope, retry: () => setRevision(value => value + 1) }
}


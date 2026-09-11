import { alertEvidenceApi } from '@/servers/alertEvidence'

/** 图片和三类文字走真实接口；尚无接口的任务名称、图片标题以账号 + 预警 ID 隔离存储。 */
export type EvidenceKind = 'radar' | 'station' | 'drone'

export interface EvidenceImage {
  uid: string
  name: string
  url: string
  caption?: string
  serverId?: string | number
  filePath?: string
}

export interface EvidenceSection {
  description: string
  images: EvidenceImage[]
}

export interface EvidenceRecord {
  alertId: string
  taskName: string
  updatedAt: string
  contentErrors?: string[]
  sections: Record<EvidenceKind, EvidenceSection>
}

export const EVIDENCE_GROUPS: { key: EvidenceKind; title: string; upload: string; hint: string; placeholder: string }[] = [
  { key: 'radar', title: '（1）光量子雷达', upload: '点击或拖拽上传光量子雷达扫描图片或 MP4 视频', hint: '支持所有图片格式和 MP4，可上传多张扫描截图', placeholder: '请输入扫描时间、角度、污染团位置及扩散方向等取证说明' },
  { key: 'station', title: '（2）小微站', upload: '点击或拖拽上传污染物浓度图片或 MP4 视频', hint: '支持所有图片格式和 MP4，可上传浓度趋势或站点截图', placeholder: '请输入站点、污染物浓度及变化趋势等取证说明' },
  { key: 'drone', title: '（3）无人机取证', upload: '点击或拖拽上传无人机取证图片或 MP4 视频', hint: '支持所有图片格式和 MP4，含排口指纹比对、飞行轨迹、现场照片等', placeholder: '请填写无人机取证描述，如飞行航线、排口位置、SO₂ 数值变化、疑似污染源等' },
]

export function emptyEvidence(alertId: string, taskName: string): EvidenceRecord {
  return { alertId, taskName, updatedAt: '', sections: {
    radar: { description: '', images: [] }, station: { description: '', images: [] }, drone: { description: '', images: [] },
  } }
}

async function database(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open('alert-evidence-mock', 1)
    request.onupgradeneeded = () => request.result.createObjectStore('records')
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(new Error('无法打开本地取证存储，请检查浏览器存储设置'))
  })
}

async function loadMetadata(scope: string, alertId: string): Promise<EvidenceRecord | null> {
  const db = await database()
  return new Promise((resolve, reject) => {
    const tx = db.transaction('records', 'readonly')
    const request = tx.objectStore('records').get(`${scope}:${alertId}`)
    tx.oncomplete = () => { db.close(); resolve(request.result ?? null) }
    tx.onabort = tx.onerror = () => { db.close(); reject(new Error('取证记录读取失败，请重试')) }
  })
}

export async function loadEvidence(scope: string, alertId: string): Promise<EvidenceRecord> {
  const [metadata, detail] = await Promise.all([loadMetadata(scope, alertId), alertEvidenceApi.detail(alertId)])
  const result = metadata ?? emptyEvidence(alertId, '')
  result.contentErrors = []
  for (const group of EVIDENCE_GROUPS) {
    const prefix = group.key === 'station' ? 'microStation' : group.key
    result.sections[group.key].description = detail[prefix]?.content ?? ''
    const previousImages = result.sections[group.key].images
    result.sections[group.key].images = (detail[prefix]?.images ?? []).map((image, index) => {
      const filePath = image.filePath || undefined
      const serverId = image.id
      if (!filePath && serverId == null) throw new Error('取证图片缺少地址或 ID')
      const previous = previousImages.find(item => serverId != null ? String(item.serverId) === String(serverId) : item.filePath === filePath)
      return {
        uid: serverId != null ? `server:${serverId}` : `${group.key}:${index}:${filePath}`,
        serverId, filePath, url: serverId == null ? filePath || '' : '',
        name: image.fileName || image.originalFilename || `${group.title}图片`,
        caption: previous?.caption,
      }
    })
  }
  return result
}

export async function saveEvidence(scope: string, record: EvidenceRecord): Promise<void> {
  const db = await database()
  return new Promise((resolve, reject) => {
    const tx = db.transaction('records', 'readwrite')
    tx.objectStore('records').put(record, `${scope}:${record.alertId}`)
    tx.oncomplete = () => { db.close(); resolve() }
    tx.onabort = tx.onerror = () => { db.close(); reject(new Error('取证保存失败，可能存储空间不足，请减少图片后重试')) }
  })
}

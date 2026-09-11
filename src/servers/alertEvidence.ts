import { request } from './request'
import { imageBlob } from './imageBlob'
import { requireSuccess } from './alertFollowUp'

const PREFIX = '/dpSys/hbdp/alert/evidence'
export type EvidenceApiType = 'radar' | 'micro_station' | 'drone'
export interface EvidenceSaveDTO {
  alertEventId: string
  radarContent: string
  microStationContent: string
  droneContent: string
  radarFiles: File[]
  microStationFiles: File[]
  droneFiles: File[]
}
export interface EvidenceDetailSection {
  content?: string | null
  images?: EvidenceImageDTO[] | null
}
export interface EvidenceDetailDTO {
  radar?: EvidenceDetailSection | null
  microStation?: EvidenceDetailSection | null
  drone?: EvidenceDetailSection | null
}
export interface EvidenceImageDTO {
  id: string | number
  alertEventId: string | number
  evidenceType: EvidenceApiType
  fileName?: string
  originalFilename?: string
  filePath?: string | null
  createTime?: string
}

export const alertEvidenceApi = {
  async detail(alertEventId: string): Promise<EvidenceDetailDTO> {
    const data = requireSuccess(await request.get<EvidenceDetailDTO | null>(`${PREFIX}/detail`, { params: { alertEventId } }))
    if (data == null) return {}
    if (typeof data !== 'object' || Array.isArray(data)) throw new Error('完整取证信息格式异常')
    for (const key of ['radar', 'microStation', 'drone'] as const) {
      const section = data[key]
      if (section == null) continue
      if (typeof section !== 'object' || Array.isArray(section)) throw new Error('取证分类格式异常')
      if (section.content != null && typeof section.content !== 'string') throw new Error('取证文字格式异常')
      if (section.images != null && !Array.isArray(section.images)) throw new Error('取证图片列表格式异常')
    }
    return data
  },
  async save(dto: EvidenceSaveDTO) {
    // 新图片与三类文字一次性提交，浏览器自动生成 multipart boundary。
    const body = new FormData()
    body.append('alertEventId', dto.alertEventId)
    for (const key of ['radarContent', 'microStationContent', 'droneContent'] as const) body.append(key, dto[key])
    for (const key of ['radarFiles', 'microStationFiles', 'droneFiles'] as const) {
      dto[key].forEach(file => body.append(key, file, file.name))
    }
    requireSuccess(await request.post(`${PREFIX}/save`, body))
  },
  async remove(id: string | number) {
    requireSuccess(await request.delete(`${PREFIX}/${encodeURIComponent(id)}`))
  },
  async image(id: string | number): Promise<Blob> {
    const data = await request.get(`${PREFIX}/image/${encodeURIComponent(id)}`, { responseType: 'blob' }) as unknown as Blob
    return imageBlob(data)
  },
}

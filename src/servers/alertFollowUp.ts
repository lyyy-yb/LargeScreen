import { request, requireSuccess } from './request'
import { imageBlob } from './imageBlob'
const PREFIX = '/dpSys/hbdp/alert/follow-up'

export interface FollowUpImage {
  id: string | number
  fileName?: string
}

export interface FollowUpRecord {
  id: string | number
  alertEventId: string | number
  content: string
  createTime?: string
  createBy?: string
  images?: FollowUpImage[]
}

export { requireSuccess }

export const alertFollowUpApi = {
  async list(alertEventId: string) {
    const data = requireSuccess(await request.get<FollowUpRecord[]>(`${PREFIX}/list`, { params: { alertEventId } }))
    if (!Array.isArray(data)) throw new Error('后续处置记录格式异常，请联系管理员')
    return data
  },
  async create(alertEventId: string, content: string, files: File[]) {
    const body = new FormData()
    files.forEach(file => body.append('files', file, file.name))
    // Swagger 将 @RequestParam 标为 query。文本放 params，二进制放 multipart files，浏览器自动生成 boundary。
    return requireSuccess(await request.post(PREFIX, body, { params: { alertEventId, content } }))
  },
  async image(id: string | number): Promise<Blob> {
    // 复用 request 的 Authorization 拦截器；<img src> 无法携带 Bearer。
    const data = await request.get(`${PREFIX}/image/${encodeURIComponent(id)}`, { responseType: 'blob' }) as unknown as Blob
    return imageBlob(data)
  },
}

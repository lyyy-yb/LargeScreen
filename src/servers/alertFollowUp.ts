import { request, redirectToLoginOnExpired, type ServerResult } from './request'
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

/** 同时兼容业务接口 resultCode=0 与若依 AjaxResult code=200；业务失败不可显示保存成功。 */
export function requireSuccess<T>(response: ServerResult<T>): T {
  if (response.code === 401 || response.resultCode === 401) {
    redirectToLoginOnExpired()
    throw new Error('登录已过期，请重新登录')
  }
  if (response.resultCode != null ? response.resultCode !== 0 : response.code !== 200) {
    const reason = response.msg || response.message || '操作失败，请稍后重试'
    throw new Error(/SQL|Exception|###/.test(reason) ? `${reason.split('\n')[0].replace(/[:：]\s*$/, '')}，请稍后重试或联系管理员` : reason)
  }
  return response.data
}

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

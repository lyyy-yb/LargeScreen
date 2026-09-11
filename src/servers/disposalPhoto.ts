import { request } from './request'
import { imageBlob } from './imageBlob'

export const disposalPhotoApi = {
  async image(id: string | number): Promise<Blob> {
    const data = await request.get(`/dpSys/hbdp/disposalTask/image/${encodeURIComponent(id)}`, { responseType: 'blob' }) as unknown as Blob
    return imageBlob(data)
  },
}

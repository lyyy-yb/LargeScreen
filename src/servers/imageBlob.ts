/** 部分下载接口返回 application/octet-stream，通过文件头识别图片。 */
export async function imageBlob(data: unknown): Promise<Blob> {
  if (!(data instanceof Blob) || !data.size) throw new Error('图片加载失败')
  if (data.type.startsWith('image/') || data.type === 'video/mp4') return data
  const bytes = new Uint8Array(await data.slice(0, 12).arrayBuffer())
  let type = ''
  if ([137, 80, 78, 71, 13, 10, 26, 10].every((byte, index) => bytes[index] === byte)) type = 'image/png'
  else if (bytes[0] === 255 && bytes[1] === 216 && bytes[2] === 255) type = 'image/jpeg'
  else if (String.fromCharCode(...bytes.slice(0, 6)).match(/^GIF8[79]a$/)) type = 'image/gif'
  else if (String.fromCharCode(...bytes.slice(0, 4)) === 'RIFF' && String.fromCharCode(...bytes.slice(8, 12)) === 'WEBP') type = 'image/webp'
  else if (bytes[0] === 66 && bytes[1] === 77) type = 'image/bmp'
  else if (String.fromCharCode(...bytes.slice(4, 8)) === 'ftyp' && /^(isom|iso[2-9]|mp4[12]|avc1|M4V )$/.test(String.fromCharCode(...bytes.slice(8, 12)))) type = 'video/mp4'
  if (!type) throw new Error('图片加载失败')
  return new Blob([data], { type })
}

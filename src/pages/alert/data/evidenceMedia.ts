export function isEvidenceMedia(file: { type: string; name: string }): boolean {
  if (file.type.startsWith('image/') || file.type === 'video/mp4') return true
  return /\.(avif|bmp|gif|heic|heif|ico|jfif|jpe?g|png|svg|tiff?|webp|mp4)$/i.test(file.name)
}

export function isEvidenceVideo(file: { type?: string; name: string }): boolean {
  return file.type === 'video/mp4' || /\.mp4$/i.test(file.name)
}

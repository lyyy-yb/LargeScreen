export function normalizePhotos(photos: string | string[] | undefined): string[] {
  if (Array.isArray(photos)) return photos.filter(item => typeof item === 'string' && !!item.trim())
  if (!photos) return []
  try {
    const parsed: unknown = JSON.parse(photos)
    if (Array.isArray(parsed)) return parsed.filter((item): item is string => typeof item === 'string' && !!item.trim())
  } catch { /* 兼容旧版逗号分隔字段 */ }
  return photos.split(',').map(item => item.trim()).filter(Boolean)
}


const PREFIX = 'LS_'

export function getLocalInfo<T>(key: string): T | null {
  const value = localStorage.getItem(PREFIX + key)
  if (value === null) return null
  try {
    return JSON.parse(value) as T
  } catch {
    return value as T
  }
}

export function setLocalInfo(key: string, value: unknown): void {
  localStorage.setItem(PREFIX + key, JSON.stringify(value))
}

export function removeLocalInfo(key: string): void {
  localStorage.removeItem(PREFIX + key)
}

export function clearLocalInfo(): void {
  const keys = Object.keys(localStorage)
  keys.forEach(key => {
    if (key.startsWith(PREFIX)) {
      localStorage.removeItem(key)
    }
  })
}

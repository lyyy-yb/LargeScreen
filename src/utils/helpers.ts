import dayjs from 'dayjs'

export function formatTime(time?: string | number | Date, format = 'YYYY-MM-DD HH:mm:ss'): string {
  return dayjs(time).format(format)
}

export function formatDate(time?: string | number | Date): string {
  return formatTime(time, 'YYYY-MM-DD')
}

export function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms))
}

export function classNames(...classes: (string | undefined | null | false)[]): string {
  return classes.filter(Boolean).join(' ')
}

export function randomId(prefix = ''): string {
  return prefix + Math.random().toString(36).substring(2, 10)
}

export function debounce<T extends (...args: unknown[]) => unknown>(
  fn: T,
  delay = 300
): (...args: Parameters<T>) => void {
  let timer: ReturnType<typeof setTimeout>
  return (...args: Parameters<T>) => {
    clearTimeout(timer)
    timer = setTimeout(() => fn(...args), delay)
  }
}

export function throttle<T extends (...args: unknown[]) => unknown>(
  fn: T,
  delay = 300
): (...args: Parameters<T>) => void {
  let last = 0
  return (...args: Parameters<T>) => {
    const now = Date.now()
    if (now - last >= delay) {
      last = now
      fn(...args)
    }
  }
}

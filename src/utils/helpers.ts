import dayjs, { type Dayjs } from 'dayjs'

export function formatTime(time?: string | number | Date, format = 'YYYY-MM-DD HH:mm:ss'): string {
  return dayjs(time).format(format)
}

export function formatDate(time?: string | number | Date): string {
  return formatTime(time, 'YYYY-MM-DD')
}

/**
 * 时间选择器公共约束：禁止选择「今天之后」的日期（今天仍可选）
 * 用法：`<DatePicker disabledDate={disabledFutureDate} />` / `<RangePicker disabledDate={disabledFutureDate} />`
 * 粒度为「天」；若某字段本身就是未来时间（如「要求完成时间」这类截止期限），不要加此约束。
 */
export function disabledFutureDate(current: Dayjs): boolean {
  return current.isAfter(dayjs(), 'day')
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

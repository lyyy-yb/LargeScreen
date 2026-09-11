import { getLocalInfo } from '@/utils/storage'
import { TOKEN } from '@/utils/enum'

export interface SseMessage { event: string; data: string; id?: string }

/** 增量分行，兼容 CR/LF/CRLF、跨网络块分隔符及多行 data。 */
export function createSseParser(onMessage: (message: SseMessage) => void) {
  let buffer = '', data: string[] = [], event = '', id: string | undefined
  const line = (value: string) => {
    if (!value) {
      if (data.length) onMessage({ event: event || 'message', data: data.join('\n'), id })
      data = []; event = ''; return
    }
    if (value.startsWith(':')) return
    const colon = value.indexOf(':')
    const field = colon < 0 ? value : value.slice(0, colon)
    let content = colon < 0 ? '' : value.slice(colon + 1)
    if (content.startsWith(' ')) content = content.slice(1)
    if (field === 'data') data.push(content)
    else if (field === 'event') event = content
    else if (field === 'id' && !content.includes('\0')) id = content
  }
  return {
    feed(chunk: string) {
      buffer += chunk
      if (buffer.length > 32 * 1024 * 1024) throw new Error('SSE 单条消息过大，请缩小查询范围')
      let end: number
      while ((end = buffer.search(/[\r\n]/)) >= 0) {
        if (buffer[end] === '\r' && end === buffer.length - 1) break
        const text = buffer.slice(0, end)
        const length = buffer[end] === '\r' && buffer[end + 1] === '\n' ? 2 : 1
        buffer = buffer.slice(end + length); line(text)
      }
    },
  }
}

/** fetch 流支持 Authorization 请求头；不用 EventSource 的 URL token。返回 true 表示业务结束。 */
export async function readAuthenticatedSse(url: string, signal: AbortSignal, onMessage: (message: SseMessage) => boolean) {
  const controller = new AbortController()
  const abort = () => controller.abort()
  signal.addEventListener('abort', abort, { once: true })
  if (signal.aborted) abort()
  let idle: ReturnType<typeof setTimeout> | undefined
  const touch = () => { clearTimeout(idle); idle = setTimeout(abort, 60_000) }
  const token = getLocalInfo<string>(TOKEN)
  touch()
  try {
    const response = await fetch(url, {
      headers: { Accept: 'text/event-stream', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
      signal: controller.signal, cache: 'no-store',
    })
    if (!response.ok) throw new Error(`雷达历史接口请求失败（HTTP ${response.status}）`)
    if (!response.headers.get('content-type')?.includes('text/event-stream')) {
      const error = await response.json().catch(() => null)
      throw new Error(error?.msg || error?.message || '雷达历史接口未返回 SSE 数据流')
    }
    if (!response.body) throw new Error('当前环境无法读取 SSE 数据流')
    const reader = response.body.getReader()
    let ended = false
    const parser = createSseParser(message => { if (!ended) ended = onMessage(message) })
    const decoder = new TextDecoder()
    try {
      while (!ended) {
        const next = await reader.read()
        if (next.done) break
        touch(); parser.feed(decoder.decode(next.value, { stream: true }))
      }
      if (!ended) throw new Error('历史数据流意外中断，未收到结束事件；可重试查询')
    } finally {
      await reader.cancel().catch(() => undefined)
      reader.releaseLock()
    }
  } catch (error) {
    if (controller.signal.aborted && !signal.aborted) throw Object.assign(new Error('雷达历史数据流超过60秒未响应，请重试'), { cause: error })
    throw error
  } finally {
    clearTimeout(idle); signal.removeEventListener('abort', abort)
  }
}

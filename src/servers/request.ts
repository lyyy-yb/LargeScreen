import axios from 'axios'
import type {
  AxiosResponse,
  AxiosInstance,
  InternalAxiosRequestConfig,
  AxiosRequestConfig
} from 'axios'
import { message } from 'antd'
import { clearLocalInfo, getLocalInfo } from '@/utils/storage'
import { TOKEN } from '@/utils/enum'

export interface ServerResult<T = unknown> {
  resultCode: number
  message: string
  data: T
  /** 若依风格返回体兼容字段 */
  code?: number
  token?: string
  msg?: string
}

interface RequestInterceptors<T> {
  requestInterceptors?: (config: InternalAxiosRequestConfig) => InternalAxiosRequestConfig
  requestInterceptorsCatch?: (error: unknown) => unknown
  responseInterceptors?: (response: T) => T
  responseInterceptorsCatch?: (error: unknown) => unknown
}

interface CreateRequestConfig {
  baseURL?: string
  timeout?: number
  interceptors?: RequestInterceptors<AxiosResponse>
}

class AxiosRequest {
  instance: AxiosInstance
  interceptorsObj?: RequestInterceptors<AxiosResponse>
  /**
   * URL → 该 URL 当前在飞请求的 controller 集合。
   * 用 Set 而非单值：避免并发同 URL 请求的 controller 互相覆盖。
   * 修复前 P0 bug：第二个同 URL 请求的 `set(url, controller)` 会把第一个挤掉，
   * 第一个响应回来时 `delete(url)` 又会误删第二个；`cancelRequest(url)` 也无法
   * 可靠取消所有在飞请求。
   */
  abortControllerMap: Map<string, Set<AbortController>>

  constructor(config: CreateRequestConfig) {
    this.instance = axios.create(config)
    this.abortControllerMap = new Map()
    this.interceptorsObj = config.interceptors

    this.instance.interceptors.request.use(
      (res: InternalAxiosRequestConfig) => {
        const controller = new AbortController()
        res.signal = controller.signal
        if (res.url) {
          const set =
            this.abortControllerMap.get(res.url) ?? new Set<AbortController>()
          set.add(controller)
          this.abortControllerMap.set(res.url, set)
          // 把 controller 挂在 config 上，response 拦截器按引用移除，避免误删同 URL 其他请求
          ;(res as InternalAxiosRequestConfig & { __abortController?: AbortController }).__abortController =
            controller
        }
        return res
      },
      (err: unknown) => Promise.reject(err)
    )

    this.instance.interceptors.request.use(
      this.interceptorsObj?.requestInterceptors,
      this.interceptorsObj?.requestInterceptorsCatch
    )

    this.instance.interceptors.response.use(
      this.interceptorsObj?.responseInterceptors,
      this.interceptorsObj?.responseInterceptorsCatch
    )

    this.instance.interceptors.response.use(
      (res: AxiosResponse) => {
        const url = res.config.url || ''
        const controller = (res.config as InternalAxiosRequestConfig & {
          __abortController?: AbortController
        }).__abortController
        this.removeController(url, controller)
        if (res?.status === 401) {
          clearLocalInfo()
          window.location.href = '/login'
        }
        return res.data
      },
      (err: unknown) => {
        if (axios.isAxiosError(err)) {
          const url = err.config?.url || ''
          const controller = err.config as
            | (InternalAxiosRequestConfig & { __abortController?: AbortController })
            | undefined
          this.removeController(url, controller?.__abortController)
          if (err.response?.status === 401) {
            clearLocalInfo()
            window.location.href = '/login'
          }
        }
        return Promise.reject(err)
      }
    )
  }

  private removeController(url: string, controller?: AbortController) {
    if (!url || !controller) return
    const set = this.abortControllerMap.get(url)
    if (!set) return
    set.delete(controller)
    if (set.size === 0) this.abortControllerMap.delete(url)
  }

  cancelAllRequest() {
    for (const [, set] of this.abortControllerMap) {
      for (const controller of set) controller.abort()
    }
    this.abortControllerMap.clear()
  }

  cancelRequest(url: string | string[]) {
    const urlList = Array.isArray(url) ? url : [url]
    for (const _url of urlList) {
      const set = this.abortControllerMap.get(_url)
      if (!set) continue
      for (const controller of set) controller.abort()
      this.abortControllerMap.delete(_url)
    }
  }

  get<T = unknown>(url: string, options = {}) {
    return this.instance.get(url, options) as Promise<ServerResult<T>>
  }

  post<T = unknown>(url: string, options = {}, config?: AxiosRequestConfig) {
    return this.instance.post(url, options, config) as Promise<ServerResult<T>>
  }

  put<T = unknown>(url: string, options = {}, config?: AxiosRequestConfig) {
    return this.instance.put(url, options, config) as Promise<ServerResult<T>>
  }

  delete<T = unknown>(url: string, options = {}) {
    return this.instance.delete(url, options) as Promise<ServerResult<T>>
  }
}

function createRequest(url: string, tokenKey: string) {
  return new AxiosRequest({
    baseURL: url,
    timeout: 5 * 60 * 1000,
    interceptors: {
      requestInterceptors(res) {
        const tokenLocal = getLocalInfo<string>(tokenKey) || ''
        if (res?.headers && tokenLocal) {
          res.headers.Authorization = 'Bearer ' + tokenLocal
        }
        return res
      },
      requestInterceptorsCatch(err) {
        console.warn('请求未发出', err)
        return Promise.reject(err)
      },
      responseInterceptors(res) {
        return res
      },
      responseInterceptorsCatch(err) {
        if (axios.isCancel(err)) {
          return Promise.reject(err)
        }
        const status = axios.isAxiosError(err) ? err.response?.status : undefined
        console.warn(`接口请求失败${status ? `（${status}）` : ''}，请检查接口或网络状态`)
        return Promise.reject(err)
      },
    },
  })
}

export const request = createRequest('/', TOKEN)

export const cancelRequest = (url: string | string[]) => {
  return request.cancelRequest(url)
}

export const cancelAllRequest = () => {
  return request.cancelAllRequest()
}

/** 判断错误是否为登录过期（HTTP 401 或业务码 401） */
export function isLoginExpiredError(error: unknown): boolean {
  if (axios.isAxiosError(error)) {
    if (error.response?.status === 401) return true
    const data = error.response?.data as ServerResult | undefined
    if (data && (data.resultCode === 401 || data.code === 401)) return true
  }
  return false
}

/** 登录过期统一处理：提示并清除本地信息后跳转登录页 */
export function redirectToLoginOnExpired() {
  message.warning('用户信息过期，需要重新登录')
  clearLocalInfo()
  window.location.href = '/login'
}

/** 登录过期统一处理：提示并清除本地信息后跳转登录页（指定 message 实例，避免 hooks 上下文外报错） */
export function redirectToLoginOnExpiredWithMsg(msgApi: { warning: (s: string) => void }) {
  msgApi.warning('用户信息过期，需要重新登录')
  clearLocalInfo()
  window.location.href = '/login'
}

// ---------------- 全局网络错误提示 ----------------

/** 错误频率限制：同一类型错误 3s 内只提示一次 */
const errorThrottleMap = new Map<string, number>()
const ERROR_THROTTLE_MS = 3000

function shouldThrottle(key: string): boolean {
  const now = Date.now()
  const last = errorThrottleMap.get(key) ?? 0
  if (now - last < ERROR_THROTTLE_MS) return true
  errorThrottleMap.set(key, now)
  return false
}

/**
 * 全局网络/业务错误提示：
 * - 5xx 服务器错误 → 红色 error 提示
 * - 网络断开/超时 → 红色 error 提示
 * - 业务码非 0（且非 401 登录过期）→ 红色 error 提示
 *
 * 通过节流避免 5min 轮询疯狂弹窗
 */
export function notifyResponseError(error: unknown, url?: string) {
  if (axios.isAxiosError(error)) {
    if (error.response?.status === 401) return // 401 走 redirectToLoginOnExpired
    const status = error.response?.status
    if (error.code === 'ERR_NETWORK' || error.message.includes('Network Error')) {
      if (shouldThrottle('network')) return
      message.error('网络异常，请检查网络连接')
      return
    }
    if (status && status >= 500) {
      if (shouldThrottle(`5xx-${status}`)) return
      message.error(`服务器异常（${status}），请稍后重试`)
      return
    }
    if (status === 404) {
      if (shouldThrottle(`404-${url ?? ''}`)) return
      message.error(`接口不存在（404）: ${url ?? ''}`)
      return
    }
  }
  // 业务码错误（由各 page 在 .then 里手动调用）
  // 这里只处理网络层，page 级业务错误各自处理
}

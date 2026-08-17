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
  abortControllerMap: Map<string, AbortController>

  constructor(config: CreateRequestConfig) {
    this.instance = axios.create(config)
    this.abortControllerMap = new Map()
    this.interceptorsObj = config.interceptors

    this.instance.interceptors.request.use(
      (res: InternalAxiosRequestConfig) => {
        const controller = new AbortController()
        res.signal = controller.signal
        if (res.url) this.abortControllerMap.set(res.url, controller)
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
        this.abortControllerMap.delete(url)
        if (res?.status === 401) {
          clearLocalInfo()
          window.location.href = '/login'
        }
        return res.data
      },
      (err: unknown) => {
        if (axios.isAxiosError(err)) {
          const url = err.config?.url || ''
          this.abortControllerMap.delete(url)
          if (err.response?.status === 401) {
            clearLocalInfo()
            window.location.href = '/login'
          }
        }
        return Promise.reject(err)
      }
    )
  }

  cancelAllRequest() {
    for (const [, controller] of this.abortControllerMap) {
      controller.abort()
    }
    this.abortControllerMap.clear()
  }

  cancelRequest(url: string | string[]) {
    const urlList = Array.isArray(url) ? url : [url]
    for (const _url of urlList) {
      this.abortControllerMap.get(_url)?.abort()
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
        console.warn(`接口请求失败${status ? `（${status}）` : ''}，页面将回退到模拟数据`)
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

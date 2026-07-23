// 全局类型定义

declare module '*.png' {
  const src: string
  export default src
}

declare module '*.jpg' {
  const src: string
  export default src
}

declare module '*.svg' {
  const src: string
  export default src
}

declare module '*.less' {
  const classes: { [key: string]: string }
  export default classes
}

// API 响应类型
interface ApiResponse<T = unknown> {
  resultCode: number
  message: string
  data: T
}

// 分页参数
interface PaginationParams {
  page: number
  pageSize: number
}

// 分页响应
interface PaginationResult<T> {
  list: T[]
  total: number
  page: number
  pageSize: number
}

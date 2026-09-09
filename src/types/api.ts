/**
 * 与后端约定的通信类型层。
 *
 * 约定：后端统一返回 { code, message, data }，code === 0 视为成功。
 * 分页数据也统一为 data: { list, total, page, pageSize }。
 * 该约定要写进接口文档，Node 后端（后续）按此实现即可无缝对接。
 */

/** 统一响应外壳 */
export interface ApiResult<T = unknown> {
  code: number
  message: string
  data: T
}

/** 分页数据结构（约定） */
export interface ApiPage<T> {
  list: T[]
  total: number
  page: number
  pageSize: number
}

/** 业务码常量：与后端约定一致，前端仅此一处引用 */
export const ApiCode = {
  OK: 0,
  Unauthorized: 40100,
  Forbidden: 40300,
  NotFound: 40400,
  TooManyRequest: 42900,
  ServerError: 50000,
} as const

/** 判断任意对象是否为约定外壳（供响应解包使用） */
export function isApiResult(value: unknown): value is ApiResult<unknown> {
  return (
    typeof value === 'object' &&
    value !== null &&
    'code' in value &&
    'message' in value &&
    'data' in value
  )
}

/** 业务错误：携带业务码，便于上层做差异化提示 / 401 统一跳登录 */
export class BizError extends Error {
  readonly code: number

  constructor(code: number, message: string) {
    super(message)
    this.name = 'BizError'
    this.code = code
  }
}

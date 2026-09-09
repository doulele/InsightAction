/**
 * http 请求层（核心基建，TS 泛型练习的最佳现场）。
 *
 * 能力清单：
 * - 统一外壳解包：自动剥掉 { code, message, data }，业务层拿到即 data；
 * - 业务错误：code !== 0 抛 BizError，页面 catch 后差异化处理；
 * - 401 预留：登录态失效的统一钩子位置；
 * - Mock 分发：后端未就绪时走本地假数据，切换零成本；
 * - Loading / 错误 toast 的内建策略。
 */
import { ENV } from '@/config/env'
import { ApiCode, isApiResult } from '@/types/api'
import type { ApiResult } from '@/types/api'
import { BizError } from '@/types/api'
import { matchMock } from './mock'

export type HttpMethod = 'GET' | 'POST' | 'PUT' | 'DELETE'

export interface RequestOptions<D = unknown> {
  /** 相对路径（相对 apiBaseUrl）；或完整的 http(s) 地址 */
  url: string
  method?: HttpMethod
  data?: D
  header?: Record<string, string>
  /** 超时 ms */
  timeout?: number
  /** true = 显示默认加载；传字符串 = 自定义文案；缺省不显示 */
  loading?: boolean | string
  /** 请求失败时是否 toast 错误信息（默认 true） */
  showError?: boolean
}

const DEFAULT_TIMEOUT = 15000

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

/** 拼接完整地址：全量 URL 原样返回，相对路径挂在 apiBaseUrl 下 */
function normalizeUrl(url: string): string {
  if (/^https?:\/\//.test(url)) return url
  return `${ENV.apiBaseUrl.replace(/\/+$/, '')}/${url.replace(/^\/+/, '')}`
}

/** 响应体可能是 JSON 字符串（部分网关），统一解析为对象 */
function parseBody(raw: unknown): unknown {
  if (typeof raw !== 'string') return raw
  try {
    return JSON.parse(raw)
  } catch {
    return raw
  }
}

/**
 * 解包统一外壳。约定 code === 0 成功。
 * 返回非外壳（如 blob/文本）时原样透传。
 */
function unwrap<T>(payload: unknown): T {
  if (isApiResult(payload)) {
    if (payload.code === ApiCode.OK) return payload.data as T
    throw new BizError(payload.code, payload.message || '请求失败')
  }
  return payload as T
}

/** 业务码异常的统一出口（401 等），预留接入全局登出/刷新 token */
function handleBizCode(code: number): void {
  if (code === ApiCode.Unauthorized) {
    console.warn('[http] 登录态失效（401），预留：清理 token 并回登录页')
  }
}

function showErrorTip(message: string): void {
  uni.showToast({ title: message, icon: 'none', duration: 2200 })
}

export async function request<T, D = unknown>(options: RequestOptions<D>): Promise<T> {
  const { url, method = 'GET', data, header, timeout = DEFAULT_TIMEOUT, loading = false, showError = true } = options

  const showLoading = (): void => {
    if (loading) uni.showLoading({ title: typeof loading === 'string' ? loading : '加载中', mask: true })
  }
  const hideLoading = (): void => {
    if (loading) uni.hideLoading()
  }

  // ---------- 一、Mock 优先 ----------
  if (ENV.useMock) {
    const handler = matchMock(url, method)
    if (handler) {
      showLoading()
      try {
        await sleep(handler.delay ?? 400)
        const result = await handler.response({ url, method, data })
        return unwrap<T>(result)
      } catch (e) {
        if (showError) showErrorTip(e instanceof Error ? e.message : '请求失败')
        throw e
      } finally {
        hideLoading()
      }
    }
  }

  // ---------- 二、真实请求 ----------
  showLoading()
  try {
    const raw = await new Promise<unknown>((resolve, reject) => {
      uni.request({
        url: normalizeUrl(url),
        method,
        data: data as Record<string, unknown> | undefined,
        timeout,
        header: {
          'content-type': 'application/json',
          ...header,
        },
        success: (res) => resolve(res.data),
        fail: (err) => reject(new BizError(-1, err.errMsg || '网络异常')),
      })
    })

    const payload = parseBody(raw)
    if (isApiResult(payload) && payload.code !== ApiCode.OK) {
      handleBizCode(payload.code)
      throw new BizError(payload.code, payload.message || '请求失败')
    }
    return unwrap<T>(payload)
  } catch (e) {
    if (showError && e instanceof BizError && e.code !== -1) showErrorTip(e.message)
    throw e
  } finally {
    hideLoading()
  }
}

/** 便捷方法（泛型默认 unknown，业务调用处声明真实类型） */
export const http = {
  get: <T, D = unknown>(url: string, options?: Omit<RequestOptions<D>, 'url' | 'method'>) =>
    request<T, D>({ ...options, url, method: 'GET' }),

  post: <T, D = unknown>(url: string, data?: D, options?: Omit<RequestOptions<D>, 'url' | 'method' | 'data'>) =>
    request<T, D>({ ...options, url, method: 'POST', data }),

  put: <T, D = unknown>(url: string, data?: D, options?: Omit<RequestOptions<D>, 'url' | 'method' | 'data'>) =>
    request<T, D>({ ...options, url, method: 'PUT', data }),

  delete: <T, D = unknown>(url: string, options?: Omit<RequestOptions<D>, 'url' | 'method'>) =>
    request<T, D>({ ...options, url, method: 'DELETE' }),
}

export type { ApiResult }

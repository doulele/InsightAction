/**
 * Mock 层：在 Node 后端尚未就绪阶段，用本地假数据驱动前端全链路。
 *
 * 思路：与 http 层同构 —— MockHandler 返回统一 ApiResult 外壳，
 * 请求函数代码无需区分真实/模拟，仅在 http 内部做一次分发。
 * 后端就绪后：填上 VITE_API_BASE_URL，mock 自动退场，页面代码零改动。
 */
import type { ApiResult } from '@/types/api'
import type { HttpMethod } from '@/api/http'

export interface MockContext {
  url: string
  method: HttpMethod
  /** 请求体（业务层已序列化的对象） */
  data?: unknown
}

export interface MockHandler {
  /** 命中规则：url 包含该片段即命中 */
  url: string
  method: HttpMethod
  /** 模拟网络延迟 ms（默认 400） */
  delay?: number
  /** 返回统一外壳。类型由调用方 api 函数签名约束，此处运行时不做校验 */
  response: (ctx: MockContext) => ApiResult<unknown> | Promise<ApiResult<unknown>>
}

/** 所有 mock 处理器集中在此注册（按业务拆分可直接 export 多个数组后 concat） */
const MOCK_HANDLERS: MockHandler[] = [
  {
    url: '/insight/waitlist',
    method: 'POST',
    delay: 600,
    response: () => ({
      code: 0,
      message: 'ok',
      data: {
        joined: true,
        queueNo: 86,
      },
    }),
  },
]

export function matchMock(url: string, method: HttpMethod): MockHandler | undefined {
  return MOCK_HANDLERS.find((h) => h.method === method && url.includes(h.url))
}

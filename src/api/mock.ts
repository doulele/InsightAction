/**
 * Mock 层：在 Node 后端尚未就绪阶段，用本地假数据驱动前端全链路。
 *
 * 思路：与 http 层同构 —— MockHandler 返回统一 ApiResult 外壳，
 * 请求函数代码无需区分真实/模拟，仅在 http 内部做一次分发。
 * 退场方式：填上 VITE_API_BASE_URL 即自动退场（生产构建恒不启用），页面代码零改动。
 * 特例：baseUrl 已配、但本地仍想用假数据时，临时加 VITE_USE_MOCK=true ——
 *      此时为混合模式：命中本表的接口返回假数据，其余照常请求真后端。
 */
import type { ApiResult } from '@/types/api'
import type { HttpMethod } from '@/api/http'
import { MODES } from '@/config/modes'

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
  {
    /**
     * 横幅图配置（对应后端 GET /guanzhi/skins）。
     * mock 阶段没有后端，就用构建期配置的静态地址模拟下发；
     * 未配置 VITE_SKIN_BASE_URL 时返回空列表 → 页面显示主题渐变兜底。
     */
    url: '/skins',
    method: 'GET',
    delay: 120,
    response: () => ({
      code: 0,
      message: 'ok',
      data: {
        version: 'mock',
        skins: MODES.filter((m) => m.art).map((m) => ({ mode: m.id, url: m.art as string })),
      },
    }),
  },
]

export function matchMock(url: string, method: HttpMethod): MockHandler | undefined {
  return MOCK_HANDLERS.find((h) => h.method === method && url.includes(h.url))
}

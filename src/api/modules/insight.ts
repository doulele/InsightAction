/**
 * 观止知行 模块接口层。
 * 规则：每个业务页面需要的后端能力，在此声明为「一个函数 + 明确的返回类型」，
 * 页面只管调用与渲染，不感知底层 http / mock。
 */
import { http } from '@/api/http'

/** 加入静修等候名单的返回 */
export interface WaitlistResult {
  joined: boolean
  queueNo: number
}

/**
 * 加入「静修等候」名单。
 * 后端未就绪阶段自动命中本地 mock（见 src/api/mock.ts）。
 */
export function joinWaitlist(): Promise<WaitlistResult> {
  return http.post<WaitlistResult>('/insight/waitlist', undefined, { loading: '正在登记…' })
}

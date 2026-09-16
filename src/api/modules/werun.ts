/**
 * 微信运动接口层（需登录）。
 *
 * 一次同步的完整链路：
 *   1. `uni.getWeRunData()` → 拿到 **密文** { encryptedData, iv }（前端解不开，也不需要解开）；
 *   2. `POST /werun/decode` → 服务端用 session_key 解密 → 只回**明文步数**；
 *   3. 步数写进本机 store，云/服务端不留一份。
 *
 * 为什么必须绕这一圈：session_key 只在服务端（code2Session）出现过一次，
 * 它既能解这串密文，也能解这个 openid 的其它加密数据，绝不能下发到客户端。
 *
 * showError 关掉：错误文案统一由页面给（不同失败原因要给不同的下一步），
 * 避免 http 层弹一次 toast、页面再解释一遍。
 */
import { http } from '@/api/http'

/** 一天的步数（date = YYYY-MM-DD，服务端已按东八区换算） */
export interface WerunDay {
  date: string
  step: number
}

export interface WerunResult {
  days: WerunDay[]
  /** 最新一天（可能不是今天：当天还没有步数数据时就没有今天这条） */
  latest: WerunDay | null
  /** 返回了多少天（官方上限 31） */
  range: number
}

const authHeader = (token: string): Record<string, string> => ({ Authorization: `Bearer ${token}` })

/** 解密：把微信的密文换成明文步数（服务端不留存） */
export function decodeWeRunData(token: string, encryptedData: string, iv: string): Promise<WerunResult> {
  return http.post<WerunResult, { encryptedData: string; iv: string }>(
    '/werun/decode',
    { encryptedData, iv },
    { header: authHeader(token), loading: '读取步数', showError: false },
  )
}

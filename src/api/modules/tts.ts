/**
 * 语音合成（正文收听）接口层 —— 需登录。
 *
 *   POST /guanzhi/tts             { text, voice? } → { key, bytes, cached, chars, voice }
 *   GET  /guanzhi/tts/audio/:key                    → audio/mpeg（服务端**内存**里还留着的那段）
 *
 * 分工：**合成在服务端**（微软 Edge 在线合成，音色自然、一次能合上千字，见后端 services/edgeTts.js）；
 * 小程序只负责"取回来 → 落到本机 → 按段播"。所以这里只有两个函数：合成一段、拼音频地址。
 *
 * 为什么是两段式（先拿 key 再取音频）而不是一次回 base64：
 *  · 音频走二进制 GET，**不膨胀**（base64 会涨约 1/3）、也不占小程序内存；
 *  · 能直接 `uni.downloadFile` 进本机私有目录（`gz-tts-<哈希>.mp3`）——
 *    第二次听同一段**一个请求都不发**，离线也能听（见 utils/speech.ts）。
 *
 * 隐私：文本经我们的服务器转交合成服务，服务端只在内存里短暂保留合成结果（不落盘、不打日志），
 * 小程序这边落到自己手机的私有目录。口径见 PRIVACY.md 第 5.2 节。
 */
import { http } from '@/api/http'
import { ENV } from '@/config/env'

export interface TtsResult {
  /** 内容键：`/tts/audio/<key>` 就是这段音频的地址 */
  key: string
  bytes: number
  /** true = 服务端内存里已有这段（不花额度，直接给地址） */
  cached: boolean
  chars: number
  voice: string
}

const authHeader = (token: string): Record<string, string> => ({ Authorization: `Bearer ${token}` })

/**
 * 合成一段正文。
 *
 * 超时给到 40 秒：实测约 70–110 字/秒（1200 字 ≈ 10 秒），网络差时更久 ——
 * 用默认的 15 秒会把"其实快好了"的请求掐死，而重来一次更慢。
 */
export function synthesizeSpeech(
  token: string,
  body: { text: string; voice?: string },
): Promise<TtsResult> {
  return http.post<TtsResult, { text: string; voice?: string }>('/tts', body, {
    header: authHeader(token),
    timeout: 40000,
    /* 错误文案由收听条统一给（要区分"合成失败"和"被限流"），http 层不重复弹 */
    showError: false,
  })
}

/** 音频地址（downloadFile 与流式播放都用它） */
export function speechAudioUrl(key: string): string {
  return `${ENV.apiBaseUrl.replace(/\/+$/, '')}/tts/audio/${key}.mp3`
}

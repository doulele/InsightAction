/**
 * 语音转写（ASR）接口层 —— 需登录。
 *
 *   POST /guanzhi/asr  { audio, format?, durationMs? } → { text, provider, ms }
 *
 * 分工：录音在小程序（`uni.getRecorderManager`），读成 base64 后随 JSON 上传；
 * 识别在服务端（第三方 OpenAI 兼容接口，或服务器本机的 faster-whisper，见后端 services/asrService.js）。
 *
 * 为什么用 JSON + base64 而不是 `uni.uploadFile`：与 `/parse` 同一个理由 ——
 * 服务端不必引 multer、也不必留一个"可能残留用户录音"的上传临时目录；
 * 录音本来就是几十秒的小文件（60 秒 mp3 ≈ 180KB），1/3 的膨胀无所谓。
 *
 * 隐私：**这一条路录音会离开手机**（插件那条路不会）。口径见 PRIVACY.md 第 5.1 节 ——
 * 服务端只在这一次请求的内存里过一手，不落盘、不进数据库、不打日志。
 */
import { http } from '@/api/http'
import { ASR_TIMEOUT_MS } from '@/config/voice'

/** 后端认的容器（与后端 routes/asr.js 的 FORMATS 一致；前端固定录 mp3） */
export type AsrFormat = 'mp3' | 'm4a' | 'aac' | 'wav' | 'pcm'

export interface AsrResult {
  /** 识别出的文字（已 trim，非空） */
  text: string
  /** 服务端实际用的引擎：http = 第三方转写接口，local = 本机 faster-whisper */
  provider: string
  /** 服务端耗时（毫秒）——排查「怎么这么慢」时看它 */
  ms: number
}

export interface AsrInput {
  /** 录音的 base64（不带 data: 前缀） */
  audio: string
  format?: AsrFormat
  /** 录音时长（毫秒）：服务端据此卡上限，也用于日志 */
  durationMs?: number
}

export function recognizeVoice(token: string, body: AsrInput): Promise<AsrResult> {
  return http.post<AsrResult, AsrInput>('/asr', body, {
    header: { Authorization: `Bearer ${token}` },
    timeout: ASR_TIMEOUT_MS,
    /* 失败文案由「按住说话」那一块统一给（要区分"没权限""网络差""服务端没开"），http 层不重复弹 */
    showError: false,
  })
}

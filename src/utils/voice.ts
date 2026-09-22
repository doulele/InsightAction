/**
 * 语音转写 —— 「按住说话」→ 松开出字。两个引擎：插件优先、后端兜底。
 * ================================================
 *
 * 为什么会有第二个引擎（2026-09-22 加的）：
 * 微信同声传译插件在服务市场登记的类目是「IT科技-软件服务提供商」，而《小程序插件功能介绍》
 * 要求**插件类目不能超过使用方小程序主体类型当前开放的范围** —— 个人主体没有 IT科技 类目，
 * 所以带这个插件提审必被驳回（实测）。于是加了「录音交给我们自己的后端转写」这条路
 * （`POST /guanzhi/asr`）：它不占 app.json 的 `plugins` 声明、不受插件类目校验约束。
 *
 * ── 两个引擎 ──
 *  · **插件（默认优先）**：`requirePlugin('WechatSI')` 的 `getRecordRecognitionManager()`。
 *    录音与识别都在微信侧完成，**音频不出设备**，还能边说边出字（onPartial）。
 *    前置：后台已添加插件、且 `manifest.json` 里有声明 —— 缺一个就探不到（不报错，静默让位）。
 *  · **后端（兜底）**：`uni.getRecorderManager()` 录 mp3 → 读成 base64 → `POST /guanzhi/asr`
 *    （见 api/modules/asr.ts 与后端 services/asrService.js）。**这条路录音会离开手机** ——
 *    为合规明确接受的代价，口径写在 PRIVACY.md 第 5.1 节。
 *
 * ⚠️ **提审前要做的唯一一件事**：删掉 `src/manifest.json` 的 `mp-weixin.plugins` 块，
 * 并在小程序后台移除该插件。删掉之后插件探不到，`pickEngine()` 会自动落到后端，
 * **页面一行都不用改、也不需要再发一版**。想反向自测后端那条路：把 config/voice.ts 的
 * `VOICE_ENGINE_ORDER` 倒成 ['backend', 'plugin']。
 *
 * ── 可用性 ──
 * 两个引擎都不可用时 `voiceAvailable()` 返回 false，页面据此**整条不渲染**「按住说话」——
 * 宁可没有按钮，也不给一个按下去没反应的按钮。注意「服务端没开转写」（50001）
 * 只有第一次真用时才知道：那时把它记下来（`backendDead`），并把 `unsupported` 抛给页面收起按钮，
 * 不再反复失败。
 *
 * 用法：
 *   const s = startVoice({ onDone: (t) => { ... }, onFail: (f) => { ... } })
 *   s?.stop()    // 松开手指
 *   s?.abort()   // 反悔了，这次不算
 *
 * 文案与阈值一律在 config/voice.ts，本文件不写句子（`failOf` 是唯一出口）。
 */
import { ApiCode, BizError } from '@/types/api'
import { recognizeVoice } from '@/api/modules/asr'
import { useAccountStore } from '@/stores/account'
import { useRemoteStore } from '@/stores/remote'
import { readBase64 } from '@/utils/localFile'
import { PLUGIN_LANG, RECORD, VOICE_ENGINE_ORDER, VOICE_TEXT } from '@/config/voice'

/**
 * 失败原因（**键**，不是句子）：页面拿它决定后续动作
 * （`unsupported` 要收起按钮、`denied` 才要引导去设置），句子一律从 config/voice.ts 取。
 */
export type VoiceFailReason =
  /** 两个引擎都用不了（不是微信小程序 / 插件没声明且服务端没开转写） */
  | 'unsupported'
  /** 用户没给麦克风权限 */
  | 'denied'
  /** 听到的是空的（没说 / 太短 / 全是噪音） */
  | 'empty'
  /** 被限流（服务端的最小间隔 / 每日次数） */
  | 'busy'
  /** 网络不通或超时 */
  | 'offline'
  | 'error'

export interface VoiceFail {
  reason: VoiceFailReason
  message: string
}

export interface VoiceHandlers {
  /** 实时中间结果（**只有插件引擎会给**）：仅用于"正在听…"的反馈，不要直接写进正文 */
  onPartial?: (text: string) => void
  /** 识别成功：text 一定非空 */
  onDone: (text: string) => void
  /** 失败：reason 决定提示文案与后续动作 */
  onFail: (fail: VoiceFail) => void
}

export interface VoiceSession {
  /** 松开手指：结束录音，等结果回来（走 onDone / onFail） */
  stop(): void
  /** 反悔：这次不算，不触发任何回调 */
  abort(): void
}

type Engine = (typeof VOICE_ENGINE_ORDER)[number]

/**
 * 失败原因 → 页面要显示的失败。
 * `Record<VoiceFailReason, string>` 是**故意的**：加一个原因却忘了加文案，TS 会当场报错。
 * `message` 只有一处例外允许覆盖：服务端限流时它给的句子更具体（"今天转写够多了"），
 * 那是同一套产品的口径，比这里的泛化文案有用。
 */
function failOf(reason: VoiceFailReason, message?: string): VoiceFail {
  const fixed: Record<VoiceFailReason, string> = {
    unsupported: VOICE_TEXT.fail.unsupported,
    denied: VOICE_TEXT.fail.denied,
    empty: VOICE_TEXT.fail.empty,
    busy: VOICE_TEXT.fail.busy,
    offline: VOICE_TEXT.fail.offline,
    error: VOICE_TEXT.fail.error,
  }
  return { reason, message: message || fixed[reason] }
}

/* ------------------------------------------------------------------ *
 * 引擎一：微信同声传译插件（录音 + 识别都在微信侧，音频不出设备）
 * ------------------------------------------------------------------ */

interface RecognizeResult {
  result?: string
  tempFilePath?: string
  duration?: number
  fileSize?: number
}

interface RecognizeError {
  retcode?: number
  msg?: string
}

interface RecordRecognitionManager {
  start(options: { duration?: number; lang?: string }): void
  stop(): void
  onStart?: () => void
  onStop?: (res: RecognizeResult) => void
  onError?: (res: RecognizeError) => void
  /** 实时中间结果：边说边出，用来给"正在听…"的即时反馈 */
  onRecognize?: (res: { result?: string }) => void
}

interface WechatSIPlugin {
  getRecordRecognitionManager(): RecordRecognitionManager
}

/** 插件在运行时由微信注入，编译期无法 import —— 只能声明成常量 */
declare const requirePlugin: (name: string) => unknown

/**
 * 插件管理器是**全局唯一**的（多次 getRecordRecognitionManager 返回同一个对象），
 * 所以这里缓存一份，并在每次 start 前重挂回调 —— 否则上一轮的回调会串到下一轮。
 */
let manager: RecordRecognitionManager | null = null
let probed = false

/** 取插件；任何异常（没声明 / 没添加 / 基础库低）一律当作"不支持" */
function pluginManager(): RecordRecognitionManager | null {
  // #ifdef MP-WEIXIN
  if (probed) return manager
  probed = true
  try {
    const plugin = requirePlugin('WechatSI') as WechatSIPlugin
    manager = plugin?.getRecordRecognitionManager?.() ?? null
  } catch {
    manager = null
  }
  return manager
  // #endif
  // #ifndef MP-WEIXIN
  return null
  // #endif
}

/**
 * 插件错误 → 页面看得懂的失败。
 * 只按 msg 文本判断授权 / 限流类问题：retcode 的具体取值官方文档没给全，
 * 按数字猜会猜错（猜错的代价是给用户一句错的提示），不如只认文本特征。
 */
function toPluginFail(err: RecognizeError | undefined): VoiceFail {
  const msg = String(err?.msg ?? '')
  if (/auth|deny|permission|授权|权限/i.test(msg)) return failOf('denied')
  if (/frequen|limit|too many/i.test(msg)) return failOf('busy')
  return failOf('error')
}

function startPluginVoice(h: VoiceHandlers): VoiceSession | null {
  const m = pluginManager()
  if (!m) {
    h.onFail(failOf('unsupported'))
    return null
  }

  /** 已出结果（成功或失败）—— 插件的 onError 与 onStop 有可能都触发，只认第一个 */
  let settled = false

  m.onStart = () => {
    /* 插件把授权的结果放在这里：能走到 onStart 就说明麦克风已经可用 */
  }
  m.onRecognize = (res) => {
    const t = String(res?.result ?? '').trim()
    if (t) h.onPartial?.(t)
  }
  m.onStop = (res) => {
    if (settled) return
    settled = true
    const text = String(res?.result ?? '').trim()
    if (!text) {
      h.onFail(failOf('empty'))
      return
    }
    h.onDone(text)
  }
  m.onError = (err) => {
    if (settled) return
    settled = true
    h.onFail(toPluginFail(err))
  }

  try {
    m.start({ duration: RECORD.maxMs, lang: PLUGIN_LANG })
  } catch {
    settled = true
    h.onFail(failOf('error'))
    return null
  }

  const stopSafely = (): void => {
    try {
      m.stop()
    } catch {
      /* 已经停了 / 从没开始成 —— 都不该让页面崩 */
    }
  }

  return {
    stop: stopSafely,
    abort() {
      settled = true
      stopSafely()
    },
  }
}

/* ------------------------------------------------------------------ *
 * 引擎二：自己的后端（小程序录音 → 上传 → 服务端转写）
 * ------------------------------------------------------------------ */

interface RecorderStopResult {
  tempFilePath?: string
  duration?: number
  fileSize?: number
}

interface RecorderError {
  errMsg?: string
  errno?: number
}

/** 录音能力的窄接口（uni 的类型在各端不一致，这里只声明真正用到的那几个） */
interface RecorderManagerLike {
  start(options: {
    duration?: number
    sampleRate?: number
    numberOfChannels?: number
    encodeBitRate?: number
    format?: string
  }): void
  stop(): void
  onStop?(cb: (res: RecorderStopResult) => void): void
  onError?(cb: (err: RecorderError) => void): void
}

interface RecorderApi {
  getRecorderManager?: () => RecorderManagerLike
}

const mp = uni as unknown as RecorderApi

/** 当前这次录音（录音管理器是**单例**，回调要能找回来"是哪一次"） */
interface BackendSession {
  startedAt: number
  settled: boolean
  handleStop(res: RecorderStopResult): void
  handleError(err: RecorderError): void
}

let activeRecorder: RecorderManagerLike | null = null
let recorderBound = false
let backendSession: BackendSession | null = null

/**
 * 取录音管理器并**只绑一次**回调。
 *
 * 为什么只绑一次：`RecorderManager` 是全项目唯一的一个实例，而 `onStop` / `onError`
 * 是"注册监听"语义（没有对应的 off），每次 start 都重挂会越挂越多、旧回调一起触发。
 * 所以回调统一转发给 `backendSession`（当前那一次），由它自己判 settled。
 */
function recorderOf(): RecorderManagerLike | null {
  if (activeRecorder) return activeRecorder
  if (typeof mp.getRecorderManager !== 'function') return null

  const rec = mp.getRecorderManager()
  if (!rec) return null
  activeRecorder = rec

  if (!recorderBound) {
    recorderBound = true
    rec.onStop?.((res) => backendSession?.handleStop(res))
    rec.onError?.((err) => backendSession?.handleError(err))
  }
  return rec
}

/** 录音管理器的报错 → 页面看得懂的失败（授权类只按文本判，理由同 toPluginFail） */
function toRecorderFail(err: RecorderError | undefined): VoiceFail {
  const msg = String(err?.errMsg ?? '')
  if (/auth|deny|permission|授权|权限/i.test(msg)) return failOf('denied')
  return failOf('error')
}

/** 后端那条路的报错 → 页面看得懂的失败 */
function toBackendFail(e: unknown): VoiceFail {
  if (e instanceof BizError) {
    /* 50001 = 服务端没有可用引擎：记下来别再给按钮，也避免反复失败 */
    if (e.code === ApiCode.NotConfigured) {
      backendDead = true
      return failOf('unsupported')
    }
    /** 限流：服务端那句更具体（最小间隔 / 今天够多了），优先用它 */
    if (e.code === ApiCode.TooManyRequest) return failOf('busy', e.message)
    /** -1 是 http 层对"根本没连上 / 超时"的统一编码（见 api/http.ts） */
    if (e.code === -1) return failOf('offline')
    return failOf('error')
  }
  return failOf('offline')
}

function startBackendVoice(h: VoiceHandlers): VoiceSession | null {
  const rec = recorderOf()
  if (!rec) {
    h.onFail(failOf('unsupported'))
    return null
  }

  const session: BackendSession = {
    startedAt: Date.now(),
    settled: false,
    handleStop(res) {
      if (session.settled) return
      session.settled = true
      if (backendSession === session) backendSession = null
      void finishRecording(res)
    },
    handleError(err) {
      if (session.settled) return
      session.settled = true
      if (backendSession === session) backendSession = null
      h.onFail(toRecorderFail(err))
    },
  }

  /** 录完了：读文件 → 上传转写。全程只读不写，录音文件交给微信自己清理 */
  async function finishRecording(res: RecorderStopResult): Promise<void> {
    const path = String(res?.tempFilePath ?? '')
    /* duration 由微信给；它偶尔不给，就用真实耗时兜底 */
    const ms = Number(res?.duration) || Date.now() - session.startedAt

    if (ms < RECORD.minMs) {
      h.onFail(failOf('empty'))
      return
    }
    if (!path) {
      h.onFail(failOf('error'))
      return
    }
    const audio = readBase64(path)
    if (!audio) {
      h.onFail(failOf('error'))
      return
    }

    try {
      const r = await useAccountStore().withAuth((token) =>
        recognizeVoice(token, { audio, format: RECORD.format, durationMs: ms }),
      )
      const text = String(r?.text ?? '').trim()
      if (!text) {
        h.onFail(failOf('empty'))
        return
      }
      h.onDone(text)
    } catch (e) {
      /* 登录态失效由 withAuth 自己重登重试过了，走到这里就是真失败 */
      h.onFail(toBackendFail(e))
    }
  }

  backendSession = session
  try {
    rec.start({
      duration: RECORD.maxMs,
      sampleRate: RECORD.sampleRate,
      numberOfChannels: RECORD.numberOfChannels,
      encodeBitRate: RECORD.encodeBitRate,
      format: RECORD.format,
    })
  } catch {
    session.settled = true
    if (backendSession === session) backendSession = null
    h.onFail(failOf('error'))
    return null
  }

  const stopSafely = (): void => {
    try {
      rec.stop()
    } catch {
      /* 已经停了 / 从没开始成 */
    }
  }

  return {
    stop: stopSafely,
    abort() {
      /* 先 settled 再 stop：这样松手触发的 onStop 不会再走识别 */
      session.settled = true
      if (backendSession === session) backendSession = null
      stopSafely()
    },
  }
}

/* ------------------------------------------------------------------ *
 * 选引擎与对外接口
 * ------------------------------------------------------------------ */

/** 服务端已经明确说"没开转写"（50001）—— 这一版就不再试它，免得反复失败 */
let backendDead = false

/** 后端这条路是否允许：远端开关（未配置 = 开）+ "服务端确实没开"的实测结果 */
function backendAllowed(): boolean {
  return !backendDead && useRemoteStore().feature('asr')
}

/** 按 VOICE_ENGINE_ORDER 挑第一个可用的引擎；都不可用返回 null */
function pickEngine(): Engine | null {
  for (const engine of VOICE_ENGINE_ORDER) {
    if (engine === 'plugin' && pluginManager()) return 'plugin'
    if (engine === 'backend' && backendAllowed()) return 'backend'
  }
  return null
}

/**
 * 当前环境能不能语音转写。
 * 页面据此决定要不要渲染「按住说话」—— 不能就别给一个按下去没反应的按钮。
 */
export function voiceAvailable(): boolean {
  return pickEngine() !== null
}

/**
 * 开始一次语音转写。返回 null 表示没能开始（原因已通过 onFail 给出）。
 *
 * 注意：录音是**用户按住才录**，不做"点了就录"—— 麦克风在微信里是个敏感图标，
 * 不按住就录会让用户以为在偷听。
 */
export function startVoice(h: VoiceHandlers): VoiceSession | null {
  const engine = pickEngine()
  if (!engine) {
    h.onFail(failOf('unsupported'))
    return null
  }
  return engine === 'plugin' ? startPluginVoice(h) : startBackendVoice(h)
}

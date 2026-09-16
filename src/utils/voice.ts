/**
 * 语音转文字 —— 微信同声传译插件（WechatSI）。
 *
 * 为什么用它而不是自建 ASR：
 *  · **音频不出微信**：识别在微信侧完成，我们只拿到文本，连 tempFilePath 都不读、
 *    不落盘、不上传 —— 隐私面比「录音上传到第三方 ASR」小一个量级，
 *    也正是 PRIVACY.md 敢写「录音不离开微信」的依据；
 *  · **零成本、零后端**：官方配额 语音输入 250 条/分、3 万条/天，个人开发者绰绰有余
 *    （超了可以发邮件到 wetranslate@tencent.com 申请提额）；
 *  · 拿到文本后再走已有的 `/ai/feynman` 做检验，那条链路早就在跑了。
 *
 * ⚠️ 接入前置（缺一个都会**静默降级**成"不支持"，页面只是隐藏按钮，绝不崩）：
 *  1. 小程序后台 → 设置 → 第三方服务 → 插件管理 → 添加插件 `wx069ba97219f66d99`；
 *  2. `manifest.json` → `mp-weixin.plugins` 里声明（见该处注释）；
 *  3. 用户授权 `scope.record` —— 录音属隐私接口，首次调用时微信会弹授权框，
 *     被拦下时由页面上的 `<PrivacyGate />` 接住（见 utils/privacy.ts）。
 *
 * 基础库要求 ≥ 1.9.94。
 *
 * 用法（按住说话 → 松开出字）：
 *   const s = startVoice({ onDone: (t) => { ... }, onFail: (f) => { ... } })
 *   s?.stop()    // 松开手指
 *   s?.abort()   // 反悔了，这次不算
 */
export type VoiceFailReason =
  /** 不是微信小程序 / 插件没声明 / 后台没添加 / 基础库过低 */
  | 'unsupported'
  /** 用户没给麦克风权限 */
  | 'denied'
  /** 听到的是空的（没说 / 太短 / 全是噪音） */
  | 'empty'
  /** 说得太频繁，被插件限频 */
  | 'busy'
  | 'error'

export interface VoiceFail {
  reason: VoiceFailReason
  message: string
}

/* ---------------- 插件的窄接口（uni 与 @dcloudio 都没有它的类型声明） ---------------- */

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

/** 识别语言：目前只需要普通话（插件另支持 en_US / zh_HK / sichuanhua） */
const LANG = 'zh_CN'
/** 单次录音上限，也是插件硬上限 60000ms —— 到点插件会自己停 */
const MAX_MS = 60000

/**
 * 插件管理器是**全局唯一**的（多次 getRecordRecognitionManager 返回同一个对象），
 * 所以这里缓存一份，并在每次 start 前重挂回调 —— 否则上一轮的回调会串到下一轮。
 */
let manager: RecordRecognitionManager | null = null
let probed = false

/** 取插件；任何异常（没声明 / 没添加 / 基础库低）一律当作"不支持" */
function getManager(): RecordRecognitionManager | null {
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
 * 当前环境能不能语音转写。
 * 页面据此决定要不要渲染「按住说话」—— 不能就别给一个按下去没反应的按钮。
 */
export function voiceAvailable(): boolean {
  return getManager() !== null
}

/**
 * 插件错误 → 页面看得懂的失败。
 * 只按 msg 文本判断授权类问题：retcode 的具体取值官方文档没给全，
 * 按数字猜会猜错（猜错的代价是给用户一句错的提示），不如只认文本特征。
 */
function toFail(err: RecognizeError | undefined): VoiceFail {
  const msg = String(err?.msg ?? '')
  if (/auth|deny|permission|授权|权限/i.test(msg)) {
    return { reason: 'denied', message: '没有麦克风权限，去设置里打开后重试' }
  }
  if (/frequen|limit|too many/i.test(msg)) {
    return { reason: 'busy', message: '说得太频繁了，歇一秒再来' }
  }
  return { reason: 'error', message: msg || '语音转写失败' }
}

export interface VoiceHandlers {
  /** 实时中间结果（可选）：只用于"正在听…"的反馈，不要直接写进正文 */
  onPartial?: (text: string) => void
  /** 识别成功：text 一定非空 */
  onDone: (text: string) => void
  /** 失败：reason 决定提示文案与后续动作（denied 才有必要引导去设置） */
  onFail: (fail: VoiceFail) => void
}

export interface VoiceSession {
  /** 松开手指：结束录音，等识别结果回来（走 onDone / onFail） */
  stop(): void
  /** 反悔：这次不算，不触发任何回调 */
  abort(): void
}

/**
 * 开始一次语音识别。返回 null 表示没能开始（原因已通过 onFail 给出）。
 *
 * 注意：录音是**用户按住才录**，不做"点了就录"—— 麦克风在微信里是个敏感图标，
 * 不按住就录会让用户以为在偷听。
 */
export function startVoice(h: VoiceHandlers): VoiceSession | null {
  const m = getManager()
  if (!m) {
    h.onFail({ reason: 'unsupported', message: '当前环境不支持语音转写' })
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
      h.onFail({ reason: 'empty', message: '没听清，再说一次' })
      return
    }
    h.onDone(text)
  }
  m.onError = (err) => {
    if (settled) return
    settled = true
    h.onFail(toFail(err))
  }

  try {
    m.start({ duration: MAX_MS, lang: LANG })
  } catch (e) {
    settled = true
    h.onFail({ reason: 'error', message: e instanceof Error ? e.message : '录音启动失败' })
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

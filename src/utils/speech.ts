/**
 * 正文收听（朗读）—— 两个引擎 + 一个"按段排队"的播放器。
 * ================================================
 *
 * 分工：本文件管**文字 → 音频 → 排队播放**；真正的出声交给 utils/audio.ts
 * （全项目只有一个 innerAudioContext，朗读是它的第三个借方，见那边的文件头）。
 *
 * ── 两个引擎（详见 config/speech.ts 的对照表）──
 *  · **服务端（默认）**：`POST /guanzhi/tts` → 微软 Edge 在线合成，一段最多 1200 字，
 *    合成结果**下进本机私有目录**（`gz-tts-<哈希>.mp3`）→ 第二次听同一段零请求、离线也能听；
 *    音色可选、可倍速（播放端变速）。**代价是正文经过我们的服务器。**
 *  · **插件（回落）**：微信同声传译插件，一段 50 字，不经服务器。
 *    后端要关整个服务端引擎，就改 `config/app-config.json` 的 `features.tts`（60 秒热生效，不用发版）；
 *    服务端在**第一段就不通**时（没部署 / 挂了 / 网络断）也会**自动**回落到插件，用户不会听到"没声"。
 *
 * ── 为什么"按段"而不是"整篇一次"──
 * 实测合成速度约 70–110 字/秒（见 config/speech.ts 的三条数据）：1200 字要 ~10 秒。
 * 所以**首段故意切小（300 字）先出声**（≈4 秒），之后的段在播放期间预取 ——
 * 听感上就是"点一下，几秒后开始念，然后一路不断"，而长文也不必等一整篇合成完。
 *
 * ── 进度 ──
 * 每一段都是**一个完整 mp3**，所以有真实时长。页面每 250ms 读一次 `session.progress()`，
 * 拿到的是"按字数加权的总百分比 + 本段位置/时长"——比原来的"第几片"实在得多。
 *
 * ── 失败与续听 ──
 *  · 合成失败：服务端那条路失败后**从当前这一段**改用插件接着说（只在前几段没播完时才自动回落）；
 *    插件那条路失败会重试 `SYNTH_RETRY` 次（-40001 是频控）；
 *  · 播放失败：先用下载兜底（网络地址播不出来时常见的解法），仍不行就报错 —— 界面保留「继续」，
 *    从**当前这一段**重来（长文里坏一段不该作废整篇）。
 */
import {
  CLAUSE_MARKS,
  DEFAULT_VOICE,
  LINE_MARKS,
  LOOKAHEAD,
  PLUGIN_CHUNK_MAX,
  SCAN_BACK,
  SENTENCE_MARKS,
  SERVER_CHUNK_MAX,
  SERVER_FIRST_CHUNK_MAX,
  SPEECH_LANG,
  SYNTH_RETRY,
  SYNTH_RETRY_MS,
} from '@/config/speech'
import { speechAudioUrl, synthesizeSpeech } from '@/api/modules/tts'
import { useAccountStore } from '@/stores/account'
import { useRemoteStore } from '@/stores/remote'
import {
  pauseSpeech,
  playSpeech,
  resumeSpeech,
  setSpeechInterruptHandler,
  setSpeechRate,
  speechPosition,
  stopSpeech,
} from '@/utils/audio'
import { copyToUserDir, fileExists, removeFile, userDir } from '@/utils/localFile'

/** 一段朗读的状态（idle = 什么都没在放，页面据此收起收听条） */
export type SpeechState = 'idle' | 'synth' | 'playing' | 'paused' | 'done' | 'error'

/**
 * 失败原因（**键**，不是句子）：页面拿它去 config/speech.ts 的 `SPEECH_TEXT.fail` 取文案 ——
 * 文案只有一份，别在 util 与页面各写一遍。
 */
export type SpeechFailReason = 'synth' | 'play' | 'quota'

/** 进度：第 index 段 / 共 total 段；总百分比按**字数加权**（段长不等，按段数算会跳） */
export interface SpeechProgress {
  index: number
  total: number
  reason?: SpeechFailReason
}

/** 播放位置（页面画进度条用） */
export interface SpeechPosition {
  /** 总进度百分比（0~100，按字数加权） */
  percent: number
  /** 当前这一段播到第几秒 / 这一段共几秒 */
  position: number
  duration: number
}

export interface SpeechHandlers {
  /** 每次状态变化都回调（含第几段）；页面据此更新收听条 */
  onState: (state: SpeechState, progress: SpeechProgress) => void
}

export interface SpeechOptions {
  /** 音色（服务端引擎有效；插件引擎忽略） */
  voice?: string
  /** 倍速（播放端生效） */
  rate?: number
}

export interface SpeechSession {
  /** 暂停：**真的停在当前位置**（同一段音频 pause），继续时接着放 */
  pause(): void
  /** 继续：接着放；从"出错"里恢复时从**当前这一段**重新合成 */
  resume(): void
  /** 收摊：停声 + 释放 + 清缓存引用（页面按钮 / 离页都走它） */
  stop(): void
  /** 换倍速（立即生效，不重新合成） */
  setRate(rate: number): void
  /** 换音色（对**后面还没合成的段**生效；正在播的这段不变） */
  setVoice(voice: string): void
  /** 读一次进度（页面 250ms 轮询） */
  progress(): SpeechPosition
  readonly state: SpeechState
  /** 当前用的引擎：server = 服务端合成（有声有音色），plugin = 插件回落（无音色可选） */
  readonly engine: Engine
}

type Engine = 'server' | 'plugin'

/* ---------------- 官方插件（回落引擎）的窄接口 ---------------- */

interface TtsResult {
  retcode?: number
  msg?: string
  /** 合成出来的音频地址（3 小时有效） */
  filename?: string
}

interface WechatSIPlugin {
  textToSpeech(options: {
    lang: string
    tts?: boolean
    content: string
    success?: (res: TtsResult) => void
    fail?: (res: TtsResult) => void
  }): void
}

/** 插件在运行时由微信注入，编译期无法 import —— 只能声明成常量 */
declare const requirePlugin: (name: string) => unknown

let plugin: WechatSIPlugin | null = null
let probed = false

function getPlugin(): WechatSIPlugin | null {
  // #ifdef MP-WEIXIN
  if (probed) return plugin
  probed = true
  try {
    const p = requirePlugin('WechatSI') as WechatSIPlugin
    plugin = typeof p?.textToSpeech === 'function' ? p : null
  } catch {
    plugin = null
  }
  return plugin
  // #endif
  // #ifndef MP-WEIXIN
  return null
  // #endif
}

/** 插件那一套能不能用（服务端引擎不依赖它） */
export function speechAvailable(): boolean {
  return getPlugin() !== null
}

/* ---------------- 切分 ---------------- */

/**
 * 按标点切分（导出是为了让真机排查能看清"它到底切成了几段"）。
 *
 * 规则：先找段长之内**最后一个句末标点**，找不到退到逗号一类，再找不到才硬切 ——
 * 硬切只会让语调在中间断一下，不影响可听。
 * `firstMax` 是**首段更短**的上限（服务端引擎用它换"更快出声"）。
 */
export function splitForReading(text: string, max: number, firstMax = max): string[] {
  const out: string[] = []
  let rest = String(text ?? '')
    .replace(/\r\n?/g, '\n')
    .trim()
  while (rest) {
    const limit = Math.min(out.length === 0 ? firstMax : max, rest.length)
    if (rest.length <= limit) {
      out.push(rest)
      break
    }
    let cut = lastIndexOfAny(rest, limit, SENTENCE_MARKS + LINE_MARKS)
    if (cut <= 0) cut = lastIndexOfAny(rest, limit, CLAUSE_MARKS)
    if (cut <= 0) cut = limit
    const piece = rest.slice(0, cut).trim()
    if (piece) out.push(piece)
    rest = rest.slice(cut).trim()
  }
  return out
}

/** 在 [0, limit) 里找最后一个属于 marks 的字符，返回它后面一位（找不到返回 -1） */
function lastIndexOfAny(s: string, limit: number, marks: string): number {
  const from = Math.max(0, limit - SCAN_BACK)
  for (let i = limit - 1; i >= from; i -= 1) {
    if (marks.includes(s[i])) return i + 1
  }
  return -1
}

/* ---------------- 音频来源 ---------------- */

interface SpeechSource {
  src: string
  /** 起播失败时的备选地址（本地文件播不出来就用它流式播） */
  fallback?: string
  /** src 是不是本机文件（看门狗据此判断"本地不可播"） */
  local: boolean
}

/** 前端也算得出来的短哈希（djb2）——用来给本机缓存文件命名，不必等服务端返回 key */
function hashOf(text: string): string {
  let h = 5381
  for (let i = 0; i < text.length; i += 1) h = (h * 33 + text.charCodeAt(i)) >>> 0
  return h.toString(36)
}

/** 本机缓存文件（同一段文本 + 同一音色 → 同一个文件，重下即覆盖） */
function cacheOf(text: string, voice: string): { dir: string; name: string; path: string } {
  const dir = userDir()
  const name = `gz-tts-${hashOf(`${voice}|${text}`)}.mp3`
  return { dir, name, path: dir ? `${dir}/${name}` : '' }
}

/** 把音频下进私有永久目录（失败返回空串 —— 那就退回直接播网络地址） */
function downloadToCache(url: string, dest: string, name: string, token: string): Promise<string> {
  if (!dest) return Promise.resolve('')
  return new Promise((resolve) => {
    uni.downloadFile({
      url,
      header: token ? { Authorization: `Bearer ${token}` } : undefined,
      success: (res) => {
        const temp = (res as { tempFilePath?: string }).tempFilePath
        if (res.statusCode !== 200 || !temp) {
          resolve('')
          return
        }
        resolve(dest ? copyToUserDir(temp, name) : '')
      },
      fail: () => resolve(''),
    })
  })
}

/* ---------------- 引擎一：服务端（微软 Edge 合成） ---------------- */

/**
 * 取一段的音频。
 * 顺序：**本机缓存 → 服务端合成 → 下载到本机 → （下载失败就）直接播网络地址**。
 * 本机缓存放在最前面：同一段听第二次时一个请求都不发，飞行模式也能听。
 */
async function serverSynth(text: string, voice: string): Promise<SpeechSource> {
  const cache = cacheOf(text, voice)
  if (cache.path && fileExists(cache.path)) return { src: cache.path, local: true }

  const account = useAccountStore()
  const res = await account.withAuth((token) => synthesizeSpeech(token, { text, voice }))
  const url = speechAudioUrl(res.key)
  const local = await downloadToCache(url, cache.path, cache.name, account.token)
  return local ? { src: local, local: true, fallback: url } : { src: url, local: false }
}

/* ---------------- 引擎二：微信同声传译插件 ---------------- */

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

/** 合成一次（不回退、不重试） */
function pluginSynthOnce(text: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const p = getPlugin()
    if (!p) {
      reject(new Error('当前环境不支持收听'))
      return
    }
    try {
      p.textToSpeech({
        lang: SPEECH_LANG,
        tts: true,
        content: text,
        success: (res) => {
          if (res && res.retcode === 0 && res.filename) resolve(res.filename)
          else reject(new Error(res?.msg || '语音合成失败'))
        },
        fail: (res) => reject(new Error(res?.msg || '语音合成失败')),
      })
    } catch (e) {
      reject(e instanceof Error ? e : new Error('语音合成失败'))
    }
  })
}

/** 带重试的插件合成（重试主要是为 -40001「调用太频繁」：那是节奏问题，等一等就好） */
async function pluginSynth(text: string): Promise<SpeechSource> {
  let last: Error | null = null
  for (let i = 0; i <= SYNTH_RETRY; i += 1) {
    try {
      return { src: await pluginSynthOnce(text), local: false }
    } catch (e) {
      last = e instanceof Error ? e : new Error(String(e))
      if (i < SYNTH_RETRY) await sleep(SYNTH_RETRY_MS * (i + 1))
    }
  }
  throw last ?? new Error('语音合成失败')
}

/* ---------------- 一路朗读 ---------------- */

/** 同一时刻只允许一路（它占着唯一的音频实例） */
let current: Reader | null = null

interface Reader extends SpeechSession {
  handleInterrupted(): void
}

/**
 * 开始朗读一段正文。返回 null 表示没能开始（两个引擎都用不了 / 没有可读的字）。
 * **新的开始会先把上一路停掉** —— 一个实例只服务一路朗读。
 */
export function startReading(
  text: string,
  handlers: SpeechHandlers,
  opts?: SpeechOptions,
): SpeechSession | null {
  const body = String(text ?? '').trim()
  if (!body) return null

  /* 引擎：远端开关说了算（关掉即整篇回落插件）；服务端在第一段就不通时会自动再落一层 */
  const engine: Engine = useRemoteStore().feature('tts') ? 'server' : 'plugin'
  if (engine === 'plugin' && !speechAvailable()) return null

  const chunks = chunkOf(body, engine)
  if (!chunks.length) return null

  current?.stop()
  const reader = createReader({ body, engine, chunks, voice: opts?.voice ?? DEFAULT_VOICE, handlers })
  current = reader
  if (opts?.rate) reader.setRate(opts.rate)
  reader.resume()
  return reader
}

/** 暂停当前朗读（App 切后台调；没有在朗读时什么也不做） */
export function suspendSpeech(): void {
  current?.pause()
}

function chunkOf(body: string, engine: Engine): string[] {
  return engine === 'plugin'
    ? splitForReading(body, PLUGIN_CHUNK_MAX)
    : splitForReading(body, SERVER_CHUNK_MAX, SERVER_FIRST_CHUNK_MAX)
}

interface ReaderInit {
  body: string
  engine: Engine
  chunks: string[]
  voice: string
  handlers: SpeechHandlers
}

function createReader(init: ReaderInit): Reader {
  let engine = init.engine
  let chunks = init.chunks
  let voice = init.voice
  let index = 0
  let state: SpeechState = 'idle'
  let reason: SpeechFailReason | undefined
  let stopped = false
  /** 已经播完的段数（换引擎重切后仍用它把进度接上，不让进度条往回跳） */
  let playedChars = 0
  /** 当前的音频来源（真暂停 / 续播要用它判断"是不是还是这一段"） */
  let src: SpeechSource | null = null
  /** 这一段是否**已经真的开始播**（用来区分"暂停在播放中"与"暂停在合成中"） */
  let started = false
  /** 下载兜底出来的临时文件：播完/收摊要删掉 */
  let tempFile = ''
  /** 已经试过下载兜底的段号（一段只兜一次，免得死循环） */
  let downloadedAt = -1
  /** 自动回落过引擎没有（只回落一次，避免来回切） */
  let fellBack = false

  const totalChars = (): number => chunks.reduce((n, c) => n + c.length, 0)

  const emit = (next?: SpeechState): void => {
    if (next) state = next
    init.handlers.onState(state, { index, total: chunks.length, reason })
  }

  const cleanTemp = (): void => {
    if (!tempFile) return
    removeFile(tempFile)
    tempFile = ''
  }

  /** 预取后面几段（成功失败都不吵人 —— 真失败会在轮到它播时报出来） */
  const prefetch = (): void => {
    for (let k = index + 1; k <= index + LOOKAHEAD && k < chunks.length; k += 1) {
      void synth(k).catch(() => undefined)
    }
  }

  const synth = (k: number): Promise<SpeechSource> => {
    const text = chunks[k] ?? ''
    return engine === 'server' ? serverSynth(text, voice) : pluginSynth(text)
  }

  /**
   * 这一段落彻底失败了。
   * 服务端引擎在"还没听完第一段"时失败 → **自动回落插件**（从当前这段重新切、接着说）：
   * 这是"后端没部署 / 挂了 / 开关关错"的兜底，用户不该因此听不到声音。
   */
  const fail = (k: number, why: SpeechFailReason): void => {
    if (stopped || index !== k) return
    if (engine === 'server' && !fellBack && playedChars === 0) {
      fellBack = true
      if (speechAvailable()) {
        engine = 'plugin'
        chunks = splitForReading(init.body, PLUGIN_CHUNK_MAX)
        index = 0
        playAt(0)
        return
      }
    }
    reason = why
    emit('error')
  }

  /** 播第 k 段（k 越界 = 读完了） */
  const playAt = (k: number): void => {
    if (stopped) return
    cleanTemp()
    downloadedAt = -1
    if (k > index) playedChars += chunks[index]?.length ?? 0
    index = k
    src = null
    started = false
    if (k >= chunks.length) {
      stopSpeech()
      reason = undefined
      emit('done')
      return
    }
    reason = undefined
    emit('synth')
    void synth(k)
      .then((source) => {
        if (stopped || index !== k) return
        prefetch()
        startPlayback(k, source, false)
      })
      .catch(() => fail(k, 'synth'))
  }

  /** 把一段音频交给播放器（`viaFallback` = 这已经是"本地播不出来、改走网络地址"那次） */
  const startPlayback = (k: number, source: SpeechSource, viaFallback: boolean): void => {
    if (stopped || index !== k) return
    src = source
    /* 用户在我合成这一段期间按了暂停：先把音频攥在手里，等他按「继续」再出声 */
    if (state === 'paused') return
    started = true
    emit('playing')
    playSpeech(source.src, {
      local: source.local,
      onEnded: () => playAt(k + 1),
      onDead: () => {
        /* 本地文件播不出来 → 用它的网络地址再试一次（静修音频那套老办法） */
        if (!viaFallback && source.fallback) {
          startPlayback(k, { src: source.fallback, local: false }, true)
          return
        }
        /* 插件那条路：地址播不出来就先下成临时文件再播 */
        if (!viaFallback && !source.local && downloadedAt !== k) {
          downloadedAt = k
          uni.downloadFile({
            url: source.src,
            success: (res) => {
              const temp = (res as { tempFilePath?: string }).tempFilePath
              if (res.statusCode !== 200 || !temp) {
                fail(k, 'play')
                return
              }
              tempFile = temp
              startPlayback(k, { src: temp, local: true }, true)
            },
            fail: () => fail(k, 'play'),
          })
          return
        }
        fail(k, 'play')
      },
    })
  }

  const reader: Reader = {
    get state() {
      return state
    },
    get engine() {
      return engine
    },
    pause(): void {
      if (stopped) return
      if (state !== 'playing' && state !== 'synth') return
      /* 合成期间按暂停就只是改状态：音频到的时候 startPlayback 会攥住不出声 */
      if (started) pauseSpeech()
      emit('paused')
    },
    resume(): void {
      if (stopped) return
      if (state === 'playing') return
      if (state === 'paused' && src) {
        if (started) resumeSpeech()
        else startPlayback(index, src, false)
        return
      }
      /* 出错后重来（或首次开始）：从**当前这一段**重新合成 */
      playAt(index)
    },
    stop(): void {
      if (stopped) return
      stopped = true
      stopSpeech()
      cleanTemp()
      if (current === reader) current = null
      /* 也让界面回到 idle：页面即使不是"自己按的停止"（被另一路顶掉）也能收干净 */
      emit('idle')
    },
    setRate(rate: number): void {
      setSpeechRate(rate)
    },
    setVoice(next: string): void {
      voice = next
    },
    progress(): SpeechPosition {
      const { current: position, duration } = speechPosition()
      const total = playedChars + totalChars()
      const chunkChars = chunks[index]?.length ?? 0
      const inChunk = duration > 0 ? Math.min(1, position / duration) : 0
      const done = state === 'done' ? total : playedChars + inChunk * chunkChars
      return {
        percent: total > 0 ? Math.min(100, Math.round((done / total) * 100)) : 0,
        position,
        duration,
      }
    },
    /** 实例被外部强停（关声音 / 切后台）—— 变成"已暂停"，用户回来还能接着听 */
    handleInterrupted(): void {
      if (stopped) return
      if (state === 'playing' || state === 'synth') emit('paused')
    },
  }
  return reader
}

/*
 * 挂上"被强停"的通知：utils/audio.ts 在关声音 / suspendAudio 时会回调这里。
 * 放在模块加载时挂一次就够（它是模块级单例）。
 */
setSpeechInterruptHandler(() => current?.handleInterrupted())

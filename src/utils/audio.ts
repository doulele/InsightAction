/**
 * 静修声音播放器（止 · 沙漏 / 茶室 / 呼吸干预 / 止念一刻共用）。
 * ================================================
 *
 * 做五件事：**放一记提示音**、**循环放环境音**、**把音频缓存到本机**、
 * **把实例借给正文朗读（收听）**、**任何一步失败都静默降级** ——
 * 宁可没声音，也不能让计时与入账受影响。
 *
 * ── 为什么全项目只用「一个」innerAudioContext（2026-09-19 修）──
 * 原先环境音与一记**各占一个实例**，真机现象是：只有开场那一记响，
 * 环境音（沙漏走时声 / 茶室五盏）**全程无声**，于是「切哪个走时声都还是那记钟声」
 * （用户报的「中间都没有声音，就有一开的一个钟声」）。
 * 官方文档对「多个 InnerAudioContext 能不能同时出声」**没有任何承诺**：
 * `wx.setInnerAudioOption` 只说明配置对小程序全局生效，而且 `speakerOn` 为 true 时
 * 客户端**强制与其它音频互斥**、多实例并发行为要实测。实践结论是后建的那个实例会被顶掉。
 * 现在**共用一个实例**：
 *   · 一记要响时，先把环境音停掉并记住播到哪儿，放完 seek 回去续上；
 *   · 「先一记、后走时声」这种次序（沙漏开场、茶室开局）直接**排成队列** ——
 *     一记放完自动接上环境音；
 *   · 正文朗读（收听）是第三个借方：它**独占**通道（环境音彻底停掉、一记进不来），
 *     播完一段把实例交还给下一段（见文末「朗读」一节与 utils/speech.ts）。
 * 代价是环境音晚一记的工夫（2–4 秒）才起，换来的是**每次都有声**。
 *
 * ── 本地缓存 + 网络兜底 ──
 * 素材接口是 `Cache-Control: no-store`（服务端明确不缓存），微信不会留任何副本 ——
 * 不缓存的话每播一次就重下一份（环境音 300–600KB）。这里把音频下进
 * `wx.env.USER_DATA_PATH`（私有永久目录），文件名用**地址哈希**（同一文件重下即覆盖，
 * 不在永久目录里堆副本，见 utils/localFile.ts 的说明），于是第二个会话起磁盘直读、零流量。
 *
 * 但**本地路径不等于能播**：官方文档对 `src` 支持本地文件只字未提（只写了网络地址与
 * 云文件 ID），开发者工具里 `http://usr/…` 这类伪路径尤其不靠谱，而且失败时 `onError`
 * 不一定触发（错误码表里没有一条与此对应，静默失败是常态）。所以每次起播都挂一个
 * **看门狗**：1.2 秒查一次 `currentTime`，连查 3 次还停在 0 就换下一条候选 ——
 * 顺序是 **本地路径 → 该文件的网络地址 → 候选链的下一个文件**。
 * 哪一次本地起播失败，本次会话就记住「本地不可播」（`localSuspect`），
 * 之后一律直接走网络地址，省掉那次必输的试错。
 *
 * ── 静默降级的两种粒度 ──
 *  · **一记**完全静默 —— 候选链本来就允许前几个文件不存在（见 config/audio.ts）；
 *  · **环境音**会顺手 toast 一次「这段声音还没到位」—— 那时是用户主动选了它，
 *    没声不解释会被当成坏了。同一个文件只提示一次。
 *
 * 切后台：微信会挂起普通音频。**这里不再主动停**（2026-09-22 改，用户要求切后台不停声）——
 * 系统没挂起就继续响，真断了回前台由 App.onShow 调 resumeAudio() 续上
 * （它会先确认不是还在播，免得叠成两轨）。页面自己不管这事，见 App.vue。
 * **息屏后没有声音是平台限制**，与本项目「息屏时间仍在流」的计时规则并不冲突 ——
 * 计时照走，声音交给系统。
 */

import { audioUrl, CUE_SOURCES, type CueKind, type CueSource } from '@/config/audio'
import { copyToUserDir, extOf, fileExists, userDir } from '@/utils/localFile'

type AudioCtx = ReturnType<typeof uni.createInnerAudioContext>

/** 提示音音量（环境音的音量由 config 逐项给，一律 ≤0.35） */
const CUE_VOLUME = 0.5
/** 朗读音量：正文收听是"内容"，给足（与上面那些氛围音不是一类东西） */
const SPEECH_VOLUME = 1
/** 音量渐变步进：环境音淡入淡出都靠它逐级调 volume（无原生渐变 API） */
const FADE_STEP_MS = 120
/** 环境音淡入 / 淡出时长：避免「啪」地一声起、一声断 */
const AMBIENT_FADE_IN_MS = 900
const AMBIENT_FADE_OUT_MS = 500
/** 提示音淡出（到 maxMs 之后） */
const CUE_FADE_OUT_MS = 400
/** 失败冷却：这段时间内不再碰同一个文件，防止对着坏地址反复打网 */
const FAIL_COOLDOWN_MS = 5 * 60 * 1000
/** 起播看门狗：多久查一次、连查几次没走就判定这条候选播不出来 */
const WATCHDOG_STEP_MS = 1200
const WATCHDOG_TRIES = 3

/** 一个素材的两条来源：本地缓存路径（可能为空）与网络地址 */
interface Source {
  file: string
  /** 私有永久目录里的路径；空串 = 没下下来（可能是 404，也可能是网络 / 域名问题） */
  local: string
  /** 网络地址：本地播不出来时用它流式播放（微信边下边播） */
  online: string
  /** 服务器明确回 404 —— 这个文件就是没有，网络地址也不必试 */
  missing: boolean
}

/** 一次起播的候选：按顺序试，前一条起不来就换后一条 */
interface Attempt {
  file: string
  src: string
  /** 是不是本地路径（起播失败时据此决定要不要记住「本地不可播」） */
  local: boolean
}

/** 想要的一段环境音（切后台回来按它续上；null = 现在不该有环境音） */
interface AmbientWanted {
  files: string[]
  volume: number
}

/* ------------------------------------------------------------------ *
 * 模块状态（全项目只有一个实例）
 * ------------------------------------------------------------------ */

/** 唯一的音频实例（懒创建） */
let ctx: AudioCtx | null = null
/** 用户是否开着声音（关掉后一切静音；由 setSoundEnabled 同步） */
let soundOn = true

/** 用户想要的环境音 */
let ambientWanted: AmbientWanted | null = null
/** 环境音**实际在播**的那条候选（null = 没在播） */
let ambientAttempt: Attempt | null = null
/** 一记正在响：环境音等它放完再起（沙漏开场就是这条路） */
let ambientDeferred = false
/** 这次起环境音要不要「先出声」（没缓存时直接流网络地址，不等下载） */
let ambientImmediate = false
/** 被一记借走实例前，环境音播到哪儿了（放完 seek 回去） */
let ambientPausedAt = 0
let ambientPausedAttempt: Attempt | null = null
/** 一记是否正在响 */
let cueBusy = false

/* ---- 朗读（收听）占着实例时的状态：见文末「朗读」一节 ---- */
/** 朗读正在用这个实例 */
let speechBusy = false
/** 这一段朗读放完了要做什么（由 utils/speech.ts 给） */
let onSpeechEnded: (() => void) | null = null
/** 实例被外部强制停掉（关声音 / 切后台）时通知朗读器，让它把界面改成"已暂停" */
let onSpeechInterrupted: (() => void) | null = null

/** 当前这次起播失败时该做什么（onError 与看门狗都走它） */
let onDead: (() => void) | null = null
/** 当前这条候选是不是本地路径 */
let currentLocal = false
/** 起播令牌：异步解析回来时若已换曲 / 已停，就当这次没发生 */
let playToken = 0
/** 环境音令牌：换曲 / 停止会让在途的解析作废 */
let ambientToken = 0

/** 定时器：音量渐变 / 一记到点淡出 / 起播看门狗（各自只有一个） */
let fadeTimer: ReturnType<typeof setInterval> | null = null
let cueTimer: ReturnType<typeof setTimeout> | null = null
let watchdog: ReturnType<typeof setTimeout> | null = null

/** 本次会话里本地路径起播失败过 → 之后一律直接走网络地址 */
let localSuspect = false

/** 正在下载的地址 → Promise（同一个文件不并发下两次） */
const inflight = new Map<string, Promise<Source>>()
/** 下载失败的时间戳 */
const failedAt = new Map<string, number>()
/** 服务器明确回 404 的文件（候选链首常是待补素材，记住就别再试） */
const missingFiles = new Set<string>()
/** 已解析成功的一记（文件 + 来源），避免每次都从链头试一遍 */
const cueResolved = new Map<CueKind, { source: CueSource; src: Source }>()
/** 已经 toast 过「声音没到位」的文件 */
const warned = new Set<string>()

/* ------------------------------------------------------------------ *
 * 对外开关
 * ------------------------------------------------------------------ */

/**
 * 初始化播放选项（App.onLaunch 调一次）。
 *
 * `obeyMuteSwitch: true` = 跟随系统静音键（用户按了静音就该真的静）；
 * `mixWithOther: false` = 不与其他音频混（静修场景叠上别处的音乐只会互相糟蹋）。
 */
export function initAudioOption(): void {
  const api = uni as unknown as { setInnerAudioOption?: (o: Record<string, unknown>) => void }
  try {
    api.setInnerAudioOption?.({ obeyMuteSwitch: true, mixWithOther: false })
  } catch {
    /* 老基础库没有这个接口，随它去 */
  }
}

/** 总开关（设置页的「静修声音」）：关掉立即停声，且之后一切播放请求直接返回 */
export function setSoundEnabled(on: boolean): void {
  soundOn = on
  if (!on) {
    ambientWanted = null
    silentStop()
  }
}

/* ------------------------------------------------------------------ *
 * 缓存：地址 → 私有永久目录里的本地文件
 * ------------------------------------------------------------------ */

/** 文件名哈希（djb2）：同一个素材永远是同一个本地文件名，重下即覆盖 */
function hashOf(file: string): string {
  let h = 5381
  for (let i = 0; i < file.length; i += 1) h = (h * 33 + file.charCodeAt(i)) >>> 0
  return h.toString(36)
}

/** 该素材在私有永久目录里的路径（环境不支持时返回空串） */
function localPathOf(file: string): string {
  const dir = userDir()
  return dir ? `${dir}/gz-audio-${hashOf(file)}.${extOf(file)}` : ''
}

/**
 * 拿到一个素材的两条来源：本地路径（能命中就秒回）+ 网络地址。
 *
 * 下不动时**不放弃**：返回 `local: ''` 但把 `online` 带上 —— 下载被拦（域名白名单 /
 * 无网）不代表流式播放也不行，让播放器去试。
 *
 * @param warn 失败时是否 toast 一次「声音还没到位」（一记传 false，保持全静默）
 */
function ensureSource(file: string, warn: boolean): Promise<Source> {
  const online = audioUrl(file)
  const running = inflight.get(file)
  if (running) return running

  const path = localPathOf(file)
  if (path && fileExists(path)) return Promise.resolve({ file, local: path, online, missing: false })

  const lastFail = failedAt.get(file)
  if (lastFail && Date.now() - lastFail < FAIL_COOLDOWN_MS) {
    return Promise.resolve({ file, local: '', online, missing: missingFiles.has(file) })
  }

  const task = download(file, warn)
  inflight.set(file, task)
  return task
}

/** 真正下文件：临时文件必须搬进永久目录，否则下次会话就没了 */
function download(file: string, warn: boolean): Promise<Source> {
  const online = audioUrl(file)
  return new Promise<Source>((resolve) => {
    let settled = false
    const finish = (value: Source): void => {
      if (settled) return
      settled = true
      inflight.delete(file)
      resolve(value)
    }
    const giveUp = (): void => {
      failedAt.set(file, Date.now())
      if (warn) warnMissing(file)
      finish({ file, local: '', online, missing: false })
    }

    uni.downloadFile({
      url: online,
      success: (res) => {
        /* 404 = 服务器就没有这个文件（待补素材）：记下来，别让它反复进候选 */
        if (res.statusCode === 404) {
          missingFiles.add(file)
          failedAt.set(file, Date.now())
          finish({ file, local: '', online, missing: true })
          return
        }
        const temp = (res as { tempFilePath?: string }).tempFilePath
        if (res.statusCode !== 200 || !temp) return giveUp()
        const local = copyToUserDir(temp, `gz-audio-${hashOf(file)}.${extOf(file)}`) || temp
        failedAt.delete(file)
        finish({ file, local, online, missing: false })
      },
      fail: giveUp,
    })
  })
}

/** 「这段声音还没到位」：同一个文件只提示一次（随后靠 5 分钟冷却静默） */
function warnMissing(file: string): void {
  if (warned.has(file)) return
  warned.add(file)
  uni.showToast({ title: '这段声音还没到位 · 其余照常', icon: 'none' })
}

/* ------------------------------------------------------------------ *
 * 候选链：把文件名链解析成「可试的候选表」
 * ------------------------------------------------------------------ */

/**
 * 沿候选链解析来源：**跳过 404 的，保留下不动的**。
 *
 * 为什么保留下不动的：下载失败（域名白名单 / 无网）与「文件不存在」是两件事 ——
 * 后者网络地址也没用（跳过），前者流式播放可能仍然出声（留着试）。
 */
async function resolveChain(files: string[]): Promise<Attempt[]> {
  const list: Attempt[] = []
  for (const file of files) {
    if (missingFiles.has(file)) continue
    const source = await ensureSource(file, false)
    if (source.missing) continue
    list.push(...attemptsOf(source))
  }
  return list
}

/** 一个来源 → 候选表（本地优先；已知本地不可播就直接只留网络地址） */
function attemptsOf(source: Source): Attempt[] {
  const list: Attempt[] = []
  if (source.local && !localSuspect) list.push({ file: source.file, src: source.local, local: true })
  list.push({ file: source.file, src: source.online, local: false })
  return list
}

/**
 * 候选表取第 i 条，但在**已经知道"本地起播不了"**时跳过本地项。
 *
 * 为什么要跳过：候选表是起播前一次性铺好的，表里可能有好几条本地项（每个文件一条）；
 * 第一条本地项失败（看门狗/onError）之后 `localSuspect` 就置位了，剩下的本地项再试必输 ——
 * 而每次试错都要白等看门狗（最多 3.6 秒），必须当场跳过。
 */
function pickAttempt(list: Attempt[], i: number): number {
  if (!localSuspect) return i
  let j = i
  while (j < list.length && list[j].local) j += 1
  return j
}

/* ------------------------------------------------------------------ *
 * 起播：设源 → play → 看门狗
 * ------------------------------------------------------------------ */

function ensureCtx(): AudioCtx {
  if (ctx) return ctx
  const c = uni.createInnerAudioContext()
  c.volume = 0
  /* 起播失败的第一条兜底：换下一条候选（看门狗管"没报错但也没声"的那种） */
  c.onError(() => onPlayDead())
  /*
   * 自然播完：只有朗读会用到它（环境音是 loop、一记靠 maxMs 计时截断）。
   * 一记提前播完（音频比 maxMs 短）时 speechBusy 为假，这里什么也不做。
   */
  c.onEnded(() => {
    if (speechBusy) onSpeechFinish()
  })
  ctx = c
  return ctx
}

/** 当前这条候选播不出来（onError 或看门狗判定）：换下一条，只触发一次 */
function onPlayDead(): void {
  const cb = onDead
  onDead = null
  if (cb) cb()
}

/**
 * 起播一条候选，并挂上看门狗。
 *
 * 音量一律从 0 起（由调用方随后 `fadeTo` 到目标值），这样换候选时不会有"啪"的一声；
 * 一记直接把音量给到 `volume`（它不需要淡入，淡出在到点时做）。
 */
function playAttempt(
  a: Attempt,
  opts: { loop: boolean; startTime?: number; rate?: number; volume?: number; onDead: () => void },
): void {
  const c = ensureCtx()
  const token = ++playToken
  clearWatchdog()
  clearCueTimer()
  clearFade()
  currentLocal = a.local
  onDead = opts.onDead
  try {
    c.stop()
    c.loop = opts.loop
    c.src = a.src
    c.startTime = opts.startTime ?? 0
    c.playbackRate = opts.rate ?? 1
    c.volume = opts.volume ?? 0
    c.play()
  } catch {
    onPlayDead()
    return
  }
  armWatchdog(c, token)
}

/**
 * 看门狗：本地路径可能「设了源、play 了，但一声不出」而且 onError 不触发。
 *
 * 判据只看 `currentTime` 有没有在走（**判断不了"这一秒静不静"**）——
 * 所以环境音一律挑连续型录音，见 config/audio.ts 第 4 条。
 */
function armWatchdog(c: AudioCtx, token: number): void {
  let ticks = 0
  const tick = (): void => {
    watchdog = null
    if (token !== playToken) return
    if (Number(c.currentTime) > 0.05) return
    ticks += 1
    if (ticks >= WATCHDOG_TRIES) {
      /* 连查三次都没走：本地路径嫌疑最大，先记下来再换候选 */
      if (currentLocal) localSuspect = true
      onPlayDead()
      return
    }
    watchdog = setTimeout(tick, WATCHDOG_STEP_MS)
  }
  watchdog = setTimeout(tick, WATCHDOG_STEP_MS)
}

function clearWatchdog(): void {
  if (watchdog) {
    clearTimeout(watchdog)
    watchdog = null
  }
}

function clearCueTimer(): void {
  if (cueTimer) {
    clearTimeout(cueTimer)
    cueTimer = null
  }
}

/* ------------------------------------------------------------------ *
 * 音量渐变（小程序没有原生渐变，只能自己逐级调 volume）
 * ------------------------------------------------------------------ */

function clearFade(): void {
  if (fadeTimer) {
    clearInterval(fadeTimer)
    fadeTimer = null
  }
}

function fadeTo(target: number, ms: number, done?: () => void): void {
  clearFade()
  const c = ctx
  if (!c) {
    done?.()
    return
  }
  const from = Number(c.volume) || 0
  const steps = Math.max(1, Math.round(ms / FADE_STEP_MS))
  let i = 0
  fadeTimer = setInterval(() => {
    i += 1
    const v = from + (target - from) * (i / steps)
    try {
      c.volume = Math.max(0, Math.min(1, v))
    } catch {
      /* 设置音量失败不影响进度 */
    }
    if (i >= steps) {
      clearFade()
      done?.()
    }
  }, FADE_STEP_MS)
}

/* ------------------------------------------------------------------ *
 * 环境音（循环）
 * ------------------------------------------------------------------ */

/**
 * 起一段环境音（换曲直接再调一次即可，内部会先把旧的停掉）。
 *
 * `files` 是**候选链**（见 config/audio.ts）：链首是理想素材，缺了往右回落 ——
 * 目录里还没有「走时声」这一类别，所以「滴答」现在实际播的是现成的雨声。
 *
 * 默认**等本地**：素材首次要下 300–600KB（秒级）。能预热的页面（沙漏）进页面就下好，
 * 真正开始时是本地直读、零延迟；预热不了的地方（茶室随手点的那盏）传 `immediate: true` ——
 * 先流网络地址立刻出声（微信边下边播），同时把文件缓存好留给下次。
 *
 * 环境音不能自动播放，必须由用户操作触发 —— 这里的调用点都在「开始」按钮或选项点击之后，
 * 天然满足。
 */
export function startAmbient(files: string[], volume: number, opts?: { immediate?: boolean }): void {
  const chain = files.filter(Boolean)
  ambientToken += 1
  ambientAttempt = null
  ambientPausedAttempt = null
  ambientPausedAt = 0
  ambientDeferred = false
  ambientImmediate = !!opts?.immediate

  /* 一记正在响：不抢实例，记下"该起环境音"，等它放完自动接上（茶室开局就是这条） */
  if (cueBusy) {
    ambientWanted = chain.length && soundOn ? { files: chain, volume } : null
    ambientDeferred = !!ambientWanted
    return
  }

  const wanted: AmbientWanted | null = chain.length && soundOn ? { files: chain, volume } : null
  ambientWanted = wanted
  if (!wanted) {
    stopPlaying()
    return
  }
  /* 换曲：先把正在响的淡出停掉（若新的很快就解析好，这次停会被跳过，不留空档） */
  stopPlaying()
  beginAmbient(wanted, ambientToken)
}

/** 真正起环境音（先出声 / 等本地两条路，由 ambientImmediate 决定） */
function beginAmbient(wanted: AmbientWanted, token: number): void {
  const immediate = ambientImmediate
  ambientImmediate = false
  /*
   * 先出声模式：本地还没缓存时，直接流网络地址（微信边下边播），
   * 同时把文件下到本地留给下次。**不切源** —— 中途换成本地会把正在响的声音打断。
   */
  if (immediate) {
    const head = wanted.files[0]
    const cached = localPathOf(head)
    if (!missingFiles.has(head) && !(cached && fileExists(cached))) {
      void ensureSource(head, false)
      ambientAttempt = { file: head, src: audioUrl(head), local: false }
      playAttempt(ambientAttempt, {
        loop: true,
        onDead: () => {
          /* 这条不响 → 老老实实走候选链 */
          if (token === ambientToken) playChain(wanted, token)
        },
      })
      fadeTo(wanted.volume, AMBIENT_FADE_IN_MS)
      return
    }
  }
  playChain(wanted, token)
}

/** 按候选链起环境音（本地优先；异步解析回来时若已换曲 / 已停就作废） */
function playChain(wanted: AmbientWanted, token: number): void {
  void resolveChain(wanted.files).then((list) => {
    if (token !== ambientToken || !soundOn || !ambientWanted) return
    runAmbient(list, 0, wanted, token)
  })
}

/** 挨个试候选：本地 → 网络地址 → 链上下一个文件 */
function runAmbient(list: Attempt[], i: number, wanted: AmbientWanted, token: number): void {
  if (token !== ambientToken || !soundOn || !ambientWanted) return
  const at = pickAttempt(list, i)
  const a = list[at]
  if (!a) {
    /* 整条链都不行：用户是主动选的它，给一次解释（同一个文件只提示一次） */
    warnMissing(wanted.files[0])
    return
  }
  ambientAttempt = a
  ambientPausedAttempt = null
  ambientPausedAt = 0
  playAttempt(a, {
    loop: true,
    onDead: () => runAmbient(list, at + 1, wanted, token),
  })
  fadeTo(wanted.volume, AMBIENT_FADE_IN_MS)
}

/** 停掉正在响的环境音（淡出后停；不留记录） */
function stopPlaying(): void {
  ambientAttempt = null
  ambientPausedAttempt = null
  ambientPausedAt = 0
  const c = ctx
  if (!c) return
  playToken += 1
  onDead = null
  clearWatchdog()
  fadeTo(0, AMBIENT_FADE_OUT_MS, () => {
    if (ambientAttempt || cueBusy) return
    try {
      c.stop()
    } catch {
      /* 忽略 */
    }
  })
}

/** 停环境音（页面调：点「静」、收功、中途退出） */
export function stopAmbient(): void {
  ambientToken += 1
  ambientWanted = null
  ambientDeferred = false
  ambientImmediate = false
  stopPlaying()
}

/**
 * 立即停干净（不等淡出、不留记录）：切后台 / 关声音 / 离页走它。
 * 用 stopAmbient 会连带把"该有什么环境音"的记忆清掉，那几处都要留着，所以分开。
 */
function silentStop(): void {
  playToken += 1
  onDead = null
  clearWatchdog()
  clearCueTimer()
  clearFade()
  ambientAttempt = null
  ambientPausedAttempt = null
  ambientPausedAt = 0
  ambientDeferred = false
  cueBusy = false
  ambientImmediate = false
  /* 朗读也被强停了：通知朗读器把界面改成"已暂停"（否则那条收听条会一直显示"正在朗读"） */
  const interrupted = speechBusy
  speechBusy = false
  onSpeechEnded = null
  const c = ctx
  if (c) {
    try {
      c.stop()
    } catch {
      /* 忽略 */
    }
  }
  if (interrupted) onSpeechInterrupted?.()
}

/* ------------------------------------------------------------------ *
 * 朗读（收听）—— 把实例借给 utils/speech.ts
 * ------------------------------------------------------------------ */

/**
 * 借实例播一段朗读音频（正文收听的一段）。
 *
 * 为什么朗读也要挤这一个实例：见文件头 —— 平台对"多个实例同时出声"没有任何承诺，
 * 真机上就是**后来者被顶掉**。所以朗读**独占**音频通道：
 *  · 先把环境音彻底停掉，连"该有什么环境音"的记录一并清空（朗读可能持续十几分钟，
 *    读完再把沙漏那场雨续上只会莫名其妙）；
 *  · 一记也进不来（cueBusy）—— 朗读中不该突然响一声磬；
 *  · 一段放完由 `onEnded` 通知调用方，它接着来放下一段（`onDead` 则是"这一片播不出来"）。
 *
 * 音量给足 1.0：朗读是用户主动要听的内容，不是背景氛围（环境音一律 ≤0.35）。
 * **不看 soundOn**（设置页的「静修声音」）：那个开关管的是静修场景的声效，
 * 而"听"是用户当场按下的一次明确播放请求。
 */
export function playSpeech(
  src: string,
  opts: {
    volume?: number
    /** 倍速（播放端变速，不重新合成） */
    rate?: number
    /** src 是不是本机文件 —— 看门狗据此判断要不要记「本地不可播」 */
    local?: boolean
    onEnded: () => void
    onDead: () => void
  },
): void {
  ambientToken += 1
  ambientWanted = null
  ambientDeferred = false
  ambientPausedAttempt = null
  ambientPausedAt = 0
  ambientAttempt = null
  cueBusy = true
  speechBusy = true
  onSpeechEnded = opts.onEnded
  playAttempt(
    { file: 'speech', src, local: !!opts.local },
    {
      loop: false,
      rate: opts.rate ?? 1,
      volume: opts.volume ?? SPEECH_VOLUME,
      onDead: () => {
        if (!speechBusy) return
        speechBusy = false
        onSpeechEnded = null
        /* 不动 cueBusy：这一段失败了，但朗读还没结束，实例仍归朗读（调用方会决定重试还是收摊） */
        playToken += 1
        onDead = null
        clearWatchdog()
        opts.onDead()
      },
    },
  )
}

/** 暂停朗读：**停在当前位置**（同一段音频 `pause()`），不是"这一段重头再来" */
export function pauseSpeech(): void {
  if (!speechBusy || !ctx) return
  /*
   * 先把看门狗撤掉：暂停期间 currentTime 不走，3 次查岗就会把它误判成"这段播不出来"。
   * 续播时不重新挂 —— 已经出声过的音频不存在"起播失败"那类问题。
   */
  clearWatchdog()
  try {
    ctx.pause()
  } catch {
    /* 忽略 */
  }
}

/** 继续朗读（接着暂停的位置放） */
export function resumeSpeech(): void {
  if (!speechBusy || !ctx) return
  try {
    ctx.play()
  } catch {
    /* 忽略 */
  }
}

/** 换倍速（立即生效；正在播的段也跟着变） */
export function setSpeechRate(rate: number): void {
  if (!ctx) return
  try {
    ctx.playbackRate = rate > 0 ? rate : 1
  } catch {
    /* 忽略 */
  }
}

/**
 * 朗读进度：本段播到第几秒 / 这一段共几秒（页面每 250ms 读一次画进度条）。
 * 不是朗读时返回 0 / 0（页面据此不画进度）。
 */
export function speechPosition(): { current: number; duration: number } {
  if (!speechBusy || !ctx) return { current: 0, duration: 0 }
  return {
    current: Number(ctx.currentTime) || 0,
    duration: Number(ctx.duration) || 0,
  }
}

/**
 * 一段朗读自然播完：把实例交还（`endCue` 里那一套收尾：停声、清计时器），
 * **再**通知调用方 —— 次序反过来的话，调用方在回调里立刻起下一段会和这里的收尾打架。
 */
function onSpeechFinish(): void {
  speechBusy = false
  const cb = onSpeechEnded
  onSpeechEnded = null
  endCue()
  cb?.()
}

/** 停掉朗读播放（用户按「停止/暂停」、离页）—— 不留"该有什么环境音"的记录，不会自己续上 */
export function stopSpeech(): void {
  if (!speechBusy) return
  speechBusy = false
  onSpeechEnded = null
  endCue()
}

/**
 * 注册"朗读被外部强停"的通知（关声音、或音频被强停时触发）。
 * 由 utils/speech.ts 在模块加载时挂一次 —— 它据此把收听条从"正在朗读"改成"已暂停"。
 */
export function setSpeechInterruptHandler(cb: () => void): void {
  onSpeechInterrupted = cb
}

/* ------------------------------------------------------------------ *
 * 一记（提示音）
 * ------------------------------------------------------------------ */

/** 沿一记的候选链解析出可播的那个（404 的跳过，下不动的留着走网络地址） */
async function resolveCue(kind: CueKind): Promise<{ source: CueSource; src: Source } | null> {
  for (const source of CUE_SOURCES[kind]) {
    if (missingFiles.has(source.file)) continue
    const src = await ensureSource(source.file, false)
    if (src.missing) continue
    return { source, src }
  }
  return null
}

/**
 * 放一记（开始 / 结束 / 吸·屏·呼 / 落定）。
 *
 * 环境音正在响的话先让它让位：记住播到哪儿，放完 seek 回去续上 ——
 * 同一个实例不能同时响两个（见文件头）。
 */
export function playCue(kind: CueKind): void {
  if (!soundOn) return
  const hit = cueResolved.get(kind)
  if (hit) {
    fireCue(hit.source, hit.src)
    return
  }
  void resolveCue(kind).then((found) => {
    if (!found) return
    cueResolved.set(kind, found)
    if (soundOn) fireCue(found.source, found.src)
  })
}

function fireCue(source: CueSource, src: Source): void {
  const c = ensureCtx()
  if (ambientAttempt) {
    ambientPausedAttempt = ambientAttempt
    ambientPausedAt = Number(c.currentTime) || 0
    ambientAttempt = null
    playToken += 1
    onDead = null
    clearWatchdog()
  }
  cueBusy = true
  runCue(attemptsOf(src), 0, source)
}

/** 挨个试一记的候选（本地 → 网络地址 → 文件不存在就到此为止） */
function runCue(list: Attempt[], i: number, source: CueSource): void {
  const at = pickAttempt(list, i)
  const a = list[at]
  if (!a) {
    endCue()
    return
  }
  playAttempt(a, {
    loop: false,
    startTime: source.startTime ?? 0,
    rate: source.rate ?? 1,
    volume: CUE_VOLUME,
    onDead: () => runCue(list, at + 1, source),
  })
  clearCueTimer()
  cueTimer = setTimeout(() => {
    cueTimer = null
    fadeTo(0, CUE_FADE_OUT_MS, () => endCue())
  }, source.maxMs ?? 3000)
}

/** 一记放完（或候选全试完）：把实例让回给环境音 */
function endCue(): void {
  cueBusy = false
  playToken += 1
  onDead = null
  clearWatchdog()
  clearCueTimer()
  clearFade()
  const c = ctx
  if (c) {
    try {
      c.stop()
    } catch {
      /* 忽略 */
    }
  }

  const wanted = ambientWanted
  if (!soundOn || !wanted) return

  /* 沙漏开场 / 茶室开局：一记放完才该起环境音 */
  if (ambientDeferred) {
    ambientDeferred = false
    beginAmbient(wanted, ambientToken)
    return
  }

  /* 一记借用过实例：从原位置续上 */
  const a = ambientPausedAttempt
  if (!a) return
  ambientPausedAttempt = null
  const at = ambientPausedAt
  ambientPausedAt = 0
  ambientAttempt = a
  playAttempt(a, {
    loop: true,
    startTime: at,
    onDead: () => playChain(wanted, ambientToken),
  })
  fadeTo(wanted.volume, AMBIENT_FADE_IN_MS)
}

/**
 * 预热一记：进页面就下好，点「开始」时立刻有声（否则第一次要等下载）。
 * 也顺手把候选链定下来，后续 playCue 不再试前面的缺失文件。
 */
export function prefetchCue(kind: CueKind): void {
  if (!soundOn || cueResolved.has(kind)) return
  void resolveCue(kind).then((found) => {
    if (found) cueResolved.set(kind, found)
  })
}

/** 预热环境音（进页面时调；选中的是「静」就别调）—— 走候选链，能备哪个就备哪个 */
export function prefetchAmbient(files: string[]): void {
  if (!soundOn || !files.length) return
  void resolveChain(files)
}

/* ------------------------------------------------------------------ *
 * 生命周期
 * ------------------------------------------------------------------ */

/**
 * 回前台（App.onShow）：按记录续上环境音（一记不重放）。
 *
 * 2026-09-22 两处变化：
 *  1. **切后台不再主动停声** —— 原先 App.onHide 会调 suspendAudio() 收干净再回前台重起，
 *     等于"切出去声音就断了"。用户要求切后台不停计时也不停声音，那一层已去掉；
 *     计时三处（沙漏 / 茶室 / 呼吸暂停）本来就按墙上时间走，声音交给系统。
 *  2. 因此这里要先确认"**不是还在播**"才续 —— 部分机型切后台并不挂起音频，
 *     不看这一眼就会重新起一轨，两轨环境音叠着响。
 */
export function resumeAudio(): void {
  const wanted = ambientWanted
  if (!soundOn || !wanted) return
  if (ctx && !ctx.paused) return
  ambientDeferred = false
  playChain(wanted, ambientToken)
}

/** 离页（页面 onUnload）：立即停干净，不等淡出 */
export function teardownAudio(): void {
  ambientToken += 1
  ambientWanted = null
  silentStop()
}

/**
 * 静修声音播放器（止 · 沙漏 / 茶室 / 呼吸干预共用）。
 * ================================================
 *
 * 做四件事：**放一记提示音**、**循环放环境音**、**把音频缓存到本机**、
 * **任何一步失败都静默降级** —— 宁可没声音，也不能让计时与入账受影响。
 *
 * 为什么必须自己缓存：素材接口是 `Cache-Control: no-store`（服务端明确不缓存），
 * 微信不会留任何副本 —— 不缓存的话每播一次就重下一份（环境音 300–600KB）。
 * 这里把音频下进 `wx.env.USER_DATA_PATH`（私有永久目录），文件名用**地址哈希**
 * （同一文件重下即覆盖，不在永久目录里堆副本，见 utils/localFile.ts 的说明），
 * 于是第二个会话起磁盘直读、零流量。
 *
 * 两个 innerAudioContext（环境音一个、提示音一个）：提示音不能打断正在循环的环境音。
 *
 * 失败即静默，但有两种粒度：
 *  · **提示音**完全静默 —— 候选链本来就允许前几个文件不存在（见 config/audio.ts）；
 *  · **环境音**会顺手 toast 一次「这段声音还没到位」—— 那时是用户主动选了它，
 *    没声不解释会被当成坏了。同一个文件只提示一次。
 *
 * 切后台：微信会挂起普通音频，这里在 App 的 onHide 主动停、onShow 按记录续上
 * （页面自己不管这事，见 App.vue）。**息屏后没有声音是平台限制**，
 * 与本项目「息屏时间仍在流」的计时规则并不冲突 —— 计时照走，只是没声。
 */

import { audioUrl, CUE_SOURCES, type CueKind, type CueSource } from '@/config/audio'
import { copyToUserDir, extOf, fileExists, userDir } from '@/utils/localFile'

type AudioCtx = ReturnType<typeof uni.createInnerAudioContext>

/** 提示音音量（环境音的音量由 config 逐项给，一律 ≤0.35） */
const CUE_VOLUME = 0.5
/** 音量渐变步进：环境音淡入淡出都靠它逐级调 volume（无原生渐变 API） */
const FADE_STEP_MS = 120
/** 环境音淡入 / 淡出时长：避免「啪」地一声起、一声断 */
const AMBIENT_FADE_IN_MS = 900
const AMBIENT_FADE_OUT_MS = 500
/** 提示音淡出（到 maxMs 之后） */
const CUE_FADE_OUT_MS = 400
/** 失败冷却：这段时间内不再碰同一个文件，防止对着坏地址反复打网 */
const FAIL_COOLDOWN_MS = 5 * 60 * 1000

let ambient: AudioCtx | null = null
let cue: AudioCtx | null = null

/** 每个 ctx 上的渐变定时器（再起渐变时先清旧的） */
const fades = new Map<AudioCtx, ReturnType<typeof setInterval>>()
/** 提示音的「到点淡出」定时器 */
let cueStopTimer: ReturnType<typeof setTimeout> | null = null

/** 当前环境音（切后台后回前台要按它续上；null = 现在不该有环境音） */
let ambientCurrent: { files: string[]; volume: number } | null = null
/** 当前**实际在播**的文件名（onError 时据此决定是"换地址"还是"换候选"） */
let ambientPlaying = ''
/** 换曲令牌：异步下载回来时若已换曲 / 已停，就当这次没发生 */
let ambientToken = 0
/** 本地文件播不出来时，是否已经回落过网络地址（只回落一次，防循环） */
let ambientFallbackUsed = false
let cueFallbackUsed = false
/** 正在播的提示音种类（onError 回落网络地址时要知道播的是哪一个） */
let cueNowKind: CueKind = 'open'

/** 正在下载的地址 → Promise（同一个文件不并发下两次） */
const inflight = new Map<string, Promise<string>>()
/** 下载失败的时间戳 */
const failedAt = new Map<string, number>()
/** 已解析成功的提示音（文件 + 本地路径），避免每次都从链头试一遍 */
const cueSrc = new Map<CueKind, { source: CueSource; src: string }>()
/** 已经 toast 过「声音没到位」的文件 */
const warned = new Set<string>()

/** 用户是否开着声音（关掉后一切静音；由 setSoundEnabled 同步） */
let soundOn = true

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
    stopAmbient()
    stopCue()
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
 * 拿到可直接播放的本地路径：命中缓存秒回；否则下载、搬进永久目录。
 *
 * @param warn 失败时是否 toast 一次「声音还没到位」（提示音传 false，保持全静默）
 */
function ensureLocal(file: string, warn: boolean): Promise<string> {
  const running = inflight.get(file)
  if (running) return running

  const path = localPathOf(file)
  if (path && fileExists(path)) return Promise.resolve(path)

  const lastFail = failedAt.get(file)
  if (lastFail && Date.now() - lastFail < FAIL_COOLDOWN_MS) return Promise.resolve('')

  const task = download(file, warn)
  inflight.set(file, task)
  return task
}

/** 真正下文件：临时文件必须搬进永久目录，否则下次会话就没了 */
function download(file: string, warn: boolean): Promise<string> {
  return new Promise<string>((resolve) => {
    let settled = false
    const finish = (value: string): void => {
      if (settled) return
      settled = true
      inflight.delete(file)
      resolve(value)
    }
    const giveUp = (): void => {
      failedAt.set(file, Date.now())
      if (warn) warnMissing(file)
      finish('')
    }

    uni.downloadFile({
      url: audioUrl(file),
      success: (res) => {
        const temp = (res as { tempFilePath?: string }).tempFilePath
        if (res.statusCode !== 200 || !temp) return giveUp()
        const local = copyToUserDir(temp, `gz-audio-${hashOf(file)}.${extOf(file)}`) || temp
        failedAt.delete(file)
        finish(local)
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
 * 音量渐变（小程序没有原生渐变，只能自己逐级调 volume）
 * ------------------------------------------------------------------ */

function clearFade(ctx: AudioCtx): void {
  const timer = fades.get(ctx)
  if (timer) {
    clearInterval(timer)
    fades.delete(ctx)
  }
}

function fadeTo(ctx: AudioCtx, target: number, ms: number, done?: () => void): void {
  clearFade(ctx)
  const from = Number(ctx.volume) || 0
  const steps = Math.max(1, Math.round(ms / FADE_STEP_MS))
  let i = 0
  const timer = setInterval(() => {
    i += 1
    const v = from + (target - from) * (i / steps)
    try {
      ctx.volume = Math.max(0, Math.min(1, v))
    } catch {
      /* 设置音量失败不影响进度 */
    }
    if (i >= steps) {
      clearFade(ctx)
      done?.()
    }
  }, FADE_STEP_MS)
  fades.set(ctx, timer)
}

/* ------------------------------------------------------------------ *
 * 环境音（循环）
 * ------------------------------------------------------------------ */

function ensureAmbientCtx(): AudioCtx {
  if (ambient) return ambient
  const ctx = uni.createInnerAudioContext()
  ctx.loop = true
  ctx.volume = 0
  /*
   * 播不出来时两段兜底（最差就是没声音，绝不影响静修）：
   *  ① **同一个文件改播网络地址**（只试一次）—— 本地路径偶发播不出，
   *     开发者工具里 `http://usr/…` 这类伪路径就会，真机 `wxfile://usr/…` 正常；
   *  ② 还不行就**候选链往后走一个** —— 链首常常是还没上传的素材（「时钟滴答」），
   *     404 时自动换用现成的那个（「雨打屋顶」）。
   */
  ctx.onError(() => {
    const cur = ambientCurrent
    if (!cur || !cur.files.length) return
    if (!ambientFallbackUsed) {
      ambientFallbackUsed = true
      ctx.src = audioUrl(ambientPlaying || cur.files[0])
      try {
        ctx.play()
      } catch {
        /* 真播不了就安静着 */
      }
      return
    }
    const idx = cur.files.indexOf(ambientPlaying)
    const next = cur.files[idx + 1]
    if (!next) return
    ambientPlaying = next
    ctx.src = audioUrl(next)
    try {
      ctx.play()
    } catch {
      /* 真播不了就安静着 */
    }
  })
  ambient = ctx
  return ctx
}

/**
 * 起一段环境音（换曲直接再调一次即可，内部会先把旧的淡出）。
 *
 * `files` 是**候选链**（见 config/audio.ts）：链首是理想素材，缺了往右回落 ——
 * 目录里还没有「走时声」这一类别，所以「滴答」现在实际播的是现成的雨声。
 *
 * 默认**等本地**：素材首次要下 300–600KB（秒级）。能预热的页面（沙漏）进页面就下好，
 * 真正开始时是本地直读、零延迟；预热不了的地方（茶室随手点的那盏）传 `immediate: true` ——
 * 先播网络地址立刻出声（微信边下边播），同时把文件缓存好留给下次。
 * 代价是**那一次会多下一份**，换「点下去就有声」，只在首次使用该素材时发生。
 *
 * 环境音不能自动播放，必须由用户操作触发 —— 这里的调用点都在「开始」按钮或选项点击之后，
 * 天然满足。
 */
export function startAmbient(files: string[], volume: number, opts?: { immediate?: boolean }): void {
  stopAmbient()
  const chain = files.filter(Boolean)
  if (!soundOn || !chain.length) return

  ambientCurrent = { files: chain, volume }
  ambientPlaying = chain[0]
  const token = ++ambientToken
  ambientFallbackUsed = false

  if (opts?.immediate) {
    const ctx = ensureAmbientCtx()
    /*
     * 先出声（不等下载）。回落标记直接置位：这一轮播的就是网络地址，
     * 「同文件改播网络地址」那一步没意义，出错时应当直接换下一个候选。
     */
    ambientFallbackUsed = true
    ctx.src = audioUrl(chain[0])
    ctx.loop = true
    ctx.volume = 0
    try {
      ctx.play()
    } catch {
      /* 忽略：拿不到声音不该影响静修 */
    }
    fadeTo(ctx, volume, AMBIENT_FADE_IN_MS)
    /* 只缓存、不切源 —— 中途换成本地文件会把正在响的声音打断 */
    void resolveAmbientFirst(chain, true)
    return
  }

  void resolveAmbientFirst(chain, true).then((hit) => {
    if (!hit || token !== ambientToken || !soundOn) return
    ambientPlaying = hit.file
    const ctx = ensureAmbientCtx()
    ctx.src = hit.src
    ctx.loop = true
    ctx.volume = 0
    try {
      ctx.play()
    } catch {
      /* 忽略：拿不到声音不该影响静修 */
    }
    fadeTo(ctx, volume, AMBIENT_FADE_IN_MS)
  })
}

/**
 * 沿候选链找到第一个能下下来的（下不动就下一个），返回文件名 + 本地路径。
 *
 * 整条链都不行时，`warn=true` 会给一次「这段声音还没到位」——
 * 那时是用户主动选了它，没声不解释会被当成坏了（提示音的解析则全静默）。
 */
async function resolveAmbientFirst(files: string[], warn: boolean): Promise<{ file: string; src: string } | null> {
  for (const file of files) {
    const src = await ensureLocal(file, false)
    if (src) return { file, src }
  }
  if (warn) warnMissing(files[0])
  return null
}

/** 停环境音（淡出后停；期间若又起了新的，就不停） */
export function stopAmbient(): void {
  const ctx = ambient
  const token = ++ambientToken
  ambientCurrent = null
  if (!ctx) return
  fadeTo(ctx, 0, AMBIENT_FADE_OUT_MS, () => {
    if (token !== ambientToken) return
    try {
      ctx.stop()
    } catch {
      /* 忽略 */
    }
  })
}

/* ------------------------------------------------------------------ *
 * 一记（提示音）
 * ------------------------------------------------------------------ */

function ensureCueCtx(): AudioCtx {
  if (cue) return cue
  const ctx = uni.createInnerAudioContext()
  ctx.loop = false
  ctx.onError(() => {
    const hit = cueSrc.get(cueNowKind)
    if (!hit || cueFallbackUsed) return
    cueFallbackUsed = true
    ctx.src = audioUrl(hit.source.file)
    try {
      ctx.play()
    } catch {
      /* 忽略 */
    }
  })
  cue = ctx
  return ctx
}

/** 解析候选链：找到第一个能下下来的，缓存起来 */
async function resolveCue(kind: CueKind, chain: CueSource[], index: number): Promise<void> {
  const source = chain[index]
  if (!source) return
  const src = await ensureLocal(source.file, false)
  if (!src) return resolveCue(kind, chain, index + 1)
  cueSrc.set(kind, { source, src })
}

/** 真正发声：设源、设音量、play，到点淡出停 */
function fireCue(kind: CueKind, source: CueSource, src: string): void {
  const ctx = ensureCueCtx()
  cueNowKind = kind
  cueFallbackUsed = false
  clearCueStop()
  try {
    ctx.stop()
    ctx.src = src
    ctx.loop = false
    ctx.startTime = source.startTime ?? 0
    ctx.playbackRate = source.rate ?? 1
    ctx.volume = CUE_VOLUME
    ctx.play()
  } catch {
    return
  }
  cueStopTimer = setTimeout(() => {
    cueStopTimer = null
    fadeTo(ctx, 0, CUE_FADE_OUT_MS, () => {
      try {
        ctx.stop()
      } catch {
        /* 忽略 */
      }
    })
  }, source.maxMs ?? 3000)
}

function clearCueStop(): void {
  if (cueStopTimer) {
    clearTimeout(cueStopTimer)
    cueStopTimer = null
  }
}

function stopCue(): void {
  clearCueStop()
  const ctx = cue
  if (!ctx) return
  clearFade(ctx)
  try {
    ctx.stop()
  } catch {
    /* 忽略 */
  }
}

/** 放一记（开始 / 结束 / 吸·屏·呼） */
export function playCue(kind: CueKind): void {
  if (!soundOn) return
  const hit = cueSrc.get(kind)
  if (hit) {
    fireCue(kind, hit.source, hit.src)
    return
  }
  void resolveCue(kind, CUE_SOURCES[kind], 0).then(() => {
    const got = cueSrc.get(kind)
    if (got && soundOn) fireCue(kind, got.source, got.src)
  })
}

/**
 * 预热一记：进页面就下好，点「开始」时立刻有声（否则第一次要等下载）。
 * 也顺手把候选链定下来，后续 playCue 不再试前面的缺失文件。
 */
export function prefetchCue(kind: CueKind): void {
  if (!soundOn || cueSrc.has(kind)) return
  void resolveCue(kind, CUE_SOURCES[kind], 0)
}

/** 预热环境音（进页面时调；选中的是「静」就别调）—— 走候选链，能备哪个就备哪个 */
export function prefetchAmbient(files: string[]): void {
  if (!soundOn || !files.length) return
  void resolveAmbientFirst(files, false)
}

/* ------------------------------------------------------------------ *
 * 生命周期
 * ------------------------------------------------------------------ */

/**
 * 切后台（App.onHide）：主动停掉全部声音，但**保留环境音记录**以便回前台续上。
 * 用 stopAmbient 会把记录清掉，所以这里手写一遍。
 */
export function suspendAudio(): void {
  const ctx = ambient
  ambientToken += 1
  if (ctx) {
    clearFade(ctx)
    try {
      ctx.stop()
    } catch {
      /* 忽略 */
    }
  }
  stopCue()
}

/** 回前台（App.onShow）：按记录续上环境音（提示音不重放） */
export function resumeAudio(): void {
  const cur = ambientCurrent
  if (!soundOn || !cur) return
  startAmbient(cur.files, cur.volume)
}

/** 离页（页面 onUnload）：立即停干净，不等淡出 */
export function teardownAudio(): void {
  const ctx = ambient
  ambientToken += 1
  ambientCurrent = null
  if (ctx) {
    clearFade(ctx)
    try {
      ctx.stop()
    } catch {
      /* 忽略 */
    }
  }
  stopCue()
}

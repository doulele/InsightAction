/**
 * 静修声音素材表（止 · 禅定沙漏 / 静心茶室 / 呼吸干预）。
 * ================================================
 *
 * 素材用的是服务器上现成的一套白噪音（另一个项目「睡眠 · 白噪音」的同一批文件），
 * 由 StaticTool 后端流式返回：
 *   https://wellwin.top/staticTool/api/family/whitenoise/file/<encodeURIComponent(文件名)>
 *
 * 三条必须知道的约束：
 *  1. **文件名是契约**。后端是按目录扫描出文件的，那边改名 / 删除会让这里 404。
 *     缺文件时 `utils/audio.ts` 会**静默降级**（不报错、不影响计时与入账），
 *     下面注释标了「待补」的是还没上传的 —— 传上去即生效，**代码一行都不用改**。
 *  2. 该接口是 `Cache-Control: no-store`（服务端明确不缓存）→ 每次播放都会重新下载。
 *     所以 `utils/audio.ts` 会把音频下进私有永久目录，第二个会话起走本地、零流量。
 *  3. 中文名必须 `encodeURIComponent`（部分安卓机对未编码的中文路径会 404）——
 *     统一走下面的 `audioUrl()`，不要自己拼字符串。
 */

/** 素材站根地址（后端接口，带 Range 与 MIME 处理；不是 nginx 静态目录） */
const AUDIO_BASE = 'https://wellwin.top/staticTool/api/family/whitenoise/file'

/** 文件名 → 可播放地址（统一逐段编码） */
export function audioUrl(file: string): string {
  return `${AUDIO_BASE}/${encodeURIComponent(file)}`
}

/* ------------------------------------------------------------------ *
 * 一记（提示音）：开始 / 结束 / 呼吸引导
 * ------------------------------------------------------------------ */

/** 提示音的种类 */
export type CueKind = 'open' | 'close' | 'in' | 'hold' | 'out'

export interface CueSource {
  /** 服务器上的文件名 */
  file: string
  /** 起播点（秒）：长录音要截掉开头，短音传 0 */
  startTime?: number
  /** 最长播放（毫秒）：到点淡出 —— 这是「用长录音当一记」的关键 */
  maxMs?: number
  /** 变速（0.5–2.0）：用同一个文件做出「吸」与「呼」的音高差 */
  rate?: number
}

/**
 * 一记的**候选链**：从左到右取第一个能播的。
 *
 * 为什么是链而不是单个文件：要补的那几个短音（引磬 / 收功铃 / 呼吸三声）还没上传，
 * 而目录里本来就有 `颂钵.mp3`（508KB 的一记钵声）。于是「短音没到位也能立刻有声」——
 * 用颂钵截前几秒、变速区分吸与呼；等短音传上来，会自动改用排在链首的短音。
 *
 * 音量与淡出由 utils/audio.ts 统一处理（一记 0.5，淡出 400ms）。
 */
export const CUE_SOURCES: Record<CueKind, CueSource[]> = {
  /** 开始一段静修：引磬（待补）→ 颂钵前 4 秒 */
  open: [
    { file: '引磬_一记.mp3', maxMs: 4000 },
    { file: '颂钵.mp3', maxMs: 4000 },
  ],
  /** 收功 / 一盏毕：收功铃（待补）→ 引磬（待补）→ 颂钵 */
  close: [
    { file: '收功铃.mp3', maxMs: 3500 },
    { file: '引磬_一记.mp3', maxMs: 4000 },
    { file: '颂钵.mp3', maxMs: 4000 },
  ],
  /** 吸气（4-7-8 的 4 秒）：短音（待补）→ 颂钵提速 1.5（清亮） */
  in: [
    { file: '呼吸_吸.mp3', maxMs: 1200 },
    { file: '颂钵.mp3', maxMs: 700, rate: 1.5 },
  ],
  /** 屏息（7 秒）：短音（待补）→ 颂钵略提速（更短更闷） */
  hold: [
    { file: '呼吸_屏.mp3', maxMs: 1200 },
    { file: '颂钵.mp3', maxMs: 600, rate: 1.18 },
  ],
  /** 呼气（8 秒）：短音（待补）→ 颂钵降速 0.85（更低更长） */
  out: [
    { file: '呼吸_呼.mp3', maxMs: 1400 },
    { file: '颂钵.mp3', maxMs: 900, rate: 0.85 },
  ],
}

/* ------------------------------------------------------------------ *
 * 环境音（循环）
 * ------------------------------------------------------------------ */

export interface AmbientTrack {
  /**
   * 候选文件，**第一个是理想素材，缺了就往右回落**（都是服务器上现成的）。
   *
   * 与提示音的候选链同一个思路：目录里没有「走时声」这一类别，
   * 于是先拿现成的顶上（滴答 → 雨打屋顶、水将开 → 森林篝火），
   * 素材传上去后自动改用链首，代码不用动。
   */
  files: string[]
  /** 目标音量（0–1）。环境音一律压在 0.35 以下：它是背景，不是主角 */
  volume: number
}

export interface AmbientOption {
  id: string
  name: string
  hint: string
  /** 缺省 = 「静」，不下载任何文件 */
  track?: AmbientTrack
}

/** 默认项（单独抽出来，避免 `列表[0]` 的类型抖动） */
const AMBIENT_NONE: AmbientOption = { id: 'none', name: '静', hint: '只留沙漏本身' }

/**
 * 禅定沙漏可选的走时声（第一项默认「静」）。
 *
 * 全是服务器上现成的文件（体积都在 600KB 以内）。「滴答」是唯一的例外：
 * 那是为「时间在走」专门要的音，目录里没有 —— 链首先留着名字，
 * 现在自动回落到现成的「雨打屋顶」（雨点的短促敲击，节律最接近走时）。
 */
export const SANDGLASS_AMBIENTS: AmbientOption[] = [
  AMBIENT_NONE,
  { id: 'tick', name: '滴答', hint: '时间在走', track: { files: ['时钟滴答.mp3', '雨打屋顶.mp3'], volume: 0.3 } },
  { id: 'pink', name: '粉红', hint: '最不抢神', track: { files: ['粉红噪音.mp3'], volume: 0.34 } },
  { id: 'leaves', name: '叶声', hint: '风过处', track: { files: ['树叶沙沙_实地.mp3'], volume: 0.32 } },
]

/** 沙漏偏好 id → 选项（拿不到就给默认的「静」） */
export function sandglassAmbientById(id: string): AmbientOption {
  return SANDGLASS_AMBIENTS.find((a) => a.id === id) ?? AMBIENT_NONE
}

/**
 * 茶室五盏 → 环境音（id 与页面里的 room id 对齐）。
 *
 * 挑法：一句一盏，音要能对上那句文案，且体积都在 500KB 以内（首次要下载）。
 *  - 焚香「看烟起，什么都不做」→ 壁炉：香灰与炭火的细响
 *  - 扫尘「风过处，落叶自去」  → 树叶沙沙
 *  - 听潮「潮来潮往，你是岸边」→ 海浪拍岸
 *  - 观云「看云聚散，不着于相」→ 微风
 *  - 煮雪「守着炉火，候雪水开」→ 链首留「水将开」（还没上传），现在自动回落森林篝火
 */
export const TEA_AMBIENTS: Record<string, AmbientTrack> = {
  xiang: { files: ['壁炉_实地.mp3'], volume: 0.32 },
  sao: { files: ['树叶沙沙_实地.mp3'], volume: 0.3 },
  ting: { files: ['海浪拍岸.mp3'], volume: 0.34 },
  yun: { files: ['微风_实地.mp3'], volume: 0.3 },
  zhu: { files: ['水将开.mp3', '森林篝火.mp3'], volume: 0.32 },
}

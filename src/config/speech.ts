/**
 * 收听（正文朗读）的口径 —— 阈值、上限、文案都在这里，页面与 utils 不写死。
 * ================================================
 *
 * **两个引擎，默认走服务端**（2026-09-19 换的）：
 *
 * | | 服务端（默认） | 插件（回落） |
 * | --- | --- | --- |
 * | 实现 | 我们后端 `/guanzhi/tts` → 微软 Edge 在线合成（见后端 `services/edgeTts.js`） | 微信同声传译插件 `textToSpeech` |
 * | 一段多少字 | **1200**（首段 300，见下） | **50**（插件硬上限） |
 * | 音色 | 5 个中文音色可选（`TTS_VOICES`） | 只有一套 |
 * | 缓存 | 合成结果落**本机私有目录**，第二次零请求 | 地址 3 小时有效，只存内存 |
 * | 代价 | **正文要经过我们的服务器**（隐私面扩大，见 PRIVACY.md 第 5.2 节） | 不经服务器 |
 *
 * 切换只改后端 `config/app-config.json` 的 `features.tts`（60 秒热生效、不用发版）——
 * 关掉即整篇回落插件那份实现（`utils/speech.ts` 两套都在）。
 *
 * ⚠️ 回落那份实现依赖**微信同声传译插件**，而为过审这个插件的声明可能会被删掉
 * （类目「IT科技-软件服务提供商」对个人主体超范围，见 `src/manifest.json` 那段注）。
 * 删掉之后 `speechAvailable()` 恒为 false，「听」只剩服务端一条路：服务端不通会如实报
 * 「合成失败」，不再静默回落 —— 所以**别同时关掉 `features.tts` 和插件声明**，
 * 那样按钮点了必然失败（`subpkg-observe/detail` 的 `canListen` 也会跟着收起来）。
 *
 * 三条实测数据（本机连微软通道量的，2026-09-19）：
 *  · 合成速度约 **70–110 字/秒**（远快于朗读本身的 ~4.7 字/秒）；
 *  · 1200 字 ≈ **10 秒**、约 1.4MB（48kbps）；
 *  · 45 字的短句也要 ≈2 秒（连接握手是固定开销）。
 * 所以：**首段故意切小**（`SERVER_FIRST_CHUNK_MAX`）先出声，后面的段在播放期间预取，
 * 听感上就是"点一下 4 秒开始念，之后一路不断"。
 */

/** 服务端引擎：单段字数上限（**必须 ≤ 后端 config/index.js 的 tts.maxChars**） */
export const SERVER_CHUNK_MAX = 1200

/**
 * 服务端引擎的**首段**字数：小段先出声（≈4 秒合成 ≈1 分钟音频），
 * 之后的段按 `SERVER_CHUNK_MAX` 合 —— 首听等待少一半以上，代价只是多一次请求。
 */
export const SERVER_FIRST_CHUNK_MAX = 300

/** 插件引擎单段字数（官方文档「后台限制长度在 50 个字符内」，超了报 -20002） */
export const PLUGIN_CHUNK_MAX = 50

/** 插件引擎的合成语言 */
export const SPEECH_LANG = 'zh_CN'

/**
 * 音色候选（服务端引擎）—— **必须与后端 config/index.js 的 tts.voices 一致**：
 * 不一致时后端会静默回落到默认音色，用户听到的不是他选的那个。
 */
export const TTS_VOICES = [
  { id: 'zh-CN-YunjianNeural', label: '云健', desc: '沉稳' },
  { id: 'zh-CN-XiaoxiaoNeural', label: '晓晓', desc: '温暖' },
  { id: 'zh-CN-XiaoyiNeural', label: '晓依', desc: '轻柔' },
  { id: 'zh-CN-YunyangNeural', label: '云扬', desc: '清朗' },
  { id: 'zh-CN-YunxiNeural', label: '云希', desc: '年轻' },
] as const

/** 默认音色（后端认不出时也会回落到它） */
export const DEFAULT_VOICE = 'zh-CN-YunjianNeural'

/**
 * 倍速候选（**播放端**变速：改 `playbackRate`，不重新合成、切换即时）。
 * 为什么不做成"按倍速合成"：那会让每换一次速度就重新合成+重新缓存一遍，
 * 而播放端变速零成本。代价是 1.5x 时音色会略尖（人声录音加速的通病）。
 */
export const SPEECH_RATES = [1, 1.25, 1.5] as const

/**
 * 预取窗口：正在播第 n 段时，最多提前合成到第 n + LOOKAHEAD 段。
 * 段很长（4~6 分钟音频），窗口不用大；2 段足够盖住"下一段合成要 10 秒"。
 */
export const LOOKAHEAD = 2

/** 插件引擎：一段合成失败后的重试次数与间隔（-40001 是"调用太频繁"） */
export const SYNTH_RETRY = 2
export const SYNTH_RETRY_MS = 1200

/** 断句优先在这几个标点切（句末）——切得出来才断得像人话 */
export const SENTENCE_MARKS = '。！？；…!?;'
/** 句末标点找不到时的退路（逗号 / 顿号 / 冒号 / 收尾的括号引号） */
export const CLAUSE_MARKS = '，,、：:）)」』"”'
/** 换行也当句末（导入的正文常常一行一句） */
export const LINE_MARKS = '\n'
/** 断句上限：别为找标点扫太久（标点极其稀疏的文本） */
export const SCAN_BACK = 60

/**
 * 收听条文案（页面直接取，不各自造句）。
 * `state` 逐一对齐 utils/speech.ts 的 `SpeechState`（**含 idle，值为空串**）。
 */
export const SPEECH_TEXT = {
  /** 起播按钮 */
  start: '听',
  state: {
    /** 什么都没在放：这一态整条收听条都不出现，文字留空 */
    idle: '',
    /** 首段在没有缓存时要等几秒 —— 明说，别让用户以为卡住了 */
    synth: '正在合成…',
    playing: '正在朗读',
    paused: '已暂停',
    done: '读完了',
    error: '朗读停下了',
  },
  /** 暂停 / 继续 / 停止 / 关闭 */
  act: {
    pause: '暂停',
    resume: '继续',
    stop: '停止',
    close: '关闭',
  },
  fail: {
    /** 环境不支持（插件也没有 / 非微信端） */
    unsupported: '当前环境不支持收听',
    /** 合成失败（服务端或插件） */
    synth: '语音合成没成功，稍后再试',
    /** 音频拿到了但播不出来 */
    play: '这段没能播出来，可以再试一次',
    /** 被限流（服务端每分钟/每天的上限） */
    quota: '听得有点急了，过一会儿再继续',
  },
  /** 音色按钮的提示（点击循环切换） */
  voiceTip: '换音色 · 从下一段起生效',
} as const

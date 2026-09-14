/**
 * 首次测评题库 —— 三模式三套 8 题建档（普通·生活基线 / 科技·数字画像 / 修仙·灵根检测）。
 *
 * ══════════════════════════════════════════════════════════════════════
 *  这一版的目标：**让 8 次点击尽可能接近「可信的自我盘点」**。
 *  每一条改动都对应一个具体的测量学问题（写在这里，方便后人复核，也方便反驳）：
 * ══════════════════════════════════════════════════════════════════════
 *
 *  1. **每维度恰好 2 题（共 8 题）** —— 解决「单题维度无信度」。
 *     之前：看 meaningfully 覆盖残缺（修仙库没有「知」，科技库没有「行」），且多数维度只有 1 题。
 *     1 题的维度，一次误点就能翻转结论；2 题既能做**成对一致性校验**，也够结果页说「这维还需再看」。
 *     题量从 6 → 8 是可接受代价：多 2 次点击（约 +15 秒），换结果页每一维都能自证。
 *
 *  2. **统一回忆窗口 = 过去 7 天** —— 解决「回忆偏差不可控」。
 *     之前：同一份问卷里混着「今天 / 这一周 / 过去一个月 / 最近一次」四种时间窗。
 *     「过去一个月」的回忆几乎无效（人会按印象补），与「今天」混算等于两个量纲相加。
 *     7 天是自我报告习惯类测量的常用窗口：够长（避免单日偶然）、够短（还记得清）。
 *
 *  3. **行为频率锚定选项** —— 解决「社会赞许性偏差」。
 *     之前：选项是「大多时候」「偶尔」「还算」这类模糊词，问的是「你是什么样的人」
 *           （→ 用户答的是理想自我，不是真实行为）。
 *     现在：选项是「0 天 / 1-2 天 / 3-5 天 / 6 天以上」这类**可数的事实**
 *           （→「上周有几天」比「你是否自律」难撒谎，且不同人的刻度一致）。
 *     这是单题增益最大的一处改动。
 *
 *  4. **选项位置平衡 + 量尺方向随机** —— 解决「最佳项永远在最后」的作弊路径。
 *     之前：绝大多数题把最高分选项排在第 4 位，用户答 2 题就能发现「选最后=高分」。
 *     现在：同一套题里，有的题从「最少」排到「最多」、有的从「最多」排到「最少」，
 *           高分位置在第 1 位与第 4 位之间交替，且顺序无肉眼可见的规律。
 *     ⚠️ 计分**永远按 option.score**，与排列位置无关，所以怎么排都不会算错分。
 *
 *  5. **每维度配 1 道反向题（reverse）** —— 解决「默认同意偏差 acquiescence」。
 *     反向题：高分选项的语义是「没有 / 从不」（例：过去 7 天有几天你一拖再拖？→「一天都没有」得满分）。
 *     正向题与反向题若都答到同一端（例：正向答「几乎每天」+ 反向也答「几乎每天」），
 *     说明作答并未真正读题 → 命中 `coherence` 检测（见 evaluate()）。
 *     与旧字段 `flipped`（最佳项排最前）的区别：flipped 只描述**位置**，reverse 描述**语义方向**；
 *     旧配置缺失时 flipped 仍按反向语义兼容处理，不会退化为「算错分」。
 *
 *  6. **诚实的边界**（请连同 v1 的注释一起读）：
 *     8 题仍是「自我盘点」，不是心理测量量表 —— 真量表要求 α≥0.7，通常需每维度 3-5 题。
 *     本版能保证的是：**同一份作答结论稳定可复现、跨版本可比、并且知道自己的可信度有多高**，
 *     而不是给用户贴精确的标签。所以输出里有 `confidence`（见 evaluate()），且允许它是「低」。
 *
 * ⚠️ 题库数据在本地与远端各有一份：本文件是**兜底**，运营位
 *    PersonalStaticStationBackend/config/content.json 是**覆盖**（见 stores/content.ts）。
 *    改题时两边都要改，否则远端一挂就回到旧题。
 */
import type { ModeId } from '@/config/modes'

/* ============================ 维度 ============================ */

/** 四个维度，与「观 / 止 / 知 / 行」四个大厅同名同义 */
export type AssessDim = 'observe' | 'pause' | 'reflect' | 'action'

/** 维度展示顺序固定为「观止知行」（结果页按此顺序排布，不随题库书写顺序变） */
export const ASSESS_DIMS: readonly { key: AssessDim; label: string }[] = [
  { key: 'observe', label: '观 · 辨源' },
  { key: 'pause', label: '止 · 静定' },
  { key: 'reflect', label: '知 · 沉淀' },
  { key: 'action', label: '行 · 行动' },
]

/**
 * 内置题库版本号。
 *
 * 存在的理由（踩过一次才知道）：远端 content.json 的 version 低于这个值时，
 * 说明**服务器上的运营位比代码里的内置题库旧**，此时必须忽略远端题库。
 * 否则会出现「我明明改成 8 题了，真机还是 6 题」这种极难排查的现象 ——
 * 明明本地编译产物是对的，却被一份过期的远端内容整体覆盖。
 *
 * 运营侧要重新接管题库时，把 content.json 的 version 提到 ≥ 此值即可（不必发版）。
 * 每次改本地题库，请 +1。
 */
export const LOCAL_ASSESS_VERSION = 3

/**
 * 默认回忆窗口提示（题干下方那行小字）。
 * 它的作用不是装饰：明确的时间锚能显著提升自我报告的准确性（让人去数次数，而不是凭印象打分）。
 */
export const DEFAULT_WINDOW_NOTE = '回想最近 7 天'

/* ============================ 题型 ============================ */

export interface AssessmentOption {
  /** 选项文案 */
  text: string
  /** 该选项的**真实得分**（0-3；始终按这个字段计分，与排列位置、reverse 均无关） */
  score: number
}

export interface AssessmentQuestion {
  q: string
  /** 本题主要测量的维度 */
  dim: AssessDim
  /**
   * 反向题：高分选项的语义是「没有 / 从不 / 一天都没有」。
   * 用途：与同维度的正向题配对，用于**内在一致性（coherence）**校验。
   * ⚠️ 只影响质量检测，**不影响计分**（仍按 option.score）。
   */
  reverse?: boolean
  /**
   * 【兼容旧字段】最佳的语义排在最后（旧题库用于标记"位置倒置"）。
   * 现在统一由 `reverse` 表达语义方向；这里保留是因为远端配置可能还在用旧写法，
   * 缺失 reverse 时会按 flipped 当反向题处理（与舊版行为一致）。
   */
  flipped?: boolean
  /** 逐题自定义提示（为空则用题库的 windowNote） */
  hint?: string
  options: readonly AssessmentOption[]
}

export interface AssessmentBank {
  mode: ModeId
  /**
   * 测评名 —— 界面展示的**唯一来源**：
   * 模式选择页 chip、测评页顶部标题、我页入口都读它。
   * 因此三模式名称天然不同（生活基线 / 数字画像 / 灵根检测），改名只需改这里或远端配置。
   */
  title: string
  /** 开测前一句话 */
  intro: string
  /** 最后一题的提交按钮文案（三模式可不同；缺省用「建档完成」） */
  submitLabel?: string
  /**
   * 回忆窗口提示：显示在题干正下方，告诉用户「按哪个时间段回答」。
   * 缺省用 DEFAULT_WINDOW_NOTE。
   */
  windowNote?: string
  questions: readonly AssessmentQuestion[]
  /** 三档称号：低 / 中 / 高 */
  tierNames: readonly [string, string, string]
  /** 三档描述：低 / 中 / 高 */
  tierDescs: readonly [string, string, string]
}

/* ============================ 三套题库 ============================ */

export const ASSESSMENT_BANKS: readonly AssessmentBank[] = [
  {
    mode: 'normal',
    title: '生活基线',
    intro: '按最近 7 天的真实情况答，不是按你希望的样子。',
    submitLabel: '建档完成',
    windowNote: '回想最近 7 天',
    questions: [
      {
        q: '先是察觉到自己在无聊或焦虑，然后才拿起的手机——这种时候有多少回？',
        dim: 'observe',
        options: [
          { text: '几乎没有，多半是手先动了', score: 0 },
          { text: '一两回', score: 1 },
          { text: '三四回', score: 2 },
          { text: '六回以上，多数时候先察觉', score: 3 },
        ],
      },
      {
        /* 反向题：高分选项是「没有过」 */
        q: '回过神来才发现，自己已经刷了很久——这种时候有多少回？',
        dim: 'observe',
        reverse: true,
        options: [
          { text: '没有过', score: 3 },
          { text: '一两回', score: 2 },
          { text: '三四回', score: 1 },
          { text: '几乎每天', score: 0 },
        ],
      },
      {
        q: '有几天你连续做了 45 分钟以上的正事，中途没被手机打断？',
        dim: 'pause',
        options: [
          { text: '六天以上', score: 3 },
          { text: '三到五天', score: 2 },
          { text: '一到两天', score: 1 },
          { text: '一天都没有', score: 0 },
        ],
      },
      {
        /* 反向题 */
        q: '有几天出现过「本想看一眼手机，结果刷了很久」？',
        dim: 'pause',
        reverse: true,
        options: [
          { text: '一天都没有', score: 3 },
          { text: '一到两天', score: 2 },
          { text: '三到五天', score: 1 },
          { text: '六天以上', score: 0 },
        ],
      },
      {
        q: '有几天你写下过点什么——日记、备忘、随手一句都算？',
        dim: 'reflect',
        options: [
          { text: '四天以上', score: 3 },
          { text: '两到三天', score: 2 },
          { text: '一天', score: 1 },
          { text: '一天都没有', score: 0 },
        ],
      },
      {
        /* 反向题 */
        q: '有几天到了晚上你会说不清这一天做了什么？',
        dim: 'reflect',
        reverse: true,
        options: [
          { text: '一天都没有', score: 3 },
          { text: '一天', score: 2 },
          { text: '两到三天', score: 1 },
          { text: '四天以上', score: 0 },
        ],
      },
      {
        q: '有几天你出门走动或运动了 20 分钟以上？',
        dim: 'action',
        options: [
          { text: '四天以上', score: 3 },
          { text: '两到三天', score: 2 },
          { text: '一天', score: 1 },
          { text: '一天都没有', score: 0 },
        ],
      },
      {
        /* 反向题 */
        q: '有几天你「本来打算做的事，最后拖着没做」？',
        dim: 'action',
        reverse: true,
        options: [
          { text: '四天以上', score: 0 },
          { text: '两到三天', score: 1 },
          { text: '一天', score: 2 },
          { text: '一天都没有', score: 3 },
        ],
      },
    ],
    tierNames: ['紧绷期', '平衡期', '从容期'],
    tierDescs: [
      '信息与屏幕占用的比重偏高，身心常被推着走。好消息是：基线越低，改善的余地越大。',
      '节奏大体自洽，偶有失控的时段。把「观止知行的清单」变成固定节律，是下一步。',
      '作息、专注与阅读都在轨道上。守住它，把节奏过成理所当然的样子。',
    ],
  },
  {
    mode: 'tech',
    title: '数字画像',
    intro: '只填最近 7 天真实发生的次数，估算不如数一遍。',
    submitLabel: '生成画像',
    windowNote: '回想最近 7 天',
    questions: [
      {
        q: '有几天你能清楚说出「当天拿起手机是为了做什么」？',
        dim: 'observe',
        options: [
          { text: '六天以上', score: 3 },
          { text: '三到五天', score: 2 },
          { text: '一到两天', score: 1 },
          { text: '基本没有，多是下意识点亮', score: 0 },
        ],
      },
      {
        /* 反向题 */
        q: '有几天出现过「看到红点或通知就立刻点开」？',
        dim: 'observe',
        reverse: true,
        options: [
          { text: '几乎每天', score: 0 },
          { text: '三到五天', score: 1 },
          { text: '一到两天', score: 2 },
          { text: '基本没有', score: 3 },
        ],
      },
      {
        q: '平均每天的纯屏幕时间（非工作用途）大概是多少？',
        dim: 'pause',
        hint: '按最近 7 天的平均估算',
        options: [
          { text: '4 小时以上', score: 0 },
          { text: '2-4 小时', score: 1 },
          { text: '1-2 小时', score: 2 },
          { text: '不到 1 小时', score: 3 },
        ],
      },
      {
        /* 反向题 */
        q: '有几天注意力被通知打断到明显影响了手上的事？',
        dim: 'pause',
        reverse: true,
        options: [
          { text: '基本没有', score: 3 },
          { text: '一到两天', score: 2 },
          { text: '三到五天', score: 1 },
          { text: '几乎每天', score: 0 },
        ],
      },
      {
        q: '读过的长文或章节里，有几篇你读完后还能复述出要点？',
        dim: 'reflect',
        options: [
          { text: '基本没有', score: 0 },
          { text: '1-2 篇', score: 1 },
          { text: '3-5 篇', score: 2 },
          { text: '6 篇以上', score: 3 },
        ],
      },
      {
        /* 反向题 */
        q: '有几天出现过「想找一条信息，却想不起在哪看过」？',
        dim: 'reflect',
        reverse: true,
        options: [
          { text: '基本没有', score: 3 },
          { text: '一到两天', score: 2 },
          { text: '三到五天', score: 1 },
          { text: '几乎每天', score: 0 },
        ],
      },
      {
        q: '有几天你完成了当天给自己定下的主要任务？',
        dim: 'action',
        options: [
          { text: '基本没有', score: 0 },
          { text: '一到两天', score: 1 },
          { text: '三到五天', score: 2 },
          { text: '六到七天', score: 3 },
        ],
      },
      {
        /* 反向题 */
        q: '有几天出现过「计划好的事一拖再拖，最后没做」？',
        dim: 'action',
        reverse: true,
        options: [
          { text: '基本没有', score: 3 },
          { text: '一到两天', score: 2 },
          { text: '三到五天', score: 1 },
          { text: '几乎每天', score: 0 },
        ],
      },
    ],
    tierNames: ['失焦画像', '均衡画像', '强健画像'],
    tierDescs: [
      '注意力被切割得比较碎，屏幕主导了大部分空闲时间。先把「止」练起来，数据会很快变好看。',
      '大多数维度自控良好，偶有失焦窗口。用专注统计固化好的习惯，把「偶尔」变成「默认」。',
      '清晰、自洽、有系统。你缺的不是方法，是把这套系统坚持下去的长期主义。',
    ],
  },
  {
    mode: 'dao',
    title: '灵根检测',
    intro: '只论最近七日行止，莫论心志高低。',
    submitLabel: '灵根既定',
    windowNote: '回想最近七日',
    questions: [
      {
        q: '起心动念之时，你能当下觉察、不为所转的，有多少回？',
        dim: 'observe',
        options: [
          { text: '几无觉察，念起即随', score: 0 },
          { text: '一两回', score: 1 },
          { text: '三四回', score: 2 },
          { text: '多半能觉察得住', score: 3 },
        ],
      },
      {
        /* 反向题 */
        q: '因旁人一句评价而扰乱心境的，有多少回？',
        dim: 'observe',
        reverse: true,
        options: [
          { text: '大体每回如此', score: 0 },
          { text: '三四回', score: 1 },
          { text: '一两回', score: 2 },
          { text: '几无扰动', score: 3 },
        ],
      },
      {
        q: '有一炷香（约十五分钟）以上独自静坐、不碰外物的，有几日？',
        dim: 'pause',
        options: [
          { text: '每日皆有', score: 3 },
          { text: '三五次', score: 2 },
          { text: '一两次', score: 1 },
          { text: '未曾有过', score: 0 },
        ],
      },
      {
        /* 反向题 */
        q: '心浮气躁、定不住神的时刻，有多少回？',
        dim: 'pause',
        reverse: true,
        options: [
          { text: '几乎每日', score: 0 },
          { text: '三五回', score: 1 },
          { text: '一两回', score: 2 },
          { text: '几无', score: 3 },
        ],
      },
      {
        /* 反向题 */
        q: '读过即忘、收而不观的，有多少回？',
        dim: 'reflect',
        reverse: true,
        options: [
          { text: '几无自省，翻过便忘', score: 0 },
          { text: '三四回', score: 1 },
          { text: '一两回', score: 2 },
          { text: '读过必有所得', score: 3 },
        ],
      },
      {
        q: '静夜自省、记下当日功过的，有几夜？',
        dim: 'reflect',
        options: [
          { text: '日日省察', score: 3 },
          { text: '三五夜', score: 2 },
          { text: '一两夜', score: 1 },
          { text: '一夜也无', score: 0 },
        ],
      },
      {
        q: '于己许过的诺言，做到了几成？',
        dim: 'action',
        options: [
          { text: '一件未成', score: 0 },
          { text: '仅成一两件', score: 1 },
          { text: '大半做到', score: 2 },
          { text: '尽数做到', score: 3 },
        ],
      },
      {
        /* 反向题 */
        q: '因循苟且、该做而未做的时刻，有多少回？',
        dim: 'action',
        reverse: true,
        options: [
          { text: '几无', score: 3 },
          { text: '一两回', score: 2 },
          { text: '三五回', score: 1 },
          { text: '日日如是', score: 0 },
        ],
      },
    ],
    tierNames: ['凡骨灵根', '中品灵根', '天品灵根'],
    tierDescs: [
      '凡骨亦能成道。灵根平平，正说明心性尚未被驯化，反而潜力无限——从每天一段沙漏开始炼。',
      '中品可造。定力尚可、贪嗔偶起，正好以日课打磨，假以时日必入上品。',
      '天品之姿，万中无一。切记根骨愈佳，魔考愈重——守住日常，方不负此根。',
    ],
  },
]

export function getAssessmentBank(mode: ModeId): AssessmentBank {
  return ASSESSMENT_BANKS.find((b) => b.mode === mode) ?? ASSESSMENT_BANKS[0]
}

/* ============================ 计分 ============================ */

export type AssessmentTier = 'low' | 'mid' | 'high'

/**
 * 分档阈值（**比例**，不是绝对分）：
 *   ratio ≤ 0.35 → 低；ratio ≥ 0.7 → 高；其余中。
 * 标定依据：8 题 × 3 分 = 24 分制下，0.35 ≈ 8 分（多数题选最低档），
 * 0.7 ≈ 17 分（多数题选次高档）—— 与旧版 18 分制的 6 / 13 分同义。
 * 用比例而非绝对分，是为了题库加减题时不至于整体错位。
 */
export interface TierThresholds {
  lowRatio: number
  highRatio: number
}

export const DEFAULT_TIER_THRESHOLDS: TierThresholds = { lowRatio: 0.35, highRatio: 0.7 }

export function tierOfRatio(ratio: number, t: TierThresholds = DEFAULT_TIER_THRESHOLDS): AssessmentTier {
  if (ratio >= t.highRatio) return 'high'
  if (ratio <= t.lowRatio) return 'low'
  return 'mid'
}

/** 单题满分 = 该题选项里的最高分（不假定一定是 3，兼容运营侧写 0-2 分的题） */
export function questionMax(q: AssessmentQuestion): number {
  return q.options.reduce((max, o) => Math.max(max, o.score), 0)
}

/** 本题库满分 = 各题满分之和 */
export function bankMax(bank: AssessmentBank): number {
  return bank.questions.reduce((sum, q) => sum + questionMax(q), 0)
}

/** 某一题的实际得分（未作答按 0，越界/脏数据按 0） */
export function scoreOf(q: AssessmentQuestion, optionIndex: number | null | undefined): number {
  if (optionIndex === null || optionIndex === undefined) return 0
  const opt = q.options[optionIndex]
  if (!opt || !Number.isFinite(opt.score)) return 0
  return Math.max(0, opt.score)
}

/** 把一题的得分归一到 0-3 量表（跨 Max 不同的题才能互相比较） */
function normalizedScore(q: AssessmentQuestion, pick: number | null | undefined): number | null {
  if (pick === null || pick === undefined) return null
  const qMax = questionMax(q)
  if (qMax <= 0) return null
  return (scoreOf(q, pick) / qMax) * 3
}

/** 是否按反向题处理：新字段 reverse 优先，缺失时回落到旧字段 flipped（旧题库用它标位置倒置） */
function isReverse(q: AssessmentQuestion): boolean {
  return typeof q.reverse === 'boolean' ? q.reverse : Boolean(q.flipped)
}

export interface DimScore {
  dim: AssessDim
  score: number
  max: number
  /** 该维度由几题构成（结果页据此说明「这维只有 N 题，别过度解读」） */
  count: number
}

/** 作答质量：ok 正常 / straight 位置惯性 / inconsistent 前后矛盾 / hasty 作答过快 */
export type AssessQuality = 'ok' | 'straight' | 'inconsistent' | 'hasty'

/** 本次结果的置信度（回答「这份结论可以多当真」） */
export type AssessConfidence = 'high' | 'mid' | 'low'

/** 作答行为的原始信号（0-1，越高越好）——结果页用它解释「为什么是这个置信度」 */
export interface AssessSignals {
  /** 完整度：实际作答题数 / 总题数 */
  completeness: number
  /** 变异度：答案是否有区分（全部选同一位置 = 0） */
  variability: number
  /** 内在一致性：同维度正反向题是否自洽 */
  coherence: number
  /** 作答节奏：是否读得足够久（过快 → 接近 0）；未采集到时长时恒为 1 且不参与置信度 */
  pacing: number
  /** 是否采集到了作答时长 */
  hasTiming: boolean
}

/**
 * 作答时长（毫秒）——唯一新增的外部输入。
 * 用途只有一个：识别「读都没读就点完了」的作答。
 * 页面不传也能正常出结论（pacing 不参与计算），所以旧调用点不必改。
 */
export interface AssessTiming {
  /** 每题停留时长（毫秒）；长度不足则缺失部分按未采集处理 */
  perQuestion?: readonly number[]
  /** 整份总时长（毫秒，可选） */
  totalMs?: number
}

export interface EvaluatedAssessment {
  /** 总分（原始分） */
  score: number
  /** 本题库满分（随题库变化） */
  maxScore: number
  /** 归一化得分 0-1 —— 跨版本、跨题量唯一可比的量，历史对比与分档都用它 */
  ratio: number
  tier: AssessmentTier
  /** 各维度得分（按「观止知行」顺序，只含本题库真正测到的维度） */
  dims: DimScore[]
  quality: AssessQuality
  /** 实际作答题数 */
  answered: number
  /** 总题数 */
  total: number
  /** 置信度：这份结论能多当真 */
  confidence: AssessConfidence
  /** 置信度的构成明细 */
  signals: AssessSignals
}

const clamp01 = (n: number): number => (n < 0 ? 0 : n > 1 ? 1 : n)

/**
 * 位置惯性检测（straight-lining）。
 * 原实现要求「全部题都选同一个位置」才报警 —— 8 题里只要有一题随便点一下就躲过检测。
 * 现在改为：**连续 ≥ 5 题同一位置** 或 **全部题同一位置** 即命中，
 * 真正想蒙混的人往往会连点一段，而不是从头点到尾。
 */
export function detectStraightLining(picks: readonly (number | null | undefined)[]): boolean {
  const answered = picks.map((p) => (p === null || p === undefined ? null : p))
  if (answered.length === 0) return false
  const first = answered[0]
  if (first === null) return false
  if (answered.every((v) => v !== null && v === first)) return true

  let run = 1
  for (let i = 1; i < answered.length; i += 1) {
    const cur = answered[i]
    if (cur !== null && cur === answered[i - 1]) {
      run += 1
      if (run >= 5) return true
    } else {
      run = 1
    }
  }
  return false
}

/**
 * 内在一致性（coherence）：每一维内部，正向题与反向题是否自洽。
 *
 * 算法：反向题的得分先**翻转**（3 - 归一化分），使其方向与其它题一致；
 * 然后取该维度内所有题的归一化分，算平均两两偏差，偏差越大一致性越低。
 * 「正向答几乎每天 + 反向也答几乎每天」这种自相矛盾会直接把它压到 0 附近。
 */
export function computeCoherence(
  bank: AssessmentBank,
  picks: readonly (number | null | undefined)[],
): { coherence: number; contradiction: boolean } {
  let weightedSum = 0
  let weight = 0
  let contradiction = false

  for (const dim of ASSESS_DIMS) {
    const values: number[] = []
    bank.questions.forEach((q, i) => {
      if (q.dim !== dim.key) return
      const v = normalizedScore(q, picks[i])
      if (v === null) return
      values.push(isReverse(q) ? 3 - v : v)
    })
    // 只有 1 题的维度无法自证，跳过（后果是 coherence 权重变小，不会误判）
    if (values.length < 2) continue

    // 两两偏差的平均 → 归一化到 0-1（量表宽度 3）
    let diffSum = 0
    let pairs = 0
    for (let a = 0; a < values.length; a += 1) {
      for (let b = a + 1; b < values.length; b += 1) {
        diffSum += Math.abs(values[a] - values[b])
        pairs += 1
      }
    }
    if (!pairs) continue

    const meanDiff = diffSum / pairs
    // 平均相差 2 分以上（≈ 一处说「从不」、一处说「总是」）才叫自相矛盾
    if (meanDiff >= 2) contradiction = true
    weightedSum += clamp01(1 - meanDiff / 3) * pairs
    weight += pairs
  }

  return { coherence: weight > 0 ? clamp01(weightedSum / weight) : 1, contradiction }
}

/**
 * 作答质量检测（保留旧签名，供向后兼容）。
 * 顺序：位置惯性 → 前后矛盾 → 作答过快（后者只在有计时数据时可能命中）。
 */
export function assessQuality(
  bank: AssessmentBank,
  picks: readonly (number | null | undefined)[],
  timing?: AssessTiming,
): AssessQuality {
  if (detectStraightLining(picks)) return 'straight'
  if (computeCoherence(bank, picks).contradiction) return 'inconsistent'
  if (isHasty(bank, timing)) return 'hasty'
  return 'ok'
}

/**
 * 过快作答判定：平均每题 < 1.2 秒。
 * 8 题的选项 + 题干约 40-60 字，正常阅读 + 判断至少需 2 秒/题；
 * 1.2 秒/题意味着多数题是「没读完就点了」。
 * ⚠️ 没有计时数据时不判定（返回 false）—— 宁可漏报，不可误伤正常用户。
 */
function isHasty(bank: AssessmentBank, timing?: AssessTiming): boolean {
  const list = (timing?.perQuestion ?? []).filter((ms) => Number.isFinite(ms) && ms > 0)
  const total = bank.questions.length
  if (total === 0) return false
  // 至少要 2/3 的题有计时数据，才敢下这个结论
  if (list.length < Math.ceil(total * 0.66)) return false
  const mean = list.reduce((a, b) => a + b, 0) / list.length
  return mean < HASTRY_MS_PER_QUESTION
}

/** 过快作答阈值：平均每题毫秒数 */
export const HASTRY_MS_PER_QUESTION = 1200

/** 节奏信号：把平均作答时长映射到 0-1（1.2 秒 = 0，2.5 秒以上 = 1） */
function pacingSignal(bank: AssessmentBank, timing?: AssessTiming): { pacing: number; hasTiming: boolean } {
  const list = (timing?.perQuestion ?? []).filter((ms) => Number.isFinite(ms) && ms > 0)
  const total = bank.questions.length
  if (total === 0 || list.length < Math.ceil(total * 0.66)) return { pacing: 1, hasTiming: false }
  const mean = list.reduce((a, b) => a + b, 0) / list.length
  return { pacing: clamp01((mean - HASTRY_MS_PER_QUESTION) / (2500 - HASTRY_MS_PER_QUESTION)), hasTiming: true }
}

/**
 * 一次作答 → 一份完整评估（**唯一计分入口**）。
 * 页面、结果页、历史对比全部走这里，避免「各处各算一套」导致口径不一致。
 *
 * 计分口径说明（很重要）：
 *  - **未作答的题记 0 分**，但它的代价体现在 `completeness` 和 `confidence` 上，
 *    而不是悄悄稀释分数 —— 这样「漏答」不会被误读成「状态差」，只是结论可信度降低。
 *  - 弱-health 检测（位置惯性 / 自相矛盾 / 过快）**永不改分**：分数照算，
 *    只是在结果页提示并建议重测。改分会让用户觉得系统在偷偷替他做决定。
 */
export function evaluate(
  bank: AssessmentBank,
  picks: readonly (number | null | undefined)[],
  thresholds: TierThresholds = DEFAULT_TIER_THRESHOLDS,
  timing?: AssessTiming,
): EvaluatedAssessment {
  const bucket = new Map<AssessDim, DimScore>()
  let score = 0
  let maxScore = 0
  let answered = 0

  bank.questions.forEach((q, i) => {
    const qMax = questionMax(q)
    const got = scoreOf(q, picks[i])
    score += got
    maxScore += qMax
    if (picks[i] !== null && picks[i] !== undefined) answered += 1

    // 远端题库可能没写 dim（老配置）：只计总分，不进维度分布
    if (ASSESS_DIMS.some((m) => m.key === q.dim)) {
      const d = bucket.get(q.dim) ?? { dim: q.dim, score: 0, max: 0, count: 0 }
      d.score += got
      d.max += qMax
      d.count += 1
      bucket.set(q.dim, d)
    }
  })

  const total = bank.questions.length
  const ratio = maxScore > 0 ? score / maxScore : 0

  /* ---------------- 可信度信号 ---------------- */
  const { coherence, contradiction } = computeCoherence(bank, picks)
  const { pacing, hasTiming } = pacingSignal(bank, timing)

  const distinct = new Set(picks.filter((p): p is number => p !== null && p !== undefined)).size
  const half = Math.max(1, Math.ceil(total / 2) - 1)
  const variability = total > 1 ? clamp01((distinct - 1) / half) : 1
  const completeness = total > 0 ? clamp01(answered / total) : 0

  const signals: AssessSignals = { completeness, variability, coherence, pacing, hasTiming }
  const quality: AssessQuality = detectStraightLining(picks)
    ? 'straight'
    : contradiction
      ? 'inconsistent'
      : isHasty(bank, timing)
        ? 'hasty'
        : 'ok'

  return {
    score,
    maxScore,
    ratio,
    tier: tierOfRatio(ratio, thresholds),
    dims: ASSESS_DIMS.map((d) => bucket.get(d.key)).filter((d): d is DimScore => Boolean(d)),
    quality,
    answered,
    total,
    confidence: confidenceOf(signals, quality),
    signals,
  }
}

/** 信号 → 置信度。有过快/位置惯性的作答最多只能到「中」，再低就落「低」 */
function confidenceOf(s: AssessSignals, quality: AssessQuality): AssessConfidence {
  const weighted = s.hasTiming
    ? 0.35 * s.completeness + 0.25 * s.variability + 0.25 * s.coherence + 0.15 * s.pacing
    : 0.45 * s.completeness + 0.3 * s.variability + 0.25 * s.coherence
  if (quality !== 'ok') return weighted >= 0.8 ? 'mid' : 'low'
  if (weighted >= 0.8) return 'high'
  if (weighted >= 0.55) return 'mid'
  return 'low'
}

export function tierIndex(tier: AssessmentTier): 0 | 1 | 2 {
  return tier === 'low' ? 0 : tier === 'mid' ? 1 : 2
}

/**
 * 结果页用：找出最弱与最强的一维（按归一化得分率，而非原始分 —— 各维题量相同时等价，
 * 题量不同时归一化才公平）。题量不足或全满时返回 null（不做无根据的比较）。
 */
export function extremeDims(dims: readonly DimScore[]): { weakest: AssessDim | null; strongest: AssessDim | null } {
  if (dims.length < 2) return { weakest: null, strongest: null }
  const rank = dims.map((d) => ({ dim: d.dim, ratio: d.max > 0 ? d.score / d.max : 0 }))
  const sorted = [...rank].sort((a, b) => a.ratio - b.ratio)
  const lo = sorted[0]
  const hi = sorted[sorted.length - 1]
  // 差距太小（<0.08）就不指名孤立某一维 —— 那基本是噪声
  return {
    weakest: hi.ratio - lo.ratio >= 0.08 ? lo.dim : null,
    strongest: hi.ratio - lo.ratio >= 0.08 ? hi.dim : null,
  }
}

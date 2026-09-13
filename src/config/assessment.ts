/**
 * 首次测评题库 —— 三模式三套 6 题建档（普通·生活基线 / 科技·数字画像 / 修仙·灵根检测）。
 *
 * ── 这一版为了「更准、更可靠」做了四件事，且**一题都没有加** ──────────────
 *  1. **维度化**：每题标注它主要测量的维度（观 / 止 / 知 / 行）。
 *     用户仍然只点 6 次，但结果从「一个分数」变成「一个分数 + 一张维度图」：
 *     信息量更大，也直接告诉用户下一步该练哪一维（内容效度）。
 *  2. **比例分档**：不再用绝对分，而是用「得分 ÷ 本题库实际满分」。
 *     原实现写死「≤6 低 / ≥13 高」（按 6 题 18 分标定）—— 一旦运营侧把题目改成
 *     8 题或改了分值，阈值就整体错位、分档失去意义。现在阈值是比例，题库怎么改都成立。
 *  3. **满分逐题算**：满分 = 各题选项最高分之和，允许运营侧写 0-2 分的题，
 *     不再假定「每题一定 0-3 分」。
 *  4. **作答质量检测**：识别两类最常见的无效作答 ——
 *       · 位置惯性（每道题都选同一个位置，即不看题乱点）
 *       · 前后矛盾（同一维度里，顺序被倒置的题与顺序正常的题答案差到接近两极）
 *     判为低质量时**不判废、不清零**（那会挫伤用户），只在结果页提示并建议 30 天后重测。
 *
 * 诚实的边界：6 题是「自我盘点」，不是心理测量量表（真量表的信度 α≥0.7 通常要 10 题以上）。
 * 所以这里的目标是「同一份回答，结论稳定可复现、跨版本可比」，而不是给用户贴标签。
 *
 * ⚠️ 题库数据在本地与远端各有一份：本文件是**兜底**，运营位
 *    InsightActionBacend/config/content.json 是**覆盖**（见 stores/content.ts）。
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

/* ============================ 题型 ============================ */

export interface AssessmentOption {
  /** 选项文案 */
  text: string
  /** 该选项的**真实得分**（0-3；始终按这个字段计分，与 flipped 无关） */
  score: number
}

export interface AssessmentQuestion {
  q: string
  /** 本题主要测量的维度 */
  dim: AssessDim
  /**
   * 选项顺序倒置：本题把「最佳选项」排在最前（与同维度其它题相反）。
   *
   * 用途只有一个：**检测位置惯性作答** —— 不看题、一路点第一项的人，
   * 在正常题上会拿低分、在倒置题上却拿高分，两者一对比就露馅。
   * 计分不受它影响（永远按 option.score），所以写错这个字段最坏只是
   * 少一次质量检测，不会算错分。
   */
  flipped?: boolean
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
    intro: '摸清你当下的生活节奏。没有标准答案，如实就好。',
    submitLabel: '建档完成',
    questions: [
      {
        q: '清晨睁开眼，你通常会先做什么？',
        dim: 'action',
        options: [
          { text: '先刷上十几二十分钟手机再说', score: 0 },
          { text: '躺着刷一会儿，再慢慢起来', score: 1 },
          { text: '洗漱吃饭，忙完正事才碰手机', score: 2 },
          { text: '睁眼就开始今天的正事', score: 3 },
        ],
      },
      {
        q: '做正事时，能连续专注多久不被手机打断？',
        dim: 'pause',
        options: [
          { text: '很难超过 10 分钟', score: 0 },
          { text: '半小时左右就想去摸手机', score: 1 },
          { text: '能专注一两小时', score: 2 },
          { text: '大半天都不怎么碰', score: 3 },
        ],
      },
      {
        /* 顺序倒置题：最佳选项排在第一位（用于位置惯性检测） */
        q: '晚上临睡前，你一般在做什么？',
        dim: 'pause',
        flipped: true,
        options: [
          { text: '到点就睡，沾枕头就着', score: 3 },
          { text: '看会儿书或听点什么', score: 2 },
          { text: '刷到眼皮打架才睡', score: 1 },
          { text: '短视频一刷就停不下来', score: 0 },
        ],
      },
      {
        q: '感到无聊或焦虑时，你的第一反应是？',
        dim: 'observe',
        options: [
          { text: '立刻拿起手机', score: 0 },
          { text: '大多时候会去摸手机', score: 1 },
          { text: '偶尔，多数能忍住', score: 2 },
          { text: '能安静地待一会儿', score: 3 },
        ],
      },
      {
        /* 顺序倒置题：最佳选项排在第一位 */
        q: '这一周，你有几天出门走动或运动？',
        dim: 'action',
        flipped: true,
        options: [
          { text: '五天以上', score: 3 },
          { text: '三四天', score: 2 },
          { text: '一两天', score: 1 },
          { text: '几乎没有', score: 0 },
        ],
      },
      {
        q: '过去一个月，你完整读完过书或长文吗？',
        dim: 'reflect',
        options: [
          { text: '一本都没读完', score: 0 },
          { text: '读过几篇长文', score: 1 },
          { text: '读完过一本薄书', score: 2 },
          { text: '读完两本以上', score: 3 },
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
    intro: '用数据给现在的你画一张像。参数如实填写，越诚实越准。',
    submitLabel: '生成画像',
    questions: [
      {
        q: '估算今天纯屏幕时间（非工作用途）有多少？',
        dim: 'pause',
        options: [
          { text: '4 小时以上', score: 0 },
          { text: '2-4 小时', score: 1 },
          { text: '1-2 小时', score: 2 },
          { text: '不到 1 小时', score: 3 },
        ],
      },
      {
        /* 顺序倒置题 */
        q: '收到消息通知，你通常？',
        dim: 'pause',
        flipped: true,
        options: [
          { text: '通知常年静音，主动去看', score: 3 },
          { text: '攒到固定时间集中处理', score: 2 },
          { text: '经常被打断去看', score: 1 },
          { text: '有红点就想点开', score: 0 },
        ],
      },
      {
        q: '同时开着好几件事时，你？',
        dim: 'observe',
        options: [
          { text: '常忘了上一件做到哪', score: 0 },
          { text: '手忙脚乱勉强应付', score: 1 },
          { text: '能分清主次有序切换', score: 2 },
          { text: '习惯一次只做一件', score: 3 },
        ],
      },
      {
        q: '你每天主动摄取的新信息，主要来自？',
        dim: 'reflect',
        options: [
          { text: '被动刷到什么看什么', score: 0 },
          { text: '各平台的信息流推送', score: 1 },
          { text: '固定的几个订阅与作者', score: 2 },
          { text: '围绕明确主题的深入阅读', score: 3 },
        ],
      },
      {
        /* 顺序倒置题 */
        q: '关于「记录」，你的日常是？',
        dim: 'reflect',
        flipped: true,
        options: [
          { text: '有完整的记录与复盘系统', score: 3 },
          { text: '有固定的清单或日记', score: 2 },
          { text: '想到了才记一笔', score: 1 },
          { text: '基本不记录', score: 0 },
        ],
      },
      {
        /* 顺序倒置题 */
        q: '一天结束回想今天，你通常觉得？',
        dim: 'observe',
        flipped: true,
        options: [
          { text: '心里有本明白账', score: 3 },
          { text: '大致清楚做了什么', score: 2 },
          { text: '有点乱，理不清', score: 1 },
          { text: '想不起自己干了什么', score: 0 },
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
    intro: '测一测你心性的根骨。灵根有优劣，修行无早晚。',
    submitLabel: '灵根既定',
    questions: [
      {
        q: '独自安静时（无手机），杂念多久会涌上来？',
        dim: 'pause',
        options: [
          { text: '几乎静不下来，念头没停过', score: 0 },
          { text: '撑一两分钟就想动', score: 1 },
          { text: '能安静坐一阵子', score: 2 },
          { text: '极少杂念，安定自如', score: 3 },
        ],
      },
      {
        /* 顺序倒置题 */
        q: '面对剧、游戏、美食这类诱惑，你能自控多久？',
        dim: 'pause',
        flipped: true,
        options: [
          { text: '诱惑于我如浮云', score: 3 },
          { text: '大部分时候守得住', score: 2 },
          { text: '只能撑一时', score: 1 },
          { text: '基本抵挡不住', score: 0 },
        ],
      },
      {
        q: '别人的一句评价，会扰乱你多久？',
        dim: 'observe',
        options: [
          { text: '一整天都在想', score: 0 },
          { text: '好几个小时', score: 1 },
          { text: '一阵子就过去了', score: 2 },
          { text: '听过即忘，不入心', score: 3 },
        ],
      },
      {
        /* 顺序倒置题 */
        q: '刷到一条很刺激、引战的内容，你会？',
        dim: 'observe',
        flipped: true,
        options: [
          { text: '基本无感', score: 3 },
          { text: '能忍住，划走', score: 2 },
          { text: '忍不住要评论两句', score: 1 },
          { text: '立刻想回击、转发', score: 0 },
        ],
      },
      {
        q: '最近一次对自己许诺「要做到」，结果如何？',
        dim: 'action',
        options: [
          { text: '没做到，早忘了', score: 0 },
          { text: '勉强完成了一半', score: 1 },
          { text: '做到了', score: 2 },
          { text: '说到做到，从不失言', score: 3 },
        ],
      },
      {
        q: '你觉得自己更接近哪种状态？',
        dim: 'pause',
        options: [
          { text: '被日子推着走', score: 0 },
          { text: '常心浮气躁，定不住', score: 1 },
          { text: '时有静定，能自己拿主意', score: 2 },
          { text: '气定神闲，处变不惊', score: 3 },
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
 * 标定依据：0.35 大致对应「6 题里只答对 2 题」，0.7 对应「6 题拿 13 分以上」——
 * 与旧版绝对阈值（≤6 / ≥13，满分 18）完全等价，但对题库题量变化免疫。
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

export interface DimScore {
  dim: AssessDim
  score: number
  max: number
}

/** 作答质量：ok 正常 / straight 位置惯性 / inconsistent 前后矛盾 */
export type AssessQuality = 'ok' | 'straight' | 'inconsistent'

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
}

const avg = (list: number[]): number | null => (list.length ? list.reduce((a, b) => a + b, 0) / list.length : null)

/**
 * 作答质量检测。两条规则都只用「答案本身」判断，不依赖任何外部数据：
 *  1. 位置惯性：每道题都选了同一个位置（第 1 项、第 2 项…），且确实每题都选了；
 *  2. 前后矛盾：同一维度里，顺序倒置的题与顺序正常的题，归一化到 0-3 量表后
 *     平均分相差 ≥2.5（≈ 一个说「从不」一个说「总是」）——同一维度上自相矛盾。
 * 注意：**只用于提示，不用于判废**。真实用户也可能在某维度上确实矛盾。
 */
export function assessQuality(
  bank: AssessmentBank,
  picks: readonly (number | null | undefined)[],
): AssessQuality {
  const answered = picks.filter((p): p is number => p !== null && p !== undefined)
  if (answered.length >= bank.questions.length && new Set(answered).size === 1) return 'straight'

  for (const dim of ASSESS_DIMS) {
    const normal: number[] = []
    const flipped: number[] = []
    bank.questions.forEach((q, i) => {
      if (q.dim !== dim.key) return
      const p = picks[i]
      if (p === null || p === undefined) return
      const qMax = questionMax(q)
      if (qMax <= 0) return
      const v = (scoreOf(q, p) / qMax) * 3
      if (q.flipped) flipped.push(v)
      else normal.push(v)
    })
    const a = avg(normal)
    const b = avg(flipped)
    if (a !== null && b !== null && Math.abs(a - b) >= 2.5) return 'inconsistent'
  }

  return 'ok'
}

/**
 * 一次作答 → 一份完整评估（**唯一计分入口**）。
 * 页面、结果页、历史对比全部走这里，避免「各处各算一套」导致口径不一致。
 */
export function evaluate(
  bank: AssessmentBank,
  picks: readonly (number | null | undefined)[],
  thresholds: TierThresholds = DEFAULT_TIER_THRESHOLDS,
): EvaluatedAssessment {
  const bucket = new Map<AssessDim, DimScore>()
  let score = 0
  let maxScore = 0

  bank.questions.forEach((q, i) => {
    const qMax = questionMax(q)
    const got = scoreOf(q, picks[i])
    score += got
    maxScore += qMax

    // 远端题库可能没写 dim（老配置）：只计总分，不进维度分布
    if (ASSESS_DIMS.some((m) => m.key === q.dim)) {
      const d = bucket.get(q.dim) ?? { dim: q.dim, score: 0, max: 0 }
      d.score += got
      d.max += qMax
      bucket.set(q.dim, d)
    }
  })

  const ratio = maxScore > 0 ? score / maxScore : 0

  return {
    score,
    maxScore,
    ratio,
    tier: tierOfRatio(ratio, thresholds),
    dims: ASSESS_DIMS.map((d) => bucket.get(d.key)).filter((d): d is DimScore => Boolean(d)),
    quality: assessQuality(bank, picks),
  }
}

export function tierIndex(tier: AssessmentTier): 0 | 1 | 2 {
  return tier === 'low' ? 0 : tier === 'mid' ? 1 : 2
}

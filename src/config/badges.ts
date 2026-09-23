/**
 * 成就徽章规则 —— 本地数据即可判定的行为徽章（成就墙页与「我」页共用）。
 * 规则输入为一次性快照的计数（由调用方从各 store 汇总），config 不含 store 依赖。
 *
 * 文案里的 `{pause}` 这类占位符是**四维职能词**（静修 / 专注 / 定力 …）：
 * 说法随模式变，但 config 不能引 store，所以由页面用 badgeDesc(rule, dl) 注入。
 */
import type { AssessDim } from './assessment'
export interface BadgeContext {
  /** 做过首次测评（任一模式） */
  assessed: boolean
  /** 累计修为 */
  xp: number
  /** 累计静修分钟 */
  focusMin: number
  /** 当前连胜 / 最佳连胜 */
  focusStreakCur: number
  focusStreakBest: number
  /** 拷问：作答题数 / 当前连续作答 */
  answerTotal: number
  answerStreak: number
  /** 概念播种收成数 */
  seedHarvested: number
  /** 习惯：数量 / 最佳连续打卡 */
  habitTotal: number
  habitStreakMax: number
  /** 知识卡片总数 / 是否存在 Lv.3 卡 */
  cardTotal: number
  hasLv3: boolean
  /** 记住的箴言数 / 走完 1·3·7 天全部回响的句数 */
  proverbTotal: number
  proverbEchoed: number
  /** 痕迹：完成三件事事件数 / 盲盒完成数 */
  todoDone: number
  boxDone: number
  /** 行 · 计划：已收束的长期计划数（走完所有节点） */
  challengeCount: number
  /** 行 · 计划：已收束的「认知型」计划数（推翻自己原来的判断） */
  challengeCogCount: number
  /* ↓↓↓ 规格 §12.4 要求扩展的字段（上表 25 枚需要） ↓↓↓ */
  /** 观：累计读过的每日一则 */
  dailyReadCount: number
  /** 观：累计立的理（写下「为什么成立」并入册的才算） */
  theoryCount: number
  /** 观：累计提炼的母题 */
  motherCount: number
  /** 观：累计主动清理的囤积 */
  cleanCount: number
  /** 知：累计「我用上了」的次数 */
  applyCount: number
  /** 止：即时打断走完的次数（pause.interrupt） */
  interruptCount: number
  /** 止：连续立约且守住的天数 */
  vowKeepStreak: number
  /** 止：破约后写下原因的次数（诚实反思，比「没破」更值钱） */
  vowBreakReflect: number
  /** 止：戒断型日课里累计守住天数最多的一条（不要求连续，断了也不清零） */
  abstainBestKept: number
  /** 单日四环都有痕迹的天数 */
  crossHallDay: number
  /** 断卡 7 天之后又回来了 */
  comebackAfterBreak: boolean
  /** 行 · 身体：留下过步数读数的天数（累计，不要求连续） */
  bodyReadDays: number
  /** 行 · 身体：是否有过走到自己定的目标的一天 */
  bodyGoalHit: boolean
  /**
   * 我 · 回音壁：累计**成功送出**的反馈条数（本机留痕，见 stores/feedback.ts）。
   * 用它而不是"服务端有多少条"是刻意的：徽章是本地实时判定，不能因为一次网络不通就
   * 让一枚已经到手的徽章熄灭，也不能因此把从没说过话的人点亮。
   */
  feedbackCount: number
}

export interface BadgeRule {
  id: string
  name: string
  desc: string
  hit: (ctx: BadgeContext) => boolean
}

/**
 * 行为徽章（规格 §12.4 · 25 枚）。
 *
 * 重写原则：
 *  1. 覆盖四环各维（旧体系偏「行」）；
 *  2. 新增脊椎特有的四类：迁移（跨环）、清理、诚实反思、回归；
 *  3. **不设「连续 N 天未断」这类惩罚性徽章** —— 旧表里的 streak-3 / streak-7 已删除。
 *     断卡不归零是产品的立场，再发一枚「你没断」的徽章，等于变相惩罚那些断了的人。
 *
 * 关于箴言三枚：规格 §12.4 的表写于箴言体系之前，未包含它们；
 * 这里保留（2026-09-15 已上线）；2026-09-21 补了身体两枚、2026-09-23 又补了戒断两枚，
 * 所以实际是 25 + 3 + 2 + 2 = 32 枚。
 */
export const BADGE_RULES: readonly BadgeRule[] = [
  /* ---------------- 通用 ---------------- */
  { id: 'assess', name: '起点', desc: '完成首次测评建档，定下修行的起点', hit: (c) => c.assessed },
  { id: 'xp-500', name: '精进', desc: '累计修为达 500', hit: (c) => c.xp >= 500 },
  { id: 'cross-hall', name: '四维齐', desc: '在一天之内走完了观止知行四个环', hit: (c) => c.crossHallDay >= 1 },
  {
    id: 'comeback',
    name: '接上',
    desc: '离开 7 天之后重新回来 —— 不奖励「没断」，只奖励「回来了」',
    hit: (c) => c.comebackAfterBreak,
  },

  /* ---------------- 观 ---------------- */
  { id: 'observe-first', name: '开卷', desc: '读完第一则每日一则', hit: (c) => c.dailyReadCount >= 1 },
  { id: 'observe-30', name: '日日新', desc: '累计读完 30 则每日一则', hit: (c) => c.dailyReadCount >= 30 },
  { id: 'theory-1', name: '立言', desc: '立下第一条自己的理（写下「为什么成立」才算）', hit: (c) => c.theoryCount >= 1 },
  { id: 'theory-10', name: '成说', desc: '立下 10 条理', hit: (c) => c.theoryCount >= 10 },
  { id: 'mother-1', name: '得道', desc: '提炼出第一个母题', hit: (c) => c.motherCount >= 1 },
  { id: 'clean-10', name: '舍', desc: '主动清理 10 条囤积 —— 收藏夹不养僵尸', hit: (c) => c.cleanCount >= 10 },

  /* ---------------- 止 ---------------- */
  { id: 'pause-first', name: '一念', desc: '第一次在冲动里停了下来', hit: (c) => c.interruptCount >= 1 },
  /* 下面两条用到「止」的职能词 → 走 {pause} 占位符（普通=静修 / 科技=专注 / 修仙=定力） */
  { id: 'pause-60', name: '定心', desc: '累计{pause}满 60 分钟', hit: (c) => c.focusMin >= 60 },
  { id: 'pause-300', name: '静根', desc: '累计{pause}满 300 分钟', hit: (c) => c.focusMin >= 300 },
  { id: 'vow-7', name: '守七', desc: '连续 7 天立约并且都守住了', hit: (c) => c.vowKeepStreak >= 7 },
  {
    id: 'vow-honest',
    name: '直心',
    desc: '违约后写下原因，累计 3 次 —— 知道自己为什么破，比没破更值钱',
    hit: (c) => c.vowBreakReflect >= 3,
  },
  /*
   * 戒断两枚（2026-09-23）：禁欲这类长期的事值得有回声 —— 它是「需要毅力」的典型，
   * 而此前成就墙上与它相关的只有「守七」（连续 7 天立约）。入口在「止 · 立约」的"长约"。
   * 门槛按**累计守住天数**：断了不清零、不惩罚（与下面「不设连续 N 天未断」同一条原则）。
   */
  { id: 'abstain-30', name: '守月', desc: '一条戒断记录累计守住 30 天', hit: (c) => c.abstainBestKept >= 30 },
  { id: 'abstain-100', name: '百天', desc: '一条戒断记录累计守住 100 天', hit: (c) => c.abstainBestKept >= 100 },

  /* ---------------- 知 ---------------- */
  { id: 'reflect-first', name: '反观', desc: '完成第一次省察作答', hit: (c) => c.answerTotal >= 1 },
  { id: 'card-5', name: '纳新', desc: '知识库沉淀满 5 张卡片', hit: (c) => c.cardTotal >= 5 },
  { id: 'card-20', name: '贯通', desc: '知识库沉淀满 20 张卡片', hit: (c) => c.cardTotal >= 20 },
  { id: 'apply-1', name: '知行', desc: '第一次把一条理「用上了」', hit: (c) => c.applyCount >= 1 },
  { id: 'apply-10', name: '合一', desc: '累计 10 次「我用上了」', hit: (c) => c.applyCount >= 10 },

  /* ---------------- 行 ---------------- */
  { id: 'todo-1', name: '成事', desc: '完成第一件「今日三件事」', hit: (c) => c.todoDone >= 1 },
  { id: 'todo-30', name: '践行者', desc: '累计完成 30 件「今日三件事」', hit: (c) => c.todoDone >= 30 },
  { id: 'habit-streak-7', name: '持恒', desc: '某个习惯连续打卡满 7 天', hit: (c) => c.habitStreakMax >= 7 },
  { id: 'challenge-1', name: '破局', desc: '收束第一条长期计划（把所有步子走完）', hit: (c) => c.challengeCount >= 1 },
  {
    id: 'challenge-cog',
    name: '疑己',
    desc: '完成一个认知型计划：推翻自己原来的一个判断',
    hit: (c) => c.challengeCogCount >= 1,
  },
  /*
   * 身体两枚（2026-09-21）：身体电量此前在成就体系里**零引用** —— 做了也不会有任何回声。
   * 门槛刻意避开两件事：不设「连续 N 天」（那是惩罚性 streak，旧表里的已删），
   * 也不用绝对步数（"走过一万步"是系统在评判）；「走到满格」对的是**你自己设的目标**。
   */
  { id: 'body-remember', name: '记起身体', desc: '有 30 天留下过身体读数', hit: (c) => c.bodyReadDays >= 30 },
  {
    id: 'body-full',
    name: '走到满格',
    desc: '有一天走到了你自己定的目标步数',
    hit: (c) => c.bodyGoalHit,
  },

  /*
   * 箴言：规格 §12.4 的 25 枚表里没有它（表写于箴言体系之前），保留 2026-09-15 上线的三枚。
   * 只认两件事 —— 「记住过」与「回响完了」：收藏数本身不值得奖励（囤积不是修行）。
   */
  { id: 'proverb-1', name: '记心', desc: '记住第一句箴言', hit: (c) => c.proverbTotal >= 1 },
  { id: 'proverb-10', name: '拾穗', desc: '记住满 10 句箴言', hit: (c) => c.proverbTotal >= 10 },
  { id: 'proverb-echo', name: '回响', desc: '有一句箴言走完 1·3·7 天全部回响', hit: (c) => c.proverbEchoed >= 1 },

  /* ---------------- 我 · 回音壁（2026-09-23） ---------------- */
  /*
   * 门槛刻意只有 1：发帖与回应**不入修为**（口径见 config/feedback.ts），
   * 这一枚也不是"多发多得"的奖励 —— 它只记一件事：你说过话。
   */
  { id: 'feedback-1', name: '回音', desc: '往回音壁留下过一条', hit: (c) => c.feedbackCount >= 1 },
]

export function evaluateBadges(ctx: BadgeContext): { rule: BadgeRule; unlocked: boolean }[] {
  return BADGE_RULES.map((rule) => ({ rule, unlocked: rule.hit(ctx) }))
}

export function unlockedCount(ctx: BadgeContext): number {
  return BADGE_RULES.filter((r) => r.hit(ctx)).length
}

/**
 * 徽章描述取词：把 desc 里的 {observe|pause|reflect|action} 换成当前模式的说法。
 *
 * 用法（页面里）：
 *   const dl = useDimLabel()
 *   badgeDesc(rule, dl)
 *   → 普通「累计静修满 60 分钟」/ 科技「累计专注满 60 分钟」/ 修仙「累计定力满 60 分钟」
 */
export function badgeDesc(rule: BadgeRule, dim: (key: AssessDim) => string): string {
  return rule.desc.replace(/\{(observe|pause|reflect|action)\}/g, (_m, k: AssessDim) => dim(k))
}

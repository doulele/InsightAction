/**
 * 成就徽章规则 —— 本地数据即可判定的行为徽章（成就墙页与「我」页共用）。
 * 规则输入为一次性快照的计数（由调用方从各 store 汇总），config 不含 store 依赖。
 */
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
  /** 痕迹：完成三件事事件数 / 盲盒完成数 */
  todoDone: number
  boxDone: number
}

export interface BadgeRule {
  id: string
  name: string
  desc: string
  hit: (ctx: BadgeContext) => boolean
}

/** 行为徽章：可量化的修行里程碑 */
export const BADGE_RULES: readonly BadgeRule[] = [
  { id: 'seed', name: '立约', desc: '完成一次首次测评建档，定下修行的起点', hit: (c) => c.assessed },
  { id: 'first-xp', name: '初入道', desc: '累计入账 50 点修为', hit: (c) => c.xp >= 50 },
  { id: 'first-focus', name: '定心', desc: '累计静修满 60 分钟', hit: (c) => c.focusMin >= 60 },
  { id: 'focus-300', name: '静根', desc: '累计静修满 300 分钟', hit: (c) => c.focusMin >= 300 },
  { id: 'streak-3', name: '连定', desc: '静修连胜达 3 天', hit: (c) => c.focusStreakBest >= 3 },
  { id: 'streak-7', name: '守七', desc: '静修连胜达 7 天', hit: (c) => c.focusStreakBest >= 7 },
  { id: 'answer-1', name: '反观', desc: '完成第一次灵魂拷问作答', hit: (c) => c.answerTotal >= 1 },
  { id: 'answer-7', name: '复盘者', desc: '累计作答 7 天灵魂拷问', hit: (c) => c.answerTotal >= 7 },
  { id: 'card-5', name: '纳新', desc: '知识库沉淀满 5 张卡片', hit: (c) => c.cardTotal >= 5 },
  { id: 'card-20', name: '贯通', desc: '知识库沉淀满 20 张卡片', hit: (c) => c.cardTotal >= 20 },
  { id: 'lv3', name: '内化', desc: '拥有至少一张 Lv.3 内化卡片', hit: (c) => c.hasLv3 },
  { id: 'habit-1', name: '立习', desc: '创建第一个习惯', hit: (c) => c.habitTotal >= 1 },
  { id: 'habit-3', name: '持恒', desc: '习惯数量达到 3 个', hit: (c) => c.habitTotal >= 3 },
  { id: 'habit-streak', name: '坚韧', desc: '某个习惯连续打卡满 7 天', hit: (c) => c.habitStreakMax >= 7 },
  { id: 'seed-harvest', name: '播种者', desc: '收获第一颗播种的概念', hit: (c) => c.seedHarvested >= 1 },
  { id: 'todo-1', name: '成事', desc: '完成第一件「今日三件事」', hit: (c) => c.todoDone >= 1 },
  { id: 'todo-30', name: '践行者', desc: '累计完成 30 件「今日三件事」', hit: (c) => c.todoDone >= 30 },
  { id: 'box-1', name: '开盒', desc: '完成第一次微行动盲盒', hit: (c) => c.boxDone >= 1 },
]

export function evaluateBadges(ctx: BadgeContext): { rule: BadgeRule; unlocked: boolean }[] {
  return BADGE_RULES.map((rule) => ({ rule, unlocked: rule.hit(ctx) }))
}

export function unlockedCount(ctx: BadgeContext): number {
  return BADGE_RULES.filter((r) => r.hit(ctx)).length
}

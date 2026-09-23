/**
 * growth ——「我」页与档案子页共用的真实统计汇总。
 * 徽章上下文（buildBadgeContext）供「我」页入口与成就墙页展示；
 * 单日活跃度（dayStats）供「我」页今日四维与活跃日历页按天回看。
 * 注意：本模块的函数在组件 setup 求值期内调用（内部即时取 Pinia store）。
 */
import type { BadgeContext } from '@/config/badges'
import { BADGE_RULES } from '@/config/badges'
import type { HallId } from '@/config/lexicon'
import { dateKeyOf } from '@/utils/dateKey'
import { useAssessmentStore } from '@/stores/assessment'
import { useBadgeStore } from '@/stores/badges'
import { useBodyStore } from '@/stores/body'
import { useFocusStore } from '@/stores/focus'
import { useHabitStore } from '@/stores/habit'
import { useKnowledgeStore } from '@/stores/knowledge'
import { usePlanStore } from '@/stores/plan'
import { useProverbStore, reviewFinished } from '@/stores/proverb'
import { useQuestionStore } from '@/stores/question'
import { useSeedStore } from '@/stores/seed'
import { useTraceStore, type Trace } from '@/stores/trace'
import { useFeedbackStore } from '@/stores/feedback'
import { useVowStore } from '@/stores/vow'
import { useXpStore } from '@/stores/xp'

/** 从全部 store 汇总一次性徽章快照（本地可判定的行为数据） */
export function buildBadgeContext(): BadgeContext {
  const assessment = useAssessmentStore()
  const body = useBodyStore()
  const xp = useXpStore()
  const focus = useFocusStore()
  const question = useQuestionStore()
  const seed = useSeedStore()
  const habit = useHabitStore()
  const knowledge = useKnowledgeStore()
  const trace = useTraceStore()
  const plan = usePlanStore()
  const proverb = useProverbStore()
  const vow = useVowStore()
  const feedback = useFeedbackStore()

  return {
    assessed: Object.values(assessment.results).some((r) => r !== null),
    xp: xp.total,
    focusMin: focus.days.reduce((sum, d) => sum + d.minutes, 0),
    focusStreakCur: focus.currentStreak,
    focusStreakBest: focus.bestStreak,
    answerTotal: Object.values(question.records).filter((r) => Boolean(r.answer)).length,
    answerStreak: question.consecutiveDays(),
    seedHarvested: seed.seeds.filter((s) => Boolean(s.harvestAt)).length,
    habitTotal: habit.habits.length,
    habitStreakMax: habit.habits.reduce((max, h) => Math.max(max, habit.streakOf(h.id)), 0),
    cardTotal: knowledge.cards.length,
    hasLv3: knowledge.cards.some((c) => c.depth === 3),
    proverbTotal: proverb.items.length,
    proverbEchoed: proverb.items.filter(reviewFinished).length,
    todoDone: trace.countKind('action.todo'),
    boxDone: countBoxDone(trace.list),
    /* 「走完一条长路」只认收束态：立 flag 不算，节点全走完才算（对齐 action.challenge 的给分口径） */
    challengeCount: plan.plans.filter((p) => p.kind === 'long' && p.status === 'done').length,
    /*
     * 认知型同样只认长期档（2026-09-22 修正）：这一枚与上面的「破局」是同一句话的两种问法，
     * 漏掉 kind 筛选就成了"今日这一步也算推翻了一个判断"，与「破局」的口径装不到一起去。
     */
    challengeCogCount: plan.plans.filter((p) => p.kind === 'long' && p.status === 'done' && p.challenge === 'cog')
      .length,

    /* ↓ 规格 §12.4 新增：观的四类计数 + 知的「用上了」 */
    dailyReadCount: trace.countKind('observe.daily'),
    theoryCount: trace.countKind('observe.theory'),
    motherCount: trace.countKind('observe.mother'),
    cleanCount: trace.countKind('observe.clean'),
    applyCount: trace.countKind('reflect.apply'),
    interruptCount: trace.countKind('pause.interrupt'),
    vowKeepStreak: vow.keepStreak,
    /* 破约必须写下原因（stores/vow.ts 的 breakIt 强制），所以「破了」的次数 = 诚实反思的次数 */
    vowBreakReflect: vow.tally.broken,
    /*
     * 戒断长约（2026-09-23）：「守月 / 百天」两枚徽章 + 立约页的里程碑刻度共用这一个数。
     * 取**累计守住天数**（progressOf().done）而非当前连续 —— 连续断了会归零，
     * 拿它当门槛就成了"一次破戒全盘皆输"，与项目"断卡不归零"的立场相反。
     */
    abstainBestKept: plan.dailyPlans
      .filter((p) => p.challenge === 'abstain')
      .reduce((max, p) => Math.max(max, plan.progressOf(p).done), 0),
    crossHallDay: crossHallDays(trace.list),
    comebackAfterBreak: hasComeback(trace.list),

    /* 身体两枚（2026-09-21）：步数只在本机，取计数即可，不涉及网络 */
    bodyReadDays: body.readDays,
    bodyGoalHit: body.goalHitCount > 0,

    /* 回音壁一枚（2026-09-23）：同样只在本机，取成功送出过的条数 */
    feedbackCount: feedback.sent,
  }
}

/** 「盲盒达成」这条痕迹的 ref：写痕时必须带上，之后才能把"开出那只盒"与"走出那一步"分开 */
export const BOX_DONE_REF = 'box-done'
/** 老版本没有 ref，靠这句文案兜底；换新文案**必须**同步这里，否则历史记录会集体漏算 */
export const BOX_DONE_TEXT = '完成今日微行动'

/** 一条 action.box 痕迹是不是「达成」（而不是开出那只盒本身） */
export function isBoxDone(t: Trace): boolean {
  return t.ref === BOX_DONE_REF || t.text.includes(BOX_DONE_TEXT)
}

/**
 * 「盲盒达成」的计数口径 —— 只认 HOME 页面上那一次「完成今日微行动」。
 *
 * 这里为什么不用 `t.value > 0`：安息日与配额会让 value 归零而**行为照常发生**
 * （见 config/trace.ts 的 DAY_CAP 与 utils/sabbath.ts），那样会把真实的一次达成漏掉。
 * 也不要再写在调用处 —— `text.includes('完成')` 这种匹配一旦文案动一个字就全线失效，
 * 之前它在 utils 与 weekly 页里各写了一份（两份口径已经开始分叉）。
 */
export function countBoxDone(traces: Trace[]): number {
  return traces.filter((t) => t.kind === 'action.box' && isBoxDone(t)).length
}

/**
 * 当下命中的徽章 id。
 *
 * 判定规则仍然只有 `config/badges.ts` 一份，这里不过是把它跑一遍 —— 别在此处补第二个真相。
 */
export function hitBadgeIds(ctx: BadgeContext = buildBadgeContext()): string[] {
  return BADGE_RULES.filter((r) => r.hit(ctx)).map((r) => r.id)
}

/**
 * 把当下命中的徽章并入点亮留痕，返回**本次新点亮**的 id 列表（无新增则为空数组）。
 *
 * 有副作用（写 `stores/badges`），所以只在页面 `onShow` 里调一次，**不要放进 computed** ——
 * 渲染期写 store 会把"看一眼"变成"每帧都在记账"。
 */
export function syncBadgeLedger(silent = false): string[] {
  return useBadgeStore().syncUnlocked(hitBadgeIds(), silent)
}

/** 一枚徽章的三态 —— 成就墙要能把「此刻仍满足」与「曾经点亮」分开讲 */
export interface BadgeState {
  /** 此刻仍然满足达成条件 */
  now: boolean
  /** 点亮过（当下命中 or 有留痕）—— 这才是"是否已解锁"的口径 */
  ever: boolean
  /** 首次点亮的时刻；从没点亮过为 0 */
  at: number
}

/**
 * 三态一次算清（2026-09-22 加 `now` 与 `at`）。
 *
 * 为什么要分开：并集解决了"点亮被收回"，但也把两种不同的处境糊成了一句「已解锁」——
 * 一种是"你此刻正走在这条路上"，另一种是"你走过，后来断了"。
 * 前者值得留着热度，后者不该被判成没发生过（规格 §12.4 删掉的正是惩罚性徽章）。
 * 判定规则仍然只有 `config/badges.ts` 一份，这里只负责补上"什么时候点亮的"。
 */
export function badgeStates(ctx: BadgeContext = buildBadgeContext()): Record<string, BadgeState> {
  const ledger = useBadgeStore()
  const out: Record<string, BadgeState> = {}
  for (const r of BADGE_RULES) {
    const now = r.hit(ctx)
    const at = ledger.atOf(r.id)
    out[r.id] = { now, ever: now || at > 0, at }
  }
  return out
}

/**
 * 徽章墙 / 入口计数的**统一口径**：当下命中 ∪ 已留痕。
 *
 * 取并集的理由（2026-09-22）：持恒与守七这类依赖"当下连续状态"的徽章，
 * 一旦漏了一天就会实时熄灭 —— 那是把"结束了一段连胜"罚成"这段连胜没发生过"。
 */
export function badgeUnlockedMap(ctx: BadgeContext = buildBadgeContext()): Record<string, boolean> {
  const states = badgeStates(ctx)
  const out: Record<string, boolean> = {}
  for (const id of Object.keys(states)) out[id] = states[id].ever
  return out
}

/** 按上面的口径数出已点亮枚数（顺手把留痕同步回来，省一次全量扫描） */
export function badgeUnlockedCount(ctx: BadgeContext = buildBadgeContext()): number {
  return Object.values(badgeUnlockedMap(ctx)).filter(Boolean).length
}

/** 单日走完四环的天数：四个环在同一天都留下痕迹才算一天 */
function crossHallDays(traces: Trace[]): number {
  const byDay = new Map<string, Set<HallId>>()
  for (const t of traces) {
    const set = byDay.get(t.day) ?? new Set<HallId>()
    set.add(t.hall)
    byDay.set(t.day, set)
  }
  let n = 0
  for (const set of byDay.values()) {
    if (set.size >= 4) n += 1
  }
  return n
}

/**
 * 是否「离开了 7 天又回来」。
 * 判定：存在相邻两个活跃日相隔 ≥7 天 —— 中间那段空白就是离开，后一个活跃日就是回来。
 * 只奖励回归，不惩罚缺席：断卡本身不在这套数据里留下任何负面记号。
 */
function hasComeback(traces: Trace[]): boolean {
  const days = [...new Set(traces.map((t) => t.day))].sort()
  for (let i = 1; i < days.length; i++) {
    const gap =
      (new Date(`${days[i]}T00:00:00`).getTime() - new Date(`${days[i - 1]}T00:00:00`).getTime()) / 86_400_000
    if (gap >= 7) return true
  }
  return false
}

/** 单日活跃度：一个自然日里六类来源的真实投入 */
export interface DayStats {
  /** 'YYYY-MM-DD' */
  date: string
  /** 止：该日静修分钟 */
  focusMin: number
  /**
   * 观：该日观环痕迹数（每日一则互动 / 收下 / 立理 / 提炼母题 / 清理收件）。
   *
   * 2026-09-17 换口径：原先是「辨源标注次数」（对来源投有用 / 没用），而那个动作
   * 已经没有入口了（来龙去脉见 utils/sourceLedger.ts 的注释）—— 指标会永远是 0，
   * 于是四维雷达、活跃日历、日课卡里的「观」会集体熄灭。
   * 改成数观环痕迹：零新增数据、与「行」的 traces 同一口径，且每一条都对应真实行为。
   */
  obsN: number
  /** 行：该日痕迹事件数（三件事 / 习惯 / 盲盒） */
  traces: number
  /** 行：该日习惯打卡数（习惯 × 天，与痕迹流互为补充） */
  habitDone: number
  /** 知：该日新建知识卡片数 */
  cards: number
  /** 知：该日题期的拷问是否作答 */
  answered: boolean
}

/** 某自然日的六类来源投入快照 */
export function dayStats(dateKey: string): DayStats {
  const focus = useFocusStore()
  const question = useQuestionStore()
  const habit = useHabitStore()
  const knowledge = useKnowledgeStore()
  const trace = useTraceStore()
  /* 一天扫一次痕迹，观环数量与总条数共用同一趟 —— 别为两个数字各扫一遍 */
  const dayTraces = trace.ofDay(dateKey)
  return {
    date: dateKey,
    focusMin: focus.minutesOn(dateKey),
    obsN: dayTraces.filter((t) => t.hall === 'observe').length,
    traces: dayTraces.length,
    habitDone: habit.doneOn(dateKey),
    cards: knowledge.countOn(dateKey),
    answered: Boolean(question.records[dateKey]?.answer),
  }
}

/** 活跃的维度数 0-6：观 / 止 / 行(痕迹) / 行(习惯) / 知(卡) / 知(拷问) */
export function activeDimCount(s: DayStats): number {
  let n = 0
  if (s.obsN > 0) n += 1
  if (s.focusMin > 0) n += 1
  if (s.traces > 0) n += 1
  if (s.habitDone > 0) n += 1
  if (s.cards > 0) n += 1
  if (s.answered) n += 1
  return n
}

/**
 * 止念条（规格 v2 §4.2 轴一「止念」层）：知这一环最容易停在纸上。
 *
 * 判据：今天**产出过东西**（卡片 / 省察作答）却一次「我用上了」都没有 ——
 * 此时不再劝人多写，而是建议"停笔，去实践"。
 *
 * **知大厅与止大厅共用这一条判定，别各写一份** —— 口径分叉会让同一天两页说法不一样。
 * 产出为 0 时返回空串：那会让「知」还没开始就被劝退。
 */
export function stopPenTip(): string {
  const day = dateKeyOf(new Date())
  const st = dayStats(day)
  const produced = st.cards + (st.answered ? 1 : 0)
  if (produced <= 0) return ''
  const used = useTraceStore().ofDay(day).some((t) => t.kind === 'reflect.apply')
  if (used) return ''
  return `今天写了 ${produced} 条，一条都还没用上 —— 用过的才算你的。`
}

/** [from, to]（含两端，YYYY-MM-DD）内有活跃入账的天数 */
export function activeDaysInRange(from: string, to: string): number {
  const start = new Date(`${from}T12:00:00`)
  const end = new Date(`${to}T12:00:00`)
  let n = 0
  const cursor = new Date(start)
  while (cursor.getTime() <= end.getTime()) {
    if (activeDimCount(dayStats(dateKeyOf(cursor))) > 0) n += 1
    cursor.setDate(cursor.getDate() + 1)
  }
  return n
}

/** 年度回顾：一年内本机真实投入的汇总 */
export interface YearStats {
  year: number
  /** 有投入的自然日数（六类来源取并集） */
  activeDays: number
  /** 静修分钟 */
  focusMin: number
  /** 观环痕迹数（口径同 DayStats.obsN） */
  obsN: number
  /** 新建知识卡片数 */
  cards: number
  /** 拷问作答天数 */
  answerDays: number
  /** 习惯打卡次数（习惯 × 天） */
  habitDone: number
  /** 痕迹条数 */
  traces: number
  /** 年内入账修为（trace.value 合计，与雷达同一口径） */
  xp: number
  /** 四环入账 */
  halls: Record<HallId, number>
  /** 今年记住的箴言数 / 其中走完回响的 */
  proverbs: number
  proverbsEchoed: number
  /** 今年记住的句子里出现最多的标签（年度关键词，最多 3 个） */
  topTags: string[]
  /** 修为入账最多的一天 */
  bestDay: { date: string; value: number } | null
}

/**
 * 年度统计。**刻意不循环调用 dayStats** —— 那是一天一次全量扫描，
 * 365 次会把进页时间拖到秒级。这里对每类数据各扫一遍，按"年-月-"前缀归年。
 */
export function yearStats(year = new Date().getFullYear()): YearStats {
  const focus = useFocusStore()
  const question = useQuestionStore()
  const habit = useHabitStore()
  const knowledge = useKnowledgeStore()
  const trace = useTraceStore()
  const proverb = useProverbStore()

  const p = `${year}-`
  const inYear = (k: string): boolean => k.startsWith(p)

  const halls: Record<HallId, number> = { observe: 0, pause: 0, reflect: 0, action: 0 }
  /** 每天入账的修为（找"最投入的一天"） */
  const dayValue = new Map<string, number>()
  let xp = 0
  let traces = 0
  /** 观环痕迹数（口径同 DayStats.obsN） */
  let obsN = 0

  for (const t of trace.list) {
    if (!inYear(t.day)) continue
    traces += 1
    if (t.hall === 'observe') obsN += 1
    xp += t.value || 0
    halls[t.hall] += t.value || 0
    dayValue.set(t.day, (dayValue.get(t.day) ?? 0) + (t.value || 0))
  }

  /* 活跃天取并集：只看痕迹会漏掉「只静修没留痕」这类日子 */
  const active = new Set<string>()
  for (const t of trace.list) if (inYear(t.day)) active.add(t.day)

  let focusMin = 0
  for (const d of focus.days) {
    if (!inYear(d.date)) continue
    focusMin += d.minutes
    if (d.minutes > 0) active.add(d.date)
  }

  let cards = 0
  for (const c of knowledge.cards) {
    const k = dateKeyOf(c.createdAt)
    if (!inYear(k)) continue
    cards += 1
    active.add(k)
  }

  let answerDays = 0
  for (const [day, rec] of Object.entries(question.records)) {
    if (!inYear(day) || !rec?.answer) continue
    answerDays += 1
    active.add(day)
  }

  let habitDone = 0
  for (const days of Object.values(habit.records)) {
    for (const day of days) {
      if (!inYear(day)) continue
      habitDone += 1
      active.add(day)
    }
  }

  const provInYear = proverb.items.filter((it) => inYear(dateKeyOf(it.createdAt)))
  for (const it of provInYear) active.add(dateKeyOf(it.createdAt))

  /* 年度关键词 = 你反复留住的句子在说些什么；没有标签就不硬凑 */
  const tagCount = new Map<string, number>()
  for (const it of provInYear) {
    for (const t of it.tags ?? []) tagCount.set(t, (tagCount.get(t) ?? 0) + 1)
  }
  const topTags = [...tagCount.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(([t]) => t)

  let bestDay: { date: string; value: number } | null = null
  for (const [date, value] of dayValue) {
    if (value <= 0) continue
    if (!bestDay || value > bestDay.value) bestDay = { date, value }
  }

  return {
    year,
    activeDays: active.size,
    focusMin,
    obsN,
    cards,
    answerDays,
    habitDone,
    traces,
    xp,
    halls,
    proverbs: provInYear.length,
    proverbsEchoed: provInYear.filter(reviewFinished).length,
    topTags,
    bestDay,
  }
}

/** 某月已活跃天数（未来日期不计入；month 0-11） */
export function monthActiveCount(year: number, month: number): number {
  const now = new Date()
  const today = dateKeyOf(now)
  const isCurrent = now.getFullYear() === year && now.getMonth() === month
  const first = dateKeyOf(new Date(year, month, 1))
  const last = isCurrent ? today : dateKeyOf(new Date(year, month + 1, 0))
  if (first > last) return 0
  return activeDaysInRange(first, last)
}

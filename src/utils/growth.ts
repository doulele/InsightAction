/**
 * growth ——「我」页与档案子页共用的真实统计汇总。
 * 徽章上下文（buildBadgeContext）供「我」页入口与成就墙页展示；
 * 单日活跃度（dayStats）供「我」页今日四维与活跃日历页按天回看。
 * 注意：本模块的函数在组件 setup 求值期内调用（内部即时取 Pinia store）。
 */
import type { BadgeContext } from '@/config/badges'
import { useAssessmentStore } from '@/stores/assessment'
import { useFocusStore } from '@/stores/focus'
import { useHabitStore } from '@/stores/habit'
import { useKnowledgeStore } from '@/stores/knowledge'
import { useQualityStore } from '@/stores/quality'
import { useQuestionStore } from '@/stores/question'
import { useSeedStore } from '@/stores/seed'
import { useTraceStore } from '@/stores/trace'
import { useXpStore } from '@/stores/xp'

/** 从全部 store 汇总一次性徽章快照（本地可判定的行为数据） */
export function buildBadgeContext(): BadgeContext {
  const assessment = useAssessmentStore()
  const xp = useXpStore()
  const focus = useFocusStore()
  const question = useQuestionStore()
  const seed = useSeedStore()
  const habit = useHabitStore()
  const knowledge = useKnowledgeStore()
  const trace = useTraceStore()

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
    todoDone: trace.traces.filter((t) => t.type === 'todo').length,
    boxDone: trace.traces.filter((t) => t.type === 'box' && t.text.includes('完成')).length,
  }
}

/** 单日活跃度：一个自然日里六类来源的真实投入 */
export interface DayStats {
  /** 'YYYY-MM-DD' */
  date: string
  /** 止：该日静修分钟 */
  focusMin: number
  /** 观：该日辨源标注次数（有用 + 没用） */
  marks: number
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
  const quality = useQualityStore()
  const question = useQuestionStore()
  const habit = useHabitStore()
  const knowledge = useKnowledgeStore()
  const trace = useTraceStore()
  return {
    date: dateKey,
    focusMin: focus.minutesOn(dateKey),
    marks: quality.marksOn(dateKey).total,
    traces: trace.ofDay(dateKey).length,
    habitDone: habit.doneOn(dateKey),
    cards: knowledge.countOn(dateKey),
    answered: Boolean(question.records[dateKey]?.answer),
  }
}

/** 活跃的维度数 0-6：观 / 止 / 行(痕迹) / 行(习惯) / 知(卡) / 知(拷问) */
export function activeDimCount(s: DayStats): number {
  let n = 0
  if (s.marks > 0) n += 1
  if (s.focusMin > 0) n += 1
  if (s.traces > 0) n += 1
  if (s.habitDone > 0) n += 1
  if (s.cards > 0) n += 1
  if (s.answered) n += 1
  return n
}

/** 日期工具：本地自然日（calendar 页使用） */
export function fmtKey(d: Date): string {
  const m = `${d.getMonth() + 1}`.padStart(2, '0')
  const day = `${d.getDate()}`.padStart(2, '0')
  return `${d.getFullYear()}-${m}-${day}`
}

/** [from, to]（含两端，YYYY-MM-DD）内有活跃入账的天数 */
export function activeDaysInRange(from: string, to: string): number {
  const start = new Date(`${from}T12:00:00`)
  const end = new Date(`${to}T12:00:00`)
  let n = 0
  const cursor = new Date(start)
  while (cursor.getTime() <= end.getTime()) {
    if (activeDimCount(dayStats(fmtKey(cursor))) > 0) n += 1
    cursor.setDate(cursor.getDate() + 1)
  }
  return n
}

/** 某月已活跃天数（未来日期不计入；month 0-11） */
export function monthActiveCount(year: number, month: number): number {
  const now = new Date()
  const today = fmtKey(now)
  const isCurrent = now.getFullYear() === year && now.getMonth() === month
  const first = fmtKey(new Date(year, month, 1))
  const last = isCurrent ? today : fmtKey(new Date(year, month + 1, 0))
  if (first > last) return 0
  return activeDaysInRange(first, last)
}

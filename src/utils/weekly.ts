/**
 * 周报组装（规格 §14）。
 *
 * 为什么单独拆一个模块：页面的「四环分布 / 一条路 / 小枢一句话」三处口径必须一致，
 * 散在页面里改一处漏一处，最后时间轴与周报会报出两个数字。
 *
 * 三条硬规则（照着规格来的）：
 *  1. **【一条路】只能由 trace 的 ref 生成** —— 它是脊椎的跨环叙事，也是这一页最值钱的部分。
 *     没有跨环关联就显示"还没连成线"，**绝不编造**。
 *  2. **小枢一句话由规则生成，不靠 AI**：找本周痕迹最多的环（最稳）与最少的环（最弱），套话术。
 *  3. **下周留白由用户自己写**，不自动填（页面负责存读，这里不碰）。
 */
import { todayKey } from '@/stores/daily'
import type { HallId } from '@/config/lexicon'
import type { ModeId } from '@/config/modes'
import { levelName } from '@/config/levels'
import { TAB_LABEL } from '@/config/skins'
import type { Trace } from '@/stores/trace'
import type { TraceKind } from '@/config/trace'
import { useTraceStore } from '@/stores/trace'
import { useFocusStore } from '@/stores/focus'
import { useKnowledgeStore } from '@/stores/knowledge'
import { usePlanStore } from '@/stores/plan'
import { useXpStore } from '@/stores/xp'
import { HOUR_BAND_LABEL, bandOf, useUrgeStore } from '@/stores/urge'
import type { HourBand } from '@/stores/urge'
import { refTitle } from '@/utils/refSource'
import { isSabbathDay } from '@/utils/sabbath'

export const HALLS: readonly HallId[] = ['observe', 'pause', 'reflect', 'action']

export interface WeeklyReport {
  from: string
  to: string
  /** 四环分布（本周 trace 条数） */
  hallCount: Record<HallId, number>
  /** 本周入账修为 */
  xpGain: number
  /** 累计修为 / 当前阶位 */
  xpTotal: number
  level: string
  /** 一条路：跨环叙事，可能为空 */
  path: string[]
  /** 四环各自的一行 */
  halls: Record<HallId, string>
  /** 小枢一句话（规则生成） */
  buddy: string
  /** 本周没有任何痕迹 */
  empty: boolean
  /**
   * 本周的安息日（2026-09-17）。
   * 刻意单独列出来：那天"没有痕迹"是**休**，不是缺口 —— 周报必须把它标出来，
   * 否则用户会以为自己漏了几天（那就又变回打卡焦虑了）。
   */
  sabbathDays: string[]
}

/** 事件 → 动词（「你在 9/3 立下「X」」的第一处） */
const VERB: Record<TraceKind, string> = {
  'observe.daily': '读到',
  'observe.source': '存下',
  'observe.theory': '立下',
  'observe.mother': '提炼出',
  'observe.clean': '清掉',
  'pause.interrupt': '挡下',
  'pause.vow': '立约',
  'pause.vow.keep': '守住',
  'pause.vow.break': '破约',
  'pause.cooldown': '静修',
  'pause.urge': '记下',
  'pause.thought': '止念',
  'reflect.note': '写下',
  'reflect.apply': '用上',
  'reflect.probe': '自省',
  'reflect.echo': '重看',
  'reflect.capsule': '拆开',
  'reflect.thread': '认出',
  'action.todo': '做成',
  'action.habit': '打卡',
  'action.box': '开盒',
  'action.challenge': '走完',
  'action.body': '记下',
  'action.daily': '守住',
  'action.daily.break': '记下',
  'action.closing': '收功',
}

/**
 * 可作为「一条路」第二处的事件。
 * 只列说得通的几种（"用上了它""做成了它"），其余不参与 —— 宁可少一句，也不出怪句。
 */
const PATH_SECOND: Partial<Record<TraceKind, string>> = {
  'reflect.apply': '用上了它',
  'action.todo': '做成了它',
  'reflect.note': '为它写下了一句',
  'pause.vow': '为它立了一次约',
  'pause.urge': '又撞上它一次',
  'action.challenge': '为它走完了一条长路',
}

/** 小枢的一句话：三模式各一套话术（规则生成，不调 AI） */
const BUDDY_LINE: Record<ModeId, (best: string, worst: string) => string> = {
  normal: (b, w) => `这周你最稳的是「${b}」，最弱的是「${w}」——下周要不要从「${w}」开始补？`,
  tech: (b, w) => `本周 ${b} 数据最好，${w} 最弱 —— 下周把 ${w} 提上来试试？`,
  dao: (b, w) => `本周「${b}」最盛，「${w}」最虚 —— 下周先补「${w}」。`,
}

/** '2026-09-03' → '9/3' */
function dayText(day: string): string {
  const [, m, d] = day.split('-')
  return `${Number(m)}/${Number(d)}`
}

function daysBetween(a: string, b: string): number {
  const t1 = new Date(`${a}T00:00:00`).getTime()
  const t2 = new Date(`${b}T00:00:00`).getTime()
  return Math.round((t2 - t1) / 86_400_000)
}

function dayOf(ts: number): string {
  return todayKey(new Date(ts))
}

function joinNonEmpty(parts: string[]): string {
  const list = parts.filter(Boolean)
  return list.length ? list.join(' · ') : '这周这一环是空的'
}

/**
 * 【一条路】：同一 ref 上出现了不同环的事件，才叫一条路。
 * 例如：9/3 立下一条理（观）→ 9/5 用上了它（知）→ "你在 9/3 立下「延迟满足」，9/5 用上了它（2 天）"
 */
function buildPath(traces: Trace[]): string[] {
  const groups = new Map<string, Trace[]>()
  for (const t of traces) {
    if (!t.ref) continue
    const g = groups.get(t.ref) ?? []
    g.push(t)
    groups.set(t.ref, g)
  }

  const out: string[] = []
  for (const [ref, list] of groups) {
    if (list.length < 2) continue
    const sorted = [...list].sort((a, b) => a.at - b.at)
    const first = sorted[0]
    const second = sorted.slice(1).find((t) => t.hall !== first.hall && PATH_SECOND[t.kind])
    if (!second || !first) continue
    // ref 指向的对象可能已被删，此时退回痕迹自身的文本，不留空壳
    const title = refTitle(ref) || first.text.slice(0, 12)
    const gap = daysBetween(first.day, second.day)
    const tail = gap > 0 ? `（隔了 ${gap} 天）` : '（同一天）'
    out.push(
      `你在 ${dayText(first.day)}${VERB[first.kind]}「${title}」，${dayText(second.day)}${PATH_SECOND[second.kind] ?? '又回到它'}${tail}`,
    )
    if (out.length >= 3) break
  }
  return out
}

/**
 * 冲动的形状：同一次触发点攒够 2 次、且多数落在同一时段才敢下结论。
 * 样本不足就不说话 —— "这周想下单 1 次" 不是结论，是噪音。
 */
function buildUrgeLine(from: string, to: string): string {
  const list = useUrgeStore().records.filter((r) => r.day >= from && r.day <= to)
  if (list.length < 2) return ''

  const groups = new Map<string, typeof list>()
  for (const r of list) {
    const g = groups.get(r.trigger) ?? []
    g.push(r)
    groups.set(r.trigger, g)
  }
  let top: { trigger: string; list: typeof list } | null = null
  for (const [trigger, arr] of groups) {
    if (!top || arr.length > top.list.length) top = { trigger, list: arr }
  }
  if (!top || top.list.length < 2) return ''

  const bands = new Map<HourBand, number>()
  for (const r of top.list) {
    const b = bandOf(r.hour)
    bands.set(b, (bands.get(b) ?? 0) + 1)
  }
  let band: HourBand | null = null
  let n = 0
  for (const [b, c] of bands) {
    if (c > n) {
      n = c
      band = b
    }
  }
  if (!band || n / top.list.length < 0.6) return ''
  return `这周有 ${top.list.length} 次「${top.trigger}」的冲动，${n === top.list.length ? '都' : '多数'}发生在${HOUR_BAND_LABEL[band]}`
}

function buildHalls(traces: Trace[], from: string, to: string): Record<HallId, string> {
  const n = (k: TraceKind): number => traces.filter((t) => t.kind === k).length
  const focus = useFocusStore()
  const knowledge = useKnowledgeStore()
  const plan = usePlanStore()

  const newCards = knowledge.cards.filter((c) => {
    const d = dayOf(c.createdAt)
    return d >= from && d <= to
  })

  const observe = joinNonEmpty([
    n('observe.daily') ? `读了 ${n('observe.daily')} 则` : '',
    n('observe.theory') ? `立了 ${n('observe.theory')} 条理` : '',
    n('observe.clean') ? `清了 ${n('observe.clean')} 条囤积` : '',
  ])

  const minutes = focus.totalBetween(from, to)
  const vowN = n('pause.vow')
  const breakN = n('pause.vow.break')
  const pause = joinNonEmpty([
    minutes > 0 ? `静修 ${minutes} 分钟` : '',
    vowN ? `立约 ${vowN} 次守住 ${n('pause.vow.keep')} 次${breakN ? `（破了 ${breakN} 次，你写下了原因）` : ''}` : '',
    n('pause.urge') ? `冲动 ${n('pause.urge')} 次` : '',
    n('pause.thought') ? `止念 ${n('pause.thought')} 次` : '',
  ])

  const lv3 = newCards.filter((c) => c.depth === 3).length
  const reflect = joinNonEmpty([
    newCards.length ? `写了 ${newCards.length} 张卡片` : '',
    lv3 ? `${lv3} 张到了 Lv.3` : '',
    n('reflect.probe') ? `自省 ${n('reflect.probe')} 次` : '',
  ])

  const action = joinNonEmpty([
    n('action.todo') ? `完成 ${n('action.todo')} 件` : '',
    plan.activeLongCount ? `${plan.activeLongCount} 条长路在走` : '',
    /* 日课（2026-09-17）：守住的天数单列 —— 它与"完成了几件事"不是同一个量 */
    n('action.daily') ? `守住日课 ${n('action.daily')} 天` : '',
    plan.activeDailyCount ? `${plan.activeDailyCount} 条日课在守` : '',
    n('action.box') ? `盲盒 ${n('action.box')} 次` : '',
    n('action.closing') ? `收功 ${n('action.closing')} 次` : '',
  ])

  return { observe, pause, reflect, action }
}

/** 组装一份周报（在 setup 求值期调用，内部即时取 store） */
export function buildWeekly(from: string, to: string, mode: ModeId): WeeklyReport {
  const traces = useTraceStore().between(from, to)
  const xp = useXpStore()

  const hallCount: Record<HallId, number> = { observe: 0, pause: 0, reflect: 0, action: 0 }
  let xpGain = 0
  for (const t of traces) {
    hallCount[t.hall] = (hallCount[t.hall] ?? 0) + 1
    xpGain += t.value || 0
  }

  const path = buildPath(traces)
  const urgeLine = buildUrgeLine(from, to)
  if (urgeLine) path.push(urgeLine)

  const ranked = HALLS.map((h) => ({ h, n: hallCount[h] })).sort((a, b) => b.n - a.n)
  const best = ranked[0]
  const worst = ranked[ranked.length - 1]
  const buddy =
    !best || best.n === 0 || !worst || worst.h === best.h
      ? ''
      : BUDDY_LINE[mode](TAB_LABEL[best.h], TAB_LABEL[worst.h])

  return {
    from,
    to,
    hallCount,
    xpGain,
    xpTotal: xp.total,
    level: levelName(mode, xp.levelXp),
    path,
    halls: buildHalls(traces, from, to),
    buddy,
    empty: traces.length === 0,
    sabbathDays: sabbathIn(from, to),
  }
}

/** 区间内的安息日（含首尾） */
function sabbathIn(from: string, to: string): string[] {
  const out: string[] = []
  const end = new Date(`${to}T12:00:00`).getTime()
  let cur = new Date(`${from}T12:00:00`)
  let guard = 0
  while (cur.getTime() <= end && guard < 400) {
    const k = todayKey(cur)
    if (isSabbathDay(k)) out.push(k)
    /*
     * 按「日」推进，而不是加 86_400_000 毫秒（2026-09-22）：
     * 一天并不总是 24 小时 —— 实行夏令时的地区有 23 小时与 25 小时的日子，
     * 加毫秒会让正午偏移到前一天的后半夜，日 key 因此错位一整天。
     * 与 utils/dateKey.ts 的口径保持一致：跨天一律走 setDate。
     */
    cur.setDate(cur.getDate() + 1)
    guard += 1
  }
  return out
}

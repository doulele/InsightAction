/**
 * 计划 store ——「行」的长期落点（= 挑战升级版，2026-09-15 拍板）。
 *
 * 为什么把「挑战」升级成「计划」而不是再开一个模块：
 *  行大厅原本只有「今日三件事」（固定 3 格、跨天清零）+ 习惯打卡，**没有任何跨天的任务库**。
 *  一条「N 天不看短视频」或「做一件没做过的事」既不是习惯（要每天勾），也不是三件事（当天结清），
 *  于是有了这份数据：一条 Plan 承载长期目标，里面挂若干 Node（可以排到某一天做，也可以滚在待办池）。
 *
 * 四条定死的规则（对齐「少而深」，全部落在本文件里，页面不许绕过）：
 *  1. **建计划 0 分** —— 不奖励立 flag；节点完成记 action.todo(10)；
 *  2. **同一计划同一自然日只入账一次** —— 其余 value: 0 只留痕，防「把一个节点拆成五个」刷分；
 *  3. **计划收束（节点全完成）记 action.challenge(20)**，并可留一句回望进【知】（可跳过）；
 *  4. **today 型搁置满 3 天自动归档** —— 今日事过了两天缓冲就收走，待办池不会越滚越脏（不打扰、不惩罚）。
 *
 * 上限：同时在走的路 ≤ 3 个（**短期 / 中期 / 长期三档合计**，不是每档各 3）。
 *  分档只是为了让人看清"这一步要多久"，不是给人开三条并行队列 —— 能同时走完的路，
 *  从来不会因为分了档就变多。today 型（今天的步子）**不设硬上限**，只在超过一个舒适线时提示，不拦截。
 */
import { defineStore } from 'pinia'
import { computed, ref } from 'vue'
import { todayKey } from '@/stores/daily'
import { useTraceStore } from '@/stores/trace'
import { useKnowledgeStore } from '@/stores/knowledge'
import { logOnly, logTrace } from '@/utils/traceLog'

/** long = 跨天的长期目标；today = 只活今天的一件事（单步，不挂节点） */
export type PlanKind = 'long' | 'today'
export type PlanStatus = 'active' | 'done' | 'archived'
/** 挑战三型（对齐规格 §4.4；普通计划可不填） */
export type ChallengeType = 'abstain' | 'try' | 'cog'

/**
 * 期限档：一条路要走多久（「今日」之外的三档）。
 *
 * 为什么是**在计划上存一档**，而不是按「离目标日还剩几天」实时算：
 *  按剩余天数算，一条路会随日子流逝自己从「长期」滑到「中期」再到「短期」——
 *  它没变，位置却变了，用户会觉得是自己记错了。期限是立路时的一句话承诺，
 *  该跟着这条路固定下来。目标日只用来提醒，不用来重新分类。
 */
export type PlanHorizon = 'short' | 'mid' | 'long'
/** 短期上限：一周内走得完 */
export const SHORT_SPAN_DAYS = 7
/** 中期上限：一个月内走得完（超过即长期） */
export const MID_SPAN_DAYS = 30

/**
 * 路的**形态**（2026-09-17 新增 daily）。
 *
 * 为什么必须加这一维：有些路根本不是"分几步走完"，而是**同一件事重复 N 天** ——
 * 早睡、锻炼、戒色。用节点表达只有两条死路：建 30 个节点（荒谬），
 * 或者只在最后勾一次（中间 N 天完全没有抓手）。
 * 这类事原来的唯一去处是「习惯打卡」，而习惯没有期限、不会收束、没有回望 ——
 * 一条早睡会在列表里躺一辈子。
 *
 * 于是把「每天重复一次」收进计划：**日课（daily）** 与 **长路（steps）** 并存，
 * 各自计数（日课 ≤3 条、长路 ≤3 条，见 MAX_DAILY_ACTIVE / MAX_LONG_ACTIVE）。
 * 习惯打卡页保留，但把「有期限的日课」导流到这里（习惯页的「立为日课」）。
 *
 * 老数据没有这一项 → 一律按 steps 处理（见 cadenceOf），不需要迁移脚本。
 */
export type PlanCadence = 'steps' | 'daily'

/** 日课的每日状态：kept = 今天守住了；broken = 今天破了（只对戒断型有意义） */
export interface DailyCheck {
  /** YYYY-MM-DD */
  day: string
  state: 'kept' | 'broken'
  /** 破了的理由（写进【知】的那一句，可空） */
  note?: string
}

/** 日课目标天数的预设档 */
export const DAILY_PRESETS = [7, 21, 30, 100] as const
/** 同时在守的日课上限（与长路的 3 条分开算：两者的心智负担不是一回事） */
export const MAX_DAILY_ACTIVE = 3
/** 目标天数的合理区间：低于 3 天谈不上"每天"，高于一年已不是日课 */
export const DAILY_MIN_DAYS = 3
export const DAILY_MAX_DAYS = 365
/** 日课目标天数的默认值（新建时让用户改） */
export const DAILY_DEFAULT_DAYS = 21

/** 挑战三型 → 知识卡标签（收束回望写卡时用） */
const CHALLENGE_TAG: Record<ChallengeType, string> = {
  abstain: '戒断',
  try: '尝试',
  cog: '认知',
}

export interface PlanNode {
  id: number
  /** 节点标题（必填） */
  title: string
  /** 节点内容：判定标准 / 怎么做 */
  note?: string
  done: boolean
  doneAt?: number
  /** 派到哪一天做（YYYY-MM-DD）；空 = 未排期，滚在「待办池」 */
  dueDay?: string
}

export interface Plan {
  id: number
  title: string
  /** 计划内容：为什么做 / 做成什么样 */
  note?: string
  kind: PlanKind
  /**
   * 形态：steps（分几步走完，默认）/ daily（每天重复一次）。
   * 老数据没有这一项 → cadenceOf() 一律当 steps。
   */
  cadence?: PlanCadence
  /** 期限档：短期 / 中期 / 长期（老数据没有这一项，按 horizonOf 推；daily 型不用它） */
  horizon?: PlanHorizon
  nodes: PlanNode[]
  /** 日课型的每日记录（只有 daily 型会写） */
  checks?: DailyCheck[]
  /** 日课型的目标天数：勾满即收束 */
  targetDays?: number
  challenge?: ChallengeType
  /** YYYY-MM-DD */
  startDay: string
  /** 目标日（可选） */
  dueDay?: string
  status: PlanStatus
  doneAt?: number
  /** 收束回望已写卡的时刻（同一条计划只写一次，防刷卡片） */
  reflectedAt?: number
  /** 最近一次动作时刻（30 天无动作 → 提示继续 / 归档） */
  updatedAt: number
  /** 回指四环来源（脊椎 ref：理 / 卡片 / 冲动 / 立约） */
  ref?: { kind: string; id: number }
}

/** 同时在走的长期计划上限 */
export const MAX_LONG_ACTIVE = 3
/** 今日步子的舒适线（只提示不拦截） */
export const TODAY_STEP_COMFORT = 3
/** today 型搁置多少天后自动归档 */
export const TODAY_SHELF_LIMIT = 3
/** 长期计划多少天没动作 → 提示「还继续吗」 */
export const LONG_STALE_DAYS = 30

/** 统一的「一条可勾的步子」视图模型（今天要走的步子 / 待办池共用） */
export interface StepItem {
  /** 稳定 key：n-<planId>-<nodeId> / p-<planId> */
  key: string
  kind: 'node' | 'plan'
  planId: number
  nodeId?: number
  title: string
  planTitle: string
  done: boolean
  /** 逾期 / 搁置 */
  overdue: boolean
  /** 已搁置天数（未逾期为 0） */
  shelfDays: number
  challenge?: ChallengeType
}

/**
 * 日课的一条（行大厅与计划页共用）。
 *
 * 与 StepItem 刻意分开：步子是"做一次就划掉"，日课是"今天这一次记上没记上" ——
 * 前者的 key 里带 nodeId，后者按自然日算；混进一个列表会让勾选手势的含义变得含糊。
 */
export interface DailyItem {
  planId: number
  title: string
  /** 今天的状态：'' = 还没记（未记不等于破了，见 stores/plan.ts 的口径注释） */
  state: '' | 'kept' | 'broken'
  /** 已守住天数 */
  kept: number
  /** 目标天数 */
  target: number
  challenge?: ChallengeType
}

let uniq = 1

function nextId(): number {
  return Date.now() * 100 + (uniq++ % 100)
}

/** 两个自然日键之间相差的天数（b - a） */
function diffDays(a: string, b: string): number {
  const ta = new Date(`${a}T12:00:00`).getTime()
  const tb = new Date(`${b}T12:00:00`).getTime()
  return Math.round((tb - ta) / 86400000)
}

/**
 * 按「起日 → 目标日」的跨度判档：没定日子的一律算长期。
 *
 * 只用于两处：新建时用户没手动选档的兜底、以及**老数据**（分档之前立的路）的推算。
 * 一旦存了 horizon，就以存的那档为准 —— 见 PlanHorizon 的注释。
 */
export function horizonBySpan(startDay: string, dueDay?: string): PlanHorizon {
  if (!dueDay) return 'long'
  const span = diffDays(startDay, dueDay)
  if (span <= SHORT_SPAN_DAYS) return 'short'
  if (span <= MID_SPAN_DAYS) return 'mid'
  return 'long'
}

export const usePlanStore = defineStore(
  'plan',
  () => {
    const plans = ref<Plan[]>([])

    /* ---------------- 派生清单 ---------------- */

    /**
     * 形态判断：老数据没有 cadence → steps。
     * 页面一律用它，不要直接读 `p.cadence`（否则老数据会被判成日课或反过来）。
     */
    function cadenceOf(p: Plan): PlanCadence {
      return p.cadence ?? 'steps'
    }

    function isDaily(p: Plan): boolean {
      return cadenceOf(p) === 'daily'
    }

    /** 进行中的**长路**（steps 型）—— 日课不占这 3 个名额，两者分开计数 */
    const activeLong = computed(() =>
      plans.value.filter((p) => p.kind === 'long' && !isDaily(p) && p.status === 'active'),
    )

    /** 进行中的长路数（入口徽标 / 上限判定用） */
    const activeLongCount = computed(() => activeLong.value.length)

    /** 进行中的**日课**（每天重复一次的那几条） */
    const activeDaily = computed(() => plans.value.filter((p) => p.kind === 'long' && isDaily(p) && p.status === 'active'))

    /** 进行中的日课数 */
    const activeDailyCount = computed(() => activeDaily.value.length)

    function byId(id: number): Plan | undefined {
      return plans.value.find((p) => p.id === id)
    }

    /** 一条路的期限档：优先用它自己标的那档，老数据按起止跨度推 */
    function horizonOf(p: Plan): PlanHorizon {
      return p.horizon ?? horizonBySpan(p.startDay, p.dueDay)
    }

    /** 某一档的路（进行中在前，已收束 / 已归档在后）—— 与 longPlans 同序；日课不在此列 */
    function horizonPlans(h: PlanHorizon): Plan[] {
      return plans.value
        .filter((p) => p.kind === 'long' && !isDaily(p) && horizonOf(p) === h)
        .sort((a, b) => Number(a.status !== 'active') - Number(b.status !== 'active') || b.updatedAt - a.updatedAt)
    }

    /** 某一档还在走的路条数（tab 徽标用） */
    function horizonActiveCount(h: PlanHorizon): number {
      return horizonPlans(h).filter((p) => p.status === 'active').length
    }

    /** 日课：全部（进行中在前），与 longPlans 同序 */
    const dailyPlans = computed(() =>
      plans.value
        .filter((p) => p.kind === 'long' && isDaily(p))
        .sort((a, b) => Number(a.status !== 'active') - Number(b.status !== 'active') || b.updatedAt - a.updatedAt),
    )

    /** 进度口径：steps = done / (nodes.length || 1)；daily = 已守住 / 目标天数 */
    function progressOf(plan: Plan): { done: number; total: number; pct: number } {
      if (isDaily(plan)) {
        const total = plan.targetDays ?? DAILY_DEFAULT_DAYS
        const done = keptCountOf(plan)
        return { done, total, pct: Math.min(100, Math.round((done / Math.max(1, total)) * 100)) }
      }
      const total = plan.nodes.length || 1
      const done = plan.nodes.filter((n) => n.done).length
      return { done, total, pct: Math.round((done / total) * 100) }
    }

    /** 「下一节点」：第一个未完成节点（全完成返回 null） */
    function nextNodeOf(plan: Plan): PlanNode | null {
      return plan.nodes.find((n) => !n.done) ?? null
    }

    /** 剩余天数（无目标日返回 null；已过返回负数） */
    function remainDaysOf(plan: Plan, day = todayKey()): number | null {
      if (!plan.dueDay) return null
      return diffDays(day, plan.dueDay)
    }

    /* ---------------- 日课（2026-09-17） ----------------
     * 每天重复一次的事：早睡 / 锻炼 / 戒色。
     *
     * 两条口径（与立约同一套）：
     *  1. **未记 ≠ 破了**：三态是"守住 / 破了 / 没记"，没记只是空白。
     *     一旦把"没勾"当"破了"，打卡就变回了自我审判（这也是原来习惯打卡的隐患）。
     *  2. **破了不归零、不扣分**：只记一笔（action.daily.break）并可写一句为什么，
     *     那一句进【知】的省察 —— 知道自己为什么破，比没破更有价值。
     */

    /** 已守住的次数（broken 不计） */
    function keptCountOf(plan: Plan): number {
      return (plan.checks ?? []).filter((c) => c.state === 'kept').length
    }

    /** 某天的日课记录 */
    function checkOf(plan: Plan, day = todayKey()): DailyCheck | undefined {
      return (plan.checks ?? []).find((c) => c.day === day)
    }

    /** 今天该守的日课（只列进行中的） */
    function dailyToday(day = todayKey()): DailyItem[] {
      const out: DailyItem[] = []
      for (const p of plans.value) {
        if (p.kind !== 'long' || !isDaily(p) || p.status !== 'active') continue
        const hit = checkOf(p, day)
        out.push({
          planId: p.id,
          title: p.title,
          state: hit ? hit.state : '',
          kept: keptCountOf(p),
          target: p.targetDays ?? DAILY_DEFAULT_DAYS,
          challenge: p.challenge,
        })
      }
      // 还没记的排前面（今天先看得见该守什么），破了的不排后 —— 它不是"更差"
      return out
    }

    /** 今天还没记的日课数（大厅提示用） */
    function dailyRemainCount(day = todayKey()): number {
      return dailyToday(day).filter((d) => d.state === '').length
    }

    /**
     * 勾今天（守住 / 做成）。
     * 再点一次 = 取消今天这一笔（同一天不留两条，勾错了好退）。
     * @returns done = 今天现在是不是"守住"；closed = 是否刚好勾满目标天数（页面据此弹回望）
     */
    function checkDaily(planId: number, day = todayKey()): { done: boolean; closed: boolean } {
      const p = byId(planId)
      if (!p || !isDaily(p)) return { done: false, closed: false }
      const checks = p.checks ?? (p.checks = [])
      const hit = checks.find((c) => c.day === day)

      if (hit && hit.state === 'kept') {
        /*
         * 取消今天这一笔：只留痕，不回滚"已守住"的历史（历史那一刻是真的）。
         * **已收束的也允许撤** —— 勾满目标天数当天就收束了，若那一下勾错了
         * （或只是想再守一天），不该卡在"已完成"里动不了；撤了就把状态退回在守。
         */
        p.checks = checks.filter((c) => c.day !== day)
        if (p.status === 'done') {
          p.status = 'active'
          p.doneAt = undefined
        }
        touch(p)
        logOnly({ kind: 'action.daily', text: `${p.title}（撤销今天）`, ref: `plan-${p.id}` })
        return { done: false, closed: false }
      }

      /* 新增勾选必须在守；上面那条取消分支有意放在这个判断之前 */
      if (p.status !== 'active') return { done: false, closed: false }

      if (hit) {
        hit.state = 'kept'
        hit.note = undefined
      } else {
        checks.push({ day, state: 'kept' })
      }
      touch(p)
      /*
       * 每天一次、同一条日课算一次（DAY_CAP 兜底）——
       * 一天勾三次不会再给分，但痕迹都留着（痕迹必须完整，否则周报会撒谎）。
       */
      logTrace({ kind: 'action.daily', text: p.title, ref: `plan-${p.id}` })

      const target = p.targetDays ?? DAILY_DEFAULT_DAYS
      if (keptCountOf(p) >= target) {
        closePlan(p.id, '')
        return { done: true, closed: true }
      }
      return { done: true, closed: false }
    }

    /** 今天破了（先不决策 / 没守住）—— 只记一笔，可写一句为什么 */
    function markDailyBroken(planId: number, reason = '', day = todayKey()): boolean {
      const p = byId(planId)
      if (!p || !isDaily(p) || p.status !== 'active') return false
      const checks = p.checks ?? (p.checks = [])
      const body = reason.trim()
      const hit = checks.find((c) => c.day === day)
      if (hit) {
        hit.state = 'broken'
        hit.note = body || undefined
      } else {
        checks.push({ day, state: 'broken', note: body || undefined })
      }
      touch(p)
      logOnly({ kind: 'action.daily.break', text: p.title, ref: `plan-${p.id}` })
      if (body) {
        useKnowledgeStore().add({
          kind: 'note',
          title: `破例：${p.title}`,
          content: body,
          tags: ['省察', '日课'],
          depth: 2,
          src: `行 · 日课 ${day}`,
        })
      }
      return true
    }

    /**
     * 改日课的目标天数（预设档与自定义都走这里）。
     * 刻意**允许随时改**：一开始定的天数本来就是猜的，走几天再调才是常态。
     * 改小了若已达标，就顺手收束（不留一条"已完成但还挂着"的路）。
     */
    function setTargetDays(planId: number, days: number): boolean {
      const p = byId(planId)
      if (!p || !isDaily(p)) return false
      const v = Math.round(Number(days))
      if (!Number.isFinite(v) || v < DAILY_MIN_DAYS || v > DAILY_MAX_DAYS) return false
      p.targetDays = v
      touch(p)
      if (p.status === 'active' && keptCountOf(p) >= v) closePlan(p.id, '')
      return true
    }

    /** 日课进度的一句话（不显示百分比 —— "守住 12 天 / 共 21 天"就是它的全部信息） */
    function dailyText(plan: Plan): string {
      const target = plan.targetDays ?? DAILY_DEFAULT_DAYS
      return `守住 ${keptCountOf(plan)} 天 / 共 ${target} 天`
    }

    /** 连续守住天数（从今天（或昨天）往前数；破了或没记就断，但**不归零**任何历史） */
    function dailyStreak(plan: Plan, day = todayKey()): number {
      const set = new Map((plan.checks ?? []).map((c) => [c.day, c.state]))
      let cursor = day
      // 今天还没记不算断：从昨天接着数（与习惯打卡的连续性口径一致）
      if (set.get(cursor) !== 'kept') {
        const d = new Date(`${cursor}T12:00:00`)
        d.setDate(d.getDate() - 1)
        cursor = todayKey(d)
      }
      let n = 0
      while (set.get(cursor) === 'kept') {
        n += 1
        const d = new Date(`${cursor}T12:00:00`)
        d.setDate(d.getDate() - 1)
        cursor = todayKey(d)
      }
      return n
    }

    /** 今天要走的步子：派到今天的未完成/已完成节点 ∪ today 型计划 */
    function stepsOf(day = todayKey()): StepItem[] {
      const out: StepItem[] = []
      for (const plan of plans.value) {
        /*
         * today 型必须先判、且**不能**受下面那句 `status !== 'active'` 管 ——
         * 它收束（status === 'done'）之后仍要留在今天这一列，否则勾完当场蒸发，
         * 用户看不到"我确实做完了"，只看到少了一行（取消勾选由 toggleStep 退回 active）。
         * 注意别写成 `if (status !== 'active') continue` 之后再比 done：
         * TS 那时已把 status 收窄成 'active'，那句判断是死代码，等于没修。
         */
        if (plan.kind === 'today') {
          if (plan.startDay !== day) continue
          if (plan.status === 'archived') continue // 搁置/放弃的不再出现在今天
          out.push({
            key: `p-${plan.id}`,
            kind: 'plan',
            planId: plan.id,
            title: plan.title,
            planTitle: plan.title,
            done: plan.status === 'done',
            overdue: false,
            shelfDays: 0,
            challenge: plan.challenge,
          })
          continue
        }
        if (plan.status !== 'active') continue
        for (const node of plan.nodes) {
          if (node.dueDay !== day) continue
          out.push({
            key: `n-${plan.id}-${node.id}`,
            kind: 'node',
            planId: plan.id,
            nodeId: node.id,
            title: node.title,
            planTitle: plan.title,
            done: node.done,
            overdue: false,
            shelfDays: 0,
            challenge: plan.challenge,
          })
        }
      }
      // 未完成的排前面（当天要先看得见该做什么）
      return out.sort((a, b) => Number(a.done) - Number(b.done))
    }

    /** 待办池：未排期节点 ∪ 逾期未完成节点 ∪ 搁置中的 today 型计划 */
    function poolStepsOf(day = todayKey()): StepItem[] {
      const out: StepItem[] = []
      for (const plan of plans.value) {
        if (plan.status !== 'active') continue
        if (plan.kind === 'today') {
          if (plan.startDay >= day) continue
          out.push({
            key: `p-${plan.id}`,
            kind: 'plan',
            planId: plan.id,
            title: plan.title,
            planTitle: plan.title,
            done: false,
            overdue: true,
            shelfDays: diffDays(plan.startDay, day),
            challenge: plan.challenge,
          })
          continue
        }
        for (const node of plan.nodes) {
          if (node.done) continue
          const overdue = Boolean(node.dueDay && node.dueDay < day)
          if (node.dueDay && !overdue) continue // 已排到未来 → 不进池
          out.push({
            key: `n-${plan.id}-${node.id}`,
            kind: 'node',
            planId: plan.id,
            nodeId: node.id,
            title: node.title,
            planTitle: plan.title,
            done: false,
            overdue,
            shelfDays: overdue && node.dueDay ? diffDays(node.dueDay, day) : 0,
            challenge: plan.challenge,
          })
        }
      }
      return out.sort((a, b) => b.shelfDays - a.shelfDays)
    }

    /** 待办池条数（大厅提示用） */
    function poolCount(day = todayKey()): number {
      return poolStepsOf(day).length
    }

    /**
     * 30 天无动作的**长路**（提示「还继续吗」）。
     * 日课不算在内 —— 它天天在勾，不会被判"没动"；哪天真不勾了，它自己会停在原地，
     * 也不必再弹一句"还继续吗"去催（催了就是打卡焦虑）。
     */
    function staleLong(day = todayKey()): Plan[] {
      return activeLong.value.filter((p) => diffDays(todayKey(new Date(p.updatedAt)), day) >= LONG_STALE_DAYS)
    }

    /* ---------------- 自动清理 ---------------- */

    /**
     * 搁置满 TODAY_SHELF_LIMIT 天的 today 型计划自动归档。
     * 刻意**不留痕、不提示**：这是收走，不是惩罚，也不是成就。
     */
    function sweep(day = todayKey()): number {
      let n = 0
      for (const plan of plans.value) {
        if (plan.status !== 'active') continue
        if (plan.kind !== 'today') continue
        if (diffDays(plan.startDay, day) >= TODAY_SHELF_LIMIT) {
          plan.status = 'archived'
          n += 1
        }
      }
      return n
    }

    /* ---------------- 增删改 ---------------- */

    function touch(plan: Plan): void {
      plan.updatedAt = Date.now()
    }

    function addPlan(input: {
      title: string
      note?: string
      kind: PlanKind
      challenge?: ChallengeType
      dueDay?: string
      /** 期限档（不传就按目标日的跨度推；daily 型不用它） */
      horizon?: PlanHorizon
      /** 形态：steps（默认）/ daily（每天重复一次） */
      cadence?: PlanCadence
      /** daily 型的目标天数（默认 21，区间 DAILY_MIN_DAYS ~ DAILY_MAX_DAYS） */
      targetDays?: number
      /** daily 型的起始记录：从习惯打卡转过来时把老记录一并带进来 */
      checks?: DailyCheck[]
      /** 建计划时一并立下的节点（可选） */
      nodes?: Array<{ title: string; note?: string; dueDay?: string }>
    }): Plan | null {
      const title = input.title.trim()
      if (!title) return null
      const cadence: PlanCadence = input.cadence ?? 'steps'
      /*
       * 上限分两本账：长路 ≤3、日课 ≤3。
       * 刻意不合并成一个"总活跃 ≤3"—— 一条"30 天早睡"与一条"重做作品集"占的心智不是一回事，
       * 合起来算会让人不敢开始任何一件小事。
       */
      if (input.kind === 'long') {
        if (cadence === 'daily' && activeDailyCount.value >= MAX_DAILY_ACTIVE) {
          uni.showToast({ title: `在守的日课已满 ${MAX_DAILY_ACTIVE} 条，走完再立`, icon: 'none' })
          return null
        }
        if (cadence === 'steps' && activeLongCount.value >= MAX_LONG_ACTIVE) {
          uni.showToast({ title: `先在走的长路已满 ${MAX_LONG_ACTIVE} 条，走完再立`, icon: 'none' })
          return null
        }
      }
      const now = Date.now()
      const day = todayKey()
      const targetDays =
        cadence === 'daily'
          ? Math.min(DAILY_MAX_DAYS, Math.max(DAILY_MIN_DAYS, Math.round(input.targetDays ?? DAILY_DEFAULT_DAYS)))
          : undefined
      const plan: Plan = {
        id: nextId(),
        title,
        note: input.note?.trim() || undefined,
        kind: input.kind,
        cadence: input.cadence,
        nodes: (input.nodes ?? [])
          .filter((n) => n.title.trim())
          .map((n) => ({
            id: nextId(),
            title: n.title.trim(),
            note: n.note?.trim() || undefined,
            done: false,
            dueDay: n.dueDay,
          })),
        checks: cadence === 'daily' ? (input.checks ?? []) : undefined,
        targetDays,
        challenge: input.challenge,
        horizon: input.horizon ?? horizonBySpan(day, input.dueDay),
        startDay: day,
        dueDay: input.dueDay,
        status: 'active',
        updatedAt: now,
      }
      plans.value.unshift(plan)
      /*
       * 日课从习惯转过来时，带进来的历史可能就够了 —— 那时它一立就该是收束态，
       * 否则会出现「守住 30 天 / 共 7 天、进度 100% 却还在走」的怪状态
       * （只在 checkDaily / setTargetDays 里判达标是不够的，建的那一刻也要判）。
       */
      if (cadence === 'daily' && targetDays !== undefined && keptCountOf(plan) >= targetDays) {
        closePlan(plan.id, '')
      }
      return plan
    }

    function updatePlan(
      id: number,
      patch: Partial<Pick<Plan, 'title' | 'note' | 'challenge' | 'dueDay' | 'horizon'>>,
    ): boolean {
      const plan = byId(id)
      if (!plan) return false
      if (typeof patch.title === 'string') {
        const t = patch.title.trim()
        if (!t) return false
        plan.title = t
      }
      if (patch.note !== undefined) plan.note = patch.note.trim() || undefined
      if (patch.challenge !== undefined) plan.challenge = patch.challenge
      if (patch.horizon !== undefined) plan.horizon = patch.horizon
      if (patch.dueDay !== undefined) plan.dueDay = patch.dueDay || undefined
      touch(plan)
      return true
    }

    /** 归档 / 放弃：只记一笔 0 分痕迹，不扣分、不惩罚 */
    function archivePlan(id: number, reason: 'give-up' | 'done-clean' = 'give-up'): boolean {
      const plan = byId(id)
      if (!plan) return false
      plan.status = 'archived'
      touch(plan)
      logOnly({
        kind: 'action.challenge',
        text: reason === 'give-up' ? `搁置「${plan.title}」` : `收走「${plan.title}」`,
        ref: `plan-${plan.id}`,
      })
      return true
    }

    function removePlan(id: number): void {
      plans.value = plans.value.filter((p) => p.id !== id)
    }

    /** 已收束 / 已归档的计划「重新开始」：状态回 active（不再补发修为、回望也不重复写卡） */
    function reopenPlan(id: number): boolean {
      const plan = byId(id)
      if (!plan || plan.status === 'active') return false
      plan.status = 'active'
      plan.doneAt = undefined
      touch(plan)
      return true
    }

    function addNode(planId: number, node: { title: string; note?: string; dueDay?: string }): boolean {
      const plan = byId(planId)
      const title = node.title.trim()
      if (!plan || !title) return false
      plan.nodes.push({
        id: nextId(),
        title,
        note: node.note?.trim() || undefined,
        done: false,
        dueDay: node.dueDay,
      })
      touch(plan)
      return true
    }

    function updateNode(
      planId: number,
      nodeId: number,
      patch: Partial<Pick<PlanNode, 'title' | 'note' | 'dueDay'>>,
    ): boolean {
      const plan = byId(planId)
      const node = plan?.nodes.find((n) => n.id === nodeId)
      if (!plan || !node) return false
      if (typeof patch.title === 'string') {
        const t = patch.title.trim()
        if (!t) return false
        node.title = t
      }
      if (patch.note !== undefined) node.note = patch.note.trim() || undefined
      if (patch.dueDay !== undefined) node.dueDay = patch.dueDay || undefined
      touch(plan)
      return true
    }

    function removeNode(planId: number, nodeId: number): void {
      const plan = byId(planId)
      if (!plan) return
      plan.nodes = plan.nodes.filter((n) => n.id !== nodeId)
      touch(plan)
    }

    /** 把节点派到今天（也用于「今天要走的步子」里的快速排期） */
    function scheduleNode(planId: number, nodeId: number, day: string): boolean {
      return updateNode(planId, nodeId, { dueDay: day })
    }

    /** 搁置的 today 型计划「继续」：把它带回今天（不改痕迹、不给分） */
    function rollToToday(planId: number, day = todayKey()): boolean {
      const plan = byId(planId)
      if (!plan || plan.status !== 'active') return false
      plan.startDay = day
      touch(plan)
      return true
    }

    /** 今天该计划是否已经入过账（同计划同日只给一次分） */
    function scoredToday(planId: number, day = todayKey()): boolean {
      const ref = `plan-${planId}`
      return useTraceStore().list.some((t) => t.kind === 'action.todo' && t.ref === ref && t.day === day && t.value > 0)
    }

    /**
     * 勾选 / 取消一条步子（节点或 today 型计划）。
     * 计分规则在本方法里闭环，页面不重复实现：
     *   完成 → action.todo（同计划同日第二次起 value: 0）；节点全完成 → 自动收束并记 action.challenge。
     * 返回 { done, closed }：done=本次勾选后的完成态；closed=本次是否触发计划收束（页面据此弹回望框）。
     */
    function toggleStep(planId: number, nodeId: number | undefined, day = todayKey()): { done: boolean; closed: boolean } {
      const plan = byId(planId)
      if (!plan) return { done: false, closed: false }

      if (plan.kind === 'today' || nodeId === undefined) {
        // 单步计划：整条勾掉即完成 → 直接收束
        const closing = plan.status === 'active'
        if (closing) {
          const value = scoredToday(plan.id, day) ? 0 : undefined
          logTrace({ kind: 'action.todo', text: plan.title, ref: `plan-${plan.id}`, value })
          closePlan(plan.id, '')
        } else {
          // 取消收束：回到进行中（不给分、不改痕迹）
          plan.status = 'active'
          plan.doneAt = undefined
          touch(plan)
        }
        return { done: plan.status === 'done', closed: closing }
      }

      const node = plan.nodes.find((n) => n.id === nodeId)
      if (!node) return { done: false, closed: false }

      if (node.done) {
        // 取消勾选：留痕但不给分；已收束的计划退回进行中
        node.done = false
        node.doneAt = undefined
        if (plan.status === 'done') {
          plan.status = 'active'
          plan.doneAt = undefined
        }
        logOnly({ kind: 'action.todo', text: `${plan.title} · ${node.title}（撤销）`, ref: `plan-${plan.id}` })
        touch(plan)
        return { done: false, closed: false }
      }

      node.done = true
      node.doneAt = Date.now()
      touch(plan)
      const value = scoredToday(plan.id, day) ? 0 : undefined
      logTrace({ kind: 'action.todo', text: `${plan.title} · ${node.title}`, ref: `plan-${plan.id}`, value })

      const allDone = plan.nodes.length > 0 && plan.nodes.every((n) => n.done)
      if (allDone) {
        closePlan(plan.id, '')
        return { done: true, closed: true }
      }
      return { done: true, closed: false }
    }

    /** 该计划是否已经入过「完成挑战」的分（防取消勾选后重复收束刷分） */
    function challengeScored(planId: number): boolean {
      const ref = `plan-${planId}`
      return useTraceStore().list.some((t) => t.kind === 'action.challenge' && t.ref === ref && t.value > 0)
    }

    /**
     * 计划收束：状态置 done。
     * 只有 **long 且 steps 型** 才记 action.challenge(20，同一条只给一次) ——
     *  - today 型是「今天多做的一件事」，完成时已记过 action.todo(10)，再给 20 是双重奖励；
     *  - **日课型也不给**：它的分已经按天给过了（守住一天一次 action.daily），
     *    收束时再给一笔 20 等于让日课变成刷分工具（30 天 = 240 + 20）。
     * reflection 非空时再写一张 Lv.2 知识卡（「行 → 知」的闭环；留空即跳过，不拦人）。
     */
    function closePlan(planId: number, reflection = ''): boolean {
      const plan = byId(planId)
      if (!plan || plan.status === 'done') return false
      plan.status = 'done'
      plan.doneAt = Date.now()
      touch(plan)
      if (plan.kind === 'long' && !isDaily(plan)) {
        logTrace({
          kind: 'action.challenge',
          text: plan.title,
          ref: `plan-${plan.id}`,
          value: challengeScored(plan.id) ? 0 : undefined,
        })
      }
      if (reflection.trim()) writeReflection(plan.id, reflection)
      return true
    }

    /**
     * 收束后补记一句回望 → 进【知】（Lv.2 重构）。
     * 可跳过；同一条计划只写一次卡（重复调用返回 false，避免刷卡片）。
     */
    function writeReflection(planId: number, text: string): boolean {
      const plan = byId(planId)
      const body = text.trim()
      if (!plan || !body || plan.reflectedAt) return false
      plan.reflectedAt = Date.now()
      useKnowledgeStore().add({
        kind: 'action',
        title: plan.title,
        content: body,
        tags: ['计划', plan.challenge ? CHALLENGE_TAG[plan.challenge] : '长期'],
        depth: 2,
        src: '行 · 计划收束',
      })
      return true
    }

    /* ---------------- 分组视图（列表页用） ---------------- */

    /** 长期 tab：进行中（未收束）在前，已收束 / 归档在后；日课单独一栏（dailyPlans） */
    const longPlans = computed(() =>
      plans.value
        .filter((p) => p.kind === 'long' && !isDaily(p))
        .sort((a, b) => Number(a.status !== 'active') - Number(b.status !== 'active') || b.updatedAt - a.updatedAt),
    )

    /** 今天 tab：今天新建的 today 型 + 今天派单的节点所属计划 */
    const todayPlans = computed(() =>
      plans.value
        .filter((p) => p.kind === 'today')
        .sort((a, b) => b.startDay.localeCompare(a.startDay) || b.updatedAt - a.updatedAt),
    )

    return {
      plans,
      activeLong,
      activeLongCount,
      activeDaily,
      activeDailyCount,
      dailyPlans,
      longPlans,
      todayPlans,
      stepsOf,
      poolStepsOf,
      poolCount,
      staleLong,
      sweep,
      byId,
      cadenceOf,
      isDaily,
      horizonOf,
      horizonPlans,
      horizonActiveCount,
      progressOf,
      nextNodeOf,
      remainDaysOf,
      /* 日课（2026-09-17） */
      keptCountOf,
      checkOf,
      dailyToday,
      dailyRemainCount,
      checkDaily,
      markDailyBroken,
      setTargetDays,
      dailyText,
      dailyStreak,
      addPlan,
      updatePlan,
      archivePlan,
      removePlan,
      reopenPlan,
      addNode,
      updateNode,
      removeNode,
      scheduleNode,
      rollToToday,
      scoredToday,
      toggleStep,
      closePlan,
      writeReflection,
      challengeScored,
    }
  },
  {
    persist: { key: 'plan', paths: ['plans'] },
  },
)

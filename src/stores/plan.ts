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
 * 上限：同时在走的 long 计划 ≤ 3 个（文案对齐习惯的「别贪多，先守住这 N 个」）；
 * today 型（今天的步子）**不设硬上限**，只在超过一个舒适线时提示，不拦截。
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
  nodes: PlanNode[]
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

export const usePlanStore = defineStore(
  'plan',
  () => {
    const plans = ref<Plan[]>([])

    /* ---------------- 派生清单 ---------------- */

    /** 进行中的长期计划 */
    const activeLong = computed(() => plans.value.filter((p) => p.kind === 'long' && p.status === 'active'))

    /** 进行中的长期计划数（入口徽标用） */
    const activeLongCount = computed(() => activeLong.value.length)

    function byId(id: number): Plan | undefined {
      return plans.value.find((p) => p.id === id)
    }

    /** 进度口径：done / (nodes.length || 1)；无节点视为单节点整体完成 */
    function progressOf(plan: Plan): { done: number; total: number; pct: number } {
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

    /** 30 天无动作的长期计划（提示「还继续吗」） */
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
      /** 建计划时一并立下的节点（可选） */
      nodes?: Array<{ title: string; note?: string; dueDay?: string }>
    }): Plan | null {
      const title = input.title.trim()
      if (!title) return null
      if (input.kind === 'long' && activeLongCount.value >= MAX_LONG_ACTIVE) {
        uni.showToast({ title: `先在走的长路已满 ${MAX_LONG_ACTIVE} 条，走完再立`, icon: 'none' })
        return null
      }
      const now = Date.now()
      const day = todayKey()
      const plan: Plan = {
        id: nextId(),
        title,
        note: input.note?.trim() || undefined,
        kind: input.kind,
        nodes: (input.nodes ?? [])
          .filter((n) => n.title.trim())
          .map((n) => ({
            id: nextId(),
            title: n.title.trim(),
            note: n.note?.trim() || undefined,
            done: false,
            dueDay: n.dueDay,
          })),
        challenge: input.challenge,
        startDay: day,
        dueDay: input.dueDay,
        status: 'active',
        updatedAt: now,
      }
      plans.value.unshift(plan)
      return plan
    }

    function updatePlan(
      id: number,
      patch: Partial<Pick<Plan, 'title' | 'note' | 'challenge' | 'dueDay'>>,
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
     * 只有 **long（跨天的长路）** 才记 action.challenge(20，同一条只给一次) ——
     * today 型是「今天多做的一件事」，它的完成已经记过 action.todo(10)，
     * 再给一次 20 分等于给临时待办发双重奖励。
     * reflection 非空时再写一张 Lv.2 知识卡（「行 → 知」的闭环；留空即跳过，不拦人）。
     */
    function closePlan(planId: number, reflection = ''): boolean {
      const plan = byId(planId)
      if (!plan || plan.status === 'done') return false
      plan.status = 'done'
      plan.doneAt = Date.now()
      touch(plan)
      if (plan.kind === 'long') {
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

    /** 长期 tab：进行中（未收束）在前，已收束 / 归档在后 */
    const longPlans = computed(() =>
      plans.value
        .filter((p) => p.kind === 'long')
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
      longPlans,
      todayPlans,
      stepsOf,
      poolStepsOf,
      poolCount,
      staleLong,
      sweep,
      byId,
      progressOf,
      nextNodeOf,
      remainDaysOf,
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

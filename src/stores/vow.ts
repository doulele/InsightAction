/**
 * 立约 store —— 「止」的当日档（规格 v2 §4.2）。
 *
 * 立约三要素（缺一不可，缺了它就退回成一句空 flag）：
 *   ① 触发条件 —— 什么时候会发生（「今天 22 点后」「拿起手机时」）
 *   ② 我承诺不做/做什么 —— 一句话，当天可判
 *   ③ 替代动作 —— 不做那件事时，手往哪放（「改看两页书」「直接去洗漱」）
 *
 * 四条铁律（对应规格 §4.2 与 §5 负面清单）：
 *  1. **只立当天**：跨天一律归档，不累计、不补立（长期交给「计划」）；
 *  2. **当日结束时回看**：守住了 / 破了，二选一；
 *  3. **破了必须写一句为什么** —— 这句直接进「知」（省察），
 *     用 10 秒时间成本换一次反思，且这句话会留下痕迹；
 *  4. **不扣修为、不中断连胜、不显示愧疚类文案** —— 全文案只陈述事实。
 */
import { defineStore } from 'pinia'
import { computed, ref } from 'vue'
import { todayKey } from '@/stores/daily'
import { useKnowledgeStore } from '@/stores/knowledge'
import { logTrace } from '@/utils/traceLog'

/** 'open' = 还没回看；'kept' = 守住；'broken' = 破了 */
export type VowStatus = 'open' | 'kept' | 'broken'

export interface Vow {
  day: string
  /** ① 触发条件 */
  trigger: string
  /** ② 我承诺 */
  promise: string
  /** ③ 替代动作 */
  action: string
  status: VowStatus
  /** 破约理由（破了必填，会进「知」） */
  reason?: string
  createdAt: number
  closedAt?: number
  /** 跨天时被自动归档（用户错过了当天的回看） */
  missed?: boolean
}

/** 历史留存上限：立约一天一条，60 条够回看两个月 */
const HISTORY_CAP = 60

/**
 * 「守多久」的预设天数（2026-09-23 加）—— 7 / 30 / 100。
 *
 * 这是**长约**（戒断型日课）的目标天数，不是当日档的：
 * 三个阶梯各有分量，一百天在中文语境里自带仪式感。
 * 想自定义天数去「行 · 计划」（那里有 3 ~ 365 的完整区间）。
 */
export const VOW_LONG_PRESETS = [7, 30, 100] as const

/**
 * 长约的里程碑刻度（2026-09-23 加）：达到就点亮，**只增不减**。
 *
 * 判据取"累计守住天数"而不是"当前连续"：连续断一天就归零，
 * 拿它当里程碑等于"一次破戒就全盘皆输" —— 与项目"断卡不归零、只奖励回来"的立场相反。
 * 与徽章「守月 / 百天」（config/badges.ts）同一口径，改这里要一起想。
 */
export const VOW_MILESTONES = [7, 21, 30, 100] as const

export const useVowStore = defineStore(
  'vow',
  () => {
    /** 当前这一条（永远是最新的一条；跨天后会被搬进 history） */
    const current = ref<Vow | null>(null)
    /** 已归档的历史 */
    const history = ref<Vow[]>([])

    /** 今天的立约（还没到次日，或已结算但仍属今天） */
    const todayVow = computed(() => (current.value?.day === todayKey() ? current.value : null))

    /**
     * 跨天处理：昨天的立约若还没回看 → 直接归档并标 missed。
     * 不弹窗催、不补看（「错过就是错过」），避免变成第二个每日待办。
     */
    function ensureToday(): void {
      const v = current.value
      if (!v) return
      if (v.day === todayKey()) return
      history.value = [{ ...v, missed: v.status === 'open' }, ...history.value].slice(0, HISTORY_CAP)
      current.value = null
    }

    /** 立约（一天一条） */
    function open(trigger: string, promise: string, action: string): boolean {
      const t = trigger.trim()
      const p = promise.trim()
      const a = action.trim()
      if (!t || !p || !a) return false
      ensureToday()
      if (current.value) return false
      current.value = {
        day: todayKey(),
        trigger: t,
        promise: p,
        action: a,
        status: 'open',
        createdAt: Date.now(),
      }
      logTrace({ kind: 'pause.vow', text: p, ref: `vow-${current.value.createdAt}` })
      return true
    }

    /** 守住了 */
    function keep(): boolean {
      const v = current.value
      if (!v || v.status !== 'open') return false
      v.status = 'kept'
      v.closedAt = Date.now()
      logTrace({ kind: 'pause.vow.keep', text: v.promise, ref: `vow-${v.createdAt}` })
      return true
    }

    /**
     * 破了 —— 必须带上一句为什么。
     * 这句同时写进「知」的知识库（Lv.2 重构 · 标签「省察」），
     * 因为「知道自己为什么破」比「没破」更有价值。
     */
    function breakIt(reason: string): boolean {
      const v = current.value
      const r = reason.trim()
      if (!v || v.status !== 'open' || !r) return false
      v.status = 'broken'
      v.reason = r
      v.closedAt = Date.now()
      logTrace({ kind: 'pause.vow.break', text: v.promise, ref: `vow-${v.createdAt}` })
      useKnowledgeStore().add({
        kind: 'note',
        title: `破约：${v.promise}`,
        content: r,
        tags: ['省察', '立约'],
        depth: 2,
        src: `止 · 立约回看 ${v.day}`,
      })
      return true
    }

    /** 撤销今天的立约（立错了 / 想重立） */
    function reset(): void {
      current.value = null
    }

    /** 连续守住天数（从最近已结算的一条往前数，未回看的中断计数） */
    const keepStreak = computed(() => {
      const settled = [current.value, ...history.value].filter(
        // 用 v !== null 而不是 Boolean(v)：只有前者是类型守卫，能让下面的 v.status 收窄通过
        (v): v is Vow => v !== null && v.status !== 'open',
      )
      let n = 0
      for (const v of settled) {
        if (v.status !== 'kept') break
        n += 1
      }
      return n
    })

    /** 累计守住 / 破约 */
    const tally = computed(() => {
      const all = [current.value, ...history.value].filter((v): v is Vow => Boolean(v))
      return {
        kept: all.filter((v) => v.status === 'kept').length,
        broken: all.filter((v) => v.status === 'broken').length,
        missed: all.filter((v) => v.missed || v.status === 'open').length,
      }
    })

    return { current, history, todayVow, ensureToday, open, keep, breakIt, reset, keepStreak, tally }
  },
  {
    persist: { key: 'vow', paths: ['current', 'history'] },
  },
)

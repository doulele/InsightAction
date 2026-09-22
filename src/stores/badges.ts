/**
 * badges —— 徽章「点亮过」的**留痕**（2026-09-22 建）。
 *
 * 为什么需要这个 store：徽章此前是**纯实时判定** —— 每一处显示都用当下快照
 * 重新跑一遍 `config/badges.ts` 的 `hit(ctx)`，于是「曾经点亮」的徽章会**消失**：
 *
 *  - 持恒（habit-streak-7）：某个习惯连续打卡 7 天 → 第 8 天漏了一天 → 徽章熄灭；
 *  - 守七（vow-7）：连续 7 天立约守住 → 第 8 天破了 → 徽章熄灭；
 *  - 更一般的：任何依赖"当下状态"的计数（清理过 10 条、转行了 lv3 卡）在被删除后同样会熄灭。
 *
 * 这与产品的立场直接冲突 —— `config/badges.ts` 重写原则第 3 条写得很明白：
 * 「断卡不归零」「不设惩罚性徽章」。修行的数字可以回落，但**点亮的那一刻不该被收回**，
 * 否则它就又变成了一根"你要保持住"的鞭子。
 *
 * 所以这里只做一件事：**记下点亮的那一刻**。三条边界：
 *  1. **判定规则仍然只有一份**（config/badges.ts 的 hit），本 store 不复制任何条件；
 *  2. 展示取「当下命中 ∪ 已留痕」的并集 —— 数据被删了、约破了，也不会收回一枚已经点亮的徽章；
 *  3. `fresh`（刚点亮、还没看过的）**不持久化**：它是一次性的"新"角标，
 *     取走即清，与 daily 的 handoff 同一范式。
 *
 * 随备份一起走（它不是成就进度本身，而是"我看过哪些点亮"，换机要能带回来）。
 */
import { defineStore } from 'pinia'
import { computed, ref } from 'vue'

export interface BadgeLedgerItem {
  /** 徽章 id（与 config/badges.ts 的 BADGE_RULES 对应） */
  id: string
  /** 点亮的时刻 */
  at: number
}

export const useBadgeStore = defineStore(
  'badges',
  () => {
    /** 点亮留痕（持久化） */
    const items = ref<BadgeLedgerItem[]>([])

    /** 刚点亮、还没被看过的 id（不持久化：进成就墙看一眼就清） */
    const fresh = ref<string[]>([])

    /** 是否已经在册（留痕优先，不依赖当下数据） */
    function has(id: string): boolean {
      return items.value.some((i) => i.id === id)
    }

    /** 首次点亮的时刻；从没点亮过返回 0（成就墙用它显示"几月点亮的"） */
    function atOf(id: string): number {
      return items.value.find((i) => i.id === id)?.at ?? 0
    }

    /**
     * 合并一次当前命中的徽章，返回**本次新点亮**的 id 列表。
     *
     * 幂等：同一个 id 只会在第一次被合并时进 fresh —— 否则用户每进一次「我」页都会被提示一次。
     *
     * @param silent 为真时只补记、不进 fresh。给"第一次按这套规则算"用 ——
     *   老数据一次性命中二十枚，那是**补记**（早该点亮了），不是"刚刚点亮"，
     *   不该用二十条提示去烦人。
     */
    function syncUnlocked(hitIds: readonly string[], silent = false): string[] {
      const now = Date.now()
      const added: string[] = []
      for (const id of hitIds) {
        if (has(id)) continue
        items.value.push({ id, at: now })
        added.push(id)
      }
      if (added.length && !silent) fresh.value = [...new Set([...fresh.value, ...added])]
      return added
    }

    /** 取走「新点亮」的名单并清空（看过了就不是新的了） */
    function takeFresh(): string[] {
      const ids = fresh.value
      fresh.value = []
      return ids
    }

    const count = computed(() => items.value.length)
    const freshCount = computed(() => fresh.value.length)

    return { items, fresh, has, atOf, syncUnlocked, takeFresh, count, freshCount }
  },
  {
    persist: { key: 'badges', paths: ['items'] },
  },
)

/**
 * 修为 store —— 唯一的成长数值（三模式共用，只有叫法不同）。
 *
 * 入账规则（v2 §12.1）：修为**随 trace 的 value 入账**，而不是各页面手动 +N。
 * 统一入口见 utils/traceLog.ts（写痕迹 + 入账一次完成）；
 * 这里只负责记账，不关心行为是什么。
 *
 * maxLevel：历史最高修为。等级只按 maxLevel 计算（**只升不降**），
 * 这样「兑换愿望花掉修为」不会让用户掉段，避免攒分换奖励的负反馈。
 */
import { defineStore } from 'pinia'
import { computed, ref } from 'vue'

export const useXpStore = defineStore(
  'xp',
  () => {
    /** 当前修为（可花） */
    const total = ref(0)
    /** 历史最高修为（等级依据，只增不减） */
    const maxLevel = ref(0)

    /** 等级依据：历史最高 */
    const levelXp = computed(() => Math.max(total.value, maxLevel.value))

    function gain(points: number): void {
      if (points <= 0) return
      total.value += Math.round(points)
      if (total.value > maxLevel.value) maxLevel.value = total.value
    }

    /** 消耗（愿望兑换）；不足返回 false，由调用方提示 */
    function spend(points: number): boolean {
      if (points <= 0) return true
      const need = Math.round(points)
      if (total.value < need) return false
      total.value -= need
      return true
    }

    return { total, maxLevel, levelXp, gain, spend }
  },
  {
    persist: { key: 'xp', paths: ['total', 'maxLevel'] },
  },
)

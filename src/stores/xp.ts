/**
 * 修为 store —— 唯一的成长数值（三模式共用，只有叫法不同）。
 * 批次 C · 我：真实累计，由各行为入账：
 *   走完静修 +1/分钟 · 完成一件三件事 +10 · 习惯打卡 +6 ·
 *   盲盒达成 +12 · 拷问首次作答 +8
 */
import { defineStore } from 'pinia'
import { ref } from 'vue'

export const useXpStore = defineStore(
  'xp',
  () => {
    /** 累计修为 */
    const total = ref(0)

    function gain(points: number): void {
      if (points > 0) total.value += Math.round(points)
    }

    return { total, gain }
  },
  {
    persist: { key: 'xp', paths: ['total'] },
  },
)

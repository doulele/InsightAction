/**
 * 愿望清单 store ——「行」的延迟满足账本（m7 批次 · 纯本地）。
 * 把戒断/专注攒下的「修为」兑成现实奖励：立一个愿望，标一个需要攒到的修为门槛，
 * 累计修为达标即可「兑换」。修为只作为进度标尺、不回退（等级不可倒退原则）。
 */
import { defineStore } from 'pinia'
import { ref } from 'vue'

export interface Wish {
  id: number
  name: string
  /** 需要的累计修为 */
  needXp: number
  /** 备注（可选） */
  note?: string
  createdAt: number
  /** 兑换时间（兑换后保留展示，可勾销） */
  claimedAt?: number
}

const WISH_MIN_XP = 50

let uniq = 1

function nextId(): number {
  return Date.now() * 100 + (uniq++ % 100)
}

export const useWishStore = defineStore(
  'wish',
  () => {
    const wishes = ref<Wish[]>([])

    function add(name: string, needXp: number, note?: string): boolean {
      const n = name.trim()
      if (!n) return false
      const need = Math.max(WISH_MIN_XP, Math.round(needXp) || WISH_MIN_XP)
      wishes.value.unshift({
        id: nextId(),
        name: n,
        needXp: need,
        note: note?.trim() || undefined,
        createdAt: Date.now(),
      })
      return true
    }

    function remove(id: number): void {
      wishes.value = wishes.value.filter((w) => w.id !== id)
    }

    /** 兑换：达到门槛即标记，修为不扣减 */
    function claim(id: number, totalXp: number): boolean {
      const w = wishes.value.find((x) => x.id === id)
      if (!w || w.claimedAt) return false
      if (totalXp < w.needXp) return false
      w.claimedAt = Date.now()
      return true
    }

    return { wishes, add, remove, claim, WISH_MIN_XP }
  },
  {
    persist: { key: 'wish', paths: ['wishes'] },
  },
)

/**
 * 稍后读 store ——「临时收藏，24 小时未读自动清理」。
 * 批次 B · 观子页（观事 → 观理：够时间消化即可，不养收藏夹僵尸）。
 * 纯本地（云同步后端期接入）；跨天不重置，只按 24h 时效滚动清理。
 */
import { defineStore } from 'pinia'
import { ref } from 'vue'

export interface ReadLaterItem {
  /** 收藏时刻（Date.now()，兼作唯一 id） */
  createdAt: number
  text: string
}

/** 保留时长：24 小时 */
export const READ_LATER_HOLD_MS = 24 * 60 * 60 * 1000

/** 单次在库上限：防止"稍后读"又变成囤积 */
const CAP = 30

export const useReadLaterStore = defineStore(
  'readLater',
  () => {
    const items = ref<ReadLaterItem[]>([])

    /** 只保留未过期收藏；返回本次被清理的条数 */
    function prune(now = Date.now()): number {
      const kept = items.value.filter((it) => now - it.createdAt < READ_LATER_HOLD_MS)
      const cleared = items.value.length - kept.length
      if (cleared > 0) items.value = kept
      return cleared
    }

    /** 新存一条（放最前）；成功返回 true */
    function add(text: string): boolean {
      const t = text.trim()
      if (!t) return false
      if (items.value.length >= CAP) {
        uni.showToast({ title: '存得太多啦，先读完已存的', icon: 'none' })
        return false
      }
      items.value.unshift({ createdAt: Date.now(), text: t })
      return true
    }

    /** 主动丢弃一条 */
    function remove(createdAt: number): void {
      items.value = items.value.filter((it) => it.createdAt !== createdAt)
    }

    return { items, prune, add, remove }
  },
  {
    persist: { key: 'readLater', paths: ['items'] },
  },
)

/**
 * 习惯打卡 store ——「自定义习惯列表，每日一勾」。
 * 批次 C · 行：每个习惯有自己的打卡日历（自然日键集合），可跨天追溯连续打卡。
 */
import { defineStore } from 'pinia'
import { ref } from 'vue'
import { todayKey } from '@/stores/daily'

export interface Habit {
  id: number
  name: string
  /** 建档时刻 */
  createdAt: number
}

let uniq = 1

function nextId(): number {
  return Date.now() * 100 + (uniq++ % 100)
}

export const useHabitStore = defineStore(
  'habit',
  () => {
    const habits = ref<Habit[]>([])
    /** 打卡日历：habitId → 打卡的自然日集合 */
    const records = ref<Record<number, string[]>>({})

    function add(name: string): boolean {
      const n = name.trim()
      if (!n) return false
      if (habits.value.some((h) => h.name === n)) {
        uni.showToast({ title: '已有同名习惯', icon: 'none' })
        return false
      }
      if (habits.value.length >= 9) {
        uni.showToast({ title: '习惯别贪多，先守住这 9 个', icon: 'none' })
        return false
      }
      const h: Habit = { id: nextId(), name: n, createdAt: Date.now() }
      habits.value.push(h)
      records.value[h.id] = []
      return true
    }

    function remove(id: number): void {
      habits.value = habits.value.filter((h) => h.id !== id)
      delete records.value[id]
    }

    function daysOf(id: number): string[] {
      return records.value[id] ?? []
    }

    function isDone(id: number, date = todayKey()): boolean {
      return daysOf(id).includes(date)
    }

    /** 打卡/取消 */
    function toggle(id: number, date = todayKey()): boolean {
      const list = daysOf(id)
      const hit = list.includes(date)
      if (hit) {
        records.value[id] = list.filter((d) => d !== date)
        return false
      }
      list.push(date)
      return true
    }

    /** 某日打了几个习惯 */
    function doneOn(date = todayKey()): number {
      return habits.value.filter((h) => isDone(h.id, date)).length
    }

    /** 某习惯当前连续打卡天数（含今天） */
    function streakOf(id: number): number {
      const set = new Set(daysOf(id))
      let cursor = todayKey()
      if (!set.has(cursor)) {
        const d = new Date()
        d.setDate(d.getDate() - 1)
        cursor = todayKey(d)
      }
      let n = 0
      while (set.has(cursor)) {
        n += 1
        const d = new Date(`${cursor}T12:00:00`)
        d.setDate(d.getDate() - 1)
        cursor = todayKey(d)
      }
      return n
    }

    return { habits, records, add, remove, daysOf, isDone, toggle, doneOn, streakOf }
  },
  {
    persist: { key: 'habit', paths: ['habits', 'records'] },
  },
)

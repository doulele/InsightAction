/**
 * 每日修行数据 —— 「行」大厅今日三件事 + 通用日维度记录。
 * 以本地日期为键，跨天自动重置（日期变化时清空为当日模板）。
 */
import { defineStore } from 'pinia'
import { computed, ref } from 'vue'

/**
 * 三件事的**回指**来源类别（规格 §4.4「回应式行动」）。
 * 三件事不再是凭空的待办清单，而是从观/知里回应出来的：
 * 它可以是「我立的某条理」「某张知识卡片」「某一次冲动记录」，也可以坦白说「无出处」。
 */
export type TodoRefKind = 'theory' | 'card' | 'urge' | 'none'

export interface DailyTodo {
  id: number
  text: string
  done: boolean
  /** 回指对象的 id（obs-xxx / card-xxx / urge-xxx）；空 = 无出处 */
  ref?: string
  /** 来源类别（渲染标签用，省去每次反查） */
  refKind?: TodoRefKind
  /**
   * 来源的一句话快照。
   * 存快照而不是每次反查：那条理/卡片被删掉后，这里仍读得懂，不会留下一个断链的空壳。
   */
  refText?: string
}

/** 今日三件事的初始模板（三条空待办） */
export function freshTodos(): DailyTodo[] {
  return [0, 1, 2].map((i) => ({ id: i, text: '', done: false }))
}

/** 本地日期键，如 2026-09-09 */
export function todayKey(d = new Date()): string {
  const m = `${d.getMonth() + 1}`.padStart(2, '0')
  const day = `${d.getDate()}`.padStart(2, '0')
  return `${d.getFullYear()}-${m}-${day}`
}

export const useDailyStore = defineStore(
  'daily',
  () => {
    /** 记录归属的日期键 */
    const dateKey = ref(todayKey())
    /** 今日三件事 */
    const todos = ref<DailyTodo[]>(freshTodos())

    /** 若跨天（或首次初始化），重置为当日 */
    function ensureToday(): void {
      const k = todayKey()
      if (dateKey.value !== k) {
        dateKey.value = k
        todos.value = freshTodos()
      }
    }

    function toggle(id: number): void {
      const item = todos.value.find((t) => t.id === id)
      if (item && item.text.trim()) {
        item.done = !item.done
      }
    }

    function updateText(id: number, text: string): void {
      const item = todos.value.find((t) => t.id === id)
      if (item) item.text = text
    }

    /** 给某条三件事挂上来源（ref 为空 = 无出处） */
    function setRef(id: number, ref: string, refKind: TodoRefKind, refText: string): void {
      const item = todos.value.find((t) => t.id === id)
      if (!item) return
      item.ref = ref || undefined
      item.refKind = refKind
      item.refText = refText || undefined
    }

    function clearRef(id: number): void {
      const item = todos.value.find((t) => t.id === id)
      if (!item) return
      item.ref = undefined
      item.refKind = 'none'
      item.refText = undefined
    }

    /** 今日已完成数 / 已填计划数 */
    const doneCount = computed(() => todos.value.filter((t) => t.done).length)
    const planCount = computed(() => todos.value.filter((t) => t.text.trim()).length)
    const allDone = computed(() => planCount.value > 0 && doneCount.value === planCount.value)

    return { dateKey, todos, ensureToday, toggle, updateText, setRef, clearRef, doneCount, planCount, allDone }
  },
  {
    persist: { key: 'daily', paths: ['dateKey', 'todos'] },
  },
)

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
export type TodoRefKind = 'theory' | 'card' | 'urge' | 'thought' | 'none'

/**
 * 一次「跨 tab 预填」的交接内容（2026-09-17 加）。
 *
 * 场景：止念里判了"能做"的那一念，用户在止念页点「立成今日三件事」。
 * 障碍：**tab 页不能带 query** —— `navigateTo` 对 tab 会走 `switchTab`，参数会丢；
 * 所以参数只能走 store：止念页放一条 handoff → switchTab → 行大厅 onShow 取走落到表单里。
 *
 * 语义边界：**只预填、不代立**（规格 §4.2「不代建」）—— 落进输入框，用户自己改、自己勾。
 */
export interface TodoHandoff {
  text: string
  /** 回指对象的 id（如 thought-<id>），让周报的「一条路」能串上这条链 */
  ref: string
  refKind: TodoRefKind
  /** 出处的一句话快照（原对象删了也读得懂） */
  refText: string
}

export interface DailyTodo {
  id: number
  text: string
  done: boolean
  /** 回指对象的 id（obs-xxx / card-xxx / urge-xxx / thought-xxx）；空 = 无出处 */
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

    /* ---------------- 跨 tab 的预填交接（2026-09-17） ----------------
     * 刻意**不持久化**（persist 只写 dateKey / todos）：它是一次交接，取走即清，
     * 否则用户下次自己回大厅时会被同一条莫名其妙地再预填一次。
     */
    const handoff = ref<TodoHandoff | null>(null)

    function setHandoff(h: TodoHandoff): void {
      handoff.value = h
    }

    /** 取走并清空 */
    function takeHandoff(): TodoHandoff | null {
      const h = handoff.value
      handoff.value = null
      return h
    }

    /**
     * 把交接落进**第一条还没写内容**的三件事（含出处与快照）。
     * 三条都写满时返回 false —— 由调用方如实提示，不悄悄挤掉用户已经写好的一条。
     */
    function applyHandoff(h: TodoHandoff): boolean {
      ensureToday()
      const slot = todos.value.find((t) => !t.text.trim())
      if (!slot) return false
      slot.text = h.text
      slot.ref = h.ref || undefined
      slot.refKind = h.refKind
      slot.refText = h.refText || undefined
      return true
    }

    /** 今日已完成数 / 已填计划数 */
    const doneCount = computed(() => todos.value.filter((t) => t.done).length)
    const planCount = computed(() => todos.value.filter((t) => t.text.trim()).length)
    const allDone = computed(() => planCount.value > 0 && doneCount.value === planCount.value)

    return {
      dateKey,
      todos,
      ensureToday,
      toggle,
      updateText,
      setRef,
      clearRef,
      handoff,
      setHandoff,
      takeHandoff,
      applyHandoff,
      doneCount,
      planCount,
      allDone,
    }
  },
  {
    persist: { key: 'daily', paths: ['dateKey', 'todos'] },
  },
)

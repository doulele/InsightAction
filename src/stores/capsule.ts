/**
 * 时间胶囊 store —— 「给未来的自己留一句话」（2026-09-17）。
 *
 * 为什么值得做：这个小程序拿不到长期订阅（个人主体限制，见 docs/观止知行-未做事项.md #1），
 * 所以「回访」全靠用户自己想起。胶囊是唯一一个**指向未来**的钩子：
 * 到期那天打开，小枢把这句话递给你，再问一句「现在怎么看」。
 *
 * 三条口径：
 *  1. **只在本机**：与箴言同一待遇（不上云），但它在本地备份里 —— 换手机/清缓存会丢，
 *     页面上必须如实说明，不能让人以为躺在那儿就万事大吉；
 *  2. **到期不催**：不弹窗、不打扰，只在小枢面板与入口徽标上安静地显示「有 1 条到期」；
 *  3. **拆开后可以再回一句**：那一句与原句并排存，这才叫"过了这段时间"的证据。
 */
import { defineStore } from 'pinia'
import { computed, ref } from 'vue'
import { todayKey } from '@/stores/daily'
import { logTrace } from '@/utils/traceLog'

export interface Capsule {
  id: number
  /** 留给未来的那一句 */
  text: string
  createdAt: number
  /** 到期日 YYYY-MM-DD（到期当天即可拆） */
  dueDay: string
  /** 拆开时刻；有值 = 已拆 */
  openedAt?: number
  /** 拆开后补的一句（可选） */
  reply?: string
  replyAt?: number
}

/** 留存上限：一年最多写这么多条，够了 */
const CAP = 99
/** 预设周期（天）：一个月 / 一季 / 一年 */
export const CAPSULE_PRESETS: readonly number[] = [30, 90, 365]

/** 周期文案（页面与提示共用，别在页面里各写一版） */
export function presetLabel(days: number): string {
  if (days === 365) return '一年后'
  if (days === 90) return '三个月后'
  if (days === 30) return '一个月后'
  return `${days} 天后`
}

/** 今天往后 n 天的自然日键 */
export function dayAfter(days: number, from = new Date()): string {
  const d = new Date(from.getTime())
  d.setDate(d.getDate() + days)
  return todayKey(d)
}

/** 距今还剩几天（负数 = 已过） */
export function daysUntil(dueDay: string, from = new Date()): number {
  const a = new Date(`${todayKey(from)}T12:00:00`).getTime()
  const b = new Date(`${dueDay}T12:00:00`).getTime()
  return Math.round((b - a) / 86_400_000)
}

let uniq = 1

function nextId(): number {
  return Date.now() * 100 + (uniq++ % 100)
}

export const useCapsuleStore = defineStore(
  'capsule',
  () => {
    const items = ref<Capsule[]>([])

    const count = computed(() => items.value.length)

    /** 已到期待拆（早到期的在前） */
    const dueList = computed<Capsule[]>(() => {
      const k = todayKey()
      return items.value
        .filter((c) => !c.openedAt && c.dueDay <= k)
        .sort((a, b) => a.dueDay.localeCompare(b.dueDay))
    })

    /** 还在封着的（未到期） */
    const sealed = computed<Capsule[]>(() => {
      const k = todayKey()
      return items.value.filter((c) => !c.openedAt && c.dueDay > k).sort((a, b) => a.dueDay.localeCompare(b.dueDay))
    })

    /** 已拆开的（新在前） */
    const opened = computed<Capsule[]>(() =>
      items.value.filter((c) => c.openedAt).sort((a, b) => (b.openedAt ?? 0) - (a.openedAt ?? 0)),
    )

    const dueCount = computed(() => dueList.value.length)

    function byId(id: number): Capsule | undefined {
      return items.value.find((c) => c.id === id)
    }

    /** 封一条：写一句 + 选周期（天） */
    function add(text: string, days: number): Capsule | null {
      const body = text.trim()
      if (!body) return null
      if (!Number.isFinite(days) || days < 1) return null
      if (items.value.length >= CAP) {
        uni.showToast({ title: '封得够多了，先拆几条再封', icon: 'none' })
        return null
      }
      const item: Capsule = {
        id: nextId(),
        text: body,
        createdAt: Date.now(),
        dueDay: dayAfter(days),
      }
      items.value.unshift(item)
      return item
    }

    /**
     * 拆开（可补一句「现在怎么看」）。
     * 已拆过返回 false —— 防止重复入账；入了账的是一次"我读到了过去的话"。
     */
    function open(id: number, reply = ''): boolean {
      const c = byId(id)
      if (!c) return false
      const first = !c.openedAt
      if (first) {
        c.openedAt = Date.now()
        logTrace({ kind: 'reflect.capsule', text: c.text.slice(0, 20), ref: `capsule-${c.id}` })
      }
      c.reply = reply.trim() || c.reply
      if (c.reply) c.replyAt = Date.now()
      return first
    }

    function remove(id: number): void {
      items.value = items.value.filter((c) => c.id !== id)
    }

    return { items, count, dueList, sealed, opened, dueCount, byId, add, open, remove }
  },
  {
    persist: { key: 'capsule', paths: ['items'] },
  },
)

/**
 * focus store —— 每日专注时长（按自然日聚合）+ 定力目标 / 连胜。
 * 批次 B · 止：禅定沙漏走完全程写入，止大厅「今日定力」与专注统计子页读取。
 * 以天为单位聚合：{ date: 'YYYY-MM-DD', minutes }，便于跨天/周/月统计。
 * 连胜 = 连续自然日有走完全程的专注（今天有则从今天起算，没有则从昨天起算）。
 */
import { defineStore } from 'pinia'
import { computed, ref } from 'vue'
import { todayKey } from '@/stores/daily'
import { useXpStore } from '@/stores/xp'

export interface FocusDay {
  /** 自然日 'YYYY-MM-DD'（本地时区） */
  date: string
  /** 该日累计专注分钟 */
  minutes: number
}

/** 默认每日定力目标（分钟） */
export const DEFAULT_DAILY_GOAL = 60

function pad(n: number): string {
  return String(n).padStart(2, '0')
}

function fmt(d: Date): string {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

/** 日期键前后平移 delta 天 */
function shiftKey(key: string, delta: number): string {
  const [y, m, d] = key.split('-').map(Number)
  return fmt(new Date(y, m - 1, d + delta))
}

export const useFocusStore = defineStore(
  'focus',
  () => {
    const days = ref<FocusDay[]>([])
    /** 每日定力目标（分钟），可在「连胜」子页调整 */
    const dailyGoal = ref(DEFAULT_DAILY_GOAL)

    /** 记入一段专注（同一天自动累加）；走完即入账修为 +1/分钟 */
    function addMinutes(minutes: number, date = todayKey()): void {
      if (!(minutes > 0)) return
      const rec = days.value.find((d) => d.date === date)
      if (rec) {
        rec.minutes += minutes
      } else {
        days.value.push({ date, minutes })
      }
      useXpStore().gain(minutes)
    }

    /** 某自然日累计分钟数（默认今天） */
    function minutesOn(date = todayKey()): number {
      return days.value.find((d) => d.date === date)?.minutes ?? 0
    }

    /** [from, to]（含两端，'YYYY-MM-DD'）区间累计 */
    function totalBetween(from: string, to: string): number {
      return days.value
        .filter((d) => d.date >= from && d.date <= to)
        .reduce((sum, d) => sum + d.minutes, 0)
    }

    /** 有入账的自然日集合（用于连胜判定） */
    const activeKeys = computed(() => new Set(days.value.filter((d) => d.minutes > 0).map((d) => d.date)))

    /** 当前连胜：今天没入账时从昨天倒推（今天还没开始不算断） */
    const currentStreak = computed(() => {
      const active = activeKeys.value
      let cursor = shiftKey(todayKey(), active.has(todayKey()) ? 0 : -1)
      let n = 0
      while (active.has(cursor)) {
        n += 1
        cursor = shiftKey(cursor, -1)
      }
      return n
    })

    /** 历史最佳连胜 */
    const bestStreak = computed(() => {
      const keys = [...activeKeys.value].sort()
      let best = 0
      let run = 0
      let prev = ''
      keys.forEach((k) => {
        run = prev && shiftKey(prev, 1) === k ? run + 1 : 1
        prev = k
        if (run > best) best = run
      })
      return best
    })

    /** 今日是否已达标 */
    const todayMet = computed(() => minutesOn() >= dailyGoal.value)

    function setDailyGoal(minutes: number): void {
      const v = Math.min(240, Math.max(5, Math.round(minutes)))
      dailyGoal.value = v
    }

    return {
      days,
      dailyGoal,
      addMinutes,
      minutesOn,
      totalBetween,
      currentStreak,
      bestStreak,
      todayMet,
      setDailyGoal,
    }
  },
  {
    persist: { key: 'focus', paths: ['days', 'dailyGoal'] },
  },
)

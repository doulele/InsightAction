/**
 * 定时入定 store ——「预设每日固定专注时段，到点提醒」。
 * 批次 B 收尾 · 止子页：小程序无法后台推送，故时段到点由前台浮层提醒（批次 D · 到点激励）；
 * 本 store 只负责「入定时段的设置」：时间点 + 预计时长 + 开关。
 */
import { defineStore } from 'pinia'
import { ref } from 'vue'

export interface Reminder {
  /** 自增 id */
  id: number
  /** 时（0-23） */
  hour: number
  /** 分（0-59） */
  minute: number
  /** 这段预计入定多少分钟 */
  minutes: number
  enabled: boolean
}

/** 模板：早课 / 午后 / 睡前 */
export const REMINDER_TEMPLATES: readonly { label: string; hour: number; minute: number; minutes: number }[] = [
  { label: '早课 · 醒后清空', hour: 7, minute: 30, minutes: 15 },
  { label: '午后 · 回神', hour: 12, minute: 30, minutes: 10 },
  { label: '睡前 · 收摄', hour: 21, minute: 0, minutes: 15 },
]

let nextId = 1

function fmtId(): number {
  return Date.now() * 100 + (nextId++ % 100)
}

export const useReminderStore = defineStore(
  'reminder',
  () => {
    const reminders = ref<Reminder[]>([])

    function add(hour: number, minute: number, minutes: number): Reminder {
      const r: Reminder = { id: fmtId(), hour, minute, minutes, enabled: true }
      reminders.value.push(r)
      // 按开始时间排序展示
      reminders.value.sort((a, b) => a.hour * 60 + a.minute - (b.hour * 60 + b.minute))
      return r
    }

    function remove(id: number): void {
      reminders.value = reminders.value.filter((r) => r.id !== id)
    }

    function toggle(id: number): void {
      const r = reminders.value.find((it) => it.id === id)
      if (r) r.enabled = !r.enabled
    }

    return { reminders, add, remove, toggle }
  },
  {
    persist: { key: 'reminder', paths: ['reminders'] },
  },
)

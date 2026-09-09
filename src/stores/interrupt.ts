/**
 * 触发干预卡片 store ——「止 · 止行」：针对特定触发行为（打开某 App 前 / 深夜刷屏…）
 * 的 1-3 分钟快速暂停工具。m7 批次（纯本地）。
 *
 * 每个场景 = 一个「想打开的开关」；选好场景与时长，用一段呼吸倒计时把冲动摁回去。
 * 走完一轮记一次「守住」；中途退出记为一次尝试（不惩罚，只诚实计数）。
 */
import { defineStore } from 'pinia'
import { ref } from 'vue'
import { todayKey } from '@/stores/daily'

export interface TriggerScenario {
  id: string
  name: string
  /** 替代动作建议（可为空） */
  alt?: string
  /** 是否用户自建 */
  custom?: boolean
}

export interface InterruptRecord {
  /** 结束时刻 */
  at: number
  minutes: number
  /** 是否走完全程 */
  held: boolean
}

/** 内置触发场景：可随时换，也能自己加 */
export const PRESET_SCENARIOS: TriggerScenario[] = [
  { id: 'short-video', name: '想刷短视频', alt: '先做 10 个深呼吸，再决定要不要打开' },
  { id: 'late-phone', name: '睡前摸手机', alt: '把手机放到够不着的地方，读两页纸书' },
  { id: 'snack', name: '想吃零食', alt: '喝一杯温水，等三分钟看看还馋不馋' },
  { id: 'news', name: '忍不住看消息', alt: '站起来接一杯水，回来再决定' },
  { id: 'smoke', name: '烟瘾犯了', alt: '含一颗薄荷糖，做一组深呼吸' },
]

const SCENARIO_MAX = 9

let uniq = 1

function nextId(): number {
  return Date.now() * 100 + (uniq++ % 100)
}

export const useInterruptStore = defineStore(
  'interrupt',
  () => {
    const custom = ref<TriggerScenario[]>([])
    const records = ref<InterruptRecord[]>([])
    const CAP = 300

    const scenarios = (): TriggerScenario[] => [...PRESET_SCENARIOS, ...custom.value]

    function findByName(name: string): TriggerScenario | undefined {
      return [...PRESET_SCENARIOS, ...custom.value].find(
        (s) => s.name.trim() === name.trim(),
      )
    }

    function addCustom(name: string, alt?: string): boolean {
      const n = name.trim()
      if (!n) return false
      if (findByName(n)) {
        uni.showToast({ title: '已有这个触发场景', icon: 'none' })
        return false
      }
      if (custom.value.length + PRESET_SCENARIOS.length >= SCENARIO_MAX) {
        uni.showToast({ title: `场景最多 ${SCENARIO_MAX} 个，删掉不用的再加`, icon: 'none' })
        return false
      }
      custom.value.push({
        id: `c-${nextId()}`,
        name: n,
        alt: alt?.trim() || undefined,
        custom: true,
      })
      return true
    }

    function removeCustom(id: string): void {
      custom.value = custom.value.filter((s) => s.id !== id)
    }

    /** 记一次尝试（held=是否走完全程），新在前 */
    function finish(minutes: number, held: boolean): void {
      records.value.unshift({ at: Date.now(), minutes, held })
      if (records.value.length > CAP) {
        records.value = records.value.slice(0, CAP)
      }
    }

    /** 今日守住的次数 */
    function heldOn(date = todayKey()): number {
      return records.value.filter((r) => {
        const d = new Date(r.at)
        const k = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
        return k === date && r.held
      }).length
    }

    const totalHeld = (): number => records.value.filter((r) => r.held).length

    return {
      custom,
      records,
      scenarios,
      addCustom,
      removeCustom,
      finish,
      heldOn,
      totalHeld,
    }
  },
  {
    persist: { key: 'interrupt', paths: ['custom', 'records'] },
  },
)

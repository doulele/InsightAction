/**
 * 冲动记录 store —— 「止」的长期档（规格 v2 §4.2）。
 *
 * 冲动记录不是「打卡」，它的唯一目的是**事后能看出形状**：
 *   一次冲动要记四件事 —— 什么时候、什么情境、当时什么感觉、最后有没有做。
 * 攒够十几次之后，「触发点地图」会把它们按「触发点」和「时段」聚合出来，
 * 于是「你这周有 3 次想下单，都发生在 22:00 之后」这句话才有依据。
 *
 * 冷却期（两档）：冲动来袭时先不决策 ——
 *   10 分钟：当下一口气（多数冲动撑不过这一段）
 *   48 小时：想买、想做的大决定（放两天再看还想不想）
 * 期间页面显示倒计时与替代动作；走完记 pause.cooldown。
 * 不阻止任何事 —— 只是把「立刻做」变成「过一会儿还想做吗」。
 */
import { defineStore } from 'pinia'
import { computed, ref } from 'vue'
import { todayKey } from '@/stores/daily'
import { logTrace } from '@/utils/traceLog'

/** 预设触发情境（对齐规格 §12.2 的三套干预脚本：刷手机 / 嘴馋 / 想下单） */
export const URGE_TRIGGERS = ['想刷手机', '嘴馋', '想下单', '想躺平', '其他'] as const
/** 当时的感觉（记录情绪是为了看「是不是某一种情绪在反复驱动我」） */
export const URGE_FEELINGS = ['无聊', '焦虑', '疲惫', '生气', '开心', '说不上来'] as const

export interface UrgeRecord {
  id: number
  at: number
  /** YYYY-MM-DD */
  day: string
  /** 0-23，用于时段聚合 */
  hour: number
  trigger: string
  feeling: string
  /** 冲动强度 1-5 */
  intensity: number
  /** 最后有没有真的做 */
  acted: boolean
  /** 替代动作（写下来才有用，空着也行） */
  alternative?: string
}

/** 冷却期档位：quick = 当下一口气（10 分钟）/ long = 大决定先放两天（48 小时） */
export type CooldownKind = 'quick' | 'long'

/** 快档：10 分钟 */
export const COOLDOWN_MIN = 10
/** 长档：48 小时（规格 §4.2 长期档口径） */
export const COOLDOWN_LONG_MIN = 48 * 60

/** 快档文案 */
const QUICK_META = {
  id: 'quick' as const,
  label: '10 分钟',
  note: '当下一口气 —— 撑过这一段，多数冲动已经退了',
}
/** 长档文案 */
const LONG_META = {
  id: 'long' as const,
  label: '48 小时',
  note: '想买、想做的大决定 —— 放两天再看还想不想',
}

/** 档位表（页面文案的唯一来源，别在页面里写死这两串字） */
export const COOLDOWN_KINDS = [QUICK_META, LONG_META] as const

export interface CooldownMeta {
  id: CooldownKind
  label: string
  note: string
}

/** 取某一档的文案（查不到时回落快档 —— 老数据没有 cooldownKind 字段） */
export function cooldownKindMeta(kind: CooldownKind): CooldownMeta {
  return kind === 'long' ? LONG_META : QUICK_META
}

/** 档位对应的分钟数 */
export function cooldownMinutesOf(kind: CooldownKind): number {
  return kind === 'long' ? COOLDOWN_LONG_MIN : COOLDOWN_MIN
}

/** 记录留存上限 */
const CAP = 400

let uniq = 1

function nextId(): number {
  return Date.now() * 100 + (uniq++ % 100)
}

/** 时段分箱：早 / 午 / 晚 / 深夜（深夜单独一箱，因为多数失控发生在那里） */
export type HourBand = 'morning' | 'noon' | 'evening' | 'night'

export const HOUR_BAND_LABEL: Record<HourBand, string> = {
  morning: '早上 6-11',
  noon: '中午 11-17',
  evening: '晚上 17-23',
  night: '深夜 23-6',
}

export function bandOf(hour: number): HourBand {
  if (hour >= 6 && hour < 11) return 'morning'
  if (hour >= 11 && hour < 17) return 'noon'
  if (hour >= 17 && hour < 23) return 'evening'
  return 'night'
}

export const useUrgeStore = defineStore(
  'urge',
  () => {
    const records = ref<UrgeRecord[]>([])
    /** 冷却期截止时刻（0 = 无） */
    const cooldownUntil = ref(0)
    /** 当前这段冷却的档位（决定倒计时怎么显示、走完怎么写这一笔） */
    const cooldownKind = ref<CooldownKind>('quick')

    function add(input: {
      trigger: string
      feeling: string
      intensity: number
      acted: boolean
      alternative?: string
    }): UrgeRecord | null {
      const trigger = input.trigger.trim()
      if (!trigger) return null
      const at = Date.now()
      const d = new Date(at)
      const rec: UrgeRecord = {
        id: nextId(),
        at,
        day: todayKey(d),
        hour: d.getHours(),
        trigger,
        feeling: input.feeling,
        intensity: Math.max(1, Math.min(5, Math.round(input.intensity))),
        acted: input.acted,
        alternative: input.alternative?.trim() || undefined,
      }
      records.value.unshift(rec)
      if (records.value.length > CAP) records.value = records.value.slice(0, CAP)
      logTrace({ kind: 'pause.urge', text: `${trigger} · ${rec.feeling}`, ref: `urge-${rec.id}` })
      return rec
    }

    function remove(id: number, silent = true): void {
      records.value = records.value.filter((r) => r.id !== id)
      if (!silent) return
    }

    /* ---------------- 冷却期 ---------------- */
    /** 剩余秒数（响应式：由页面定时器驱动刷新） */
    function cooldownRemain(now = Date.now()): number {
      return Math.max(0, Math.ceil((cooldownUntil.value - now) / 1000))
    }

    /** 倒计时显示：快档走 MM:SS，长档走「N 天 N 小时」（48 小时按秒读没人看得下去） */
    function cooldownText(now = Date.now()): string {
      const s = cooldownRemain(now)
      if (s <= 0) return ''
      if (cooldownKind.value === 'quick') {
        const m = Math.floor(s / 60)
        const sec = s % 60
        return `${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}`
      }
      const hours = Math.floor(s / 3600)
      const days = Math.floor(hours / 24)
      return days > 0 ? `${days} 天 ${hours % 24} 小时` : `${hours} 小时`
    }

    function startCooldown(kind: CooldownKind = 'quick'): void {
      cooldownKind.value = kind
      cooldownUntil.value = Date.now() + cooldownMinutesOf(kind) * 60 * 1000
    }

    function clearCooldown(): void {
      cooldownUntil.value = 0
    }

    function finishCooldown(): void {
      if (!cooldownUntil.value) return
      const kind = cooldownKind.value
      clearCooldown()
      logTrace({
        kind: 'pause.cooldown',
        text: kind === 'long' ? '撑过 48 小时冷却' : '走完一段冷却',
      })
    }

    /* ---------------- 触发点地图 ---------------- */
    /** 按触发点聚合：次数 / 平均强度 / 没做成的比例 */
    const byTrigger = computed(() => {
      const map = new Map<string, { trigger: string; count: number; intensitySum: number; resisted: number }>()
      for (const r of records.value) {
        const hit = map.get(r.trigger) ?? { trigger: r.trigger, count: 0, intensitySum: 0, resisted: 0 }
        hit.count += 1
        hit.intensitySum += r.intensity
        if (!r.acted) hit.resisted += 1
        map.set(r.trigger, hit)
      }
      return [...map.values()]
        .map((x) => ({
          trigger: x.trigger,
          count: x.count,
          avgIntensity: Math.round((x.intensitySum / x.count) * 10) / 10,
          resistedRate: Math.round((x.resisted / x.count) * 100),
        }))
        .sort((a, b) => b.count - a.count)
    })

    /** 按时段聚合 */
    const byHourBand = computed(() => {
      const bands: HourBand[] = ['morning', 'noon', 'evening', 'night']
      const total = Math.max(1, records.value.length)
      return bands.map((b) => {
        const list = records.value.filter((r) => bandOf(r.hour) === b)
        return {
          band: b,
          label: HOUR_BAND_LABEL[b],
          count: list.length,
          pct: Math.round((list.length / total) * 100),
        }
      })
    })

    /** 一句话结论（地图页顶部）：只有样本够了才敢下结论 */
    const insight = computed(() => {
      const total = records.value.length
      if (total < 5) return `再记 ${5 - total} 次，就能看出你的触发点了。`
      const top = byTrigger.value[0]
      const band = [...byHourBand.value].sort((a, b) => b.count - a.count)[0]
      if (!top || !band) return ''
      return `这 ${total} 次里，「${top.trigger}」最多（${top.count} 次，平均强度 ${top.avgIntensity}），多发生在${band.label}。`
    })

    function ofDay(day = todayKey()): UrgeRecord[] {
      return records.value.filter((r) => r.day === day)
    }

    return {
      records,
      cooldownUntil,
      cooldownKind,
      add,
      remove,
      cooldownRemain,
      cooldownText,
      startCooldown,
      clearCooldown,
      finishCooldown,
      byTrigger,
      byHourBand,
      insight,
      ofDay,
    }
  },
  {
    persist: { key: 'urge', paths: ['records', 'cooldownUntil', 'cooldownKind'] },
  },
)

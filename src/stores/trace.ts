/**
 * 痕迹流 store —— **四环统一事件流**（观/止/知/行的所有行为都落在这里）。
 *
 * 一次行为 = 一条 trace：{ at, day, kind, hall, text, ref, level, value }
 *  - kind：19 种事件之一（见 config/trace.ts，含所属环与修为分值）；
 *  - ref：关联对象 id（如 theory-xxx / obs-xxx），便于「这条痕迹因何而起」；
 *  - level：深度等级（观的三档 / 知的 Lv.1-3）；
 *  - value：本次入账的修为（缺省按事件表，显式传则以显式为准）。
 *
 * 旧数据（只有 type: 'todo'|'habit'|'box'）**自动迁移**：读取时按
 * LEGACY_TYPE_KIND 补全 kind/hall/value，不改写磁盘上的老记录，
 * 因此老备份恢复后依然能正常显示。
 */
import { defineStore } from 'pinia'
import { computed, ref } from 'vue'
import { todayKey } from '@/stores/daily'
import type { HallId } from '@/config/lexicon'
import { LEGACY_TYPE_KIND, hallOf, valueOf } from '@/config/trace'
import type { TraceKind } from '@/config/trace'

/** 旧字段：仅老数据残留（type → kind 已迁移） */
export type TraceType = 'todo' | 'habit' | 'box'

export interface Trace {
  id: number
  at: number
  /** 自然日键 'YYYY-MM-DD' */
  day: string
  /** 事件类型（19 种） */
  kind: TraceKind
  /** 所属环（由 kind 推导，冗余存储便于筛选） */
  hall: HallId
  text: string
  /** 关联对象 id */
  ref?: string
  /** 深度等级 */
  level?: number
  /** 本次修为 */
  value: number
  /** 旧字段（老数据兼容，新数据不写） */
  type?: TraceType
}

export interface TraceInput {
  kind: TraceKind
  text: string
  ref?: string
  level?: number
  /** 显式修为（如「完成 3 件」按件数计）；缺省取事件表分值 */
  value?: number
  /** 自定义时刻（补录时用） */
  at?: number
}

let uniq = 1

function nextId(): number {
  return Date.now() * 100 + (uniq++ % 100)
}

/** 老记录 → 新结构（幂等、不落盘） */
function normalize(t: Trace): Trace {
  if (t.kind) {
    return { ...t, hall: t.hall ?? hallOf(t.kind), value: typeof t.value === 'number' ? t.value : valueOf(t.kind) }
  }
  const kind = LEGACY_TYPE_KIND[t.type ?? ''] ?? 'action.todo'
  return {
    ...t,
    kind,
    hall: t.hall ?? hallOf(kind),
    value: typeof t.value === 'number' ? t.value : valueOf(kind),
  }
}

/** 清理审计：谁删的、删了多少、覆盖哪段时间（本地留存最近 50 条） */
export interface PruneRecord {
  at: number
  removed: number
  from: string
  to: string
  reason: string
}

const PRUNE_AUDIT_KEY = 'insight:audit:prune'

function writePruneAudit(rec: PruneRecord): void {
  try {
    const raw = uni.getStorageSync(PRUNE_AUDIT_KEY)
    let list: PruneRecord[] = []
    if (Array.isArray(raw)) list = raw as PruneRecord[]
    else if (typeof raw === 'string' && raw) list = JSON.parse(raw) as PruneRecord[]
    list.unshift(rec)
    uni.setStorageSync(PRUNE_AUDIT_KEY, JSON.stringify(list.slice(0, 50)))
  } catch {
    // 审计写失败不影响主流程
  }
}

/** 供设置页展示（最近一次清理） */
export function readPruneAudit(): PruneRecord[] {
  try {
    const raw = uni.getStorageSync(PRUNE_AUDIT_KEY)
    if (Array.isArray(raw)) return raw as PruneRecord[]
    if (typeof raw === 'string' && raw) return JSON.parse(raw) as PruneRecord[]
  } catch {
    // 忽略
  }
  return []
}

export const useTraceStore = defineStore(
  'trace',
  () => {
    const traces = ref<Trace[]>([])
    /** 归一化后的列表（老数据自动迁移），页面一律读它 */
    const list = computed<Trace[]>(() => traces.value.map(normalize))

    /** 软上限：超出后按时间淘汰最旧的（留 1800 条） */
    const CAP = 2000
    const KEEP = 1800
    /** 硬上限：超过 730 天的痕迹自动清理（清理动作本身留审计） */
    const CLEAR_AFTER_DAYS = 730

    /** 写入一条痕迹（新在前） */
    function push(input: TraceInput): Trace {
      const at = input.at ?? Date.now()
      const value = typeof input.value === 'number' ? input.value : valueOf(input.kind)
      const trace: Trace = {
        id: nextId(),
        at,
        day: todayKey(new Date(at)),
        kind: input.kind,
        hall: hallOf(input.kind),
        text: input.text,
        ref: input.ref,
        level: input.level,
        value,
      }
      traces.value.unshift(trace)
      prune()
      return trace
    }

    /** 容量与时效双重清理 */
    function prune(): void {
      // 1) 时效：超过 730 天
      const deadline = Date.now() - CLEAR_AFTER_DAYS * 24 * 60 * 60 * 1000
      const kept = traces.value.filter((t) => t.at >= deadline)
      const expired = traces.value.length - kept.length
      if (expired > 0) {
        const sorted = [...traces.value].sort((a, b) => a.at - b.at)
        writePruneAudit({
          at: Date.now(),
          removed: expired,
          from: todayKey(new Date(sorted[0].at)),
          to: todayKey(new Date(deadline)),
          reason: `超过 ${CLEAR_AFTER_DAYS} 天`,
        })
        traces.value = kept
      }
      // 2) 容量：软上限
      if (traces.value.length > CAP) {
        const sorted = [...traces.value].sort((a, b) => b.at - a.at)
        const droppedCount = traces.value.length - KEEP
        writePruneAudit({
          at: Date.now(),
          removed: droppedCount,
          from: todayKey(new Date(sorted[sorted.length - 1].at)),
          to: todayKey(new Date(sorted[KEEP].at)),
          reason: `超出软上限 ${CAP} 条`,
        })
        traces.value = sorted.slice(0, KEEP)
      }
    }

    function clearAll(): void {
      traces.value = []
    }

    function ofDay(day: string): Trace[] {
      return list.value.filter((t) => t.day === day)
    }

    function between(fromKey: string, toKey: string): Trace[] {
      return list.value.filter((t) => t.day >= fromKey && t.day <= toKey)
    }

    /** 某一环的全部痕迹（我页四维 / 雷达用） */
    function ofHall(hall: HallId): Trace[] {
      return list.value.filter((t) => t.hall === hall)
    }

    /** 某类事件的次数（徽章 / 统计用） */
    function countKind(kind: TraceKind): number {
      return list.value.filter((t) => t.kind === kind).length
    }

    /**
     * 某日某类事件的条数（每日入账上限判定用）。
     * 注意统计的是**全部条数**（含触顶后 value=0 的那些），
     * 否则触顶后计数不再增长，下一次又会给分，上限形同虚设。
     */
    function countKindOn(day: string, kind: TraceKind): number {
      return list.value.filter((t) => t.day === day && t.kind === kind).length
    }

    /** 某日某环的修为（雷达用：以 value 累加，而非按行为次数） */
    function valueOn(day: string, hall: HallId): number {
      return ofDay(day)
        .filter((t) => t.hall === hall)
        .reduce((sum, t) => sum + (t.value || 0), 0)
    }

    /** 最近 n 条 */
    function recent(n = 20): Trace[] {
      return list.value.slice(0, n)
    }

    /** 与某对象关联的痕迹 */
    function ofRef(ref: string): Trace[] {
      return list.value.filter((t) => t.ref === ref)
    }

    return { traces, list, push, prune, clearAll, ofDay, between, ofHall, countKind, countKindOn, valueOn, recent, ofRef }
  },
  {
    persist: { key: 'trace', paths: ['traces'] },
  },
)

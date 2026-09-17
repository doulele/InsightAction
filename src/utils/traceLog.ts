/**
 * logTrace —— 一次行为的**统一落点**。
 *
 * 页面/组件不要再手动 `xp.gain(N)`，一律：
 *   logTrace({ kind: 'observe.source', text: '读了《…》', ref: obs.id, level: 1 })
 *
 * 它做两件事：
 *  1. 写一条痕迹（四环统一事件流）；
 *  2. 按事件的 value 入账修为（显式 value 优先，缺省查 config/trace.ts 的分值表）。
 *
 * 这样"加一个新行为值多少分"只改 config/trace.ts 一张表，不会散落在十几个页面里。
 *
 * 每日上限（规格 §12.2）：高频动作触顶后**仍写 trace，只是 value 归零**——
 * 痕迹记录了"你确实做了这件事"，只是不再付钱。见 config/trace.ts 的 DAY_CAP。
 *
 * 安息日（2026-09-17）：那天同样「照写痕迹、不入账」。这是**全局唯一的开关点** ——
 * 页面不各自判断，见 utils/sabbath.ts。
 */
import { useTraceStore } from '@/stores/trace'
import type { Trace, TraceInput } from '@/stores/trace'
import { useXpStore } from '@/stores/xp'
import { dayCapOf, valueOf } from '@/config/trace'
import type { TraceKind } from '@/config/trace'
import { todayKey } from '@/stores/daily'
import { isSabbathAt } from '@/utils/sabbath'

/** 当日该类事件是否已触顶（0 = 不限） */
function overCap(kind: TraceKind, at: number): boolean {
  const cap = dayCapOf(kind)
  if (cap <= 0) return false
  return useTraceStore().countKindOn(todayKey(new Date(at)), kind) >= cap
}

export function logTrace(input: TraceInput): Trace {
  const at = input.at ?? Date.now()
  const value = typeof input.value === 'number' ? input.value : valueOf(input.kind)
  // 两种「不给分」：① 当日触顶；② 安息日（功能照常，只是不记账）
  const noScore = value > 0 && (overCap(input.kind, at) || isSabbathAt(at))
  const trace = useTraceStore().push(noScore ? { ...input, value: 0 } : input)
  if (!noScore && trace.value > 0) useXpStore().gain(trace.value)
  return trace
}

/** 只留痕不入账（如"破誓"这类需要观察但不该给奖励的行为） */
export function logOnly(input: TraceInput): Trace {
  return useTraceStore().push({ ...input, value: 0 })
}

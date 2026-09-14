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
 */
import { useTraceStore } from '@/stores/trace'
import type { Trace, TraceInput } from '@/stores/trace'
import { useXpStore } from '@/stores/xp'

export function logTrace(input: TraceInput): Trace {
  const trace = useTraceStore().push(input)
  if (trace.value > 0) useXpStore().gain(trace.value)
  return trace
}

/** 只留痕不入账（如"破誓"这类需要观察但不该给奖励的行为） */
export function logOnly(input: TraceInput): Trace {
  return useTraceStore().push({ ...input, value: 0 })
}

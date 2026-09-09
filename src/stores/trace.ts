/**
 * 痕迹流 store —— 行为事件的时间序列（行动大厅/我页时间轴的数据源）。
 * 批次 C · 行 + 我：三件事完成、习惯打卡、开盲盒都留下一笔痕迹（type + 文本 + 时刻）。
 */
import { defineStore } from 'pinia'
import { ref } from 'vue'
import { todayKey } from '@/stores/daily'

export type TraceType = 'todo' | 'habit' | 'box'

export interface Trace {
  id: number
  type: TraceType
  text: string
  /** 自然日键 */
  day: string
  /** 时间戳 */
  at: number
}

let uniq = 1

function nextId(): number {
  return Date.now() * 100 + (uniq++ % 100)
}

export const TRACE_LABEL: Record<TraceType, string> = {
  todo: '完成三件事',
  habit: '习惯打卡',
  box: '开了个盲盒',
}

export const useTraceStore = defineStore(
  'trace',
  () => {
    const traces = ref<Trace[]>([])
    /** 上限：只留最近 500 条，避免无限增长 */
    const CAP = 500

    /** 新在前 */
    function push(type: TraceType, text: string, at = Date.now()): void {
      traces.value.unshift({ id: nextId(), type, text, day: todayKey(new Date(at)), at })
      if (traces.value.length > CAP) {
        traces.value = traces.value.slice(0, CAP)
      }
    }

    function clearAll(): void {
      traces.value = []
    }

    function ofDay(day: string): Trace[] {
      return traces.value.filter((t) => t.day === day)
    }

    function between(fromKey: string, toKey: string): Trace[] {
      return traces.value.filter((t) => t.day >= fromKey && t.day <= toKey)
    }

    return { traces, push, clearAll, ofDay, between }
  },
  {
    persist: { key: 'trace', paths: ['traces'] },
  },
)

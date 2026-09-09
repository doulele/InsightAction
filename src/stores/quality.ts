/**
 * 信息源质量榜 store ——「统计各来源历史有用率，留下真正值得读的少数」。
 * 批次 B 收尾 · 观子页（观事 → 观理：辨别信息源的质量）。
 * 数据入口：观大厅每条极简报可标「有用 / 没用」，按来源名归集；
 * 也可在质量榜子页对来源直接标注。纯本地，云同步后端期接入。
 */
import { defineStore } from 'pinia'
import { ref } from 'vue'
import { todayKey } from '@/stores/daily'

export interface SourceStat {
  /** 来源名（从简报 src / 用户手动登记而来） */
  name: string
  /** 累计被标「有用」次数 */
  useful: number
  /** 累计被标「没用」次数 */
  useless: number
  /** 是否追更：关掉即从信息流中隐去（本地只记录偏好） */
  watched: boolean
  /** 最近一次标注时刻（用于「今日更新」判断） */
  updatedAt: number
}

/** 预置来源：极简报 mock 的三源 + 两个常见订阅，让榜单首屏有物可看 */
export const SEED_SOURCES: readonly string[] = ['观止研究', '专注实验室', '知识工作周报', '洞见周刊', '闲时播客']

export const useQualityStore = defineStore(
  'quality',
  () => {
    const sources = ref<SourceStat[]>(
      SEED_SOURCES.map((name) => ({ name, useful: 0, useless: 0, watched: true, updatedAt: 0 })),
    )
    /** 按自然日记录标注量（供「我」四维·观与趋势展示） */
    const dayMarks = ref<Record<string, { useful: number; useless: number }>>({})

    function find(name: string): SourceStat | undefined {
      const n = name.trim()
      return sources.value.find((s) => s.name === n)
    }

    function ensure(name: string): SourceStat {
      const hit = find(name)
      if (hit) return hit
      const created: SourceStat = { name: name.trim(), useful: 0, useless: 0, watched: true, updatedAt: 0 }
      sources.value.push(created)
      return created
    }

    /** 对某个来源记一笔「有用 / 没用」；来源不存在时自动登记 */
    function mark(name: string, useful: boolean): void {
      const s = ensure(name)
      if (useful) s.useful += 1
      else s.useless += 1
      s.updatedAt = Date.now()
      const k = todayKey()
      const rec = dayMarks.value[k] ?? { useful: 0, useless: 0 }
      if (useful) rec.useful += 1
      else rec.useless += 1
      dayMarks.value[k] = rec
    }

    /** 某日标注量（默认今天） */
    function marksOn(date = todayKey()): { useful: number; useless: number; total: number } {
      const rec = dayMarks.value[date]
      const useful = rec?.useful ?? 0
      const useless = rec?.useless ?? 0
      return { useful, useless, total: useful + useless }
    }

    /** 追更开关 */
    function setWatched(name: string, on: boolean): void {
      const s = find(name)
      if (s) s.watched = on
    }

    return { sources, dayMarks, find, ensure, mark, setWatched, marksOn }
  },
  {
    persist: { key: 'quality', paths: ['sources', 'dayMarks'] },
  },
)

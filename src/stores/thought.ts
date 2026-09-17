/**
 * 止念记录 store ——「止 · 止念」层（2026-09-17，规格 v2 §4.2 轴一；2026-09-17（二）本轮扩充）。
 *
 * 止念不是"别想" —— 想不想得停，不由意志决定。能做的只有一件事：
 * 把那个反复转的念头**从脑子里挪到纸上**，然后判它现在有没有解。
 *   有解 → 它就是「行」里的一件事（用户自己去立，这里只给一条路）
 *   没解 → 写一句"先放下"，把这件事从脑内挪走即可
 *
 * 刻意**不挂计时器**：给一段时间是沙漏与茶室的职责，再挂一个倒计时是同一件事做两遍。
 * 止念要的是"命名 + 判定"，不是又一段静坐。
 *
 * 本轮（2026-09-17（二））新增四块，都是"止念"这一层本来就该有、但第一版只做了"写"的部分：
 *   ① 念头地图 —— 纯派生视图（能做/先放下比例、时段分布、反复出现的那几件），与冲动记录页同构；样本 < 5 不下结论
 *   ② 重复识别 —— 同一件事反复回来时，写之前就提示"这事你 X 月 Y 日也停过笔（当时判了…）"；只陈述事实，不评"你想太多了"
 *   ③ 搁置与到期轻问 —— "先放下"给一个去处（今晚 / 三天后 / 就此放下），到期只浮出来一次问"现在还想吗"
 *   ④ 反刍后省察 —— 记下后就地挂情境省察（probe scene='thought'），答完沉淀一张 Lv.3 卡进「知」
 *
 * 观察边界：只用来回看"最近在反复想什么"，**不做频率排名、不做"你今天想太多了"这类评价**。
 */
import { defineStore } from 'pinia'
import { computed, ref } from 'vue'
import { todayKey } from '@/stores/daily'
import { logTrace } from '@/utils/traceLog'

/** 判定结果：act = 现在能做什么 / let = 现在做不了，先放下 */
export type ThoughtAnswer = 'act' | 'let'

/** 搁置窗口：今晚 / 三天后（省略 = 就此放下） */
export type ShelveKind = 'tonight' | 'days3'

export interface ThoughtRecord {
  id: number
  at: number
  /** YYYY-MM-DD */
  day: string
  /** 此刻在反复想的那件事 */
  text: string
  answer: ThoughtAnswer
  /** answer = act 时，第一件能做的事 */
  action?: string
  /** answer = let 时选的搁置窗口（省略 = 就此放下，不候回看） */
  shelved?: ShelveKind
  /** 该窗口到期的绝对时刻（0 / 空 = 不候回看） */
  revisitAt?: number
  /** "过去了就划掉" —— 已了结，不再浮出到期列表 */
  closed?: boolean
}

/** 记录留存上限（与冲动记录的 400 不同：止念一次只写一句，不需要那么大） */
const CAP = 200
/** 输入长度上限：写长了就变成分析，不是止念 */
export const THOUGHT_TEXT_MAX = 40
export const THOUGHT_ACTION_MAX = 30

/** 搁置窗口选项（页面文案唯一来源，别在页面里写死） */
export const SHELVE_KINDS: ReadonlyArray<{ id: ShelveKind; label: string; note: string }> = [
  { id: 'tonight', label: '今晚', note: '今天睡前再看一眼它还在不在' },
  { id: 'days3', label: '三天后', note: '放三天，三天后还惦记才算真牵挂' },
]

/** 窗口 → 到期绝对时刻（今晚 = 当天 23:59:59；三天后 = 现在 + 3 天） */
export function revisitAtOf(kind: ShelveKind): number {
  if (kind === 'tonight') {
    const d = new Date()
    d.setHours(23, 59, 59, 0)
    return d.getTime()
  }
  return Date.now() + 3 * 86400 * 1000
}

let uniq = 1

function nextId(): number {
  return Date.now() * 100 + (uniq++ % 100)
}

/* ---------------------------------------------------------------------------
 * 重复识别：同一件事反复回来，是反刍最核心的特征 —— 而这一点用户自己看不见。
 * 纯本地文本比较，不需要 AI。
 * ------------------------------------------------------------------------- */

/** 归一化：小写、丢空格与常见标点，只留中英文与数字（避免 \p{P} 在各端 JS 引擎的兼容问题） */
function norm(s: string): string {
  return s
    .toLowerCase()
    .replace(/[\s,.!?;:'"、。，！？；：'"，．（）()【】\[\]…—\-_/\\]/g, '')
}

/** 两句话的相似度：包含关系给 0.85，否则按字符集 Jaccard */
function overlap(a: string, b: string): number {
  const na = norm(a)
  const nb = norm(b)
  if (!na || !nb) return 0
  if (na === nb) return 1
  if (na.includes(nb) || nb.includes(na)) return 0.85
  const sa = new Set([...na])
  const sb = new Set([...nb])
  let inter = 0
  sa.forEach((c) => {
    if (sb.has(c)) inter += 1
  })
  const union = sa.size + sb.size - inter
  return union ? inter / union : 0
}

/** 共享的不同字符数（短句也能判定的兜底） */
function sharedCount(a: string, b: string): number {
  const sa = new Set([...norm(a)])
  const sb = new Set([...norm(b)])
  let n = 0
  sa.forEach((c) => {
    if (sb.has(c)) n += 1
  })
  return n
}

let innerId = 1

export const useThoughtStore = defineStore(
  'thought',
  () => {
    const records = ref<ThoughtRecord[]>([])

    function add(input: {
      text: string
      answer: ThoughtAnswer
      action?: string
      shelved?: ShelveKind | null
    }): ThoughtRecord | null {
      const text = input.text.trim().slice(0, THOUGHT_TEXT_MAX)
      if (!text) return null
      const at = Date.now()
      const shelved = input.shelved || null
      const rec: ThoughtRecord = {
        id: nextId(),
        at,
        day: todayKey(new Date(at)),
        text,
        answer: input.answer,
        action:
          input.answer === 'act'
            ? input.action?.trim().slice(0, THOUGHT_ACTION_MAX) || undefined
            : undefined,
        shelved: shelved || undefined,
        revisitAt: shelved ? revisitAtOf(shelved) : 0,
        closed: false,
      }
      records.value.unshift(rec)
      if (records.value.length > CAP) records.value = records.value.slice(0, CAP)
      logTrace({ kind: 'pause.thought', text, ref: `thought-${rec.id}` })
      return rec
    }

    function remove(id: number): void {
      records.value = records.value.filter((r) => r.id !== id)
    }

    function ofDay(day = todayKey()): ThoughtRecord[] {
      return records.value.filter((r) => r.day === day)
    }

    /** ② 重复识别：与历史记录比较，返回最像的那一条（阈值：包含/相似 0.85，或字符集重合 ≥ 2 且相似 ≥ 0.5） */
    function matchPrior(input: string): { rec: ThoughtRecord; score: number } | null {
      const t = input.trim()
      if (t.length < 4) return null
      let best: { rec: ThoughtRecord; score: number } | null = null
      for (const r of records.value) {
        const s = overlap(t, r.text)
        if (s >= 0.5 && (s >= 0.85 || sharedCount(t, r.text) >= 2)) {
          if (!best || s > best.score) best = { rec: r, score: s }
        }
      }
      return best
    }

    /** ③ 到期轻问：已搁置、到点、未了结的那些 */
    const due = computed(() => {
      const now = Date.now()
      return records.value.filter(
        (r) => !r.closed && r.revisitAt && r.revisitAt > 0 && r.revisitAt <= now,
      )
    })

    function closeShelf(id: number): void {
      const r = records.value.find((x) => x.id === id)
      if (r) r.closed = true
    }

    /** "还想" —— 再放三天（沿用 days3 窗口） */
    function reshelve(id: number): void {
      const r = records.value.find((x) => x.id === id)
      if (r) {
        r.shelved = 'days3'
        r.revisitAt = revisitAtOf('days3')
        r.closed = false
      }
    }

    /** ① 念头地图 · 能做 / 先放下 计数 */
    const byAnswer = computed(() => ({
      act: records.value.filter((r) => r.answer === 'act').length,
      let: records.value.filter((r) => r.answer === 'let').length,
    }))

    /** ① 念头地图 · 时段分布（按 at 的小时落桶，不排名只画形状） */
    const HOUR_BANDS = [
      { label: '凌晨', start: 0, end: 5 },
      { label: '上午', start: 6, end: 11 },
      { label: '下午', start: 12, end: 17 },
      { label: '晚间', start: 18, end: 23 },
    ]
    const byHourBand = computed(() =>
      HOUR_BANDS.map((b) => ({
        label: b.label,
        count: records.value.filter((r) => {
          const h = new Date(r.at).getHours()
          return h >= b.start && h <= b.end
        }).length,
      })),
    )

    /** ① 念头地图 · 反复出现的那几件（按相似度聚成簇，只列出现 ≥ 2 次、前三） */
    interface ThemeCluster {
      sample: string
      count: number
      lastDay: string
      lastAnswer: ThoughtAnswer
    }
    const recurring = computed<ThemeCluster[]>(() => {
      const clusters: Array<ThemeCluster & { lastAt: number }> = []
      for (const r of records.value) {
        const hit = clusters.find((c) => overlap(c.sample, r.text) >= 0.5)
        if (hit) {
          hit.count += 1
          if (r.at > hit.lastAt) {
            hit.lastAt = r.at
            hit.lastDay = r.day
            hit.lastAnswer = r.answer
          }
        } else {
          clusters.push({
            sample: r.text,
            count: 1,
            lastDay: r.day,
            lastAnswer: r.answer,
            lastAt: r.at,
          })
        }
      }
      return clusters
        .filter((c) => c.count >= 2)
        .sort((a, b) => b.count - a.count)
        .slice(0, 3)
        .map(({ sample, count, lastDay, lastAnswer }) => ({
          sample,
          count,
          lastDay,
          lastAnswer,
        }))
    })

    return {
      records,
      add,
      remove,
      ofDay,
      matchPrior,
      due,
      closeShelf,
      reshelve,
      byAnswer,
      byHourBand,
      recurring,
    }
  },
  {
    persist: { key: 'thought', paths: ['records'] },
  },
)

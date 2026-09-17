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
 * 2026-09-17（四）口径校准（与用户逐条谈定）：
 *   · 「今晚」的到点从 23:59:59 改成 **21:30** —— 23:59 到点时人已睡，"今晚"这个承诺兑现不了；
 *     深夜才写（已过 21:30）则顺延到明晚，不给一个已经过去的时刻。
 *   · 取数门槛**分块**（MAP_NEED）：比例 3 / 时段 5 / 反复 5 / 到期无门槛 —— 全用一个 5 会让
 *     "到点了"这件事实被样本不足挡掉，而它根本不是统计。
 *   · `recurring` 的门槛改成「**跨天**出现 ≥ 2 次」—— 同一天写两遍不算反复回来。
 *   · 新增 `insight`：地图页顶部那一句，只陈述计数与形状，**不下"你焦虑""想太多"这类结论**。
 *     比例条也**刻意不给百分比** —— "75% 你都只能先放下"本身就是一句负向评价。
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
  { id: 'tonight', label: '今晚', note: '今晚 21:30 再看一眼它还在不在' },
  { id: 'days3', label: '三天后', note: '放三天，三天后还惦记才算真牵挂' },
]

/**
 * 「今晚」的到点时刻 = 21:30。
 * 口径（2026-09-17（四）与用户定）：睡前惯例时间，真的还能看一眼。
 * 原本写的 23:59:59 不对 —— 到点时人已睡，"今晚"这个承诺兑现不了，第二天早上才看到等于没到。
 */
const TONIGHT_HOUR = 21
const TONIGHT_MINUTE = 30

/** 窗口 → 到期绝对时刻（今晚 = 最近一个 21:30；三天后 = 现在 + 3 天） */
export function revisitAtOf(kind: ShelveKind): number {
  if (kind === 'tonight') {
    const d = new Date()
    d.setHours(TONIGHT_HOUR, TONIGHT_MINUTE, 0, 0)
    /* 深夜才写（已过 21:30）→ 顺延到明晚，不能给一个已经过去的时刻 */
    if (d.getTime() <= Date.now()) d.setDate(d.getDate() + 1)
    return d.getTime()
  }
  return Date.now() + 3 * 86400 * 1000
}

/**
 * 念头地图各块的取数门槛（**刻意分块，不是一个 5**）：
 *   比例条 —— 只是两个计数，不是结论 → 3 条就能看
 *   时段分布 —— 4 个桶平摊，少了每桶只剩 1 条，画出来是噪声 → 5 条
 *   反复出现的 —— 本身已要求出现 ≥ 2 次，再要求样本 ≥ 5 做双保险 → 5 条
 *   到期卡片 —— 无门槛（它不是统计，是"到点了"这一件事实）
 */
export const MAP_NEED = { ratio: 3, band: 5, theme: 5 } as const

/**
 * 一条记录的搁置状态。
 * `none` = 当时选的"就此放下"（没给窗口），`shelved` = 还在候着，`due` = 到点了，`closed` = 已了结。
 * 列表标记与档案导出共用这一份判定 —— 别在页面里各写一遍。
 */
export type ShelfState = 'none' | 'shelved' | 'due' | 'closed'

export function shelfStateOf(r: ThoughtRecord, now = Date.now()): ShelfState {
  if (!r.revisitAt || r.revisitAt <= 0) return 'none'
  if (r.closed) return 'closed'
  return r.revisitAt <= now ? 'due' : 'shelved'
}

/** 状态 → 一句人话（列表 / 档案用，只陈述事实） */
export function shelfTextOf(r: ThoughtRecord, now = Date.now()): string {
  const st = shelfStateOf(r, now)
  if (st === 'none') return '放下了'
  if (st === 'closed') return '已了结'
  const d = new Date(r.revisitAt as number)
  const md = `${d.getMonth() + 1}月${d.getDate()}日`
  return st === 'due' ? `${md} 到点，还候着` : `${md} 再看一眼`
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

    /**
     * ① 念头地图 · 反复出现的那几件（按相似度聚成簇，只列出现 ≥ 2 次、前三）。
     *
     * 门槛是「**跨天**出现 ≥ 2 次」，不只是条数 ≥ 2：
     * 同一天把同一件事写两遍（上午一遍、下午一遍）不算"反复回来"，
     * 那是当天的事在打转；只有跨过一夜还想起来，才是这一层要看的形状。
     * （原文档写的"过滤 shelved==='tonight' 的临时项"没有落地价值 ——
     *  ShelveKind 里根本没有 'today' 这个值，且真按窗口过滤会把真实的反刍一并藏掉。）
     */
    interface ThemeCluster {
      sample: string
      count: number
      lastDay: string
      lastAnswer: ThoughtAnswer
    }
    const recurring = computed<ThemeCluster[]>(() => {
      const clusters: Array<ThemeCluster & { lastAt: number; days: Set<string> }> = []
      for (const r of records.value) {
        const hit = clusters.find((c) => overlap(c.sample, r.text) >= 0.5)
        if (hit) {
          hit.count += 1
          hit.days.add(r.day)
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
            days: new Set([r.day]),
          })
        }
      }
      return clusters
        .filter((c) => c.count >= 2 && c.days.size >= 2)
        .sort((a, b) => b.count - a.count)
        .slice(0, 3)
        .map(({ sample, count, lastDay, lastAnswer }) => ({
          sample,
          count,
          lastDay,
          lastAnswer,
        }))
    })

    /**
     * 地图页顶部那一句（与 urge.insight 同构，但**只陈述不评价**）。
     * 不写"你最近很焦虑""想得太多"这类结论 —— 地图只负责把形状摆出来。
     */
    const insight = computed(() => {
      const total = records.value.length
      if (total < MAP_NEED.band) {
        return `再写 ${MAP_NEED.band - total} 念，这张地图才看得出形状。`
      }
      const a = byAnswer.value
      const top = [...byHourBand.value].sort((x, y) => y.count - x.count)[0]
      let s = `这 ${total} 念里，能接着做点什么的有 ${a.act} 条，写下来就放下的有 ${a.let} 条。`
      if (top && top.count > 0) s += `落笔最多的是${top.label}。`
      const theme = recurring.value[0]
      if (theme) s += `「${theme.sample.slice(0, 10)}」这样的事来过 ${theme.count} 次。`
      return s
    })

    /** 到点的条数（大厅入口徽标要用，避免在页面里再 filter 一遍） */
    const dueCount = computed(() => due.value.length)

    /** 还候着的条数（档案导出用：现在还有几件事悬着） */
    const pendingCount = computed(() => records.value.filter((r) => shelfStateOf(r) === 'shelved').length)

    return {
      records,
      add,
      remove,
      ofDay,
      matchPrior,
      due,
      dueCount,
      pendingCount,
      closeShelf,
      reshelve,
      byAnswer,
      byHourBand,
      recurring,
      insight,
    }
  },
  {
    persist: { key: 'thought', paths: ['records'] },
  },
)

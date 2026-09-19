/**
 * 来源账本 —— 从收件池**派生**「我把时间花在谁身上」。
 *
 * 为什么是派生，而不是再开一个 store（2026-09-17 定案）：
 *  原来的「信息源质量榜」要求用户对来源投「有用 / 没用」。但批次 E 把「极简报」换成
 *  「每日一则」之后，投票这个动作**已经没有入口**了 —— 榜单里只剩 5 个预置的假来源
 *  （`SEED_SOURCES`），既长不大、也不指向任何真实行为，还对不上账。
 *
 *  而「来源」这件事的真实数据一直都在收件池里：`ObsItem.sourceName` + 处理状态 + 主题。
 *  所以账本**不做输入、只做汇总**：你收了谁多少条、读完了几成、都在什么领域。
 *  没有投票、没有追更开关，也就没有"忘了标"这回事。
 *
 * 口径：
 *  - 没填来源的归到 `LEDGER_UNNAMED` 单列一行（不隐藏，也不做"该处理了"的提醒）；
 *  - 处理率 = 已处理 / 收下（收 0 条时为 0）；
 *  - 「收得多、处理得少」的阈值见 config/ledger.ts（页面不许自己写数字）。
 */
import type { ObsItem } from '@/stores/observe'
import {
  LEDGER_BACKLOG_MIN,
  LEDGER_BACKLOG_RATE,
  LEDGER_TOPIC_CAP,
  LEDGER_UNNAMED,
} from '@/config/ledger'

/** 一行里的领域分布 */
export interface SourceTopic {
  name: string
  count: number
}

export interface SourceRow {
  /** 来源名；空来源统一归 `LEDGER_UNNAMED` */
  name: string
  /** 收下条数 */
  total: number
  /** 已处理条数 */
  handled: number
  /** 处理率 0-100 */
  rate: number
  /** 收录的领域（按命中次数降序，最多 LEDGER_TOPIC_CAP 个） */
  topics: SourceTopic[]
  /** 最近一次收下的时刻 */
  lastAt: number
  /** 收得多、处理得少 */
  backlog: boolean
}

interface Bucket {
  total: number
  handled: number
  topics: Map<string, number>
  lastAt: number
}

/** 账本全表（收下条数降序；同样多时看最近一次） */
export function buildLedger(items: readonly ObsItem[]): SourceRow[] {
  const map = new Map<string, Bucket>()
  for (const it of items) {
    const name = it.sourceName?.trim() || LEDGER_UNNAMED
    const rec = map.get(name) ?? { total: 0, handled: 0, topics: new Map<string, number>(), lastAt: 0 }
    rec.total += 1
    if (it.handledAt) rec.handled += 1
    for (const t of it.topics ?? []) rec.topics.set(t, (rec.topics.get(t) ?? 0) + 1)
    rec.lastAt = Math.max(rec.lastAt, it.createdAt)
    map.set(name, rec)
  }

  return [...map.entries()]
    .map(([name, r]) => {
      const rate = r.total > 0 ? Math.round((r.handled / r.total) * 100) : 0
      const topics = [...r.topics.entries()]
        .sort((a, b) => b[1] - a[1])
        .slice(0, LEDGER_TOPIC_CAP)
        .map(([n, c]) => ({ name: n, count: c }))
      return {
        name,
        total: r.total,
        handled: r.handled,
        rate,
        topics,
        lastAt: r.lastAt,
        /* 「未标注来源」不做"该处理了"的提醒：那是"你没填"，不是"这个来源不值得读" */
        backlog: name !== LEDGER_UNNAMED && r.total >= LEDGER_BACKLOG_MIN && rate < LEDGER_BACKLOG_RATE,
      }
    })
    .sort((a, b) => b.total - a.total || b.lastAt - a.lastAt)
}

/** 大厅入口徽标用的小结 */
export function ledgerSummary(items: readonly ObsItem[]): { sources: number; backlog: number } {
  const rows = buildLedger(items)
  return { sources: rows.length, backlog: rows.filter((r) => r.backlog).length }
}

/**
 * 道 · 凝练句（2026-09-21）
 * ========================
 * 「道」在数据层就是 observe 里 `kind='mother'` 的条目（母题），它的 title 是一个**问句**
 * （「我到底在回避什么」）—— 那是反复会冒出来的东西，但它立不到扉页上。
 *
 * 所以在母题上多长出一行 `daoLine`：**一句 ≤ 24 字的主张**，由用户自己凝练。它有两个去处，
 * 共用这一份取用规则：
 *   1. 「观」大厅头部那句主张（HallHead 的 capLine）—— 有就用它，没有照旧用模式标签语；
 *   2. 开屏「今日一签」—— 排在到期回响之后、随机箴言之前。
 *
 * 三条口径：
 *  - **一天一句、当天全局同一条**：位置由「距起始日天数 % 条数」决定 —— 与 `config/daily.ts`
 *    同一个算法、同一个起始日（`DAILY_EPOCH`）。刻意不随机：同一天里多次冷启动看到同一句，
 *    那才有"今天就这一句"的仪式感；随机会让人以为开屏抽风了。
 *  - **只数写过凝练句的道**：没凝练的母题不参与（不能拿一个问句去充主张）。
 *  - **纯派生、不落库、不加缓存**：道改了，明天自然换过来。
 *
 * 与「模式标签语」的关系：模式标签语说的是"这一套表达语言是什么气质"（随模式变），
 * 凝练句说的是"你自己认同的那条道理"（不随模式变）。两者同时只能站一个位置 ——
 * 所以是**优先用自己的，没有才回落到模式的**，不是把两句叠在一起。
 */
import type { ObsItem } from '@/stores/observe'
import { DAILY_EPOCH } from './daily'

/**
 * 凝练句长度上限。
 *
 * 为什么是 24：它要坐进 HallHead 那句 32rpx 的主张位（`--hh-ink` 那行），
 * 再长就会折成两行把卡片撑歪；开屏那一屏的字号更大，更要短。
 * 页面用 `maxlength` 拦一次，store 里再截一次（store 是唯一闸门，新入口绕不过去）。
 */
export const DAO_LINE_MAX = 24

/** 「我的道」这个出处标签：开屏与观页头部小字都用它，改口径只改这里 */
export const DAO_FROM_LABEL = '我的道'

/** 一条可以拿去当"扉页"的道 */
export interface DaoEntry {
  /** 母题条目 id */
  id: string
  /** 母题名（问句）—— 用在出处行，让人知道这句是从哪条道上凝出来的 */
  name: string
  /** 凝练句（≤ DAO_LINE_MAX） */
  line: string
}

/**
 * 从母题列表里挑出"写过凝练句"的那些。
 * 保持传入顺序（observe.mothers 是新在前），于是轮换的起点是最近立的那条道。
 */
export function daoEntries(mothers: readonly ObsItem[]): DaoEntry[] {
  const out: DaoEntry[] = []
  for (const m of mothers) {
    const line = (m.daoLine ?? '').trim()
    if (line) out.push({ id: m.id, name: m.title || '', line })
  }
  return out
}

/**
 * 距起始日的天数。
 *
 * ⚠️ 与 `config/daily.ts` 的 `daysSinceEpoch` 是同一个基准（连 12:00 取整这个写法都一致）：
 * 换基准会让所有人的"今天是哪一句"整体错位，而这两处都不落库、算错也查不出来。
 */
function daysSinceEpoch(dateKey: string): number {
  const a = Date.parse(`${dateKey}T12:00:00`)
  const b = Date.parse(`${DAILY_EPOCH}T12:00:00`)
  if (Number.isNaN(a) || Number.isNaN(b)) return 0
  return Math.floor((a - b) / 86400000)
}

/**
 * 今天该显示的那一条道。
 *
 * @param dateKey 本地日期键，格式 `YYYY-MM-DD`（同 stores/daily.ts 的 `todayKey()`）
 * @returns 没有写过凝练句时返回 null —— 调用方据此**保持原样**（模式标签语 / 随机箴言），
 *          而不是显示一句"你还没有道"的提示：那会把开屏变成一张待办
 */
export function daoLineOf(dateKey: string, mothers: readonly ObsItem[]): DaoEntry | null {
  const list = daoEntries(mothers)
  if (!list.length) return null
  const n = list.length
  const i = ((daysSinceEpoch(dateKey) % n) + n) % n
  return list[i] ?? null
}

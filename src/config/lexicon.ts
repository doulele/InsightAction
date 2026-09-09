/**
 * 词表 lexicon —— 三模式「同一件事的不同说法」集中存放处。
 *
 * 页面不写死文案分支，只调用：
 *   hallStatus('observe', mode, { read: 3 })  → 得到该模式下大厅状态栏文案
 * 好处：三套语言的差异收拢在一处，改词不改逻辑。
 */
import type { ModeId } from './modes'

/** 各大厅状态栏所需的数据（按需取用，缺省显示 0） */
export interface DailyStats {
  /** 观：今日已读条数 / 信息配额总量 */
  read?: number
  quota?: number
  /** 止：今日专注分钟 / 连续天数 */
  focusMin?: number
  streak?: number
  /** 知：今日产出卡片 / 连续天数 */
  cards?: number
  /** 行：今日完成项 / 计划项 */
  done?: number
  plan?: number
}

export type HallId = 'observe' | 'pause' | 'reflect' | 'action'

type Formatter = (s: DailyStats) => string

/** 各模式文案（来自功能清单「状态栏用语差异」） */
const STATUS: Record<HallId, Record<ModeId, Formatter>> = {
  observe: {
    tech: (s) => `今日信息摄入 ${s.read ?? 0}/${s.quota ?? 5} 条 · 效率评分 --`,
    normal: (s) => `今日已读 ${s.read ?? 0} 条 · 状态 专注`,
    dao: (s) => `神识今日已探 ${s.read ?? 0}/${s.quota ?? 5} 处 · 灵台清明`,
  },
  pause: {
    tech: (s) => `今日专注 ${s.focusMin ?? 0} 分钟 · 连续 ${s.streak ?? 0} 天`,
    normal: (s) => `今日静心 ${s.focusMin ?? 0} 分钟 · 连续 ${s.streak ?? 0} 天`,
    dao: (s) => `今日定力 ${s.focusMin ?? 0} · 连续 ${s.streak ?? 0} 日道心稳固`,
  },
  reflect: {
    tech: (s) => `今日已记 ${s.cards ?? 0} 条 · 连续复盘 ${s.streak ?? 0} 天`,
    normal: (s) => `今日收获 ${s.cards ?? 0} 条 · 连续 ${s.streak ?? 0} 天`,
    dao: (s) => `今日悟道 ${s.cards ?? 0} 条 · 慧根渐长`,
  },
  action: {
    tech: (s) => `今日完成 ${s.done ?? 0}/${s.plan ?? 3} 项 · 行动力 --%`,
    normal: (s) => `今日做了 ${s.done ?? 0} 件事 · 状态 充实`,
    dao: (s) => `今日功德 +${s.done ?? 0} · 道行渐深`,
  },
}

/** 读取某一大厅 / 某一模式下的状态栏文案 */
export function hallStatus(hall: HallId, mode: ModeId, stats: DailyStats): string {
  return STATUS[hall][mode](stats)
}

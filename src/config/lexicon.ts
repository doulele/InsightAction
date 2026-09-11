/**
 * 词表 lexicon —— 三模式「同一件事的不同说法」集中存放处。
 *
 * 页面不写死文案分支，只调用：
 *   hallStatus('observe', mode, { read: 3 })  → 得到该模式下大厅状态栏文案
 *
 * 数据来源分两层：
 *   1. 远端内容下发（InsightActionBacend/config/content.json → lexicon）——改文案不用发版；
 *   2. 本文件的内置模板兜底 —— 接口不可用时行为与改动前完全一致。
 * 因为调用方只认 hallStatus()，所以「换数据源」不需要动任何页面。
 */
import type { ModeId } from './modes'
import { useContentStore } from '@/stores/content'

/** 各大厅状态栏所需的数据（按需取用，缺省见 PLACEHOLDER_DEFAULTS） */
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

/** 占位符缺省值（与原实现里的 ?? 默认值保持一致，保证文案渲染结果不变） */
const PLACEHOLDER_DEFAULTS: Record<string, number> = {
  read: 0,
  quota: 5,
  focusMin: 0,
  streak: 0,
  cards: 0,
  done: 0,
  plan: 3,
}

/** 内置模板（远端下发同名字段即覆盖）。占位符见 PLACEHOLDER_DEFAULTS */
const LOCAL_TEMPLATES: Record<HallId, Record<ModeId, string>> = {
  observe: {
    tech: '今日信息摄入 {read}/{quota} 条 · 效率评分 --',
    normal: '今日已读 {read} 条 · 状态 专注',
    dao: '神识今日已探 {read}/{quota} 处 · 灵台清明',
  },
  pause: {
    tech: '今日专注 {focusMin} 分钟 · 连续 {streak} 天',
    normal: '今日静心 {focusMin} 分钟 · 连续 {streak} 天',
    dao: '今日定力 {focusMin} · 连续 {streak} 日道心稳固',
  },
  reflect: {
    tech: '今日已记 {cards} 条 · 连续复盘 {streak} 天',
    normal: '今日收获 {cards} 条 · 连续 {streak} 天',
    dao: '今日悟道 {cards} 条 · 慧根渐长',
  },
  action: {
    tech: '今日完成 {done}/{plan} 项 · 行动力 --%',
    normal: '今日做了 {done} 件事 · 状态 充实',
    dao: '今日功德 +{done} · 道行渐深',
  },
}

/** 渲染模板：{key} → 实际数值（无数据时用缺省值；未知占位符渲染为空串） */
function render(template: string, stats: DailyStats): string {
  const bag = stats as Record<string, number | undefined>
  return template.replace(/\{(\w+)\}/g, (_all, key: string) => {
    const value = bag[key]
    if (typeof value === 'number') return String(value)
    const fallback = PLACEHOLDER_DEFAULTS[key]
    return fallback === undefined ? '' : String(fallback)
  })
}

/** 读取某一大厅 / 某一模式下的状态栏文案（远端优先，内置兜底） */
export function hallStatus(hall: HallId, mode: ModeId, stats: DailyStats): string {
  let template = LOCAL_TEMPLATES[hall]?.[mode] ?? ''
  try {
    // 远端模板为空串时按「未配置」处理，继续用内置模板
    template = useContentStore().lexiconOf(hall, mode) || template
  } catch {
    // 极端情况（pinia 尚未就绪）直接用内置模板
  }
  return render(template, stats)
}

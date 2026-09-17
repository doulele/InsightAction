/**
 * 痕迹事件字典 —— 四环（观 / 止 / 知 / 行）统一事件流的**唯一口径表**。
 *
 * 一次行为 = 一条 trace：
 *   { at, day, kind, hall, text, ref, level, value }
 * 修为不再由各页面手动「+N」，而是随 trace 的 value 入账（见 utils/traceLog.ts），
 * 所以「加一个新行为要加多少分」只需要改这张表。
 *
 * 20 种事件（观 5 / 止 7 / 知 3 / 行 5），hall 由 kind 前缀推导，不重复写。
 */
import type { HallId } from '@/config/lexicon'

export type TraceKind =
  // 观 · 5
  | 'observe.daily'
  | 'observe.source'
  | 'observe.theory'
  | 'observe.mother'
  | 'observe.clean'
  // 止 · 7
  | 'pause.interrupt'
  | 'pause.vow'
  | 'pause.vow.keep'
  | 'pause.vow.break'
  | 'pause.cooldown'
  | 'pause.urge'
  | 'pause.thought'
  // 知 · 3
  | 'reflect.note'
  | 'reflect.apply'
  | 'reflect.probe'
  // 行 · 5
  | 'action.todo'
  | 'action.habit'
  | 'action.challenge'
  | 'action.box'
  | 'action.body'

export interface TraceMeta {
  /** 所属环（由 kind 前缀推导，这里显式写死以避免运行时字符串切割出错） */
  hall: HallId
  /** 修为（规格 §12.1 分值表） */
  value: number
  /** 时间轴 / 周报上的中文标签 */
  label: string
}

export const TRACE_META: Record<TraceKind, TraceMeta> = {
  // 观
  'observe.daily': { hall: 'observe', value: 2, label: '每日一则' },
  'observe.source': { hall: 'observe', value: 5, label: '信源留痕' },
  'observe.theory': { hall: 'observe', value: 8, label: '立理' },
  'observe.mother': { hall: 'observe', value: 20, label: '提炼母题' },
  'observe.clean': { hall: 'observe', value: 3, label: '清理收件' },
  // 止
  'pause.interrupt': { hall: 'pause', value: 5, label: '触发干预' },
  'pause.vow': { hall: 'pause', value: 10, label: '许愿' },
  'pause.vow.keep': { hall: 'pause', value: 15, label: '守住誓愿' },
  'pause.vow.break': { hall: 'pause', value: 5, label: '破誓' },
  'pause.cooldown': { hall: 'pause', value: 3, label: '冷却期' },
  'pause.urge': { hall: 'pause', value: 2, label: '冲动记录' },
  'pause.thought': { hall: 'pause', value: 5, label: '止念' },
  // 知
  'reflect.note': { hall: 'reflect', value: 5, label: '记笔记' },
  'reflect.apply': { hall: 'reflect', value: 15, label: '用上了' },
  'reflect.probe': { hall: 'reflect', value: 10, label: '自省' },
  // 行
  'action.todo': { hall: 'action', value: 10, label: '完成一件事' },
  'action.habit': { hall: 'action', value: 6, label: '习惯打卡' },
  'action.challenge': { hall: 'action', value: 20, label: '完成挑战' },
  'action.box': { hall: 'action', value: 12, label: '盲盒达成' },
  'action.body': { hall: 'action', value: 2, label: '身体电量' },
}

/** 全部事件类型（供统计/筛选遍历） */
export const TRACE_KINDS = Object.keys(TRACE_META) as TraceKind[]

/**
 * 每日入账上限（规格 §12.2 · 防刷）。
 *
 * 修为是等级与愿望兑换的货币，能刷就等于整套数值失去可信度 —— 所以高频动作必须封顶。
 * 关键取舍：**上限只影响入账，永远不影响 trace 记录**。
 * 记录必须完整，否则脊椎会撒谎（周报的「一条路」、四维雷达都读它）。
 *
 * `observe.source` 不在此表 —— 它受信息配额（config/quota.ts）约束，两条规则不重复叠加。
 * `action.todo` 天然只有 3 件，仍写进来是为了堵住「改文本反复勾」这类绕法。
 */
export const DAY_CAP: Partial<Record<TraceKind, number>> = {
  'pause.urge': 5,
  'pause.thought': 3,
  'observe.clean': 5,
  'reflect.note': 5,
  'reflect.apply': 3,
  'action.todo': 3,
}

/** 该类事件的每日入账上限；0 = 不限 */
export function dayCapOf(kind: TraceKind): number {
  return DAY_CAP[kind] ?? 0
}

/** 旧版只有三个 type —— 迁移映射（读到老数据时按此补全 kind） */
export const LEGACY_TYPE_KIND: Record<string, TraceKind> = {
  todo: 'action.todo',
  habit: 'action.habit',
  box: 'action.box',
}

export function hallOf(kind: TraceKind): HallId {
  return TRACE_META[kind]?.hall ?? 'action'
}

/** 默认修为：显式传 value 时以显式为准（如「完成三件事」按件数计） */
export function valueOf(kind: TraceKind): number {
  return TRACE_META[kind]?.value ?? 0
}

export function kindLabel(kind: TraceKind): string {
  return TRACE_META[kind]?.label ?? '痕迹'
}

/** 兼容旧渲染：key 既可以是新 kind 也可以是旧 type */
export const TRACE_LABEL: Record<string, string> = {
  todo: '完成一件事',
  habit: '习惯打卡',
  box: '盲盒达成',
  ...Object.fromEntries(TRACE_KINDS.map((k) => [k, kindLabel(k)])),
}

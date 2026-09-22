/**
 * 痕迹事件字典 —— 四环（观 / 止 / 知 / 行）统一事件流的**唯一口径表**。
 *
 * 一次行为 = 一条 trace：
 *   { at, day, kind, hall, text, ref, level, value }
 * 修为不再由各页面手动「+N」，而是随 trace 的 value 入账（见 utils/traceLog.ts），
 * 所以「加一个新行为要加多少分」只需要改这张表。
 *
 * 26 种事件（观 5 / 止 7 / 知 6 / 行 8），hall 由 kind 前缀推导，不重复写。
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
  // 知 · 5
  | 'reflect.note'
  | 'reflect.apply'
  | 'reflect.probe'
  /** 旧卡重逢（2026-09-17）：隔一段时间再见一次自己写过的东西，判它还成不成立 */
  | 'reflect.echo'
  /** 拆开时间胶囊（2026-09-17）：到期的那句给未来的话，今天读到了 */
  | 'reflect.capsule'
  /**
   * 认领反刍线索（2026-09-17 止念分三面）：把「跨天反复回来的那件事」收下成一张卡。
   * 分值为 0 —— 这是**回看**行为，给分会开出一条刷分路径（在反复列表里反复点）。
   * 但它仍然留痕：时间轴与周报该看得到"你认出了自己在反复想什么"。
   */
  | 'reflect.thread'
  // 行 · 8
  | 'action.todo'
  | 'action.habit'
  | 'action.challenge'
  | 'action.box'
  | 'action.body'
  /** 日课勾选（2026-09-17）：每天重复一次的事（早睡 / 锻炼 / 戒断），守住一次记一笔 */
  | 'action.daily'
  /** 日课破了（2026-09-17）：只留痕不给分 —— 与立约「破了写一句」同一口径 */
  | 'action.daily.break'
  /** 今日收功（2026-09-17）：一天结束前把它收个尾 */
  | 'action.closing'

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
  'reflect.echo': { hall: 'reflect', value: 8, label: '旧卡重逢' },
  'reflect.capsule': { hall: 'reflect', value: 10, label: '拆开慢递' },
  /* 值 0：只留痕不入账（见 TraceKind 里的说明） */
  'reflect.thread': { hall: 'reflect', value: 0, label: '认领线索' },
  // 行
  'action.todo': { hall: 'action', value: 10, label: '完成一件事' },
  'action.habit': { hall: 'action', value: 6, label: '习惯打卡' },
  'action.challenge': { hall: 'action', value: 20, label: '完成挑战' },
  'action.box': { hall: 'action', value: 12, label: '盲盒达成' },
  'action.body': { hall: 'action', value: 2, label: '身体电量' },
  'action.daily': { hall: 'action', value: 8, label: '守住日课' },
  'action.daily.break': { hall: 'action', value: 0, label: '日课破了' },
  'action.closing': { hall: 'action', value: 8, label: '今日收功' },
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
  /* 2026-09-17 新增：日课每天最多 3 条计分（按每日重复一次的本性，天然不会超）；
     收功 / 重逢 / 拆胶囊都是「一天一次就够」的事，第二次起只留痕。 */
  'action.daily': 3,
  'action.closing': 1,
  'reflect.echo': 1,
  'reflect.capsule': 1,
  /*
   * 身体电量（2026-09-21）：一天最多计一次。
   * 手动点同步 + 进「行」大厅的静默续接都可能触发它，没有这道闸，
   * 反复点同步就成了反复领分。触顶后照常留痕，只是不再入账。
   */
  'action.body': 1,
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

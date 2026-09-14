/**
 * 每日信息配额 —— 「观」这一环的节制闸门（规格 §4.1 / 功能清单「信息配额」）。
 *
 * 为什么要有这道闸门：
 *  观这一环的失败方式不是「读得太少」，而是「存得太多、读得太浅」——
 *  收藏夹越长，人越心安，越不会真的读。配额把"今天能读几篇"变成一个有数的东西，
 *  逼出一个选择：这篇值不值得占掉今天的名额。
 *
 * 三条定死的规则：
 *  1. **基线 3 次**（沿用清单 v1.0 的设定），未建档就用基线；
 *  2. **测评的「观」维决定浮动 ±1**：观维高 → 摄入质量高，多给一次；
 *     观维是短板 → 摄入了也消化不了，少给一次（与 §7.1「整体偏低优先给抓手、少给内容」同一思路）；
 *  3. **不可信的测评一律不采信**（位置惯性 / 作答过快 / 置信度低）→ 回落到基线。
 *     拿一份自己都不敢当真的结论去限制用户，站不住。
 *
 * 为什么下限是 2 而不是 0：配额是节制，不是惩罚。给到 0 会把「处理或删」变成
 * 「只能删」，那是逼人删东西，不是帮人读东西。
 */
import { DEFAULT_TIER_THRESHOLDS } from '@/config/assessment'
import type { AssessConfidence, AssessQuality } from '@/config/assessment'

/** 未建档 / 结果不可采信时的基线 */
export const QUOTA_BASE = 3
/** 上下限：再弱也不低于 2（不饿死），再强也不超过 5（不放开） */
export const QUOTA_MIN = 2
export const QUOTA_MAX = 5

/** 只需这几项，避免为算个配额把整个 assessment store 拖进来（也避免 store 互相 import） */
export interface QuotaProfile {
  dims?: readonly { dim: string; score: number; max: number }[]
  quality?: AssessQuality
  confidence?: AssessConfidence
}

export interface DailyQuota {
  /** 今日可用次数 */
  total: number
  /** baseline = 未建档或结果不可采信；assess = 按测评浮动 */
  from: 'baseline' | 'assess'
  /** 一句话解释（配额条与说明弹窗共用，别让规则只活在人脑子里） */
  note: string
}

function clamp(n: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, n))
}

/**
 * 今日配额。
 * 判断顺序是刻意的：**先看这份结果能不能当真，再看它说了什么** ——
 * 一份不可信的高分不该换来更多摄入。
 */
export function dailyQuotaOf(profile: QuotaProfile | null | undefined): DailyQuota {
  if (!profile) {
    return { total: QUOTA_BASE, from: 'baseline', note: '还没有建档，先按基线 3 次' }
  }

  // 位置惯性 / 作答过快 = 这份答案没有信息量；置信度低 = 我们自己也说不准
  const untrustworthy =
    profile.quality === 'straight' || profile.quality === 'hasty' || profile.confidence === 'low'
  if (untrustworthy) {
    return { total: QUOTA_BASE, from: 'baseline', note: '这次建档的结果不够可信，先按基线 3 次' }
  }

  const observeDim = profile.dims?.find((d) => d.dim === 'observe')
  if (!observeDim || observeDim.max <= 0) {
    return { total: QUOTA_BASE, from: 'baseline', note: '这次建档没测到「观」这一维，按基线 3 次' }
  }

  // 与分档用同一对阈值（0.35 / 0.7），避免"分档说偏低、配额说还行"的两套口径
  const ratio = observeDim.score / observeDim.max
  let delta = 0
  let note = '「观」这一维居中，按基线 3 次'
  if (ratio >= DEFAULT_TIER_THRESHOLDS.highRatio) {
    delta = 1
    note = '「观」这一维偏高 —— 摄入质量撑得住，今日多给一次'
  } else if (ratio <= DEFAULT_TIER_THRESHOLDS.lowRatio) {
    delta = -1
    note = '「观」还是短板 —— 今日少摄入一次，先把手上的消化完'
  }

  return { total: clamp(QUOTA_BASE + delta, QUOTA_MIN, QUOTA_MAX), from: 'assess', note }
}

/**
 * 本地日键（YYYY-MM-DD）。
 * 为什么不用 stores/daily 的 todayKey：那是个 store 模块的导出，
 * 为了一个日期函数让 config 与 observe store 反过来依赖 daily store，不值得。
 */
export function dayKey(d: Date | number = new Date()): string {
  const t = d instanceof Date ? d : new Date(d)
  const m = `${t.getMonth() + 1}`.padStart(2, '0')
  const day = `${t.getDate()}`.padStart(2, '0')
  return `${t.getFullYear()}-${m}-${day}`
}

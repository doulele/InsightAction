/**
 * 成长等级表 —— 三模式共用一套修为数值，只有「叫法」随皮肤不同。
 * 每模式 9 级；等级阈值用「进入该级所需累计修为」，超出满级后仍累计但不涨级。
 */
import type { ModeId } from '@/config/modes'

export const LEVEL_NAMES: Record<ModeId, readonly string[]> = {
  normal: ['萌芽', '破土', '抽枝', '展叶', '初花', '盛放', '结果', '成木', '常青'],
  tech: ['铁段', '铜段', '银段', '金段', '铂段', '星段', '月段', '日段', '至高'],
  dao: ['凡人', '练气', '筑基', '金丹', '元婴', '化神', '炼虚', '合体', '大乘'],
}

export const LEVEL_COUNT = 9

/**
 * 进入各等级所需累计修为（下标 0 对应 Lv.1）：
 * 每级增量 100、150、200、250…（等差递增），上限 2200 进满级。
 */
export const LEVEL_THRESHOLDS: readonly number[] = [0, 100, 250, 450, 700, 1000, 1350, 1750, 2200]

export function levelIndexFromXp(xp: number): number {
  let idx = 0
  for (let i = 0; i < LEVEL_THRESHOLDS.length; i++) {
    if (xp >= LEVEL_THRESHOLDS[i]) idx = i
    else break
  }
  return idx
}

/** 当前等级内进度 0-1 */
export function levelProgress(xp: number): number {
  const idx = levelIndexFromXp(xp)
  const low = LEVEL_THRESHOLDS[idx]
  const high = LEVEL_THRESHOLDS[idx + 1]
  if (high === undefined) return 1
  return Math.min(1, Math.max(0, (xp - low) / (high - low)))
}

export function levelName(mode: ModeId, xp: number): string {
  const idx = levelIndexFromXp(xp)
  return (LEVEL_NAMES[mode] ?? LEVEL_NAMES.normal)[idx] ?? '圆满'
}

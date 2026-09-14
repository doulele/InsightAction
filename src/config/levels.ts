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
 * 进入各等级所需累计修为（下标 0 对应 Lv.1）。
 *
 * v2 §12.3：满级周期从「约 40 天」拉长到「约 120 天」——
 * 旧阈值 [0,100,250,450,700,1000,1350,1750,2200] 是早期按"每天 50 分"估的，
 * 实测一周就到 Lv.4，成长感很快耗尽；改为 [0,200,500,1000,1800,3000,4800,7400,11000]。
 *
 * ⚠️ 改这张表会让既有用户的等级**下降**（阈值提高）—— 这是有意的：
 * 等级只升不降保护的是"修为被花掉"（maxLevel），不保护"阈值调整"。
 */
export const LEVEL_THRESHOLDS: readonly number[] = [0, 200, 500, 1000, 1800, 3000, 4800, 7400, 11000]

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

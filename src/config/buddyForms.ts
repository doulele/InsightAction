/**
 * 小枢形态表 —— 「它长什么样」的唯一规则源。
 *
 * 三个正交维度，各管一段，互不越界：
 *
 *   body  本体 ← 模式（普通 / 科技 / 修仙）
 *                纸印 / 面板 / 道印，字形固定为 伴 / 枢 / 灵（见 useBuddy.buddyGlyph）。
 *                形状与描边写在 BuddyFloat.scss 的 .is-normal / .is-tech / .is-dao 里。
 *
 *   stage 形阶 ← **修为等级**（9 级折 4 阶）—— 这一维就是"成长体系"：小枢随你一起长。
 *                每升一阶，外观**只增不减**地多一层装饰（素 → 纹 → 光 → 器）。
 *
 *   duty  职司 ← 当前所在大厅（观 / 止 / 知 / 行）
 *                不换本体、不加装饰，只在球角挂一枚「职司印」：鉴 / 漏 / 卷 / 履。
 *
 * 分工的硬规矩（避免两套成长轴打架）：
 *   修为等级 → 决定小枢**长什么样**（本表）；
 *   羁绊等级 → 决定小枢**怎么说话**（称谓与语气，见 useBuddy 的 BOND_NAMES）。
 *   羁绊不碰外形，形阶不改台词。
 *
 * 为什么用「装饰递进」而不是换形象：
 *   灵鹤 / 人形 / 仙人这类真正的形象替换要美术资源，且会让主包变大；
 *   装饰是纯 CSS，任意阶都能立刻生效。形象替换留待皮肤系统（见 docs 未做事项）。
 */
import type { ModeId } from '@/config/modes'
import type { HallId } from '@/config/lexicon'

export interface FormStage {
  /** 0-3，越小越早 */
  idx: number
  /** 阶序号（一 / 二 / 三 / 四），展示用 */
  ordinal: string
  /** 三模式各自的阶名 */
  names: Record<ModeId, string>
  /** 该阶起始的修为等级下标（对齐 config/levels.ts 的 LEVEL_NAMES 下标） */
  from: number
  /** 该阶结束的修为等级下标（含） */
  to: number
  /** 装饰层数：阶越高越大，外观只加不减 */
  tier: number
  /** 一句话（形态谱里给用户看） */
  note: string
}

/**
 * 四形阶。等级区间按 9 级分：[0-1] [2-3] [4-5] [6-8]，
 * 之所以最后一段收 3 级，是因为满级之后仍有装饰余量（不设"到此为止"的空档）。
 */
export const FORM_STAGES: readonly FormStage[] = [
  {
    idx: 0,
    ordinal: '一',
    names: { normal: '光团', tech: '球核', dao: '灵石' },
    from: 0,
    to: 1,
    tier: 0,
    note: '光还收在里面，先认得它。',
  },
  {
    idx: 1,
    ordinal: '二',
    names: { normal: '光晕', tech: '数据环', dao: '灵纹' },
    from: 2,
    to: 3,
    tier: 1,
    note: '有了一圈纹，它开始随身。',
  },
  {
    idx: 2,
    ordinal: '三',
    names: { normal: '花影', tech: '数据流', dao: '灵光' },
    from: 4,
    to: 5,
    tier: 2,
    note: '生出光来，夜里也看得见。',
  },
  {
    idx: 3,
    ordinal: '四',
    names: { normal: '树影', tech: '星链', dao: '灵器' },
    from: 6,
    to: 8,
    tier: 3,
    note: '成了器，不必再解释它是什么。',
  },
] as const

/** 本体名（随模式，只作展示；形状样式在 BuddyFloat.scss） */
export const BODY_NAMES: Record<ModeId, string> = {
  normal: '纸印',
  tech: '面板',
  dao: '道印',
}

/**
 * 大厅职司：小枢在不同模块里"手里拿着什么"。
 * 只挂一枚角印，不改本体也不加装饰 —— 认得出来是同一位，只是换了差事。
 */
export const HALL_DUTY: Record<HallId, { glyph: string; label: string }> = {
  observe: { glyph: '鉴', label: '在观 · 持鉴' },
  pause: { glyph: '漏', label: '在止 · 掌漏' },
  reflect: { glyph: '卷', label: '在知 · 展卷' },
  action: { glyph: '履', label: '在行 · 着履' },
}

/** 修为等级下标 → 形阶。越界一律夹到两端，不抛错（等级表将来改长度也不会炸） */
export function stageFromLevel(levelIdx: number): FormStage {
  const hit = FORM_STAGES.find((s) => levelIdx >= s.from && levelIdx <= s.to)
  if (hit) return hit
  return levelIdx < FORM_STAGES[0].from ? FORM_STAGES[0] : FORM_STAGES[FORM_STAGES.length - 1]
}

/** 形阶名（按当前模式口径，缺项回落普通，如 普通 = 光晕） */
export function stageName(stage: FormStage, mode: ModeId): string {
  return stage.names[mode] ?? stage.names.normal
}

/** 下一形阶（已是最后一阶返回 null） */
export function nextStage(stage: FormStage): FormStage | null {
  return FORM_STAGES[stage.idx + 1] ?? null
}

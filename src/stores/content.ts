/**
 * 内容 store：题库 / 计分分档 / 称号（远端优先，内置兜底）。
 *
 * 两条硬约束：
 *  1. **兜底不可缺**：测评是核心流程，绝不能因接口抖动而无法答题或算分 ——
 *     远端只做「覆盖」，任何缺失字段都回落到 src/config/assessment.ts 的内置值；
 *  2. **不做持久化**：内容每次冷启动拉一次即可（几百字节），
 *     持久化反而容易把过时题库留在本地，得不偿失。
 */
import { defineStore } from 'pinia'
import { ref } from 'vue'
import { fetchContent } from '@/api/modules/content'
import { getAssessmentBank, DEFAULT_TIER_THRESHOLDS } from '@/config/assessment'
import type { AssessmentBank, TierThresholds } from '@/config/assessment'
import type { AssessmentScoring, HallId, LexiconPayload, PhrasesPayload } from '@/api/modules/content'
import { localPhrase } from '@/config/phrases'
import type { PhraseKey } from '@/config/phrases'
import type { ModeId } from '@/config/modes'

/**
 * 旧版运营位只写绝对分（lowMax/lowMin），且是按「6 题 × 3 分 = 18 分」标定的。
 * 这里换算成比例，对齐现在的比例分档 —— 否则运营侧一改题量，阈值就整体错位。
 */
const LEGACY_BASE_SCORE = 18

export const useContentStore = defineStore('content', () => {
  /** 远端题库：mode → bank（为空 = 全部用内置题库） */
  const remoteBanks = ref<Partial<Record<ModeId, AssessmentBank>>>({})
  /** 远端分档阈值（为空 = 用内置比例 0.35 / 0.7） */
  const scoring = ref<AssessmentScoring | null>(null)
  /** 远端状态栏文案模板（为空 = 用内置模板） */
  const lexicon = ref<LexiconPayload>({})
  /** 远端主题化短语（为空 = 用内置短语） */
  const phrases = ref<PhrasesPayload>({})
  const loaded = ref(false)

  /** 取某大厅 / 某模式的文案模板；没配就返回空串（调用方回落到内置模板） */
  function lexiconOf(hall: HallId, mode: ModeId): string {
    return lexicon.value[hall]?.[mode] ?? ''
  }

  /** 取主题化短语：远端优先，缺则内置（保证任何情况下都有词可用） */
  function phraseOf(key: PhraseKey, mode: ModeId): string {
    return phrases.value[key]?.[mode] || localPhrase(key, mode)
  }

  /** 取题库：远端优先，没有则内置 */
  function bankOf(mode: ModeId): AssessmentBank {
    return remoteBanks.value[mode] ?? getAssessmentBank(mode)
  }

  /**
   * 分档阈值（比例形式，交给 evaluate() 使用）。
   *
   * 优先读运营位的新字段 lowRatio / highRatio；
   * 若运营位还在用旧的绝对分 lowMax / highMin，则按旧版 18 分标定换算成比例 ——
   * 换算后与旧行为完全等价（6 题时 ≤6 分仍是低档），但题库改题量后不再错位。
   */
  function tiers(): TierThresholds {
    const s = scoring.value
    if (s && Number.isFinite(s.lowRatio) && Number.isFinite(s.highRatio)) {
      return { lowRatio: s.lowRatio as number, highRatio: s.highRatio as number }
    }
    if (s && Number.isFinite(s.lowMax) && Number.isFinite(s.highMin)) {
      return {
        lowRatio: (s.lowMax as number) / LEGACY_BASE_SCORE,
        highRatio: (s.highMin as number) / LEGACY_BASE_SCORE,
      }
    }
    return DEFAULT_TIER_THRESHOLDS
  }

  /** 启动时拉一次（失败静默，全部走内置） */
  async function load(): Promise<void> {
    try {
      const cfg = await fetchContent()
      const banks = cfg?.assessment?.banks ?? []

      const map: Partial<Record<ModeId, AssessmentBank>> = {}
      for (const b of banks) {
        // 二次校验：后端已清洗过，这里再挡一次「半包」内容
        if (b?.mode && Array.isArray(b.questions) && b.questions.length) map[b.mode] = b
      }
      // 只有拿到至少一套有效题才覆盖，避免把三套题覆盖成一套
      if (Object.keys(map).length) remoteBanks.value = map

      const s = cfg?.assessment?.scoring
      if (s && (Number.isFinite(s.lowRatio) || Number.isFinite(s.lowMax))) scoring.value = s

      if (cfg?.lexicon && typeof cfg.lexicon === 'object') lexicon.value = cfg.lexicon
      if (cfg?.phrases && typeof cfg.phrases === 'object') phrases.value = cfg.phrases

      loaded.value = true
    } catch {
      // 忽略：远端内容不可用时全部使用内置题库与内置文案
    }
  }

  return { remoteBanks, scoring, lexicon, phrases, loaded, bankOf, tiers, lexiconOf, phraseOf, load }
})

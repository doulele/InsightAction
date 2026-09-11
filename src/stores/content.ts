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
import { getAssessmentBank } from '@/config/assessment'
import type { AssessmentBank, AssessmentTier } from '@/config/assessment'
import type { HallId, LexiconPayload } from '@/api/modules/content'
import type { ModeId } from '@/config/modes'

/** 内置分档阈值：与 assessment.ts 的 tierOf 保持一致 */
const LOCAL_SCORING = { lowMax: 6, highMin: 13 }

export const useContentStore = defineStore('content', () => {
  /** 远端题库：mode → bank（为空 = 全部用内置题库） */
  const remoteBanks = ref<Partial<Record<ModeId, AssessmentBank>>>({})
  /** 远端分档阈值（为空 = 用内置 6/13） */
  const scoring = ref<{ lowMax: number; highMin: number } | null>(null)
  /** 远端状态栏文案模板（为空 = 用内置模板） */
  const lexicon = ref<LexiconPayload>({})
  const loaded = ref(false)

  /** 取某大厅 / 某模式的文案模板；没配就返回空串（调用方回落到内置模板） */
  function lexiconOf(hall: HallId, mode: ModeId): string {
    return lexicon.value[hall]?.[mode] ?? ''
  }

  /** 取题库：远端优先，没有则内置 */
  function bankOf(mode: ModeId): AssessmentBank {
    return remoteBanks.value[mode] ?? getAssessmentBank(mode)
  }

  /** 分档：阈值可由远端调整（默认 <=6 低 / >=13 高） */
  function tierOf(score: number): AssessmentTier {
    const lowMax = scoring.value?.lowMax ?? LOCAL_SCORING.lowMax
    const highMin = scoring.value?.highMin ?? LOCAL_SCORING.highMin
    if (score >= highMin) return 'high'
    if (score <= lowMax) return 'low'
    return 'mid'
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
      if (s && Number.isFinite(s.lowMax) && Number.isFinite(s.highMin)) scoring.value = s

      if (cfg?.lexicon && typeof cfg.lexicon === 'object') lexicon.value = cfg.lexicon

      loaded.value = true
    } catch {
      // 忽略：远端内容不可用时全部使用内置题库与内置文案
    }
  }

  return { remoteBanks, scoring, lexicon, loaded, bankOf, tierOf, lexiconOf, load }
})

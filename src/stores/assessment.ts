/**
 * 首次测评存档 store —— 每个模式各自建档（普通/科技/修仙各一份）。
 * 批次 C：6 题建档，结果按模式存档；重测间隔 ≥30 天。
 * 三模式共享一套修行数据，但测评「生活基线 / 数字画像 / 灵根检测」各自独立计档。
 */
import { defineStore } from 'pinia'
import { ref } from 'vue'
import type { ModeId } from '@/config/modes'
import type { AssessmentTier } from '@/config/assessment'

export interface AssessmentResult {
  /** 属于哪个模式的测评 */
  mode: ModeId
  /** 总分 0-18 */
  score: number
  /** 档位 */
  tier: AssessmentTier
  /** 建档时刻 */
  takenAt: number
}

/** 重测间隔：30 天 */
export const RETEST_AFTER_MS = 30 * 24 * 60 * 60 * 1000

type ResultMap = Record<ModeId, AssessmentResult | null>

const EMPTY: ResultMap = { normal: null, tech: null, dao: null }

export const useAssessmentStore = defineStore(
  'assessment',
  () => {
    const results = ref<ResultMap>({ ...EMPTY })

    function get(mode: ModeId): AssessmentResult | null {
      return results.value[mode] ?? null
    }

    function save(mode: ModeId, score: number, tier: AssessmentTier): void {
      results.value[mode] = { mode, score, tier, takenAt: Date.now() }
    }

    /** 该模式是否已可重测（30 天间隔） */
    function canRetake(mode: ModeId, now = Date.now()): boolean {
      const r = results.value[mode]
      return !r || now - r.takenAt >= RETEST_AFTER_MS
    }

    /** 距可重测还有几天（未建档返回 0） */
    function retakeRemainDays(mode: ModeId, now = Date.now()): number {
      const r = results.value[mode]
      if (!r) return 0
      const left = RETEST_AFTER_MS - (now - r.takenAt)
      return left > 0 ? Math.ceil(left / (24 * 60 * 60 * 1000)) : 0
    }

    return { results, get, save, canRetake, retakeRemainDays }
  },
  {
    persist: { key: 'assessment', paths: ['results'] },
  },
)

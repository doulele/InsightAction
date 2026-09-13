/**
 * 测评存档 store —— 每个模式各自建档（普通/科技/修仙各一份）。
 * 三模式共享一套修行数据，但测评「生活基线 / 数字画像 / 灵根检测」各自独立计档。
 *
 * 本批次新增三样东西，都是为了「可复核」：
 *  1. **历史**：每次建档都留一条（每模式最多 6 条）。原实现只留最新一次，
 *     结果页却写着「再测一次看变化」—— 没有历史就没有变化可看。
 *  2. **归一化得分 ratio**：分数与满分一起存，跨题库版本可比（6 题制的 9 分 ≠ 8 题制的 9 分）。
 *  3. **跳过状态**：用户跳过测评时记一笔时间，用于「过两天再温和提醒一次」，
 *     而不是天天弹窗骚扰（少即是多）。
 */
import { defineStore } from 'pinia'
import { ref } from 'vue'
import type { ModeId } from '@/config/modes'
import type { EvaluatedAssessment } from '@/config/assessment'

/** 一次建档（= 评估结果 + 模式 + 时间） */
export interface AssessmentResult extends EvaluatedAssessment {
  /** 属于哪个模式的测评 */
  mode: ModeId
  /** 建档时刻 */
  takenAt: number
}

/** 重测间隔：30 天 */
export const RETEST_AFTER_MS = 30 * 24 * 60 * 60 * 1000

/** 每模式保留的历史条数（够看趋势，又不会把本地存储撑大） */
export const MAX_HISTORY = 6

/** 跳过测评后，隔多久再提醒一次（天）：当天不打扰 */
export const SKIP_PROMPT_AFTER_DAYS = 2

/** 用户点「稍后再说」后的静默期（天） */
export const PROMPT_SNOOZE_DAYS = 3

const DAY_MS = 24 * 60 * 60 * 1000

/**
 * 旧版存档没有 maxScore / ratio / dims / quality（本批次新增）。
 * 读取时按当时的题库规格（6 题 × 3 分 = 18）补齐，避免结果页出现 undefined。
 */
const LEGACY_MAX_SCORE = 18

type ResultMap = Record<ModeId, AssessmentResult | null>
type HistoryMap = Record<ModeId, AssessmentResult[]>
type SkipMap = Record<ModeId, number | null>

const EMPTY_RESULTS: ResultMap = { normal: null, tech: null, dao: null }
const EMPTY_HISTORY: HistoryMap = { normal: [], tech: [], dao: [] }
const EMPTY_SKIP: SkipMap = { normal: null, tech: null, dao: null }

/** 把任意来源（含旧版持久化数据）的存档补齐成本版结构 */
function normalizeResult(raw: Partial<AssessmentResult> | null | undefined): AssessmentResult | null {
  if (!raw || !raw.mode) return null
  const score = Number(raw.score) || 0
  const maxScore = Number(raw.maxScore) || LEGACY_MAX_SCORE
  return {
    mode: raw.mode,
    takenAt: Number(raw.takenAt) || 0,
    score,
    maxScore,
    ratio: Number.isFinite(raw.ratio as number) ? (raw.ratio as number) : score / maxScore,
    tier: raw.tier ?? 'mid',
    dims: Array.isArray(raw.dims) ? raw.dims : [],
    quality: raw.quality ?? 'ok',
  }
}

export const useAssessmentStore = defineStore(
  'assessment',
  () => {
    const results = ref<ResultMap>({ ...EMPTY_RESULTS })
    /** 历史（下标 0 = 最新一次） */
    const history = ref<HistoryMap>({ ...EMPTY_HISTORY })
    /** 跳过建档的时刻（null = 没跳过） */
    const skipped = ref<SkipMap>({ ...EMPTY_SKIP })
    /** 「稍后再说」的静默截止时间戳（0 = 无静默） */
    const promptSnoozeUntil = ref(0)

    /** 最新一次建档（已归一化，老存档也能安全读） */
    function get(mode: ModeId): AssessmentResult | null {
      return normalizeResult(results.value[mode])
    }

    /** 历史（最新在前，已归一化） */
    function historyOf(mode: ModeId): AssessmentResult[] {
      return (history.value[mode] ?? [])
        .map((r) => normalizeResult(r))
        .filter((r): r is AssessmentResult => Boolean(r))
    }

    /**
     * 存一次建档。
     * 同时：写入历史（最多 MAX_HISTORY 条）、清掉跳过标记与静默期 ——
     * 已经建档了就不该再被「还没建档」的提醒打扰。
     */
    function save(mode: ModeId, evaluated: EvaluatedAssessment): AssessmentResult {
      const record: AssessmentResult = { ...evaluated, mode, takenAt: Date.now() }
      results.value[mode] = record
      history.value[mode] = [record, ...historyOf(mode)].slice(0, MAX_HISTORY)
      skipped.value[mode] = null
      promptSnoozeUntil.value = 0
      return record
    }

    /**
     * 与上一次相比的变化（只有历史 ≥2 条才有意义）。
     * 用 ratio 之差而不是原始分差 —— 题库改过题量后原始分不可比。
     */
    function trendOf(mode: ModeId): { prev: AssessmentResult; deltaRatio: number } | null {
      const list = historyOf(mode)
      if (list.length < 2) return null
      const [cur, prev] = list
      return { prev, deltaRatio: cur.ratio - prev.ratio }
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
      return left > 0 ? Math.ceil(left / DAY_MS) : 0
    }

    /* ---------------- 跳过与补测提醒 ---------------- */

    /** 记录一次「跳过建档」（用于之后温和提醒，不做任何限制） */
    function markSkipped(mode: ModeId): void {
      skipped.value[mode] = Date.now()
    }

    /** 该模式是否还没建档 */
    function unassessed(mode: ModeId): boolean {
      return !results.value[mode]
    }

    /**
     * 是否适合提醒「还没建档」：
     *  - 已有档案 → 不提醒
     *  - 用户点过「稍后再说」→ 静默期内不提醒
     *  - 刚跳过的头 SKIP_PROMPT_AFTER_DAYS 天不打扰（跳过的那一刻已经解释过一遍了）
     * 这样最坏也只有「跳过两天后提醒一次 + 每 3 天一次」的强度，不会变成骚扰。
     */
    function shouldPrompt(mode: ModeId, now = Date.now()): boolean {
      if (results.value[mode]) return false
      if (now < promptSnoozeUntil.value) return false
      const s = skipped.value[mode]
      if (s && now - s < SKIP_PROMPT_AFTER_DAYS * DAY_MS) return false
      return true
    }

    /** 「稍后再说」：静默 N 天 */
    function snoozePrompt(days = PROMPT_SNOOZE_DAYS): void {
      promptSnoozeUntil.value = Date.now() + days * DAY_MS
    }

    return {
      results,
      history,
      skipped,
      promptSnoozeUntil,
      get,
      historyOf,
      save,
      trendOf,
      canRetake,
      retakeRemainDays,
      markSkipped,
      unassessed,
      shouldPrompt,
      snoozePrompt,
    }
  },
  {
    persist: {
      key: 'assessment',
      paths: ['results', 'history', 'skipped', 'promptSnoozeUntil'],
    },
  },
)

/**
 * 内容 store：题库 / 计分分档 / 称号（远端优先，内置兜底 —— 但**过期的远端会被丢弃**）。
 *
 * 三条硬约束：
 *  1. **兜底不可缺**：测评是核心流程，绝不能因接口抖动而无法答题或算分 ——
 *     远端只做「覆盖」，任何缺失字段都回落到 src/config/assessment.ts 的内置值；
 *  2. **不支持旧版本覆盖新版本**：远端 version 低于内置版本时忽略该部分
 *     （详见 load() 里的「新鲜度闸门」）—— 否则会出现"代码已改、真机照旧"；
 *  2. **不做持久化**：内容每次冷启动拉一次即可（几百字节），
 *     持久化反而容易把过时题库留在本地，得不偿失。
 */
import { defineStore } from 'pinia'
import { ref } from 'vue'
import { fetchContent } from '@/api/modules/content'
import { getAssessmentBank, DEFAULT_TIER_THRESHOLDS, LOCAL_ASSESS_VERSION } from '@/config/assessment'
import type { AssessmentBank, TierThresholds } from '@/config/assessment'
import type { AssessmentScoring, HallId, LexiconPayload, PhrasesPayload } from '@/api/modules/content'
import { LOCAL_DAILY_VERSION, sanitizeDaily } from '@/config/daily'
import type { DailyItem } from '@/config/daily'
import { localPhrase, LOCAL_PHRASE_VERSION } from '@/config/phrases'
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
  /** 远端每日一则（空数组 = 用内置 30 条）；已过 sanitize，结构可信 */
  const daily = ref<DailyItem[]>([])
  const loaded = ref(false)

  /** 取某大厅 / 某模式的文案模板；没配就返回空串（调用方回落到内置模板） */
  function lexiconOf(hall: HallId, mode: ModeId): string {
    return lexicon.value[hall]?.[mode] ?? ''
  }

  /**
   * 每日一则取用表：有远端就用远端，没有则用内置 ——
   * 页面只调 dailyOf(dateKey, dailyItems())，不必关心内容来自哪里。
   */
  function dailyItems(): DailyItem[] {
    return daily.value.length ? daily.value : []
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

      /*
       * 新鲜度闸门：远端 version 低于内置版本 → 这份远端内容是**旧版本**，整体忽略。
       *
       * 为什么要这道闸：运营位在服务器上，代码也在天天改。若服务器上的 content.json
       * 停留在旧版本（历史上真实发生过：本地已改 8 题，线上仍是 6 题 + 「约 1 分钟」），
       * 它会在运行时把本地新内容**整体覆盖**回去 —— 明明产物是对的，真机却显示旧内容，
       * 且没有任何报错，极难排查。
       *
       * 于是约定：每次改内置题库/短语都 +1（LOCAL_ASSESS_VERSION / LOCAL_PHRASE_VERSION），
       * 运营侧想重新接管时把 content.json 的 version 提到 >= 内置值即可 —— 不改发版能力。
       * 缺 version 字段视为 0（一定比内置旧）。
       */
      const remoteVersion = Number(cfg?.version)
      const fresh = Number.isFinite(remoteVersion) ? remoteVersion : 0
      const bankFresh = fresh >= LOCAL_ASSESS_VERSION
      const phraseFresh = fresh >= LOCAL_PHRASE_VERSION

      const map: Partial<Record<ModeId, AssessmentBank>> = {}
      for (const b of banks) {
        /**
         * 二次校验：后端已清洗过，这里再挡一次「半包」内容。
         *
         * 除了题量，还必须要求**标题与三档称号**存在 —— 否则一份"有题但没标题/没称号"
         * 的题库会把内置题库顶掉，结果页就会出现「· 已建档」「/ 分」这种空壳 ✗。
         * 校验不过就整体丢弃 → 该模式继续用内置题库（宁可旧，不可残）。
         */
        const usable =
          b?.mode &&
          typeof b.title === 'string' &&
          b.title.trim() !== '' &&
          Array.isArray(b.questions) &&
          b.questions.length > 0 &&
          Array.isArray(b.tierNames) &&
          b.tierNames.some((t) => typeof t === 'string' && t.trim() !== '')
        if (usable) map[b.mode] = b
      }
      // 只有拿到至少一套有效题才覆盖，避免把三套题覆盖成一套
      if (bankFresh && Object.keys(map).length) remoteBanks.value = map

      const s = cfg?.assessment?.scoring
      if (s && (Number.isFinite(s.lowRatio) || Number.isFinite(s.lowMax))) scoring.value = s

      /*
       * 状态栏模板不受版本闸门限制：只是带占位符的陈述模板，
       * 改了不影响计分口径，运营侧随时可调。
       */
      if (cfg?.lexicon && typeof cfg.lexicon === 'object') lexicon.value = cfg.lexicon
      // 短语与题库同为「解释型内容」，口径变了必须整套跟进 → 一并受闸门保护
      if (phraseFresh && cfg?.phrases && typeof cfg.phrases === 'object') phrases.value = cfg.phrases

      /*
       * 每日一则走**独立版本号** dailyVersion，不受全局 version 牵连。
       * 若共用全局 version：运营侧想换一批每日一则就得动 version，
       * 而 version 一提升会顺带放开题库/短语的覆盖 —— 线上 content.json 常年比代码旧，
       * 旧题库会因此整体盖回来（这个坑踩过）。所以这里只看 dailyVersion，缺字段视为 0。
       */
      const lib = cfg?.library
      if (lib && typeof lib === 'object') {
        const v = Number(lib.dailyVersion)
        const freshDaily = Number.isFinite(v) && v >= LOCAL_DAILY_VERSION
        daily.value = (freshDaily ? sanitizeDaily(lib.daily) : null) ?? []
      }

      loaded.value = true
    } catch {
      // 忽略：远端内容不可用时全部使用内置题库与内置文案
    }
  }

  return { remoteBanks, scoring, lexicon, phrases, daily, loaded, bankOf, tiers, lexiconOf, phraseOf, dailyItems, load }
})

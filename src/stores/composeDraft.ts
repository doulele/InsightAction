/**
 * 观 · 记一笔的草稿槽 —— 写一半被打断时的落脚点。
 *
 * 为什么单独一份、不塞进收件匣：
 *  - 收件匣的规矩是"存下就要读，7 天不读就清"，草稿还没写完，不该被这条规矩追着；
 *  - 只留**一份**（就是"未完成的这一笔"）：留多了就变成第二个收藏夹，
 *    与观这一环「只进不出就是坟场」的初衷相悖。
 *
 * 草稿不入账修为、不进收件匣、不占 200 条上限 —— 它只是把输入框里的字先存起来，
 * 等你想完再回来，按下「存下」那一刻才真正成为一条内容。
 *
 * 但它也不是无期限的：见 DRAFT_HOLD_MS。
 */
import { computed, ref } from 'vue'
import { defineStore } from 'pinia'
import type { ObserveForm, ObserveKind, Viewpoint } from '@/stores/observe'

/**
 * 草稿保留多久：两周。
 * 为什么是两周而不是"永久放着"：草稿是"没写完的那一笔"，两周还没写完，
 * 当时那点心动基本已经过去了，留着只是让下次进页面多一条要处理的提示。
 * 也不跟收件匣的 7 天同规：收件匣里的东西是**存下来的内容**（催你读），
 * 草稿只是**没想完的输入**（催不得，但也不能无限占位）。
 */
export const DRAFT_HOLD_MS = 14 * 24 * 60 * 60 * 1000

const DAY_MS = 24 * 60 * 60 * 1000

/** 一份草稿 = 录入页表单的整份快照（tags 存原始串，因为页面上是逗号分隔的输入框） */
export interface ComposeDraft {
  kind: ObserveKind
  form: ObserveForm
  title: string
  link: string
  videoUrl: string
  sourceName: string
  digest: string
  viewpoints: Viewpoint[]
  summary: string
  content: string
  /** 富文本正文（2026-09-17）：草稿也要带着它，否则"接着写"会把格式丢光 */
  contentHtml?: string
  /** 这一笔是不是从文件导入来的（存库时带上，用于配额豁免与角标） */
  imported?: boolean
  why: string
  insight: string
  golden: string[]
  /** 主题（可多选，与 ObsItem.topics 同形） */
  topics: string[]
  tags: string
  savedAt: number
}

export const useComposeDraftStore = defineStore(
  'composeDraft',
  () => {
    const draft = ref<ComposeDraft | null>(null)

    const hasDraft = computed(() => !!draft.value)

    /** 存（覆盖式：草稿只留最新那份，避免"哪份才是刚才那份"的困惑） */
    function save(input: Omit<ComposeDraft, 'savedAt'>): void {
      draft.value = { ...input, savedAt: Date.now() }
    }

    function clear(): void {
      draft.value = null
    }

    /** 「刚刚 / N 分钟前 / N 小时前 / N 天前」—— 让人知道这份草稿放了多久 */
    function savedLabel(now = Date.now()): string {
      const t = draft.value?.savedAt
      if (!t) return ''
      const mins = Math.floor((now - t) / 60_000)
      if (mins < 1) return '刚刚'
      if (mins < 60) return `${mins} 分钟前`
      const hours = Math.floor(mins / 60)
      if (hours < 24) return `${hours} 小时前`
      return `${Math.floor(hours / 24)} 天前`
    }

    /** 草稿放了几天（页面用来决定要不要提醒"快过期"） */
    function ageInDays(now = Date.now()): number {
      const t = draft.value?.savedAt
      if (!t) return 0
      return Math.floor((now - t) / DAY_MS)
    }

    /** 还差多久自动清（只在草稿放久了才提示，刚存的不啰嗦） */
    function leftLabel(now = Date.now()): string {
      const t = draft.value?.savedAt
      if (!t) return ''
      const left = t + DRAFT_HOLD_MS - now
      if (left <= 0) return '已过期'
      return `${Math.max(1, Math.ceil(left / DAY_MS))} 天后自动清`
    }

    /**
     * 清掉过期草稿（进录入页时调一次）。
     *
     * 返回**是否真的清掉了**：那些字是用户自己敲的，不能默默消失 ——
     * 页面拿到 true 会明说一句"上次的草稿放了太久，已自动清掉"。
     */
    function prune(now = Date.now()): boolean {
      const t = draft.value?.savedAt
      if (!t) return false
      if (now - t < DRAFT_HOLD_MS) return false
      draft.value = null
      return true
    }

    return { draft, hasDraft, save, clear, savedLabel, ageInDays, leftLabel, prune }
  },
  { persist: { key: 'composeDraft', paths: ['draft'] } },
)

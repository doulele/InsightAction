/**
 * 稍后读 store ——「临时收藏，读不完自会清走」。
 * 批次 B · 观子页（观事 → 观理：够时间消化即可，不养收藏夹僵尸）。
 *
 * 2026-09-23：从"只能存一句话"扩成三种碎片形态（一句话 / 文章 / 视频）。
 * 形态与「记一笔」的 `form` 同口径（文章有原文链接、视频有视频链接、一句话只有那句话）——
 * 两处说法一致，用户不用学第二套词。
 * 保留时长按形态分：一句话仍是 24 小时；文章 / 视频 7 天 ——
 * 一篇长文一天读不完，而这两个形态的价值全在链接上（过期清掉等于白存）。
 *
 * 纯本地存储，随云备份一起走（见 utils/cloudBackup.ts）；跨天不重置，只按各自时效滚动清理。
 */
import { defineStore } from 'pinia'
import { ref } from 'vue'

/** 三种碎片形态 */
export type ReadLaterForm = 'quote' | 'article' | 'video'

export interface ReadLaterItem {
  /** 收藏时刻（Date.now()，兼作唯一 id） */
  createdAt: number
  /**
   * 形态。
   * **老数据（schema ≤ 13）没有这一格** —— 读的时候一律按 'quote' 兜底（见 `formOf`），
   * 并在 `prune()` 里顺手补上，不写迁移脚本。
   */
  form?: ReadLaterForm
  /** 一句话的正文；文章 / 视频「为什么要读它」那一句（可空） */
  text: string
  /** 文章 / 视频的标题（一句话用不上） */
  title?: string
  /** 原文 / 视频链接（文章与视频**必须有**，否则回头找不到） */
  link?: string
}

/** 一句话的保留时长：24 小时（临时收藏，够消化就行） */
export const READ_LATER_HOLD_MS = 24 * 60 * 60 * 1000
/** 文章 / 视频的保留时长：7 天（长文一天读不完，但也不许囤成收藏夹） */
export const READ_LATER_DOC_HOLD_MS = 7 * 24 * 60 * 60 * 1000

/** 形态兜底：老条目只有 { createdAt, text } —— 一律当"一句话" */
export function formOf(it: ReadLaterItem): ReadLaterForm {
  return it.form ?? 'quote'
}

/** 这个形态在库多久 */
export function holdMsOf(form: ReadLaterForm): number {
  return form === 'quote' ? READ_LATER_HOLD_MS : READ_LATER_DOC_HOLD_MS
}

/** 单次在库上限：防止"稍后读"又变成囤积 */
const CAP = 30

/** 新存一条的入参 */
export interface ReadLaterInput {
  form: ReadLaterForm
  /** 一句话的正文 / 文章与视频的那句"为什么"（后者可空） */
  text: string
  title?: string
  link?: string
}

export const useReadLaterStore = defineStore(
  'readLater',
  () => {
    const items = ref<ReadLaterItem[]>([])

    /** 只保留未过期收藏；返回本次被清理的条数 */
    function prune(now = Date.now()): number {
      const kept = items.value.filter((it) => {
        const form = formOf(it)
        /* 顺手把老数据缺的那一格补上：prune 每次进页都会跑，等于一次轻量迁移 */
        if (!it.form) it.form = form
        return now - it.createdAt < holdMsOf(form)
      })
      const cleared = items.value.length - kept.length
      if (cleared > 0) items.value = kept
      return cleared
    }

    /** 新存一条（放最前）；成功返回 true */
    function add(input: ReadLaterInput): boolean {
      const form = input.form
      const text = input.text.trim()
      const link = input.link?.trim() ?? ''
      /*
       * 两种形态的要求不同（与页面上的按钮禁用口径一致）：
       *  - 一句话：得有那句话；
       *  - 文章 / 视频：得**带着链接**（只有标题的话，回头找不到那条内容）。
       */
      if (form === 'quote') {
        if (!text) return false
      } else if (!link) {
        uni.showToast({ title: '得带着链接 —— 不然回头找不到', icon: 'none' })
        return false
      }
      if (items.value.length >= CAP) {
        uni.showToast({ title: '存得太多啦，先读完已存的', icon: 'none' })
        return false
      }
      items.value.unshift({
        createdAt: Date.now(),
        form,
        text,
        title: input.title?.trim() || undefined,
        link: link || undefined,
      })
      return true
    }

    /** 主动丢弃一条 */
    function remove(createdAt: number): void {
      items.value = items.value.filter((it) => it.createdAt !== createdAt)
    }

    return { items, prune, add, remove }
  },
  {
    persist: { key: 'readLater', paths: ['items'] },
  },
)

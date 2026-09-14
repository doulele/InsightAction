/**
 * 箴言收藏 store ——「我记住的句子」的唯一数据源。
 *
 * 背景：收藏原先寄生在 composables/useBuddy.ts 里（模块级 ref + insight:buddy-favs），
 * 导致三个问题：① 不进本地备份 / 云备份（备份只收 insight:store: 前缀）；
 * ② 换机清缓存即丢；③ 只有 at/kind/text，撑不起「回响 / 转知识卡 / 统计」等后续功能。
 * 这里迁成标准 pinia store（带 persist），并补全字段：
 *   id（稳定主键）/ from（出处）/ source（来源）/ tags / note / reviewCount / lastReviewAt / pinned
 *
 * 迁移：migrateLegacy() 由 App.vue onLaunch 调用一次，把旧键里的收藏搬进来（幂等）。
 * 纯本地：与 readLater 同样「不上行」，云同步留待登录期。
 */
import { defineStore } from 'pinia'
import { computed, ref } from 'vue'
import { getItem, setItem } from '@/utils/storage'

/** 收藏来源：开屏箴言 / 小枢对话 / 日课 */
export type ProverbSource = 'startup' | 'buddy' | 'daily'

export interface ProverbItem {
  /** 稳定主键（后续回响、标注、转知识卡都靠它） */
  id: number
  /** 箴言正文（不含书名号） */
  text: string
  /** 出处（如《大学》/ 观止语录），可空 */
  from?: string
  source: ProverbSource
  /** 收藏时刻 */
  createdAt: number
  tags: string[]
  /** 我的批注：为什么记住它（后续功能用） */
  note: string
  /** 被回顾次数（间隔回响用） */
  reviewCount: number
  /** 上次回顾时刻 */
  lastReviewAt: number
  /** 置顶 */
  pinned: boolean
}

export const SOURCE_LABEL: Record<ProverbSource, string> = {
  startup: '开屏箴言',
  buddy: '小枢对话',
  daily: '日课',
}

/** 收藏上限：与旧版一致，防止"收藏变成另一种囤积" */
const CAP = 99

const LEGACY_KEY = 'buddy-favs'
const LEGACY_DONE_KEY = 'buddy-favs-migrated'

let uniq = 1

function nextId(): number {
  return Date.now() * 100 + (uniq++ % 100)
}

/** 解析「xxx」—— 出处 这种展示串（旧数据里正文与出处是混在一起的） */
export function parseQuote(raw: string): { text: string; from?: string } {
  const s = (raw ?? '').trim()
  const m = /^「([\s\S]*?)」(?:\s*——\s*([\s\S]+))?$/.exec(s)
  if (m) return { text: m[1].trim(), from: m[2]?.trim() || undefined }
  return { text: s }
}

export const useProverbStore = defineStore(
  'proverb',
  () => {
    const items = ref<ProverbItem[]>([])

    const count = computed(() => items.value.length)

    /** 按来源统计（我页入口文案、箴言页头部用） */
    const countBySource = computed<Record<ProverbSource, number>>(() => {
      const out: Record<ProverbSource, number> = { startup: 0, buddy: 0, daily: 0 }
      for (const it of items.value) out[it.source] += 1
      return out
    })

    function byId(id: number): ProverbItem | undefined {
      return items.value.find((it) => it.id === id)
    }

    /** 是否已收藏（source 省略时跨来源去重） */
    function has(text: string, source?: ProverbSource): boolean {
      const t = text.trim()
      if (!t) return false
      return items.value.some((it) => it.text === t && (source ? it.source === source : true))
    }

    /** 新收藏一条；已存在返回原条目，超限返回 null */
    function add(input: {
      text: string
      from?: string
      source?: ProverbSource
      tags?: string[]
      at?: number
    }): ProverbItem | null {
      const t = input.text.trim()
      if (!t) return null
      const src: ProverbSource = input.source ?? 'buddy'
      const hit = items.value.find((it) => it.text === t && it.source === src)
      if (hit) return hit
      if (items.value.length >= CAP) {
        uni.showToast({ title: '记住的够多了，先回看旧的', icon: 'none' })
        return null
      }
      const item: ProverbItem = {
        id: nextId(),
        text: t,
        from: input.from?.trim() || undefined,
        source: src,
        createdAt: input.at ?? Date.now(),
        tags: input.tags ?? [],
        note: '',
        reviewCount: 0,
        lastReviewAt: 0,
        pinned: false,
      }
      items.value.unshift(item)
      return item
    }

    function remove(id: number): void {
      items.value = items.value.filter((it) => it.id !== id)
    }

    /** 收藏 / 取消收藏：返回操作后的状态（true=已收藏） */
    function toggle(input: { text: string; from?: string; source?: ProverbSource; at?: number }): boolean {
      const src: ProverbSource = input.source ?? 'buddy'
      const t = input.text.trim()
      const hit = items.value.find((it) => it.text === t && it.source === src)
      if (hit) {
        remove(hit.id)
        return false
      }
      return add({ ...input, source: src }) !== null
    }

    /** 记一次回顾（间隔回响：+1 天 / +3 天 / +7 天） */
    function markReviewed(id: number): void {
      const it = byId(id)
      if (!it) return
      it.reviewCount += 1
      it.lastReviewAt = Date.now()
    }

    function setNote(id: number, note: string): void {
      const it = byId(id)
      if (it) it.note = note
    }

    function togglePin(id: number): void {
      const it = byId(id)
      if (it) it.pinned = !it.pinned
    }

    /**
     * 旧数据迁移：composable 时代的 insight:buddy-favs → 本 store。
     * 幂等（迁移标记写本地键）；已有收藏时不覆盖。
     * @returns 导入条数
     */
    function migrateLegacy(): number {
      if (getItem<boolean>(LEGACY_DONE_KEY, false)) return 0
      setItem(LEGACY_DONE_KEY, true)
      if (items.value.length > 0) return 0
      const legacy = getItem<Array<{ at: number; kind: string; text: string }>>(LEGACY_KEY, [])
      if (!legacy?.length) return 0
      let n = 0
      // 旧数组是"新在前"，倒序 add 才能保持原有先后
      for (const l of [...legacy].reverse()) {
        const p = parseQuote(l.text)
        if (!p.text) continue
        const added = add({
          text: p.text,
          from: p.from,
          source: l.kind === 'proverb' ? 'startup' : 'buddy',
          at: l.at || Date.now(),
        })
        if (added) n += 1
      }
      return n
    }

    return {
      items,
      count,
      countBySource,
      has,
      add,
      remove,
      toggle,
      byId,
      markReviewed,
      setNote,
      togglePin,
      migrateLegacy,
    }
  },
  {
    persist: { key: 'proverb', paths: ['items'] },
  },
)

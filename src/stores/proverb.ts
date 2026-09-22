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
  /** 转成知识卡的时刻；有值 = 已入知识库（防重复转存） */
  cardAt?: number
}

export const SOURCE_LABEL: Record<ProverbSource, string> = {
  startup: '开屏箴言',
  buddy: '小枢对话',
  daily: '日课',
}

/** 收藏上限：与旧版一致，防止"收藏变成另一种囤积" */
const CAP = 99

/**
 * 间隔回响的阶梯（天）：记住一句之后，第 1 天、再第 3 天、再第 7 天各回来一次。
 *
 * 为什么不一次说完：隔一段时间再见，比当天连读十遍更记得住。
 * 走完这三阶就不再自动出现（想看可以去「我的箴言」翻）。
 */
export const REVIEW_DAYS: readonly number[] = [1, 3, 7]

const DAY_MS = 86_400_000

/** 是否已走完回响阶梯 */
export function reviewFinished(it: ProverbItem): boolean {
  return it.reviewCount >= REVIEW_DAYS.length
}

/** 今天是否已到回响时刻 */
export function isDue(it: ProverbItem, now = Date.now()): boolean {
  const at = nextReviewAt(it)
  return at !== null && at <= now
}

/**
 * 回响状态的展示文案。
 *
 * 如实说"还有几天"，不写"即将""快了"这类含糊词 ——
 * 用户要靠这个数字判断自己什么时候会再见到这句。
 */
export function reviewHint(it: ProverbItem, now = Date.now()): string {
  const at = nextReviewAt(it)
  if (at === null) return '已沉淀'
  const days = Math.ceil((at - now) / DAY_MS)
  if (days <= 0) return '今天回响'
  if (days === 1) return '明天回响'
  return `${days} 天后回响`
}

/**
 * 迁移数据的回响起点。
 *
 * 旧收藏距今可能已有数月，若一律从"第 1 天"算起，会有一大批同时到期，
 * 开屏连续好几周只剩回响、见不到新句子 —— 那是打扰，不是回响。
 * 这里按已过去的天数把阶梯推进到相应位置（超过 7 天视为已沉淀）。
 */
function reviewCountForAge(createdAt: number, now = Date.now()): number {
  const days = (now - createdAt) / DAY_MS
  if (!Number.isFinite(days) || days <= 0) return 0
  let n = 0
  for (const d of REVIEW_DAYS) if (days >= d) n += 1
  return Math.min(n, REVIEW_DAYS.length)
}

/** 下次回响时刻；走完阶梯返回 null */
export function nextReviewAt(it: ProverbItem): number | null {
  if (reviewFinished(it)) return null
  // 第一次以收藏时刻为起点，之后以上次回顾时刻为起点
  return (it.lastReviewAt || it.createdAt) + REVIEW_DAYS[it.reviewCount] * DAY_MS
}

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

    /**
     * 今天已经结算过的那一天（跨天自动解禁）—— 与 `stores/knowledge.ts` 的「旧卡重逢」同一范式。
     * 开屏每次见面只推一阶（见 `settleEcho`），这条就是那道闸。
     */
    const echoDay = ref('')

    /**
     * 今天到点该回响的收藏（早到期的排前面），开屏页取第一条。
     *
     * 每次都重算一遍：条目上限 99，算得起，不值得为此做缓存。
     */
    const dueReviews = computed<ProverbItem[]>(() => {
      const now = Date.now()
      return items.value
        .filter((it) => {
          const at = nextReviewAt(it)
          return at !== null && at <= now
        })
        .sort((a, b) => (nextReviewAt(a) ?? 0) - (nextReviewAt(b) ?? 0))
    })

    /** 记住的句子里各标签的计数 —— 开屏"偏好加权"的数据源 */
    const tagPreference = computed<Record<string, number>>(() => {
      const out: Record<string, number> = {}
      for (const it of items.value) {
        for (const t of it.tags) out[t] = (out[t] ?? 0) + 1
      }
      return out
    })

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
    function toggle(input: {
      text: string
      from?: string
      source?: ProverbSource
      at?: number
      tags?: string[]
    }): boolean {
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

    /**
     * 开屏「今日一签」见到一条回响 = **这次见面已经发生**，记为已见（展示即推进）。
     *
     * 为什么不由按钮推进：开屏整页 `@click="go"`（点哪都跳过），「还在记着」基本按不到 ——
     * 于是阶梯永远停在第 1 阶、最早到期的那条天天钉在扉页上（2026-09-22 自查修掉）。
     * 口径与 `reviewCountForAge()`（迁移旧收藏时按时间推进阶梯、不看用户点没点）一致。
     *
     * 为什么一天只推一条（`echoDay`）：一天里多次冷启动会把整个队列一次冲完，
     * 而 1/3/7 天是**间隔**回响，不是"一次见面"。
     *
     * 副作用要说清（2026-09-22 自测时按模拟结果校正过）：结算后这条就离开了到期队列，
     * 于是**同一天的第二次冷启动看到的是"队列里下一个到期的"**（它一直停在头条、当天不再推进，
     * 所以第二次之后的每次冷启动都是它）。即"一天最多换一次句子"，不是"整天钉在同一句"。
     *
     * @param dayKey 调用方已冻结的日期键（与开屏排班同一天，避免跨零点时两处取到不同的天）
     * @returns 是否推了一阶
     */
    function settleEcho(dayKey: string, id: number): boolean {
      if (!dayKey || echoDay.value === dayKey) return false
      const it = byId(id)
      if (!it || !isDue(it)) return false
      echoDay.value = dayKey
      markReviewed(id)
      return true
    }

    /** 标记为「已转成知识卡」；已转过返回 false（调用方据此提示，不重复入库） */
    function markCarded(id: number): boolean {
      const it = byId(id)
      if (!it || it.cardAt) return false
      it.cardAt = Date.now()
      return true
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
        if (added) {
          // 旧收藏按"距今多久"接着走阶梯：否则几十条同时到期，开屏连着几周只剩回响
          added.reviewCount = reviewCountForAge(added.createdAt)
          n += 1
        }
      }
      return n
    }

    return {
      items,
      count,
      countBySource,
      dueReviews,
      echoDay,
      tagPreference,
      has,
      add,
      remove,
      toggle,
      byId,
      markReviewed,
      settleEcho,
      markCarded,
      setNote,
      togglePin,
      migrateLegacy,
    }
  },
  {
    persist: { key: 'proverb', paths: ['items', 'echoDay'] },
  },
)

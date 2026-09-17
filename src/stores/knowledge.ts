/**
 * 知识卡片库 store ——「所有输入加工后的沉淀」（转述 → 重构 → 内化）。
 * 批次 C · 知：卡片来源 = 灵魂拷问作答（Lv.3）/ 概念播种收成导入（Lv.2）/ 行动回写 / 手动转述 / 每日一则追问 / 箴言转存。
 * 支持手动打标签与检索；**AI 智能标签已接线**（`/ai/tags`，见 `composables/useAi.ts`，
 * 未授权或失败时自动落 `utils/localAi` 的本机规则）—— 本 store 只负责存，不管标签怎么来的。
 * 单卡可被「加深一层」升级深度；满 7 天沉淀后的种子收成等素材可导入。
 */
import { defineStore } from 'pinia'
import { computed, ref } from 'vue'
import { todayKey } from '@/stores/daily'
import { logTrace } from '@/utils/traceLog'

/** 深度等级：Lv.1 转述 / Lv.2 重构 / Lv.3 内化 */
export type CardDepth = 1 | 2 | 3

/** 卡片来源类型 */
export type CardKind =
  /** 每日灵魂拷问的作答 */
  | 'question'
  /** 概念播种的收成 */
  | 'seed'
  /** 行动回写 */
  | 'action'
  /** 手动转述 */
  | 'note'
  /** 由「我的箴言」转来：收藏的句子 + 你写下的"为什么记住它" */
  | 'proverb'
  /**
   * 每日一则的「读完追问」。
   *
   * 与 question 分开记：拷问是**独立的每日自省**（问题与今天读什么无关），
   * 而这个是**针对当天那一则内容**的追问 —— 它是「观 → 知」的桥，
   * 来源不同，知识库里也该分得开。
   */
  | 'daily'

export interface KnowledgeCard {
  /** 建档时刻（Date.now()，兼作 id） */
  createdAt: number
  kind: CardKind
  title: string
  content: string
  tags: string[]
  /** 加工深度（可被升级） */
  depth: CardDepth
  /** 来源描述（如「拷问 · 2026-09-09」） */
  src: string
  /**
   * 重逢次数（2026-09-17）：隔一段时间再看一次这张卡，仍认同就 +1。
   * 「内化」的检验只有这一条路 —— 写下来当天觉得对，不算数。
   */
  echoCount?: number
  /** 上次重逢时刻（决定下次什么时候轮到你） */
  lastEchoAt?: number
  /** 重逢时发现「现在不这么想了」的时刻；有值 = 这张卡已被自己推翻过 */
  changedAt?: number
}

/** 重逢的最小年龄：写下来 30 天以后才值得再问一次（当天写的自己还记得） */
export const ECHO_MIN_AGE_DAYS = 30

const DAY_MS = 86_400_000

export const DEPTH_LABEL: Record<CardDepth, string> = {
  1: 'Lv.1 转述',
  2: 'Lv.2 重构',
  3: 'Lv.3 内化',
}

export function depthColor(depth: CardDepth): string {
  return depth === 1 ? '#84A268' : depth === 2 ? '#4E8FD4' : '#9C8AC4'
}

let uniq = 1

function nextId(): number {
  return Date.now() * 100 + (uniq++ % 100)
}

export const useKnowledgeStore = defineStore(
  'knowledge',
  () => {
    const cards = ref<KnowledgeCard[]>([])
    /** 已导入过知识库的概念播种（防止重复导入） */
    const seedImported = ref<number[]>([])

    /** 从观·概念播种的收成导入一张卡（Lv.2 重构起点）；返回卡片或 null */
    function importSeedHarvest(seed: {
      plantedAt: number
      concept: string
      note: string
      harvestNote?: string
    }): KnowledgeCard | null {
      if (seedImported.value.includes(seed.plantedAt)) return null
      const content = [seed.harvestNote, seed.note].filter(Boolean).join('\n')
      if (!content.trim()) return null
      const card = add({
        kind: 'seed',
        title: seed.concept,
        content,
        tags: ['播种'],
        depth: 2,
        src: '概念播种 · 收成',
      })
      seedImported.value = [...seedImported.value, seed.plantedAt]
      return card
    }

    function isSeedImported(plantedAt: number): boolean {
      return seedImported.value.includes(plantedAt)
    }

    /**
     * 由「我的箴言」转存一张卡。
     *
     * 深度由有没有写下"为什么记住它"决定：只搬原句 = Lv.1 转述，
     * 附了自己的理由 = Lv.2 重构 —— 说得出为什么，就已经不是复述了。
     */
    function importProverb(p: {
      text: string
      from?: string
      note?: string
      tags?: string[]
      src: string
    }): KnowledgeCard {
      const note = p.note?.trim() ?? ''
      const quote = p.from ? `「${p.text}」 —— ${p.from}` : `「${p.text}」`
      return add({
        kind: 'proverb',
        title: p.text.length > 18 ? `${p.text.slice(0, 18)}…` : p.text,
        content: [quote, note].filter(Boolean).join('\n'),
        tags: [...new Set([...(p.tags ?? []), '箴言'])],
        depth: note ? 2 : 1,
        src: p.src,
      })
    }

    /** 新卡在前 */
    function add(card: Omit<KnowledgeCard, 'createdAt'>): KnowledgeCard {
      const created: KnowledgeCard = { ...card, createdAt: nextId() }
      cards.value.unshift(created)
      return created
    }

    function remove(createdAt: number): void {
      cards.value = cards.value.filter((c) => c.createdAt !== createdAt)
    }

    /** 加深一层：Lv.1→2→3 */
    function deepen(createdAt: number): boolean {
      const c = cards.value.find((x) => x.createdAt === createdAt)
      if (!c || c.depth >= 3) return false
      c.depth = (c.depth + 1) as CardDepth
      return true
    }

    function byId(createdAt: number): KnowledgeCard | undefined {
      return cards.value.find((c) => c.createdAt === createdAt)
    }

    /** 全部标签去重列表 */
    function allTags(): string[] {
      const set = new Set<string>()
      cards.value.forEach((c) => c.tags.forEach((t) => set.add(t)))
      return [...set]
    }

    /** 某日新建卡数（dateKey 'YYYY-MM-DD'） */
    function countOn(dateKey: string): number {
      return cards.value.filter((c) => {
        const d = new Date(c.createdAt)
        const k = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
        return k === dateKey
      }).length
    }

    /* ---------------- 旧卡重逢（2026-09-17） ----------------
     * 为什么要有：这张库里已经有「深度分级」，但深度是**写的时候自己打的**，
     * 而"内化"这件事的本质是**过一段时间还认不认**。重逢就是那个检验：
     * 仍认同 → 它站住了；想法变了 → 派生一张新卡（"我曾经以为…现在我认为…"），
     * 后者比前者值钱 —— 它是认知真的动过的证据。
     *
     * 三条口径：
     *  1. **一天只一条**：多了就成了任务，不是重逢（echoDay 记在本 store，跨天自动解禁）；
     *  2. **30 天以后才问**：当天写的东西自己还记得，问了没意义；
     *  3. **被推翻过的不再问**：changedAt 有值的卡已经完成了它的使命，反复问等于不认账。
     */

    /** 今天已经重逢过的那一天（跨天自动失效） */
    const echoDay = ref('')

    /** 有资格重逢的卡（早该重逢的排前面：从没重逢过的按创建时间排） */
    function echable(now = Date.now()): KnowledgeCard[] {
      const deadline = now - ECHO_MIN_AGE_DAYS * DAY_MS
      return cards.value
        .filter((c) => c.createdAt <= deadline && !c.changedAt && c.content.trim())
        .sort((a, b) => (a.lastEchoAt || a.createdAt) - (b.lastEchoAt || b.createdAt))
    }

    /** 今天该重逢的那一条（今天已重逢过 / 没有够格的 → null） */
    const dueEcho = computed<KnowledgeCard | null>(() => {
      if (echoDay.value === todayKey()) return null
      return echable()[0] ?? null
    })

    /** 够格重逢的卡总数（入口文案用） */
    const echableCount = computed(() => echable().length)

    /**
     * 重逢一次。
     * @param result 'agree' = 现在还这么想；'changed' = 想法变了（会派生一张新卡）
     * @param note   'changed' 时写下的"现在怎么看"（可空，空则用一句如实记录的兜底文案）
     * @returns 是否记下了本次重逢
     */
    function echo(createdAt: number, result: 'agree' | 'changed', note = ''): boolean {
      const c = byId(createdAt)
      if (!c) return false
      c.echoCount = (c.echoCount ?? 0) + 1
      c.lastEchoAt = Date.now()
      echoDay.value = todayKey()
      const title = c.title.length > 14 ? `${c.title.slice(0, 14)}…` : c.title
      logTrace({
        kind: 'reflect.echo',
        text: result === 'agree' ? `重看「${title}」· 仍这么想` : `重看「${title}」· 想法变了`,
        ref: `card-${c.createdAt}`,
      })
      if (result === 'changed') {
        c.changedAt = Date.now()
        const body = note.trim() || '现在不这么看了。'
        add({
          kind: 'note',
          title: `曾经我以为：${c.title}`,
          content: `原来：「${c.content.slice(0, 60)}」\n现在：${body}`,
          tags: [...new Set([...c.tags, '重逢', '省察'])],
          depth: 2,
          src: '知 · 旧卡重逢',
        })
      }
      return true
    }

    /** 手动跳过一次（今天不再出现，明天它还在队首）—— 不写痕迹、不给分，也不记为"已推翻" */
    function skipEcho(): void {
      echoDay.value = todayKey()
    }

    return {
      cards,
      add,
      remove,
      deepen,
      byId,
      allTags,
      countOn,
      seedImported,
      importSeedHarvest,
      importProverb,
      isSeedImported,
      echoDay,
      dueEcho,
      echableCount,
      echable,
      echo,
      skipEcho,
    }
  },
  {
    persist: { key: 'knowledge', paths: ['cards', 'seedImported', 'echoDay'] },
  },
)

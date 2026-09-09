/**
 * 知识卡片库 store ——「所有输入加工后的沉淀」（转述 → 重构 → 内化）。
 * 批次 C · 知：卡片来源 = 灵魂拷问作答（Lv.3）/ 概念播种收成导入（Lv.2）/ 行动回写（批次 C）；
 * 支持手动打标签与检索（AI 智能标签为后端期能力，此处先手动）。
 * 单卡可被「加深一层」升级深度；满 7 天沉淀后的种子收成等素材可导入。
 */
import { defineStore } from 'pinia'
import { ref } from 'vue'

/** 深度等级：Lv.1 转述 / Lv.2 重构 / Lv.3 内化 */
export type CardDepth = 1 | 2 | 3

/** 卡片来源类型 */
export type CardKind = 'question' | 'seed' | 'action' | 'note'

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
}

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

    return { cards, add, remove, deepen, byId, allTags, countOn, seedImported, importSeedHarvest, isSeedImported }
  },
  {
    persist: { key: 'knowledge', paths: ['cards', 'seedImported'] },
  },
)

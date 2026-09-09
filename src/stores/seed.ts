/**
 * 概念播种 store ——「把阅读中的闪光念头种下，让概念与概念之间长出新枝」。
 * 批次 B 收尾 · 观子页（观理 → 观道：把念头交给时间，而非收藏夹）。
 * 规则：种下一个概念 → 7 天为幼苗期 → 到期可回看收成（写下它长出了什么）；
 * 收成的想法会被知卡片流采纳（批次 C 知识库的素材来源之一）。纯本地。
 */
import { defineStore } from 'pinia'
import { ref } from 'vue'

export interface Seed {
  /** 播种时刻（Date.now()，兼作唯一 id） */
  plantedAt: number
  /** 概念名（一词即可） */
  concept: string
  /** 一句话备注：当初为什么值得种 */
  note: string
  /** 手打标签，逗号/空格分隔存为数组 */
  tags: string[]
  /** 回看收成时间；为空 = 尚未收成 */
  harvestAt?: number
  /** 收成时写下：这段时间它长出了什么 */
  harvestNote?: string
}

/** 幼苗期：7 天 */
export const RIPE_AFTER_MS = 7 * 24 * 60 * 60 * 1000

/** 未收成上限：防止种太多收不过来（呼应「别囤积」） */
const CAP = 24

export function ripeAt(plantedAt: number): number {
  return plantedAt + RIPE_AFTER_MS
}

export function isRipe(seed: Seed, now = Date.now()): boolean {
  return !seed.harvestAt && now >= ripeAt(seed.plantedAt)
}

export const useSeedStore = defineStore(
  'seed',
  () => {
    /** 新在下，旧在上 */
    const seeds = ref<Seed[]>([])

    /** 种下一个念头；成功返回 true */
    function plant(concept: string, note: string, tags: string[]): boolean {
      const c = concept.trim()
      if (!c) return false
      if (seeds.value.filter((s) => !s.harvestAt).length >= CAP) {
        uni.showToast({ title: '种得太多了，先收成几颗', icon: 'none' })
        return false
      }
      seeds.value.unshift({ plantedAt: Date.now(), concept: c, note: note.trim(), tags })
      return true
    }

    /** 到期回看收成：写下它长出的东西 */
    function harvest(plantedAt: number, harvestNote: string): boolean {
      const seed = seeds.value.find((s) => s.plantedAt === plantedAt)
      const note = harvestNote.trim()
      if (!seed || seed.harvestAt || !note) return false
      seed.harvestAt = Date.now()
      seed.harvestNote = note
      return true
    }

    /** 拔掉一颗（幼苗期觉得不值的念头，允许反悔） */
    function remove(plantedAt: number): void {
      seeds.value = seeds.value.filter((s) => s.plantedAt !== plantedAt)
    }

    return { seeds, plant, harvest, remove }
  },
  {
    persist: { key: 'seed', paths: ['seeds'] },
  },
)

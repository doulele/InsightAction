/**
 * 回指（ref）的候选与反查。
 *
 * 两处用到它：
 *  1. 行大厅「三件事」的关联来源（规格 §4.4 回应式行动 —— 让「行」不再是孤立的 to-do）；
 *  2. 周报「一条路」—— 它只能由 trace 的 ref 生成，是那一页最有价值的部分（§14）。
 *
 * ref 的约定与各 store 写 trace 时保持一致：
 *  - `obs-xxx`   观的一条内容（理 / 事 / 母题，见 stores/observe.ts）
 *  - `card-xxx`  知的一张卡片（卡片没有独立 id，用 createdAt 当，见 stores/knowledge.ts）
 *  - `urge-xxx`  止的一次冲动记录（见 stores/urge.ts）
 *  - `thought-xxx` 止念的一念（见 stores/thought.ts；2026-09-17 加）
 *
 * 注意：不要给 ref 换格式或加前缀后缀 —— 老数据里的 ref 是写死的，改了就串不起来。
 */
import { useObserveStore } from '@/stores/observe'
import { useKnowledgeStore } from '@/stores/knowledge'
import { useUrgeStore } from '@/stores/urge'
import { useThoughtStore } from '@/stores/thought'

export type RefKind = 'theory' | 'card' | 'urge' | 'thought' | 'none'

export interface RefOption {
  ref: string
  kind: RefKind
  /** 主标 */
  text: string
  /** 副标（领域 / 深度 / 时间） */
  sub: string
}

export const REF_KIND_LABEL: Record<RefKind, string> = {
  theory: '理',
  card: '卡片',
  urge: '冲动',
  thought: '念头',
  none: '无出处',
}

/** 候选条数：够选就行，太长反而挑花眼 */
const CANDIDATE_CAP = 8

export function refOfCard(createdAt: number): string {
  return `card-${createdAt}`
}

export function refOfUrge(id: number): string {
  return `urge-${id}`
}

export function refOfThought(id: number): string {
  return `thought-${id}`
}

/** 可关联的来源候选：理 / 卡片 / 冲动 / 念头，各取最近几条 */
export function refOptions(): RefOption[] {
  const observe = useObserveStore()
  const knowledge = useKnowledgeStore()
  const urge = useUrgeStore()
  const thought = useThoughtStore()
  const out: RefOption[] = []

  observe.list
    .filter((i) => i.kind === 'theory' && i.state === 'confirmed')
    .slice(0, CANDIDATE_CAP)
    .forEach((i) =>
      out.push({
        ref: i.id,
        kind: 'theory',
        text: i.title || i.content.slice(0, 20),
        sub: i.topics[0] ?? '我立的理',
      }),
    )

  knowledge.cards
    .slice(0, CANDIDATE_CAP)
    .forEach((c) => out.push({ ref: refOfCard(c.createdAt), kind: 'card', text: c.title, sub: `Lv.${c.depth}` }))

  urge.records
    .slice(0, CANDIDATE_CAP)
    .forEach((r) => out.push({ ref: refOfUrge(r.id), kind: 'urge', text: r.trigger, sub: `${r.feeling} · ${r.day.slice(5)}` }))

  /*
   * 止念只在**判过"能做"**的那些里出候选：判"做不了"的念不该被挂成一件要做的事
   * （那正是「不代建」要防的 —— 有解才有下一步）。
   */
  thought.records
    .filter((r) => r.answer === 'act')
    .slice(0, CANDIDATE_CAP)
    .forEach((r) =>
      out.push({
        ref: refOfThought(r.id),
        kind: 'thought',
        text: r.action || r.text,
        sub: `止念 · ${r.day.slice(5)}`,
      }),
    )

  return out
}

/** ref → 一句话标题（原对象已被删则返回空串，由调用方兜底） */
export function refTitle(ref: string): string {
  if (!ref) return ''
  if (ref.startsWith('obs-')) {
    const it = useObserveStore().find(ref)
    return it ? it.title || it.content.slice(0, 24) : ''
  }
  if (ref.startsWith('card-')) {
    const at = Number(ref.slice('card-'.length))
    return useKnowledgeStore().cards.find((c) => c.createdAt === at)?.title ?? ''
  }
  /*
   * 老痕迹兜底：曾经有页面把卡片的 ref 写成裸时间戳（没有 card- 前缀），
   * 那些记录已经落盘，改不回来。这里按数字认作卡片，保证「一条路」仍能串上。
   */
  if (/^\d+$/.test(ref)) {
    const at = Number(ref)
    return useKnowledgeStore().cards.find((c) => c.createdAt === at)?.title ?? ''
  }
  if (ref.startsWith('urge-')) {
    const id = Number(ref.slice('urge-'.length))
    return useUrgeStore().records.find((r) => r.id === id)?.trigger ?? ''
  }
  if (ref.startsWith('thought-')) {
    const id = Number(ref.slice('thought-'.length))
    return useThoughtStore().records.find((r) => r.id === id)?.text ?? ''
  }
  // vow- / plan- 等别的前缀不参与回指展示（它们有自己的页面）
  return ''
}

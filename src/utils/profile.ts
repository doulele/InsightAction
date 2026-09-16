/**
 * 自我画像 —— 从脊椎里算出来的形状（规格 v2 §9.4「知」环新增项）。
 *
 * 口径只有一条：**只摆形状，不下结论**。
 *
 * 这不是保守，是因为这类"系统看出来的你"最容易做成两种坏东西：
 *  1. **一句聪明但无据的判语** —— 如"你是一个容易被情绪驱动的人"。听起来懂你，
 *     但既不能证伪，也指不回任何一条记录，用久了就成了标签，把人钉住（§7 反目标）。
 *  2. **凑出来的空话** —— 样本只有两笔就急着给结论，等于拿噪声当规律。
 *
 * 所以这里每条只做三件事：报样本数、报算出来的分布、样本不够就如实说还差多少。
 * 不写"你是什么样的人"，也不写"所以你应该……"。
 *
 * 与 urge 地图的同一条底线：样本 < 5 不下结论（见 stores/urge.ts 的 insight）。
 * 阈值按数据本身的粒度定 —— 冲动要 5 次（触发点才成形），痕迹要 10 笔（时段才成形）。
 */
import { useKnowledgeStore } from '@/stores/knowledge'
import { PROBE_SCENE_LABEL, useProbeStore, type ProbeScene } from '@/stores/probe'
import { useQuestionStore } from '@/stores/question'
import { useTraceStore } from '@/stores/trace'
import { useUrgeStore } from '@/stores/urge'
import { useVowStore } from '@/stores/vow'

/** 各条「敢说」的样本门槛 */
const NEED_URGE = 5
const NEED_VOW = 3
const NEED_PROBE = 3
const NEED_CARD = 5
const NEED_TRACE = 10

export interface ProfileItem {
  key: string
  /** 小标：哪一环 · 看的什么 */
  label: string
  /** 事实句（样本够了才给内容） */
  text: string
  /** 样本不足时的如实说明 —— 说清还差多少，比写一句「还没有」有用 */
  pend: string
  samples: number
  need: number
}

export interface Profile {
  items: ProfileItem[]
  /** 已经成形的条数 */
  readyCount: number
  /** 一条都没成形时给的方向；有成形就不写总纲（免得把形状又总结成一句判语） */
  summary: string
}

function hourOf(at: number): number {
  return new Date(at).getHours()
}

/** 出现次数最多的那一项 */
function topOf<K>(freq: Map<K, number>): [K, number] | null {
  let best: [K, number] | null = null
  for (const pair of freq) {
    if (!best || pair[1] > best[1]) best = pair
  }
  return best
}

export function buildProfile(): Profile {
  const urge = useUrgeStore()
  const vow = useVowStore()
  const question = useQuestionStore()
  const probe = useProbeStore()
  const knowledge = useKnowledgeStore()
  const trace = useTraceStore()

  const items: ProfileItem[] = []

  /* ① 止 · 冲动：忍住率 + 最强触发点 + 高发时段 */
  {
    const n = urge.records.length
    const top = urge.byTrigger[0]
    const band = [...urge.byHourBand].sort((a, b) => b.count - a.count)[0]
    const resisted = urge.records.filter((r) => !r.acted).length
    items.push({
      key: 'urge',
      label: '止 · 冲动',
      samples: n,
      need: NEED_URGE,
      text:
        top && band
          ? `这 ${n} 次里忍住 ${resisted} 次；「${top.trigger}」最多（${top.count} 次），多在${band.label}。`
          : '',
      pend: `再记 ${Math.max(1, NEED_URGE - n)} 次，才看得出你的触发点。`,
    })
  }

  /* ② 止 · 立约：守住 / 破了 / 没回看，各多少次 */
  {
    const t = vow.tally
    const n = t.kept + t.broken + t.missed
    items.push({
      key: 'vow',
      label: '止 · 立约',
      samples: n,
      need: NEED_VOW,
      text: `立了 ${n} 次约：守住 ${t.kept} 次、破了 ${t.broken} 次${t.missed ? `、没回看 ${t.missed} 次` : ''}。`,
      pend: `再立 ${Math.max(1, NEED_VOW - n)} 次约，才看得出你守得住什么。`,
    })
  }

  /* ③ 知 · 省察：每日一问与情境省察各答了多少，情境里哪类最多 */
  {
    const daily = Object.values(question.records).filter((r) => (r.answer ?? '').trim()).length
    const sceneRecs = probe.records.filter((r) => r.answer.trim())
    const n = daily + sceneRecs.length
    const freq = new Map<ProbeScene, number>()
    for (const r of sceneRecs) freq.set(r.scene, (freq.get(r.scene) ?? 0) + 1)
    const top = topOf(freq)
    const tail = top ? `；情境里「${PROBE_SCENE_LABEL[top[0]]}」最多（${top[1]} 次）` : ''
    items.push({
      key: 'probe',
      label: '知 · 省察',
      samples: n,
      need: NEED_PROBE,
      text: `答过 ${daily} 次每日一问、${sceneRecs.length} 次情境省察${tail}。`,
      pend: `再答 ${Math.max(1, NEED_PROBE - n)} 次省察，才看得出你在反复想什么。`,
    })
  }

  /* ④ 知 · 卡片：标签出现得最多的是哪个（不是深度分布 —— 那个看板里已有） */
  {
    const n = knowledge.cards.length
    const freq = new Map<string, number>()
    for (const c of knowledge.cards) {
      for (const tag of c.tags ?? []) freq.set(tag, (freq.get(tag) ?? 0) + 1)
    }
    const top = topOf(freq)
    items.push({
      key: 'card',
      label: '知 · 卡片',
      samples: n,
      need: NEED_CARD,
      text: top
        ? `${n} 张卡里，「${top[0]}」出现最多（${top[1]} 张）。`
        : `${n} 张卡，还没打过标签。`,
      pend: `再攒 ${Math.max(1, NEED_CARD - n)} 张卡，才看得出你在意什么。`,
    })
  }

  /* ⑤ 全局 · 时段：痕迹落在一天里的哪一段（22 点后单独计） */
  {
    const list = trace.list
    const n = list.length
    const night = list.filter((t) => {
      const h = hourOf(t.at)
      return h >= 22 || h < 6
    }).length
    items.push({
      key: 'hour',
      label: '全局 · 时段',
      samples: n,
      need: NEED_TRACE,
      text: `${n} 笔痕迹里，${night} 笔记在 22 点以后。`,
      pend: `再攒 ${Math.max(1, NEED_TRACE - n)} 笔痕迹，才看得出你什么时候在用它。`,
    })
  }

  const readyCount = items.filter((i) => i.samples >= i.need && i.text).length

  return {
    items,
    readyCount,
    summary: readyCount
      ? ''
      : '还看不出形状 —— 这里长出来的每一句，都取自你留下的记录，攒够了才出现。',
  }
}

/**
 * 修行档案 —— **可读版**导出（规格 v2 §16.3）。
 *
 * 为什么还要这一份：`localBackup` 导出的是 JSON，用户拿到手也读不出什么
 * （"我到底读了哪些、立过什么理、守住了几次"）。这里把同一份数据按四环组织成
 * Markdown 文字版：**能直接读、能转发、能贴进日记**。
 *
 * 三条硬规则（与备份体系同一条底线）：
 *  1. **全程本机生成，不上传任何服务器** —— 这条不能破，破了就是另一类功能了；
 *  2. **只写真实存在的数据** —— 没有就如实写"还没有"，绝不为了补白写一句场面话，
 *     也绝不给任何数字注水（如"用过几次"这种追踪不准的一律不写）；
 *  3. 时间轴最多附 500 条（与脊椎软上限一致），超出**如实说明被截断**并指向备份文件。
 */
import { levelName } from '@/config/levels'
import { kindLabel } from '@/config/trace'
import { useKnowledgeStore } from '@/stores/knowledge'
import { useModeStore } from '@/stores/mode'
import { useObserveStore } from '@/stores/observe'
import { usePlanStore } from '@/stores/plan'
import { SOURCE_LABEL, useProverbStore } from '@/stores/proverb'
import { useQuestionStore } from '@/stores/question'
import { PROBE_SCENE_LABEL, useProbeStore } from '@/stores/probe'
import { useTraceStore } from '@/stores/trace'
import { useUrgeStore } from '@/stores/urge'
import { useVowStore } from '@/stores/vow'
import { useXpStore } from '@/stores/xp'
import { fileStamp, writeTextFile } from './localBackup'
import { buildProfile } from './profile'

/** 时间轴最多附多少条痕迹（规格 §16.3） */
export const TRACE_ARCHIVE_CAP = 500

/** 明细类小节最多列多少条（理 / 卡片 / 箴言全列；立约与冲动只列最近这些条） */
const DETAIL_CAP = 30

/** 挑战三型的档案叫法（与 stores/plan.ts 的 CHALLENGE_TAG 同义，这里单独写是为了不耦合内部常量） */
const CHALLENGE_LABEL: Record<string, string> = {
  abstain: '戒断',
  try: '尝试',
  cog: '认知',
}

export interface ArchiveResult {
  /** Markdown 全文 */
  text: string
  /** 时间轴实际附了多少条 */
  traceShown: number
  /** 痕迹总数 */
  traceTotal: number
  /** 时间轴是否被截断 */
  truncated: boolean
}

/* ---------------- 文本小工具 ---------------- */

function pad(n: number): string {
  return String(n).padStart(2, '0')
}

/** 2026-09-03 */
function fmtDay(at: number): string {
  const d = new Date(at)
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

/** 2026-09-15 14:30 */
function fmtTime(at: number): string {
  const d = new Date(at)
  return `${fmtDay(at)} ${pad(d.getHours())}:${pad(d.getMinutes())}`
}

/** Markdown 列表里换行会断掉条目，统一压成一行 */
function oneLine(s: string): string {
  return (s ?? '').replace(/\s+/g, ' ').trim()
}

function clip(s: string, n: number): string {
  const t = oneLine(s)
  return t.length > n ? `${t.slice(0, n)}…` : t
}

/* ---------------- 生成 ---------------- */

/**
 * 生成修行档案全文。
 *
 * 顺序与规格模板一致：概览 → 观 → 止 → 知 → 行（含痕迹时间轴）。
 * 每个小节都是「先给一句汇总，再列明细」，空数据也照实说空 —— 这样用户第一眼
 * 就能看出自己哪环还没走，而不是被一份漂亮的模板骗过去。
 */
export function buildArchive(now = new Date()): ArchiveResult {
  const mode = useModeStore()
  const xp = useXpStore()
  const trace = useTraceStore()
  const observe = useObserveStore()
  const vow = useVowStore()
  const urge = useUrgeStore()
  const knowledge = useKnowledgeStore()
  const question = useQuestionStore()
  const probe = useProbeStore()
  const plan = usePlanStore()
  const proverb = useProverbStore()

  const L: string[] = []

  /* ---- 概览 ---- */
  L.push('# 观止知行 · 修行档案')
  L.push('')
  L.push(
    `导出时间：${fmtTime(now.getTime())} ｜ 修行语言：${mode.meta.label} · ${mode.meta.labelEn}`,
  )
  L.push(`当前${mode.meta.growthName}：${levelName(mode.id, xp.levelXp)}（累计修为 ${xp.total}）`)
  L.push('')

  /* ---- 观 ---- */
  L.push('## 观')
  L.push('')

  const dailyRead = trace.list.filter((t) => t.kind === 'observe.daily').length
  L.push(`### 每日一则（已读 ${dailyRead} 则）`)
  L.push('')

  const theories = observe.theories
  L.push(`### 我立的理（${theories.length} 条）`)
  L.push('')
  if (!theories.length) {
    L.push('（还没有入册的理 —— 在「观」里写下「为什么成立」，它才算立住）')
  } else {
    for (const t of theories) {
      const why = t.why ? ` —— 为什么成立：${oneLine(t.why)}` : ''
      L.push(`- ${oneLine(t.title || t.summary)}${why}（立 ${fmtDay(t.createdAt)}）`)
    }
  }
  L.push('')

  const mothers = observe.mothers
  L.push(`### 我的母题（${mothers.length} 个）`)
  L.push('')
  if (!mothers.length) {
    L.push('（还没有母题 —— 几条理相通时，可以把它们提炼成一个）')
  } else {
    for (const m of mothers) {
      const n = observe.childrenOf(m.id).length
      L.push(`- ${oneLine(m.title || m.summary)}${n ? `（辖 ${n} 条理）` : ''}`)
    }
  }
  L.push('')

  const provs = proverb.items
  L.push(`### 我记住的话（${provs.length} 句）`)
  L.push('')
  if (!provs.length) {
    L.push('（还没有收藏的句子）')
  } else {
    for (const p of provs) {
      const from = SOURCE_LABEL[p.source] ?? ''
      const note = p.note ? ` —— ${oneLine(p.note)}` : ''
      L.push(`- 「${oneLine(p.text)}」${from ? ` —— 来自${from}` : ''}${note}`)
    }
  }
  L.push('')

  /* ---- 止 ---- */
  L.push('## 止')
  L.push('')

  const vows = [vow.current, ...vow.history].filter((v): v is NonNullable<typeof v> => !!v)
  const kept = vows.filter((v) => v.status === 'kept').length
  const broken = vows.filter((v) => v.status === 'broken').length
  const missed = vows.filter((v) => v.missed).length
  L.push(
    `### 立约记录（守住 ${kept} / 破了 ${broken}${missed ? ` / 错过回看 ${missed}` : ''}）`,
  )
  L.push('')
  if (!vows.length) {
    L.push('（还没有立过约）')
  } else {
    for (const v of [...vows].sort((a, b) => b.createdAt - a.createdAt).slice(0, DETAIL_CAP)) {
      const st = v.status === 'kept' ? '守住' : v.status === 'broken' ? '破了' : '未回看'
      const reason = v.reason ? ` · 为什么：${oneLine(v.reason)}` : ''
      L.push(
        `- ${v.day} · ${st} · ${oneLine(v.promise)}（${oneLine(v.trigger)} → 改做：${oneLine(v.action)}）${reason}`,
      )
    }
  }
  L.push('')

  const urges = urge.records
  const topTrigger = urges.length >= 5 ? urge.byTrigger[0] : null
  const topBand = urges.length >= 5
    ? [...urge.byHourBand].sort((a, b) => b.count - a.count)[0]
    : null
  L.push(
    `### 冲动记录（累计 ${urges.length} 次${
      topTrigger ? ` · 最多是「${topTrigger.trigger}」${topTrigger.count} 次` : ''
    }${topBand ? ` · 多发生在${topBand.label}` : ''}）`,
  )
  L.push('')
  if (!urges.length) {
    L.push('（还没有记过冲动）')
  } else {
    for (const r of [...urges].sort((a, b) => b.at - a.at).slice(0, DETAIL_CAP)) {
      L.push(
        `- ${r.day} ${r.hour} 点 · ${r.trigger} · 强度 ${r.intensity} · ${r.acted ? '做了' : '没做'}${
          r.alternative ? ` · 改做：${oneLine(r.alternative)}` : ''
        }`,
      )
    }
  }
  L.push('')

  /* ---- 知 ---- */
  L.push('## 知')
  L.push('')

  const cards = knowledge.cards
  const d1 = cards.filter((c) => c.depth === 1).length
  const d2 = cards.filter((c) => c.depth === 2).length
  const d3 = cards.filter((c) => c.depth === 3).length
  L.push(`### 我的卡片（共 ${cards.length} 张 · Lv.1 ${d1} / Lv.2 ${d2} / Lv.3 ${d3}）`)
  L.push('')
  if (!cards.length) {
    L.push('（还没有卡片）')
  } else {
    for (const c of [...cards].sort((a, b) => b.createdAt - a.createdAt)) {
      L.push(`- [Lv.${c.depth}] ${oneLine(c.title)} —— ${clip(c.content, 60)}`)
    }
  }
  L.push('')

  const answered = Object.entries(question.records)
    .filter(([, r]) => (r.answer ?? '').trim())
    .sort(([a], [b]) => (a < b ? 1 : -1))
  L.push(`### 省察记录（${answered.length} 条）`)
  L.push('')
  if (!answered.length) {
    L.push('（还没有作答过灵魂拷问）')
  } else {
    for (const [day, r] of answered.slice(0, DETAIL_CAP)) {
      L.push(`- ${day} · ${clip(r.q, 30)} —— ${clip(r.answer, 80)}`)
    }
  }
  L.push('')

  /* 情境省察：与「每日一问」分开记 —— 它不占每日额度，由具体事件引出来（§4.3） */
  const probes = probe.records.filter((r) => r.answer.trim())
  L.push(`### 情境省察（${probes.length} 条）`)
  L.push('')
  if (!probes.length) {
    L.push('（还没有作答过情境省察）')
  } else {
    for (const p of probes.slice(0, DETAIL_CAP)) {
      L.push(`- ${PROBE_SCENE_LABEL[p.scene]} · ${clip(p.q, 30)} —— ${clip(p.answer, 80)}`)
    }
  }
  L.push('')

  /* 自我画像（§9.4）：从脊椎算出来的形状，只摆事实不给判语 */
  const pf = buildProfile()
  L.push(`### 自我画像（${pf.readyCount}/${pf.items.length} 成形）`)
  L.push('')
  for (const it of pf.items) {
    const ready = it.samples >= it.need && it.text
    L.push(`- ${it.label}（${it.samples} 笔）：${ready ? it.text : it.pend}`)
  }
  L.push('')

  /* ---- 行 ---- */
  L.push('## 行')
  L.push('')

  const longs = plan.plans.filter((p) => p.kind === 'long')
  const active = longs.filter((p) => p.status === 'active')
  const done = longs.filter((p) => p.status === 'done')
  L.push(`### 计划（在走 ${active.length} · 已收束 ${done.length}）`)
  L.push('')
  if (!longs.length) {
    L.push('（还没有立过长期计划）')
  } else {
    for (const p of [...active, ...done]) {
      const pr = plan.progressOf(p)
      const tag = p.challenge ? ` · ${CHALLENGE_LABEL[p.challenge] ?? ''}` : ''
      const at = p.doneAt ? ` · 收束于 ${fmtDay(p.doneAt)}` : ''
      L.push(
        `- ${p.status === 'done' ? '已收束' : '在走'} · ${oneLine(p.title)}（${pr.done}/${pr.total}）${tag}${at}`,
      )
    }
  }
  L.push('')

  const all = [...trace.list].sort((a, b) => a.at - b.at)
  const shown = all.slice(-TRACE_ARCHIVE_CAP)
  L.push(`### 痕迹时间轴（最近 ${shown.length} 条）`)
  L.push('')
  if (!shown.length) {
    L.push('（还没有痕迹）')
  } else {
    for (const t of shown) {
      L.push(
        `- ${fmtTime(t.at)} · ${kindLabel(t.kind)} · ${clip(t.text, 40)}${
          t.value > 0 ? `（+${t.value}）` : ''
        }`,
      )
    }
  }
  if (all.length > shown.length) {
    L.push('')
    L.push(
      `> 共 ${all.length} 条痕迹，这里只附最近 ${shown.length} 条 —— 完整数据请用「导出全部数据」的备份文件。`,
    )
  }
  L.push('')

  L.push('---')
  L.push('')
  L.push('数据全部来自本机，未上传任何服务器。')

  return {
    text: L.join('\n'),
    traceShown: shown.length,
    traceTotal: all.length,
    truncated: all.length > shown.length,
  }
}

/** 把档案写成小程序私有目录里的 Markdown 文件 */
export function writeArchiveFile(text: string, now = new Date()): { filePath: string; fileName: string } {
  return writeTextFile(text, `guanzhi-archive-${fileStamp(now)}.md`)
}

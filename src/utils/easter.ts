/**
 * 彩蛋体系 —— 9 个单人彩蛋的**可判定**版本（规格 §12.5，2026-09-17 接入三项新行为）。
 *
 * 设计原则（与徽章一致）：**只用本地真实数据判定，不为了凑数写一条永远返回 false 的规则**。
 * 因此有两条与清单原文的偏差被显式记录在这里：
 *
 *  - 「过目不忘」：原文是「连续 7 天【观】配额看完 + 【知】关联」。配额消耗没有逐日落痕，
 *    无法验证，改为可验证的等价物 ——「连续 7 天『观』与『知』都有入账」；
 *  - 「知行合一」：原文是「单日【知】→【行】转化成功」。转化的唯一真实动作就是
 *    点「我用上了」（reflect.apply），故以该事件为准。
 *
 * 其余四条与原文一致。
 * 「今天」不满足时从昨天起算 —— 一天的修行还没做完不该被判为断掉（与 focus 连胜同一口径）。
 *
 * 2026-09-17 新增三条：**日课连续守住 30 天**（守得住）、**拆开过时间胶囊**（时空之约）、
 * **重逢时推翻过自己的旧卡**（温故知新）。三条都严格贴合"意外惊喜"的定义：
 * 它们是"某件不常发生的事真的发生过"，不是"攒够多少条" —— 攒数量那类归徽章。
 */
import { dateKeyOf, dateKeyShift } from '@/utils/dateKey'
import { useCapsuleStore } from '@/stores/capsule'
import { useFocusStore } from '@/stores/focus'
import { useKnowledgeStore } from '@/stores/knowledge'
import { usePlanStore } from '@/stores/plan'
import { useTraceStore } from '@/stores/trace'
import type { HallId } from '@/config/lexicon'
import type { TraceKind } from '@/config/trace'
import type { Trace } from '@/stores/trace'

export interface EggRule {
  id: string
  name: string
  /** 触发条件（人话，直接展示） */
  desc: string
  /** 解锁后的奖励说明 */
  reward: string
  hit: (ctx: EggContext) => boolean
}

export interface EggContext {
  /** 某自然日某环的修为入账值 */
  valueOn: (day: string, hall: HallId) => number
  /** 连续满足条件的天数（今天不满足则从昨天起算） */
  streak: (pred: (day: string) => boolean) => number
  /** 是否存在满足条件的痕迹 */
  hasTrace: (kind: TraceKind, pred?: (t: Trace) => boolean) => boolean
  /** 某日「知」是否有 ≥50 字的卡片 */
  deepNoteOn: (day: string) => boolean
  /** 某日静修分钟 */
  focusMinOn: (day: string) => number
  /* ↓ 2026-09-17 新增三维（日课 / 时间胶囊 / 旧卡重逢） */
  /** 在守日课里最长的「连续守住」天数 */
  dailyStreakMax: number
  /** 拆开过至少一条时间胶囊 */
  capsuleOpened: boolean
  /** 重逢时推翻过至少一张自己的旧卡（卡上有 changedAt） */
  cardChanged: boolean
}

/*
 * 自然日键与平移（原 pad + dayKeyShift）2026-09-22 合并进 `utils/dateKey.ts`，
 * 现用 `dateKeyOf()` / `dateKeyShift()`。本文件第 182 行那处内联拼串也一并换掉了。
 */

export const EGG_RULES: readonly EggRule[] = [
  {
    id: 'midnight',
    name: '子时入定',
    desc: '在 23:00 - 01:00 之间走完一次静修',
    reward: '夜间主题 + 称号「夜修者」',
    hit: (c) =>
      c.hasTrace('pause.cooldown', (t) => {
        if (!t.text.startsWith('静修')) return false
        const h = new Date(t.at).getHours()
        return h === 23 || h === 0
      }),
  },
  {
    id: 'recall',
    name: '过目不忘',
    desc: '连续 7 天「观」与「知」都有入账',
    reward: '小枢「书灵」形态',
    hit: (c) => c.streak((d) => c.valueOn(d, 'observe') > 0 && c.valueOn(d, 'reflect') > 0) >= 7,
  },
  {
    id: 'unity',
    name: '知行合一',
    desc: '把一条所悟真的用到行动上（点一次「我用上了」）',
    reward: '修为 +5 + 惊堂木特效',
    hit: (c) => c.hasTrace('reflect.apply'),
  },
  {
    id: 'seclusion',
    name: '闭关苦修',
    desc: '连续 3 天，每天静修满 120 分钟',
    reward: '「闭关」头像框',
    hit: (c) => c.streak((d) => c.focusMinOn(d) >= 120) >= 3,
  },
  {
    id: 'descend',
    name: '下山历练',
    desc: '连续 21 天，观止知行四维全部入账',
    reward: '直升一级 + 全屏烟花',
    hit: (c) =>
      c.streak(
        (d) =>
          c.valueOn(d, 'observe') > 0 &&
          c.valueOn(d, 'pause') > 0 &&
          c.valueOn(d, 'reflect') > 0 &&
          c.valueOn(d, 'action') > 0,
      ) >= 21,
  },
  {
    id: 'epiphany',
    name: '顿悟时刻',
    desc: '连续 7 天写下的所悟都超过 50 字',
    reward: '生成「个人修行箴言」',
    hit: (c) => c.streak((d) => c.deepNoteOn(d)) >= 7,
  },
  /* ---------------- 2026-09-17 新增三条 ---------------- */
  {
    id: 'hold',
    name: '守得住',
    desc: '同一件事，连续守住 30 天',
    reward: '称号「守夜人」+ 沙漏玻璃纹',
    hit: (c) => c.dailyStreakMax >= 30,
  },
  {
    id: 'capsule',
    name: '时空之约',
    desc: '拆开一封你写给未来的自己的胶囊',
    reward: '箴言墙「时间胶囊」专属边框',
    hit: (c) => c.capsuleOpened,
  },
  {
    id: 'overturn',
    name: '温故知新',
    desc: '重看旧卡时发现「现在不这么想了」—— 亲手推翻过自己一次',
    reward: '称号「自新者」+ 知厅一笔改写动效',
    hit: (c) => c.cardChanged,
  },
]

export interface EggResult {
  rule: EggRule
  unlocked: boolean
}

/** 一次性快照判定（成就墙页在 setup 期调用） */
export function evaluateEggs(): EggResult[] {
  const trace = useTraceStore()
  const knowledge = useKnowledgeStore()
  const focus = useFocusStore()
  /* 2026-09-17 新增：日课（连续守住天数）/ 时间胶囊（拆开过）/ 旧卡重逢（推翻过） */
  const plan = usePlanStore()
  const capsule = useCapsuleStore()
  const today = new Date()

  const keys: string[] = []
  for (let i = 0; i < 40; i++) keys.push(dateKeyShift(today, -i))

  const ctx: EggContext = {
    valueOn: (day, hall) => trace.valueOn(day, hall),
    /** 从今天往上数连续满足的天数；今天不满足时跳过今天（一天的功课还没到点） */
    streak: (pred) => {
      let i = pred(keys[0]) ? 0 : 1
      let n = 0
      while (i < keys.length && pred(keys[i])) {
        n += 1
        i += 1
      }
      return n
    },
    hasTrace: (kind, pred) => trace.list.some((t) => t.kind === kind && (pred ? pred(t) : true)),
    deepNoteOn: (day) =>
      knowledge.cards.some((c) => {
        const k = dateKeyOf(c.createdAt)
        return k === day && c.content.trim().length >= 50
      }),
    focusMinOn: (day) => focus.minutesOn(day),
    dailyStreakMax: plan.dailyPlans.reduce((max, p) => Math.max(max, plan.dailyStreak(p)), 0),
    capsuleOpened: capsule.opened.length > 0,
    cardChanged: knowledge.cards.some((c) => Boolean(c.changedAt)),
  }

  return EGG_RULES.map((rule) => ({ rule, unlocked: rule.hit(ctx) }))
}

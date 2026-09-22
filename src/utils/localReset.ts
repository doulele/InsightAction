/**
 * localReset —— 设置页「重置全部修行数据」。
 * 只清修行/档案类记录（修为、等级、徽章、习惯、知识卡、痕迹、盲盒、测评、定时、收藏等），
 * 保留「修行语言 / 提醒偏好 / 首次启动」等本机设置；修行数据只有一份，三模式同源同清。
 * 各 store 均以 $patch 整体替换为空态（类型由 TS 兜底，shape 变更时此处会报错提醒同步）。
 */
import { useXpStore } from '@/stores/xp'
import { useFocusStore } from '@/stores/focus'
import { useQuestionStore } from '@/stores/question'
import { useKnowledgeStore } from '@/stores/knowledge'
import { useSeedStore } from '@/stores/seed'
import { useHabitStore } from '@/stores/habit'
import { useBoxStore } from '@/stores/box'
import { useTraceStore } from '@/stores/trace'
import { useAssessmentStore } from '@/stores/assessment'
import { useBadgeStore } from '@/stores/badges'
import { useDailyStore, freshTodos, todayKey } from '@/stores/daily'
import { useReminderStore } from '@/stores/reminder'
import { useReadLaterStore } from '@/stores/readLater'
import { useProverbStore } from '@/stores/proverb'
import { useObserveStore } from '@/stores/observe'
import { useComposeDraftStore } from '@/stores/composeDraft'
import { useBodyStore } from '@/stores/body'
import { usePlanStore } from '@/stores/plan'
import { useThoughtStore } from '@/stores/thought'
import { useUrgeStore } from '@/stores/urge'
import { useVowStore } from '@/stores/vow'
import { useInterruptStore } from '@/stores/interrupt'
import { useProbeStore } from '@/stores/probe'
import { useClosingStore } from '@/stores/closing'
import { useCapsuleStore } from '@/stores/capsule'
import { useShareStore } from '@/stores/share'

export function resetPracticeData(): void {
  useXpStore().$patch({ total: 0, maxLevel: 0 })
  useFocusStore().$patch({ days: [], dailyGoal: 60 })
  useQuestionStore().$patch({ records: {}, lastIdx: 0 })
  useKnowledgeStore().$patch({ cards: [], seedImported: [], echoDay: '' })
  useSeedStore().$patch({ seeds: [] })
  useHabitStore().$patch({ habits: [], records: {} })
  useBoxStore().$patch({ drawn: null })
  useTraceStore().$patch({ traces: [] })
  useAssessmentStore().$patch({ results: {}, history: {}, skipped: {}, promptSnoozeUntil: 0 })
  /*
   * 徽章点亮留痕（2026-09-22）：属于修行记录，跟着一起清。
   * 数据清了之后判定自然回到"未点亮"，留痕留着反而是个谎 —— 它会把一枚徽章挂在空数据上。
   */
  useBadgeStore().$patch({ items: [], fresh: [] })
  const daily = useDailyStore()
  daily.$patch({ dateKey: todayKey(), todos: freshTodos() })
  useReminderStore().$patch({ reminders: [] })
  useReadLaterStore().$patch({ items: [] })
  useProverbStore().$patch({ items: [], echoDay: '' })
  useObserveStore().$patch({ items: [] })
  // 草稿也是内容：重置修行数据时一并清掉，免得留一份"看不见的输入"在下一次进录入页时冒出来
  useComposeDraftStore().$patch({ draft: null })
  /*
   * 身体电量：步数属于"看得见的记录"，随修行数据一并清空 ——
   * 这既符合「重置全部」的字面意思，也是健康类数据必须给到用户的删除开关。
   * goal（今日目标步数）留着：它和语言、提醒一样是本机偏好，不是记录。
   * lastTryAt / autoStrikes 是静默续接的记账，跟着步数一起清 —— 留着会让
   * "重置之后反而更不容易同步"（auth 已清空，本来也不会自动，清掉只是不留下脏计数）。
   */
  useBodyStore().$patch({ days: {}, lastSyncAt: '', lastTryAt: '', autoStrikes: 0, auth: '' })
  /*
   * 「止」与「行」的长期档同样是修行记录，漏了它们，用户点完「重置全部」
   * 会发现计划还在、冲动记录还在 —— 那句话就成了假的。
   */
  usePlanStore().$patch({ plans: [] })
  useThoughtStore().$patch({ records: [] })
  useUrgeStore().$patch({ records: [], cooldownUntil: 0, cooldownKind: 'quick' })
  useVowStore().$patch({ current: null, history: [] })
  useInterruptStore().$patch({ custom: [], records: [] })
  useProbeStore().$patch({ records: [], skipped: {} })
  /* 收功（每天一句）与时间胶囊（写给未来的自己的话）同样属于"我写过的东西"，一并清 */
  useClosingStore().$patch({ records: [] })
  useCapsuleStore().$patch({ items: [] })
  /*
   * 分享留痕也清 —— 但真正的撤回**发生在调用方**（设置页在重置前先 `share.revokeAll()`）：
   * 这里只是同步清本机，服务器上那些快照要靠网络请求删，写不进这个同步函数。
   * 顺序不能反：先撤回、后重置，否则详情页没了、链接却还公开可读。
   */
  useShareStore().$patch({ items: [] })
}

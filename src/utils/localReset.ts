/**
 * localReset —— 设置页「重置全部修行数据」。
 * 只清修行/档案类记录（修为、等级、徽章、习惯、知识卡、痕迹、盲盒、测评、定时、收藏等），
 * 保留「修行语言 / 提醒偏好 / 首次启动」等本机设置；修行数据只有一份，三模式同源同清。
 * 各 store 均以 $patch 整体替换为空态（类型由 TS 兜底，shape 变更时此处会报错提醒同步）。
 */
import { useXpStore } from '@/stores/xp'
import { useFocusStore } from '@/stores/focus'
import { useQualityStore } from '@/stores/quality'
import { useQuestionStore } from '@/stores/question'
import { useKnowledgeStore } from '@/stores/knowledge'
import { useSeedStore } from '@/stores/seed'
import { useHabitStore } from '@/stores/habit'
import { useBoxStore } from '@/stores/box'
import { useTraceStore } from '@/stores/trace'
import { useAssessmentStore } from '@/stores/assessment'
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

export function resetPracticeData(): void {
  useXpStore().$patch({ total: 0, maxLevel: 0 })
  useFocusStore().$patch({ days: [], dailyGoal: 60 })
  useQualityStore().$patch({ sources: [], dayMarks: {} })
  useQuestionStore().$patch({ records: {}, lastIdx: 0 })
  useKnowledgeStore().$patch({ cards: [], seedImported: [] })
  useSeedStore().$patch({ seeds: [] })
  useHabitStore().$patch({ habits: [], records: {} })
  useBoxStore().$patch({ drawn: null })
  useTraceStore().$patch({ traces: [] })
  useAssessmentStore().$patch({ results: {}, history: {}, skipped: {}, promptSnoozeUntil: 0 })
  const daily = useDailyStore()
  daily.$patch({ dateKey: todayKey(), todos: freshTodos() })
  useReminderStore().$patch({ reminders: [] })
  useReadLaterStore().$patch({ items: [] })
  useProverbStore().$patch({ items: [] })
  useObserveStore().$patch({ items: [] })
  // 草稿也是内容：重置修行数据时一并清掉，免得留一份"看不见的输入"在下一次进录入页时冒出来
  useComposeDraftStore().$patch({ draft: null })
  /*
   * 身体电量：步数属于"看得见的记录"，随修行数据一并清空 ——
   * 这既符合「重置全部」的字面意思，也是健康类数据必须给到用户的删除开关。
   * goal（今日目标步数）留着：它和语言、提醒一样是本机偏好，不是记录。
   */
  useBodyStore().$patch({ days: {}, lastSyncAt: '', auth: '' })
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
}

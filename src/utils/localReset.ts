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

export function resetPracticeData(): void {
  useXpStore().$patch({ total: 0 })
  useFocusStore().$patch({ days: [], dailyGoal: 60 })
  useQualityStore().$patch({ sources: [], dayMarks: {} })
  useQuestionStore().$patch({ records: {}, lastIdx: 0 })
  useKnowledgeStore().$patch({ cards: [], seedImported: [] })
  useSeedStore().$patch({ seeds: [] })
  useHabitStore().$patch({ habits: [], records: {} })
  useBoxStore().$patch({ drawn: null })
  useTraceStore().$patch({ traces: [] })
  useAssessmentStore().$patch({ results: {} })
  const daily = useDailyStore()
  daily.$patch({ dateKey: todayKey(), todos: freshTodos() })
  useReminderStore().$patch({ reminders: [] })
  useReadLaterStore().$patch({ items: [] })
}

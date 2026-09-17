/**
 * 安息日 —— 每周留一天，什么都不必记（2026-09-17）。
 *
 * 为什么要它：这个项目里已经攒了一串「不惩罚」的设计 —— 断连只记一笔不归零、
 * 删掉所有「连续 N 天未断」的徽章、搁置满 3 天静默收起。但那些都是**减法**（不罚），
 * 安息日是唯一的**加法**：主动告诉你「今天可以什么都不做」。
 * 它是「数字修行」与「数字打卡」之间唯一的产品级分界。
 *
 * 三条口径（改这里之前先读一遍）：
 *  1. **不锁功能，只免计分**：所有入口照常能进，写了就算数（痕迹完整），只是不入账。
 *     —— 免计分落在 `utils/traceLog.ts` 一处，全局生效，页面不必各自判断。
 *  2. **不催**：那天不出现「你还差几件」这类话（见 utils/weekly.ts 与各页的 isSabbath 分支）。
 *  3. **不计量**：不统计「你休了几个安息日」—— 一旦计量，它就成了另一种打卡。
 */
import { useSettingsStore } from '@/stores/settings'
import { todayKey } from '@/stores/daily'

/** 星期名（下标与 Date.getDay() 一致：0 = 周日） */
export const WEEKDAY_LABEL = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'] as const

/** 按时刻判断（traceLog 用 `at` 判，而不是"此刻"——补录的痕迹要按它自己的日子算） */
export function isSabbathAt(at = Date.now()): boolean {
  return isSabbathDay(todayKey(new Date(at)))
}

/** 按自然日键判断（'YYYY-MM-DD'） */
export function isSabbathDay(key: string): boolean {
  const s = useSettingsStore()
  if (s.sabbathWeekday === null) return false
  const d = new Date(`${key}T12:00:00`)
  if (Number.isNaN(d.getTime())) return false
  return d.getDay() === s.sabbathWeekday
}

/** 今天是不是安息日 */
export function isSabbathToday(): boolean {
  return isSabbathDay(todayKey())
}

/** 设置页展示用：'周三' / '未设' */
export function sabbathText(): string {
  const s = useSettingsStore()
  return s.sabbathWeekday === null ? '未设' : WEEKDAY_LABEL[s.sabbathWeekday] ?? '未设'
}

/**
 * 安息日的一句话（各处统一用它，别在页面里各写一版）。
 * 不写"休息是为了走更远"这类说教 —— 只陈述事实：今天不必记。
 */
export function sabbathLine(mode: 'normal' | 'tech' | 'dao'): string {
  if (mode === 'dao') return '今日安息 —— 不必记，道心自明。'
  if (mode === 'tech') return '今日安息 —— 今日数据不计入统计，样本留白。'
  return '今天是安息日 —— 什么都不必记，去生活里待着就好。'
}

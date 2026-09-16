/**
 * 第一周解锁曲线（规格 §7.3「七天解锁」+ 2026-09-15 拍板：一天只教一件事）。
 *
 * 为什么不弹「新手引导浮层」：浮层一次性看完就忘，且每个功能自己会说人话。
 * 这里改成「第一天一个主角」—— 第 N 天只在第 N 个环的大厅里，挂一条当天的任务，
 * 其余大厅不打扰。七天后（≥8 天）整套自动消失。
 *
 * 主角分布：观(1,5) / 行(2,7) / 止(3) / 知(4) / 我(6)。
 */
import type { HallId } from '@/config/lexicon'
import { ROUTES, type RoutePath } from '@/router/routes'

export type GuideHall = Extract<HallId, 'observe' | 'action' | 'pause' | 'reflect'> | 'me'

export interface DayPlan {
  /** 第几天（1-based） */
  day: number
  /** 今天的主角所在的大厅；只有在这个大厅里才挂出这条引导 */
  hall: GuideHall
  /** 主角字（观/行/止/知/我/全） */
  mark: string
  /** 一句话任务标题 */
  title: string
  /** 今天具体做的一件小事 */
  todo: string
  /**
   * 当天任务在本大厅内的落点（CSS 选择器，如 '#daily'）。
   *
   * 为什么必须有：引导卡只挂在主角大厅页里（hall === 当前页），
   * 所以点击时用户**已经站在这个大厅**——早先只做 switchTab，等于原地不动，
   * 表现就是「点了没反应」。有了锚点，点击会把当天那件事滚到眼前。
   */
  anchor?: string
  /** 当天任务落在别的页面时（理库 / 看板 / 周报 / 冲动记录）的目标页；给了就走它 */
  route?: RoutePath
}

export const FIRST_WEEK: readonly DayPlan[] = [
  { day: 1, hall: 'observe', mark: '观', title: '先读一条', todo: '读今天的「每日一则」，写一句转述 —— 哪怕只是复述也行。', anchor: '#daily' },
  { day: 2, hall: 'action', mark: '行', title: '立一件事', todo: '在「今日三件事」里写下今天最想做成的三件。', anchor: '#today' },
  { day: 3, hall: 'pause', mark: '止', title: '记一次冲动', todo: '想刷手机 / 嘴馋 / 想下单时，在「冲动记录」里记一笔，看看它什么时段来。', route: ROUTES.pauseUrge },
  { day: 4, hall: 'reflect', mark: '知', title: '第一次省察', todo: '写完今天的「灵魂拷问」，然后问自己：这条我什么时候用得上？', anchor: '#question' },
  { day: 5, hall: 'observe', mark: '观', title: '立第一条理', todo: '在「理库」里写一条你觉得成立的道理，并注明「它在什么条件下成立」。', route: ROUTES.observeTheoryLib },
  { day: 6, hall: 'me', mark: '我', title: '看一眼自己', todo: '去「修行看板」看四维雷达 —— 哪些维度还是空的，明天就从那里补。', route: ROUTES.meBoard },
  { day: 7, hall: 'action', mark: '全', title: '第一份周报', todo: '翻开「行动周报」，看这一周留下的痕迹 —— 你已经在走了。', route: ROUTES.actionWeekly },
]

/**
 * 今天是第几天（从首启日算起，1-based）。
 * 返回 0 表示「还没开始记录首启日」或「已超出第一周（≥8 天）」。
 */
export function weekDayIndex(firstLaunchAt: string, today: string): number {
  if (!firstLaunchAt) return 0
  const start = new Date(firstLaunchAt)
  if (Number.isNaN(start.getTime())) return 0
  const t = new Date(`${today}T12:00:00`)
  const diffDays = Math.round((t.getTime() - start.getTime()) / 86_400_000)
  const idx = diffDays + 1
  return idx >= 1 && idx <= 7 ? idx : 0
}

/** 今天的引导计划（无则 null） */
export function todayPlan(firstLaunchAt: string, today: string): DayPlan | null {
  const idx = weekDayIndex(firstLaunchAt, today)
  return idx ? FIRST_WEEK[idx - 1] : null
}

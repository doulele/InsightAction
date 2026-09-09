/**
 * InsightAction · 观止知行 —— 路由总表（一切页面跳转的唯一出口）
 *
 * 规则：
 *  - tabBar 的 5 个大厅页用 switchTab，普通子页用 navigateTo，跨流程重置用 reLaunch；
 *  - 大厅只做轻壳；功能子页在分包内（批次 B 起追加，路径常量仍加在此处，杜绝魔法字符串）。
 */
export const ROUTES = {
  /** Tab 0 · 观：信息大厅（启动默认页 / 主界面落点） */
  tabObserve: '/pages/observe/index',
  /** Tab 1 · 止：静修大厅 */
  tabPause: '/pages/pause/index',
  /** Tab 2 · 知：悟道大厅 */
  tabReflect: '/pages/reflect/index',
  /** Tab 3 · 行：行动大厅 */
  tabAction: '/pages/action/index',
  /** Tab 4 · 我：修行看板 */
  tabMe: '/pages/me/index',
  /** 首次流程：启动箴言页 */
  entryStartup: '/pages/entry/startup',
  /** 首次流程：模式选择页 */
  entryModeSelect: '/pages/entry/mode-select',
  /** 首次流程 / 我页：首次测评 · 6 题建档（可带 ?from=onboard 表示引导而来） */
  entryAssessment: '/pages/entry/assessment',
  /** 批次 B · 设置 */
  settings: '/pages/settings/index',
  /** 批次 B · 观：稍后读 · 碎片回收（分包 subpkg-observe） */
  observeReadLater: '/subpkg-observe/readlater/index',
  /** 批次 B · 观：信息源质量榜（分包 subpkg-observe） */
  observeQualityBoard: '/subpkg-observe/qualityboard/index',
  /** 批次 B · 观：概念播种（分包 subpkg-observe） */
  observeSeedbed: '/subpkg-observe/seedbed/index',
  /** 批次 B · 止：禅定沙漏专注计时（分包 subpkg-pause） */
  pauseSandglass: '/subpkg-pause/sandglass/index',
  /** 批次 B · 止：专注统计（分包 subpkg-pause） */
  pauseStats: '/subpkg-pause/stats/index',
  /** 批次 B · 止：静心茶室 · 五模式沉浸（分包 subpkg-pause，可带 ?room=xiang|sao|ting|yun|zhu） */
  pauseTeaHouse: '/subpkg-pause/teahouse/index',
  /** 批次 B · 止：定时入定（分包 subpkg-pause） */
  pauseSchedule: '/subpkg-pause/schedule/index',
  /** 批次 B · 止：每日定力目标 · 连胜（分包 subpkg-pause） */
  pauseStreak: '/subpkg-pause/streak/index',
  /** 批次 C · 知：知识卡片库（分包 subpkg-reflect） */
  reflectLibrary: '/subpkg-reflect/library/index',
  /** 批次 C · 知：认知成长曲线（分包 subpkg-reflect） */
  reflectGrowth: '/subpkg-reflect/growth/index',
  /** 批次 C · 行：习惯打卡（分包 subpkg-action） */
  actionHabits: '/subpkg-action/habits/index',
  /** 批次 C · 行：微行动盲盒（分包 subpkg-action） */
  actionBox: '/subpkg-action/box/index',
  /** 批次 C · 行：行动周报 · 痕迹时间轴（分包 subpkg-action） */
  actionWeekly: '/subpkg-action/weekly/index',
  /** 批次 C · 我：成就墙 · 徽章（分包 subpkg-me） */
  meAchievements: '/subpkg-me/achievements/index',
  /** 批次 C · 我：活跃日历（分包 subpkg-me） */
  meCalendar: '/subpkg-me/calendar/index',
  /** 批次 C · 我：痕迹时间轴（分包 subpkg-me，与行·周报同源） */
  meTimeline: '/subpkg-me/timeline/index',
  /** 批次 D · 我：今日日课卡（每日自动生成，转发/复制分享） */
  meDailyCard: '/subpkg-me/dailycard/index',
  /** m7 · 我：小枢羁绊（对话录 · 箴言墙，分包 subpkg-me） */
  meBond: '/subpkg-me/bond/index',
  /** m7 · 止：触发干预卡片（1-3 分钟呼吸暂停，分包 subpkg-pause） */
  pauseInterrupt: '/subpkg-pause/interrupt/index',
  /** m7 · 行：愿望清单（修为兑换现实奖励，分包 subpkg-action） */
  actionWishes: '/subpkg-action/wishes/index',
} as const

export type RoutePath = (typeof ROUTES)[keyof typeof ROUTES]

/** 路由参数：值只允许 string / number / 可省略 */
export type RouteParams = Record<string, string | number | undefined>

const TAB_PATH_SET = new Set<RoutePath>([
  ROUTES.tabObserve,
  ROUTES.tabPause,
  ROUTES.tabReflect,
  ROUTES.tabAction,
  ROUTES.tabMe,
])

/** 是否为 tabBar 大厅页 */
export function isTab(route: RoutePath): boolean {
  return TAB_PATH_SET.has(route)
}

/** 组装带 query 的完整页面路径 */
export function buildUrl(route: RoutePath, params?: RouteParams): string {
  if (!params) return route
  const query = Object.entries(params)
    .filter(([, v]) => v !== undefined && v !== '')
    .map(([k, v]) => `${k}=${encodeURIComponent(String(v))}`)
    .join('&')
  return query ? `${route}?${query}` : route
}

/**
 * 普通跳转：tab 页自动用 switchTab（uni.navigateTo 无法打开 tab 页，这里统一兜底）。
 * 组件/页面里一律 `navigateTo(ROUTES.xxx)`，不关心目标是不是 tab。
 */
export function navigateTo(route: RoutePath, params?: RouteParams): void {
  const url = buildUrl(route, params)
  if (TAB_PATH_SET.has(route)) {
    uni.switchTab({ url })
  } else {
    uni.navigateTo({ url })
  }
}

/** 跨流程重置（启动引导 → 主界面；模式切换 → 重置到大厅） */
export function reLaunchTo(route: RoutePath): void {
  uni.reLaunch({ url: buildUrl(route) })
}

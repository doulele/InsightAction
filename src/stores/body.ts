/**
 * 身体电量 store ——「行」的一环：把身体这一格也纳入四环。
 *
 * 数据边界（很重要，也决定了它在备份里的待遇）：
 *  - 步数**只存在本机**，不上传云备份（见 utils/cloudBackup.ts 的 LOCAL_ONLY_STORES）；
 *  - 本地备份文件里会有它 —— 那份文件从头到尾都在你自己的手机上。
 *
 * 为什么不自动同步：一是微信运动要在用户主动进入小程序时才刷新数据，
 * 二是冷启动就弹授权框的做法本身就惹人不快。所以这里只有手动按钮能触发读取。
 */
import { computed, ref } from 'vue'
import { defineStore } from 'pinia'
import { todayKey } from '@/stores/daily'

export interface BodyDay {
  date: string
  step: number
}

/** 柱状图用的一天：step 为 null 表示「这天没有数据」，与「这天走了 0 步」必须区分 */
export interface BodyBar {
  date: string
  step: number | null
  /** 横轴短标签（今天标「今天」，其余标月-日） */
  label: string
}

/**
 * 趋势窗口：微信运动只给最近约 31 天，所以「趋势」最多看 30 天。
 *
 * **不要**把窗口内的数写成「累计一年」之类 —— 窗口会滚动，31 天前的数据永久拿不回来，
 * 算出来的"累计"就是编数据。页面上凡是总和都必须标明窗口。
 */
export const WINDOW_DAYS = 30
/** 统计的最小样本：样本太少就不给中位数/均值，宁可空着，也不拿两天的数据充数 */
const MIN_SAMPLE = 3

/** 最近 30 天的结构读数（只摆事实，不判断好坏） */
export interface BodyInsight {
  /** 窗口内有读数的天数 */
  knownDays: number
  /** 窗口内没读到的天数 —— 诚实：可能是没带手机，不能写成"你没动" */
  missingDays: number
  /** 有读数那几天的中位数（样本 < MIN_SAMPLE 时为 null） */
  median: number | null
  /** 今天与中位数的差（今天没数据时为 null） */
  diff: number | null
  /** 工作日的日均（样本 < MIN_SAMPLE 时为 null） */
  workdayAvg: number | null
  /** 周末的日均（样本 < MIN_SAMPLE 时为 null） */
  weekendAvg: number | null
  /** 窗口内达到目标的天数 */
  hitDays: number
}

/** 默认目标：世卫口径的日常活动量级参考，**不是医嘱**，可在页面上切换 */
const DEFAULT_GOAL = 6000
/** 预设目标：四档常用值，页面另有「自定义」走 setGoal */
export const GOAL_PRESETS = [4000, 6000, 8000, 10000] as const
/** 自定义目标的合理区间：低于 1000 谈不上参照，高于 10 万已不是日常活动量 */
export const GOAL_MIN = 1000
export const GOAL_MAX = 100000

/**
 * 目标步数的短写法：满一万用 w，其余用 k。
 *
 * 为什么需要它：一行要放「4k 6k 8k 1w 自定义」五个选项，全写成 4000 这种四位数
 * 必然挤到换行。k / w 是中文语境里现成的单位口语（1w = 一万），比缩字号更好认。
 */
export function formatGoal(n: number): string {
  const v = Number(n)
  if (!Number.isFinite(v)) return '—'
  if (v >= 10000) return `${parseFloat((v / 10000).toFixed(1))}w`
  return `${parseFloat((v / 1000).toFixed(1))}k`
}
/** 本地保留天数：微信运动只给最近 31 天，多留一段是为了跨天也能看见趋势 */
const KEEP_DAYS = 60

/**
 * 静默续接的三个门槛（2026-09-21）。
 *
 * 背景：用户不会天天想起来点「同步」。所以授权过之后，进「行」大厅时自动补一次。
 * 为什么必须是这三个数：
 *  - 数据过期 ≥ 2 天才续 —— 今天同步过就没必要再打一次服务端；
 *  - 距上次尝试 ≥ 20 小时 —— 一天最多自动一次（用小时而非"自然日"，避免每天 23:59
 *    与 00:01 各触发一次）；
 *  - 连续 2 次"拉到了但数据没变新"就彻底停 —— 这条是给 `stepInfoList` 差一天那个
 *    未验证项留的退路：若真差一天，"今天永远没数据"会成立，没有这道闸会日复一日
 *    发无效请求，自己跟自己较劲。
 */
const AUTO_STALE_DAYS = 2
const AUTO_MIN_GAP_HOURS = 20
const AUTO_MAX_STRIKES = 2
/** 静默时段：这段时间不自动读（与到点提醒同一条底线） */
const QUIET_FROM_HOUR = 23
const QUIET_TO_HOUR = 6

function dateBack(offset: number): string {
  const d = new Date()
  d.setDate(d.getDate() - offset)
  return todayKey(d)
}

/** 两个日期键之间差几天（同为本地日期键，直接按零点时间戳相减） */
function daysBetween(from: string, to: string): number {
  const a = new Date(`${from}T00:00:00`).getTime()
  const b = new Date(`${to}T00:00:00`).getTime()
  if (!Number.isFinite(a) || !Number.isFinite(b)) return 0
  return Math.max(0, Math.round((b - a) / 86400000))
}

/** ISO 时间距现在几小时；空串表示从没试过 → 视为无穷久 */
function hoursSince(iso: string): number {
  if (!iso) return Number.POSITIVE_INFINITY
  const t = new Date(iso).getTime()
  if (!Number.isFinite(t)) return Number.POSITIVE_INFINITY
  return (Date.now() - t) / 3600000
}

/** 23:00–06:00 不自动读 */
function isQuietHour(): boolean {
  const h = new Date().getHours()
  return h >= QUIET_FROM_HOUR || h < QUIET_TO_HOUR
}

export const useBodyStore = defineStore(
  'body',
  () => {
    /** 日步进账：dateKey → 步数 */
    const days = ref<Record<string, number>>({})
    /** 上次同步成功的时间（ISO） */
    const lastSyncAt = ref('')
    /** 授权状态：'' 未同步过 / 'ok' 正常 / 'denied' 被拒或未授权 */
    const auth = ref('')
    /** 今日目标步数 */
    const goal = ref(DEFAULT_GOAL)
    /** 上次**尝试**续接的时间（成功失败都记）—— 用它限频，避免每次进大厅都打服务端 */
    const lastTryAt = ref('')
    /**
     * 连续"拉到了、但数据没变新"的次数。
     * 达到上限就彻底停止自动续接（详见 AUTO_MAX_STRIKES 的注释）。
     */
    const autoStrikes = ref(0)
    /** 本次尝试前的最新日期，用于判断这次到底有没有进展（不持久化，单次会话内用完即弃） */
    let tryFrom = ''

    /** 丢弃过老的日期，别让这本流水账无限长 */
    function prune(input: Record<string, number>): Record<string, number> {
      const oldest = dateBack(KEEP_DAYS - 1)
      const out: Record<string, number> = {}
      for (const [date, step] of Object.entries(input)) {
        if (date >= oldest) out[date] = step
      }
      return out
    }

    /** 写入一次同步结果（后到的同日数据覆盖先到的） */
    function record(list: BodyDay[]): void {
      if (!list?.length) return
      const next = { ...days.value }
      for (const item of list) {
        const step = Number(item?.step)
        if (!Number.isFinite(step) || step < 0) continue
        if (!item?.date) continue
        next[item.date] = Math.round(step)
      }
      days.value = prune(next)
      lastSyncAt.value = new Date().toISOString()
      auth.value = 'ok'
    }

    function markDenied(): void {
      auth.value = 'denied'
    }

    /* ---------------- 静默续接（2026-09-21） ---------------- */

    /** 开出一次尝试：限频从这里开始算，同时记下尝试前的最新日期 */
    function markTried(): void {
      lastTryAt.value = new Date().toISOString()
      tryFrom = latest.value?.date ?? ''
    }

    /**
     * 收掉一次尝试（成功失败都要调）：数据变新了就把连败清零，否则记一笔。
     * 不调它，strikes 永远不涨，那道"两次没进展就停"的闸就是摆设。
     */
    function finishTry(): void {
      const now = latest.value?.date ?? ''
      if (now && now > tryFrom) autoStrikes.value = 0
      else autoStrikes.value += 1
      tryFrom = ''
    }

    /** 最新数据距今天数（完全没有数据视为极旧） */
    const staleDays = computed(() => {
      const last = latest.value?.date
      if (!last) return AUTO_STALE_DAYS + 1
      return daysBetween(last, todayKey())
    })

    /**
     * 此刻该不该自动续接。
     *
     * 三条永不自动的情形：
     *  1. `auth !== 'ok'` —— 没授权过会弹窗（那只能由用户主动点），拒绝过就更不该再问；
     *  2. 连败触顶；
     *  3. 静默时段。
     */
    function canAutoSync(): boolean {
      if (auth.value !== 'ok') return false
      if (autoStrikes.value >= AUTO_MAX_STRIKES) return false
      if (staleDays.value < AUTO_STALE_DAYS) return false
      if (hoursSince(lastTryAt.value) < AUTO_MIN_GAP_HOURS) return false
      return !isQuietHour()
    }

    /**
     * 改今日目标（预设档与自定义都走这里）。
     * 区间外的数一律拒绝并交给页面提示 —— 目标写成 30 步，电量永远是满的，那不是目标。
     */
    function setGoal(n: number): boolean {
      const v = Math.round(Number(n))
      if (!Number.isFinite(v) || v < GOAL_MIN || v > GOAL_MAX) return false
      goal.value = v
      return true
    }

    /** 最新一天的数据（可能是昨天） */
    const latest = computed<BodyDay | null>(() => {
      const keys = Object.keys(days.value).sort()
      if (!keys.length) return null
      const date = keys[keys.length - 1]
      return { date, step: days.value[date] }
    })

    /** 今天走到哪了 —— 今天还没同步就是 null（不是 0：0 是「今天一步没走」） */
    const todayStep = computed<number | null>(() => {
      const v = days.value[todayKey()]
      return typeof v === 'number' ? v : null
    })

    /** 最新数据是不是今天的 */
    const hasToday = computed(() => todayStep.value !== null)

    /** 电量百分比（相对目标，封顶 100） */
    const pct = computed(() => {
      if (todayStep.value === null) return 0
      return Math.min(100, Math.round((todayStep.value / Math.max(1, goal.value)) * 100))
    })

    /**
     * 已知的最近 n 天（含无数据的空槽，避免「没有 = 走了 0 步」的假象）。
     * 抽成函数是为了让七天柱与三十天柱共用同一套取数与标签口径 —— 两处各写一份必然分叉。
     */
    function recentDays(n: number): BodyBar[] {
      const today = todayKey()
      const out: BodyBar[] = []
      for (let i = n - 1; i >= 0; i--) {
        const date = dateBack(i)
        const v = days.value[date]
        out.push({
          date,
          step: typeof v === 'number' ? v : null,
          label: date === today ? '今天' : date.slice(5).replace('-', '/'),
        })
      }
      return out
    }

    /** 页面主视图：最近七天 */
    const recent = computed<BodyBar[]>(() => recentDays(7))
    /** 趋势视图：最近三十天（微信只给约 31 天，这是能拿到的最长窗口） */
    const bars30 = computed<BodyBar[]>(() => recentDays(WINDOW_DAYS))

    /** 柱状图的相对高度基准：用这 7 天里的最高值与目标值取大者，避免满屏顶格 */
    const barMax = computed(() => {
      const peak = recent.value.reduce((m, d) => Math.max(m, d.step ?? 0), 0)
      return Math.max(peak, goal.value)
    })

    /** 三十天柱的相对高度基准：只按这 30 天的峰值归一，不掺目标值（否则整排都被压扁） */
    const peak30 = computed(() => bars30.value.reduce((m, d) => Math.max(m, d.step ?? 0), 0))

    /** 留下过读数的天数（徽章与「只跟自己比」共用，别再各算一份） */
    const readDays = computed(() => Object.keys(days.value).length)

    /**
     * 达到过目标的天数（不要求连续、不要求是最近）。
     * 用的是**当前**目标算历史 —— 目标本来就可以随时改，这里对的是"今天的你"，
     * 所以不必（也没法）追溯历史上的目标值。
     */
    const goalHitCount = computed(() => {
      const g = Math.max(1, goal.value)
      let n = 0
      for (const step of Object.values(days.value)) if (step >= g) n += 1
      return n
    })

    /**
     * 最近 30 天的结构读数。三条口径都是为「只摆事实、不下结论」：
     *  1. **中位数**而非平均数 —— 一天暴走会把均值整个拉偏，中位数才是"你通常的样子"；
     *  2. **工作日 / 周末分开** —— 只跟自己的另一段日子比，不跟达标线比、更不跟别人比；
     *  3. **没读到的天数如实报** —— 那是"没数据"，不是"走了 0 步"。
     */
    const insight = computed<BodyInsight>(() => {
      const window = bars30.value
      const known = window.filter((d) => d.step !== null) as { date: string; step: number }[]
      const g = Math.max(1, goal.value)
      const hits = known.reduce((n, d) => (d.step >= g ? n + 1 : n), 0)

      const sorted = known.map((d) => d.step).sort((a, b) => a - b)
      const median = sorted.length >= MIN_SAMPLE ? sorted[Math.floor(sorted.length / 2)] : null

      const weekend = known.filter((d) => {
        const dow = new Date(`${d.date}T00:00:00`).getDay()
        return dow === 0 || dow === 6
      })
      const workday = known.filter((d) => !weekend.includes(d))
      const avg = (list: { step: number }[]): number | null =>
        list.length >= MIN_SAMPLE ? Math.round(list.reduce((s, d) => s + d.step, 0) / list.length) : null

      return {
        knownDays: known.length,
        missingDays: window.length - known.length,
        median,
        diff: todayStep.value !== null && median !== null ? todayStep.value - median : null,
        workdayAvg: avg(workday),
        weekendAvg: avg(weekend),
        hitDays: hits,
      }
    })

    return {
      days,
      lastSyncAt,
      lastTryAt,
      autoStrikes,
      auth,
      goal,
      record,
      markDenied,
      markTried,
      finishTry,
      canAutoSync,
      setGoal,
      latest,
      todayStep,
      hasToday,
      pct,
      staleDays,
      recent,
      bars30,
      barMax,
      peak30,
      readDays,
      goalHitCount,
      insight,
    }
  },
  {
    persist: {
      key: 'body',
      paths: ['days', 'lastSyncAt', 'lastTryAt', 'autoStrikes', 'auth', 'goal'],
    },
  },
)

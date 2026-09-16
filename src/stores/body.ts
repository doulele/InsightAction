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

/** 默认目标：世卫口径的日常活动量级参考，**不是医嘱**，可在页面上切换 */
const DEFAULT_GOAL = 6000
/** 本地保留天数：微信运动只给最近 31 天，多留一段是为了跨天也能看见趋势 */
const KEEP_DAYS = 60

function dateBack(offset: number): string {
  const d = new Date()
  d.setDate(d.getDate() - offset)
  return todayKey(d)
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

    /** 已知的最近 7 天（含无数据的空槽，避免「没有 = 走了 0 步」的假象） */
    const recent = computed<BodyBar[]>(() => {
      const today = todayKey()
      const out: BodyBar[] = []
      for (let i = 6; i >= 0; i--) {
        const date = dateBack(i)
        const v = days.value[date]
        out.push({
          date,
          step: typeof v === 'number' ? v : null,
          label: date === today ? '今天' : date.slice(5).replace('-', '/'),
        })
      }
      return out
    })

    /** 柱状图的相对高度基准：用这 7 天里的最高值与目标值取大者，避免满屏顶格 */
    const barMax = computed(() => {
      const peak = recent.value.reduce((m, d) => Math.max(m, d.step ?? 0), 0)
      return Math.max(peak, goal.value)
    })

    return { days, lastSyncAt, auth, goal, record, markDenied, latest, todayStep, hasToday, pct, recent, barMax }
  },
  {
    persist: {
      key: 'body',
      paths: ['days', 'lastSyncAt', 'auth', 'goal'],
    },
  },
)

/**
 * useBuddy —— 小枢全局浮层（批次 D）的单例状态与触发逻辑。
 *
 * 为什么做成模块级单例而非组件内状态：
 *  - 小程序端 onShow 等页面生命周期只在页面触发、不可靠地落在子组件里；
 *  - 5 个 tab 大厅都会挂 <BuddyFloat />，把状态收敛到一份，由各页自身的
 *    onShow → poke() 驱动（页面切到前台即评估一次），避免重复提醒与实例不同步。
 *
 * 能力：
 *  1. 到点激励：早间窗 06-08 / 晚间窗 21-23，同一自然日的同一窗口只问候一次（本地节流）；
 *  2. 入定到点：reminder store 中「开启且覆盖当前时间」的时段 → 弹「该去翻转沙漏」，10 分钟节流；
 *  3. 展开面板：今日四维 + 缺维建议 + 打开今日日课卡。
 * 纯本地、无后端依赖；AI 对话等留待后端期。
 */
import { computed, ref } from 'vue'
import { useModeStore } from '@/stores/mode'
import { useReminderStore } from '@/stores/reminder'
import { useDailyStore, todayKey } from '@/stores/daily'
import { useSettingsStore } from '@/stores/settings'
import { useQuestionStore } from '@/stores/question'
import { dayStats } from '@/utils/growth'
import { getItem, setItem } from '@/utils/storage'
import { navigateTo, ROUTES } from '@/router/routes'

const modeStore = useModeStore()
const reminderStore = useReminderStore()
const settings = useSettingsStore()
const question = useQuestionStore()
const daily = useDailyStore()

const open = ref(false)

export interface BuddyDim {
  key: 'observe' | 'pause' | 'reflect' | 'action'
  label: string
  value: string
  on: boolean
  color: string
}

type TipKind = 'window' | 'reminder'
interface Tip {
  kind: TipKind
  title: string
  text: string
}

/* ---------------- 形态（随三模式） ---------------- */
export const buddyGlyph = computed(() => (modeStore.id === 'tech' ? '枢' : modeStore.id === 'dao' ? '灵' : '伴'))
export const assistantName = computed(() => modeStore.meta.assistantName)
export const modeLabel = computed(() => modeStore.meta.label)

/* ---------------- 今日四维 ---------------- */
const st = computed(() => dayStats(todayKey()))

export const dims = computed<BuddyDim[]>(() => {
  const done = daily.doneCount
  const plan = daily.planCount || 3
  return [
    { key: 'observe', label: '观 · 辨源', value: `${st.value.marks} 次`, on: st.value.marks > 0, color: '#6D8B3F' },
    { key: 'pause', label: '止 · 静修', value: `${st.value.focusMin} 分`, on: st.value.focusMin > 0, color: '#C4602E' },
    {
      key: 'reflect',
      label: '知 · 产出',
      value: `${st.value.cards} 卡`,
      on: st.value.cards > 0 || st.value.answered,
      color: '#4E8FD4',
    },
    { key: 'action', label: '行 · 完成', value: `${done}/${plan} 件`, on: done > 0, color: '#7AA0B2' },
  ]
})

export const litCount = computed(() => dims.value.filter((d) => d.on).length)

const missing = computed<BuddyDim | null>(() => dims.value.find((d) => !d.on) ?? null)

export const missingLabel = computed(() =>
  missing.value
    ? { observe: '去观大厅', pause: '去止大厅', reflect: '去知大厅', action: '去行大厅' }[missing.value.key]
    : '',
)

export const suggestion = computed(() => {
  const m = missing.value
  if (m) {
    const hints: Record<BuddyDim['key'], string> = {
      observe: '今天还没读过什么——去观一条真正值得的信息。',
      pause: '定力尚未入账——翻转 5 分钟沙漏，给今天一刻安静。',
      reflect: '今天还没有产出——写下此刻最想记住的一句话。',
      action: '「三件事」还没完成——挑最小的一件先做。',
    }
    return hints[m.key]
  }
  if (litCount.value === 0) return '一切都还来得及：从最小的观开始，让今天留下痕迹。'
  if (modeStore.id === 'dao') return '观止知行四维齐整，道心稳固，明日再进一阶。'
  if (modeStore.id === 'tech') return '四维全部点亮，今日曲线漂亮。'
  return '观止知行都走了一遍，今天没有辜负。'
})

/* ---------------- 到点激励（早/晚窗，同窗一次） ---------------- */
type WinKey = `${string}-m` | `${string}-e`

function winKeyOf(): WinKey | null {
  const d = new Date()
  const m = d.getHours() * 60 + d.getMinutes()
  if (m >= 360 && m < 480) return `${todayKey()}-m`
  if (m >= 1260 && m < 1380) return `${todayKey()}-e`
  return null
}

interface Greeting {
  title: string
  text: string
}

/** 「行」未完的守护话术（断连守护 / 晚窗个性化复用） */
function streakText(remain: number): string {
  if (modeStore.id === 'dao') return `今日「三件事」还差 ${remain} 件未了——了了它，今日闭环。`
  if (modeStore.id === 'tech') return `进度缺口：今日「三件事」未完成 ${remain} 件。`
  return `今天还有 ${remain} 件事没有完成——挑最要紧的那件，收个尾。`
}

/**
 * 窗口问候体：
 * 早窗固定（晨间激励）；晚窗按设置个性化——
 * 开了「晚课提醒」且今日拷问未答 → 提醒写答案；
 * 开了「断连守护」且三件事未完 → 提醒收尾；否则晚间结算。
 */
function windowGreeting(win: WinKey): Greeting {
  if (win.endsWith('-m')) {
    return {
      title: modeStore.id === 'dao' ? '晨钟' : modeStore.id === 'tech' ? '晨间任务' : '晨间问候',
      text:
        modeStore.id === 'dao'
          ? '晨露未干，道心先醒——把今天最重要的一件事安顿好。'
          : modeStore.id === 'tech'
            ? '数据已归零，今日曲线从你第一次投入开始。'
            : '新的一天，先把最重要的一件安顿好，再往下走。',
    }
  }

  const answered = Boolean(question.records[todayKey()]?.answer)
  const remain = Math.max(0, (daily.planCount || 3) - daily.doneCount)

  if (settings.eveningRemind && !answered) {
    return {
      title: '晚课提醒',
      text:
        modeStore.id === 'dao'
          ? '今夜功课未答——去知厅写下今天的一句话，再歇。'
          : modeStore.id === 'tech'
            ? '待办未完成：今日拷问未答，别让样本缺失。'
            : '灵魂拷问还空着——去知厅写下今天的答案，再休息。',
    }
  }
  if (settings.streakRemind && remain > 0) {
    return { title: '断连守护', text: streakText(remain) }
  }
  return {
    title: modeStore.id === 'dao' ? '暮鼓' : modeStore.id === 'tech' ? '晚间结算' : '晚间问候',
    text:
      modeStore.id === 'dao'
        ? '暮鼓已敲，收摄心神——今日之业今日了，莫带牵挂入眠。'
        : modeStore.id === 'tech'
          ? '今日样本已收集，睡前结算一次：明天从哪一维开始？'
          : '一天将尽，留十分钟给自己，不必再赶路。',
  }
}

export const greeting = computed(() => {
  const win = winKeyOf()
  if (win) return windowGreeting(win).text
  return modeStore.id === 'dao' ? '道心常明，行止有度。' : modeStore.id === 'tech' ? '状态在线，曲线待你刻画。' : '慢慢来，比较快。'
})

/* ---------------- 小枢羁绊：对话录 / 箴言墙（纯本地，m7 批次） ----------------
 * 记录与「小枢」的每一次见面与问候 → 羁绊等级 Lv.1-20 随见面次数渐进；
 * 任一对话可收藏进「箴言墙」。全部数据本机留存，云端同步留待登录期。
 */
export type BuddyLineKind = 'greet' | 'guard' | 'remind' | 'meet'

export interface BuddyLine {
  /** 时间戳 */
  at: number
  kind: BuddyLineKind
  text: string
}

const LINES_KEY = 'buddy-lines'
const FAVS_KEY = 'buddy-favs'
const LINES_CAP = 400
const FAVS_CAP = 99

const lines = ref<BuddyLine[]>(getItem<BuddyLine[]>(LINES_KEY, []) ?? [])
const favs = ref<BuddyLine[]>(getItem<BuddyLine[]>(FAVS_KEY, []) ?? [])

/** 记一次见面/对话（新在前，超出上限丢最旧） */
function recordLine(kind: BuddyLineKind, text: string): void {
  lines.value.unshift({ at: Date.now(), kind, text })
  if (lines.value.length > LINES_CAP) lines.value = lines.value.slice(0, LINES_CAP)
  setItem(LINES_KEY, lines.value)
}

const favId = (l: BuddyLine): string => `${l.kind}:${l.text}`

export const isFav = (l: BuddyLine): boolean => favs.value.some((f) => favId(f) === favId(l))

/** 收藏 / 取消收藏一句话（kind+内容相同即视为同一条，箴言墙去重） */
export function toggleFav(line: BuddyLine): void {
  const id = favId(line)
  const hit = favs.value.findIndex((f) => favId(f) === id)
  if (hit >= 0) {
    favs.value.splice(hit, 1)
    uni.showToast({ title: '已移出箴言墙', icon: 'none' })
  } else {
    favs.value.unshift(line)
    if (favs.value.length > FAVS_CAP) favs.value = favs.value.slice(0, FAVS_CAP)
    uni.showToast({ title: '已收进箴言墙', icon: 'none' })
  }
  setItem(FAVS_KEY, favs.value)
}

/* 羁绊称谓（20 级，跨模式通用：小枢是同一位的修行同伴） */
export const BOND_NAMES = [
  '初遇', '相识', '常伴', '相谈', '投契', '知心', '默契', '同行', '共勉', '同频',
  '心照', '莫逆', '深交', '灵犀', '无间', '神交', '道合', '金兰', '同修', '一心',
] as const

/** 升级所需的累计见面数（下标=级数-1） */
const BOND_NEED = [
  0, 4, 9, 15, 22, 30, 40, 52, 66, 82, 100, 120, 142, 166, 192, 220, 250, 282, 316, 352,
]

export const bondXp = computed(() => lines.value.length)
export const bondLv = computed(() => {
  let lv = 1
  for (let i = 0; i < BOND_NEED.length; i++) {
    if (bondXp.value >= BOND_NEED[i]) lv = i + 1
  }
  return Math.min(20, lv)
})
export const bondLvName = computed(() => BOND_NAMES[bondLv.value - 1] ?? '一心')
export const bondPct = computed(() => {
  const lv = bondLv.value
  const prev = BOND_NEED[lv - 1] ?? 0
  const next = BOND_NEED[lv] ?? prev
  return Math.min(100, Math.round(((bondXp.value - prev) / Math.max(1, next - prev)) * 100))
})
export const bondNextGap = computed(() => {
  const next = BOND_NEED[bondLv.value]
  return next === undefined ? 0 : Math.max(0, next - bondXp.value)
})

/** 把当前面板那句收进箴言墙（见面语） */
export function favGreeting(): void {
  toggleFav({ at: Date.now(), kind: 'meet', text: greeting.value })
}

/* ---------------- 入定到点 ---------------- */
const pad = (n: number): string => String(n).padStart(2, '0')

interface DueReminder {
  id: number
  hour: number
  minute: number
}

function nowMin(): number {
  const d = new Date()
  return d.getHours() * 60 + d.getMinutes()
}

/** 正在生效的入定时段（随 poke 更新快照，避免组件里跑时钟） */
const due = ref<DueReminder | null>(null)

const REMINDER_PING_KEY = 'buddy-reminder-ping'
const WINDOW_GREET_KEY = 'buddy-window-greet'
const STREAK_GREET_KEY = 'buddy-streak-greet'

export const tip = ref<Tip | null>(null)

export const openPanel = (): void => {
  /* 每次打开面板 = 一次「见面」，记入对话录并推进羁绊 */
  if (!open.value) recordLine('meet', greeting.value)
  open.value = true
}

export const closePanel = (): void => {
  open.value = false
}

export const dismissTip = (): void => {
  tip.value = null
}

export function goSandglass(): void {
  tip.value = null
  setItem(REMINDER_PING_KEY, Date.now())
  navigateTo(ROUTES.pauseSandglass)
}

export function openDailyCard(): void {
  open.value = false
  navigateTo(ROUTES.meDailyCard)
}

export function goMissing(): void {
  const m = missing.value
  const target = m
    ? {
        observe: ROUTES.tabObserve,
        pause: ROUTES.tabPause,
        reflect: ROUTES.tabReflect,
        action: ROUTES.tabAction,
      }[m.key]
    : ROUTES.tabMe
  open.value = false
  navigateTo(target)
}

/* ---------------- 供页面 onShow 调用的总入口 ---------------- */
export function poke(): void {
  maybeGreetWindow()
  refreshDue()
  maybePingReminder()
}

/** 早/晚窗口问候：同窗只弹一次；晚窗话术按设置个性化 */
function maybeGreetWindow(): void {
  const win = winKeyOf()
  if (win) {
    const last = getItem<string>(WINDOW_GREET_KEY, '') ?? ''
    if (last === win) return
    setItem(WINDOW_GREET_KEY, win)
    const g = windowGreeting(win)
    tip.value = { kind: 'window', title: g.title, text: g.text }
    recordLine('greet', g.text)
    return
  }

  /* 断连守护（17:00-21:00 的早守窗口）：每天一次轻提醒，晚了交给晚窗个性化 */
  const h = new Date().getHours()
  if (!settings.streakRemind || h < 17 || h >= 21) return
  const remain = Math.max(0, (daily.planCount || 3) - daily.doneCount)
  if (remain <= 0) return
  const last = getItem<string>(STREAK_GREET_KEY, '') ?? ''
  const k = todayKey()
  if (last === k) return
  setItem(STREAK_GREET_KEY, k)
  tip.value = { kind: 'window', title: '断连守护', text: streakText(remain) }
  recordLine('guard', streakText(remain))
}

/** 刷新「正在生效的入定时段」快照 */
function refreshDue(): void {
  const now = nowMin()
  const r = reminderStore.reminders.find((it) => {
    if (!it.enabled) return false
    const s = it.hour * 60 + it.minute
    return now >= s && now < s + it.minutes
  })
  due.value = r ? { id: r.id, hour: r.hour, minute: r.minute } : null
  // 时段已过：把挂着的入定提醒收掉
  if (!due.value && tip.value?.kind === 'reminder') tip.value = null
}

/** 入定到点：时段生效时每 10 分钟至多提醒一次 */
function maybePingReminder(): void {
  if (!due.value) return
  const now = Date.now()
  const last = getItem<number>(REMINDER_PING_KEY, 0) ?? 0
  if (now - last < 10 * 60 * 1000) return
  const title =
    modeStore.id === 'dao'
      ? `入定时辰已到（${pad(due.value.hour)}:${pad(due.value.minute)}）`
      : modeStore.id === 'tech'
        ? '定时任务触发：该专注了'
        : '你约好的静修时间到了'
  const text = modeStore.id === 'dao' ? '这一程约好了自己——现在去翻转沙漏。' : '走完一段沙漏，今日定力入账。'
  tip.value = { kind: 'reminder', title, text }
  recordLine('remind', `${title}｜${text}`)
}

/** 供页面模板读的公开项 */
export function useBuddy() {
  return {
    open,
    tip,
    due,
    buddyGlyph,
    assistantName,
    modeLabel,
    greeting,
    dims,
    litCount,
    missingLabel,
    suggestion,
    lines,
    favs,
    bondXp,
    bondLv,
    bondLvName,
    bondPct,
    bondNextGap,
    isFav,
    toggleFav,
    favGreeting,
    poke,
    openPanel,
    closePanel,
    dismissTip,
    goSandglass,
    goMissing,
    openDailyCard,
  }
}

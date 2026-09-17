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
 * 纯本地、无后端依赖。AI 对话未做（不是缺后端，是产品上没定，见 docs/观止知行-未做事项.md）。
 */
import { computed, ref } from 'vue'
import { useModeStore } from '@/stores/mode'
import { useReminderStore } from '@/stores/reminder'
import { useDailyStore, todayKey } from '@/stores/daily'
import { useSettingsStore } from '@/stores/settings'
import { useQuestionStore } from '@/stores/question'
import {
  useProverbStore,
  parseQuote,
  REVIEW_DAYS,
  type ProverbItem,
  type ProverbSource,
} from '@/stores/proverb'
import { useTraceStore } from '@/stores/trace'
import { useXpStore } from '@/stores/xp'
import { useCapsuleStore } from '@/stores/capsule'
import { useKnowledgeStore } from '@/stores/knowledge'
import { isSabbathToday, sabbathLine } from '@/utils/sabbath'
import { LEVEL_NAMES, LEVEL_THRESHOLDS, levelIndexFromXp } from '@/config/levels'
import {
  BODY_NAMES,
  FORM_STAGES,
  HALL_DUTY,
  nextStage,
  stageFromLevel,
  stageName,
  type FormStage,
} from '@/config/buddyForms'
import type { HallId } from '@/config/lexicon'
import { dayStats } from '@/utils/growth'
import { getItem, setItem } from '@/utils/storage'
import { navigateTo, ROUTES } from '@/router/routes'
import { useDimLabel } from '@/composables/usePhrase'

const modeStore = useModeStore()
const reminderStore = useReminderStore()
const settings = useSettingsStore()
const question = useQuestionStore()
const daily = useDailyStore()
/** 结算与四维最高项读真实痕迹流；境界进度读修为 store */
const traceStore = useTraceStore()
const xp = useXpStore()

/** 四维标签（与各大厅同一套取词：符号固定，职能词随模式） */
const dl = useDimLabel()

const open = ref(false)

export interface BuddyDim {
  key: 'observe' | 'pause' | 'reflect' | 'action'
  label: string
  value: string
  on: boolean
  color: string
}

/** window=到点激励；reminder=入定时段；guard=守护理由（断连守护 / 心魔预警 / 止念） */
type TipKind = 'window' | 'reminder' | 'guard'
interface Tip {
  kind: TipKind
  title: string
  text: string
}

/* ---------------- 形态（随三模式） ---------------- */
export const buddyGlyph = computed(() => (modeStore.id === 'tech' ? '枢' : modeStore.id === 'dao' ? '灵' : '伴'))
export const assistantName = computed(() => modeStore.meta.assistantName)
export const modeLabel = computed(() => modeStore.meta.label)

/* ---------------- 形阶（★成长体系：小枢随修为一起长） ----------------
 * 形阶由**修为等级**（9 级）折成 4 阶，各模式的阶名不同（普通=光团/光晕/花影/树影…）。
 * 这一维只决定「长什么样」——每阶比上一阶**多**一层装饰（素/纹/光/器），
 * 具体样式在 BuddyFloat.scss 的 .tier-N，这里只给出"现在是第几阶、叫什么、还差多少"。
 */
const levelIdx = computed(() => levelIndexFromXp(xp.levelXp))

export const buddyStage = computed<FormStage>(() => stageFromLevel(levelIdx.value))
export const buddyStageName = computed(() => stageName(buddyStage.value, modeStore.id))
/** 装饰层数，模板据此决定渲染几层（0 素 / 1 纹 / 2 光 / 3 器） */
export const buddyTier = computed(() => buddyStage.value.tier)
/** 本体名（纸印 / 面板 / 道印），与形阶正交 */
export const buddyBodyName = computed(() => BODY_NAMES[modeStore.id] ?? BODY_NAMES.normal)
export const buddyStageNote = computed(() => buddyStage.value.note)
export const buddyNextStageName = computed(() => {
  const next = nextStage(buddyStage.value)
  return next ? stageName(next, modeStore.id) : ''
})
/** 距下一形阶还差多少修为（已至四阶返回 0），与「我」页的境界进度同一口径 */
export const buddyStageGap = computed(() => {
  const next = nextStage(buddyStage.value)
  if (!next) return 0
  const need = LEVEL_THRESHOLDS[next.from] ?? 0
  return Math.max(0, need - xp.levelXp)
})

/** 形态谱（羁绊页展示用）：四阶 + 是否已到 + 各自的解锁门槛 */
export interface StageView {
  idx: number
  ordinal: string
  name: string
  /** 该阶起始的境界名（如「抽枝」）；第一阶为初始，展示层自己转成"初始" */
  from: string
  /** 已到达 */
  on: boolean
  /** 当前所处 */
  cur: boolean
}

export const buddyStages = computed<StageView[]>(() => {
  const names = LEVEL_NAMES[modeStore.id] ?? LEVEL_NAMES.normal
  const now = buddyStage.value.idx
  return FORM_STAGES.map((s) => ({
    idx: s.idx,
    ordinal: s.ordinal,
    name: stageName(s, modeStore.id),
    from: names[s.from] ?? '',
    on: s.idx <= now,
    cur: s.idx === now,
  }))
})

/* ---------------- 职司（★分模块：在哪个大厅，小枢手里拿着什么） ----------------
 * 大厅判据取自**当前页面路由**（getCurrentPages 末位），不要求各页传参：
 * 五个 tab 大厅的 onShow 都已经在调 poke()，在 poke 里顺手刷一次即可，
 * 不用改任何一个页面 —— 少一处改动就少一处忘改。
 */
const HALL_BY_ROUTE: Record<string, HallId> = {
  'pages/observe/index': 'observe',
  'pages/pause/index': 'pause',
  'pages/reflect/index': 'reflect',
  'pages/action/index': 'action',
}

/** 当前所在大厅（不在四个大厅里则为 null：如「我」页、各子页、开屏） */
const hall = ref<HallId | null>(null)

function refreshHall(): void {
  const pages = getCurrentPages()
  const cur = pages[pages.length - 1]
  const route = cur ? cur.route : ''
  hall.value = (route && HALL_BY_ROUTE[route]) || null
}

/** 职司印（无职司时为 null，模板据此不渲染角印） */
export const buddyDuty = computed(() => (hall.value ? HALL_DUTY[hall.value] : null))

/* ---------------- 今日四维 ---------------- */
const st = computed(() => dayStats(todayKey()))

export const dims = computed<BuddyDim[]>(() => {
  const done = daily.doneCount
  const plan = daily.planCount || 3
  return [
    { key: 'observe', label: dl('observe'), value: `${st.value.marks} 次`, on: st.value.marks > 0, color: '#6D8B3F' },
    { key: 'pause', label: dl('pause'), value: `${st.value.focusMin} 分`, on: st.value.focusMin > 0, color: '#C4602E' },
    {
      key: 'reflect',
      label: dl('reflect'),
      value: `${st.value.cards} 卡`,
      on: st.value.cards > 0 || st.value.answered,
      color: '#4E8FD4',
    },
    { key: 'action', label: dl('action'), value: `${done}/${plan} 件`, on: done > 0, color: '#7AA0B2' },
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
  /* 安息日：不点缺维、不劝补 —— 那天唯一该说的话就是"今天不必" */
  if (silentToday()) return sabbathLine(modeStore.id)
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
export type BuddyLineKind = 'greet' | 'guard' | 'remind' | 'meet' | 'proverb'

export interface BuddyLine {
  /** 时间戳 */
  at: number
  kind: BuddyLineKind
  text: string
  /** 箴言墙视图专用：收藏项主键（用于精确移除） */
  id?: number
}

const LINES_KEY = 'buddy-lines'
const LINES_CAP = 400

const lines = ref<BuddyLine[]>(getItem<BuddyLine[]>(LINES_KEY, []) ?? [])

/* 收藏统一落在 proverb store（可备份、可同步、字段完整）；这里是它的「对话录视角」 */
const proverbs = useProverbStore()

/** 记一次见面/对话（新在前，超出上限丢最旧） */
function recordLine(kind: BuddyLineKind, text: string): void {
  lines.value.unshift({ at: Date.now(), kind, text })
  if (lines.value.length > LINES_CAP) lines.value = lines.value.slice(0, LINES_CAP)
  setItem(LINES_KEY, lines.value)
}

/** 对话录的一行 → 收藏入参（把「正文」——「出处」拆开存结构化） */
function toFavInput(l: BuddyLine): { text: string; from?: string; source: ProverbSource; at: number } {
  const p = parseQuote(l.text)
  return {
    text: p.text,
    from: p.from,
    source: l.kind === 'proverb' ? 'startup' : 'buddy',
    at: l.at,
  }
}

/** 箴言墙：proverb store 的对话录视图（新在前，带 id 便于精确移除） */
const favs = computed<BuddyLine[]>(() =>
  proverbs.items.map((it) => ({
    id: it.id,
    at: it.createdAt,
    kind: it.source === 'startup' ? ('proverb' as BuddyLineKind) : ('meet' as BuddyLineKind),
    text: it.from ? `「${it.text}」 —— ${it.from}` : it.text,
  })),
)

export const isFav = (l: BuddyLine): boolean => {
  if (l.id !== undefined) return proverbs.items.some((it) => it.id === l.id)
  const inp = toFavInput(l)
  return proverbs.has(inp.text, inp.source)
}

/**
 * 收藏 / 取消收藏一句话（kind+内容相同即视为同一条，箴言墙去重）。
 * silent=true 时不弹 toast——调用方想用自己的文案时用（如开屏页「记住这句」）。
 * 返回收藏后的状态：true=已收藏，false=已移除。
 */
export function toggleFav(line: BuddyLine, silent = false): boolean {
  const known = line.id !== undefined && proverbs.items.some((it) => it.id === line.id)
  const on = known ? ((proverbs.remove(line.id as number), false)) : proverbs.add(toFavInput(line)) !== null
  if (!silent) uni.showToast({ title: on ? '已收进箴言墙' : '已移出箴言墙', icon: 'none' })
  return on
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

/* ---------------- 箴言引用：小枢提一句你记住的话 ---------------- */
/**
 * 面板里带一句你记住的句子：优先今天到期回响的那句（它今天本就该再见一次）。
 * 一句都没记住就不出现 —— 不硬凑一句来显得贴心。
 */
export const remembered = computed<ProverbItem | null>(() => proverbs.dueReviews[0] ?? proverbs.items[0] ?? null)
export const rememberedLabel = computed(() => {
  const due = proverbs.dueReviews[0]
  if (!remembered.value) return ''
  return due ? `今天该见它 · 第 ${Math.min(due.reviewCount + 1, REVIEW_DAYS.length)} 次` : '你记住的'
})

export function goProverbs(): void {
  open.value = false
  navigateTo(ROUTES.meProverbs)
}

/* ---------------- 递话（2026-09-17）：把「到期的东西」递到眼前 ----------------
 * 个人主体拿不到微信推送（长期订阅只对线下公共服务开放，见 docs/观止知行-未做事项.md #1），
 * 所以"回来"这件事只能靠打开小程序那一刻：把该见的东西递给他，一次只递一条。
 *
 * 排序按「错过就有损失」：到期的胶囊（它等了 N 天）> 今天该重逢的旧卡。
 * 两条都没有就不出现 —— 不硬凑一句话来显得贴心（与箴言引用同一口径）。
 */
export interface Handoff {
  key: 'capsule' | 'echo'
  label: string
  text: string
  go: () => void
}

const capsules = useCapsuleStore()
const knowledge = useKnowledgeStore()

export const handoff = computed<Handoff | null>(() => {
  const cap = capsules.dueList[0]
  if (cap) {
    return {
      key: 'capsule',
      label: '有一条胶囊到期了 —— 给你的',
      text: '去拆开看看',
      go: () => {
        open.value = false
        navigateTo(ROUTES.meCapsule)
      },
    }
  }
  const card = knowledge.dueEcho
  if (card) {
    return {
      key: 'echo',
      label: '今天该重看一张旧卡',
      text: card.title,
      go: () => {
        open.value = false
        navigateTo(ROUTES.reflectEcho)
      },
    }
  }
  return null
})

/** 安息日那天小枢不说话：不问候、不催、不结算（见 utils/sabbath.ts 的口径 2） */
function silentToday(): boolean {
  return isSabbathToday()
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

/* ---------------- 心魔预警 / 止念：停留过久且无互动 ---------------- */

/** 停留阈值：5 分钟（规格 §3 小枢能力 2「在【观】停留 >5 分钟无互动」） */
export const DWELL_MS = 5 * 60 * 1000

const DWELL_KEEP_KEY = 'buddy-dwell'

/**
 * 在某个大厅停留过久 → 小枢气泡把人拉走。
 * 同一天同一大厅只提醒一次（本地节流），且只在用户真的「停在那儿不动」时由页面计时器触发。
 */
export function dwellTip(hall: 'observe' | 'reflect'): void {
  const key = `${todayKey()}-${hall}`
  const last = getItem<string>(DWELL_KEEP_KEY, '') ?? ''
  if (last === key) return
  setItem(DWELL_KEEP_KEY, key)

  const texts: Record<'observe' | 'reflect', { title: string; text: string }> = {
    observe: {
      title: '心魔预警',
      text: '在「观」里停了五分钟没动 —— 别让它变成刷。去「止」坐一会儿，把注意力收回来。',
    },
    reflect: {
      title: '止念',
      text: '写得够多了。停笔，去「行」里用一次 —— 用过的才算你的。',
    },
  }
  const t = texts[hall]
  tip.value = { kind: 'guard', title: t.title, text: t.text }
  recordLine('guard', `${t.title}｜${t.text}`)
}

/* ---------------- 每日结算（23:00 后首次打开，全屏一次） ---------------- */

/**
 * 结算浮层开关。为什么放在 23:00 之后：
 * 21-23 点已经有「晚间问候」气泡（见 maybeGreetWindow），再弹一个全屏会变成两次打扰；
 * 23 点后晚窗结束，正好把这一天收个尾。
 */
export const settleOpen = ref(false)

const SETTLE_KEY = 'buddy-settle'

function maybeSettle(): void {
  if (settleOpen.value) return
  /* 安息日不结算：那天"什么都没入账"是正常的，不该被总结成一句亏欠 */
  if (silentToday()) return
  if (new Date().getHours() < 23) return
  const key = todayKey()
  if ((getItem<string>(SETTLE_KEY, '') ?? '') === key) return
  setItem(SETTLE_KEY, key)
  settleOpen.value = true
}

export function closeSettle(): void {
  settleOpen.value = false
}

export interface SettleData {
  title: string
  dims: BuddyDim[]
  litCount: number
  /** 今日最高修为项 */
  top: string
  comment: string
  level: string
  gap: string
}

/**
 * 结算内容：四维 + 今日最高项 + 一句评语 + 境界进度。
 * 「最高项」用 trace 的 value 累加取最大 —— 与四维雷达同一口径，不另立算法。
 */
export const settleData = computed<SettleData>(() => {
  const k = todayKey()
  const rows = (['observe', 'pause', 'reflect', 'action'] as const).map((h) => ({
    key: h,
    label: dl(h),
    value: traceStore.valueOn(k, h),
  }))
  const top = [...rows].sort((a, b) => b.value - a.value)[0]
  const lit = litCount.value
  const missing = dims.value.find((d) => !d.on)

  const title = modeStore.id === 'dao' ? '今日收功' : modeStore.id === 'tech' ? '当日汇总' : '今日结算'
  const comment =
    lit === 4
      ? modeStore.id === 'dao'
        ? '四维皆亮，道心无亏。明日再进一阶。'
        : modeStore.id === 'tech'
          ? '四维数据完整，今日曲线闭合。'
          : '四维全亮 —— 今天没有偏科。'
      : lit === 0
        ? '今天什么都没入账。没关系，明天从最小的一件开始。'
        : `今天点亮了 ${lit} 维，还空着的是「${missing?.label ?? ''}」。明天先补它，别贪多。`

  const idx = levelIndexFromXp(xp.levelXp)
  const names = LEVEL_NAMES[modeStore.id] ?? LEVEL_NAMES.normal
  const next = names[idx + 1]
  const need = LEVEL_THRESHOLDS[idx + 1]

  return {
    title,
    dims: dims.value,
    litCount: lit,
    top: top && top.value > 0 ? `${top.label} +${top.value}` : '今天还没有入账',
    comment,
    level: names[idx] ?? '圆满',
    gap: next === undefined || need === undefined ? '已达当前境界之巅' : `距「${next}」还差 ${need - xp.levelXp} 点`,
  }
})

/* ---------------- 供页面 onShow 调用的总入口 ---------------- */
export function poke(): void {
  /* 先认当前在哪个大厅，小枢的职司印才跟得上页面切换（见「职司」段） */
  refreshHall()
  maybeGreetWindow()
  refreshDue()
  maybePingReminder()
  maybeSettle()
}

/** 早/晚窗口问候：同窗只弹一次；晚窗话术按设置个性化 */
function maybeGreetWindow(): void {
  /* 安息日不问候、不催办（那天连"新的一天，先安顿最重要的一件事"都是多余的） */
  if (silentToday()) return
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
    buddyStage,
    buddyStageName,
    buddyTier,
    buddyBodyName,
    buddyStageNote,
    buddyNextStageName,
    buddyStageGap,
    buddyStages,
    buddyDuty,
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
    settleOpen,
    settleData,
    closeSettle,
    poke,
    openPanel,
    closePanel,
    dismissTip,
    dwellTip,
    goSandglass,
    goMissing,
    openDailyCard,
    remembered,
    rememberedLabel,
    goProverbs,
    handoff,
  }
}

/**
 * 词表 lexicon —— 三模式「同一件事的不同说法」集中存放处。
 *
 * 页面不写死文案分支，只调用：
 *   hallStatus('observe', mode, { read: 3 })  → 得到该模式下大厅状态栏文案
 *
 * 数据来源分两层：
 *   1. 远端内容下发（InsightActionBacend/config/content.json → lexicon）——改文案不用发版；
 *   2. 本文件的内置模板兜底 —— 接口不可用时行为与改动前完全一致。
 * 因为调用方只认 hallStatus()，所以「换数据源」不需要动任何页面。
 */
import type { ModeId } from './modes'
import { useContentStore } from '@/stores/content'

/** 各大厅状态栏所需的数据（按需取用，缺省见 PLACEHOLDER_DEFAULTS） */
export interface DailyStats {
  /** 观：今日已读条数 / 信息配额总量 */
  read?: number
  quota?: number
  /** 止：今日专注分钟 / 连续天数 */
  focusMin?: number
  streak?: number
  /** 知：今日产出卡片 / 连续天数 */
  cards?: number
  /** 行：今日完成项 / 计划项 */
  done?: number
  plan?: number
}

export type HallId = 'observe' | 'pause' | 'reflect' | 'action'

/** 占位符缺省值（与原实现里的 ?? 默认值保持一致，保证文案渲染结果不变） */
const PLACEHOLDER_DEFAULTS: Record<string, number> = {
  read: 0,
  quota: 5,
  focusMin: 0,
  streak: 0,
  cards: 0,
  done: 0,
  plan: 3,
}

/** 内置模板（远端下发同名字段即覆盖）。占位符见 PLACEHOLDER_DEFAULTS */
const LOCAL_TEMPLATES: Record<HallId, Record<ModeId, string>> = {
  observe: {
    tech: '今日信息摄入 {read}/{quota} 条 · 效率评分 --',
    normal: '今日已读 {read} 条 · 状态 专注',
    dao: '神识今日已探 {read}/{quota} 处 · 灵台清明',
  },
  pause: {
    tech: '今日专注 {focusMin} 分钟 · 连续 {streak} 天',
    normal: '今日静心 {focusMin} 分钟 · 连续 {streak} 天',
    dao: '今日定力 {focusMin} · 连续 {streak} 日道心稳固',
  },
  reflect: {
    tech: '今日已记 {cards} 条 · 连续复盘 {streak} 天',
    normal: '今日收获 {cards} 条 · 连续 {streak} 天',
    dao: '今日悟道 {cards} 条 · 慧根渐长',
  },
  action: {
    tech: '今日完成 {done}/{plan} 项 · 行动力 --%',
    normal: '今日做了 {done} 件事 · 状态 充实',
    dao: '今日功德 +{done} · 道行渐深',
  },
}

/** 渲染模板：{key} → 实际数值（无数据时用缺省值；未知占位符渲染为空串） */
function render(template: string, stats: DailyStats): string {
  const bag = stats as Record<string, number | undefined>
  return template.replace(/\{(\w+)\}/g, (_all, key: string) => {
    const value = bag[key]
    if (typeof value === 'number') return String(value)
    const fallback = PLACEHOLDER_DEFAULTS[key]
    return fallback === undefined ? '' : String(fallback)
  })
}

/** 读取某一大厅 / 某一模式下的状态栏文案（远端优先，内置兜底） */
export function hallStatus(hall: HallId, mode: ModeId, stats: DailyStats): string {
  let template = LOCAL_TEMPLATES[hall]?.[mode] ?? ''
  try {
    // 远端模板为空串时按「未配置」处理，继续用内置模板
    template = useContentStore().lexiconOf(hall, mode) || template
  } catch {
    // 极端情况（pinia 尚未就绪）直接用内置模板
  }
  return render(template, stats)
}

/* ==========================================================================
 * 大厅头部「一句」—— 共用组件 HallHead 的主心骨（2026-09-16）
 *
 * 与 hallStatus 的分工：
 *   status = "今天怎么样了"（细，挂在印章旁，带当日数值）；
 *   line   = "今天为什么值得做"（大，摆在卡片下半部，是这块横幅的主张）。
 * 两个都塞进头部会让同一块地方把话说两遍，所以四个大厅的头部改用 line + 关键数字，
 * 只有「观」大厅继续用 status（它要报信息配额）。
 *
 * 兜底顺序（与 hallStatus 同思路，但这一层先只做内置 + 页面回落）：
 *   1. 本文件内置模板（三模式各一句；**只写主张、不塞数字** —— 数字由 stats 承担，免得重复）；
 *   2. 模板缺失或渲染为空 → 回落到各页传入的现成文案（例如「止」页的连胜提示、
 *      「我」页的"距下一级还差 N 点"），保证任何模式下头部都不会空着。
 * 远端接线（以后要做时）：给 content.json 的 lexicon 加一个 line 字段，这里改成优先读它即可。
 * ========================================================================== */

/** 「一句」适用的大厅 —— 比 hallStatus 多一个「我」：它没有状态行，但有头部主张 */
export type HallLineId = HallId | 'me'

const LOCAL_LINES: Record<HallLineId, Record<ModeId, string>> = {
  observe: {
    normal: '今天看到的事，值得收进自己的理里',
    tech: '先辨源，再入库',
    dao: '观事入心，方成己理',
  },
  pause: {
    normal: '今天走完一段，就是第 1 天',
    tech: '专注是今天唯一的指标',
    dao: '止念一炷香，道行自生长',
  },
  reflect: {
    normal: '看懂的东西，用自己的话说一遍才算',
    tech: '输出一条，才算读进去',
    dao: '以己言解圣言，方为真知',
  },
  action: {
    normal: '想清楚一件，就做掉一件',
    tech: '闭环优先，其余排队',
    dao: '知行合一，功德自增',
  },
  me: {
    normal: '把走过的路，回看一眼',
    tech: '读数即成长',
    dao: '日积一善，道行自深',
  },
}

/**
 * 读取某一大厅 / 某一模式下头部那句主张。
 * @param fallback 模板不可用时的现成文案（各页自己那句今日提示），可为空串
 */
export function hallLine(hall: HallLineId, mode: ModeId, fallback = ''): string {
  const template = LOCAL_LINES[hall]?.[mode] ?? ''
  const text = template ? render(template, {}).trim() : ''
  return text || fallback
}

/* ==========================================================================
 * 行 · 计划（挑战升级版，2026-09-15 拍板）的三模式叫法
 *
 * 为什么放在 lexicon 而不是 phrases：
 *   这里的词带**参数**（进度 n/m、搁置 N 天），与大厅状态栏同一类；
 *   phrases 只放无占位符的固定短语。
 * 顺序沿用 phrases.ts 的基调：normal 生活感 / tech 指标感 / dao 道统感。
 * ========================================================================== */

/** 挑战三型（与 stores/plan.ts 的 ChallengeType 同构，两处字面量一致即可互相赋值） */
export type PlanChallenge = 'abstain' | 'try' | 'cog'

/** 挑战三型的中文名：三类语义是产品定义，不做三套说法 */
export const CHALLENGE_LABEL: Record<PlanChallenge, string> = {
  abstain: '戒断',
  try: '尝试',
  cog: '认知',
}

/** 挑战三型一句话说明（新建计划时选类型用） */
export const CHALLENGE_DESC: Record<PlanChallenge, string> = {
  abstain: 'N 天不做某件事',
  try: '做一件没做过的事',
  cog: '证明我原来的一个判断是错的',
}

/** 收束回望的提问（写进【知】的那一句，按挑战三型问不同的问题） */
export const CHALLENGE_REFLECT: Record<PlanChallenge, string> = {
  abstain: '最难的是哪天，怎么过的？',
  try: '和我想的不一样在哪？',
  cog: '原来的判断错在哪？现在怎么看？',
}

/** 期限三档（与 stores/plan.ts 的 PlanHorizon 同构，两处字面量一致即可互相赋值） */
export type PlanHorizonKey = 'short' | 'mid' | 'long'

/** 期限三档的中文名：三档是产品定义，不做三套说法 */
export const HORIZON_LABEL: Record<PlanHorizonKey, string> = {
  short: '短期',
  mid: '中期',
  long: '长期',
}

/** 期限三档一句话说明（新建 / 编辑时选档用） */
export const HORIZON_DESC: Record<PlanHorizonKey, string> = {
  short: '一周内走得完 —— 一件事、一个开头',
  mid: '一个月内走得完 —— 要拆成几步才到',
  long: '一个月以上，或者干脆不定日子',
}

export type ActionBlockKey = 'three' | 'daily' | 'step'

/**
 * 一块"今日清单"该怎么被解释清楚（2026-09-22 重写）。
 *
 * 起因：这一页同时摆着三份长得像待办清单的东西，老版本只讲**形态**
 * （"跨天清零""勾满就收束"）—— 术语准确但没人看得懂，结果三块被当成同一个东西，
 * 也就谈不上"用"。现在每块给四件东西：
 *   hint —— 标题下那一行：**一句话人话**，回答"它管什么"；
 *   what —— 弹窗里的定义（讲它是怎么来的）；
 *   eg   —— **举例**（抽象定义不如一句例子顶用）；
 *   fate —— **忘了做会怎样**。这才是三块真正的分界：清零 / 累积不断 / 顺延到待办池。
 *
 * `{daily}` `{step}` 是名词占位符 —— 日课与步子的叫法跟着模式走（见 `planWords`），
 * 由 `actionSplit(key, words)` 填。
 */
export interface ActionBlockExplain {
  /** 标题下那一行 */
  hint: string
  /** 弹窗里的名字 */
  name: string
  /** 一句话定义 */
  what: string
  /** 举例 */
  eg: string
  /** 忘了做会怎样（三者的真正分界） */
  fate: string
}

const LOCAL_ACTION_SPLIT: Record<ActionBlockKey, ActionBlockExplain> = {
  three: {
    hint: '今天临时冒出来的三件 · 明天整块清空',
    name: '今日三件事',
    what: '今天才定下来的事。早上是空的，得你自己往上写；一共只有三条，是逼你挑最重要的那三件。',
    eg: '「下午把方案发出去」「给家里打个电话」',
    fate: '只活今天：过了零点整块清空，没做完的不欠账、也不滚到明天。做成一件会回写【知】，还能挂上"它从哪儿来的"。',
  },
  daily: {
    hint: '早就答应自己每天做的 · 一次立好，之后每天都在',
    name: '{daily}',
    what: '内容基本不变的那几件 —— 早点睡、每天走一会儿、睡前不刷手机。它的清单不用重填，每天只问一句"今天这一次做到了没有"。',
    eg: '早睡 / 走二十分钟 / 睡前不刷手机',
    fate: '会累积：守住一天记一天，守满目标天数就收束（可以写一句回望）。今天没勾只是空白、不算破；真破了也不归零。',
  },
  step: {
    hint: '早就立好的目标里 · 派到今天的那一段',
    name: '{step}',
    what: '从长期那条路拆下来的具体节点，外加临时想加的一条。它是"除了三件事之外还在往前挪"的那部分。',
    eg: '「写完第三章」排在今天 → 今天就认这一段',
    fate: '不会清零：今天没走的进待办池，明天还在。不催办，也不扣分。',
  },
}

/**
 * `{daily}` 与「习惯打卡」的区别（2026-09-22）。
 *
 * 两者看起来都是"每天重复一次"，用户必然会问"那我该建哪个"。答案只有一句：**有没有期限** ——
 * `{daily}` 守满就收束，习惯永不到期。桥在这一页也给：习惯页的「立为{daily}」会把记录一起带过去。
 */
export function dailyVsHabit(dailyName: string): string {
  return `${dailyName}有期限：守满目标天数就收束，还能写一句回望；习惯打卡没有期限 —— 想给习惯一个期限，去习惯页点「立为${dailyName}」，已有的记录会一并带过去。`
}

/** 未标挑战类型的普通计划，收束时的通用回望提问 */
export const PLAN_REFLECT_DEFAULT = '这段路走完，最想留下的一句话是什么？'

export interface PlanWords {
  /** 入口小印字 */
  mark: string
  /** 长期计划名词 */
  plan: string
  /** 大厅英文小字（副标题） */
  en: string
  /** 节点名词 */
  node: string
  /** 今日派单区标题 */
  today: string
  /** 待办池 */
  pool: string
  /** 进度文案（带上数字） */
  progress: (done: number, total: number) => string
  /** 搁置文案（带上天数） */
  shelf: (days: number) => string
  /** 长期空态 */
  emptyLong: string
  /** 某一档（短期 / 中期）的空态；长期仍用 emptyLong */
  emptyHorizon: (label: string) => string
  /** 今日空态 */
  emptyToday: string
  /** 长期计划上限提示（文案对齐习惯的「别贪多」） */
  cap: string
  /** 新建长期计划按钮 */
  newLong: string
  /** 加一条今日事按钮 */
  newToday: string
  /** 「下一节点」标签 */
  next: string
  /** 三态标签 */
  statusActive: string
  statusDone: string
  statusArchived: string
  /** 30 天无动作的轻问 */
  stale: string

  /* ---------------- 日课（2026-09-17）：每天重复一次的那一类 ----------------
   * 与"长路"同一套词表：日课也是计划的一种形态（cadence='daily'），
   * 叫法该跟着模式走，不该在页面里写死中文。
   */
  /** 日课名词（tab 名 / 标签 / 区标题） */
  daily: string
  /** 日课 tab 的一句话说明 */
  dailyNote: string
  /** 日课空态 */
  emptyDaily: string
  /** 新建日课按钮 */
  newDaily: string
  /** 日课上限提示 */
  dailyCap: string
  /** 目标天数标签（新建弹层 / 详情页） */
  targetLabel: string
  /** 目标天数的选项文案（带上数字） */
  days: (n: number) => string
  /** 日课进度文案（守住几天 / 共几天）—— 刻意不给百分比 */
  dailyProgress: (done: number, total: number) => string
  /** 勾选按钮（今天做到了） */
  keepAct: string
  /** 已勾选（今天做到了） */
  keptAct: string
  /** 破了按钮（只有戒断型才有） */
  breakAct: string
  /** 已破了 */
  brokenAct: string
  /** 今天还没记（**刻意不写成"未完成"**：未记不是失败） */
  notYet: string
  /** 未记 / 破了的宽慰句 */
  dailyHint: string
}

const LOCAL_PLAN_WORDS: Record<ModeId, PlanWords> = {
  normal: {
    mark: '划',
    plan: '长路',
    en: 'ROAD · 一条要走很久的路',
    node: '一步',
    today: '今天要走的步子',
    pool: '待办池',
    progress: (done, total) => `走了 ${done}/${total} 步`,
    shelf: (days) => `已搁置 ${days} 天`,
    emptyLong: '还没有在走的长路。\n立一条，把「想做的事」变成一个能走完的东西。',
    emptyHorizon: (label) => `${label}这一档还没有路。\n想清楚这一档要什么，再立一条。`,
    emptyToday: '今天还没有额外的步子。\n三件事之外还想做点什么，就写一条。',
    cap: '别贪多，先走完手上的 3 条长路',
    newLong: '立一条长路',
    newToday: '加一条今天的步子',
    next: '下一步',
    statusActive: '在路上',
    statusDone: '已走完',
    statusArchived: '已收起',
    stale: '这条长路 30 天没动过了 —— 还继续吗？',
    daily: '日课',
    dailyNote: '不是「分几步走完」，而是每天重复一次。勾满目标天数就收束，中途随时能改。',
    emptyDaily: '还没有在守的日课。\n把「每天做一次」的事立在这，一天一勾，勾满就收束。',
    newDaily: '立一条日课',
    dailyCap: '在守的日课上限 5 条（舒适线 3 条）—— 与长路分开算',
    targetLabel: '目标天数',
    days: (n) => `${n} 天`,
    dailyProgress: (done, total) => `守住 ${done} 天 / 共 ${total} 天`,
    keepAct: '守住了',
    keptAct: '✓ 今天守住了',
    breakAct: '破了',
    brokenAct: '今天破了',
    notYet: '今天还没记',
    dailyHint: '没勾不算破 —— 想不起来就空着，明天照常（破了也不会归零）。',
  },
  tech: {
    mark: '划',
    plan: '计划',
    en: 'PLAN · 目标 · 里程碑 · 收敛',
    node: '里程碑',
    today: '今日任务',
    pool: '待排队列',
    progress: (done, total) => `进度 ${done}/${total}`,
    shelf: (days) => `积压 ${days} 天`,
    emptyLong: '暂无进行中的计划。\n建立一条，把一个模糊目标拆成可验证的里程碑。',
    emptyHorizon: (label) => `${label}暂无进行中的计划。\n建立一条，把该档期的目标拆成里程碑。`,
    emptyToday: '今日无额外任务。\n除三项主任务外仍需推进的，在此登记。',
    cap: '并发上限 3，先收敛手上的计划',
    newLong: '新建计划',
    newToday: '补录今日任务',
    next: '下一里程碑',
    statusActive: '进行中',
    statusDone: '已完成',
    statusArchived: '已归档',
    stale: '该计划 30 天无更新 —— 继续或归档？',
    daily: '每日任务',
    dailyNote: '不是里程碑式拆分，而是每日重复执行。完成天数达到目标即关闭，中途可随时调整。',
    emptyDaily: '暂无进行中的每日任务。\n把需要每天执行的事项登记在此，一天一勾，达到目标天数即关闭。',
    newDaily: '新建每日任务',
    dailyCap: '每日任务上限 5 条（舒适线 3 条）—— 与计划分开计数',
    targetLabel: '周期天数',
    days: (n) => `${n} 天`,
    dailyProgress: (done, total) => `已完成 ${done} / ${total} 天`,
    keepAct: '完成',
    keptAct: '✓ 今日完成',
    breakAct: '未达成',
    brokenAct: '今日未达成',
    notYet: '今日未记录',
    dailyHint: '未记录不等于失败 —— 漏记不影响累计，也不会清零。',
  },
  dao: {
    mark: '划',
    plan: '大愿',
    en: 'VOW · 发愿 · 关隘 · 圆满',
    node: '关隘',
    today: '今日功课',
    pool: '未了之事',
    progress: (done, total) => `已过 ${done}/${total} 关`,
    shelf: (days) => `搁置 ${days} 日`,
    emptyLong: '尚无在行之大愿。\n立下一桩，把心之所向化作可过之关。',
    emptyHorizon: (label) => `${label}尚无在行之愿。\n量力而立，一档一桩足矣。`,
    emptyToday: '今日无额外功课。\n三事之外尚有所求者，记于此。',
    cap: '大愿不宜多，先了结手上的三桩',
    newLong: '立一桩大愿',
    newToday: '记一笔今日功课',
    next: '下一关隘',
    statusActive: '在行',
    statusDone: '圆满',
    statusArchived: '封存',
    stale: '此愿三十日未曾提起 —— 仍要续行否？',
    daily: '日行',
    dailyNote: '非以步计，而是日复一日。守满即收，中途可改。',
    emptyDaily: '尚无在守之日行。\n把每日必做之事立于此处，一日一勾，守满则收。',
    newDaily: '立一条日行',
    dailyCap: '在守日行上限五条（舒适线三条）—— 与长路分计',
    targetLabel: '期限',
    days: (n) => `${n} 日`,
    dailyProgress: (done, total) => `已守 ${done} 日 / 共 ${total} 日`,
    keepAct: '守住了',
    keptAct: '✓ 今日守住了',
    breakAct: '破了',
    brokenAct: '今日破了',
    notYet: '今日未记',
    dailyHint: '未记不作破 —— 想不起来便空着，明日照常（破了亦不归零）。',
  },
}

/** 计划的三模式叫法（纯内置；改动随发版，故不接远端下发） */
export function planWords(mode: ModeId): PlanWords {
  return LOCAL_PLAN_WORDS[mode] ?? LOCAL_PLAN_WORDS.normal
}

/**
 * 取某一块今日清单的解释，并把里面的名词占位符换成当前模式的叫法。
 * @param words 当前模式的计划词表（`planWords(mode.id)`）
 */
export function actionSplit(key: ActionBlockKey, words: PlanWords): ActionBlockExplain {
  const b = LOCAL_ACTION_SPLIT[key]
  const fill = (s: string) => s.replace(/\{daily\}/g, words.daily).replace(/\{step\}/g, words.today)
  return { hint: fill(b.hint), name: fill(b.name), what: fill(b.what), eg: fill(b.eg), fate: fill(b.fate) }
}

/** 三块清单的固定顺序（弹解释时被点的那块会排到最前） */
export const ACTION_BLOCK_ORDER: ActionBlockKey[] = ['three', 'daily', 'step']

/**
 * 三块「今日清单」的小印字（2026-09-22）。
 *
 * 与「把念头变成痕迹」那一串入口行（`EntryItem.mark`）同一套语言：一瞥即知是哪一类，
 * 不必先读标题。三块共用一套字、不随模式变 —— 模式只改名词（见 `actionSplit` / `planWords`）。
 */
export const ACTION_BLOCK_MARK: Record<ActionBlockKey, string> = {
  three: '三',
  daily: '日',
  step: '步',
}

/**
 * 分类行的展开 / 收起（2026-09-22）。
 * 三块今日清单与「今日收功」共用一处措辞，免得各写一份、各差一个字。
 */
export const ACTION_FOLD_WORDS = { open: '展开', close: '收起' }

/* ==========================================================================
 * 今日收功（2026-09-22：三模式词表 + 位置与形态）
 *
 * 三件事记在这里：
 *  1. **名词不再写死**：原先卡片标题硬编码「今日收功」，科技模式下与同页的「每日任务」不搭，
 *     也与小枢 23:00 那个结算面板同名（后者只是**读数**，这里是**写一句**，两回事）；
 *     现在写一句走本词表，读数那个仍叫「当日汇总」（见 `useBuddy.ts` 的 `settleData`）。
 *  2. **它默认摊开**（09-22 定案）：白天也展开 —— 收起只是用户自己的选择（「收起」按钮）。
 *     原先那套"白天折一行、到 20 点自动摊开"的判据（`CLOSING_AUTO_HOUR`）已删。
 *  3. **标题带小印字**（收 / 结）：与三块今日清单的 mark 同一套语言。
 * ========================================================================== */

export interface ClosingWords {
  /** 标题左侧的小印字（与三块今日清单的 mark 同一套语言） */
  mark: string
  /** 区块标题 */
  title: string
  /** 折叠态那一行（还没收时才出现） */
  fold: string
  /** 输入框上边的说明 */
  hint: string
  /** 输入框占位提示 */
  ph: string
  /** 主按钮 */
  act: string
  /** 已收标记 */
  tag: string
  /** 收了但没留字时显示的那句 */
  none: string
  /** 撤销（还想再做点什么） */
  redo: string
}

const LOCAL_CLOSING_WORDS: Record<ModeId, ClosingWords> = {
  normal: {
    mark: '收',
    title: '今日收功',
    fold: '今天还没收 · 留一句给今天 ›',
    hint: '一天结束前，给自己留一句（可留空，直接收也行）',
    ph: '今天最想留下的一句',
    act: '收功',
    tag: '已收',
    none: '今天收了 —— 不留字也算。',
    redo: '还想再做点什么 · 撤销收功',
  },
  tech: {
    mark: '结',
    title: '今日结算',
    fold: '今天还没结算 · 记一条今天的结论 ›',
    hint: '收尾前记一条今天最重要的结论（可留空，直接结算也行）',
    ph: '今天最重要的一个结论',
    act: '结算',
    tag: '已结算',
    none: '今天已结算 —— 没留记录。',
    redo: '还要补点什么 · 撤销结算',
  },
  dao: {
    mark: '收',
    title: '今日收功',
    fold: '今日尚未收功 · 留一句 ›',
    hint: '一日将尽，留下一句今日所得（不留字亦可）',
    ph: '今日所悟',
    act: '收功',
    tag: '已收',
    none: '今日已收功 —— 未留字。',
    redo: '尚有未了之事 · 撤销收功',
  },
}

/** 今日收功的三模式说法（与另一处"读数的结算"刻意不同名，见本段的说明） */
export function closingWords(mode: ModeId): ClosingWords {
  return LOCAL_CLOSING_WORDS[mode] ?? LOCAL_CLOSING_WORDS.normal
}

/* ==========================================================================
 * 「我」页入口卡片（2026-09-22）：那一列卡片的**说明句与徽标**的三套说法
 *
 * 起因：「初始测评」那张卡写着「建档」、日课卡写着「境界与同道」（「境界」是修仙的
 * 成长名，普通是阶位、科技是段位）—— 同一列的兄弟卡也全是写死的一口普通话。
 * 用户切了模式，最常点的那一列却不变，等于没换模式。
 *
 * 三条口径：
 *  1. **标题不做主题化**（初始测评 / 成就墙 / 痕迹时间轴 / 设置……）：
 *     标题是"我在哪"的定位词，跟着模式换，换个模式就找不到入口了
 *     —— 与设置页「行标题保持功能清晰」同一条（见 phrases.ts 顶部注释）。
 *     小印字（课 / 测 / 板 / 勋…）同理，与 ACTION_BLOCK_MARK 一样属骨架，不随模式变。
 *     变的只有**说明句与徽标**：那才是"说话的口吻"。
 *  2. **带参数，所以放 lexicon 而不是 phrases**：这一列的说明句几乎都带数字
 *     （已记住 N 句 / 封着 N 条 / 本月 N 天），与大厅状态栏同一类；phrases 只放无占位符的固定短语。
 *  3. **纯内置，不接远端下发** —— 与 planWords / closingWords 同一处理：
 *     这是入口说明句，改文案随发版即可，不值得为它多开一条 content.json 通道。
 *     顺序沿用 phrases.ts 的基调：normal 生活感 / tech 指标感 / dao 道统感。
 * ========================================================================== */

export interface MeEntryWords {
  /** 今日日课卡 · 说明句 */
  dailyCard: string

  /* ---- 初始测评：未建档 / 已建档两种形态（徽标另有 待建档 / N 天后可重测 / 可重测 三态） ---- */
  /** 未建档说明句（`bank` 是题库名：生活基线 / 数字画像 / 灵根检测） */
  assessIdle: (bank: string) => string
  assessIdleBadge: string
  /** 已建档说明句：称号 · 分数 · 日期 */
  assessDone: (tier: string, score: number, max: number, date: string) => string
  assessRetakeIn: (days: number) => string
  assessRetakeNow: string

  /* ---- 修行看板 ---- */
  board: string
  boardBadge: (pct: number) => string
  /** 「还没攒够数据」的通用徽标（修行看板与年度回顾共用） */
  pending: string

  /* ---- 成就墙 ---- */
  badges: (got: number, total: number) => string

  /* ---- 活跃日历 ---- */
  calendar: (days: number) => string
  calendarBadge: (days: number) => string

  /* ---- 痕迹时间轴 ---- */
  timeline: (n: number) => string
  timelineEmpty: string
  timelineBadge: (n: number) => string

  /* ---- 我的箴言 ---- */
  /** 已记住 N 句 · 其中开屏 A / 小枢 B */
  proverbs: (n: number, startup: number, buddy: number) => string
  proverbsEmpty: string
  proverbsBadge: (n: number) => string

  /* ---- 时间胶囊 ---- */
  capsule: (sealed: number, opened: number) => string
  capsuleEmpty: string
  capsuleDue: (n: number) => string
  /** 最近一条的到期日，如「2027-01-01 见」 */
  capsuleNext: (day: string) => string
  capsuleSeal: string

  /* ---- 年度回顾 ---- */
  review: (days: number, xp: number) => string
  reviewEmpty: string
  reviewBadge: (days: number) => string

  /* ---- 小枢羁绊 ---- */
  bond: (name: string, times: number, stage: string) => string
  bondBadge: (lv: number) => string
  bondNew: string

  /* ---- 道侣（押后项，只作如实标注） ---- */
  companion: string
  companionBadge: string

  /* ---- 设置 ---- */
  settings: string
  settingsBadge: string
}

const LOCAL_ME_ENTRY_WORDS: Record<ModeId, MeEntryWords> = {
  normal: {
    dailyCard: '每日一张 · 阶位与四维 · 可转发留存',
    assessIdle: (bank) => `做一次「${bank}」建档，建立你的起点`,
    assessIdleBadge: '待建档',
    assessDone: (tier, score, max, date) => `${tier} · ${score}/${max} 分 · ${date} 建档`,
    assessRetakeIn: (days) => `${days} 天后可重测`,
    assessRetakeNow: '可重测',
    board: '四维雷达 · 认知深度分布 · 知→行转化率 · 成长曲线',
    boardBadge: (pct) => `转化 ${pct}%`,
    pending: '待积累',
    badges: (got, total) => `已点亮 ${got} / ${total} 枚 · 每一枚都是一段真实的坚持`,
    calendar: (days) => `本月已留下 ${days} 天 · 每一天的投入都看得见`,
    calendarBadge: (days) => `${days} 天`,
    timeline: (n) => `累计留下 ${n} 条痕迹 · 都是真实发生过的事`,
    timelineEmpty: '从今天的第一件小事开始留痕',
    timelineBadge: (n) => `${n} 条`,
    proverbs: (n, startup, buddy) => `已记住 ${n} 句 · 开屏 ${startup} · 小枢 ${buddy}`,
    proverbsEmpty: '遇到想留住的句子，点「记住这句」就收进这里',
    proverbsBadge: (n) => `${n} 句`,
    capsule: (sealed, opened) => `封着 ${sealed} 条 · 拆开过 ${opened} 条 · 只在本机留存`,
    capsuleEmpty: '给未来的自己留一句话，选个日子，到期那天递给你',
    capsuleDue: (n) => `${n} 条到期`,
    capsuleNext: (day) => `${day} 见`,
    capsuleSeal: '封一条',
    review: (days, xp) => `今年 ${days} 天有痕迹 · 累计 ${xp} 点修为`,
    reviewEmpty: '一年到头回头看一眼：今年你留下了什么',
    reviewBadge: (days) => `${days} 天`,
    bond: (name, times, stage) => `与「${name}」相见 ${times} 次 · 形态「${stage}」· 对话与箴言都在这里`,
    bondBadge: (lv) => `Lv.${lv}`,
    bondNew: '初遇',
    companion: '互加伙伴、互看今日完成度、低频事件提醒 —— 已排入后续，当前不做',
    companionBadge: '后续做',
    settings: '修行语言 · 提醒 · 数据 · 关于',
    settingsBadge: '可用',
  },
  tech: {
    dailyCard: '每日一张 · 段位与指标 · 可导出转发',
    assessIdle: (bank) => `跑一次「${bank}」采样，建立基线参数`,
    assessIdleBadge: '待采样',
    assessDone: (tier, score, max, date) => `${tier} · ${score}/${max} · ${date} 采样`,
    assessRetakeIn: (days) => `${days} 天后可重采样`,
    assessRetakeNow: '可重采样',
    board: '四维雷达 · 加工深度分布 · 知→行转化率 · 增长曲线',
    boardBadge: (pct) => `转化率 ${pct}%`,
    pending: '无样本',
    badges: (got, total) => `已解锁 ${got} / ${total} 枚 · 每枚对应一项已验证的行为`,
    calendar: (days) => `本月有效 ${days} 天 · 每次投入都有记录`,
    calendarBadge: (days) => `${days} 天`,
    timeline: (n) => `累计 ${n} 条事件 · 全部为已发生的行为`,
    timelineEmpty: '完成第一件事后，事件会写入这里',
    timelineBadge: (n) => `${n} 条`,
    proverbs: (n, startup, buddy) => `已收藏 ${n} 条 · 开屏 ${startup} · 小枢 ${buddy}`,
    proverbsEmpty: '遇到值得留存的内容，点「记住这句」即写入此处',
    proverbsBadge: (n) => `${n} 条`,
    capsule: (sealed, opened) => `已封存 ${sealed} 条 · 已解封 ${opened} 条 · 仅存本机`,
    capsuleEmpty: '写入一条给未来的数据，设定到期日自动送达',
    capsuleDue: (n) => `${n} 条到期`,
    capsuleNext: (day) => `${day} 送达`,
    capsuleSeal: '封一条',
    review: (days, xp) => `今年 ${days} 天有记录 · 累计 ${xp} 点`,
    reviewEmpty: '年度数据回看：今年产生了什么',
    reviewBadge: (days) => `${days} 天`,
    bond: (name, times, stage) => `与「${name}」交互 ${times} 次 · 形态「${stage}」· 对话与箴言都在此`,
    bondBadge: (lv) => `Lv.${lv}`,
    bondNew: '未交互',
    companion: '配对绑定、共享今日完成度、低频事件提醒 —— 已排入后续，暂不实现',
    companionBadge: '待实现',
    settings: '运行模式 · 提醒 · 数据 · 关于',
    settingsBadge: '就绪',
  },
  dao: {
    dailyCard: '每日一张 · 境界与四维 · 可传于同道',
    assessIdle: (bank) => `测一次「${bank}」，立下入门根骨`,
    assessIdleBadge: '未立档',
    assessDone: (tier, score, max, date) => `${tier} · ${score}/${max} 根骨 · ${date} 立档`,
    assessRetakeIn: (days) => `${days} 日后可再测`,
    assessRetakeNow: '可再测',
    board: '四维雷达 · 悟道深浅分布 · 知→行转化率 · 修行曲线',
    boardBadge: (pct) => `转化 ${pct}%`,
    pending: '未起',
    badges: (got, total) => `已得 ${got} / ${total} 枚徽记 · 每一记皆是一段真实的修行`,
    calendar: (days) => `本月行持 ${days} 日 · 每一日皆有着落`,
    calendarBadge: (days) => `${days} 日`,
    timeline: (n) => `累计 ${n} 道痕迹 · 皆真实所行`,
    timelineEmpty: '自今日第一桩小事起留痕',
    timelineBadge: (n) => `${n} 道`,
    proverbs: (n, startup, buddy) => `已录 ${n} 句 · 开屏 ${startup} · 小枢 ${buddy}`,
    proverbsEmpty: '遇有可留之句，点「记住这句」便收入囊中',
    proverbsBadge: (n) => `${n} 句`,
    capsule: (sealed, opened) => `封存 ${sealed} 条 · 已启 ${opened} 条 · 只留于本机`,
    capsuleEmpty: '留一句与来日的自己，择期而封，到期自启',
    capsuleDue: (n) => `${n} 条待启`,
    capsuleNext: (day) => `${day} 启封`,
    capsuleSeal: '封一条',
    review: (days, xp) => `今年 ${days} 日有痕 · 累计修为 ${xp} 点`,
    reviewEmpty: '岁末回望：这一年的道行何在',
    reviewBadge: (days) => `${days} 日`,
    bond: (name, times, stage) => `与「${name}」相会 ${times} 次 · 形态「${stage}」· 对谈与箴言皆录于此`,
    bondBadge: (lv) => `Lv.${lv}`,
    bondNew: '初会',
    companion: '结缘码绑定、互看今日功德、低频提醒 —— 已排入后续，当下不做',
    companionBadge: '后续',
    settings: '修行语言 · 提醒 · 数据 · 关于',
    settingsBadge: '可用',
  },
}

/** 「我」页入口卡片的说明句与徽标词表（纯内置，见本段说明） */
export function meEntryWords(mode: ModeId): MeEntryWords {
  return LOCAL_ME_ENTRY_WORDS[mode] ?? LOCAL_ME_ENTRY_WORDS.normal
}

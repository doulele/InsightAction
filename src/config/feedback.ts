/**
 * 回音壁的文案与阈值（2026-09-23 建立）——「我」大厅 → 回音壁。
 *
 * 为什么它单独一个 config 文件，而不是并进 lexicon：
 *
 * 1. **这一页的用词本身承担合规责任。** 它是全项目唯一一处"用户写的东西会给别人看"。
 *    个人主体小程序一旦被看成「社交平台 / 论坛 / 社区」，过审就会卡在类目上 ——
 *    所以这里统一的口径是「留一句 / 回应 / 回音壁」，刻意不出现
 *    论坛、社区、帖子、楼主、关注、粉丝、广场、热榜这类词。术语集中在一个文件里，
 *    改的时候不会漏掉某一句（分散到三个页面里最容易漏）。
 * 2. **它是"开发者对用户"的一条线，不是人群之间的广场。** 页首那句 `intro` 就是
 *    在把这个定位讲清楚 —— 界面上也照着这个做：不做大图信息流、不做热度排行、
 *    不做个人主页、不显示谁的昵称头像（除非他自己选择署名）。
 *
 * 阈值（标题 / 正文 / 回应 / 署名）与后端 `config.feedback` **同值**：改一处要同时改。
 */
import type { ModeId } from './modes'

/** 三条的分类：报缺陷 / 提想法 / 问一句 */
export type FeedbackType = 'bug' | 'idea' | 'ask'

/**
 * 一条的进展。这套状态是**对用户可见的承诺**（后端 services/feedbackStore.js 同表）：
 *   pending  已送出 · 等回应 —— 只有你和我看得见
 *   open     已收到 —— 放出来了
 *   planned  已列入 —— 进了路线图
 *   doing    在做
 *   done     已做
 *   rejected 这次不做 —— 只有你和我看得见，会附一句为什么
 */
export type FeedbackStatus = 'pending' | 'open' | 'planned' | 'doing' | 'done' | 'rejected'

export const FEEDBACK_TYPES: readonly FeedbackType[] = ['bug', 'idea', 'ask']

/** 分类标签**不随模式变**（与 ACTION_BLOCK_MARK 同一条理由：它是骨架，不是说法） */
export const FEEDBACK_TYPE_LABEL: Record<FeedbackType, string> = {
  bug: '哪儿不对',
  idea: '想要个什么',
  ask: '问一句',
}

export const FEEDBACK_STATUS_LABEL: Record<FeedbackStatus, string> = {
  pending: '已送出 · 等回应',
  open: '已收到',
  planned: '已列入',
  doing: '在做',
  done: '已做',
  rejected: '这次不做',
}

/** 徽标色调（页面按它上色，别在页面里另写一套判断） */
export type FeedbackTone = 'muted' | 'accent' | 'doing' | 'done' | 'warn'

export function statusTone(status: FeedbackStatus): FeedbackTone {
  switch (status) {
    case 'planned':
      return 'accent'
    case 'doing':
      return 'doing'
    case 'done':
      return 'done'
    case 'rejected':
      return 'warn'
    case 'open':
      return 'accent'
    default:
      return 'muted'
  }
}

/** 路线图的四栏（与后端 board.json 的 stage 同表；paused 排在最后，是"先搁下"而不是"放弃"） */
export type RoadmapStage = 'planned' | 'doing' | 'done' | 'paused'

export const ROADMAP_STAGE_LABEL: Record<RoadmapStage, string> = {
  doing: '正在做',
  planned: '打算做',
  done: '已经做了',
  paused: '先搁下',
}

/** 阈值：与后端 config.feedback 的 maxTitle / maxBody / maxComment / maxName 同值 */
export const FEEDBACK_LIMIT = {
  title: 60,
  body: 2000,
  comment: 500,
  name: 12,
} as const

/** 页内三段（顺序就是展示顺序） */
export type FeedbackTab = 'updates' | 'roadmap' | 'voices'

export interface FeedbackTabMeta {
  key: FeedbackTab
  label: string
  hint: string
}

/** 三模式词表（页面**不许**写死中文，见文件头第 1 条） */
export interface FeedbackWords {
  /** 顶栏 */
  title: string
  /** 页首那一句：把"这不是广场"讲清楚 */
  intro: string
  /** 三段 */
  updates: string
  updatesHint: string
  roadmap: string
  roadmapHint: string
  voices: string
  voicesHint: string
  /** 写一句（按钮 / 发帖页标题） */
  write: string
  /** 赞 / 踩（回音列表用） */
  voteUp: string
  voteDown: string
  /** 路线图上的那一票（"我也想要"） */
  wantUp: string
  /** 回应（评论） */
  reply: string
  /** 匿名时的称呼 */
  anonymous: string
  /** 署名开关 */
  signAs: string
  /** 空态 */
  emptyVoices: string
  emptyVoicesHint: string
  emptyUpdates: string
  emptyRoadmap: string
}

const WORDS: Record<ModeId, FeedbackWords> = {
  normal: {
    title: '回音壁',
    intro: '这里不是广场，是我和你之间的一条线。你留下的每一句，我都会看。',
    updates: '更新',
    updatesHint: '走过哪几步',
    roadmap: '路线',
    roadmapHint: '接下来要去哪儿',
    voices: '回音',
    voicesHint: '你说的话',
    write: '写一句',
    voteUp: '同感',
    voteDown: '不太认同',
    wantUp: '我也想要',
    reply: '回应',
    anonymous: '道友',
    signAs: '署我的名号',
    emptyVoices: '还没有人说话',
    emptyVoicesHint: '哪儿用着不对、想要个什么功能，都可以写在这里 —— 只有你和我看得见，我收到会放出来。',
    emptyUpdates: '还没有更新记录',
    emptyRoadmap: '路线还没列出来',
  },
  tech: {
    title: '迭代看板',
    intro: '不是社区，是一条反馈通道。每条都会进队列，我也会回。',
    updates: '版本记录',
    updatesHint: '已合入的改动',
    roadmap: '路线',
    roadmapHint: '待办与优先级',
    voices: '反馈条目',
    voicesHint: '你报上来的',
    write: '提一条',
    voteUp: '+1',
    voteDown: '-1',
    wantUp: '排上',
    reply: '回复',
    anonymous: '用户',
    signAs: '带上我的名号',
    emptyVoices: '队列是空的',
    emptyVoicesHint: '缺陷、需求、疑问都可以提 —— 只有你和我可见，处理完我会放出来。',
    emptyUpdates: '暂无版本记录',
    emptyRoadmap: '路线尚未发布',
  },
  dao: {
    title: '论道台',
    intro: '此处不是市集，是你我之间的一线。你留下的每一句，我都会看。',
    updates: '走过的路',
    updatesHint: '已行之处',
    roadmap: '将往之处',
    roadmapHint: '往后要去哪儿',
    voices: '道友之言',
    voicesHint: '你所留下的',
    write: '留一句',
    voteUp: '附议',
    voteDown: '不契',
    wantUp: '愿往',
    reply: '回一句',
    anonymous: '道友',
    signAs: '署我的名号',
    emptyVoices: '尚无人言',
    emptyVoicesHint: '何处不通、欲求何物，皆可留于此 —— 唯你我可见，收到后我会放出来。',
    emptyUpdates: '尚无行迹可录',
    emptyRoadmap: '去向尚未刊出',
  },
}

export function feedbackWords(mode: ModeId): FeedbackWords {
  return WORDS[mode] ?? WORDS.normal
}

/** 三段（词表随模式，键固定） */
export function feedbackTabs(mode: ModeId): FeedbackTabMeta[] {
  const w = feedbackWords(mode)
  return [
    { key: 'updates', label: w.updates, hint: w.updatesHint },
    { key: 'roadmap', label: w.roadmap, hint: w.roadmapHint },
    { key: 'voices', label: w.voices, hint: w.voicesHint },
  ]
}

/**
 * 回音列表的排序（服务端算，前端只传键）。
 * 刻意**没有「热度排行」**：一有排行，页面就会长成广场的样子（见文件头第 1 条）。
 * 「最新」是默认；「最多人同感」是给"我也遇到过"的排序，不是给人排座次。
 */
export const FEEDBACK_SORTS: ReadonlyArray<{ key: 'new' | 'hot'; label: string }> = [
  { key: 'new', label: '最新' },
  { key: 'hot', label: '最多同感' },
]

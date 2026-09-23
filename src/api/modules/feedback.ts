/**
 * 回音壁接口层（2026-09-23 建立）。
 *
 *   GET    /guanzhi/feedback/board            免登录 → 更新日志 + 路线图 + 我的票 + 我是不是管理员
 *   GET    /guanzhi/feedback/posts            免登录 → 列表（?q= &type= &scope=mine &sort=）
 *   GET    /guanzhi/feedback/post/:id         免登录 → 一条 + 它的回应
 *   GET    /guanzhi/feedback/whoami           需登录 → 我自己的 openid
 *   POST   /guanzhi/feedback/post             需登录 → 发一条（默认待回应）
 *   POST   /guanzhi/feedback/post/:id/comment 需登录 → 回应
 *   POST   /guanzhi/feedback/vote             需登录 → 投一票 / 取消
 *   DELETE /guanzhi/feedback/post/:id         需登录 → 撤下（作者本人或管理员）
 *   POST   /guanzhi/feedback/admin/claim      需登录 → 管理员自举（名单为空时）
 *   POST   /guanzhi/feedback/admin/review     需登录 + 管理员 → 改状态 / 留一句
 *
 * 两个口径与分享页一致：
 *  · **读免登录**：刚装好的人应该先看得明白，再决定要不要登录。带了 token 就顺便
 *    认出"我"（哪些是我发的、我投过什么票），没有也照样返回公开内容；
 *  · **写要登录**：投票与发帖没有身份就能被刷，列表会立刻变成垃圾场。
 *
 * 所有写接口 `showError: false` —— 文案由页面给（要区分"写太短""今天说太多了""网络不通"），
 * 这里不重复弹一遍。
 */
import { http } from '@/api/http'
import type { FeedbackType, FeedbackStatus, RoadmapStage } from '@/config/feedback'

/** 有 token 才带 Authorization（读接口允许匿名） */
const authHeader = (token?: string): Record<string, string> =>
  token ? { Authorization: `Bearer ${token}` } : {}

export interface FeedbackVoteCounts {
  up: number
  down: number
  /** 我投的那一票：1 / -1 / 0 */
  my: number
}

/** 别人看到的那个人：只可能是「空（匿名道友）」或「他自己选择署的名」 */
export interface FeedbackAuthor {
  name: string
  tier: string
}

export interface FeedbackListItem {
  id: string
  type: FeedbackType
  title: string
  /** 列表里那一行摘要（服务端截的，不是全文） */
  preview: string
  status: FeedbackStatus
  allowComment: boolean
  createdAt: string
  updatedAt: string
  author: FeedbackAuthor
  /** 是不是我发的（服务端按归属哈希判，前端拿不到哈希） */
  mine: boolean
  votes: FeedbackVoteCounts
  /** 回应条数 */
  comments: number
  lastReplyOfficial: boolean
  lastReplyAt: string
}

export interface FeedbackComment {
  id: string
  body: string
  /** 官方（开发者）回的 —— 服务端写入时判定并存下，前端伪造不了 */
  official: boolean
  createdAt: string
  author: FeedbackAuthor
  mine: boolean
}

export interface FeedbackDetail {
  id: string
  type: FeedbackType
  title: string
  body: string
  status: FeedbackStatus
  allowComment: boolean
  createdAt: string
  updatedAt: string
  author: FeedbackAuthor
  mine: boolean
  votes: FeedbackVoteCounts
  comments: FeedbackComment[]
  /** 「这次不做」的理由：只有作者与管理员看得到（对别人来说这条压根不可见） */
  officialNote: string
  canRemove: boolean
}

export interface FeedbackListResult {
  items: FeedbackListItem[]
  total: number
  /** 总开关：false 时列表只剩自己的（提审被卡时的应急收口，见后端 config/app-config.json） */
  open: boolean
  isAdmin: boolean
}

export interface BoardChangelogEntry {
  version: string
  date: string
  title: string
  /** 本次更新（只有这一条会被摊开） */
  current: boolean
  items: string[]
}

export interface BoardRoadmapEntry {
  id: string
  title: string
  note: string
  stage: RoadmapStage
  /** 「我也想要」的票数（服务端把 board.json 与 votes.json 合起来给的，只有 up 没有 down） */
  votes: { up: number; down: number }
}

export interface FeedbackBoard {
  changelog: BoardChangelogEntry[]
  roadmap: BoardRoadmapEntry[]
  boardVersion: number
  updatedAt: string
  myVotes: Record<string, number>
  isAdmin: boolean
  /** 待回应的条数（只有管理员拿得到，普通用户恒 0） */
  pendingReview: number
  /** 管理员人数；0 且 needBootstrap 时可以"设为我的" */
  adminCount: number
  needBootstrap: boolean
  open: boolean
}

/** 更新日志 + 路线图 + 我的那一份状态（进页第一个请求） */
export function fetchFeedbackBoard(token?: string): Promise<FeedbackBoard> {
  return http.get<FeedbackBoard>('/feedback/board', { header: authHeader(token), showError: false })
}

export interface FeedbackListQuery {
  q?: string
  type?: FeedbackType | ''
  scope?: 'all' | 'mine'
  sort?: 'new' | 'hot'
}

export function fetchFeedbackPosts(token: string | undefined, query: FeedbackListQuery = {}): Promise<FeedbackListResult> {
  /*
   * 手工拼 query，**不用 URLSearchParams** —— 小程序运行时没有这个全局构造器
   * （它在浏览器与 Node 里都有，很容易顺手写出来，然后在真机上炸）。
   */
  const parts: string[] = []
  if (query.q) parts.push(`q=${encodeURIComponent(query.q)}`)
  if (query.type) parts.push(`type=${encodeURIComponent(query.type)}`)
  if (query.scope) parts.push(`scope=${encodeURIComponent(query.scope)}`)
  if (query.sort) parts.push(`sort=${encodeURIComponent(query.sort)}`)
  const qs = parts.join('&')
  return http.get<FeedbackListResult>(`/feedback/posts${qs ? `?${qs}` : ''}`, {
    header: authHeader(token),
    showError: false,
  })
}

export function fetchFeedbackPost(token: string | undefined, id: string): Promise<{ post: FeedbackDetail }> {
  return http.get<{ post: FeedbackDetail }>(`/feedback/post/${encodeURIComponent(id)}`, {
    header: authHeader(token),
    showError: false,
  })
}

export interface FeedbackPostInput {
  type: FeedbackType
  title: string
  body: string
  allowComment: boolean
  /** 选择署名时带上名号与称号；不传就是匿名道友 */
  name?: string
  tier?: string
}

/** 发一条（服务端会过内容安全，然后落在"已送出 · 等回应"） */
export function createFeedbackPost(
  token: string,
  input: FeedbackPostInput,
): Promise<{ id: string; status: FeedbackStatus; createdAt: string }> {
  return http.post<{ id: string; status: FeedbackStatus; createdAt: string }, FeedbackPostInput>(
    '/feedback/post',
    input,
    { header: authHeader(token), showError: false, timeout: 20000 },
  )
}

export function commentFeedbackPost(
  token: string,
  id: string,
  input: { body: string; name?: string; tier?: string },
): Promise<{ postedAt: string; official: boolean }> {
  return http.post<{ postedAt: string; official: boolean }, typeof input>(
    `/feedback/post/${encodeURIComponent(id)}/comment`,
    input,
    { header: authHeader(token), showError: false, timeout: 20000 },
  )
}

/** 投票：`key` 是 `post:<id>` 或 `route:<id>`；`dir` 1 / -1 / 0（0 = 取消） */
export function voteFeedback(
  token: string,
  key: string,
  dir: 1 | -1 | 0,
): Promise<FeedbackVoteCounts> {
  return http.post<FeedbackVoteCounts, { key: string; dir: number }>(
    '/feedback/vote',
    { key, dir },
    { header: authHeader(token), showError: false },
  )
}

export function removeFeedbackPost(token: string, id: string): Promise<{ removed: boolean }> {
  return http.delete<{ removed: boolean }>(`/feedback/post/${encodeURIComponent(id)}`, {
    header: authHeader(token),
    showError: false,
  })
}

/** 自举管理员（只在还没有管理员时有效） */
export function claimFeedbackAdmin(token: string): Promise<{ isAdmin: boolean }> {
  return http.post<{ isAdmin: boolean }, Record<string, never>>('/feedback/admin/claim', {}, {
    header: authHeader(token),
    showError: false,
  })
}

/** 审核：改状态并留一句话（给作者看） */
export function reviewFeedbackPost(
  token: string,
  input: { id: string; status: FeedbackStatus; /** 省略 = 保留原有留言（服务端只在传了的时候覆盖） */ note?: string },
): Promise<{ status: FeedbackStatus; updatedAt: string }> {
  return http.post<{ status: FeedbackStatus; updatedAt: string }, typeof input>(
    '/feedback/admin/review',
    input,
    { header: authHeader(token), showError: false },
  )
}

/** 我自己的 openid（配 FEEDBACK_ADMIN_OPENIDS 时用得上；回音壁页长按标题也会显示） */
export function fetchFeedbackWhoami(
  token: string,
): Promise<{ openid: string; isAdmin: boolean; adminCount: number; needBootstrap: boolean }> {
  return http.get<{ openid: string; isAdmin: boolean; adminCount: number; needBootstrap: boolean }>(
    '/feedback/whoami',
    { header: authHeader(token), showError: false },
  )
}

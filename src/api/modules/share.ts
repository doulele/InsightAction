/**
 * 分享接口层（2026-09-21 建立）。
 *
 *   POST /guanzhi/share/publish            { 一条的字段 } → { token, h5Url, expiresAt, bytes }  需登录
 *   POST /guanzhi/share/revoke/:token                                        → { removed }      需登录（仅发布者）
 *   GET  /guanzhi/share/mine                                                 → { items, stats } 需登录
 *   GET  /guanzhi/share/item/:token                                          → { snapshot }     **免登录**
 *
 * 为什么读取是免登录、发布/撤回要登录：
 *  · 好友点开分享时没有登录态，也不该为了看一条分享去静默登录 —— 读取必须敞开（靠 token 不可枚举 + 有效期兜）；
 *  · 撤回要**认主人**（后端比对 openid 哈希），不能让任何人拿 token 就把别人的分享撤掉。
 *
 * 两条出口共用**同一份快照**：小程序卡片（只读分享页）与网页链接（`h5Url`）指向同一条，
 * 撤一次两处同时失效。
 *
 * 隐私：发布 = 把**你选中的那一条**上传到服务器并公开可读（默认 30 天、可撤回）。
 * 这是本应用唯一的"内容公开可读"功能，口径见 PRIVACY.md 第 12 节 —— 改这里之前先读它。
 */
import { http } from '@/api/http'

const authHeader = (token: string): Record<string, string> => ({ Authorization: `Bearer ${token}` })

/** 发布时交给服务器的字段（与后端 shareStore 的 normalize 一一对应） */
export interface ShareBody {
  kind: string
  form: string
  title?: string
  summary?: string
  content?: string
  contentHtml?: string
  golden?: string[]
  viewpoints?: Array<{ title?: string; text?: string }>
  insight?: string
  why?: string
  topics?: string[]
  tags?: string[]
  sourceName?: string
  link?: string
  videoUrl?: string
}

/** 服务器上那一份（读回来时多两个时间字段） */
export interface ShareSnapshot extends ShareBody {
  publishedAt?: string
  expiresAt?: string
}

export interface SharePublishResult {
  token: string
  /** 网页版链接：发到微信之外（朋友圈 / 群公告 / 电脑浏览器）用这个 */
  h5Url: string
  expiresAt: string
  bytes: number
}

/** 「我发出去的」一条（只回 token 与时间，不回内容 —— 内容在读接口那边） */
export interface ShareMineItem {
  token: string
  createdAt: string
  expiresAt: string
}

/**
 * 发布一条。
 * 超时给 20 秒：一条正文最大 1 万字，弱网下上传要一会儿。
 */
export function publishShare(token: string, body: ShareBody): Promise<SharePublishResult> {
  return http.post<SharePublishResult, ShareBody>('/share/publish', body, {
    header: authHeader(token),
    timeout: 20000,
    /* 文案由调用方给（要区分"内容太长""今天发太多""网络不通"），这里不重复弹 */
    showError: false,
  })
}

/** 撤回一条（仅发布者；后端不区分"不是你的"与"不存在"，一律 40400） */
export function revokeShare(token: string, shareToken: string): Promise<{ removed: boolean }> {
  return http.post<{ removed: boolean }, Record<string, never>>(
    `/share/revoke/${shareToken}`,
    {},
    { header: authHeader(token), timeout: 15000, showError: false },
  )
}

/** 我还没过期的分享 */
export function fetchMyShares(
  token: string,
): Promise<{ items: ShareMineItem[]; stats: { count: number; bytes: number } }> {
  return http.get<{ items: ShareMineItem[]; stats: { count: number; bytes: number } }>('/share/mine', {
    header: authHeader(token),
    timeout: 15000,
    showError: false,
  })
}

/**
 * 读一条（**免登录**）—— 小程序只读分享页进来就调它。
 * 失败通常只有一个原因：这条已被撤回或已过期（后端 40400），页面按"看不到了"渲染。
 */
export function fetchSharedItem(shareToken: string): Promise<{
  token: string
  snapshot: ShareSnapshot
  h5Url: string
}> {
  return http.get<{ token: string; snapshot: ShareSnapshot; h5Url: string }>(
    `/share/item/${encodeURIComponent(shareToken)}`,
    { showError: false, timeout: 15000 },
  )
}

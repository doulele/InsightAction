/**
 * AI 三能力接口层（需登录）。
 *
 *   POST /ai/feynman  { text }        费曼速记：检验一段理解是不是真懂
 *   POST /ai/tags     { text }        智能标签：给一条内容打 3~5 个检索标签
 *   POST /ai/digest   { items: [] }   极简报：把一批记录压成一条
 *
 * 两点与别的模块不同，写在前头：
 *  1. **都要 token** —— 每次调用都真实产生 DeepSeek 费用，不鉴权等于把 Key 挂出去任人刷。
 *     好在登录是静默的（wx.login 不弹授权框），用户侧无感；
 *  2. **超时放宽到 30 秒** —— 模型推理通常 3~15 秒，http 默认 15 秒不够用，
 *     与其让用户看到"网络异常"，不如多等一会儿。
 *
 * showError 一律关掉：错误提示由 useAi 统一给（"AI 暂时不可用"），
 * 避免 http 层弹一次、页面再弹一次。
 */
import { http } from '@/api/http'

/** 单次调用的用量与成本。口径与后端每日一则一致，仅用于展示与排查，不参与业务逻辑 */
export interface AiMeta {
  model: string
  tokens: { prompt: number; completion: number; total: number }
  costYuan: number
}

/**
 * 结果来自哪里 —— **必须如实标注**。
 * 'local' 表示这是基础规则算出来的兜底结果（见 utils/localAi），不是模型产出。
 * 后端不返回这个字段，由 useAi 在拿到 AI 结果后补 'ai'。
 */
export type AiSource = 'ai' | 'local'

/** 费曼速记结果 */
export interface FeynmanResult {
  /** 是否讲明白了 */
  clear: boolean
  /** 没讲明白的地方（讲明白时为空数组） */
  issues: string[]
  /** 一句话大白话版 */
  plainVersion: string
  /** 一个追问 */
  question: string
  /** 结果来源（AI 产出 or 基础兜底） */
  source: AiSource
  meta: AiMeta
}

/** 智能标签结果 */
export interface TagsResult {
  tags: string[]
  source: AiSource
  meta: AiMeta
}

/** 极简报结果 */
export interface DigestResult {
  summary: string
  highlights: string[]
  source: AiSource
  meta: AiMeta
}

/** 生成的一句箴言。from 由后端给定（说明它是这次现写的，不是前人说的） */
export interface ProverbResult {
  text: string
  from: string
  source: AiSource
  meta: AiMeta
}

export type ProverbRaw = Omit<ProverbResult, 'source'>

/**
 * 后端原始返回 —— **不含 source**（后端不下发这个字段）。
 * source 由 useAi 补 'ai'，或由 utils/localAi 的兜底结果补 'local'。
 * 分开定义是为了让类型说实话：这一层拿到的就是没有来源标记的数据。
 */
export type FeynmanRaw = Omit<FeynmanResult, 'source'>
export type TagsRaw = Omit<TagsResult, 'source'>
export type DigestRaw = Omit<DigestResult, 'source'>

const authHeader = (token: string): Record<string, string> => ({ Authorization: `Bearer ${token}` })

/** AI 推理远慢于普通接口，统一放宽超时 */
const AI_TIMEOUT = 30000

/** 费曼速记：检验一段理解是不是真懂 */
export function aiFeynman(token: string, text: string): Promise<FeynmanRaw> {
  return http.post<FeynmanRaw, { text: string }>(
    '/ai/feynman',
    { text },
    { header: authHeader(token), timeout: AI_TIMEOUT, showError: false },
  )
}

/** 智能标签：给一条内容打 3~5 个检索标签 */
export function aiTags(token: string, text: string): Promise<TagsRaw> {
  return http.post<TagsRaw, { text: string }>(
    '/ai/tags',
    { text },
    { header: authHeader(token), timeout: AI_TIMEOUT, showError: false },
  )
}

/** 极简报：把一批记录压成一条 */
export function aiDigest(token: string, items: string[]): Promise<DigestRaw> {
  return http.post<DigestRaw, { items: string[] }>(
    '/ai/digest',
    { items },
    { header: authHeader(token), timeout: AI_TIMEOUT, showError: false },
  )
}

/**
 * 写一句箴言：照着收藏气质现写一句（后端 POST /ai/proverb）。
 *
 * **刻意不走 useAi 的 run()**：那套机制要求每个能力都有本地兜底，
 * 而这一项给不出 —— 用规则"写一句没听过的新句子"做不到，
 * 从内置库随机挑一句冒充"新写的"是欺骗。所以这里没有兜底，
 * 失败就是失败，由调用方自己决定怎么提示（页面层还没接入，见下方说明）。
 *
 * @param tags    收藏句子的标签偏好（后端只用来把握气质）
 * @param samples 收藏过的句子样例（后端严禁复述/改写它们）
 */
export function aiProverb(
  token: string,
  opts: { tags?: string[]; samples?: string[] } = {},
): Promise<ProverbRaw> {
  return http.post<ProverbRaw, { tags?: string[]; samples?: string[] }>(
    '/ai/proverb',
    { tags: opts.tags, samples: opts.samples },
    { header: authHeader(token), timeout: AI_TIMEOUT, showError: false },
  )
}

/* ---------------- 开通审批（2026-09-26 加，仅管理员） ---------------- */

/** 一条开通申请 / 一条被拒记录 */
export interface AiApplicant {
  openid: string
  /** 用户自己填的一句称呼（可空）—— 只有这个能帮他认人 */
  name: string
  /** 申请时间（ISO） */
  at: string
  /** 被拒时间（ISO）；只有 `rejected` 列表里的记录有值 */
  rejectedAt?: string
}

/** 已开通名单里的一条 */
export interface AiEntry {
  openid: string
  name: string
  at: string
}

/** 审批页一次性拿到的全部数据 */
export interface AiReviewData {
  /** 待批申请 */
  pending: AiApplicant[]
  /** 被拒记录（留痕，随时可以改判） */
  rejected: AiApplicant[]
  /** 当前已开通名单 */
  entries: AiEntry[]
}

/**
 * 审批页数据（待批 + 被拒 + 已开通）。
 *
 * 为什么管理员身份不靠密钥：审批要在小程序里点，而管理密钥一旦进小程序包就等于公开
 * （反编译即得，谁都能给自己开 AI、烧额度）—— 所以走**登录态**，
 * 后端拿 `req.openid` 比对 `AI_ADMIN_OPENIDS`。不是管理员会拿 403。
 *
 * 超时给 15 秒：这里只是一次文件读取，不像 AI 推理那么慢，但也没必要卡 30 秒。
 */
export function aiReviewList(token: string): Promise<AiReviewData> {
  return http.get<AiReviewData>('/ai/review/list', {
    header: authHeader(token),
    timeout: 15000,
    showError: false,
  })
}

/** 通过：加进白名单（后端热加载 —— 被批的人不用重新登录，服务也不用重启） */
export function aiReviewApprove(token: string, openid: string, name = ''): Promise<AiEntry> {
  return http.post<AiEntry, { openid: string; name: string }>(
    '/ai/review/approve',
    { openid, name },
    { header: authHeader(token), timeout: 15000, showError: false },
  )
}

/**
 * 不通过：**留痕**（后端把这条标成 rejected，不删）。
 * 对方下次点开关会看到「上次没通过 · 可以再申请一次」，再申请一次就回到待批。
 */
export function aiReviewReject(token: string, openid: string): Promise<{ rejected: boolean }> {
  return http.post<{ rejected: boolean }, { openid: string }>(
    '/ai/review/reject',
    { openid },
    { header: authHeader(token), timeout: 15000, showError: false },
  )
}

/** 从白名单移除（收窄权限；`.env` 里那份种子要去 .env 改） */
export function aiReviewRevoke(token: string, openid: string): Promise<{ removed: boolean }> {
  return http.post<{ removed: boolean }, { openid: string }>(
    '/ai/review/revoke',
    { openid },
    { header: authHeader(token), timeout: 15000, showError: false },
  )
}

/* ---------------- 访问自检（2026-09-23 加） ---------------- */

/**
 * AI 的访问自检结果。
 *
 * 为什么必须问服务端：前端拿不到自己的 openid，"我在不在白名单里"只有后端知道。
 * `mode` 三态与后端一一对应：
 *   'open'   —— 名单没配 = 不限（能登录就能用）；
 *   'allow'  —— 在名单里；
 *   'denied' —— 不在名单里（设置页据此弹"联系开通 + 二维码"）。
 */
export interface AiAccessInfo {
  mode: 'open' | 'allow' | 'denied'
  allowed: boolean
  /** 「需要开通」时给用户扫的二维码地址；空串 = 后端没配，前端整块不显示 */
  qrcode: string
  /**
   * 这个人是不是**审批管理员**（后端比对 `AI_ADMIN_OPENIDS`）—— 2026-09-26 加。
   * 只有 true 时设置页才渲染「AI 开通申请」入口。
   */
  admin: boolean
  /**
   * 他自己的申请状态 —— 决定「需要开通」弹框里那个按钮长什么样：
   * `'none'` 没申请过（「申请开通」）/ `'pending'` 待批（「已申请 · 等我开通」）/
   * `'rejected'` 上次没通过（「再次申请」）。
   * 没有它，被拒的人会一直点同一个按钮、还以为自己没申请过（2026-09-26 加）。
   */
  applyState: AiApplyState
}

/** 申请状态：没申请过 / 待批 / 上次没通过 */
export type AiApplyState = 'none' | 'pending' | 'rejected'

/**
 * 查一次"我的账号能不能用 AI"。
 * `showError: false` —— 这一条是**探路**，探不到不该弹错（由调用方按需解释）。
 */
export function aiAccess(token: string): Promise<AiAccessInfo> {
  return http.get<AiAccessInfo>('/ai/access', {
    header: authHeader(token),
    timeout: 10000,
    showError: false,
  })
}

/**
 * 申请开通 AI（2026-09-23 加）。
 *
 * 普通用户拿不到自己的 openid（要装开发者工具看网络面板），所以只能由小程序把 openid 报上来：
 * 后端记进 `data/ai-requests.json`，开发者看到后批准即可。**他全程不需要知道 openid 是什么。**
 *
 * @param name 用户自己填的一句称呼（可空，只用于开发者辨认是谁）
 * 返回里刻意没有 openid —— 前端不需要它，少一处会泄露身份标识的地方。
 */
export function aiApply(token: string, name = ''): Promise<{ requested: boolean }> {
  return http.post<{ requested: boolean }, { name: string }>(
    '/ai/apply',
    { name },
    { header: authHeader(token), timeout: 10000, showError: false },
  )
}

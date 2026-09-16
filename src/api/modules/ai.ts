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

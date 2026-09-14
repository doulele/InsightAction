/**
 * 内容下发接口：题库 / 计分分档 / 称号文案。
 *
 * 性质：纯下行 —— 只拉取，不上报任何用户数据。
 * 后端实现：InsightActionBacend/routes/content.js；运营位：InsightActionBacend/config/content.json
 * （改题目、调分值、换称号都不用重新发版）
 *
 * 注意：这是"覆盖"而非"替代"——src/config/assessment.ts 里的内置题库永远保留作兜底，
 * 详见 src/stores/content.ts。
 */
import { http } from '@/api/http'
import type { AssessmentBank } from '@/config/assessment'
import type { ModeId } from '@/config/modes'

/**
 * 分档阈值。**推荐用比例**（lowRatio / highRatio）：题库题量或分值一变，
 * 绝对分阈值就会整体错位（旧版踩过这个坑）。
 * lowMax / highMin 保留作兼容：按旧版 18 分标定换算成比例（见 stores/content.ts 的 tiers()）。
 */
export interface AssessmentScoring {
  /** 得分率 <= lowRatio 判为低档（推荐，如 0.35） */
  lowRatio?: number
  /** 得分率 >= highRatio 判为高档（推荐，如 0.7） */
  highRatio?: number
  /** 旧字段：总分 <= lowMax 判为低档（按 6 题 18 分标定） */
  lowMax?: number
  /** 旧字段：总分 >= highMin 判为高档 */
  highMin?: number
}

export interface RemoteAssessment {
  scoring?: AssessmentScoring
  banks?: AssessmentBank[]
}

/** 远端下发的「每日一则」条目（缺字段由前端 sanitizeDaily 兜底或整批丢弃） */
export interface RemoteDailyItem {
  id?: string
  kind?: '事' | '理' | '典'
  title: string
  text: string
  source?: string
  /** 反例 / 不适用的边界 —— 给「反驳」动作一个抓手 */
  counter?: string
  tags?: string[]
}

/**
 * 内容库下发。daily 用**独立版本号** dailyVersion，不吃全局 version：
 * 换一批每日一则不牵动题库与短语的覆盖闸门（详见 config/daily.ts 的 LOCAL_DAILY_VERSION）。
 */
export interface RemoteLibrary {
  dailyVersion?: number
  daily?: RemoteDailyItem[]
}

export interface RemoteContent {
  version?: number
  updatedAt?: string
  assessment?: RemoteAssessment
  /** 状态栏文案模板：hall → mode → 带占位符的模板串 */
  lexicon?: LexiconPayload
  /** 主题化短语：短语键 → mode → 固定短语（按钮/确认框/toast） */
  phrases?: PhrasesPayload
  /** 内容库（每日一则等，独立版本号） */
  library?: RemoteLibrary
}

export type PhrasesPayload = Record<string, Partial<Record<ModeId, string>>>

export type HallId = 'observe' | 'pause' | 'reflect' | 'action'

export type LexiconPayload = Partial<Record<HallId, Partial<Record<ModeId, string>>>>

export function fetchContent(): Promise<RemoteContent> {
  // 带时间戳穿透缓存（与 /skins、/app/config 同策略）
  return http.get<RemoteContent>(`/content?_t=${Date.now()}`, { showError: false })
}

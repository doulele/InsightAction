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

export interface AssessmentScoring {
  /** 总分 <= lowMax 判为低档 */
  lowMax: number
  /** 总分 >= highMin 判为高档 */
  highMin: number
}

export interface RemoteAssessment {
  scoring?: AssessmentScoring
  banks?: AssessmentBank[]
}

export interface RemoteContent {
  version?: number
  updatedAt?: string
  assessment?: RemoteAssessment
  /** 状态栏文案模板：hall → mode → 带占位符的模板串 */
  lexicon?: LexiconPayload
}

export type HallId = 'observe' | 'pause' | 'reflect' | 'action'

export type LexiconPayload = Partial<Record<HallId, Partial<Record<ModeId, string>>>>

export function fetchContent(): Promise<RemoteContent> {
  // 带时间戳穿透缓存（与 /skins、/app/config 同策略）
  return http.get<RemoteContent>(`/content?_t=${Date.now()}`, { showError: false })
}

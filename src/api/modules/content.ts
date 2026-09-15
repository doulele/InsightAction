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

/**
 * 外部入口（信息工作台 wellwin.top/staticTool/hotstation）。
 *
 * 为什么只有「一个地址」，没有任何内容，也没有任何数字：
 *  - 本小程序是**个人主体**，而「新闻资讯」类目个人主体不可选 —— 页面里一旦出现
 *    新闻标题/摘要，就构成「类目与实际内容不符」（比内容本身更容易被驳回或整改）；
 *    所以事实层留在网站侧（那边有备案、自担内容责任），小程序只留认知层；
 *  - 曾经还下发过"今天有多少个事件"的数字，但实测每天都是 40~60、界面上已不再显示，
 *    后端取数逻辑遂一并删除 —— 现在它是一个**完全不依赖外部接口**的静态入口。
 *
 * 个人主体也没有业务域名白名单，web-view 打不开外站，所以出口一律是
 * 「复制链接 + 提示」（与本项目其它外链一致，见 subpkg-observe 的 copyThenTip）。
 */
export interface RemotePortal {
  /** 后端是否启用（false/缺省时前端不显示入口） */
  enabled?: boolean
  /** 复制给用户、由用户在浏览器打开的地址 */
  url?: string
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
  /** 外部入口（信息工作台）—— 运行时数据，不来自 content.json */
  portal?: RemotePortal
}

export type PhrasesPayload = Record<string, Partial<Record<ModeId, string>>>

export type HallId = 'observe' | 'pause' | 'reflect' | 'action'

export type LexiconPayload = Partial<Record<HallId, Partial<Record<ModeId, string>>>>

export function fetchContent(): Promise<RemoteContent> {
  // 带时间戳穿透缓存（与 /skins、/app/config 同策略）
  return http.get<RemoteContent>(`/content?_t=${Date.now()}`, { showError: false })
}

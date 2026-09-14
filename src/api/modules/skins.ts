/**
 * 皮肤横幅图配置接口。
 *
 * 设计取舍：后端只下发「图片地址」，图片本体走 nginx 直链（不占 Node 带宽）。
 * 好处：换图、加第四个模式，都只改后端配置，不用重新发版小程序。
 */
import { http } from '@/api/http'
import type { ModeId } from '@/config/modes'
import type { MarkKey } from '@/config/marks'

export interface SkinItem {
  /** 对应模式 id：normal / tech / dao */
  mode: ModeId
  /** 图片公网地址（https，必须在小程序 downloadFile 合法域名内） */
  url: string
  /** 原图宽高，便于按比例占位 */
  width?: number
  height?: number
}

export interface SkinConfig {
  /** 配置版本号，换图后后端会 +1 */
  version?: string
  updatedAt?: string
  /** 图片目录前缀 */
  baseUrl?: string
  skins: SkinItem[]
  /**
   * 模块标志物地址（可选）：`{ 'pause.focus': { normal: url, tech: url, dao: url } }`。
   *
   * 为什么标成可选：后端下发最稳（换目录 / 上 CDN / 带签名参数都不会错 ✓），
   * 但没配时前端会退回"横幅同目录 + 固定文件名"推导（见 config/marks.ts ✓）——
   * 这样两端能独立升级，谁先上都不影响对方 ✓
   */
  marks?: Partial<Record<MarkKey, Partial<Record<ModeId, string>>>>
}

/**
 * 拉取横幅图配置。
 * showError: false —— 横幅属于锦上添花，失败时不弹 toast，
 * 由 store 静默忽略，页面继续用主题渐变兜底。
 */
export function fetchSkinConfig(): Promise<SkinConfig> {
  /**
   * 带时间戳当缓存穿透参数。
   *
   * 为什么需要：接口响应自带 Cache-Control: max-age=<SKIN_MAX_AGE>，
   * 一旦经过 CDN / 代理 / 客户端缓存，后端改了配置（换图、升版本号）前端仍会拿到旧值，
   * 表现为「后端明明已是 .jpg?v=2，页面还在请求 .png」。
   * /skins 响应只有几百字节，每次冷启动真打一次的成本可忽略。
   */
  return http.get<SkinConfig>(`/skins?_t=${Date.now()}`, { showError: false })
}

/**
 * 远端配置接口：公告 / 版本信息 / 功能开关。
 *
 * 性质：纯下行 —— 只拉取，不上报任何用户数据（版本比较在客户端做），因此不涉及隐私合规。
 * 后端实现：InsightActionBacend/routes/app.js；运营位：InsightActionBacend/config/app-config.json
 * （改那个 JSON 即可改线上文案，无需重启进程、无需重新发版）
 */
import { http } from '@/api/http'

export interface RemoteNotice {
  id: string
  title: string
  body: string
  /** warn 用于维护/异常提示（前端可据此换主色） */
  level: 'info' | 'warn'
  /** 是否只提示一次 */
  once: boolean
  link?: string
}

export interface RemoteAppInfo {
  /** 最新版本号（用于展示） */
  latestVersion: string
  /** 最低支持版本：客户端低于它即视为不再支持 */
  minVersion: string
  /** 是否强制更新（配合 latestVersion 使用） */
  forceUpdate: boolean
  updateNote: string
}

export interface AppConfig {
  configVersion?: number
  updatedAt?: string
  notice?: RemoteNotice | null
  app?: RemoteAppInfo
  /** 功能开关：false = 关闭；未列出的键一律视为开启 */
  features?: Record<string, boolean>
}

export function fetchAppConfig(): Promise<AppConfig> {
  // 带时间戳穿透缓存（与 /skins 同策略：配置类接口的改动要尽快生效）
  return http.get<AppConfig>(`/app/config?_t=${Date.now()}`, { showError: false })
}

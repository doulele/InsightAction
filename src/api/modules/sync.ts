/**
 * 云备份接口（需登录）。
 *
 * 登录链路：wx.login() → code → POST /auth/login → JWT（7 天有效）。
 * ⚠️ wx.login 是**静默**的（不弹授权框、不在微信隐私接口清单里），
 *    所以"登录"对用户是无感的：点一下「开启云备份」即可完成。
 * 服务端按 openid（哈希后）隔离数据，前端只保存 token，不保存 openid。
 */
import { http } from '@/api/http'
import { SCHEMA_VERSION } from '@/config/schema'

export interface SyncMeta {
  updatedAt: string
  /** 未压缩体积（字节） */
  bytes: number
  /** 压缩后体积（便于观察 gzip 效果） */
  gzBytes?: number
  /** 包含的 store 数量 */
  stores: number
  source: 'manual' | 'auto' | 'prev'
  /** 服务器是否还留着"上一版"（误覆盖救援用） */
  hasPrev?: boolean
  /** 数据结构版本（服务端回传；未回传时前端按 1 处理） */
  schema?: number
}

export interface LoginResult {
  token: string
  openid?: string
}

export interface BackupResult {
  saved: boolean
  /** true = 被缩水保护拦下（不是错误，只是没覆盖） */
  skipped?: boolean
  reason?: string
  meta?: SyncMeta
}

export interface SnapshotResult {
  meta: SyncMeta
  data: Record<string, string>
}

/** 登录：拿 code 换 JWT */
export function wxLogin(): Promise<LoginResult> {
  return new Promise((resolve, reject) => {
    uni.login({
      provider: 'weixin',
      success: (res) => {
        if (!res?.code) {
          reject(new Error('微信登录未返回 code'))
          return
        }
        http
          .post<LoginResult, { code: string }>('/auth/login', { code: res.code }, { showError: false })
          .then(resolve)
          .catch(reject)
      },
      fail: (err) => reject(new Error(err?.errMsg || '微信登录失败')),
    })
  })
}

const authHeader = (token: string): Record<string, string> => ({ Authorization: `Bearer ${token}` })

/** 云端最新快照的元信息（没有备份过时返回 null） */
export function fetchSyncMeta(token: string): Promise<SyncMeta | null> {
  return http.get<SyncMeta | null>('/sync/meta', { header: authHeader(token), showError: false })
}

/**
 * 上传一份快照（source = 'auto' 时服务端会做缩水保护）。
 *
 * schema 一并上报（后端目前可忽略，属向前兼容字段）：
 * 将来后端把它存进 meta 并回传，就能在"用旧客户端恢复新快照"时提前拦下。
 */
export function uploadBackup(
  token: string,
  data: Record<string, string>,
  source: 'manual' | 'auto',
  schema: number = SCHEMA_VERSION,
): Promise<BackupResult> {
  return http.post<BackupResult, { data: Record<string, string>; source: string; schema?: number }>(
    '/sync/backup',
    { data, source, schema },
    { header: authHeader(token), showError: false },
  )
}

/** 取回快照（which = 'prev' 取"上一版"，用于误覆盖救援） */
export function downloadSnapshot(token: string, which: 'latest' | 'prev' = 'latest'): Promise<SnapshotResult> {
  return http.get<SnapshotResult>(`/sync/snapshot?which=${which}`, {
    header: authHeader(token),
    showError: false,
  })
}

/** 关闭云备份：删除云端全部数据 */
export function deleteCloudBackup(token: string): Promise<{ removed: number }> {
  return http.delete<{ removed: number }>('/sync', { header: authHeader(token), showError: false })
}

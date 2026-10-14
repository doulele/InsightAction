/**
 * 云备份接口（需登录）。
 *
 * 登录本身不在这里 —— 见 `api/modules/auth.ts`（`wxLogin()`）。
 * 本模块只负责「已拿到 token 之后」的几件事：看元信息 / 列版本 / 取回某一版 / 上传 / 删除。
 * 调用方一律通过 `account.withAuth()` 拿 token，不要自己调登录。
 *
 * 2026-10-12 起云端保留**多个版本**（默认 5 份历史），恢复时可以挑一版 ——
 * 所以多了 `fetchVersions()` 与「按 id 取回」，`which=prev` 只作为旧口径的兼容保留。
 */
import { http } from '@/api/http'
import { SCHEMA_VERSION } from '@/config/schema'

/** 快照来源：手动备份 / 自动备份 / 恢复前留档 / 旧版的"上一版" */
export type SnapshotSource = 'manual' | 'auto' | 'pre-restore' | 'prev'

export interface SyncMeta {
  updatedAt: string
  /** 未压缩体积（字节） */
  bytes: number
  /** 压缩后体积（便于观察 gzip 效果） */
  gzBytes?: number
  /** 包含的 store 数量 */
  stores: number
  source: SnapshotSource
  /** 服务器是否还留历史版本（误覆盖救援用）—— 等价于 versions > 0 */
  hasPrev?: boolean
  /** 服务器保留的**历史版本份数**（不含"最新"那一份） */
  versions?: number
  /** 数据结构版本（服务端回传；未回传时前端按 1 处理） */
  schema?: number
  /** 本次上传的内容与上一版完全相同（没有新变化）—— 服务端会去重、不占版本名额 */
  unchanged?: boolean
}

/** 一个可恢复的版本：meta + 它在服务器上的 id（取回时用它，而不是用序号） */
export interface SyncVersion extends SyncMeta {
  /** 'latest' 或 'v<时间戳>' */
  id: string
  /** 是不是当前的最新快照 */
  latest: boolean
}

export interface VersionListResult {
  versions: SyncVersion[]
  /** 服务器保留的历史版本份数上限（用于文案"最多留 N 版"） */
  keep: number
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

const authHeader = (token: string): Record<string, string> => ({ Authorization: `Bearer ${token}` })

/** 云端最新快照的元信息（没有备份过时返回 null） */
export function fetchSyncMeta(token: string): Promise<SyncMeta | null> {
  return http.get<SyncMeta | null>('/sync/meta', { header: authHeader(token), showError: false })
}

/**
 * 可恢复的版本列表（最新在前，其后是各历史版本）。
 * 只回元信息，不回正文 —— 用户挑定一版再取那一版。
 */
export function fetchVersions(token: string): Promise<VersionListResult> {
  return http.get<VersionListResult>('/sync/versions', { header: authHeader(token), showError: false })
}

/**
 * 上传一份快照（source = 'auto' / 'pre-restore' 时服务端会做缩水保护）。
 *
 * schema 一并上报（服务端存进 meta 并回传，用于"旧客户端恢复新快照"时提前拦下）。
 *
 * `force`（2026-10-14 加）：手动备份的**极端**缩水在服务端也会被拦一道
 * （不到云端的 20% 且云端 >64KB）。用户在危险确认框里看过后果并点了「仍然上传」时
 * 才带它 —— 那道闸门挡的是"没弹任何确认"的路径，不是用户自己。
 */
export function uploadBackup(
  token: string,
  data: Record<string, string>,
  source: 'manual' | 'auto' | 'pre-restore',
  schema: number = SCHEMA_VERSION,
  force = false,
): Promise<BackupResult> {
  return http.post<
    BackupResult,
    { data: Record<string, string>; source: string; schema?: number; force?: boolean }
  >(
    '/sync/backup',
    { data, source, schema, force },
    { header: authHeader(token), showError: false },
  )
}

/**
 * 取回某一版快照。
 * @param id 'latest'（缺省）或列表里给的 `v<时间戳>`
 */
export function downloadSnapshot(token: string, id: string = 'latest'): Promise<SnapshotResult> {
  return http.get<SnapshotResult>(`/sync/snapshot?id=${encodeURIComponent(id)}`, {
    header: authHeader(token),
    showError: false,
  })
}

/** 关闭云备份：删除云端全部数据 */
export function deleteCloudBackup(token: string): Promise<{ removed: number }> {
  return http.delete<{ removed: number }>('/sync', { header: authHeader(token), showError: false })
}

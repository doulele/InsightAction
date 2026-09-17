/**
 * 云备份的高层动作：登录、备份、取回、删除、自动触发。
 * 设置页与 App.vue 共用，避免把网络与登录细节散在页面里。
 *
 * 三道防线（按顺序）：
 *   1. 前端：数据为空则不备份；距上次不足 24 小时不自动备份；
 *   2. 服务端：自动备份做缩水保护（体积骤降视为误清空，跳过不覆盖）；
 *   3. 服务端：覆盖前把上一份降级为 .prev，误覆盖时还能救回来。
 */
import { applyBackup, collectBackup } from './localBackup'
import type { BackupPayload } from './localBackup'
import { STORE_PREFIX } from '@/stores/index'
import { useAccountStore } from '@/stores/account'
import { deleteCloudBackup, downloadSnapshot, fetchSyncMeta, uploadBackup } from '@/api/modules/sync'
import type { SyncMeta } from '@/api/modules/sync'

/** 自动备份的最小间隔：24 小时 */
const AUTO_INTERVAL_MS = 24 * 60 * 60 * 1000

/**
 * 只留在本机、不随云备份上传的 store。
 *
 *  - **body**：步数属健康类敏感数据，能不上传就不上传 —— 隐私保护指引里也是这么写的，
 *    少声明一条「我们云端有你的健康数据」，也少一份泄露面。
 *  - **capsule**（2026-09-17）：时间胶囊是写给未来的自己的私话，
 *    页面上也如实写了"只在本机"；让它上行会变成一句假话。
 *
 * 代价：换机恢复时靠本地备份**文件**（导出/恢复那条路）才带得走，云端不带。
 */
const LOCAL_ONLY_STORES: string[] = ['body', 'capsule']

export interface BackupOutcome {
  saved: boolean
  skipped: boolean
  reason: string
  meta?: SyncMeta
}

/** 立即备份（手动）：用户的明确意图，服务端不做缩水拦截 */
export async function backupNow(): Promise<BackupOutcome> {
  const account = useAccountStore()
  const payload = collectBackup()
  // 剔除「只在本机」的 store（见 LOCAL_ONLY_STORES）
  const data = { ...payload.data }
  for (const key of LOCAL_ONLY_STORES) delete data[STORE_PREFIX + key]

  const stores = Object.keys(data).length
  if (!stores) {
    return { saved: false, skipped: true, reason: '本机还没有可备份的数据' }
  }

  const res = await account.withAuth((t) => uploadBackup(t, data, 'manual', payload.schema))
  if (res.saved) account.markBackedUp(stores)
  return {
    saved: !!res.saved,
    skipped: !!res.skipped,
    reason: res.reason || '',
    meta: res.meta,
  }
}

/**
 * 自动备份（启动时调用）：距上次不足 24 小时则跳过。
 * 静默失败——备份是后台行为，任何异常都不该打扰用户。
 */
export async function autoBackupIfDue(): Promise<void> {
  const account = useAccountStore()
  if (!account.cloudEnabled) return

  const last = account.lastBackupAt ? Date.parse(account.lastBackupAt) : 0
  if (Date.now() - last < AUTO_INTERVAL_MS) return

  try {
    const outcome = await backupNow()
    if (!outcome.saved && outcome.reason) {
      console.warn('[backup] 自动备份未执行：', outcome.reason)
    }
  } catch (e) {
    console.warn('[backup] 自动备份失败（忽略）：', e)
  }
}

/** 取云端元信息（未开启/未备份过返回 null） */
export async function loadCloudMeta(): Promise<SyncMeta | null> {
  const account = useAccountStore()
  try {
    return await account.withAuth((t) => fetchSyncMeta(t))
  } catch (e) {
    console.warn('[backup] 读取云端元信息失败：', e)
    return null
  }
}

/**
 * 拉取云端快照并转成本地可恢复的结构（**不落盘**，交给调用方二次确认后再 apply）。
 * which = 'prev' 可取"上一版"（误覆盖救援）。
 */
export async function fetchCloudSnapshot(which: 'latest' | 'prev' = 'latest'): Promise<BackupPayload> {
  const account = useAccountStore()
  const snapshot = await account.withAuth((t) => downloadSnapshot(t, which))
  return {
    app: 'guanzhi',
    // 服务端尚未回传 schema 时按 1（旧快照）处理：旧结构可被迁移兜底，恢复是安全的
    schema: snapshot.meta?.schema ?? 1,
    exportedAt: snapshot.meta?.updatedAt || '',
    data: snapshot.data || {},
  }
}

/** 应用云端快照（覆盖本机，写 storage + 回写内存 store） */
export function applyCloudSnapshot(payload: BackupPayload): { restoredKeys: number; restoredStores: number } {
  return applyBackup(payload)
}

/** 关闭云备份：删除云端全部数据并复位本机开关 */
export async function disableCloudBackup(): Promise<number> {
  const account = useAccountStore()
  const res = await account.withAuth((t) => deleteCloudBackup(t))
  account.cloudEnabled = false
  account.lastBackupAt = ''
  account.lastBackupStores = 0
  return res.removed ?? 0
}

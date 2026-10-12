/**
 * 云备份的高层动作：登录、备份、列版本、取回、删除、自动触发。
 * 设置页与 App.vue 共用，避免把网络与登录细节散在页面里。
 *
 * **四道防线**（按发生的先后）：
 *   1. 前端：数据为空则不备份；距上次不足 24 小时不自动备份；手动备份先弹二次确认，
 *      并在"这批数据明显比云端少"时给强警告（那才是"备份上去的也是错的"那种事故）；
 *   2. 服务端：自动备份 / 恢复前留档做缩水保护（体积骤降视为误清空，跳过不覆盖）；
 *   3. 服务端：覆盖前把当前快照**归档成历史版本**（默认留 5 份）—— 误覆盖不再不可逆；
 *   4. 前端：恢复前自动留档本机当前数据（source = 'pre-restore'），让"恢复"本身也可回退。
 *
 * 第 3、4 条是 2026-10-12 补的。在此之前只有"最新 + 上一版"两份，用户遇到
 * 「数据被清了 → 随手点了立即备份 → 云端好数据被空数据顶掉」，两次就彻底没救。
 */
import { applyBackup, byteLength, collectBackup, summarize } from './localBackup'
import type { BackupPayload, BackupSummary } from './localBackup'
import { STORE_PREFIX } from '@/stores/index'
import { useAccountStore } from '@/stores/account'
import { deleteCloudBackup, downloadSnapshot, fetchSyncMeta, fetchVersions, uploadBackup } from '@/api/modules/sync'
import type { SyncMeta, VersionListResult } from '@/api/modules/sync'
import { SHRINK_WARN_RATIO } from '@/config/backup'

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
 * ⚠️ 恢复确认的文案必须把这件事说出来（恢复的是云端那一份，本机这两个 store 保持原样）。
 */
const LOCAL_ONLY_STORES: string[] = ['body', 'capsule']

export interface BackupOutcome {
  saved: boolean
  skipped: boolean
  reason: string
  meta?: SyncMeta
}

/** 本机数据剔除"只在本机"的 store 之后，才是要上云的那一份 */
function cloudData(): { data: Record<string, string>; schema: number; stores: number } {
  const payload = collectBackup()
  const data = { ...payload.data }
  for (const key of LOCAL_ONLY_STORES) delete data[STORE_PREFIX + key]
  return { data, schema: payload.schema, stores: Object.keys(data).length }
}

/** 立即备份（手动）：用户的明确意图，服务端不做缩水拦截（但界面必须先弹二次确认） */
export async function backupNow(): Promise<BackupOutcome> {
  const account = useAccountStore()
  const { data, schema, stores } = cloudData()
  if (!stores) {
    return { saved: false, skipped: true, reason: '本机还没有可备份的数据' }
  }

  const res = await account.withAuth((t) => uploadBackup(t, data, 'manual', schema))
  if (res.saved) account.markBackedUp(stores)
  return {
    saved: !!res.saved,
    skipped: !!res.skipped,
    reason: res.reason || '',
    meta: res.meta,
  }
}

export interface BackupPreview extends BackupSummary {
  /** 本机这份数据明显比云端少（可能是误清空，确认框要重提示） */
  shrunk: boolean
  /** 云端现有体积（字节）；0 = 还没备份过 */
  cloudBytes: number
}

/**
 * 「立即备份」的二次确认所需的摘要（**不联网**，只读本机 + 传进来的云端 meta）。
 *
 * 为什么要先算：`collectBackup()` 是同步读 storage，数据一多会卡主线程几百毫秒 ——
 * 先用 loading 盖住，再把"共多少项、多大、云端现在多大"摆出来让用户决定要不要覆盖。
 */
export function previewBackup(cloud?: SyncMeta | null): BackupPreview {
  const payload = collectBackup()
  const sum = summarize(payload)
  const bytes = byteLength(JSON.stringify(payload))
  const cloudBytes = Number(cloud?.bytes) || 0
  // 云端太小（<4KB）时不判缩水：那本来就没什么可失去的（与服务端同一口径）
  const shrunk = cloudBytes > 4096 && bytes < cloudBytes * SHRINK_WARN_RATIO
  return { ...sum, shrunk, cloudBytes }
}

/**
 * 恢复前的自动留档：把本机**当前**这份数据先存成云端的一个版本。
 *
 * 这样"恢复"本身也变成可回退的动作 —— 挑错了版本，还能回到恢复前那一份。
 * 走与自动备份同一套缩水保护：本机已经是空数据时不会占掉一个版本名额。
 * 全程静默：留档失败绝不拦着用户恢复（那才是他此刻要做的事）。
 *
 * @returns 'off' 未开启云备份 / 'saved' 已留档 / 'skipped' 被跳过（空数据或被保护拦下）
 */
export async function backupBeforeRestore(): Promise<'off' | 'saved' | 'skipped'> {
  const account = useAccountStore()
  if (!account.cloudEnabled) return 'off'
  try {
    const { data, schema, stores } = cloudData()
    if (!stores) return 'skipped'
    const res = await account.withAuth((t) => uploadBackup(t, data, 'pre-restore', schema))
    if (res.saved) {
      account.markBackedUp(stores)
      return 'saved'
    }
    return 'skipped'
  } catch (e) {
    console.warn('[backup] 恢复前留档失败（不拦恢复）：', e)
    return 'skipped'
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

/**
 * 取云端元信息（返回 null = 云端**确实**还没有备份过）。
 *
 * **失败会抛**（网络 / 登录问题），由调用方决定怎么说 —— 这里刻意不吞异常：
 * "没有备份"与"没读到"在界面上的说法完全不同（前者引导去备份，后者该提示检查网络）。
 * 吞掉之后只剩一个 null，两种情形就分不开了（2026-10-12 改）。
 */
export async function loadCloudMeta(): Promise<SyncMeta | null> {
  const account = useAccountStore()
  return account.withAuth((t) => fetchSyncMeta(t))
}

/**
 * 取云端可恢复的版本列表（最新在前）。
 * 失败返回 null（页面按"没取到"提示，不能静默当成"没有备份"）。
 */
export async function loadCloudVersions(): Promise<VersionListResult | null> {
  const account = useAccountStore()
  try {
    return await account.withAuth((t) => fetchVersions(t))
  } catch (e) {
    console.warn('[backup] 读取云端版本列表失败：', e)
    return null
  }
}

/**
 * 拉取云端某一版快照并转成本地可恢复的结构（**不落盘**，交给调用方二次确认后再 apply）。
 *
 * @param id 版本列表里给的 `latest` / `v<时间戳>`
 */
export async function fetchCloudSnapshot(id: string = 'latest'): Promise<BackupPayload> {
  const account = useAccountStore()
  const snapshot = await account.withAuth((t) => downloadSnapshot(t, id))
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

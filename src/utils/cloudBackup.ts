/**
 * 云备份的高层动作：登录、备份、列版本、取回、删除、自动触发。
 * 设置页与 App.vue 共用，避免把网络与登录细节散在页面里。
 *
 * **五道防线**（按发生的先后，2026-10-14 补第 1、3 道）：
 *   1. 前端：数据为空则不备份；本机自上次上传以来没变则不重复上传整包；
 *      超过单份体积上限提前拦下（别传完一轮才被服务端拒）；手动备份先弹二次确认，
 *      并按"比基线少多少"给三档缩水提醒 —— 哪几个库明显变小会**点名**说出来；
 *   2. 服务端：自动备份 / 恢复前留档做缩水保护（体积骤降视为误清空，跳过不覆盖）；
 *   3. 服务端：**手动**备份的极端缩水也拦一道（不到云端的 20% 且云端 >64KB），
 *      客户端在用户看过危险确认框后带 `force` 放行 —— 挡的是"没弹任何确认"的野路子；
 *   4. 服务端：覆盖前把当前快照**归档成历史版本**（默认留 5 份）—— 误覆盖不再不可逆；
 *   5. 前端：恢复前自动留档本机当前数据（source = 'pre-restore'），让"恢复"本身也可回退。
 *
 * 第 3、4、5 条里的第 4、5 是 2026-10-12 补的。在此之前只有"最新 + 上一版"两份，
 * 用户遇到「数据被清了 → 随手点了立即备份 → 云端好数据被空数据顶掉」，两次就彻底没救。
 */
import { applyBackup, byteLength, collectBackup, summarize } from './localBackup'
import type { BackupPayload } from './localBackup'
import { STORE_PREFIX } from '@/stores/index'
import { useAccountStore } from '@/stores/account'
import { deleteCloudBackup, downloadSnapshot, fetchSyncMeta, fetchVersions, uploadBackup } from '@/api/modules/sync'
import type { SyncMeta, VersionListResult } from '@/api/modules/sync'
import { SHAPE_DROP, STORE_LABEL, UPLOAD_MAX_BYTES, shrinkLevelOf } from '@/config/backup'
import type { ShrinkLevel } from '@/config/backup'

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

/** 一份"要上云的数据"及其读数（体积与指纹都按**上云的那一份**算，不含只在本机的库） */
interface CloudData {
  data: Record<string, string>
  schema: number
  /** 包含的 store 数 */
  stores: number
  /** 与服务端 `meta.bytes` 同一把尺子：同一结构 JSON 的 UTF-8 字节数 */
  bytes: number
  /** 短 key → 该库的字节数（下次备份前拿它逐库对比） */
  shape: Record<string, number>
  /** 内容指纹（同一份数据必得同一个值） */
  fingerprint: string
}

/** FNV-1a 32 位。小程序里没有 crypto，而指纹只需要"同一份数据同一个值"，不求抗碰撞 */
function fnv1a(text: string): string {
  let h = 0x811c9dc5
  for (let i = 0; i < text.length; i += 1) {
    h ^= text.charCodeAt(i)
    h = Math.imul(h, 0x01000193) >>> 0
  }
  return h.toString(16).padStart(8, '0')
}

const kbOf = (bytes: number): number => Math.max(1, Math.round(bytes / 1024))

/**
 * 本机数据剔除"只在本机"的库之后，才是要上云的那一份（连同体积、逐库形态与指纹）。
 *
 * 两处刻意的口径：
 *  · **键排序**：体积与指纹都要能跨次比较，而 storage 的键顺序不保证 —— 排一下，
 *    服务端"与上一版完全相同"的判定也更容易命中（它比的是原始 JSON 文本）；
 *  · 体积的算法与 `services/syncService.js` 的 `Buffer.byteLength(JSON.stringify({app,schema,data}))`
 *    一字不差 —— 口径不齐的话，"比云端小多少"会系统性偏。
 */
function cloudData(payload?: BackupPayload): CloudData {
  const p = payload ?? collectBackup()
  const data: Record<string, string> = {}
  const shape: Record<string, number> = {}
  for (const key of Object.keys(p.data).sort()) {
    const short = key.slice(STORE_PREFIX.length)
    if (LOCAL_ONLY_STORES.includes(short)) continue
    data[key] = p.data[key]
    shape[short] = byteLength(p.data[key])
  }
  const keys = Object.keys(data)
  return {
    data,
    schema: p.schema,
    stores: keys.length,
    bytes: byteLength(JSON.stringify({ app: 'guanzhi', schema: p.schema, data })),
    shape,
    fingerprint: fnv1a(keys.map((k) => `${k}\u0000${data[k]}`).join('\u0001')),
  }
}

/**
 * 立即备份。
 *
 * @param source 'manual'（用户在设置里点的）/ 'auto'（启动时的 24 小时自动备份）。
 *   ⚠️ 这个参数必须传对：服务端的缩水保护与结构倒退保护**只对 auto / pre-restore 生效**，
 *   2026-10-14 之前自动备份借用了 manual 这条路，那两道保护其实是失效的。
 * @param force 用户已经在危险确认框里看过后果并确认（只对极端缩水的 manual 有用，
 *   服务端据此放行；自动备份永远不带它，那是机器行为，不该能覆盖极端缩小的一份）
 */
export async function backupNow(source: 'manual' | 'auto' = 'manual', force = false): Promise<BackupOutcome> {
  const account = useAccountStore()
  const d = cloudData()
  if (!d.stores) {
    return { saved: false, skipped: true, reason: '本机还没有可备份的数据' }
  }

  const res = await account.withAuth((t) => uploadBackup(t, d.data, source, d.schema, force))
  if (res.saved) account.markBackedUp(d.stores, d.bytes, d.shape, d.fingerprint)
  return {
    saved: !!res.saved,
    skipped: !!res.skipped,
    reason: res.reason || '',
    meta: res.meta,
  }
}

/** 一个明显变小的库（给确认框点名用） */
export interface StoreShrink {
  key: string
  label: string
  fromKB: number
  toKB: number
}

export interface BackupPreview {
  /** 本次将上传的项数与体积 */
  storeCount: number
  sizeKB: number
  bytes: number
  /** 本机全部（含只在本机、不上传的那两个库）—— 只用于把话说全 */
  localStoreCount: number
  localSizeKB: number
  /** 云端最新一版的体积；0 = 还没备份过 */
  cloudBytes: number
  hasCloud: boolean
  /** 缩水判定的基线体积（优先云端，其次本机记的上次） */
  baselineBytes: number
  /** 缩水分档 */
  level: ShrinkLevel
  /** 明显变小的库（最多三条，说得出口的那种） */
  drops: StoreShrink[]
  /** 上次备份里有、这次整个没有的库数 */
  missingStores: number
  /** 与上一次成功上传的内容逐字节相同 */
  unchanged: boolean
  /** 云端的项数与体积也正好等于本次（"确实不用再传"的判据） */
  cloudMatches: boolean
  /** 超过单份上限（传上去也会被拒） */
  overLimit: boolean
}

/**
 * 「立即备份」的二次确认所需的摘要（**不联网**，只读本机 + 传进来的云端 meta）。
 *
 * 为什么要先算：`collectBackup()` 是同步读 storage，数据一多会卡主线程几百毫秒 ——
 * 先用 loading 盖住，再把"共多少项、多大、云端现在多大、哪几个库瘦了"摆出来让用户决定。
 *
 * 基线**优先取云端**（服务端拦不拦也是拿它比，两边同一把尺子）；只有读不到云端 meta 时
 * 才回落到本机记的上一次体积。逐库明细只能跟本机记的形态比（云端回不了逐库体积）。
 */
export function previewBackup(cloud?: SyncMeta | null): BackupPreview {
  const account = useAccountStore()
  const payload = collectBackup()
  const sum = summarize(payload)
  const d = cloudData(payload)

  const cloudBytes = Number(cloud?.bytes) || 0
  const cloudStores = Number(cloud?.stores) || 0
  const localBytes = Number(account.lastBackupBytes) || 0
  const baselineBytes = cloudBytes || localBytes

  const lastShape = account.lastBackupShape || {}
  const drops: StoreShrink[] = []
  let missingStores = 0
  for (const [key, before] of Object.entries(lastShape)) {
    const after = d.shape[key]
    if (after === undefined) {
      missingStores += 1
      continue
    }
    if (before >= SHAPE_DROP.minBytes && after < before * SHAPE_DROP.ratio) {
      drops.push({ key, label: STORE_LABEL[key] || key, fromKB: kbOf(before), toKB: kbOf(after) })
    }
  }
  /* 缩得最狠的排前面，只摆三条 —— 确认框里超过三条就没人看了 */
  drops.sort((a, b) => (b.fromKB - b.toKB) - (a.fromKB - a.toKB))

  return {
    storeCount: d.stores,
    sizeKB: kbOf(d.bytes),
    bytes: d.bytes,
    localStoreCount: sum.storeCount,
    localSizeKB: sum.sizeKB,
    cloudBytes,
    hasCloud: cloudBytes > 0,
    baselineBytes,
    level: shrinkLevelOf(d.bytes, baselineBytes),
    drops: drops.slice(0, 3),
    missingStores,
    unchanged: !!account.lastBackupFingerprint && account.lastBackupFingerprint === d.fingerprint,
    cloudMatches: cloudBytes > 0 && d.bytes === cloudBytes && cloudStores === d.stores,
    overLimit: d.bytes > UPLOAD_MAX_BYTES,
  }
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
    const d = cloudData()
    if (!d.stores) return 'skipped'
    const res = await account.withAuth((t) => uploadBackup(t, d.data, 'pre-restore', d.schema))
    if (res.saved) {
      account.markBackedUp(d.stores, d.bytes, d.shape, d.fingerprint)
      return 'saved'
    }
    return 'skipped'
  } catch (e) {
    console.warn('[backup] 恢复前留档失败（不拦恢复）：', e)
    return 'skipped'
  }
}

/**
 * 自动备份（启动时调用）：距上次成功备份（或被保护拦下的那一次）不足 24 小时则跳过。
 * 静默失败——备份是后台行为，任何异常都不该打扰用户。
 *
 * `source = 'auto'` 是**关键**：服务端的缩水保护与结构倒退保护只认它。
 */
export async function autoBackupIfDue(): Promise<void> {
  const account = useAccountStore()
  if (!account.cloudEnabled) return

  const last = account.lastBackupAt ? Date.parse(account.lastBackupAt) : 0
  const lastSkip = account.lastBackupSkipAt ? Date.parse(account.lastBackupSkipAt) : 0
  if (Date.now() - Math.max(last, lastSkip) < AUTO_INTERVAL_MS) return

  try {
    const outcome = await backupNow('auto')
    if (outcome.saved) return
    /*
     * 被服务端拦下（缩水 / 结构倒退）时记一笔时间：数据不会因为"再试一次"就变大，
     * 而每次尝试都是一整包上行 —— 记下之后节拍同样按 24 小时走。
     * 网络异常则**不记**：那多半只是一次性的，下次启动该重试。
     */
    account.lastBackupSkipAt = new Date().toISOString()
    if (outcome.reason) console.warn('[backup] 自动备份未执行：', outcome.reason)
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
  account.lastBackupBytes = 0
  account.lastBackupShape = {}
  account.lastBackupFingerprint = ''
  account.lastBackupSkipAt = ''
  return res.removed ?? 0
}

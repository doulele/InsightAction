/**
 * 本地数据导出 / 恢复 —— **完全不走服务器**，因此不涉及任何隐私合规。
 *
 * 背景：20 个 store 的数据只存在本机 storage（前缀 insight:store:），
 * 换手机 / 清缓存 / 卸载即全丢。这里用「导出成 JSON 文件 → 用户自己转发到聊天保存 →
 * 新机器上从聊天里选文件恢复」的方式，把数据交回用户手里，同时不产生任何上行数据。
 *
 * 三个关键设计：
 *  1. 只碰自家的键：备份内容仅包含 insight:store: 前缀的项，其他存储不动；
 *  2. 恢复是覆盖式的 → 由调用方（设置页）做二次确认；
 *  3. 恢复后不只是写 storage，还要把**内存里已存在的 store 一起 patch** ——
 *     否则界面仍显示旧数据（pinia 的水合只在 store 首次创建时发生）。
 */
import { SCHEMA_VERSION } from '@/config/schema'
import { STORE_PREFIX, normalizePersisted } from '@/stores/index'
import { useAccountStore } from '@/stores/account'
import { useAppStore } from '@/stores/app'
import { useAssessmentStore } from '@/stores/assessment'
import { useImageStore } from '@/stores/images'
import { useBodyStore } from '@/stores/body'
import { useBoxStore } from '@/stores/box'
import { useComposeDraftStore } from '@/stores/composeDraft'
import { useDailyStore } from '@/stores/daily'
import { useFocusStore } from '@/stores/focus'
import { useHabitStore } from '@/stores/habit'
import { useInterruptStore } from '@/stores/interrupt'
import { useKnowledgeStore } from '@/stores/knowledge'
import { useModeStore } from '@/stores/mode'
import { useObserveStore } from '@/stores/observe'
import { usePlanStore } from '@/stores/plan'
import { useQualityStore } from '@/stores/quality'
import { useProbeStore } from '@/stores/probe'
import { useIdentityStore } from '@/stores/identity'
import { useQuestionStore } from '@/stores/question'
import { useProverbStore } from '@/stores/proverb'
import { useReadLaterStore } from '@/stores/readLater'
import { useRemoteStore } from '@/stores/remote'
import { useReminderStore } from '@/stores/reminder'
import { useSeedStore } from '@/stores/seed'
import { useSettingsStore } from '@/stores/settings'
import { useThoughtStore } from '@/stores/thought'
import { useTraceStore } from '@/stores/trace'
import { useUrgeStore } from '@/stores/urge'
import { useVowStore } from '@/stores/vow'
import { useWishStore } from '@/stores/wish'
import { useXpStore } from '@/stores/xp'

/* eslint-disable @typescript-eslint/no-explicit-any */
/** 微信文件相关 API 的可选能力（基础库/平台差异大，统一做存在性判断） */
interface MiniProgramFileApi {
  env?: { USER_DATA_PATH?: string }
  getFileSystemManager?: () => {
    writeFileSync: (path: string, data: string, encoding: string) => void
    readFileSync: (path: string, encoding: string) => string
  }
  shareFileMessage?: (options: {
    filePath: string
    fileName?: string
    success?: () => void
    fail?: (err: { errMsg?: string }) => void
  }) => void
  chooseMessageFile?: (options: {
    count: number
    type: string
    extension?: string[]
    success?: (res: { tempFiles?: Array<{ path?: string; name?: string }> }) => void
    fail?: (err: { errMsg?: string }) => void
  }) => void
}

const mp = uni as unknown as MiniProgramFileApi

/** 备份文件格式（schema 用于跨版本兼容拦截，见 config/schema.ts） */
export interface BackupPayload {
  app: 'guanzhi'
  schema: number
  exportedAt: string
  /** storage 键 → 原始 JSON 字符串（原样保存，避免二次序列化差异） */
  data: Record<string, string>
}

export interface BackupSummary {
  storeCount: number
  sizeKB: number
  exportedAt: string
}

/** $patch 的最小结构（避免把 pinia 的复杂泛型带进来） */
type Patchable = { $patch: (state: any) => void }

/** 需要「写回内存」的 store 清单（与各 store 的 persist.key 一一对应） */
const HYDRATORS: Array<{ key: string; use: () => Patchable }> = [
  /*
   * account / images 也在内：collectBackup 会把所有 insight:store:* 都收走，
   * 恢复时若不回写内存，换机后云备份开关、登录凭据与横幅图缓存会停留在旧值
   * —— 而 $subscribe 会在下一次变更时把旧值写回 storage，等于白恢复。
   */
  { key: 'account', use: () => useAccountStore() },
  { key: 'images', use: () => useImageStore() },
  { key: 'app', use: () => useAppStore() },
  { key: 'assessment', use: () => useAssessmentStore() },
  { key: 'body', use: () => useBodyStore() },
  { key: 'box', use: () => useBoxStore() },
  { key: 'composeDraft', use: () => useComposeDraftStore() },
  { key: 'daily', use: () => useDailyStore() },
  { key: 'focus', use: () => useFocusStore() },
  { key: 'habit', use: () => useHabitStore() },
  { key: 'interrupt', use: () => useInterruptStore() },
  { key: 'knowledge', use: () => useKnowledgeStore() },
  { key: 'mode', use: () => useModeStore() },
  { key: 'observe', use: () => useObserveStore() },
  { key: 'plan', use: () => usePlanStore() },
  { key: 'probe', use: () => useProbeStore() },
  { key: 'identity', use: () => useIdentityStore() },
  { key: 'quality', use: () => useQualityStore() },
  { key: 'proverb', use: () => useProverbStore() },
  { key: 'question', use: () => useQuestionStore() },
  { key: 'readLater', use: () => useReadLaterStore() },
  { key: 'remote', use: () => useRemoteStore() },
  { key: 'reminder', use: () => useReminderStore() },
  { key: 'seed', use: () => useSeedStore() },
  { key: 'settings', use: () => useSettingsStore() },
  { key: 'thought', use: () => useThoughtStore() },
  { key: 'trace', use: () => useTraceStore() },
  { key: 'urge', use: () => useUrgeStore() },
  { key: 'vow', use: () => useVowStore() },
  { key: 'wish', use: () => useWishStore() },
  { key: 'xp', use: () => useXpStore() },
]

/** 收集本机所有 insight:store:* 数据 */
export function collectBackup(): BackupPayload {
  const keys = uni.getStorageInfoSync().keys.filter((k) => k.startsWith(STORE_PREFIX))
  const data: Record<string, string> = {}
  for (const key of keys) {
    const value = uni.getStorageSync(key)
    if (value === '' || value === undefined || value === null) continue
    data[key] = typeof value === 'string' ? value : JSON.stringify(value)
  }
  return { app: 'guanzhi', schema: SCHEMA_VERSION, exportedAt: new Date().toISOString(), data }
}

/** 备份摘要（设置页确认弹框里展示） */
export function summarize(payload: BackupPayload): BackupSummary {
  const storeCount = Object.keys(payload.data).length
  // 粗略体积（按字符数估算，仅用于给用户一个量级概念）
  const sizeKB = Math.max(1, Math.round(JSON.stringify(payload).length / 1024))
  return { storeCount, sizeKB, exportedAt: payload.exportedAt }
}

/** ISO 时间 → 可读文案 */
export function formatBackupTime(iso: string): string {
  if (!iso) return '未知时间'
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return iso
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`
}

/** 导出文件名的时间戳后缀：20260915-1430（备份与修行档案共用） */
export function fileStamp(d = new Date()): string {
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}-${pad(d.getHours())}${pad(d.getMinutes())}`
}

/** 把一段文本写成小程序私有目录里的文件（备份 JSON / 修行档案共用） */
export function writeTextFile(text: string, fileName: string): { filePath: string; fileName: string } {
  const fs = mp.getFileSystemManager?.()
  const dir = mp.env?.USER_DATA_PATH
  if (!fs || !dir) throw new Error('当前环境不支持导出文件（请用微信小程序打开）')

  const filePath = `${dir}/${fileName}`
  fs.writeFileSync(filePath, text, 'utf8')
  return { filePath, fileName }
}

/** 把备份写成小程序私有目录里的 JSON 文件 */
export function writeBackupFile(payload: BackupPayload): { filePath: string; fileName: string } {
  return writeTextFile(JSON.stringify(payload), `guanzhi-backup-${fileStamp()}.json`)
}

/** 转发文件到聊天（用户可发给「文件传输助手」长期保存） */
export function shareFile(filePath: string, fileName: string): Promise<void> {
  return new Promise((resolve, reject) => {
    if (typeof mp.shareFileMessage !== 'function') {
      reject(new Error('当前微信基础库不支持文件转发（需 2.16.1 及以上）'))
      return
    }
    mp.shareFileMessage({
      filePath,
      fileName,
      success: () => resolve(),
      fail: (err) => reject(new Error(err?.errMsg || '转发失败')),
    })
  })
}

/** 校验备份内容：必须是本 App 的备份，且只认自家前缀的键 */
export function validateBackup(raw: unknown): BackupPayload {
  const obj = raw as Partial<BackupPayload> | null
  if (!obj || typeof obj !== 'object' || Array.isArray(obj)) throw new Error('备份内容不是有效的 JSON 对象')
  if (obj.app !== 'guanzhi') throw new Error('这不是「观止知行」的备份文件')
  if (!obj.data || typeof obj.data !== 'object') throw new Error('备份内容缺少数据段')

  /*
   * 版本闸门：备份来自**更新版本**的 App → 拒绝恢复。
   * 旧备份（schema 更小）可以恢复：各 store 的迁移兜底（如 trace 的 type→kind）能兜住。
   * 反过来不行 —— 老版本读不懂新字段，恢复后界面会出现半截数据，且无声无息。
   */
  const schema = Number(obj.schema)
  if (Number.isFinite(schema) && schema > SCHEMA_VERSION) {
    throw new Error(`备份来自更新版本（schema ${schema} > 当前 ${SCHEMA_VERSION}），请先升级小程序再恢复`)
  }

  const data: Record<string, string> = {}
  for (const [key, value] of Object.entries(obj.data)) {
    if (!key.startsWith(STORE_PREFIX)) continue
    if (typeof value === 'string') data[key] = value
  }
  if (!Object.keys(data).length) throw new Error('备份里没有可恢复的数据')
  return { app: 'guanzhi', schema: Number.isFinite(schema) ? schema : 1, exportedAt: obj.exportedAt || '', data }
}

/** 从聊天记录里选一个备份文件并解析（用户主动选文件，不涉及自动采集） */
export function pickBackupFile(): Promise<BackupPayload> {
  return new Promise((resolve, reject) => {
    if (typeof mp.chooseMessageFile !== 'function') {
      reject(new Error('当前环境不支持从聊天选择文件（请用微信小程序打开）'))
      return
    }
    mp.chooseMessageFile({
      count: 1,
      type: 'file',
      extension: ['json'],
      success: (res) => {
        try {
          const file = res?.tempFiles?.[0]
          if (!file?.path) throw new Error('未选中文件')
          const fs = mp.getFileSystemManager?.()
          if (!fs) throw new Error('当前环境不支持读取文件')
          const text = fs.readFileSync(file.path, 'utf8')
          resolve(validateBackup(JSON.parse(typeof text === 'string' ? text : String(text))))
        } catch (err) {
          reject(err instanceof Error ? err : new Error('备份文件解析失败'))
        }
      },
      fail: (err) => {
        const msg = err?.errMsg || ''
        reject(new Error(/cancel/i.test(msg) ? '已取消' : msg || '选择文件失败'))
      },
    })
  })
}

/**
 * 覆盖式恢复：写 storage + patch 内存中的 store。
 * 返回实际恢复的项数，供 UI 提示。
 */
export function applyBackup(payload: BackupPayload): { restoredKeys: number; restoredStores: number } {
  // 云快照不经过 validateBackup（后端直接给 data），这里再兜一次版本闸门
  if (Number(payload.schema) > SCHEMA_VERSION) {
    throw new Error(`备份来自更新版本（schema ${payload.schema} > 当前 ${SCHEMA_VERSION}），请先升级小程序再恢复`)
  }
  const keys = Object.keys(payload.data)
  for (const key of keys) uni.setStorageSync(key, payload.data[key])

  let restoredStores = 0
  for (const hydrator of HYDRATORS) {
    const raw = payload.data[STORE_PREFIX + hydrator.key]
    if (typeof raw !== 'string') continue
    try {
      // 剥壳后回写：老备份里同样是 ref 壳，直接 $patch 会被 pinia 静默忽略（见 stores/index.ts）
      const patch = normalizePersisted(JSON.parse(raw))
      if (!patch) throw new Error('快照不是对象')
      hydrator.use().$patch(patch)
      restoredStores += 1
    } catch (e) {
      console.warn(`[backup] 恢复 ${hydrator.key} 失败：`, e)
    }
  }

  /*
   * 换机恢复后，备份里的头像路径多半指向一个**不存在**的文件（那份备份不是在这台手机上存的）。
   * 自检就放在这里而不是 App.onLaunch —— 恢复发生在 App 启动之后（页面 reLaunch 不会重跑 onLaunch）。
   * 失效则清掉路径，界面回落成「名字章」，不留一个永远裂着的头像。
   */
  useIdentityStore().verify()

  return { restoredKeys: keys.length, restoredStores }
}

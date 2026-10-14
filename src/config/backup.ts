/**
 * 云备份的口径与文案（2026-10-12 建，2026-10-14 扩）。
 *
 * 为什么单独成文件：备份这块牵涉"多少才算异常、留几版、每版怎么称呼"，
 * 页面里散着写就会出现同一件事三种说法（见规则：文案 / 阈值一律放 config）。
 *
 * 2026-10-14 扩了三件事，都是围绕「这次要上传的比云端少」这个信号：
 *  · 缩水从"一根 0.5 的线"变成**三档**（略小 / 明显少 / 少得多），每档各有基线下限，
 *    免得云端本来就只有 5KB 时也弹红旗（那是噪音，不是提醒）；
 *  · 确认框要能**点名**"哪几个库明显变小了"，不再只说一个总体积 —— 见 `drops`；
 *  · 单份体积上限挪到前端**提前拦**（以前是传完一整轮才被服务端拒）。
 */
import type { SnapshotSource } from '@/api/modules/sync'

/** 服务端保留的历史版本数（**仅用于文案兜底**；真实值由 `/sync/versions` 的 keep 回传） */
export const DEFAULT_KEEP_VERSIONS = 5

/** 单份备份体积上限（字节）—— 必须与服务端 `SYNC_MAX_BYTES` 同值（默认 2MB） */
export const UPLOAD_MAX_BYTES = 2 * 1024 * 1024

/**
 * 缩水分档。判定是"本次体积 ÷ 基线体积"，**基线优先取云端那一版**
 * （服务端拦不拦也是拿它比，两边同一把尺子），读不到时才回落到本机记的上一次。
 *
 * 档位从重到轻依次判定，命中即停：
 *  · `extreme` <35%（且基线 ≥64KB）：本机很可能被清空 / 重置过；
 *  · `heavy`   <50%（且基线 ≥8KB）：明显少了很多 —— 2026-10-12 那道强警告，保留；
 *  · `slight`  <75%（且基线 ≥16KB）：少了一些，值得一句轻提示，不值得用红旗。
 *
 * 基线下限的作用：数据本来就只有几 KB 时，"少了一半"其实没什么可失去的。
 * 注意与服务端缩水保护（`sync.shrinkRatio` 0.3，只对自动备份 / 恢复前留档生效）
 * **不是一道闸门**：那里是**拦**，这里是**提醒**，手动备份照样放行 —— 用户自己说了算。
 */
export const SHRINK_RULES: ReadonlyArray<{
  level: Exclude<ShrinkLevel, 'ok'>
  ratio: number
  minBaselineBytes: number
}> = [
  { level: 'extreme', ratio: 0.35, minBaselineBytes: 64 * 1024 },
  { level: 'heavy', ratio: 0.5, minBaselineBytes: 8 * 1024 },
  { level: 'slight', ratio: 0.75, minBaselineBytes: 16 * 1024 },
]

/**
 * 「哪个库明显变小了」的判定：该库上次 ≥4KB，这次不到它的一半。
 * 只在**本机**能比（上一次备份时逐库记了一份体积，见 stores/account.ts）——
 * 云端只回总体积，回不了逐库明细。
 */
export const SHAPE_DROP = { minBytes: 4096, ratio: 0.5 }

/** 缩水分档（'ok' = 没看出问题） */
export type ShrinkLevel = 'ok' | 'slight' | 'heavy' | 'extreme'

/** 按体积算出档位（纯阈值，放在这里而不是页面里） */
export function shrinkLevelOf(bytes: number, baselineBytes: number): ShrinkLevel {
  if (!baselineBytes) return 'ok'
  for (const rule of SHRINK_RULES) {
    if (baselineBytes >= rule.minBaselineBytes && bytes < baselineBytes * rule.ratio) return rule.level
  }
  return 'ok'
}

/** 备份来源标签（版本列表里一眼看出这版是谁存的、什么时候存的） */
export const SOURCE_LABEL: Record<SnapshotSource, string> = {
  manual: '手动备份',
  auto: '自动备份',
  'pre-restore': '恢复前留档',
  prev: '上一版',
}

/**
 * 库名表：storage 键（去掉前缀）→ 用户看得懂的名字。
 *
 * 为什么需要它：缩水提醒说"少了 90KB"是机器话，说"收件匣从 120KB 变成 2KB"才是人话
 * ——用户据此立刻能想起自己干了什么。**键名对不上时退回原键**，不编名字。
 */
export const STORE_LABEL: Record<string, string> = {
  account: '云备份与账号',
  images: '图片缓存',
  app: '启动记录',
  assessment: '测评建档',
  badges: '徽章',
  body: '身体电量',
  box: '微行动盲盒',
  capsule: '时间胶囊',
  closing: '今日收功',
  composeDraft: '记一笔草稿',
  daily: '今日三件事',
  feedback: '回音壁',
  focus: '专注时长',
  habit: '习惯打卡',
  identity: '名号与头像',
  interrupt: '干预记录',
  knowledge: '知识卡',
  mode: '修行语言',
  observe: '收件匣',
  plan: '计划与日课',
  probe: '情境省察',
  proverb: '箴言',
  question: '每日一问',
  readLater: '稍后读',
  remote: '远端配置',
  reminder: '定时提醒',
  seed: '概念播种',
  settings: '偏好设置',
  share: '分享留痕',
  thought: '止念一刻',
  trace: '痕迹',
  urge: '冲动记录',
  vow: '立约',
  wish: '愿望清单',
  xp: '修为',
}

/* ---------------- 「立即备份」的确认框文案 ---------------- */

/**
 * 确认框要吃的东西。字段刻意都是**已经算好的读数**（KB 都取整过），
 * 配置这边只负责措辞，不碰数据 —— 两个入口（设置页的 GzDialog / 「我」页的原生弹框）
 * 用的是同一份文案。
 */
export interface ShrinkCtx {
  level: ShrinkLevel
  /** 本次将上传的项数与体积 */
  storeCount: number
  sizeKB: number
  /** 云端最新一版的体积（KB）；`hasCloud` 为假时无意义 */
  cloudKB: number
  hasCloud: boolean
  /** 与上一次成功上传的内容完全相同 */
  unchanged: boolean
  /** 明显变小的库（最多三条） */
  drops: Array<{ label: string; fromKB: number; toKB: number }>
  /** 比基线少掉的库数（整库消失，不只是变小） */
  missingStores: number
}

/** 确认框标题：档位越重，话说得越直 */
export function backupTitle(c: ShrinkCtx): string {
  if (c.level === 'extreme') return '这批数据比云端少得多，仍要覆盖？'
  if (c.level === 'heavy') return '这批数据比云端少很多，仍要覆盖？'
  if (c.level === 'slight') return '这次上传的比上次少一些，确认吗？'
  return '上传一份备份？'
}

/** 确认框正文：一把尺子摆出来（本次多少、云端多少），再点名变小了哪几个库 */
export function backupSummary(c: ShrinkCtx): string {
  const lines = [
    `本次将上传 ${c.storeCount} 项 · 约 ${c.sizeKB}KB；`
    + (c.hasCloud ? `云端现有约 ${c.cloudKB}KB。` : '云端还没有备份。'),
  ]
  if (c.drops.length) {
    const detail = c.drops.map((d) => `${d.label} ${d.fromKB}KB → ${d.toKB}KB`).join('、')
    lines.push(`明显变小的：${detail}。`)
  }
  if (c.missingStores > 0) lines.push(`另外有 ${c.missingStores} 个库这次是空的。`)
  if (c.unchanged) lines.push('内容与上一次备份完全相同。')
  return lines.join('\n')
}

/** 确认框备注：这一段才是这个框存在的理由 —— 把后果说清楚 */
export function backupNote(c: ShrinkCtx): string {
  const tail = '步数与时间胶囊只在本机，不随云备份上传。'
  if (c.level === 'extreme') {
    return '这次要上传的不到云端的四成，本机很可能已经被清空或重置过。'
      + '点「仍然上传」会用现在这份覆盖云端最新版 —— 原来那份不会消失，会退到历史版本里，随时能恢复回来。\n'
      + tail
  }
  if (c.level === 'heavy') {
    return '这次要上传的比云端小很多，可能本机已经被清空或重置过。'
      + '点「仍然上传」会用现在这份覆盖云端最新版 —— 原来那份不会消失，会退到历史版本里，随时能恢复回来。\n'
      + tail
  }
  if (c.level === 'slight') {
    return '比上一次少了一些。如果这确实是你现在的进度，就上传；'
      + '如果只是刚清过数据，先退出去、到「从云端恢复」把最近的版本取回来更稳妥。\n'
      + tail
  }
  return `上传后这份会成为云端最新版，原来那份自动存进历史版本（默认保留 ${DEFAULT_KEEP_VERSIONS} 版，可随时恢复回来）。\n${tail}`
}

/** 数据超过单份上限：这种"传上去也会被拒"的情况不该浪费一次上传 */
export function backupOverLimitText(sizeKB: number): string {
  const maxKB = Math.round(UPLOAD_MAX_BYTES / 1024)
  return `本次约 ${sizeKB}KB，超过了单份上限 ${maxKB}KB，服务器会拒收。`
    + '可以先到「数据 → 导出备份文件」把这份存到聊天里（文件备份不受这个上限限制），再回来清理一些不再需要的记录。'
}

/** 与上一次完全相同时的提示（省一次整包上传） */
export const BACKUP_UNCHANGED_TOAST = '本机自上次备份以来没有变化 · 未重复上传'

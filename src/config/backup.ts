/**
 * 云备份的口径与文案（2026-10-12 整理）。
 *
 * 为什么单独成文件：备份这块牵涉"多少才算异常、留几版、每版怎么称呼"，
 * 页面里散着写就会出现同一件事三种说法（见规则：文案 / 阈值一律放 config）。
 */
import type { SnapshotSource } from '@/api/modules/sync'

/** 服务端保留的历史版本数（**仅用于文案兜底**；真实值由 `/sync/versions` 的 keep 回传） */
export const DEFAULT_KEEP_VERSIONS = 5

/**
 * 「这批数据明显比云端少」的判定阈值：本次体积 < 云端 × 该比例 → 二次确认里给强警告。
 *
 * 注意它与服务端缩水保护（后端 `config.sync.shrinkRatio`，默认 0.3）**不是一道闸门**：
 *  · 服务端那道是**拦**，且只对自动备份 / 恢复前留档生效（那两种是机器行为）；
 *  · 这里只是**提醒**，手动备份照样放行 —— 用户自己说了算，但要让他看清自己在覆盖什么。
 */
export const SHRINK_WARN_RATIO = 0.5

/** 备份来源标签（版本列表里一眼看出这版是谁存的、什么时候存的） */
export const SOURCE_LABEL: Record<SnapshotSource, string> = {
  manual: '手动备份',
  auto: '自动备份',
  'pre-restore': '恢复前留档',
  prev: '上一版',
}

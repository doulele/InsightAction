/**
 * 数据结构版本号 —— 备份兼容的唯一闸门。
 *
 * 规则（§16.2）：
 *  - 每次改动**持久化结构**（store 字段增删改名、trace 结构升级），+1；
 *  - 导出的备份带上 `schema`；云备份上传时也带上；
 *  - 恢复时若 `备份.schema > SCHEMA_VERSION` → **拒绝恢复**并明确提示
 *    （这是「换机后脊椎变脏数据」的最后一道防线，宁可不让恢复，也不能让界面错乱）。
 *
 * 当前 = 5：新增 stores/probe.ts（知 · 情境化省察：作答按溯源锚点存档 + 跳过记录）。
 */
export const SCHEMA_VERSION = 5

/** 结构升级记录：给未来的自己看「哪一版改了什么」 */
export const SCHEMA_HISTORY: ReadonlyArray<{ version: number; note: string }> = [
  { version: 1, note: '初版：20 个 store 原样导出' },
  { version: 2, note: 'trace 升级四环事件流（kind/hall/day/level/value），旧 type 自动迁移' },
  { version: 3, note: '新增 stores/plan.ts：行 · 计划（plans: 长期/今日 + 节点 + 挑战三型）' },
  { version: 4, note: '新增 stores/vow.ts（立约当日档）与 stores/urge.ts（冲动记录 + 冷却期）' },
  { version: 5, note: '新增 stores/probe.ts：知 · 情境化省察（冲动后 / 违约后 / 周报后）' },
]

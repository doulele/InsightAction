/**
 * 数据结构版本号 —— 备份兼容的唯一闸门。
 *
 * 规则（§16.2）：
 *  - 每次改动**持久化结构**（store 字段增删改名、trace 结构升级），+1；
 *  - 导出的备份带上 `schema`；云备份上传时也带上；
 *  - 恢复时若 `备份.schema > SCHEMA_VERSION` → **拒绝恢复**并明确提示
 *    （这是「换机后脊椎变脏数据」的最后一道防线，宁可不让恢复，也不能让界面错乱）。
 *
 * 当前 = 2：trace 升级为四环统一事件流（kind/hall/day/level/value）。
 */
export const SCHEMA_VERSION = 2

/** 结构升级记录：给未来的自己看「哪一版改了什么」 */
export const SCHEMA_HISTORY: ReadonlyArray<{ version: number; note: string }> = [
  { version: 1, note: '初版：20 个 store 原样导出' },
  { version: 2, note: 'trace 升级四环事件流（kind/hall/day/level/value），旧 type 自动迁移' },
]

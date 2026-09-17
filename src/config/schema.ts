/**
 * 数据结构版本号 —— 备份兼容的唯一闸门。
 *
 * 规则（§16.2）：
 *  - 每次改动**持久化结构**（store 字段增删改名、trace 结构升级），+1；
 *  - 导出的备份带上 `schema`；云备份上传时也带上；
 *  - 恢复时若 `备份.schema > SCHEMA_VERSION` → **拒绝恢复**并明确提示
 *    （这是「换机后脊椎变脏数据」的最后一道防线，宁可不让恢复，也不能让界面错乱）。
 *
 * 当前 = 8：新增 stores/capsule.ts（时间胶囊）与 stores/closing.ts（今日收功），
 * plan 加 cadence / checks / targetDays（日课型），knowledge 加 echoDay 与卡的 echo 三字段，
 * settings 加 sabbathWeekday（安息日）。
 */
export const SCHEMA_VERSION = 8

/** 结构升级记录：给未来的自己看「哪一版改了什么」 */
export const SCHEMA_HISTORY: ReadonlyArray<{ version: number; note: string }> = [
  { version: 1, note: '初版：20 个 store 原样导出' },
  { version: 2, note: 'trace 升级四环事件流（kind/hall/day/level/value），旧 type 自动迁移' },
  { version: 3, note: '新增 stores/plan.ts：行 · 计划（plans: 长期/今日 + 节点 + 挑战三型）' },
  { version: 4, note: '新增 stores/vow.ts（立约当日档）与 stores/urge.ts（冲动记录 + 冷却期）' },
  { version: 5, note: '新增 stores/probe.ts：知 · 情境化省察（冲动后 / 违约后 / 周报后）' },
  { version: 6, note: '新增 stores/thought.ts（止 · 止念一刻）与 trace kind pause.thought；urge 增 cooldownKind（冷却 10 分钟 / 48 小时两档）' },
  { version: 7, note: '止念四补充：ThoughtRecord 增 shelved / revisitAt / closed（搁置窗口与到期回看），probe 增第 4 情境 thought（止念后）；老数据缺字段按"就此放下"兼容' },
  {
    version: 8,
    note: '日课与五项体验补充：新增 stores/capsule.ts（时间胶囊，只在本机、不入云备份）与 stores/closing.ts（今日收功）；plan 增 cadence（steps/daily）/ checks / targetDays；knowledge 增 echoDay 与卡片 echoCount / lastEchoAt / changedAt（旧卡重逢）；settings 增 sabbathWeekday（安息日）。老数据一律按 steps 与"未收功"兼容，无需迁移',
  },
]

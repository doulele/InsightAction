/**
 * 数据结构版本号 —— 备份兼容的唯一闸门。
 *
 * 规则（§16.2）：
 *  - 每次改动**持久化结构**（store 字段增删改名、trace 结构升级），+1；
 *  - 导出的备份带上 `schema`；云备份上传时也带上；
 *  - 恢复时若 `备份.schema > SCHEMA_VERSION` → **拒绝恢复**并明确提示
 *    （这是「换机后脊椎变脏数据」的最后一道防线，宁可不让恢复，也不能让界面错乱）。
 *
 * 当前 = 16：新增 stores/feedback.ts（回音壁的本机留痕）—— 待发的队列（写好了没送出去的，
 * 进页自动重发）、成功送出的条数（徽章「回音」的判定依据）、更新版本号。
 * 老数据没有这个 store，按空队列兼容，无需迁移脚本。
 * 上一版（15）：settings 增 soundLevel（静修音效的「声音大小」档：小 / 中 / 大）——
 * 老数据没有这一格，读时按默认「大」兜底，无需迁移脚本。
 * 上一版（14）：readLater 的条目增 form（一句话 / 文章 / 视频）与 title / link ——
 * 「稍后读」从"只能存一句话"扩成三种碎片形态，保留时长随形态分（一句话 24 小时、
 * 文章与视频 7 天）。老条目没有这一格，按 'quote' 兜底并在 prune() 里顺手补上。
 * 上一版（13）：proverb 增 echoDay（开屏回响"今天已结算过"的日期键）—— 1/3/7 天阶梯由
 * 「点按钮才推进」改成「展示即推进、一天一条」，修掉"不点就永远钉在同一条"的缺陷。
 * 再上一版（12）：新增 stores/badges.ts（徽章点亮的留痕 id + 点亮时刻）。
 * 再上一版（11）：observe 的「道」增 daoLine（凝练句，≤24 字）。
 * 再上一版（9）：步骤嵌套（plan 的 PlanNode 增 parentId / progress）与两份正文（observe 增
 * contentHtml / imported / handleNote），knowledge 增 domain / qa / ref，
 * 并删掉 stores/quality.ts（信息源质量榜 → 派生的来源账本）。
 */
export const SCHEMA_VERSION = 16

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
  {
    version: 9,
    note: '步骤嵌套与两份正文：plan 的 PlanNode 增 parentId（≤5 层）与 progress（叶子自评进度，拉满等于勾上）；knowledge 增 domain（我的知识 / 专业知识）、qa（要点与追问）、ref（回链三件事）；observe 增 contentHtml（富文本正本）、imported（由文件导入，不占信息配额）、handleNote（处理时那句从正文里挪出来）；删除 stores/quality.ts —— 信息源质量榜改成从收件池派生的「来源账本」，观维度日指标由"辨源标注次数"改为数 observe 环痕迹。老数据一律按"无父子 / life 书架 / 无富文本 / 未导入"兼容，无需迁移脚本',
  },
  {
    version: 10,
    note: '新增 stores/share.ts：分享的本机留痕（token / itemId / 短标题 / h5Url / 到期时间），用于详情页显示"这条已分享 · 撤回"、避免重复发布，以及重置数据前尽量撤回服务器上的快照。老数据没有这个 store，按空列表兼容（不影响恢复）',
  },
  {
    version: 11,
    note: 'observe 的「道」增 daoLine（凝练句，≤24 字，只在 kind=\'mother\' 上成立）：它是「观」大厅头部那句主张与开屏「今日一签」的来源（config/dao.ts 按天轮换）。写入入口三处 —— 详情页「凝练成道」、母题库认领流程、母题库卡片补写；写入时 store 统一 trim + 截断。老数据没有这一格，按"还没凝练"兼容，无需迁移脚本',
  },
  {
    version: 12,
    note: '新增 stores/badges.ts：徽章点亮的**留痕**（id + 点亮时刻）。此前徽章是纯实时判定，依赖当下连续状态的「持恒」（习惯连续打卡 7 天）与「守七」（连续 7 天立约守住）会在断掉之后熄灭；现在显示取「当下命中 ∪ 已留痕」，点亮不再被收回。判定规则仍然只有 config/badges.ts 一份。老备份没有这个 store，按"未点亮"兼容，首次进入「我」页会自动把当前该得的那几枚补记下来',
  },
  {
    version: 13,
    note: 'stores/proverb.ts 增 echoDay（开屏回响"今天已经结算过"的日期键，跨天自动解禁，与 knowledge 的 echoDay 同一范式）：回响的 1/3/7 天阶梯从「点了「还在记着」才推进」改成「开屏展示即推进、一天最多一条」，并在「我 · 我的箴言」补上显式推进入口。老数据没有这一格，按"今天还没结算"兼容（最多当天多推一阶），无需迁移脚本',
  },
  {
    version: 14,
    note: 'stores/readLater.ts 的条目增 form（quote / article / video，与「记一笔」的 form 同口径）与 title / link：稍后读从"只能存一句话"扩成三种碎片形态，保留时长随形态分（一句话 24 小时、文章与视频 7 天 —— 长文一天读不完，而这两个形态的价值全在链接上）。老条目没有 form，读时按 quote 兜底、并在 prune() 里顺手补上（无需迁移脚本）',
  },
  {
    version: 15,
    note: 'settings 增 soundLevel（静修音效的「声音大小」档：小 / 中 / 大，见 config/audio.ts 的 SOUND_LEVELS）：配合素材响度归一，把"系统音量键"从静修流程里去掉。老数据没有这一格，按默认「大」兼容，无需迁移脚本',
  },
  {
    version: 16,
    note: '新增 stores/feedback.ts：回音壁（「我」→ 回音壁）的本机留痕 —— pending（写好了没送出去的队列，进页自动重发）、sent（累计成功送出的条数，徽章「回音」的唯一依据）、latestBoard / seenBoard（更新日志看到哪一版，「我」页入口那枚「有更新」徽标读它）。回音壁的**内容本身在服务器上**（与分享同口径：读免登录、写要登录、先审后发），不在本地数据里。老数据没有这个 store，按空队列兼容，无需迁移脚本',
  },
]

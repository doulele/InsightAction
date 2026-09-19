/**
 * 来源账本（2026-09-17）——「我把时间花在谁身上」的口径表。
 *
 * 为什么阈值要放这里：账本要提醒「收得多、处理得少」，几条算多、几成算少是产品判断，
 * 不是页面排版问题 —— 与信息配额（config/quota.ts）、日课上限（stores/plan.ts）同一条规矩：
 * **文案 / 阈值 / 分值 / 上限一律不写在页面里**。
 */

/**
 * 没填来源的条目归到这一行。
 * 刻意**不隐藏**它：看不见的账最容易失控 ——「我有一半的东西说不清从哪来」本身就是结论。
 */
export const LEDGER_UNNAMED = '未标注来源'

/** 「收得多、处理得少」的下限：至少收下这么多条，才谈得上"多" */
export const LEDGER_BACKLOG_MIN = 5
/** 处理率低于这个百分数才算"少" */
export const LEDGER_BACKLOG_RATE = 40
/** 每行最多列几个领域 */
export const LEDGER_TOPIC_CAP = 3

/**
 * dateKey —— 自然日键（`YYYY-MM-DD`）的**唯一实现**。
 *
 * 为什么单独开这个文件：这套 `${年}-${补零(月)}-${补零(日)}` 以前在 6 处各写了一份 ——
 * `stores/daily` 的 todayKey、`config/quota` 的 dayKey、`utils/growth` 的 fmtKey 与 dayKeyOf、
 * `utils/easter` 的 dayKeyShift，以及 `subpkg-reflect/growth` 页内自建的 dayKey。
 *
 * 多份实现的风险不在"今天会不会写错"，而在**将来只有一处被改**：一旦有人给某一份补上
 * 时区处理或补零修正，同一天在不同页面就会被算成两个日子，表现为"跨天类"的诡异 bug
 * —— 难复现、难定位。所以合并到这里，任何地方要日键都从这里取。
 *
 * 为什么不放进 store：`config` 层也要用日键（见 config/quota.ts 的配额计算），
 * 但 config 不该反向依赖 store。放在中立的 utils 层，两边引用都不成环。
 */

/**
 * 取某时刻所属的**本地自然日**键，形如 `2026-09-22`。
 *
 * 不传参时取当下 —— 这是全项目「今天」的唯一口径。
 */
export function dateKeyOf(d: Date | number = new Date()): string {
  const t = new Date(d)
  const m = `${t.getMonth() + 1}`.padStart(2, '0')
  const day = `${t.getDate()}`.padStart(2, '0')
  return `${t.getFullYear()}-${m}-${day}`
}

/**
 * 以 `base` 为基准平移 `delta` 天后的日键（`delta` 可为负）。
 *
 * 跨月 / 跨年 / 夏令时交给 `Date` 自己处理，调用方**不要手算毫秒**
 * ——「减去 24 小时」在夏令时切换日会算错一天。
 */
export function dateKeyShift(base: Date | number, delta: number): string {
  const d = new Date(base)
  d.setDate(d.getDate() + delta)
  return dateKeyOf(d)
}

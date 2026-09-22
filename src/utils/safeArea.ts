/**
 * 顶部安全距离（状态栏）—— 2026-09-22
 * ==================================
 *
 * 为什么不直接用 CSS 变量 `--status-bar-height`：
 * uni-app 在**微信小程序端把它写死成 25px**（构建产物 app.wxss 里就是
 * `page{--status-bar-height:25px}`），既不等于真机状态栏高度、也不随机型变化。
 * iPhone 全面屏的真实值是 44 / 47 / 59px —— 于是「25px + 24rpx」的顶栏
 * 会整体落进状态栏、压在右上角胶囊按钮上（用户报"设置页返回按钮飘走"）。
 *
 * 所以凡是要让开状态栏的地方（子页顶栏 SubNav、入口三页的页首），
 * 顶距一律用 `safeTopPx()` 算出来、再经内联 style 下发，
 * 不再拿那个 CSS 变量当"真值"用（它在 scss 里只留作退无可退的兜底）。
 *
 * 取值口径：H5 端为 0（与变量口径一致，H5 没有原生状态栏）；App 端取真机值；
 * 微信端拿不到时退回 25px（沿用原变量值，宁可偏小也不贴顶）。
 */

/** 兜底状态栏高度（px）：仅在运行时取不到时使用 */
const FALLBACK_BAR_PX = 25

let cachedBar: number | null = null

/** 状态栏高度（px）。模块内只取一次 —— 设备信息在生命周期内不变 */
export function statusBarPx(): number {
  if (cachedBar !== null) return cachedBar
  let bar = 0
  try {
    bar = Number(uni.getSystemInfoSync().statusBarHeight) || 0
  } catch {
    bar = 0
  }
  if (bar <= 0) {
    // #ifdef MP-WEIXIN
    bar = FALLBACK_BAR_PX
    // #endif
  }
  cachedBar = bar
  return bar
}

/**
 * 顶部安全距离（px）= 状态栏高度 + 状态栏之下再留的 `extraRpx`。
 * 传设计稿里的 rpx 值即可（内部换算成 px），返回值直接喂内联 style。
 */
export function safeTopPx(extraRpx = 0): number {
  return Math.round(statusBarPx() + uni.upx2px(extraRpx))
}

/** 与胶囊之间留的一口气（px）：别让动作贴着它 */
const CAPSULE_GAP_PX = 10

let cachedInset: number | null = null

/**
 * 右上角要让开的距离（px）—— 2026-09-22
 *
 * 微信右上角那颗胶囊是**系统控件、画在应用层之上**：宽约 87px、距右缘约 7px，
 * 且与屏幕宽度无关。任何贴着屏幕右缘的自定义元素都会被它压住 ——
 * 不报错、产物里规则还在，只是看得见小半截、点不到（SubNav 的右侧动作曾全部如此）。
 *
 * 为什么不能用 rpx 写死：胶囊**物理尺寸固定**，而 rpx 随屏宽缩放 ——
 * 320px 的小屏让不够（照样被盖），414px 的大屏让过头（动作飘到屏幕中间）。
 * 所以按胶囊的真实左缘算一次：`屏幕宽 - 胶囊左缘 + 10`。
 *
 * 非微信端没有胶囊，返回 0（元素照旧贴右缘）。
 */
export function capsuleInsetPx(): number {
  if (cachedInset !== null) return cachedInset
  let inset = 0
  // #ifdef MP-WEIXIN
  try {
    const menu = uni.getMenuButtonBoundingClientRect()
    const win = uni.getSystemInfoSync()
    if (menu?.left && win?.windowWidth) {
      inset = Math.round(win.windowWidth - menu.left + CAPSULE_GAP_PX)
    }
  } catch {
    inset = 0
  }
  // #endif
  cachedInset = inset
  return inset
}

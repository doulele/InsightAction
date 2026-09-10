/**
 * 版本号工具。
 *
 * 只做两件事：比较版本号、取当前运行的小程序版本。
 * 版本比较放在客户端做（服务端不接收客户端版本号）→ 不产生任何上行数据。
 */

/**
 * 比较版本号：a > b 返回 1，a === b 返回 0，a < b 返回 -1。
 * 按 . 分段数值比较（不做字符串比较，避免 '0.10.0' < '0.9.0' 这种错），
 * 段数不同时缺位补 0（'1.2' 与 '1.2.0' 视为相等）；非法段按 0 处理。
 */
export function compareVersion(a: string, b: string): number {
  const pa = String(a || '').split('.').map((n) => parseInt(n, 10) || 0)
  const pb = String(b || '').split('.').map((n) => parseInt(n, 10) || 0)
  const len = Math.max(pa.length, pb.length)
  for (let i = 0; i < len; i++) {
    const x = pa[i] ?? 0
    const y = pb[i] ?? 0
    if (x !== y) return x > y ? 1 : -1
  }
  return 0
}

/**
 * 当前运行的小程序版本号。
 *
 * 微信官方行为：**只有正式版能取到线上版本号**，开发版与体验版取不到（返回空串）。
 * 这个版本号来自「上传」时在开发者工具弹窗里填的版本号，与 manifest.json 的 versionName 无关。
 * 空串 = 无法比较 → 调用方必须跳过版本判断（否则会把开发/体验版误判成"旧版"）。
 */
export function getRunningVersion(): string {
  try {
    return uni.getAccountInfoSync?.().miniProgram?.version || ''
  } catch {
    return ''
  }
}

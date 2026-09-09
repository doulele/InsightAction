/**
 * 环境配置统一出口。
 *
 * 所有页面/请求只应依赖本模块，不要直接散落读取 import.meta.env，
 * 以便将来切换「构建时环境」或「运行时开关」时只需改这一个文件。
 */
export const ENV = {
  /** 是否开发环境 */
  isDev: import.meta.env.DEV,
  /** 是否生产构建 */
  isProd: import.meta.env.PROD,

  /** 后端 API 基础地址（.env 中配置）。留空 => 无后端阶段，走 mock。 */
  apiBaseUrl: import.meta.env.VITE_API_BASE_URL ?? '',

  /**
   * 是否启用本地 mock：
   * - 显式配置 VITE_USE_MOCK=true 强制开启
   * - 未配置且 dev 环境下自动开启（后端还没起来时前端不阻塞）
   */
  useMock: import.meta.env.VITE_USE_MOCK === 'true' || (import.meta.env.DEV && !import.meta.env.VITE_API_BASE_URL),
} as const

/** 运行平台判定（运行时） */
export const isMockEnabled = (): boolean => ENV.useMock

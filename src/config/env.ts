/**
 * 环境配置统一出口。
 *
 * 所有页面/请求只应依赖本模块，不要直接散落读取 import.meta.env / process.env。
 *
 * ── 为什么这里要写死一个开发兜底地址 ─────────────────────────────
 * 实测（uni-app 3.0.0-5020420260813003 + vite 5.2.8）：
 *   · 生产构建：import.meta.env 会被「字面量内联」，
 *     dist/build/mp-weixin/config/env.js → {"apiBaseUrl":"https://wellwin.top/guanzhi"}
 *   · 开发编译（uni -p mp-weixin）：import.meta.env 被替换成【空对象】，
 *     dist/dev/mp-weixin/config/env.js → { apiBaseUrl: define_import_meta_env_default.VITE_API_BASE_URL ?? "" }
 *     即 mp 开发态拿不到 .env.development 里的任何 VITE_* 变量（连 NODE_ENV 也没有）。
 * 因此开发态的接口地址不能依赖 env 注入，只能在此处兜底：
 *   生产 → 用构建期内联的 .env.production 值（构建期有守卫校验）
 *   开发 → 用下面的 DEV_API_BASE_FALLBACK（本机后端）
 */

/** 开发态接口地址：本机后端（InsightActionBacend，npm run dev 监听 3002） */
const DEV_API_BASE_FALLBACK = 'http://127.0.0.1:3002/guanzhi'

/** 开发态强制走 mock 的源码开关（true 时 dev 下所有接口返回假数据） */
const DEV_FORCE_MOCK = false

/** 生产构建标记：prod 构建内联为 true；dev 下为 undefined → 视为非生产 */
const IS_PROD = import.meta.env.PROD === true

/** 构建期注入的接口地址（dev 下为空字符串，prod 下为 .env.production 的值） */
const INJECTED_API_BASE = import.meta.env.VITE_API_BASE_URL ?? ''

export const ENV = {
  /** 是否开发环境 */
  isDev: !IS_PROD,
  /** 是否生产构建 */
  isProd: IS_PROD,

  /**
   * 后端 API 基础地址。
   * 生产：构建期注入值（.env.production → https://wellwin.top/guanzhi）
   * 开发：本机后端（mp 开发态取不到 env，故用常量兜底）
   */
  apiBaseUrl: INJECTED_API_BASE || (IS_PROD ? '' : DEV_API_BASE_FALLBACK),

  /**
   * 是否启用本地 mock：
   * 1. 生产构建恒为 false —— 线上绝不允许返回假数据；
   * 2. 开发态由源码开关 DEV_FORCE_MOCK 控制（dev 下 VITE_USE_MOCK 不可用，原因见文件头）。
   */
  useMock: !IS_PROD && DEV_FORCE_MOCK,
} as const

/** 运行平台判定（运行时） */
export const isMockEnabled = (): boolean => ENV.useMock

/**
 * 生产包自检（最后一道兜底）。
 * 构建期已由 vite.config.ts 拦截（必须 https、不得指向本机）；
 * 这里防的是「产物被手工改过」或「某人绕过 vite 配置直接改产物」的极端情况。
 */
if (IS_PROD && !/^https:\/\//i.test(ENV.apiBaseUrl)) {
  console.error(
    `[env] 生产包接口地址非法：${ENV.apiBaseUrl || '(空)'}；` +
      '应为 https://wellwin.top/guanzhi，请检查 .env.production 后重新构建。',
  )
}

/** 开发态启动时打印一次，便于确认「这次到底连的哪个后端」 */
if (!IS_PROD) {
  console.log(
    `[env] 开发模式 → ${ENV.apiBaseUrl || '(接口地址为空)'}` +
      `${ENV.useMock ? '  [mock 已开启，接口返回假数据]' : ''}`,
  )
}

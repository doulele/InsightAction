/**
 * 微信隐私保护指引的「授权把关」。
 * ================================================
 *
 * 背景：manifest.json 开了 `__usePrivacyCheck__: true`，后台隐私保护指引一旦**生效**，
 * 所有隐私接口（本项目用到：剪贴板 setClipboardData、选文件 chooseMessageFile、
 * 头像昵称填写 chooseAvatar、微信运动 getWeRunData）在用户同意前都会被微信拦下，直接 fail。
 *
 * 微信的放行机制是：拦截时回调 `onNeedPrivacyAuthorization(resolve)`，
 * 开发者弹一个自己的弹窗，用户点「同意」后调 `resolve({ event: 'agree', buttonId })`。
 * 「同意」这个动作必须是 `<button open-type="agreePrivacyAuthorization">` ——
 * 普通的 view / button 点击不算数（微信要用这个按钮做合规留痕）。
 *
 * 于是这里做两件事：
 *  1. `initPrivacyGuard()`：在 App.vue 里挂上拦截回调，把 resolve 存起来、点亮弹窗开关；
 *  2. `privacyPending` / `settlePrivacy()`：给 PrivacyGate 组件用 —— 组件负责弹窗与按钮，
 *     用户点了就调 settlePrivacy(true/false) 完成放行或拒绝。
 *
 * 为什么不用「每次复制前自己先查授权状态」这种写法：需要开发者自己维护状态、
 * 且覆盖不全（子页漏一处就出问题）。挂拦截回调是全局生效的，一次接住所有隐私接口。
 */
import { ref } from 'vue'

/** 微信在拦截时给的放行函数：调一次即失效 */
type PrivacyResolver = (info: { event: 'agree' | 'disagree'; buttonId?: string }) => void

interface PrivacyApi {
  onNeedPrivacyAuthorization?: (cb: (resolver: PrivacyResolver) => void) => void
  openPrivacyContract?: (opts?: { success?: () => void; fail?: (err: unknown) => void }) => void
}

const mp = uni as unknown as PrivacyApi

/** 是否有一次授权请求正等着用户表态（PrivacyGate 据此弹窗） */
export const privacyPending = ref(false)

/** 当前挂着的放行函数（没有 = 没有等待中的请求） */
let resolver: PrivacyResolver | null = null

/**
 * 挂上隐私拦截回调。App.vue onLaunch 里调一次即可。
 * 平台不支持（H5 / 老基础库）时静默跳过 —— 那些环境本来就没有隐私强校验。
 */
export function initPrivacyGuard(): void {
  if (typeof mp.onNeedPrivacyAuthorization !== 'function') return
  mp.onNeedPrivacyAuthorization((next) => {
    resolver = next
    privacyPending.value = true
  })
}

/**
 * 用户表态（同意 / 暂不）。
 *
 * 同意后，微信会**自动放行**刚才被拦下的那次调用 —— 也就是说用户点「复制」
 * 弹出这个框、点同意，复制就直接完成了，不用再点第二次。
 */
export function settlePrivacy(agreed: boolean, buttonId = 'agree-btn'): void {
  privacyPending.value = false
  const pending = resolver
  resolver = null
  pending?.({ event: agreed ? 'agree' : 'disagree', buttonId })
}

/**
 * 主动要一次隐私授权（`wx.requirePrivacyAuthorize`）。
 *
 * 与上面「拦截 + 弹窗」的分工 —— 两条路都要有，因为它们拦的不是一类东西：
 *  · 剪贴板 / 选文件 / 微信运动 是**调用型**能力：被拦下时那次调用还没发生，
 *    弹窗点同意就能自动放行，所以走 `onNeedPrivacyAuthorization` 拦截；
 *  · `<input type="nickname">` 是**渲染时**校验的能力：微信在组件渲染那一刻判定授权状态，
 *    没同意就直接降级成普通 input（控制台会打
 *    `showNicknameAccessory:fail ... privacy permission is unauthorized`，errno 104）——
 *    这时再弹窗也救不回来，必须重新渲染。所以要在**渲染之前**主动要授权。
 *
 * 返回值只表示"这次授权流程是否走完并同意"，调用方**不必**据此阻断流程：
 * 拒绝授权时昵称输入框降级成普通输入，手输昵称一样能用，功能不该被卡住。
 * 已同意过 / 隐私指引尚未生效 / 基础库不支持该 API → 直接 resolve false，不弹窗。
 */
export function requirePrivacyAuthorize(): Promise<boolean> {
  const api = uni as unknown as {
    requirePrivacyAuthorize?: (opts: { success?: () => void; fail?: () => void }) => void
  }
  if (typeof api.requirePrivacyAuthorize !== 'function') return Promise.resolve(false)
  return new Promise<boolean>((resolve) => {
    api.requirePrivacyAuthorize!({
      success: () => resolve(true),
      fail: () => resolve(false),
    })
  })
}

/** 打开微信官方的《小程序用户隐私保护指引》（弹窗里的「查看指引」） */
export function openPrivacyContract(): void {
  if (typeof mp.openPrivacyContract === 'function') {
    mp.openPrivacyContract({})
    return
  }
  /* 极端情况（基础库不支持）：至少别静默，提示一下去哪里看 */
  uni.showToast({ title: '请在小程序「关于」里查看隐私保护指引', icon: 'none' })
}

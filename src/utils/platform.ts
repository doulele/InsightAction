/**
 * 平台判定工具。
 *
 * 运行时的端类型判断（编译期分支请用 uni-app 条件注释 // #ifdef）。
 * 使用惰性读取，避免在 App 尚未初始化时过早调用系统 API。
 */

export type UniPlatform = 'app' | 'web' | 'mp-weixin' | 'mp-alipay' | 'mp-toutiao' | 'mp-baidu' | string

export const platform = {
  _value: null as UniPlatform | null,

  /** 当前运行平台标识（如 'mp-weixin' / 'web' / 'app'） */
  get value(): UniPlatform {
    if (!this._value) {
      const info = uni.getSystemInfoSync()
      this._value = info.uniPlatform
    }
    return this._value
  },

  /** 是否微信小程序 */
  get isMpWeixin(): boolean {
    return this.value === 'mp-weixin'
  },

  /** 是否任意小程序 */
  get isMp(): boolean {
    return this.value.startsWith('mp-')
  },

  /** 是否 H5 */
  get isH5(): boolean {
    return this.value === 'web'
  },

  /** 是否 App（5+/App 端） */
  get isApp(): boolean {
    return this.value === 'app'
  },
}

/**
 * 登录接口（微信静默登录）。
 *
 * 链路：`uni.login()` 拿 code → `POST /auth/login` → JWT（7 天有效）。
 *
 * 为什么单独一个模块（原先挂在 `sync.ts` 里）：
 *  登录是**所有**需要身份的接口的前置（云备份 / AI / 微信运动 / 以后的订阅消息），
 *  不只是云备份的私有件。挂在 sync 下会让「account store 反过来从 sync 引入登录函数」
 *  这种依赖倒挂，读代码时很难找。独立成 auth.ts 后，依赖方向就是单向的：
 *  account → auth → http。
 *
 * ⚠️ `uni.login()` 是**静默**的（不弹授权框、也不在微信隐私接口清单里），
 *    所以"登录"对用户完全无感 —— 点一下「开启云备份」就已经完成了，
 *    不需要任何"请先登录"的引导。服务端按 openid（哈希后）隔离数据，
 *    前端只保存 token，不保存 openid。
 */
import { http } from '@/api/http'

export interface LoginResult {
  token: string
  openid?: string
}

/** 登录：拿 code 换 JWT */
export function wxLogin(): Promise<LoginResult> {
  return new Promise((resolve, reject) => {
    uni.login({
      provider: 'weixin',
      success: (res) => {
        if (!res?.code) {
          reject(new Error('微信登录未返回 code'))
          return
        }
        http
          .post<LoginResult, { code: string }>('/auth/login', { code: res.code }, { showError: false })
          .then(resolve)
          .catch(reject)
      },
      fail: (err) => reject(new Error(err?.errMsg || '微信登录失败')),
    })
  })
}

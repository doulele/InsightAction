/**
 * 账户与云备份开关。
 *
 * 说明：
 *  - token 只是「微信标识」的凭据，不含昵称/头像/手机号；由 wx.login 静默取得；
 *  - JWT 7 天过期 → withAuth() 捕获 40100 后自动重新登录并重试一次（用户无感）；
 *  - 未开启云备份时，本小程序完全不与服务器交互用户数据。
 */
import { defineStore } from 'pinia'
import { ref } from 'vue'
import { ApiCode, BizError } from '@/types/api'
import { wxLogin } from '@/api/modules/auth'

export const useAccountStore = defineStore(
  'account',
  () => {
    /** 登录凭据（7 天有效期） */
    const token = ref('')
    /** 用户是否开启了云备份（未开启则一切数据只在本机） */
    const cloudEnabled = ref(false)
    /** 上次成功备份时间（ISO） */
    const lastBackupAt = ref('')
    /** 上次备份包含的 store 数（仅用于展示与快速自检） */
    const lastBackupStores = ref(0)
    /**
     * 是否已同意「把内容发给 AI 服务商」。
     *
     * 与 cloudEnabled 是两件事：云备份传的是修行数据，AI 传的是**你写的正文**，
     * 且流向第三方（深度求索 DeepSeek），所以需要单独一次明示同意。
     * 撤回入口在设置页；撤回后 AI 功能一律走基础规则，不联网。
     */
    const aiConsent = ref(false)

    /** 拿 token（force = true 时强制重新登录） */
    async function ensureToken(force = false): Promise<string> {
      if (token.value && !force) return token.value
      const res = await wxLogin()
      token.value = res.token
      return token.value
    }

    /**
     * 带登录态的调用包装：遇 40100（token 过期/无效）自动重登后重试一次。
     * 这样"7 天过期"对用户完全无感，不需要任何"请重新登录"的提示。
     */
    async function withAuth<T>(run: (t: string) => Promise<T>): Promise<T> {
      const t = await ensureToken()
      try {
        return await run(t)
      } catch (e) {
        if (e instanceof BizError && e.code === ApiCode.Unauthorized) {
          const fresh = await ensureToken(true)
          return await run(fresh)
        }
        throw e
      }
    }

    function markBackedUp(stores: number): void {
      lastBackupAt.value = new Date().toISOString()
      lastBackupStores.value = stores
    }

    return { token, cloudEnabled, lastBackupAt, lastBackupStores, aiConsent, ensureToken, withAuth, markBackedUp }
  },
  {
    persist: {
      key: 'account',
      paths: ['token', 'cloudEnabled', 'lastBackupAt', 'lastBackupStores', 'aiConsent'],
    },
  },
)

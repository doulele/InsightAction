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
     * 上次成功上传的体积（字节，口径与服务端 `meta.bytes` 一致）。
     *
     * 它只是**兜底基线**（云端 meta 读不到时用），真正的逐库对比吃 `lastBackupShape`。
     */
    const lastBackupBytes = ref(0)
    /**
     * 上次成功上传时**每个库各占多少字节**（短 key → 字节数，35 个数字）。
     *
     * 为什么要记：云端只回总体积，回不了"哪一块瘦了"。有了这份形态，
     * 下次备份前就能说"收件匣 120KB → 2KB"而不是"少了 90KB"（2026-10-14）。
     */
    const lastBackupShape = ref<Record<string, number>>({})
    /** 上次成功上传的内容指纹（见 utils/cloudBackup 的 fnv1a）—— 用来认出"没有新变化" */
    const lastBackupFingerprint = ref('')
    /**
     * 上次自动备份**被保护拦下**的时间（ISO）。
     *
     * 为什么单独记：被拦不等于不该备份，但也不能每次启动都拿同一份数据去撞同一道闸
     * —— 撞一次是一整包上行。有它之后，自动备份的节拍同样按 24 小时走。
     */
    const lastBackupSkipAt = ref('')
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

    /**
     * 记下一次成功备份：时间 + 项数 + 体积 + 逐库形态 + 内容指纹。
     *
     * 为什么形态与指纹也要存：它们是"下次备份前能提醒什么"的**唯一依据**
     * （云端 meta 只有总体积）。见 utils/cloudBackup 的 previewBackup。
     */
    function markBackedUp(
      stores: number,
      bytes: number,
      shape: Record<string, number>,
      fingerprint: string,
    ): void {
      lastBackupAt.value = new Date().toISOString()
      lastBackupStores.value = stores
      lastBackupBytes.value = bytes
      lastBackupShape.value = { ...shape }
      lastBackupFingerprint.value = fingerprint
      /* 这一轮成功了，上一轮"被保护拦下"的节拍就该让位给新的时间戳 */
      lastBackupSkipAt.value = ''
    }

    return {
      token,
      cloudEnabled,
      lastBackupAt,
      lastBackupStores,
      lastBackupBytes,
      lastBackupShape,
      lastBackupFingerprint,
      lastBackupSkipAt,
      aiConsent,
      ensureToken,
      withAuth,
      markBackedUp,
    }
  },
  {
    persist: {
      key: 'account',
      paths: [
        'token',
        'cloudEnabled',
        'lastBackupAt',
        'lastBackupStores',
        'lastBackupBytes',
        'lastBackupShape',
        'lastBackupFingerprint',
        'lastBackupSkipAt',
        'aiConsent',
      ],
    },
  },
)

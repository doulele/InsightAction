/**
 * 「读一次微信运动」的全过程封装（页面只管调这一个函数）。
 *
 * 三个坑，都在这里被处理掉，页面不必重复踩：
 *  1. **没授权时直接取会失败** —— `getWeRunData` 在用户点头之前会 fail，
 *     所以先用 `uni.authorize({ scope: 'scope.werun' })` 拉一次系统授权框，
 *     拿到手再取。这也顺带满足「不得冷启动就弹授权」的要求：只有用户自己按下同步键才会走到这里。
 *  2. **session_key 会过期** —— 服务端内存表重启/到期后返回 40102，
 *     此时重新 wx.login 换一把新密钥再试一次即可，用户全程无感（wx.login 是静默的）。
 *  3. **uni 的类型没跟上** —— `getWeRunData` / `authorize` 在 @dcloudio 的声明里缺失，
 *     这里按本项目惯例（见 utils/privacy.ts）写一个窄接口再断言。
 */
import { useAccountStore } from '@/stores/account'
import { BizError } from '@/types/api'
import { decodeWeRunData, type WerunResult } from '@/api/modules/werun'

/** 失败原因：页面据此决定给什么提示、显示哪个按钮 */
export type WerunFailReason =
  | 'denied' // 用户没授权
  | 'unsupported' // 不是微信小程序环境（H5 / 老基础库）
  | 'unconfigured' // 服务端没配 WX_APPID / WX_SECRET
  | 'empty' // 有数据但一条都没解出来
  | 'error' // 其它

export class WerunError extends Error {
  readonly reason: WerunFailReason

  constructor(reason: WerunFailReason, message: string) {
    super(message)
    this.name = 'WerunError'
    this.reason = reason
  }
}

/** 与后端 BizCode.WxSessionExpired 一致（后端 middlewares/response.js） */
const SESSION_EXPIRED = 40102
/** 与后端 BizCode.NotConfigured 一致 */
const NOT_CONFIGURED = 50001

interface Raw {
  encryptedData: string
  iv: string
}

interface MpApi {
  getWeRunData?: (opts: {
    success?: (res: Raw) => void
    fail?: (err: { errMsg?: string }) => void
  }) => void
  authorize?: (opts: {
    scope: string
    success?: () => void
    fail?: (err: { errMsg?: string }) => void
  }) => void
}

const mp = uni as unknown as MpApi

function once(): Promise<Raw> {
  return new Promise((resolve, reject) => {
    mp.getWeRunData?.({
      success: (res) => {
        if (!res?.encryptedData || !res?.iv) {
          reject({ errMsg: 'getWeRunData:fail empty result' })
          return
        }
        resolve(res)
      },
      fail: (err) => reject(err),
    })
  })
}

function askAuthorize(): Promise<void> {
  return new Promise((resolve, reject) => {
    mp.authorize?.({ scope: 'scope.werun', success: () => resolve(), fail: reject })
  })
}

/** 看起来像「没授权」的失败信息：微信的措辞随版本会变，这里覆盖常见的几种 */
function looksDenied(err: unknown): boolean {
  const msg = String((err as { errMsg?: string } | null)?.errMsg || '')
  return /deny|auth|scope|authorize/i.test(msg)
}

/** 取密文：没授权就先拉授权（只拉一次，用户拒绝就直接抛 denied，不反复纠缠） */
async function getRawOnce(): Promise<Raw> {
  try {
    return await once()
  } catch (e) {
    if (!looksDenied(e)) throw e
    try {
      await askAuthorize()
    } catch {
      throw new WerunError('denied', '还没有授权读取微信运动步数')
    }
    try {
      return await once()
    } catch {
      throw new WerunError('denied', '授权没有完成，请先在系统弹窗里允许读取步数')
    }
  }
}

/**
 * 从微信回调里挖出可读的失败原文。
 *
 * 这个函数存在的唯一理由是**诊断**：微信把「没在隐私指引里声明」和「用户拒绝授权」
 * 都表达成 failed 回调，唯一的区别只在 errMsg 里。所以哪怕文案不友好，也照样透传，
 * 否则线上遇到问题就只能猜。
 */
function rawMessage(e: unknown): string {
  const detail = e as { errMsg?: string; errno?: number; errCode?: number } | null
  const msg = detail?.errMsg || (e instanceof Error ? e.message : '')
  if (!msg) return '读取步数失败（微信没有给出原因）'
  const code = detail?.errno ?? detail?.errCode
  return code === undefined ? msg : `${msg}（errno ${code}）`
}

/** 后端错误 → 页面看得懂的失败原因 */
function toWerunError(e: unknown): WerunError {
  if (e instanceof WerunError) return e
  if (e instanceof BizError) {
    if (e.code === NOT_CONFIGURED) return new WerunError('unconfigured', '服务端暂未开通步数读取')
    if (e.code === 42900) return new WerunError('error', '点得太快了，歇两秒再来')
    return new WerunError('error', e.message || '读取步数失败')
  }
  return new WerunError('error', rawMessage(e))
}

/**
 * 同步一次微信运动步数。
 *
 * 注意：这里的登录（wx.login）是**静默**的，不弹任何授权框 ——
 * 用户感知到的授权只有「读取微信运动」这一次，由微信自己弹。
 */
export async function readWeRun(): Promise<WerunResult> {
  if (typeof mp.getWeRunData !== 'function' || typeof mp.authorize !== 'function') {
    throw new WerunError('unsupported', '当前环境不支持微信运动')
  }

  const raw = await getRawOnce()
  const account = useAccountStore()

  try {
    // withAuth 自带「token 过期 → 静默重登 → 重试一次」
    const result = await account.withAuth((t) => decodeWeRunData(t, raw.encryptedData, raw.iv))
    if (!result?.days?.length) throw new WerunError('empty', '微信这次没有返回可读取的步数')
    return result
  } catch (e) {
    // session_key 失效（服务端重启 / 到期）：重登拿新密钥，再解一次
    if (e instanceof BizError && e.code === SESSION_EXPIRED) {
      try {
        const fresh = await account.ensureToken(true)
        const result = await decodeWeRunData(fresh, raw.encryptedData, raw.iv)
        if (!result?.days?.length) throw new WerunError('empty', '微信这次没有返回可读取的步数')
        return result
      } catch (retryErr) {
        throw toWerunError(retryErr)
      }
    }
    // 原文进 console：真机排查时靠它区分「隐私指引没声明 / 用户拒绝 / 手机没开微信运动」
    console.warn('[werun] 读取失败：', e)
    throw toWerunError(e)
  }
}

/**
 * 打开系统设置页 —— 用户点过「拒绝」之后，微信不会再自动弹授权框，
 * 只能由用户自己去设置里重新打开。这里做的是引导，不是偷偷改。
 */
export function openWeRunSetting(): void {
  uni.openSetting({})
}

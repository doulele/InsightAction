/**
 * AI 的两道关：本机知情同意 + 服务端白名单（2026-09-23 整理到这一处）。
 *
 * 为什么要单独立一个文件：
 * 设置页那个开关过去**只写本机的 `account.aiConsent`** —— 它只代表"我同意把文字发出去"，
 * 不代表服务端会放行。真正的门槛还有 `AI_ALLOWED_OPENIDS` 白名单，
 * 不在名单里后端会返回 403，而前端是**静默兜底**的（只显示「基础」结果，不解释），
 * 于是用户看到的是"这个 AI 功能好像有，但永远不给 AI 的结果，也不知道为什么"。
 *
 * 现在两件事都收在这里，设置页与 composables/useAi 共用同一份：
 *  1. `ensureAiConsent()`   知情同意（内容离开设备、流向第三方服务商）；
 *  2. `fetchAiAccess()`     问服务端"我在不在名单里"（三态：不限 / 在 / 不在）；
 *  3. `notifyAiBlockedOnce()` 功能页撞上 403 时的一次性提示（引导去设置页）。
 *
 * ⚠️ 同意文案只有这里一份 —— 两处各写一版会让用户以为这是两件不同的事。
 */
import { useAccountStore } from '@/stores/account'
import { aiAccess, type AiAccessInfo } from '@/api/modules/ai'
import { showModal } from '@/utils/dialog'

/** 知情同意的三块文案（设置页与功能页共用） */
export const AI_CONSENT = {
  title: '这段内容会发给 AI',
  body:
    '你写的这段文字将离开手机，发给我们接入的 AI 服务商（深度求索 DeepSeek）用于生成结果，'
    + '不用于其他用途，也不与你的身份关联。\n\n'
    + '你也可以选「只用基础」—— 不联网，改用基础规则计算，功能照常可用。',
  confirm: '同意并发给 AI',
  cancel: '只用基础',
} as const

/**
 * 弹一次知情同意；同意就记进 `account.aiConsent`（一次同意长期有效，设置页可撤回）。
 *
 * 拒绝不是错误：调用方照常走基础兜底，功能完全不受影响。
 * **不判断"该不该弹"** —— `aiOn()` 为 false（开发关闭 / 服务端没开）时调用方要短路，
 * 别为基础兜底去打扰用户。
 */
export async function ensureAiConsent(): Promise<boolean> {
  const account = useAccountStore()
  if (account.aiConsent) return true
  const ok = await new Promise<boolean>((resolve) => {
    showModal({
      title: AI_CONSENT.title,
      content: AI_CONSENT.body,
      confirmText: AI_CONSENT.confirm,
      cancelText: AI_CONSENT.cancel,
      success: (r) => resolve(!!r.confirm),
      fail: () => resolve(false),
    })
  })
  if (ok) account.aiConsent = true
  return ok
}

/**
 * 问服务端"我的账号在不在 AI 名单里"。
 *
 * @returns 结果对象；**null 表示没查成**（没网 / 未登录 / 服务端异常）。
 *          `null` 与 `denied` 必须分开处理 —— 查不成不能当成"你没资格"，
 *          否则一次网络抖动就会把用户挡在门外。
 */
export async function fetchAiAccess(): Promise<AiAccessInfo | null> {
  const account = useAccountStore()
  try {
    return await account.withAuth((t) => aiAccess(t))
  } catch {
    return null
  }
}

/** 「不在名单」时那句统一的说明（设置页弹框与功能页提示共用，避免两处说法不一致） */
export function aiDeniedText(): string {
  return 'AI 目前只对部分人开放 —— 每调用一次都会真实产生费用，所以先小范围开。想用的话找我加进名单。'
}

/**
 * 功能页撞上"不在名单"（403）时的一次性提示。
 *
 * 为什么只提示一次：这是**功能里的偶遇**，不该每点一次 AI 就弹一遍；
 * 而且用户已经能从结果旁边的「基础」标注看出这不是 AI 给的。
 * 真正的开通说明在设置页，这里只负责"指一下方向"。
 * 模块级标记、不持久化：重开小程序会再提醒一次 —— 那时他多半是认真想用了。
 */
let blockedNotified = false

export function notifyAiBlockedOnce(): void {
  if (blockedNotified) return
  blockedNotified = true
  showModal({
    title: 'AI 还没对你开通',
    content: `${aiDeniedText()}\n\n这次先用基础结果，功能照常可用。\n开通入口：我 → 设置 → AI 授权`,
    showCancel: false,
    confirmText: '知道了',
  })
}

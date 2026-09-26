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
import { aiAccess, aiApply, type AiAccessInfo, type AiApplyState } from '@/api/modules/ai'
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
 * 弹一次知情同意框 —— **每次都弹、不写 store**。
 *
 * 为什么要有这个"总是弹"的版本：设置页那个开关是**用户主动按下**的动作，
 * 按下时他就该看到"自己答应的是什么"。若因为"以前同意过"而静默跳过，
 * 用户看到的就成了"点了没反应"（2026-09-23 用户报「点击后没弹框」正是这一条 ——
 * 他之前点过开关，`aiConsent` 早已是 true，于是点开关走的是"撤回"那一支）。
 *
 * 功能页相反：那里是"用着用着顺带调一次 AI"，不能每次都问，所以另走 `ensureAiConsent`。
 */
export async function askAiConsent(): Promise<boolean> {
  try {
    return await new Promise<boolean>((resolve) => {
      showModal({
        title: AI_CONSENT.title,
        content: AI_CONSENT.body,
        confirmText: AI_CONSENT.confirm,
        cancelText: AI_CONSENT.cancel,
        success: (r) => resolve(!!r.confirm),
        fail: () => resolve(false),
      })
    })
  } catch (err) {
    /*
     * 兜住"弹框本身失败"这种极端情况（`showModal` 会先读当前皮肤色。
     * 若这里不兜，`new Promise` 会直接 reject → 调用方那串 await 静默中断，
     * 用户看到的就是**"点了什么都没有"** —— 2026-09-23 报障最难受的正是这种沉默。
     * 返回 false，调用方据此把开关推回去，至少界面上有反馈。
     */
    console.error('[ai] 同意框没能弹出：', err)
    return false
  }
}

/**
 * 需要时弹一次（已同意过就不再弹），并把结果记进 `account.aiConsent`。
 *
 * 这是**功能页**的用法（`composables/useAi`）：点一下 AI 按钮不该被反复问。
 * 设置页要用 `askAiConsent()` —— 用户主动开开关时必须看到确认框。
 * 拒绝不是错误：调用方照常走基础兜底，功能完全不受影响。
 */
export async function ensureAiConsent(): Promise<boolean> {
  const account = useAccountStore()
  if (account.aiConsent) return true
  const ok = await askAiConsent()
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

/**
 * 「不在名单」时那句统一的说明（设置页弹框与功能页提示共用，避免两处说法不一致）。
 *
 * 按**他自己的申请状态**分三种说法（2026-09-26 加）：被拒过却看到和"从没申请过"
 * 一模一样的文案，他会以为上次的申请丢了、又点一遍 —— 说清楚才不至于让他反复试。
 */
export function aiDeniedText(state: AiApplyState = 'none'): string {
  if (state === 'pending') {
    return '你已经申请过了 —— 我这边看得到，开通之后回来打开这个开关就能用（不用再点申请）。'
  }
  if (state === 'rejected') {
    return '上次那条申请没有通过。如果你还想用，可以再申请一次 —— 我会重新看一遍。'
  }
  return 'AI 目前只对部分人开放 —— 每调用一次都会真实产生费用，所以先小范围开。'
    + '想用的话，下面点「申请开通」，我收到就能加你（你不用做别的）。'
}

/**
 * 提交一条开通申请（2026-09-23 加）。
 *
 * 为什么需要它：普通用户**拿不到自己的 openid**（那要装开发者工具看网络面板），
 * 所以由小程序把 openid 报给开发者 —— 他全程不需要知道 openid 是什么。
 *
 * `name` 让用户自己填，**不自动带昵称**：昵称是另一类数据，
 * 不该在他没意识到的时候跟着申请一起上传（这是 PRIVACY 的边界，别图省事）。
 * 返回是否发出去了（失败由调用方如实提示，不静默）。
 */
export async function applyAiAccess(name = ''): Promise<boolean> {
  const account = useAccountStore()
  try {
    await account.withAuth((t) => aiApply(t, name))
    return true
  } catch {
    return false
  }
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

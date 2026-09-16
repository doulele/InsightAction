/**
 * AI 三能力的页面层封装（费曼速记 / 智能标签 / 极简报）。
 *
 * 页面不要直接调 api/modules/ai —— 那一层只管发请求，这里负责五件杂事：
 *  1. **开关**：开发可关（调试用，见 config/env 的 DEV_AI_OFF）、服务端可关（remote.feature('ai')），
 *     任一关掉就走基础兜底，不发请求、不花钱、不依赖后端；
 *  2. **登录态**：统一走 account.withAuth，401（token 满 7 天过期）自动重登后重试一次；
 *  3. **并发保护**：busy 非空时直接忽略新点击 —— 一次调用一份钱，连点两下就是两份；
 *  4. **loading**：文案按能力给不同的，别让用户盯着一个"加载中"猜在干嘛。
 *     注意只有**真走 AI** 时才转圈 —— 基础兜底是瞬时计算，转一下反而闪；
 *  5. **兜底**：AI 拿不到（开关关 / 服务端没配 Key / 不在白名单 / 登录失败 / 网络或模型出错）
 *     一律落到 utils/localAi，**永远返回可用结果**，页面不需要写任何失败分支；
 *  6. **知情同意**：真要发往 AI 前先弹一次明示同意（内容会离开设备、流向第三方服务商），
 *     结果记在 account.aiConsent，设置页可撤回；拒绝就走基础兜底，功能照常。
 *
 * 一句话：AI 是增强不是主链路，任何情况下按钮都不能变成死按钮。
 * 兜底结果带 source:'local'，页面要如实标注 —— 把规则算出来的东西说成"AI 说的"是误导。
 */
import { computed, ref } from 'vue'
import { ENV } from '@/config/env'
import { ApiCode, BizError } from '@/types/api'
import { useAccountStore } from '@/stores/account'
import { useRemoteStore } from '@/stores/remote'
import { aiFeynman, aiTags, aiDigest } from '@/api/modules/ai'
import { localFeynman, localTags, localDigest } from '@/utils/localAi'
import type { AiSource, DigestResult, FeynmanResult, TagsResult } from '@/api/modules/ai'

type AiKind = 'feynman' | 'tags' | 'digest'

export function useAi() {
  const account = useAccountStore()
  const remote = useRemoteStore()
  /** 正在跑的能力；空串 = 空闲。连点保护与按钮置灰都看它 */
  const busy = ref<AiKind | ''>('')

  /** 是否具备调 AI 的条件。不含登录态 —— 登录是静默的，真要用时在 withAuth 里解决 */
  function aiOn(): boolean {
    return ENV.aiEnabled && remote.feature('ai')
  }

  /**
   * 发往 AI 前的明示同意（一次同意，长期有效，设置页可撤回）。
   *
   * 为什么必须有这一道：基础兜底是在手机上算的，而真 AI 会把你写的正文发给我们接入的
   * AI 服务商（深度求索 DeepSeek）—— **内容离开设备是性质上的变化**，不能替用户默认答应。
   *
   * 拒绝不是错误：照常返回基础兜底结果，功能完全不受影响。
   * 只有确定要联网发内容时才弹（aiOn() 为 false 时短路，基础兜底不打扰用户）。
   */
  async function ensureAiConsent(): Promise<boolean> {
    if (account.aiConsent) return true
    const ok = await new Promise<boolean>((resolve) => {
      uni.showModal({
        title: '这段内容会发给 AI',
        content:
          '你写的这段文字将离开手机，发给我们接入的 AI 服务商（深度求索 DeepSeek）用于生成结果，'
          + '不用于其他用途，也不与你的身份关联。\n\n'
          + '你也可以选「只用基础」—— 不联网，改用基础规则计算，功能照常可用。',
        confirmText: '同意并发给 AI',
        cancelText: '只用基础',
        success: (r) => resolve(!!r.confirm),
        fail: () => resolve(false),
      })
    })
    if (ok) account.aiConsent = true
    return ok
  }

  /**
   * @param fallback 基础兜底（AI 不可用时用它，必须永不抛错）
   * @param call     真调 AI
   * @returns 结果（AI 或基础）；仅"连点被忽略"时返回 null
   */
  async function run<T extends { source: AiSource }>(
    kind: AiKind,
    label: string,
    fallback: () => T,
    call: (t: string) => Promise<Omit<T, 'source'>>,
  ): Promise<T | null> {
    if (busy.value) return null
    busy.value = kind

    // aiOn() 为 false 时短路，不会为基础兜底去弹窗打扰用户
    const goAi = aiOn() && (await ensureAiConsent())
    if (goAi) uni.showLoading({ title: label, mask: true })
    try {
      if (!goAi) return fallback()
      const r = await account.withAuth(call)
      return { ...r, source: 'ai' } as T
    } catch (e) {
      // 这三类属于"本来就没打算给你 AI"，静默兜底即可 ——
      // 页面上的"基础"标注已经说明了一切，再弹提示纯属打扰。
      const silent =
        e instanceof BizError &&
        (e.code === ApiCode.NotConfigured ||
          e.code === ApiCode.Forbidden ||
          e.code === ApiCode.Unauthorized)
      if (!silent) {
        uni.showToast({ title: 'AI 暂时不可用，已用基础结果', icon: 'none' })
      }
      return fallback()
    } finally {
      busy.value = ''
      if (goAi) uni.hideLoading()
    }
  }

  return {
    busy,
    /**
     * 当前点击会走真 AI 还是基础兜底。
     * 页面据此决定按钮上要不要出现"AI"二字 —— 走基础规则却标着 AI，是误导。
     */
    available: computed(() => aiOn()),
    /** 费曼速记：这段理解讲明白了吗 */
    feynman: (text: string): Promise<FeynmanResult | null> =>
      run<FeynmanResult>(
        'feynman',
        '正在检验…',
        () => localFeynman(text),
        (t) => aiFeynman(t, text),
      ),
    /** 智能标签 */
    tags: (text: string): Promise<TagsResult | null> =>
      run<TagsResult>('tags', '正在打标签…', () => localTags(text), (t) => aiTags(t, text)),
    /** 极简报：把一批记录压成一条 */
    digest: (items: string[]): Promise<DigestResult | null> =>
      run<DigestResult>(
        'digest',
        '正在压简报…',
        () => localDigest(items),
        (t) => aiDigest(t, items),
      ),
  }
}

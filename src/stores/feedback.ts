/**
 * 回音壁的本机留痕（2026-09-23 建立）。
 *
 * 它**不是**回音壁数据的副本 —— 列表、票数、回应全在服务器上，页面每次进页现取。
 * 这里只存三样服务器不该知道、而本机必须记住的东西：
 *
 *  1. `pending`   写好了但**没送出去**的（弱网 / 后端不通）。下次进页自动重发 ——
 *                 否则用户写完点发送、看到一个失败提示，那段字就永远丢了；
 *  2. `sent`      累计**成功送出**的条数。徽章「回音」靠它判定：徽章是本地实时判定
 *                 （见 utils/growth.ts），不能因为"这一次网络不通"就让一枚已经到手的徽章熄灭，
 *                 也不能因此把从没说过话的人点亮；
 *  3. `seenBoard` 上次看过的更新版本号。比它新 → 「我」页入口亮一下「有更新」。
 *
 * 队列为什么值得做：往回音壁写字是**低频、郑重**的动作（不像勾一个待办），
 * "写完丢了"比"晚一点到"难受得多 —— 所以这里宁可留一份待发的，也不让文字凭空消失。
 */
import { defineStore } from 'pinia'
import { computed, ref } from 'vue'
import { createFeedbackPost } from '@/api/modules/feedback'
import type { FeedbackType } from '@/config/feedback'
import { useAccountStore } from '@/stores/account'

export interface PendingFeedback {
  /** 本机 id（只用于队列去重与出队，与服务器上那条的 id 无关） */
  localId: string
  type: FeedbackType
  title: string
  body: string
  allowComment: boolean
  /** 选择署名时的名号与称号（空 = 匿名道友） */
  name: string
  tier: string
  createdAt: number
  /** 上次尝试失败的原因（展示给用户看，别让它静默躺着） */
  lastError: string
}

function makeLocalId(): string {
  return `fb-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
}

export const useFeedbackStore = defineStore(
  'feedback',
  () => {
    /** 待发队列（进页自动重发；失败保留，用户可手动删） */
    const pending = ref<PendingFeedback[]>([])
    /** 累计成功送出过的条数（徽章「回音」的唯一依据） */
    const sent = ref(0)
    /** 服务端当前的更新版本号（每次进回音壁页记一次） */
    const latestBoard = ref(0)
    /** 已经看过的更新版本号 */
    const seenBoard = ref(0)

    const pendingCount = computed(() => pending.value.length)

    /** 入队一条（还没送出） */
    function queue(input: {
      type: FeedbackType
      title: string
      body: string
      allowComment: boolean
      name?: string
      tier?: string
    }): PendingFeedback {
      const item: PendingFeedback = {
        localId: makeLocalId(),
        type: input.type,
        title: input.title,
        body: input.body,
        allowComment: input.allowComment,
        name: input.name ?? '',
        tier: input.tier ?? '',
        createdAt: Date.now(),
        lastError: '',
      }
      pending.value.push(item)
      return item
    }

    /** 出队（送出成功、或用户手动删掉） */
    function drop(localId: string): void {
      pending.value = pending.value.filter((p) => p.localId !== localId)
    }

    function dropAll(): void {
      pending.value = []
    }

    /** 记一次成功送出（徽章与入口文案都读它） */
    function markSent(n = 1): void {
      sent.value += n
    }

    /**
     * 把队列里的东西发出去。
     *
     * 逐条发、逐条出队：**一条失败不影响后面那条**（第一条可能是内容被判违规，
     * 而后面那些本来没问题 —— 整批回滚会让用户以为"全都发不出去"）。
     * 失败的保留在队列里并记下原因，下次进页再试。
     *
     * @returns 成功 / 失败 / 剩余条数（页面用它决定要不要提示）
     */
    async function flush(): Promise<{ sent: number; failed: number; left: number }> {
      if (!pending.value.length) return { sent: 0, failed: 0, left: 0 }
      const account = useAccountStore()
      let ok = 0
      let bad = 0

      /* 复制一份再遍历：循环里会改 pending.value */
      for (const item of [...pending.value]) {
        try {
          await account.withAuth((token) =>
            createFeedbackPost(token, {
              type: item.type,
              title: item.title,
              body: item.body,
              allowComment: item.allowComment,
              name: item.name || undefined,
              tier: item.tier || undefined,
            }),
          )
          drop(item.localId)
          ok += 1
        } catch (err) {
          const msg = err instanceof Error ? err.message : '没发出去'
          const target = pending.value.find((p) => p.localId === item.localId)
          if (target) target.lastError = msg
          bad += 1
        }
      }

      if (ok) markSent(ok)
      return { sent: ok, failed: bad, left: pending.value.length }
    }

    /** 更新日志看到哪一版了（进「更新」那一段时记一次） */
    function markBoardSeen(version: number): void {
      if (Number.isFinite(version) && version > seenBoard.value) seenBoard.value = version
    }

    const hasNewUpdate = computed(() => latestBoard.value > seenBoard.value)

    /** 记下服务端当前的版本号（进回音壁页时调；只增不减） */
    function noteBoard(version: number): void {
      if (Number.isFinite(version) && version > latestBoard.value) latestBoard.value = version
    }

    return {
      pending,
      sent,
      latestBoard,
      seenBoard,
      pendingCount,
      hasNewUpdate,
      queue,
      drop,
      dropAll,
      markSent,
      flush,
      noteBoard,
      markBoardSeen,
    }
  },
  {
    persist: {
      key: 'feedback',
      paths: ['pending', 'sent', 'latestBoard', 'seenBoard'],
    },
  },
)

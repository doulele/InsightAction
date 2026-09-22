/**
 * 「我发出去的分享」的本机留痕（2026-09-21 建立）。
 *
 * 只记 **token 与时间**，**不存内容副本** —— 内容在服务器上那一份（小程序卡片与网页链接共用），
 * 本机再存一份只会多出一个要同步的真相。所以这里的"记住"是为了三件事：
 *  1. 详情页能显示「这条已分享 · 撤回」，而不是每次点都重新发一条（那会在服务器上堆一堆同内容链接）；
 *  2. 重复点「分享」时能先给出**原来那条**的地址（30 天内一直有效，没必要再发）；
 *  3. 重置数据前能**尽力撤回**（见 revokeAll）：本机一清，详情页就没了，那些链接会变成"谁也撤不了"。
 *
 * 它在云备份范围内（不在 cloudBackup 的 LOCAL_ONLY_STORES 里）：换机之后还要能撤 ——
 * 若换机丢了这份记录，你就再也找不到自己发过哪些链接了。
 *
 * 注意：服务器的快照**独立于云备份**（关掉云备份不会让链接失效），所以这两件事互不影响。
 */
import { ref } from 'vue'
import { defineStore } from 'pinia'
import { revokeShare } from '@/api/modules/share'
import { useAccountStore } from '@/stores/account'

/** 本机最多留多少条留痕（超过就丢最旧的：它只是"记认"，不是内容） */
const MAX_RECORDS = 200

export interface ShareRecord {
  token: string
  /** 对应的收件条目 id（详情页据此判断"这条分享过没有"） */
  itemId: string
  /** 本机记认用的短标题（服务器那边有自己的副本，这里只为了列表好看） */
  title: string
  /** 网页版链接（复制用；小程序卡片走 path，不用它） */
  h5Url: string
  createdAt: string
  expiresAt: string
}

/** 还没过期（过期后服务器上已删，本机留痕只是等着被清） */
function isLive(r: ShareRecord, now: number): boolean {
  const t = Date.parse(r.expiresAt || '')
  return Number.isFinite(t) ? t > now : false
}

export const useShareStore = defineStore(
  'share',
  () => {
    const items = ref<ShareRecord[]>([])

    /** 记一条（同一个 token 只留一份，新记的排前面） */
    function record(r: ShareRecord): void {
      items.value = [r, ...items.value.filter((x) => x.token !== r.token)].slice(0, MAX_RECORDS)
    }

    /** 删本机留痕（撤回成功后调用；服务器那边已经删了） */
    function drop(token: string): void {
      items.value = items.value.filter((x) => x.token !== token)
    }

    /** 这条内容还活着的分享（可能多条：用户可能重新分享过） */
    function liveOf(itemId: string): ShareRecord[] {
      const now = Date.now()
      return items.value.filter((x) => x.itemId === itemId && isLive(x, now))
    }

    /** 最近一条（详情页只展示一条："这条已分享 · 撤回"） */
    function latestOf(itemId: string): ShareRecord | null {
      return liveOf(itemId)[0] ?? null
    }

    /**
     * 清掉已过期的留痕。
     * 服务器那边过期由巡检删除，这里是本机的一半 —— 不清的话列表只会越攒越长
     * （每条也就几十字节，但"看见一堆早就没用的链接"本身就是噪音）。
     */
    function prune(): number {
      const now = Date.now()
      const before = items.value.length
      items.value = items.value.filter((x) => isLive(x, now))
      return before - items.value.length
    }

    /**
     * 尽力撤回全部（重置「全部修行数据」之前调用）。
     *
     * 为什么重置要带上这一步：重置会把本机内容清掉、详情页也随之消失，
     * 而服务器上那些快照**还是公开可读的** —— 用户以为"删干净了"，其实没删。
     * 失败不拦着重置（可能只是没网），但要如实把条数报回去。
     */
    async function revokeAll(): Promise<{ ok: number; failed: number }> {
      const account = useAccountStore()
      const list = [...items.value]
      let ok = 0
      let failed = 0
      for (const it of list) {
        try {
          await account.withAuth((t) => revokeShare(t, it.token))
          drop(it.token)
          ok += 1
        } catch {
          failed += 1
        }
      }
      return { ok, failed }
    }

    return { items, record, drop, liveOf, latestOf, prune, revokeAll }
  },
  {
    persist: { key: 'share', paths: ['items'] },
  },
)

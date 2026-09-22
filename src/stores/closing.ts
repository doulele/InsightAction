/**
 * 今日收功 store —— 「一天结束前，把它收个尾」（2026-09-17）。
 *
 * 与「今日日课卡」的分工（别混）：
 *  - 日课卡是**系统生成**的今日快照（境界 / 四维 / 数字），给人看一眼；
 *  - 收功是**用户自己**的一句话（可留空），给一天一个明确的句号。
 *
 * 三条口径：
 *  1. **一天一条**：再点就是改那一句，不新开一条（改了会覆盖，因为这是"今天这句"，不是流水账）；
 *  2. **可以只标记不说话**：`close('')` 就是"今天收了"，不逼人写字；
 *  3. **不入账两次**：一天只在第一次收功时给分（config/trace.ts 的 DAY_CAP 管）。
 *
 * **写完的那一句会回写【知】**（2026-09-22）：三件事完成回写一张 action 卡、日课破了写的原因回写一张 note 卡，
 * 唯独最像"今日一悟"的收功那句原先是孤岛 —— 现在它同样落成一张卡（见 `syncCard`）。
 *
 * 安息日那天收功入口不出现（见 utils/sabbath.ts）—— 那天连"收尾"都不必。
 */
import { defineStore } from 'pinia'
import { computed, ref } from 'vue'
import { todayKey } from '@/stores/daily'
import { logTrace } from '@/utils/traceLog'
import { useKnowledgeStore } from '@/stores/knowledge'

export interface ClosingRecord {
  /** YYYY-MM-DD */
  day: string
  /** 收功时写下的那一句（可为空 = 只标记收了） */
  text: string
  createdAt: number
}

/** 留存上限：一天一条，400 条够回看一年多 */
const CAP = 400

export const useClosingStore = defineStore(
  'closing',
  () => {
    const records = ref<ClosingRecord[]>([])

    const todayRecord = computed<ClosingRecord | null>(() => records.value.find((r) => r.day === todayKey()) ?? null)
    const todayClosed = computed(() => todayRecord.value !== null)

    function byDay(day: string): ClosingRecord | null {
      return records.value.find((r) => r.day === day) ?? null
    }

    /**
     * 收功那句回写【知】（2026-09-22）。
     *
     * 为什么要有：这句是用户自己给今天留的话，比任何自动生成的东西都值得被反复看 ——
     * 它应该能被检索、能被"旧卡重逢"、能被推翻。之前它只躺在 closing 里，是个孤岛。
     *
     * 三条口径：
     *  1. **一天只有一张**：再收是改那一句（按 `src` 精确匹配） —— 刻意不存 cardId，
     *     省一份会漂移的真相（重那份 `refText` 的做法在 daily store 里已经验证过）；
     *  2. **没写字就不留卡**：`收了但没留字`是一种合法状态，不该在【知】里多一张空卡；
     *     若先前写过、后来把那句清掉了，也一并撤掉（同样是不留空壳）；
     *  3. **Lv.2**：那是自己的话，不是转述 —— 与日课"破例"那张卡同深度。
     */
    function syncCard(day: string, body: string): void {
      const src = `行 · 今日收功 ${day}`
      const k = useKnowledgeStore()
      const hit = k.cards.find((c) => c.src === src)
      if (!body) {
        if (hit) k.remove(hit.createdAt)
        return
      }
      if (hit) {
        hit.content = body
        return
      }
      k.add({
        kind: 'note',
        title: `今日收功 · ${day}`,
        content: body,
        tags: ['收功', '省察'],
        depth: 2,
        src,
      })
    }

    /**
     * 收功（当天已有则改写那一句）。
     * 返回是否**本次新建**（页面据此决定提示语：第一次是"收功"，第二次是"已更新"）。
     */
    function close(text = ''): boolean {
      const day = todayKey()
      const body = text.trim()
      const hit = records.value.find((r) => r.day === day)
      syncCard(day, body)
      if (hit) {
        hit.text = body
        return false
      }
      records.value.unshift({ day, text: body, createdAt: Date.now() })
      if (records.value.length > CAP) records.value = records.value.slice(0, CAP)
      logTrace({ kind: 'action.closing', text: body || '今日收功' })
      return true
    }

    /** 取消了（点错了 / 今天还想再做点事）—— 不删痕迹，只把这条记录拿掉 */
    function reopen(): void {
      const day = todayKey()
      records.value = records.value.filter((r) => r.day !== day)
      /* 那张卡也随之撤掉：既然今天还没完，「今日收功 · 今天」就不该留在【知】里 */
      syncCard(day, '')
    }

    /* ---------------- 跨页聚焦（2026-09-22） ----------------
     * 场景：小枢 23:00 的结算面板上有「给今天留一句」，点了要把人送到收功那一块并摊开。
     * 与 `daily` store 的 handoff 同一范式（**tab 页带不了 query**，只能走 store 交接），
     * 同样**不持久化**：取走即清，用户下次自己进「行」时不该被莫名其妙地弹开那一段。
     */
    const focus = ref(false)

    /** 请求：下一次进入「行」时摊开收功并滚过去 */
    function requestFocus(): void {
      focus.value = true
    }

    /** 取走并清空 */
    function takeFocus(): boolean {
      const f = focus.value
      focus.value = false
      return f
    }

    /** 最近的几条（写进日课卡 / 时间轴用） */
    function recent(n = 7): ClosingRecord[] {
      return records.value.slice(0, n)
    }

    return { records, todayRecord, todayClosed, byDay, close, reopen, recent, takeFocus, requestFocus }
  },
  {
    persist: { key: 'closing', paths: ['records'] },
  },
)

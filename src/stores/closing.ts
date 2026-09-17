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
 * 安息日那天收功入口不出现（见 utils/sabbath.ts）—— 那天连"收尾"都不必。
 */
import { defineStore } from 'pinia'
import { computed, ref } from 'vue'
import { todayKey } from '@/stores/daily'
import { logTrace } from '@/utils/traceLog'

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
     * 收功（当天已有则改写那一句）。
     * 返回是否**本次新建**（页面据此决定提示语：第一次是"收功"，第二次是"已更新"）。
     */
    function close(text = ''): boolean {
      const day = todayKey()
      const body = text.trim()
      const hit = records.value.find((r) => r.day === day)
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
      records.value = records.value.filter((r) => r.day !== todayKey())
    }

    /** 最近的几条（写进日课卡 / 时间轴用） */
    function recent(n = 7): ClosingRecord[] {
      return records.value.slice(0, n)
    }

    return { records, todayRecord, todayClosed, byDay, close, reopen, recent }
  },
  {
    persist: { key: 'closing', paths: ['records'] },
  },
)

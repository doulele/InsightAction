/**
 * 每日灵魂拷问 store —— 每晚 21:00 换题，作答按「题期」存档。
 * 批次 C · 知：提问与回答都留真实档案（连续作答建立复盘习惯）。
 * 题期：21:00 后即计入「明日」的题（晚间复盘归明天），跨午夜仍算同一天。
 */
import { defineStore } from 'pinia'
import { ref } from 'vue'

/** 每日一条档案：{ q: 题目, answer: 回答（可为空=未答） } */
export interface QuestionRecord {
  q: string
  answer: string
}

/** 每晚 21:00 换题 */
const ROLLOVER_HOUR = 21

/** 拷问池：一日一题，池尽后轮回 */
export const QUESTION_POOL: readonly string[] = [
  '今天真正改变了你判断或行为的，是哪一条信息？',
  '如果今天只能记住一件事，你希望是哪件？',
  '今天你「收藏」了什么却没消化？它真的值得吗？',
  '哪条信息让你产生了情绪，而不是思考？',
  '今天有什么是你明明知道却没能做到的？卡在哪？',
  '如果今晚就删掉一个信息源，你会删哪个？为什么？',
  '你今天的注意力，主要被什么「偷」走了？',
  '有什么旧想法，今天被一条新信息推翻了？',
  '今天你最想跟未来的自己交代什么？',
  '你是在做重要的事，还是在做紧急的事？',
  '今天最值得沉淀的一句话是什么？为什么是它？',
  '如果只允许自己保有 3 个信息源，你保留哪 3 个？',
]

function pad(n: number): string {
  return String(n).padStart(2, '0')
}

function fmt(d: Date): string {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

/** 题期键：21:00 后算作次日 */
export function questionSlotKey(d = new Date()): string {
  const t = d.getHours() >= ROLLOVER_HOUR ? new Date(d.getTime() + 24 * 60 * 60 * 1000) : d
  return fmt(t)
}

/** 距下一次换题还剩分钟数（用于 UI 展示） */
export function rolloverRemainMin(d = new Date()): number {
  const end = new Date(d)
  end.setHours(ROLLOVER_HOUR, 0, 0, 0)
  if (d.getHours() >= ROLLOVER_HOUR) end.setDate(end.getDate() + 1)
  return Math.max(0, Math.round((end.getTime() - d.getTime()) / 60_000))
}

export const useQuestionStore = defineStore(
  'question',
  () => {
    /** 全部历史档案：题期键 → 记录 */
    const records = ref<Record<string, QuestionRecord>>({})
    /** 当前题号游标（换题时 +1） */
    const lastIdx = ref(-1)

    /** 确保当天档案已就位（首次按天定题、之后轮换） */
    function ensureToday(): void {
      const key = questionSlotKey()
      if (records.value[key]) return
      if (lastIdx.value < 0) {
        const d = new Date()
        const doy = Math.floor((d.getTime() - new Date(d.getFullYear(), 0, 0).getTime()) / (24 * 60 * 60 * 1000))
        lastIdx.value = doy % QUESTION_POOL.length
      } else {
        lastIdx.value = (lastIdx.value + 1) % QUESTION_POOL.length
      }
      records.value[key] = { q: QUESTION_POOL[lastIdx.value], answer: '' }
    }

    /** 当前题期记录 */
    function today(): QuestionRecord | null {
      ensureToday()
      return records.value[questionSlotKey()] ?? null
    }

    /** 写入今日回答（可覆盖）；传空串视为清除 */
    function setAnswer(text: string): void {
      const key = questionSlotKey()
      ensureToday()
      records.value[key].answer = text.trim()
    }

    /** 今日是否已答 */
    function answeredToday(): boolean {
      const r = today()
      return Boolean(r?.answer)
    }

    /** 连续作答天数（含今天；从今天向前数有回答的题期） */
    function consecutiveDays(): number {
      let key = questionSlotKey()
      let count = 0
      // 今天还没答则从昨天开始数
      if (!records.value[key]?.answer) {
        const d = new Date(`${key}T12:00:00`)
        d.setDate(d.getDate() - 1)
        key = questionSlotKey(d)
      }
      while (records.value[key]?.answer) {
        count += 1
        const d = new Date(`${key}T12:00:00`)
        d.setDate(d.getDate() - 1)
        key = questionSlotKey(d)
      }
      return count
    }

    return { records, lastIdx, ensureToday, today, setAnswer, answeredToday, consecutiveDays }
  },
  {
    persist: { key: 'question', paths: ['records', 'lastIdx'] },
  },
)

/**
 * 微行动盲盒 store ——「今日三件事完成后，随机抽一个 3 分钟线下行动」。
 * 批次 C · 行：每天可抽一只，抽过的当天不会重抽（可再抽一次，但只记一次）。
 */
import { defineStore } from 'pinia'
import { ref } from 'vue'
import { todayKey } from '@/stores/daily'

/** 3 分钟线下行动池：都是放下手机、回到身体的开关 */
export const BOX_IDEAS: readonly string[] = [
  '把手机放另一个房间，闭眼听四周 3 分钟',
  '走到窗边，数出窗外三种不同的颜色',
  '给一个久未联系的人，发一句问候',
  '找一件乱放的东西，把它归位',
  '倒一杯水，分三口慢慢喝完',
  '写下脑中三个念头，然后划掉最不重要的两个',
  '深呼吸十次，每次呼气从一数到四',
  '出门走两百步，再原路回来',
  '对镜子里的自己笑一下，说句辛苦了',
  '摸一摸手边的物件，说出它的来历',
  '把明天最重要的一件事写在纸上，贴到看得见的地方',
  '做一次全身舒展，每个部位停二十秒',
  '把桌面不用的一个 App 移到文件夹深处',
  '认真吃一口今天没细吃的东西，咀嚼二十下',
  '给五年后的自己写一句话',
  '站直，把肩膀向后绕十圈',
]

/**
 * 走动类（2026-09-17）：步数明显不足时，优先从这几只里出。
 *
 * 为什么不是单独一个"运动盲盒"：盲盒的价值就在于不知道会抽到什么；
 * 加一整个新池子会把它变成分类菜单。只调**权重**就够了 ——
 * 今天走得太少，先给你一只离开座位的；走得够了，一切照旧。
 */
export const BOX_MOVE_INDEXES: readonly number[] = [
  1, // 走到窗边，数出窗外三种不同的颜色
  7, // 出门走两百步，再原路回来
  11, // 做一次全身舒展
  15, // 站直，把肩膀向后绕十圈
]

export interface DrawnBox {
  dayKey: string
  index: number
  /** 当日是否完成过一次（用于展示状态，不强制） */
  done: boolean
}

export const useBoxStore = defineStore(
  'box',
  () => {
    const drawn = ref<DrawnBox | null>(null)

    /** 今天抽过没 */
    function todayDrawn(): DrawnBox | null {
      const k = todayKey()
      return drawn.value && drawn.value.dayKey === k ? drawn.value : null
    }

    /**
     * 抽一只；可再抽一次（取与上次不同的角）。
     * @param preferMove 今天步数明显不足 → 先从走动类里出（见 BOX_MOVE_INDEXES）
     */
    function draw(allowRedraw: boolean, preferMove = false): number | null {
      const today = todayDrawn()
      if (today && !allowRedraw) return today.index
      const pool = preferMove && BOX_MOVE_INDEXES.length ? BOX_MOVE_INDEXES : null
      let idx = pool
        ? pool[Math.floor(Math.random() * pool.length)]
        : Math.floor(Math.random() * BOX_IDEAS.length)
      // 换一只：避免连续两次同一行动
      if (today && allowRedraw) {
        let guard = 0
        while (idx === today.index && guard < 40) {
          idx = pool
            ? pool[Math.floor(Math.random() * pool.length)]
            : Math.floor(Math.random() * BOX_IDEAS.length)
          guard += 1
        }
      }
      const entry: DrawnBox = { dayKey: todayKey(), index: idx, done: false }
      if (today && allowRedraw) {
        // 允许覆盖当天的盲盒内容
        drawn.value = { ...entry, done: today.done }
      } else {
        drawn.value = entry
      }
      return idx
    }

    function markDone(): void {
      const t = todayDrawn()
      if (t) {
        t.done = true
        drawn.value = { ...t }
      }
    }

    return { drawn, todayDrawn, draw, markDone }
  },
  {
    persist: { key: 'box', paths: ['drawn'] },
  },
)

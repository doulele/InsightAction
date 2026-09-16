/**
 * 设置 store —— 本机偏好（开关等）。
 *
 * 提醒开关的现状（2026-09-16 查证官方文档后定的口径）：
 * `eveningRemind` / `streakRemind` **目前只保存"意愿"，不产生任何系统推送** ——
 * 因为个人主体拿不到微信「长期订阅」资格（长期订阅只向政务民生/医疗/交通/金融/教育等
 * 线下公共服务开放），而"每天固定提醒"正是长期订阅的形态。详见 `docs/观止知行-未做事项.md` #1。
 *
 * 真正在跑的到点提醒是**打开小程序时**的激励（见 `composables/useBuddy.ts` 的早晚窗），
 * 与本 store 的开关无关 —— 别误以为改了这里就能收到推送。
 */
import { defineStore } from 'pinia'
import { ref } from 'vue'

export const useSettingsStore = defineStore(
  'settings',
  () => {
    /** 每晚晚课提醒（21:00 灵魂拷问换题） */
    const eveningRemind = ref(true)
    /** 连续中断提醒（今日三件事若长时间未完成） */
    const streakRemind = ref(true)
    /**
     * 底噪过滤器 · 生存刚需模式（观大厅）。
     * 打开后观里只留「今天要处理的事 + 今天那一条」，把探索类入口（理库 / 母题 / 质量榜 / 稍后读）收起来。
     * 只影响显示，**不删任何数据**：关掉即原样回来。
     */
    const lowNoise = ref(false)

    return { eveningRemind, streakRemind, lowNoise }
  },
  {
    persist: { key: 'settings', paths: ['eveningRemind', 'streakRemind', 'lowNoise'] },
  },
)

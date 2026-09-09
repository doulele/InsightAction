/**
 * 设置 store —— 本机偏好（开关等）。
 * 注意：系统推送能力属批次 C（需后端订阅），此处的开关先保存「用户意愿」，
 * 正式接入推送后再做真正的订阅/退订动作。
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

    return { eveningRemind, streakRemind }
  },
  {
    persist: { key: 'settings', paths: ['eveningRemind', 'streakRemind'] },
  },
)

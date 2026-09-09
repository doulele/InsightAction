/**
 * 应用级 store：启动信息、首启标记、首次引导状态、版本等。
 */
import { defineStore } from 'pinia'
import { ref } from 'vue'

export const APP_VERSION = '0.2.0'

export const useAppStore = defineStore(
  'app',
  () => {
    /** 是否已完成首次引导（选模式 → 主界面） */
    const onboarded = ref(false)
    /** 是否首次打开小程序 */
    const firstLaunch = ref(true)
    /** 累计启动次数（本地） */
    const launchCount = ref(0)
    /** 最近一次启动时间（ISO） */
    const lastLaunchAt = ref('')
    /** 当前包版本号 */
    const versionName = APP_VERSION

    /** 每次 App onLaunch 时调用 */
    function recordLaunch(): void {
      firstLaunch.value = false
      launchCount.value += 1
      lastLaunchAt.value = new Date().toISOString()
    }

    /** 完成首次引导后调用（此后每次冷启动直接进主界面） */
    function finishOnboarding(): void {
      onboarded.value = true
    }

    return { onboarded, firstLaunch, launchCount, lastLaunchAt, versionName, recordLaunch, finishOnboarding }
  },
  {
    persist: { key: 'app', paths: ['onboarded', 'firstLaunch', 'launchCount', 'lastLaunchAt'] },
  },
)

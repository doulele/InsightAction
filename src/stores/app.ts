/**
 * 应用级 store：启动信息、首启标记、首次引导状态、版本等。
 */
import { defineStore } from 'pinia'
import { ref } from 'vue'

/**
 * 包版本号（**仅作开发版 / 体验版兜底**）。
 *
 * ⚠️ 正式版的版本号以「开发者工具「上传」时填的那个」为准 —— 它在运行时由
 * getRunningVersion()（utils/version.ts）返回，也是「关于」页与「检查更新」在正式环境显示的数字。
 * 这里写死的数字只在微信取不到线上版本号时（开发版 / 体验版）兜底显示，**发版不用改它**。
 */
export const APP_VERSION = '1.0.0'

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
    /**
     * 首次启动时间（ISO）—— 用作「第一周解锁曲线」的起跑线。
     * 只在第一次启动写入，之后不再更新（跨天/跨周都不动它）。
     */
    const firstLaunchAt = ref('')
    /** 当前包版本号 */
    const versionName = APP_VERSION

    /** 每次 App onLaunch 时调用 */
    function recordLaunch(): void {
      firstLaunch.value = false
      launchCount.value += 1
      lastLaunchAt.value = new Date().toISOString()
      if (!firstLaunchAt.value) firstLaunchAt.value = lastLaunchAt.value
    }

    /** 完成首次引导后调用（此后每次冷启动直接进主界面） */
    function finishOnboarding(): void {
      onboarded.value = true
    }

    return { onboarded, firstLaunch, launchCount, lastLaunchAt, firstLaunchAt, versionName, recordLaunch, finishOnboarding }
  },
  {
    persist: { key: 'app', paths: ['onboarded', 'firstLaunch', 'launchCount', 'lastLaunchAt', 'firstLaunchAt'] },
  },
)

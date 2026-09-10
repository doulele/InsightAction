/**
 * 微信小程序更新管理器封装。
 *
 * 为什么不用「一就绪就 applyUpdate」：
 *   微信在后台静默下载完新版本后若立刻 applyUpdate，会当场重启小程序，
 *   用户可能正在输入/答题，体验很差。这里只置 ready 标记，
 *   由 RemoteNotice 弹窗交给用户决定（强制更新时才强调「立即更新」）。
 */
import { ref } from 'vue'

/** 新版本包是否已下载就绪（就绪后调用 applyUpdateNow 才有效） */
export const updateReady = ref(false)

/** 结构化类型：避免不同基础库版本的类型差异（只用到这三个方法） */
interface UpdateManagerLike {
  onUpdateReady(cb: () => void): void
  onUpdateFailed(cb: () => void): void
  applyUpdate(): void
}

let manager: UpdateManagerLike | null = null

/** 启动时调用一次（App.vue onLaunch） */
export function initUpdateManager(): void {
  try {
    const um = uni.getUpdateManager?.() as UpdateManagerLike | undefined
    if (!um) return
    manager = um

    um.onUpdateReady(() => {
      updateReady.value = true
      console.log('[update] 新版本已下载完成，等待用户确认后重启生效')
    })

    um.onUpdateFailed(() => {
      console.warn('[update] 新版本下载失败，下次冷启动会自动重试')
    })
  } catch (e) {
    console.warn('[update] 初始化更新管理器失败：', e)
  }
}

/**
 * 立刻应用新版本（会重启小程序）。
 * 返回 false 表示「还没有就绪的新包」，调用方应改为提示用户手动重启/重进。
 */
export function applyUpdateNow(): boolean {
  if (!manager || !updateReady.value) return false
  try {
    manager.applyUpdate()
    return true
  } catch (e) {
    console.warn('[update] applyUpdate 失败：', e)
    return false
  }
}

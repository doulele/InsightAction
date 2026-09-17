/**
 * 微信小程序更新管理器封装。
 *
 * 为什么不用「一就绪就 applyUpdate」：
 *   微信在后台静默下载完新版本后若立刻 applyUpdate，会当场重启小程序，
 *   用户可能正在输入/答题，体验很差。这里只置 ready 标记，
 *   由 RemoteNotice / 设置页弹窗交给用户决定（强制更新时才强调「立即更新」）。
 *
 * ⚠️ 能力边界（设置页的「检查更新」据此如实说话，别承诺做不到的事）：
 *   微信**没有**「主动触发一次检查更新」的接口 —— 它只在小程序**冷启动时**自动查一次，
 *   结果分别由 onCheckForUpdate（有没有新版）与 onUpdateReady（新版下没下完）给出。
 *   所以这里的三个 ref 是"读取微信本次启动的结论"，不是"命令微信去查"。
 */
import { ref } from 'vue'

/** 新版本包是否已下载就绪（就绪后调用 applyUpdateNow 才有效） */
export const updateReady = ref(false)

/**
 * 微信本次启动的「检查更新」结论：
 *   unknown = 还没回报（或当前环境根本没有 UpdateManager）；
 *   has     = 确实有新版本，微信已开始/正在后台下载；
 *   none    = 微信确认当前就是线上最新版。
 */
export const updateCheckState = ref<'unknown' | 'has' | 'none'>('unknown')

/** 当前环境是否拿到了 UpdateManager（H5 预览 / 旧基础库拿不到 → 界面要如实说明） */
export const updateSupported = ref(false)

/** 结构化类型：避免不同基础库版本的类型差异（只用到这几个方法） */
interface UpdateManagerLike {
  onCheckForUpdate(cb: (res: { hasUpdate: boolean }) => void): void
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
    updateSupported.value = true

    /* 冷启动那一次检查的结论（有新版时微信会紧接着开始静默下载，下完再走 onUpdateReady） */
    um.onCheckForUpdate((res) => {
      updateCheckState.value = res?.hasUpdate ? 'has' : 'none'
      console.log(`[update] 微信检查更新：${res?.hasUpdate ? '有新版本' : '已是最新'}`)
    })

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

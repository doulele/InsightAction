/**
 * 远端配置 store：公告 / 版本信息 / 功能开关（纯下行，不含任何用户身份信息）。
 *
 * 三条原则：
 *  1. 静默失败：拉不到配置就全用本地默认（功能全开、无公告），绝不阻塞或打扰启动；
 *  2. 缺省即开启：features 里没写的键 feature() 返回 true ——
 *     避免「后端少写一行就把功能误关」这种最危险的失误；
 *  3. 展示态集中在此 store：RemoteNotice 组件会挂在多个 tab 页，
 *     若各实例持本地 state，会出现「切到另一个 tab 又弹一次」，故统一由 store 分发。
 */
import { defineStore } from 'pinia'
import { ref } from 'vue'
import { fetchAppConfig } from '@/api/modules/app'
import type { RemoteAppInfo, RemoteNotice } from '@/api/modules/app'
import { compareVersion } from '@/utils/version'

export interface UpdatePrompt {
  /** true = 低于最低支持版本或后端要求强制：弹窗不可取消 */
  force: boolean
  version: string
  note: string
  /** 「同一版本只提示一次」的去重键 */
  key: string
}

/** 已读公告 / 已提示版本的保留上限，避免无限增长 */
const MAX_HISTORY = 20

function pushCapped(list: string[], value: string): string[] {
  return [...list.filter((x) => x !== value), value].slice(-MAX_HISTORY)
}

export const useRemoteStore = defineStore(
  'remote',
  () => {
    /* ---------- 远端数据（持久化：冷启动先用旧值，不闪） ---------- */
    const features = ref<Record<string, boolean>>({})
    const appInfo = ref<RemoteAppInfo | null>(null)
    const seenNoticeIds = ref<string[]>([])
    const promptedUpdates = ref<string[]>([])
    const loaded = ref(false)

    /* ---------- 展示态（不持久化：每次冷启动重新决定弹不弹） ---------- */
    const activeNotice = ref<RemoteNotice | null>(null)
    const noticeShownThisSession = ref(false)
    const activeUpdate = ref<UpdatePrompt | null>(null)
    const updateShownThisSession = ref(false)

    /** 功能开关：未配置 / 拉取失败 一律视为开启 */
    function feature(key: string): boolean {
      return features.value[key] !== false
    }

    /** 启动时拉一次（失败静默） */
    async function load(): Promise<void> {
      try {
        const cfg = await fetchAppConfig()

        if (cfg?.features && typeof cfg.features === 'object') features.value = cfg.features
        if (cfg?.app) appInfo.value = cfg.app

        const n = cfg?.notice
        if (n?.id && !(n.once && seenNoticeIds.value.includes(n.id))) {
          activeNotice.value = {
            id: n.id,
            title: n.title || '公告',
            body: n.body || '',
            level: n.level === 'warn' ? 'warn' : 'info',
            once: n.once !== false,
            link: n.link || '',
          }
        }

        loaded.value = true
      } catch {
        // 忽略：远端配置不可用时保持本地默认（功能全开、无公告）
      }
    }

    /** 本次冷启动是否该弹公告（每个会话最多一次） */
    function shouldShowNotice(): boolean {
      if (noticeShownThisSession.value || !activeNotice.value) return false
      noticeShownThisSession.value = true
      return true
    }

    function closeNotice(): void {
      const n = activeNotice.value
      if (n?.once) seenNoticeIds.value = pushCapped(seenNoticeIds.value, n.id)
      activeNotice.value = null
    }

    /**
     * 版本提示决策。三种触发条件，只有第 1 条需要人工维护配置：
     *
     *  1. 低于 minVersion → 强制（"最低支持版本"是产品决策，微信不知道，必须人工配置）；
     *  2. 低于 latestVersion 且 forceUpdate=true → 强制（显式开关）；
     *  3. 微信已把新包下载就绪（bundleReady）→ 软提示"重启生效"。
     *     ★ 这条**不需要维护任何版本号**：wx.getUpdateManager 自己会跟线上版本比对，
     *       一旦 onUpdateReady 触发就说明确实有新版本，人工字段纯属多余。
     *
     * 注意：running 为空（开发版/体验版取不到线上版本号）时，1、2 两条自动跳过，
     * 但仍可走第 3 条的软提示。
     */
    function pickUpdate(running: string, bundleReady: boolean): UpdatePrompt | null {
      const info = appInfo.value
      if (!info) return null

      if (running && info.minVersion && compareVersion(running, info.minVersion) < 0) {
        return {
          force: true,
          version: info.latestVersion || info.minVersion,
          note: info.updateNote || '',
          key: `update:min:${info.minVersion}`,
        }
      }

      if (
        running &&
        info.forceUpdate === true &&
        info.latestVersion &&
        compareVersion(running, info.latestVersion) < 0
      ) {
        return {
          force: true,
          version: info.latestVersion,
          note: info.updateNote || '',
          key: `update:force:${info.latestVersion}`,
        }
      }

      if (bundleReady) {
        return {
          force: false,
          version: info.latestVersion || '',
          note: info.updateNote || '',
          key: `update:bundle:${info.latestVersion || 'latest'}`,
        }
      }

      return null
    }

    /** 本次冷启动是否该弹更新提示（非强制的同一版本只提示一次） */
    function shouldShowUpdate(running: string, bundleReady: boolean): boolean {
      if (updateShownThisSession.value) return false
      const p = pickUpdate(running, bundleReady)
      if (!p) return false
      if (!p.force && promptedUpdates.value.includes(p.key)) return false
      activeUpdate.value = p
      updateShownThisSession.value = true
      return true
    }

    function closeUpdate(): void {
      const p = activeUpdate.value
      if (p && !p.force) promptedUpdates.value = pushCapped(promptedUpdates.value, p.key)
      activeUpdate.value = null
    }

    return {
      features,
      appInfo,
      loaded,
      activeNotice,
      activeUpdate,
      feature,
      load,
      shouldShowNotice,
      closeNotice,
      shouldShowUpdate,
      closeUpdate,
    }
  },
  {
    persist: { key: 'remote', paths: ['features', 'appInfo', 'seenNoticeIds', 'promptedUpdates'] },
  },
)

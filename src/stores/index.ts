/**
 * Pinia 实例与持久化插件。
 *
 * 用法：在任意 defineStore 的第三个参数声明需要持久化的字段，
 * 数据会自动同步到 uni.setStorageSync（无需手动管理读写）：
 *
 *   defineStore('app', () => ({ ... }), {
 *     persist: { paths: ['firstLaunch', 'launchCount'] },
 *   })
 */
import { createPinia } from 'pinia'
import type { PiniaPluginContext, StateTree } from 'pinia'
import { toRaw } from 'vue'

export interface PersistStrategy {
  /** 存储键；缺省用 store.$id */
  key?: string
  /** 需要持久化的顶层 state 字段；缺省持久化全部 state */
  paths?: string[]
}

// 类型扩展：让 defineStore 第三参支持 persist 配置
declare module 'pinia' {
  export interface DefineStoreOptionsBase<S extends StateTree, Store> {
    persist?: boolean | PersistStrategy
  }
}

const STORE_PREFIX = 'insight:store:'

export function setupPinia() {
  const pinia = createPinia()
  pinia.use(persistPlugin)
  return pinia
}

function persistPlugin({ store, options }: PiniaPluginContext) {
  const cfg = options.persist
  if (!cfg) return

  const strategy: PersistStrategy = cfg === true ? {} : cfg
  const storageKey = STORE_PREFIX + (strategy.key ?? store.$id)

  // 一、水合：启动时把上次持久化的 state 放回去
  try {
    const saved = uni.getStorageSync(storageKey)
    if (saved) {
      const parsed = typeof saved === 'string' ? JSON.parse(saved) : saved
      store.$patch(parsed)
    }
  } catch (e) {
    console.warn(`[pinia-persist] hydrate "${storageKey}" failed:`, e)
  }

  // 二、订阅：state 变化后写回存储（detached 使组件卸载后仍生效）
  store.$subscribe(
    (_mutation, state) => {
      const raw = toRaw(state) as Record<string, unknown>
      const snapshot = strategy.paths
        ? Object.fromEntries(strategy.paths.map((p) => [p, raw[p]]))
        : raw
      uni.setStorageSync(storageKey, JSON.stringify(snapshot))
    },
    { detached: true },
  )
}

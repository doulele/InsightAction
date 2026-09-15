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

/**
 * 持久化键前缀（导出/恢复本地数据时也依赖它，见 src/utils/localBackup.ts）。
 * 改这里会同时影响持久化与备份的识别范围，务必两处一起考虑。
 */
export const STORE_PREFIX = 'insight:store:'

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
      /**
       * ⚠️ 快照必须从**响应式 state 取值**，不能 toRaw —— 这里踩过坑：
       * setup store 的字段在 pinia 内部是「ref 挂在 state 容器上」（`state.value[key] = ref`），
       * toRaw(state)[key] 拿到的是 RefImpl 而不是值；而 RefImpl 一旦被 $subscribe 的
       * deep watcher 跟踪过，就带上 dep → subs → effect → deps 的循环引用，
       * JSON.stringify 直接抛 "Converting circular structure to JSON"。
       * 结果是**每次状态变更写盘都失败**，storage 里一条 insight:store:* 都没有 ——
       * 表现就是「选了主题 / 做完测评，刷新后又要从头来」。
       * 响应式代理读取时会自动解包 ref，所以 state[key] 才是真正的值。
       */
      const snapshot = strategy.paths
        ? Object.fromEntries(strategy.paths.map((p) => [p, (state as Record<string, unknown>)[p]]))
        : state
      try {
        uni.setStorageSync(storageKey, JSON.stringify(snapshot))
      } catch (e) {
        // 持久化失败不致命：内存里的状态仍然正确，仅本次落盘丢失（下次变更会再试）
        console.warn(`[pinia-persist] persist "${storageKey}" failed:`, e)
      }
    },
    { detached: true },
  )
}

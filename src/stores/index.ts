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

/**
 * 剥掉旧快照里的「ref 壳」。
 *
 * 背景：写盘实现曾经误用 `toRaw(state)`（见下方 persistPlugin 注释），把 setup store 的
 * ref 原样序列化成了 `{ __v_isRef: true, _value: …, _rawValue: … }`。这种壳有两个恶果：
 *  1. 值是壳对象 → 业务读到的类型全错（`mode.id` 是对象、`results` 里查不到档）；
 *  2. 更长的一段时间里它甚至写不进去（循环引用抛错）。
 * 更隐蔽的是 `$patch` 对壳的处理：`isPlainObject(壳)` 为真，pinia 会把壳**并进 ref 实例内部**
 * 而不是给 ref 赋值，于是 `onboarded` 这类字段表面"补了"，实际仍是旧值 false ——
 * 表现就是「选了主题、做完测评，刷新后又要从头来一遍」。
 *
 * 所以水合前必须把壳剥成真正的值。只处理顶层（快照的顶层字段才是 ref），
 * 遇到普通值原样返回，对新格式完全无副作用。
 */
export function normalizePersisted(raw: unknown): StateTree | null {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null
  const out: StateTree = {}
  for (const [key, value] of Object.entries(raw as Record<string, unknown>)) {
    out[key] =
      value && typeof value === 'object' && !Array.isArray(value) &&
      (value as { __v_isRef?: unknown }).__v_isRef === true &&
      '_value' in (value as object)
        ? (value as { _value: unknown })._value
        : value
  }
  return out
}

function persistPlugin({ store, options }: PiniaPluginContext) {
  const cfg = options.persist
  if (!cfg) return

  const strategy: PersistStrategy = cfg === true ? {} : cfg
  const storageKey = STORE_PREFIX + (strategy.key ?? store.$id)

  // 一、水合：启动时把上次持久化的 state 放回去（先剥掉旧快照的 ref 壳，见 normalizePersisted）
  try {
    const saved = uni.getStorageSync(storageKey)
    if (saved) {
      const parsed = typeof saved === 'string' ? JSON.parse(saved) : saved
      const patch = normalizePersisted(parsed)
      if (patch) store.$patch(patch)
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

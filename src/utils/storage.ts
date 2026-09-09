/**
 * 本地存储统一封装（基于 uni.setStorageSync，值统一 JSON 序列化）。
 *
 * 相比直接散落调用 uni.getStorageSync：
 * - 集中管理键名（StorageKeys），杜绝字符串魔法值拼写错误；
 * - 泛型读写，取出来的值天然带类型；
 * - 预留命名空间前缀，将来换 Web/App 端也只需改这一处。
 */

export const StorageKeys = {
  /** 登录令牌（预留，未来对接 node 后端） */
  token: 'token',
} as const

export type StorageKey = (typeof StorageKeys)[keyof typeof StorageKeys]

const PREFIX = 'insight:'

function withPrefix(key: StorageKey | string): string {
  return key.startsWith(PREFIX) ? key : PREFIX + key
}

/** 读取；不存在或解析失败时返回 fallback */
export function getItem<T>(key: StorageKey | string, fallback: T | null = null): T | null {
  try {
    const raw = uni.getStorageSync(withPrefix(key))
    if (raw === '' || raw === null || raw === undefined) return fallback
    return JSON.parse(raw as string) as T
  } catch (e) {
    console.warn(`[storage] get "${key}" failed:`, e)
    return fallback
  }
}

export function setItem<T>(key: StorageKey | string, value: T): void {
  try {
    uni.setStorageSync(withPrefix(key), JSON.stringify(value))
  } catch (e) {
    console.warn(`[storage] set "${key}" failed:`, e)
  }
}

export function removeItem(key: StorageKey | string): void {
  try {
    uni.removeStorageSync(withPrefix(key))
  } catch (e) {
    console.warn(`[storage] remove "${key}" failed:`, e)
  }
}

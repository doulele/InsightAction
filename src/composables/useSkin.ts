/**
 * useSkin —— 页面根容器需要的皮肤 class
 * =======================================
 *
 * 返回 `gz-skin gz-skin--<mode>` 两段类名：
 *   .gz-skin         —— 共用基线（背景/文字兜底）
 *   .gz-skin--<mode> —— 注入当前模式对应的 CSS 变量
 *
 * 用法：
 *   <view class="page" :class="useSkinClass()">...</view>
 */
import { computed, type ComputedRef } from 'vue'
import { useModeStore } from '@/stores/mode'

export function useSkinClass(): ComputedRef<string> {
  const modeStore = useModeStore()
  return computed(() => `gz-skin gz-skin--${modeStore.id}`)
}
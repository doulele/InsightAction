<template>
  <!-- 图缺失 / 加载失败 → 整块不渲染，页面保持原有的纯 CSS 视觉（绝不出现破图或空位） -->
  <image
    v-if="url && !broken"
    class="mm"
    :class="`mm--${size}`"
    :src="url"
    mode="aspectFit"
    @error="onError"
  />
</template>

<script setup lang="ts">
/**
 * ModuleMark · 模块标志物
 * ========================
 * 用法（一行）：
 *   <ModuleMark mark="pause.focus" />
 *   <ModuleMark mark="reflect.card" size="md" />
 *
 * 地址由 config/marks.ts 推导（横幅同目录 + 固定文件名），随模式自动换图；
 * 图没有就什么都不渲染 —— 所以可以**先接管道、后补图**，中间态对用户无感。
 */
import { computed, ref, watch } from 'vue'
import { useModeStore } from '@/stores/mode'
import { useImageStore } from '@/stores/images'
import type { MarkKey } from '@/config/marks'

const props = withDefaults(
  defineProps<{
    /** 模块键：pause.focus / reflect.card / action.draw / me.achievement */
    mark: MarkKey
    /** 尺寸档：lg = 页面主标志物（默认），md = 卡片内嵌 */
    size?: 'lg' | 'md'
  }>(),
  { size: 'lg' },
)

const modeStore = useModeStore()
const imageStore = useImageStore()
/** 本地文件读失败（被系统清理/损坏）时的兜底隐身 */
const broken = ref(false)

/**
 * 远端地址：接口下发优先，没有则由 mode store 按"横幅同目录 + 固定文件名"推导。
 * 用于触发下载与失效重下。
 */
const remote = computed(() => modeStore.markOf(props.mark, modeStore.id))

/**
 * 展示地址：**只有本地文件就绪才给地址**。
 *
 * 为什么不等"先远端渲染、下载完再切本地"：那样同一张图会被请求两次
 * —— 组件一次、缓存层一次 ✗。标志物是装饰性内容，晚一两百毫秒出现完全可接受；
 * 宁可晚一点，也不要"双请求 + 可能的空框"。
 */
const url = computed(() => imageStore.localOf(remote.value))

/** 挂载 / 切模式即触发一次下载（已缓存则直接返回，不会再发起请求） */
watch(remote, (u) => void imageStore.prefetch(u), { immediate: true })

watch(
  () => [props.mark, modeStore.id],
  () => {
    broken.value = false
  },
)

/** 本地文件读失败 → 让缓存失效，下次进入会重新下载（不会一直空着） */
function onError(): void {
  broken.value = true
  imageStore.invalidate(remote.value)
}
</script>

<style lang="scss" scoped>
.mm {
  display: block;
  margin: 0 auto;
}

.mm--lg {
  width: 420rpx;
  height: 420rpx;
}

.mm--md {
  width: 200rpx;
  height: 200rpx;
}
</style>

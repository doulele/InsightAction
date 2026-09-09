<template>
  <view
    class="entry"
    :class="{ 'is-disabled': disabled }"
    hover-class="gz-hover"
    @click="onTap"
  >
    <view v-if="mark" class="entry__mark">{{ mark }}</view>

    <view class="entry__body">
      <view class="entry__head">
        <text class="entry__title">{{ title }}</text>
        <text v-if="badge" class="entry__badge" :class="badge.tone ? `is-${badge.tone}` : ''">
          {{ badge.text }}
        </text>
      </view>
      <text v-if="subtitle" class="entry__sub">{{ subtitle }}</text>
    </view>

    <text class="entry__arrow">→</text>
  </view>
</template>

<script setup lang="ts">
/**
 * 功能入口行：可复用于任何「卡片式导航入口」场景。
 * - 传入 url 自动跳转（路由集中管理，见 src/router/routes.ts）；
 * - 不传 url 则仅 emit select，由父级自定义行为；
 * - disabled 时点击给出「筹备中」提示。
 */
import { navigateTo } from '@/router/routes'
import type { RoutePath } from '@/router/routes'

export interface EntryBadge {
  text: string
  /** accent = 朱砂强调；muted = 灰色弱化 */
  tone?: 'accent' | 'muted'
}

const props = withDefaults(
  defineProps<{
    title: string
    subtitle?: string
    /** 左侧徽标字（单字为宜，如 观 / 止 / ＋） */
    mark?: string
    /** 跳转目标；缺省只触发 select 事件 */
    url?: RoutePath
    disabled?: boolean
    badge?: EntryBadge
  }>(),
  { disabled: false },
)

const emit = defineEmits<{ (e: 'select'): void }>()

function onTap(): void {
  if (props.disabled) {
    uni.showToast({ title: '正在筹备 · 敬请期待', icon: 'none' })
    return
  }
  emit('select')
  if (props.url) {
    void navigateTo(props.url)
  }
}
</script>

<style lang="scss" scoped>
.entry {
  display: flex;
  align-items: center;
  gap: 26rpx;
  padding: 34rpx 30rpx;
  background: $gz-surface;
  border: 1rpx solid $gz-line;
  border-radius: $gz-radius-md;
  transition: opacity 0.2s ease;
}

.entry__mark {
  display: flex;
  align-items: center;
  justify-content: center;
  flex: none;
  width: 76rpx;
  height: 76rpx;
  border: 1rpx solid $gz-accent;
  border-radius: 18rpx;
  background: $gz-accent-soft;
  color: $gz-accent;
  font-size: 34rpx;
  font-weight: 600;
}

.entry__body {
  flex: 1;
  min-width: 0;
}

.entry__head {
  display: flex;
  align-items: center;
  gap: 14rpx;
}

.entry__title {
  font-size: $gz-fs-title;
  font-weight: 600;
  color: $gz-ink;
}

.entry__sub {
  display: block;
  margin-top: 6rpx;
  font-size: $gz-fs-small;
  line-height: 1.6;
  color: $gz-ink-3;
}

.entry__badge {
  flex: none;
  padding: 4rpx 14rpx;
  border-radius: 999rpx;
  font-size: $gz-fs-caption;
  line-height: 1.6;
}

.entry__badge.is-accent {
  background: $gz-accent-soft;
  color: $gz-accent;
}

.entry__badge.is-muted {
  background: var(--gz-line-soft);
  color: $gz-ink-3;
}

.entry__arrow {
  flex: none;
  color: $gz-ink-3;
  font-size: 32rpx;
  transition: transform 0.2s ease;
}

/* 禁用态降饱和 */
.entry.is-disabled .entry__mark,
.entry.is-disabled .entry__title {
  opacity: 0.55;
}
</style>

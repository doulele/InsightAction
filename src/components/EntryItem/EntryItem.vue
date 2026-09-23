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
import type { RouteParams, RoutePath } from '@/router/routes'

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
    /**
     * 跳转参数（拼到 url 后面）。
     * 入口行也能带参数之后，「进这个页面并直接做某件事」就不必再写一个自定义组件了
     * （首个用户：知大厅的「费曼速记」→ 知识库并展开转述面板）。
     */
    params?: RouteParams
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
    void navigateTo(props.url, props.params)
  }
}
</script>

<style lang="scss" scoped>
@import '../../styles/hover';
.entry {
  display: flex;
  align-items: center;
  gap: 26rpx;
  padding: 34rpx 30rpx;
  background: $gz-surface;
  border: 1rpx solid $gz-line;
  border-radius: $gz-radius-md;
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

/*
 * 标题**永不折行**（2026-09-23 修，样式随组件内联，没有单独的 .scss）。
 *
 * 原先这里没有任何 flex 约束：标题（内容宽度）+ 徽标（`flex: none`）同排，
 * 两者相加超过正文宽度时，会被压的是**标题**而不是把徽标挪下去 ——
 * 表现是标题在中间断开（知大厅的「知识库 · 标签检索」断成「…标签检 / 索」，
 * 用户报"这个换行不好看"，五个大厅的入口行里只有它超宽）。
 *
 * 现在：标题可收缩（`flex: 0 1 auto` + `min-width: 0`）但**不折行**，
 * 实在挤不下就截断成省略号，徽标完整保留。配合把超宽那条的标题缩短（见 pages/reflect），
 * 实际不会再出现省略号。
 */
.entry__title {
  flex: 0 1 auto;
  min-width: 0;
  overflow: hidden;
  font-size: $gz-fs-title;
  font-weight: 600;
  color: $gz-ink;
  white-space: nowrap;
  text-overflow: ellipsis;
}

/*
 * 入口说明文字：走 `$gz-ink-2` 而不是 `$gz-ink-3`。
 * 它是「这一项是干什么的」，是五个大厅里被读得最多的一行字；
 * `ink-3` 在浅色皮肤上只有约 2.8:1 的对比度（不够读），见 App.scss 的口径说明。
 */
.entry__sub {
  display: block;
  margin-top: 6rpx;
  font-size: $gz-fs-small;
  line-height: 1.6;
  color: $gz-ink-2;
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

/* 箭头：原先挂了一条 `transition: transform`，但全项目没有任何地方改它的 transform（死属性） */
.entry__arrow {
  flex: none;
  color: $gz-ink-3;
  font-size: 32rpx;
}

/* 禁用态降饱和 */
.entry.is-disabled .entry__mark,
.entry.is-disabled .entry__title {
  opacity: 0.55;
}
</style>

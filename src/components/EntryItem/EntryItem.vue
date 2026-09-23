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

/*
 * 标题与徽标的分行口径（2026-09-23，样式随组件内联，没有单独的 .scss）。
 *
 * 这一处改过两轮，第一轮的方向是错的，写下来免得再来回：
 *  - 原先没有任何 flex 约束：标题（内容宽度）+ 徽标（`flex: none`）同排超宽时，
 *    被压的是**标题** —— 它在中间断开（「知识库 · 标签检索」断成「…标签检 / 索」）；
 *  - 第一轮改法给标题加了 `nowrap + 省略号`，**用户当场否掉**：
 *    标题是最该被读全的一行，**不能被省略掉**。
 *
 * 现在是三条（按用户的优先级）：
 *  ① 徽标字号收到 20rpx、内边距收窄 —— 尽量让两者共处一行；
 *  ② 真的并排放不下时，让**徽标自己换到第二行**（`flex-wrap`），标题不让步；
 *  ③ 标题本身超长（一行装不下）时**照常换行** —— 不截断、不加省略号。
 * 徽标换行后与标题左对齐（刻意不用 `margin-left: auto` 推到右缘：
 * "紧跟标题的一枚标签"才是它原本的语意）。
 */
.entry__head {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 8rpx 14rpx;
}

.entry__title {
  /* 可收缩但**不截断**：并排放不下由徽标换行，标题自己超长才折行 */
  flex: 0 1 auto;
  min-width: 0;
  font-size: $gz-fs-title;
  font-weight: 600;
  color: $gz-ink;
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

/*
 * 徽标：字号 22 → 20rpx、内边距 4/14 → 2/12
 * （2026-09-23 用户要求"后面那个标签字数啊字体啊小一点"，为的是让它与标题共处一行）。
 * 它是**元信息**（数量 / 状态），20rpx 仍在"小字不低于 18rpx"的底线之上；
 * `max-width: 100%` 是保险：极长的徽标自己折行，不会把整行撑破。
 */
.entry__badge {
  flex: none;
  max-width: 100%;
  padding: 2rpx 12rpx;
  border-radius: 999rpx;
  font-size: 20rpx;
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

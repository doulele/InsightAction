<template>
  <view class="page" :class="skinClass">
    <!-- 大厅头 -->
    <view class="hall-head">
      <view class="hall-head__row">
        <text class="hall-head__mark">行</text>
        <text class="hall-head__en">ACT · 验证 → 创造 → 痕迹</text>
      </view>
      <text class="hall-head__state">{{ stateText }}</text>
    </view>

    <!-- 今日三件事 -->
    <view class="today">
      <view class="today__head">
        <text class="today__label">今日三件事</text>
        <text class="today__count">{{ daily.doneCount }}/{{ daily.planCount || 3 }}</text>
      </view>

      <view v-for="todo in daily.todos" :key="todo.id" class="todo" :class="{ 'is-done': todo.done }">
        <view class="todo__check" :class="{ 'is-on': todo.done }" @click="onToggleTodo(todo)">
          <text v-if="todo.done" class="todo__tick">✓</text>
        </view>
        <input
          v-model="todo.text"
          class="todo__input"
          :class="{ 'is-done': todo.done }"
          placeholder="写下一件今天要做成的事…"
          placeholder-class="todo__ph"
          :maxlength="40"
          @blur="onEdited"
        />
      </view>

      <view v-if="daily.allDone" class="today__done">
        <text class="today__done-title">今日三事已成。</text>
        <text class="today__done-sub" hover-class="gz-hover" @click="openBox">
          已完成已回写【知】 · 去开一只微行动盲盒 →
        </text>
      </view>
    </view>

    <!-- 行动入口 -->
    <view class="section">
      <view class="section__head">
        <text class="section__title">把念头变成痕迹</text>
      </view>
      <view class="entries">
        <EntryItem
          v-for="item in moreEntries"
          :key="item.title"
          :title="item.title"
          :subtitle="item.subtitle"
          :mark="item.mark"
          :badge="item.badge"
          :url="item.url"
          :disabled="item.disabled"
        />
      </view>
    </view>

    <!-- 批次 D · 小枢全局浮层 -->
    <BuddyFloat />
  </view>
</template>

<script setup lang="ts">
/**
 * 行 · 行动大厅：验证→创造→痕迹。
 * 三件事勾选完成即回写【知】知识卡片（Lv.2 行动回写）并留下痕迹；
 * 习惯打卡 / 微行动盲盒 / 行动周报均为真实子页。
 */
import { computed } from 'vue'
import { onShow } from '@dcloudio/uni-app'
import { useModeStore } from '@/stores/mode'
import { useSkinClass } from '@/composables/useSkin'
import { useDailyStore, todayKey, type DailyTodo } from '@/stores/daily'
import { useKnowledgeStore } from '@/stores/knowledge'
import { useHabitStore } from '@/stores/habit'
import { useTraceStore } from '@/stores/trace'
import { poke } from '@/composables/useBuddy'
import { useXpStore } from '@/stores/xp'
import { useWishStore } from '@/stores/wish'
import { syncTabBar } from '@/utils/skin'
import { hallStatus } from '@/config/lexicon'
import { navigateTo, ROUTES } from '@/router/routes'
import type { RoutePath } from '@/router/routes'
import type { EntryBadge } from '@/components/EntryItem/EntryItem.vue'

const modeStore = useModeStore()
const skinClass = useSkinClass()
const daily = useDailyStore()
const knowledge = useKnowledgeStore()
const habit = useHabitStore()
const trace = useTraceStore()
const wishStore = useWishStore()
const xpTotal = useXpStore()

onShow(() => {
  daily.ensureToday()
  /* 批次 D · 小枢：评估到点激励 / 入定到点提醒 */
  poke()
  /* tabBar 原生样式/图标只能在本类大厅页上同步 */
  syncTabBar(modeStore.id)
})

const stateText = computed(() =>
  hallStatus('action', modeStore.id, { done: daily.doneCount, plan: daily.planCount }),
)

function onEdited(): void {
  // v-model 已实时同步 store，无需额外动作；跨天在 onShow ensureToday 处理
}

/** 勾选/取消完成：完成时行→知回写 + 痕迹入账 */
function onToggleTodo(todo: DailyTodo): void {
  const text = todo.text.trim()
  const willDone = !todo.done
  daily.toggle(todo.id)
  if (willDone && text) {
    writeBack(text)
  }
}

function writeBack(text: string): void {
  const k = todayKey()
  const dup = knowledge.cards.some((c) => {
    if (c.kind !== 'action') return false
    const d = new Date(c.createdAt)
    const day = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
    return day === k && c.title === text
  })
  if (!dup) {
    knowledge.add({ kind: 'action', title: text, content: text, tags: ['行动'], depth: 2, src: '行 · 行动回写' })
    useXpStore().gain(10)
  }
  trace.push('todo', text)
}

function openBox(): void {
  navigateTo(ROUTES.actionBox)
}

interface MoreEntry {
  mark: string
  title: string
  subtitle: string
  badge: EntryBadge
  url?: RoutePath
  disabled?: boolean
}

const moreEntries = computed<MoreEntry[]>(() => {
  const todayDone = habit.doneOn()
  const habitTotal = habit.habits.length
  const wishes = wishStore.wishes
  const wishReady = wishes.filter((w) => !w.claimedAt && xpTotal.total >= w.needXp).length
  const wishClaimed = wishes.filter((w) => w.claimedAt).length
  return [
    {
      mark: '惯',
      title: '习惯打卡',
      subtitle: '自定义习惯列表，每日一勾，痕迹可回溯',
      badge:
        habitTotal > 0
          ? todayDone > 0
            ? { text: `今日 ${todayDone}/${habitTotal}`, tone: 'accent' }
            : { text: `${habitTotal} 个习惯`, tone: 'muted' }
          : { text: '去建习惯', tone: 'muted' },
      url: ROUTES.actionHabits,
    },
    {
      mark: '盒',
      title: '微行动盲盒',
      subtitle: '随机 3 分钟线下行动，给身体一个开关',
      badge: daily.allDone
        ? { text: '可开启', tone: 'accent' }
        : { text: '先完成三件事', tone: 'muted' },
      url: ROUTES.actionBox,
    },
    {
      mark: '迹',
      title: '行动周报 · 痕迹时间轴',
      subtitle: '本周完成统计与趋势，看见自己在真实世界的痕迹',
      badge: { text: '周报', tone: 'accent' },
      url: ROUTES.actionWeekly,
    },
    {
      mark: '愿',
      title: '愿望清单',
      subtitle: '把戒断与专注攒下的修为 · 兑成现实里想得到的东西',
      badge:
        wishReady > 0
          ? { text: `${wishReady} 可兑现`, tone: 'accent' }
          : wishClaimed > 0
            ? { text: `已兑 ${wishClaimed}`, tone: 'accent' }
            : wishes.length > 0
              ? { text: '攒修为中', tone: 'muted' }
              : { text: '立一个愿望', tone: 'muted' },
      url: ROUTES.actionWishes,
    },
  ]
})
</script>

<style lang="scss" scoped>
.page {
  min-height: 100vh;
  padding: 24rpx $gz-page-pad 60rpx;
}

.hall-head {
  padding: 16rpx 0 30rpx;
}

.hall-head__row {
  display: flex;
  align-items: center;
  gap: 20rpx;
}

/* 模式印章：随皮肤走主色 —— 修仙=朱砂印、科技=电光蓝、普通=橄榄 */
.hall-head__mark {
  display: flex;
  align-items: center;
  justify-content: center;
  flex: none;
  width: 84rpx;
  height: 84rpx;
  font-size: 44rpx;
  font-weight: 800;
  color: $gz-accent;
  background: $gz-accent-soft;
  border: 2rpx solid $gz-accent;
  border-radius: 22rpx;
}

.hall-head__en {
  font-size: $gz-fs-caption;
  letter-spacing: $gz-ls-wide;
  color: $gz-ink-3;
}

.hall-head__state {
  display: block;
  margin-top: 12rpx;
  font-size: $gz-fs-small;
  color: $gz-accent;
}

.today {
  position: relative;
  overflow: hidden;
  padding: 34rpx 30rpx 30rpx;
  background: $gz-surface;
  border: 1rpx solid $gz-line;
  border-radius: $gz-radius-lg;

  /* 模式顶缘：与「我」页等级卡同一道模式色带，一瞥即知当前皮肤 */
  &::before {
    content: '';
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    height: 6rpx;
    background: linear-gradient(90deg, $gz-accent, $gz-grad-to);
  }
}

.today__head {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
}

.today__label {
  font-size: 32rpx;
  font-weight: 700;
  color: $gz-ink;
}

.today__count {
  font-size: 44rpx;
  font-weight: 800;
  color: $gz-accent;
}

.todo {
  display: flex;
  align-items: center;
  gap: 20rpx;
  padding: 22rpx 0;
  border-bottom: 1rpx solid $gz-line-soft;
}

.todo:last-child {
  border-bottom: none;
}

.todo__check {
  flex: none;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 44rpx;
  height: 44rpx;
  border: 2rpx solid $gz-ink-3;
  border-radius: 50%;
  color: transparent;
  transition: all 0.2s ease;
}

.todo__check.is-on {
  background: $gz-cta-bg;
  border-color: $gz-cta-bg;
  color: $gz-on-cta;
}

.todo__tick {
  font-size: 26rpx;
  font-weight: 700;
}

.todo__input {
  flex: 1;
  min-width: 0;
  font-size: $gz-fs-body;
  color: $gz-ink;
}

.todo__input.is-done {
  color: $gz-ink-3;
  text-decoration: line-through;
}

.todo__ph {
  color: $gz-ink-3;
}

.today__done {
  margin-top: 24rpx;
  padding: 22rpx 0 6rpx;
  text-align: center;
}

.today__done-title {
  display: block;
  font-size: $gz-fs-body;
  font-weight: 700;
  color: $gz-accent;
}

.today__done-sub {
  display: block;
  margin-top: 8rpx;
  font-size: $gz-fs-caption;
  color: $gz-ink-3;
}

.section {
  margin-top: 36rpx;
}

.section__head {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  margin-bottom: 20rpx;
}

.section__title {
  font-size: 32rpx;
  font-weight: 700;
  color: $gz-ink;
}

.entries {
  display: flex;
  flex-direction: column;
  gap: 18rpx;
}
</style>

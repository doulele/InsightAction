<template>
  <view class="page" :class="skinClass">
    <!-- 大厅头 -->
    <view class="hall-head">
      <view class="hall-head__row">
        <text class="hall-head__mark">止</text>
        <text class="hall-head__en">HOLD · 止刷 → 止行 → 止念</text>
      </view>
      <text class="hall-head__state">{{ stateText }}</text>
    </view>

    <!-- 今日定力 -->
    <view class="today">
      <view class="today__row">
        <view>
          <text class="today__label">今日定力目标</text>
          <text class="today__sub">走完一段沙漏即入账 · 连续天数正在守护</text>
        </view>
        <text class="today__num">{{ todayMin }}<text class="today__unit">/{{ focus.dailyGoal }} 分</text></text>
      </view>
      <view class="bar">
        <view class="bar__fill" :style="{ width: `${focusPct}%` }" />
      </view>
      <view class="today__streak" hover-class="gz-hover" @click="toStreak">{{ streakText }}</view>
    </view>

    <!-- 禅定沙漏 -->
    <view class="section">
      <view class="section__head">
        <text class="section__title">禅定沙漏</text>
        <text class="section__hint">翻转手机触发 · 中途退出需作答</text>
      </view>
      <view class="pills">
        <view
          v-for="d in durations"
          :key="d"
          class="pill"
          :class="{ 'is-on': d === chosenDur }"
          @click="chosenDur = d"
        >
          {{ d }} 分
        </view>
      </view>
      <button class="cta cta--ghost" hover-class="gz-hover" @click="onStartSandglass">
        开始一段静修
      </button>
    </view>

    <!-- 静心茶室 -->
    <view class="section">
      <view class="section__head">
        <text class="section__title">静心茶室</text>
        <text class="section__hint">五种方式 · 每次 5 分钟</text>
      </view>
      <view class="tea">
        <view v-for="room in teaRooms" :key="room.id" class="tea__room" hover-class="gz-hover" @click="onTea(room.id)">
          <view class="tea__dot" :style="{ background: room.accent }" />
          <text class="tea__name">{{ room.name }}</text>
          <text class="tea__desc">{{ room.desc }}</text>
        </view>
      </view>
    </view>

    <!-- 更深入口 -->
    <view class="section">
      <view class="section__head">
        <text class="section__title">养成定力</text>
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
 * 止 · 静修大厅：训练中断默认模式（止刷/止行/止念）。
 * 批次 A：定力展示 + 时长选择视觉；批次 B：禅定沙漏 / 静心茶室均为真实子页（分包），计时走完全程写入今日定力。
 */
import { computed, ref } from 'vue'
import { onShow } from '@dcloudio/uni-app'
import { useModeStore } from '@/stores/mode'
import { useFocusStore } from '@/stores/focus'
import { useReminderStore } from '@/stores/reminder'
import { useInterruptStore } from '@/stores/interrupt'
import { todayKey } from '@/stores/daily'
import { poke } from '@/composables/useBuddy'
import { useSkinClass } from '@/composables/useSkin'
import { syncTabBar } from '@/utils/skin'
import { hallStatus } from '@/config/lexicon'
import { navigateTo, ROUTES } from '@/router/routes'
import type { RoutePath } from '@/router/routes'
import type { EntryBadge } from '@/components/EntryItem/EntryItem.vue'

const modeStore = useModeStore()
const skinClass = useSkinClass()
const focus = useFocusStore()
const reminder = useReminderStore()
const interrupt = useInterruptStore()

/* tabBar 原生样式/图标只能在本类大厅页上同步 */
onShow(() => {
  /* 批次 D · 小枢：评估到点激励 / 入定到点提醒 */
  poke()
  syncTabBar(modeStore.id)
})

/** 今日定力：真实专注累计（沙漏/茶室子页写入）；连胜按自然日真实统计 */
const todayMin = computed(() => focus.minutesOn())
const streak = computed(() => focus.currentStreak)
const streakText = computed(() =>
  streak.value > 0
    ? `已连续 ${streak.value} 天 · 错过一天，重新计数`
    : todayMin.value > 0 ? '今天已入账 · 明天续上即第 2 天' : '今天走完一段，就是第 1 天',
)
const heldToday = computed(() => interrupt.heldOn(todayKey()))
const focusPct = computed(() => Math.min(100, Math.round((todayMin.value / focus.dailyGoal) * 100)))

const stateText = computed(() =>
  hallStatus('pause', modeStore.id, { focusMin: todayMin.value, streak: streak.value }),
)

/** 点连胜卡直达目标设置页 */
function toStreak(): void {
  navigateTo(ROUTES.pauseStreak)
}

const durations = [5, 15, 30, 60] as const
const chosenDur = ref<number>(15)

interface TeaRoom {
  /** 对应静心茶室子页的 room 场景 id */
  id: string
  name: string
  desc: string
  accent: string
}

/** 茶室五色：取「暗底也清晰」的一档，三套皮肤下都能辨认 */
const teaRooms: TeaRoom[] = [
  { id: 'xiang', name: '焚香', desc: '看烟起，什么都不做', accent: '#C4602E' },
  { id: 'sao', name: '扫尘', desc: '风过处，落叶自去', accent: '#84A268' },
  { id: 'ting', name: '听潮', desc: '潮来潮往，你是岸边', accent: '#4E8FD4' },
  { id: 'yun', name: '观云', desc: '看云聚散，不着于相', accent: '#9C8AC4' },
  { id: 'zhu', name: '煮雪', desc: '守着炉火，候雪水开', accent: '#7AA0B2' },
]

/** 禅定沙漏已是真实子页：进分包选时计时，走完全程写入今日定力 */
function onStartSandglass(): void {
  navigateTo(ROUTES.pauseSandglass)
}

/** 点某一盏直达茶室沉浸页：走完全程同样入账今日定力 */
function onTea(id: string): void {
  navigateTo(ROUTES.pauseTeaHouse, { room: id })
}

interface MoreEntry {
  mark: string
  title: string
  subtitle: string
  badge?: EntryBadge
  /** 已落地的子页跳转目标；缺省不跳 */
  url?: RoutePath
  /** 筹备中入口置灰；缺省即可点 */
  disabled?: boolean
}

const activeReminders = computed(() => reminder.reminders.filter((r) => r.enabled).length)

const moreEntries = computed<MoreEntry[]>(() => [
  {
    mark: '统',
    title: '专注统计',
    subtitle: '今日 / 本周 / 本月专注总时长与趋势',
    url: ROUTES.pauseStats,
  },
  {
    mark: '定',
    title: '定时入定',
    subtitle: '预设每日固定专注时段，到点提醒',
    badge:
      activeReminders.value > 0
        ? { text: `${activeReminders.value} 段待命`, tone: 'accent' }
        : { text: '未设置', tone: 'muted' },
    url: ROUTES.pauseSchedule,
  },
  {
    mark: '守',
    title: '每日定力目标 · 连胜',
    subtitle: '自设每日目标分钟 · 中断重计，诚实守护',
    badge:
      streak.value > 0
        ? { text: `连胜 ${streak.value}`, tone: 'accent' }
        : { text: '设定目标', tone: 'muted' },
    url: ROUTES.pauseStreak,
  },
  {
    mark: '停',
    title: '触发干预卡片',
    subtitle: '想打开某开关的瞬间 · 用 1-3 分钟呼吸把它摁回去',
    badge:
      heldToday.value > 0
        ? { text: `今日守住 ${heldToday.value} 次`, tone: 'accent' }
        : { text: '1-3 分钟', tone: 'muted' },
    url: ROUTES.pauseInterrupt,
  },
])
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

.today__row {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
}

.today__label {
  display: block;
  font-size: 32rpx;
  font-weight: 700;
  color: $gz-ink;
}

.today__sub {
  display: block;
  margin-top: 8rpx;
  font-size: $gz-fs-caption;
  color: $gz-ink-3;
}

.today__num {
  font-size: 44rpx;
  font-weight: 800;
  color: $gz-accent;
}

.today__unit {
  font-size: $gz-fs-small;
  font-weight: 400;
  color: $gz-ink-3;
}

.bar {
  margin-top: 26rpx;
  height: 12rpx;
  border-radius: 999rpx;
  background: var(--gz-line-soft);
  overflow: hidden;
}

.bar__fill {
  height: 100%;
  border-radius: 999rpx;
  background: linear-gradient(90deg, $gz-accent, $gz-grad-to);
  transition: width 0.6s ease;
}

.today__streak {
  margin-top: 18rpx;
  font-size: $gz-fs-caption;
  color: $gz-ink-2;
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

.section__hint {
  font-size: $gz-fs-caption;
  color: $gz-ink-3;
}

.pills {
  display: flex;
  gap: 16rpx;
  margin-bottom: 22rpx;
}

.pill {
  flex: 1;
  padding: 18rpx 0;
  text-align: center;
  font-size: $gz-fs-small;
  color: $gz-ink-2;
  background: $gz-surface;
  border: 1rpx solid $gz-line;
  border-radius: $gz-radius-md;
}

.pill.is-on {
  color: $gz-accent;
  border-color: $gz-accent;
  font-weight: 600;
}

.cta {
  width: 100%;
  padding: 26rpx 0;
  border-radius: $gz-radius-md;
  font-size: $gz-fs-body;
  font-weight: 600;
  letter-spacing: 0.08em;
}

.cta--ghost {
  background: $gz-accent-soft;
  color: $gz-accent;
}

.tea {
  display: flex;
  flex-wrap: wrap;
  gap: 16rpx;
}

.tea__room {
  width: calc((100% - 32rpx) / 3);
  box-sizing: border-box;
  padding: 22rpx 18rpx;
  background: $gz-surface;
  border: 1rpx solid $gz-line;
  border-radius: $gz-radius-md;
}

.tea__dot {
  width: 12rpx;
  height: 12rpx;
  border-radius: 50%;
}

.tea__name {
  display: block;
  margin-top: 12rpx;
  font-size: $gz-fs-body;
  font-weight: 700;
  color: $gz-ink;
}

.tea__desc {
  display: block;
  margin-top: 6rpx;
  font-size: $gz-fs-caption;
  line-height: 1.6;
  color: $gz-ink-3;
}

.entries {
  display: flex;
  flex-direction: column;
  gap: 18rpx;
}
</style>

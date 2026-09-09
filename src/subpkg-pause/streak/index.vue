<template>
  <view class="page" :class="skinClass">
    <!-- 顶栏：返回 + 标题（子页统一样式） -->
    <view class="nav">
      <view class="nav__side" hover-class="gz-hover" @click="goBack">
        <text class="nav__back">‹</text>
      </view>
      <text class="nav__title">定力目标 · 连胜</text>
      <view class="nav__side" />
    </view>

    <!-- 目标调整 -->
    <view class="goal">
      <text class="goal__label">每日定力目标</text>
      <view class="goal__row">
        <view class="goal__step" hover-class="gz-hover" @click="stepGoal(-15)">−</view>
        <view class="goal__num">
          <text class="goal__value">{{ focus.dailyGoal }}</text>
          <text class="goal__unit">分钟 / 天</text>
        </view>
        <view class="goal__step" hover-class="gz-hover" @click="stepGoal(15)">＋</view>
      </view>
      <view class="goal__bar">
        <view class="goal__fill" :style="{ width: `${goalPct}%` }" />
      </view>
      <text class="goal__hint">{{ goalHint }}</text>
    </view>

    <!-- 三项统计 -->
    <view class="cards">
      <view class="card">
        <text class="card__label">当前连胜</text>
        <text class="card__value">{{ focus.currentStreak }}<text class="card__unit">天</text></text>
        <text class="card__sub">错过一天即重计</text>
      </view>
      <view class="card">
        <text class="card__label">最佳纪录</text>
        <text class="card__value">{{ focus.bestStreak }}<text class="card__unit">天</text></text>
        <text class="card__sub">历史最长连续</text>
      </view>
      <view class="card">
        <text class="card__label">今日</text>
        <text class="card__value">{{ todayMin }}<text class="card__unit">/{{ focus.dailyGoal }}</text></text>
        <text class="card__sub" :class="{ 'is-met': focus.todayMet }">{{ todaySub }}</text>
      </view>
    </view>

    <!-- 近 14 日达标格 -->
    <view class="section">
      <view class="section__head">
        <text class="section__title">近 14 日</text>
        <text class="section__hint">实心 = 当日达标 · 浅点 = 有入账未达标 · 空白 = 无</text>
      </view>
      <view class="grid">
        <view v-for="c in cells" :key="c.date" class="cell" :class="c.cls" @click="goStats">
          <view class="cell__dot" />
          <text class="cell__day">{{ c.day }}</text>
          <text class="cell__min">{{ c.min > 0 ? c.min : '' }}</text>
        </view>
      </view>
      <view class="legend">
        <text class="legend__note">近 14 日达标 {{ metDays }} 天 · 以当前目标口径回看</text>
      </view>
    </view>

    <view class="foot">
      <text class="foot__text">连胜不是奖品 · 是每天和自己续约一次</text>
    </view>
  </view>
</template>

<script setup lang="ts">
/**
 * 止 · 每日定力目标 · 连胜 —— 批次 B 收尾真实子页（分包 subpkg-pause）。
 * 可调每日目标分钟数；连胜由 focus store 按「自然日有入账」诚实统计；
 * 近 14 日格子展示每日是否有入账 / 是否达标。
 */
import { computed } from 'vue'
import { useFocusStore } from '@/stores/focus'
import { useSkinClass } from '@/composables/useSkin'
import { navigateTo, ROUTES } from '@/router/routes'

const focus = useFocusStore()
const skinClass = useSkinClass()

function pad(n: number): string {
  return String(n).padStart(2, '0')
}

function fmt(d: Date): string {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

const todayStr = fmt(new Date())

const todayMin = computed(() => focus.minutesOn(todayStr))
const goalPct = computed(() => Math.min(100, Math.round((todayMin.value / focus.dailyGoal) * 100)))
const todaySub = computed(() => {
  if (focus.todayMet) return '今日已达标'
  return todayMin.value > 0 ? `还差 ${focus.dailyGoal - todayMin.value} 分钟` : '今天还没入账'
})

const goalHint = computed(() => {
  if (todayMin.value >= focus.dailyGoal) return '今日目标已达成 · 多静修一段是给明天的自己加餐'
  if (focus.currentStreak > 0) return `已连续 ${focus.currentStreak} 天 · 今天守住即续约`
  return '从今天走完一段沙漏开始'
})

function stepGoal(delta: number): void {
  focus.setDailyGoal(focus.dailyGoal + delta)
}

interface Cell {
  date: string
  day: string
  min: number
  met: boolean
  isToday: boolean
  cls: string
}

const cells = computed<Cell[]>(() => {
  const out: Cell[] = []
  for (let i = 13; i >= 0; i--) {
    const d = new Date()
    d.setDate(d.getDate() - i)
    const date = fmt(d)
    const min = focus.minutesOn(date)
    const met = min >= focus.dailyGoal
    const isToday = date === todayStr
    const cls = min === 0 ? 'is-none' : met ? 'is-met' : isToday ? 'is-part is-today' : 'is-part'
    out.push({ date, day: `${d.getMonth() + 1}/${d.getDate()}`, min, met, isToday, cls })
  }
  return out
})

const metDays = computed(() => cells.value.filter((c) => c.met).length)

function goStats(): void {
  navigateTo(ROUTES.pauseStats)
}

function goBack(): void {
  const pages = getCurrentPages()
  if (pages.length > 1) {
    uni.navigateBack()
  } else {
    uni.switchTab({ url: ROUTES.tabPause })
  }
}
</script>

<style lang="scss" scoped>
.page {
  min-height: 100vh;
  padding: calc(var(--status-bar-height) + 16rpx) $gz-page-pad 60rpx;
  box-sizing: border-box;
}

.nav {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 8rpx 0 10rpx;
}

.nav__side {
  width: 76rpx;
  height: 76rpx;
}

.nav__back {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 76rpx;
  height: 76rpx;
  border: 1rpx solid $gz-line;
  border-radius: 50%;
  background: $gz-surface;
  color: $gz-ink-2;
  font-size: 52rpx;
  line-height: 1;
  padding-bottom: 8rpx;
}

.nav__title {
  font-size: 34rpx;
  font-weight: 700;
  letter-spacing: 0.08em;
  color: $gz-ink;
}

/* 目标调整 */
.goal {
  margin-top: 16rpx;
  padding: 30rpx 30rpx 28rpx;
  background: $gz-surface;
  border: 1rpx solid $gz-line;
  border-radius: $gz-radius-lg;
}

.goal__label {
  display: block;
  font-size: $gz-fs-caption;
  letter-spacing: 0.12em;
  color: $gz-accent;
}

.goal__row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-top: 18rpx;
}

.goal__step {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 76rpx;
  height: 76rpx;
  border: 1rpx solid $gz-line;
  border-radius: 50%;
  color: $gz-ink-2;
  font-size: 44rpx;
  line-height: 1;
}

.goal__num {
  display: flex;
  align-items: baseline;
  gap: 10rpx;
}

.goal__value {
  font-size: 76rpx;
  font-weight: 800;
  color: $gz-ink;
  line-height: 1;
  font-variant-numeric: tabular-nums;
}

.goal__unit {
  font-size: $gz-fs-small;
  color: $gz-ink-3;
}

.goal__bar {
  margin-top: 26rpx;
  height: 12rpx;
  border-radius: 999rpx;
  background: var(--gz-line-soft);
  overflow: hidden;
}

.goal__fill {
  height: 100%;
  border-radius: 999rpx;
  background: linear-gradient(90deg, $gz-accent, $gz-grad-to);
  transition: width 0.5s ease;
}

.goal__hint {
  display: block;
  margin-top: 16rpx;
  font-size: $gz-fs-caption;
  color: $gz-ink-3;
}

/* 三项统计 */
.cards {
  display: flex;
  gap: 14rpx;
  margin-top: 22rpx;
}

.card {
  flex: 1;
  min-width: 0;
  padding: 24rpx 18rpx;
  background: $gz-surface;
  border: 1rpx solid $gz-line;
  border-radius: $gz-radius-md;
}

.card__label {
  display: block;
  font-size: $gz-fs-caption;
  color: $gz-ink-3;
}

.card__value {
  display: block;
  margin-top: 12rpx;
  font-size: 44rpx;
  font-weight: 800;
  color: $gz-accent;
  line-height: 1.1;
  font-variant-numeric: tabular-nums;
}

.card__unit {
  font-size: $gz-fs-caption;
  font-weight: 400;
  color: $gz-ink-3;
}

.card__sub {
  display: block;
  margin-top: 10rpx;
  font-size: 18rpx;
  line-height: 1.5;
  color: $gz-ink-3;
}

.card__sub.is-met {
  color: $gz-accent;
}

/* 达标格 */
.section {
  margin-top: 38rpx;
}

.section__head {
  display: flex;
  flex-direction: column;
  gap: 6rpx;
  margin-bottom: 18rpx;
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

.grid {
  display: flex;
  gap: 10rpx;
  flex-wrap: wrap;
}

.cell {
  width: calc((100% - 130rpx) / 14);
  min-width: 0;
  display: flex;
  flex-direction: column;
  align-items: center;
}

.cell__dot {
  width: 100%;
  height: 0;
  padding-bottom: 100%;
  border-radius: 12rpx;
  background: var(--gz-line-soft);
  border: 2rpx solid transparent;
  box-sizing: border-box;
}

.cell.is-met .cell__dot {
  background: $gz-accent;
}

.cell.is-part .cell__dot {
  background: $gz-accent-soft;
  border-color: $gz-accent;
}

.cell.is-today .cell__dot {
  border-color: $gz-accent;
  box-shadow: 0 0 0 2rpx $gz-surface inset;
}

.cell__day {
  margin-top: 8rpx;
  font-size: 18rpx;
  color: $gz-ink-3;
  transform: scale(0.92);
}

.cell__min {
  margin-top: 2rpx;
  font-size: 18rpx;
  color: $gz-ink-3;
}

.legend {
  margin-top: 20rpx;
}

.legend__note {
  font-size: $gz-fs-caption;
  color: $gz-ink-3;
}

.foot {
  margin-top: 44rpx;
  display: flex;
  justify-content: center;
}

.foot__text {
  font-size: $gz-fs-caption;
  letter-spacing: 0.06em;
  color: $gz-ink-3;
}
</style>

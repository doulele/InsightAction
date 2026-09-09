<template>
  <view class="page" :class="skinClass">
    <!-- 顶栏：返回 + 标题（子页统一样式） -->
    <view class="nav">
      <view class="nav__side" hover-class="gz-hover" @click="goBack">
        <text class="nav__back">‹</text>
      </view>
      <text class="nav__title">专注统计</text>
      <view class="nav__side" />
    </view>

    <!-- 今日 / 本周 / 本月 -->
    <view class="cards">
      <view class="card">
        <text class="card__label">今日</text>
        <text class="card__value">{{ fmtMin(todayMin) }}</text>
        <view class="card__meter">
          <view class="card__meter-fill" :style="{ width: `${todayPct}%` }" />
        </view>
        <text class="card__hint">小目标 /60 分</text>
      </view>
      <view class="card">
        <text class="card__label">本周</text>
        <text class="card__value">{{ fmtMin(weekMin) }}</text>
        <text class="card__hint">周一至今</text>
      </view>
      <view class="card">
        <text class="card__label">本月</text>
        <text class="card__value">{{ fmtMin(monthMin) }}</text>
        <text class="card__hint">{{ monthText }} 至今</text>
      </view>
    </view>

    <!-- 近 7 日趋势 -->
    <view class="section">
      <view class="section__head">
        <text class="section__title">近 7 日</text>
        <text class="section__hint">每格一段走完的沙漏</text>
      </view>

      <view v-if="total7 > 0" class="trend">
        <view v-for="d in trend" :key="d.date" class="trend__col">
          <view class="trend__bar-wrap">
            <view class="trend__bar" :class="{ 'is-today': d.isToday }" :style="{ height: `${d.h}%` }" />
          </view>
          <text class="trend__day">{{ d.week }}</text>
          <text class="trend__min">{{ d.min > 0 ? d.min : '' }}</text>
        </view>
      </view>
      <view v-else class="void">
        <text class="void__title">尚无专注记录</text>
        <text class="void__desc">走完一段沙漏，这里就会长出第一根柱子。</text>
        <button class="void__cta" hover-class="gz-hover" @click="toSandglass">
          去翻转沙漏
        </button>
      </view>
    </view>

    <view class="foot">
      <text class="foot__text">只计走完全程的静修 · 中途退出不入账</text>
    </view>
  </view>
</template>

<script setup lang="ts">
/**
 * 止 · 专注统计 —— 批次 B 真实功能子页（分包 subpkg-pause）。
 * 数据来自 focus store（禅定沙漏走完全程写入）：今日/本周/本月 + 近 7 日趋势。
 */
import { computed } from 'vue'
import { useFocusStore } from '@/stores/focus'
import { useSkinClass } from '@/composables/useSkin'
import { navigateTo, ROUTES } from '@/router/routes'

const focus = useFocusStore()
const skinClass = useSkinClass()

const WEEKDAYS = ['日', '一', '二', '三', '四', '五', '六'] as const
const DAY_GOAL_MIN = 60

function pad(n: number): string {
  return String(n).padStart(2, '0')
}

function fmtDate(d: Date): string {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

const today = new Date()
const todayStr = fmtDate(today)

/** 本周一（周一为起点） */
const weekStart = (() => {
  const d = new Date(today)
  d.setDate(d.getDate() - ((today.getDay() + 6) % 7))
  return fmtDate(d)
})()

const monthStart = `${today.getFullYear()}-${pad(today.getMonth() + 1)}-01`
const monthText = `${today.getMonth() + 1} 月`

const todayMin = computed(() => focus.minutesOn(todayStr))
const todayPct = computed(() => Math.min(100, Math.round((todayMin.value / DAY_GOAL_MIN) * 100)))
const weekMin = computed(() => focus.totalBetween(weekStart, todayStr))
const monthMin = computed(() => focus.totalBetween(monthStart, todayStr))

/** 分钟 → “X 小时 Y 分 / Y 分钟” */
function fmtMin(m: number): string {
  if (m < 60) return `${m} 分`
  const h = Math.floor(m / 60)
  const r = m % 60
  return r > 0 ? `${h} 小时 ${r} 分` : `${h} 小时`
}

interface TrendBar {
  date: string
  week: string
  min: number
  h: number
  isToday: boolean
}

const trend = computed<TrendBar[]>(() => {
  const bars: TrendBar[] = []
  for (let i = 6; i >= 0; i--) {
    const d = new Date()
    d.setDate(d.getDate() - i)
    const date = fmtDate(d)
    const min = focus.minutesOn(date)
    bars.push({
      date,
      week: WEEKDAYS[d.getDay()],
      min,
      h: 0,
      isToday: date === todayStr,
    })
  }
  const max = Math.max(1, ...bars.map((b) => b.min))
  bars.forEach((b) => {
    b.h = Math.round((b.min / max) * 100)
  })
  return bars
})

const total7 = computed(() => trend.value.reduce((s, b) => s + b.min, 0))

function toSandglass(): void {
  navigateTo(ROUTES.pauseSandglass)
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

/* 顶栏（子页同款） */
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

/* 三个统计卡 */
.cards {
  display: flex;
  gap: 16rpx;
  margin-top: 20rpx;
}

.card {
  flex: 1;
  min-width: 0;
  padding: 26rpx 22rpx;
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
  font-size: 40rpx;
  font-weight: 800;
  color: $gz-accent;
  line-height: 1.2;
}

.card__hint {
  display: block;
  margin-top: 8rpx;
  font-size: $gz-fs-caption;
  color: $gz-ink-3;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.card__meter {
  margin-top: 14rpx;
  height: 8rpx;
  border-radius: 999rpx;
  background: var(--gz-line-soft);
  overflow: hidden;
}

.card__meter-fill {
  height: 100%;
  border-radius: 999rpx;
  background: linear-gradient(90deg, $gz-accent, $gz-grad-to);
}

/* 趋势 */
.section {
  margin-top: 40rpx;
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

.trend {
  display: flex;
  align-items: flex-end;
  gap: 12rpx;
  height: 300rpx;
  padding: 30rpx 26rpx 22rpx;
  background: $gz-surface;
  border: 1rpx solid $gz-line;
  border-radius: $gz-radius-md;
  box-sizing: border-box;
}

.trend__col {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  height: 100%;
}

.trend__bar-wrap {
  flex: 1;
  width: 100%;
  display: flex;
  align-items: flex-end;
  justify-content: center;
}

.trend__bar {
  width: 40%;
  min-width: 10rpx;
  border-radius: 8rpx 8rpx 0 0;
  background: linear-gradient(180deg, $gz-accent, $gz-grad-to);
  opacity: 0.55;
}

.trend__bar.is-today {
  opacity: 1;
}

.trend__day {
  margin-top: 10rpx;
  font-size: $gz-fs-caption;
  color: $gz-ink-3;
}

.trend__min {
  margin-top: 2rpx;
  font-size: 18rpx;
  color: $gz-ink-3;
}

/* 空态 */
.void {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 60rpx 30rpx;
  background: $gz-surface;
  border: 1rpx dashed $gz-line;
  border-radius: $gz-radius-md;
}

.void__title {
  font-size: $gz-fs-body;
  font-weight: 600;
  color: $gz-ink-2;
}

.void__desc {
  margin-top: 10rpx;
  font-size: $gz-fs-caption;
  line-height: 1.7;
  text-align: center;
  color: $gz-ink-3;
}

.void__cta {
  margin-top: 26rpx;
  padding: 0 44rpx;
  height: 76rpx;
  line-height: 76rpx;
  border-radius: $gz-radius-md;
  background: $gz-accent;
  color: $gz-on-cta;
  font-size: $gz-fs-body;
}

.foot {
  margin-top: 44rpx;
  display: flex;
  justify-content: center;
}

.foot__text {
  font-size: $gz-fs-caption;
  letter-spacing: 0.08em;
  color: $gz-ink-3;
}
</style>

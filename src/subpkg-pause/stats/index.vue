<template>
  <view class="page" :class="skinClass">
    <!-- 顶栏：返回 + 标题（子页统一样式） -->
        <SubNav :fallback="ROUTES.tabPause">专注统计</SubNav>

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
        <text class="void__title">{{ $p('empty.stats.title') }}</text>
        <text class="void__desc">{{ $p('empty.stats.desc') }}</text>
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

</script>

<style lang="scss" scoped>
@import './index.scss';
</style>

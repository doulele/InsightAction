<template>
  <view class="page" :class="skinClass">
    <!-- 顶栏：返回 + 标题 -->
    <view class="nav">
      <view class="nav__side" hover-class="gz-hover" @click="goBack">
        <text class="nav__back">‹</text>
      </view>
      <text class="nav__title">行动周报 · 痕迹</text>
      <view class="nav__side" />
    </view>

    <!-- 周总况 -->
    <view class="head">
      <view class="head__range">{{ rangeText }}</view>
      <view class="stats">
        <view class="stat">
          <text class="stat__n">{{ todoCount }}</text>
          <text class="stat__cap">完成行动</text>
        </view>
        <view class="stat">
          <text class="stat__n">{{ habitCount }}</text>
          <text class="stat__cap">习惯打卡</text>
        </view>
        <view class="stat">
          <text class="stat__n">{{ boxCount }}</text>
          <text class="stat__cap">盲盒达成</text>
        </view>
      </view>
    </view>

    <!-- 近 7 日柱状 -->
    <view class="section">
      <view class="section__title">近 7 日痕迹</view>
      <view class="bars">
        <view v-for="d in days" :key="d.key" class="bar-col" @click="activeDay = d.key">
          <view class="bar-col__track">
            <view
              class="bar-col__fill"
              :class="{ 'is-cur': d.key === activeDay }"
              :style="{ height: `${barHeight(d.count)}%` }"
            />
          </view>
          <text class="bar-col__n">{{ d.count }}</text>
          <text class="bar-col__label" :class="{ 'is-cur': d.key === activeDay }">{{ d.label }}</text>
        </view>
      </view>
      <text class="bars__note">柱高为该日三件事完成 / 习惯打卡 / 盲盒动作的总痕迹数</text>
    </view>

    <!-- 当天明细 -->
    <view class="section">
      <view class="section__row">
        <text class="section__title">明细 · {{ activeLabel }}</text>
        <text class="section__more" hover-class="gz-hover" @click="goMe">全部痕迹 →</text>
      </view>
      <view v-if="!activeTraces.length" class="empty-line">
        这天没有痕迹。也可以是——那天你休息了一下。
      </view>
      <view v-else class="mini-list">
        <view v-for="t in activeTraces" :key="t.id" class="mini">
          <view class="mini__dot" :class="`is-${t.type}`" />
          <text class="mini__label">{{ labelOf(t.type) }}</text>
          <text class="mini__text">{{ t.text }}</text>
          <text class="mini__time">{{ timeOf(t.at) }}</text>
        </view>
      </view>
    </view>

    <view class="foot">
      <text class="foot__text">一周回头看 · 才知道脚步没白走</text>
    </view>
  </view>
</template>

<script setup lang="ts">
/**
 * 行动周报 · 痕迹时间轴（批次 C）· 分包 subpkg-action。
 * 本周三件事完成 / 习惯打卡 / 盲盒动作聚合 + 近 7 日痕迹柱 + 当日明细；
 * 时间轴复用「痕迹流」store，我页时间轴为同源不同视图。
 */
import { computed, ref } from 'vue'
import { useTraceStore, TRACE_LABEL, type Trace, type TraceType } from '@/stores/trace'
import { useHabitStore } from '@/stores/habit'
import { todayKey } from '@/stores/daily'
import { useSkinClass } from '@/composables/useSkin'
import { navigateTo, ROUTES } from '@/router/routes'

const trace = useTraceStore()
const habit = useHabitStore()
const skinClass = useSkinClass()

function pad(n: number): string {
  return String(n).padStart(2, '0')
}

function fmtDate(d: Date): string {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

function mondayOf(d: Date): Date {
  const t = new Date(d)
  const dow = (t.getDay() + 6) % 7
  t.setDate(t.getDate() - dow)
  t.setHours(0, 0, 0, 0)
  return t
}

const now = new Date()
const monday = mondayOf(now)
const mondayKey = fmtDate(monday)
const todayK = todayKey()

/* 本周事件数 */
const weekTraces = computed(() => trace.between(mondayKey, todayK))
const todoCount = computed(() => weekTraces.value.filter((t) => t.type === 'todo').length)
const boxCount = computed(
  () => weekTraces.value.filter((t) => t.type === 'box' && t.text.includes('完成')).length,
)
/** 习惯打卡：本周各习惯打卡的「习惯×天」总数 */
const habitCount = computed(() =>
  habit.habits.reduce(
    (sum, h) => sum + habit.daysOf(h.id).filter((d) => d >= mondayKey && d <= todayK).length,
    0,
  ),
)

function rangeTextOf(): string {
  const last = todayK === fmtDate(now) ? now : new Date()
  const start = `${monday.getMonth() + 1} 月 ${monday.getDate()} 日`
  const end = `${last.getMonth() + 1} 月 ${last.getDate()} 日`
  return `${start} - ${end} · 本周`
}

const rangeText = rangeTextOf()

/** 近 7 天（含今天） */
interface DayCell {
  key: string
  label: string
  count: number
}

const days = computed<DayCell[]>(() => {
  const out: DayCell[] = []
  for (let i = 6; i >= 0; i--) {
    const d = new Date()
    d.setDate(d.getDate() - i)
    const key = fmtDate(d)
    const tracesN = trace.ofDay(key).length
    const habitN = habit.doneOn(key)
    out.push({ key, label: i === 0 ? '今' : `${d.getMonth() + 1}/${d.getDate()}`, count: tracesN + habitN })
  }
  return out
})

const maxCount = computed(() => Math.max(1, ...days.value.map((d) => d.count)))

function barHeight(count: number): string {
  return `${Math.max(count > 0 ? 10 : 0, Math.round((count / maxCount.value) * 100))}%`
}

const activeDay = ref(todayK)
const activeLabel = computed(() => days.value.find((d) => d.key === activeDay.value)?.label ?? '')
const activeTraces = computed<Trace[]>(() => {
  const traces = trace.ofDay(activeDay.value)
  const fromHabit: Trace[] = []
  habit.habits.forEach((h) => {
    if (habit.isDone(h.id, activeDay.value)) {
      // 无时间戳，作为当天 08:00 之后一条伪记录展示明细
      fromHabit.push({
        id: -h.id - 1,
        type: 'habit',
        text: h.name,
        day: activeDay.value,
        at: new Date(`${activeDay.value}T08:00:00`).getTime(),
      })
    }
  })
  return [...traces, ...fromHabit].sort((a, b) => b.at - a.at).slice(0, 30)
})

function labelOf(type: TraceType): string {
  return TRACE_LABEL[type]
}

function timeOf(at: number): string {
  const d = new Date(at)
  return `${pad(d.getHours())}:${pad(d.getMinutes())}`
}

function goMe(): void {
  navigateTo(ROUTES.tabMe)
}

function goBack(): void {
  const pages = getCurrentPages()
  if (pages.length > 1) {
    uni.navigateBack()
  } else {
    uni.switchTab({ url: ROUTES.tabAction })
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

.head {
  margin-top: 16rpx;
  padding: 28rpx;
  background: $gz-surface;
  border: 1rpx solid $gz-line;
  border-radius: $gz-radius-lg;
}

.head__range {
  font-size: $gz-fs-caption;
  letter-spacing: 0.1em;
  color: $gz-accent;
}

.stats {
  display: flex;
  margin-top: 26rpx;
}

.stat {
  flex: 1;
  text-align: center;
}

.stat__n {
  display: block;
  font-size: 52rpx;
  font-weight: 800;
  color: $gz-ink;
  line-height: 1;
}

.stat__cap {
  display: block;
  margin-top: 10rpx;
  font-size: $gz-fs-caption;
  color: $gz-ink-3;
}

.section {
  margin-top: 36rpx;
}

.section__title {
  display: block;
  font-size: 32rpx;
  font-weight: 700;
  color: $gz-ink;
}

.section__row {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
}

.section__more {
  font-size: $gz-fs-caption;
  color: $gz-accent;
}

/* 柱状 */
.bars {
  margin-top: 22rpx;
  display: flex;
  gap: 12rpx;
  padding: 24rpx 20rpx 18rpx;
  background: $gz-surface;
  border: 1rpx solid $gz-line;
  border-radius: $gz-radius-md;
}

.bar-col {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  align-items: center;
}

.bar-col__track {
  width: 28rpx;
  height: 150rpx;
  border-radius: 10rpx;
  background: var(--gz-line-soft);
  display: flex;
  align-items: flex-end;
  overflow: hidden;
}

.bar-col__fill {
  width: 100%;
  border-radius: 10rpx;
  background: linear-gradient(180deg, $gz-accent, $gz-grad-to);
  transition: height 0.4s ease;
}

.bar-col__fill.is-cur {
  box-shadow: 0 0 0 4rpx $gz-accent-soft;
}

.bar-col__n {
  margin-top: 8rpx;
  font-size: $gz-fs-caption;
  font-weight: 700;
  color: $gz-ink-2;
}

.bar-col__label {
  margin-top: 4rpx;
  font-size: 18rpx;
  color: $gz-ink-3;
  transform: scale(0.92);
}

.bar-col__label.is-cur {
  color: $gz-accent;
  font-weight: 600;
}

.bars__note {
  display: block;
  margin-top: 14rpx;
  font-size: $gz-fs-caption;
  color: $gz-ink-3;
}

/* 明细 */
.mini-list {
  margin-top: 18rpx;
  display: flex;
  flex-direction: column;
  gap: 12rpx;
}

.mini {
  display: flex;
  align-items: center;
  gap: 14rpx;
  padding: 18rpx 22rpx;
  background: $gz-surface;
  border: 1rpx solid $gz-line;
  border-radius: $gz-radius-md;
}

.mini__dot {
  flex: none;
  width: 16rpx;
  height: 16rpx;
  border-radius: 50%;
}

.mini__dot.is-todo {
  background: #84a268;
}

.mini__dot.is-habit {
  background: #4e8fd4;
}

.mini__dot.is-box {
  background: #9c8ac4;
}

.mini__label {
  flex: none;
  font-size: $gz-fs-caption;
  color: $gz-ink-3;
}

.mini__text {
  flex: 1;
  min-width: 0;
  font-size: $gz-fs-caption;
  color: $gz-ink-2;
}

.mini__time {
  flex: none;
  font-size: 18rpx;
  color: $gz-ink-3;
}

.empty-line {
  margin-top: 18rpx;
  padding: 30rpx 20rpx;
  text-align: center;
  font-size: $gz-fs-caption;
  color: $gz-ink-3;
  border: 1rpx dashed $gz-line;
  border-radius: $gz-radius-md;
}

.foot {
  margin-top: 46rpx;
  display: flex;
  justify-content: center;
}

.foot__text {
  font-size: $gz-fs-caption;
  letter-spacing: 0.06em;
  color: $gz-ink-3;
}
</style>

<template>
  <view class="page" :class="skinClass">
    <!-- 顶栏 -->
    <view class="nav">
      <view class="nav__side" hover-class="gz-hover" @click="goBack">
        <text class="nav__back">‹</text>
      </view>
      <text class="nav__title">痕迹时间轴</text>
      <view class="nav__side" />
    </view>

    <!-- 汇总 -->
    <view class="head">
      <text class="head__range">全部留痕 · 共 {{ total }} 条 / {{ daysN }} 天</text>
      <view class="stats">
        <view class="stat">
          <text class="stat__n">{{ n.todo }}</text>
          <text class="stat__cap">完成三件事</text>
        </view>
        <view class="stat">
          <text class="stat__n">{{ n.habit }}</text>
          <text class="stat__cap">习惯打卡</text>
        </view>
        <view class="stat">
          <text class="stat__n">{{ n.box }}</text>
          <text class="stat__cap">盲盒动作</text>
        </view>
      </view>
    </view>

    <!-- 时间轴 -->
    <view v-if="!groups.length" class="empty">
      <view class="empty__seal">痕</view>
      <text class="empty__title">还没有痕迹</text>
      <text class="empty__desc">去行厅完成一件三件事，或打一次卡 —— 从第一笔开始。\n观止知行只记录真实发生过的事。</text>
    </view>

    <view v-else class="axis">
      <view v-for="(g, gi) in groups" :key="g.key" class="group">
        <view class="group__head">
          <text class="group__label">{{ g.label }}</text>
          <text class="group__count">{{ g.items.length }} 条</text>
        </view>
        <view v-if="gi < groups.length - 1" class="group__line" />
        <view class="group__list">
          <view v-for="(t, ti) in g.items" :key="`${g.key}-${ti}`" class="item">
            <view class="item__rail">
              <view class="item__dot" :class="`is-${t.type}`" />
            </view>
            <view class="item__body">
              <text class="item__text">{{ t.text }}</text>
              <view class="item__meta">
                <text class="item__type">{{ labelOf(t.type) }}</text>
                <text class="item__time">{{ t.time }}</text>
              </view>
            </view>
          </view>
        </view>
      </view>
    </view>

    <view class="foot">
      <text class="foot__text">痕迹不是奖杯 · 是活过的证据</text>
    </view>
  </view>
</template>

<script setup lang="ts">
/**
 * 痕迹时间轴（批次 C · 我）· 分包 subpkg-me。
 * 与行厅「行动周报」同源（trace store 的痕迹流），此处是「我」视角的全量时间轴：
 * 三件事完成 / 习惯打卡 / 盲盒动作按天成组，时间新在前。
 */
import { computed } from 'vue'
import { useTraceStore, TRACE_LABEL, type Trace, type TraceType } from '@/stores/trace'
import { useSkinClass } from '@/composables/useSkin'
import { ROUTES } from '@/router/routes'

const trace = useTraceStore()
const skinClass = useSkinClass()

function pad(n: number): string {
  return String(n).padStart(2, '0')
}

function friendlyLabel(key: string): string {
  const today = new Date()
  const tk = `${today.getFullYear()}-${pad(today.getMonth() + 1)}-${pad(today.getDate())}`
  if (key === tk) return '今天'
  const y = new Date(today)
  y.setDate(y.getDate() - 1)
  const yk = `${y.getFullYear()}-${pad(y.getMonth() + 1)}-${pad(y.getDate())}`
  if (key === yk) return '昨天'
  const [, m, d] = key.split('-').map(Number)
  return `${today.getFullYear()} 年 ${m} 月 ${d} 日`
}

interface Item {
  type: TraceType
  text: string
  time: string
}

interface DayGroup {
  key: string
  label: string
  items: Item[]
}

const groups = computed<DayGroup[]>(() => {
  const map = new Map<string, Item[]>()
  trace.traces.forEach((t: Trace) => {
    const list = map.get(t.day) ?? []
    const d = new Date(t.at)
    list.push({ type: t.type, text: t.text, time: `${pad(d.getHours())}:${pad(d.getMinutes())}` })
    map.set(t.day, list)
  })
  // traces 本就新在前；按出现的先后成组
  const seen = new Set<string>()
  const out: DayGroup[] = []
  trace.traces.forEach((t) => {
    if (seen.has(t.day)) return
    seen.add(t.day)
    out.push({ key: t.day, label: friendlyLabel(t.day), items: map.get(t.day) ?? [] })
  })
  return out
})

const total = computed(() => trace.traces.length)
const daysN = computed(() => groups.value.length)
const n = computed(() => {
  const acc = { todo: 0, habit: 0, box: 0 }
  trace.traces.forEach((t) => {
    if (t.type === 'box') acc.box += 1
    else if (t.type === 'habit') acc.habit += 1
    else acc.todo += 1
  })
  return acc
})

function labelOf(type: TraceType): string {
  return TRACE_LABEL[type]
}

function goBack(): void {
  const pages = getCurrentPages()
  if (pages.length > 1) {
    uni.navigateBack()
  } else {
    uni.switchTab({ url: ROUTES.tabMe })
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

/* 汇总 */
.head {
  margin-top: 16rpx;
  padding: 28rpx;
  background: $gz-surface;
  border: 1rpx solid $gz-line;
  border-radius: $gz-radius-lg;
}

.head__range {
  font-size: $gz-fs-caption;
  letter-spacing: 0.08em;
  color: $gz-accent;
}

.stats {
  display: flex;
  margin-top: 24rpx;
}

.stat {
  flex: 1;
  text-align: center;
}

.stat__n {
  display: block;
  font-size: 48rpx;
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

/* 时间轴 */
.axis {
  margin-top: 30rpx;
}

.group {
  display: flex;
  flex-direction: column;
}

.group__head {
  display: flex;
  align-items: baseline;
  gap: 14rpx;
  padding-bottom: 14rpx;
}

.group__label {
  font-size: 30rpx;
  font-weight: 700;
  color: $gz-ink;
}

.group__count {
  font-size: $gz-fs-caption;
  color: $gz-ink-3;
}

.group__line {
  margin-left: 9rpx;
  width: 2rpx;
  height: 26rpx;
  background: $gz-line;
}

.group__list {
  display: flex;
  flex-direction: column;
}

.item {
  display: flex;
  padding: 14rpx 0;
}

.item__rail {
  flex: none;
  width: 20rpx;
  display: flex;
  justify-content: center;
}

.item__dot {
  width: 16rpx;
  height: 16rpx;
  margin-top: 10rpx;
  border-radius: 50%;
  border: 4rpx solid transparent;
  background-clip: padding-box;
}

.item__dot.is-todo {
  background: #84a268;
}

.item__dot.is-habit {
  background: #4e8fd4;
}

.item__dot.is-box {
  background: #9c8ac4;
}

.item__body {
  flex: 1;
  min-width: 0;
  margin-left: 18rpx;
  padding: 16rpx 22rpx;
  background: $gz-surface;
  border: 1rpx solid $gz-line;
  border-radius: $gz-radius-md;
}

.item__text {
  display: block;
  font-size: $gz-fs-body;
  line-height: 1.6;
  color: $gz-ink-2;
  word-break: break-all;
}

.item__meta {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  margin-top: 8rpx;
}

.item__type {
  font-size: $gz-fs-caption;
  color: $gz-ink-3;
}

.item__time {
  font-size: 18rpx;
  color: $gz-ink-3;
}

/* 空态 */
.empty {
  margin-top: 40rpx;
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 70rpx 30rpx;
  background: $gz-surface;
  border: 1rpx dashed $gz-line;
  border-radius: $gz-radius-md;
}

.empty__seal {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 96rpx;
  height: 96rpx;
  border: 2rpx solid $gz-accent;
  border-radius: 22rpx;
  background: $gz-accent-soft;
  color: $gz-accent;
  font-size: 42rpx;
  font-weight: 700;
}

.empty__title {
  margin-top: 24rpx;
  font-size: $gz-fs-body;
  font-weight: 600;
  color: $gz-ink-2;
}

.empty__desc {
  margin-top: 12rpx;
  font-size: $gz-fs-caption;
  line-height: 1.9;
  text-align: center;
  color: $gz-ink-3;
  white-space: pre-line;
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

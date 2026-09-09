<template>
  <view class="page" :class="skinClass">
    <!-- 顶栏：返回 + 标题（子页统一样式） -->
    <view class="nav">
      <view class="nav__side" hover-class="gz-hover" @click="goBack">
        <text class="nav__back">‹</text>
      </view>
      <text class="nav__title">定时入定</text>
      <view class="nav__side" />
    </view>

    <!-- 下一段入定 -->
    <view class="next" :class="{ 'is-now': isActiveNow }">
      <text class="next__label">{{ isActiveNow ? '现在正是入定时段' : '下一段入定' }}</text>
      <text v-if="nextRem" class="next__time">{{ isActiveNow ? nextRemTime : nextStartText }}</text>
      <text v-else class="next__time">——</text>
      <text class="next__desc">
        {{ nextDesc }}
      </text>
    </view>

    <!-- 快捷模板（尚未设置时） -->
    <view v-if="!reminders.length" class="tpl">
      <text class="tpl__label">空时段？先用一个模板开始</text>
      <view class="tpl__row">
        <view
          v-for="t in REMINDER_TEMPLATES"
          :key="t.label"
          class="tpl__chip"
          hover-class="gz-hover"
          @click="applyTemplate(t)"
        >
          {{ t.label }}
        </view>
      </view>
    </view>

    <!-- 时段列表 -->
    <view class="section">
      <view class="section__head">
        <text class="section__title">我的入定时段</text>
        <text class="section__hint">{{ reminders.filter((r) => r.enabled).length }} 段开启</text>
      </view>

      <view v-if="!reminders.length" class="void">
        <text class="void__title">还没设任何时段</text>
        <text class="void__desc">固定一个入定时段，让静修像三餐一样有节奏。</text>
      </view>
      <view v-else class="list">
        <view v-for="r in reminders" :key="r.id" class="row" :class="{ 'is-off': !r.enabled }">
          <view class="row__time">
            <text class="row__hour">{{ pad(r.hour) }}:{{ pad(r.minute) }}</text>
            <text class="row__dur">{{ r.minutes }} 分钟</text>
          </view>
          <view class="row__acts">
            <view
              class="row__sw"
              :class="{ 'is-on': r.enabled }"
              hover-class="gz-hover"
              @click="store.toggle(r.id)"
            >
              {{ r.enabled ? '开' : '关' }}
            </view>
            <view class="row__del" hover-class="gz-hover" @click="removeOne(r.id)">删</view>
          </view>
        </view>
      </view>
    </view>

    <!-- 添加 -->
    <view class="add">
      <view class="add__head">
        <text class="add__label">加一段</text>
        <text class="add__hint">打开 App 时到点会提醒 · 未打开不打扰</text>
      </view>
      <picker mode="time" :value="draftTime" @change="onTimePick">
        <view class="add__pick">
          <text class="add__time">{{ draftTime }}</text>
          <text class="add__arrow">改时间</text>
        </view>
      </picker>
      <view class="add__durs">
        <view
          v-for="d in DURS"
          :key="d"
          class="dur"
          :class="{ 'is-on': draftMin === d }"
          @click="draftMin = d"
        >
          {{ d }}
        </view>
      </view>
      <button class="add__btn" hover-class="gz-hover" @click="doAdd">加入我的时段</button>
    </view>

    <view class="foot">
      <text class="foot__text">定时的不是闹钟 · 是每天和自己约好的一段</text>
    </view>
  </view>
</template>

<script setup lang="ts">
/**
 * 止 · 定时入定 —— 批次 B 收尾真实子页（分包 subpkg-pause）。
 * 预设每日固定专注时段（时间点 + 预计时长 + 开关）。
 * 小程序无法后台推送：打开 App 时若正处入定时段，会由「到点激励」浮层提醒（止大厅/沙漏页）。
 */
import { computed, onBeforeUnmount, ref } from 'vue'
import { onHide, onShow } from '@dcloudio/uni-app'
import { REMINDER_TEMPLATES, useReminderStore, type Reminder } from '@/stores/reminder'
import { useFocusStore } from '@/stores/focus'
import { useSkinClass } from '@/composables/useSkin'
import { navigateTo, ROUTES } from '@/router/routes'

const store = useReminderStore()
const focus = useFocusStore()
const skinClass = useSkinClass()

const reminders = computed(() => store.reminders)

const DURS = [5, 10, 15, 30, 45, 60] as const
const draftTime = ref('21:00')
const draftMin = ref<number>(15)

function pad(n: number): string {
  return String(n).padStart(2, '0')
}

function onTimePick(e: { detail: { value: string } }): void {
  draftTime.value = e.detail.value
}

function parseDraft(): { hour: number; minute: number } {
  const [h, m] = draftTime.value.split(':').map(Number)
  return { hour: h, minute: m }
}

function doAdd(): void {
  const { hour, minute } = parseDraft()
  store.add(hour, minute, draftMin.value)
  uni.showToast({ title: '已加入入定时段', icon: 'none' })
}

function applyTemplate(t: (typeof REMINDER_TEMPLATES)[number]): void {
  store.add(t.hour, t.minute, t.minutes)
  uni.showToast({ title: `已设 ${t.label}`, icon: 'none' })
}

function removeOne(id: number): void {
  store.remove(id)
}

/* —— 下一段入定计算（只算开启中的） —— */
const nowTick = ref(Date.now())
let ticker: ReturnType<typeof setInterval> | null = null

function hmToMin(h: number, m: number): number {
  return h * 60 + m
}

const enabled = computed(() => reminders.value.filter((r) => r.enabled))

const nowMinOfDay = computed(() => {
  const d = new Date(nowTick.value)
  return d.getHours() * 60 + d.getMinutes()
})

/** 进行中的时段（start ≤ now < start + minutes） */
const activeRem = computed<Reminder | null>(() => {
  const now = nowMinOfDay.value
  return (
    enabled.value.find((r) => {
      const s = hmToMin(r.hour, r.minute)
      return now >= s && now < s + r.minutes
    }) ?? null
  )
})

/** 下一个还没开始的时段 */
const nextRem = computed<Reminder | null>(() => {
  const now = nowMinOfDay.value
  const sorted = [...enabled.value].sort((a, b) => hmToMin(a.hour, a.minute) - hmToMin(b.hour, b.minute))
  return sorted.find((r) => hmToMin(r.hour, r.minute) > now) ?? null
})

const isActiveNow = computed(() => activeRem.value !== null)

const nextRemTime = computed(() => {
  const r = activeRem.value
  if (!r) return ''
  const end = hmToMin(r.hour, r.minute) + r.minutes
  const left = Math.max(0, end - nowMinOfDay.value)
  if (left <= 0) return '这一程将尽'
  const h = Math.floor(left / 60)
  const m = left % 60
  return h > 0 ? `还剩 ${h} 小时 ${m} 分` : `还剩 ${m} 分`
})

const nextStartText = computed(() => {
  const r = nextRem.value
  return r ? `${pad(r.hour)}:${pad(r.minute)}` : ''
})

const nextDesc = computed(() => {
  const todayMin = focus.minutesOn()
  if (isActiveNow.value) {
    return todayMin > 0 ? `今日已入账 ${todayMin} 分钟 · 稳住这一程` : `现在入定 ${activeRem.value?.minutes ?? 0} 分钟，正当时`
  }
  if (nextRem.value) {
    return `${nextRem.value?.minutes} 分钟 · 到点会提醒你去翻转沙漏`
  }
  return '今日时段都已过去 · 明天同一时刻再见'
})

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

onShow(() => {
  nowTick.value = Date.now()
  ticker = setInterval(() => (nowTick.value = Date.now()), 30_000)
})

onHide(() => {
  if (ticker) {
    clearInterval(ticker)
    ticker = null
  }
})

onBeforeUnmount(() => {
  if (ticker) {
    clearInterval(ticker)
    ticker = null
  }
})
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

/* 下一段入定 */
.next {
  margin-top: 16rpx;
  padding: 32rpx 30rpx;
  background: $gz-surface;
  border: 1rpx solid $gz-line;
  border-radius: $gz-radius-lg;
}

.next.is-now {
  border-color: $gz-accent;
  background: linear-gradient(180deg, $gz-accent-soft, $gz-surface 60%);
}

.next__label {
  display: block;
  font-size: $gz-fs-caption;
  letter-spacing: 0.12em;
  color: $gz-ink-3;
}

.next.is-now .next__label {
  color: $gz-accent;
}

.next__time {
  display: block;
  margin-top: 12rpx;
  font-size: 64rpx;
  font-weight: 800;
  line-height: 1.1;
  color: $gz-ink;
  font-variant-numeric: tabular-nums;
}

.next.is-now .next__time {
  color: $gz-accent;
}

.next__desc {
  display: block;
  margin-top: 14rpx;
  font-size: $gz-fs-caption;
  color: $gz-ink-3;
}

/* 模板 */
.tpl {
  margin-top: 22rpx;
  padding: 22rpx 26rpx;
  border: 1rpx dashed $gz-line;
  border-radius: $gz-radius-md;
}

.tpl__label {
  display: block;
  font-size: $gz-fs-caption;
  color: $gz-ink-3;
}

.tpl__row {
  display: flex;
  gap: 14rpx;
  margin-top: 16rpx;
}

.tpl__chip {
  flex: 1;
  text-align: center;
  padding: 16rpx 0;
  border-radius: $gz-radius-md;
  background: $gz-accent-soft;
  color: $gz-accent;
  font-size: $gz-fs-small;
}

/* 时段列表 */
.section {
  margin-top: 34rpx;
}

.section__head {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
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

.void {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 56rpx 30rpx;
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

.list {
  display: flex;
  flex-direction: column;
  gap: 16rpx;
}

.row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 24rpx 28rpx;
  background: $gz-surface;
  border: 1rpx solid $gz-line;
  border-radius: $gz-radius-md;
}

.row.is-off {
  opacity: 0.6;
}

.row__time {
  display: flex;
  flex-direction: column;
}

.row__hour {
  font-size: 40rpx;
  font-weight: 800;
  line-height: 1.2;
  color: $gz-ink;
  font-variant-numeric: tabular-nums;
}

.row__dur {
  margin-top: 6rpx;
  font-size: $gz-fs-caption;
  color: $gz-ink-3;
}

.row__acts {
  display: flex;
  gap: 14rpx;
}

.row__sw {
  padding: 8rpx 22rpx;
  border-radius: 999rpx;
  border: 1rpx solid $gz-line;
  color: $gz-ink-3;
  font-size: $gz-fs-caption;
}

.row__sw.is-on {
  background: $gz-accent-soft;
  border-color: $gz-accent;
  color: $gz-accent;
  font-weight: 600;
}

.row__del {
  padding: 8rpx 20rpx;
  border-radius: 999rpx;
  border: 1rpx solid $gz-line;
  color: $gz-ink-3;
  font-size: $gz-fs-caption;
}

/* 添加 */
.add {
  margin-top: 36rpx;
  padding: 26rpx 28rpx;
  background: $gz-surface;
  border: 1rpx solid $gz-line;
  border-radius: $gz-radius-lg;
}

.add__head {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
}

.add__label {
  font-size: 32rpx;
  font-weight: 700;
  color: $gz-ink;
}

.add__hint {
  font-size: $gz-fs-caption;
  color: $gz-ink-3;
}

.add__pick {
  margin-top: 22rpx;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 20rpx 26rpx;
  background: $gz-input-bg;
  border: 1rpx solid $gz-line;
  border-radius: $gz-radius-md;
}

.add__time {
  font-size: 44rpx;
  font-weight: 800;
  color: $gz-accent;
  font-variant-numeric: tabular-nums;
}

.add__arrow {
  font-size: $gz-fs-caption;
  color: $gz-ink-3;
}

.add__durs {
  display: flex;
  gap: 12rpx;
  margin-top: 18rpx;
}

.dur {
  flex: 1;
  text-align: center;
  padding: 14rpx 0;
  border-radius: $gz-radius-md;
  border: 1rpx solid $gz-line;
  font-size: $gz-fs-caption;
  color: $gz-ink-3;
}

.dur.is-on {
  border-color: $gz-accent;
  background: $gz-accent-soft;
  color: $gz-accent;
  font-weight: 600;
}

.add__btn {
  margin-top: 22rpx;
  background: $gz-accent;
  color: $gz-on-cta;
  font-size: $gz-fs-body;
  font-weight: 600;
}

.foot {
  margin-top: 40rpx;
  display: flex;
  justify-content: center;
}

.foot__text {
  font-size: $gz-fs-caption;
  letter-spacing: 0.06em;
  color: $gz-ink-3;
}
</style>

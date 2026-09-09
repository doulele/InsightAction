<template>
  <view class="page" :class="skinClass">
    <!-- 顶栏 -->
    <view class="nav">
      <view class="nav__side" hover-class="gz-hover" @click="goBack">
        <text class="nav__back">‹</text>
      </view>
      <text class="nav__title">活跃日历</text>
      <view class="nav__side" />
    </view>

    <!-- 月份切换 -->
    <view class="month">
      <view class="month__step" hover-class="gz-hover" @click="stepMonth(-1)">‹</view>
      <view class="month__mid" hover-class="gz-hover" @click="jumpToday">
        <text class="month__label">{{ viewYear }} 年 {{ viewMonth + 1 }} 月</text>
        <text class="month__hint">点此回到本月</text>
      </view>
      <view class="month__step" hover-class="gz-hover" @click="stepMonth(1)">›</view>
    </view>

    <!-- 月汇总 -->
    <view class="sum">
      <view class="sum__item">
        <text class="sum__n">{{ monthAgg.active }}</text>
        <text class="sum__cap">活跃天数</text>
      </view>
      <view class="sum__item">
        <text class="sum__n">{{ monthAgg.focusMin }}</text>
        <text class="sum__cap">静修分钟</text>
      </view>
      <view class="sum__item">
        <text class="sum__n">{{ monthAgg.marks }}</text>
        <text class="sum__cap">辨源次数</text>
      </view>
      <view class="sum__item">
        <text class="sum__n">{{ monthAgg.traces }}</text>
        <text class="sum__cap">痕迹条数</text>
      </view>
    </view>

    <!-- 日历格 -->
    <view class="cal">
      <view class="cal__week">
        <text v-for="w in WEEK" :key="w" class="cal__weekday">{{ w }}</text>
      </view>
      <view class="cal__grid">
        <view
          v-for="(cell, i) in cells"
          :key="i"
          class="cell"
          :class="{ 'is-void': cell.void, 'is-future': cell.future, 'is-sel': cell.selected, 'is-today': cell.isToday }"
          hover-class="cell--hover"
          @click="pick(cell)"
        >
          <view v-if="!cell.void" class="cell__dot" :class="`lv-${cell.level}`">
            <text class="cell__day" :class="{ 'is-in': cell.level > 0 }">{{ cell.day }}</text>
          </view>
        </view>
      </view>
      <view class="cal__legend">
        <view class="cal__legend-item">
          <view class="cal__swatch lv-0" />
          <text>无</text>
        </view>
        <view class="cal__legend-item">
          <view class="cal__swatch lv-1" />
          <text>少</text>
        </view>
        <view class="cal__legend-item">
          <view class="cal__swatch lv-3" />
          <text>中</text>
        </view>
        <view class="cal__legend-item">
          <view class="cal__swatch lv-5" />
          <text>多</text>
        </view>
        <text class="cal__hint">深浅 = 观止知行 6 个投入维度被点亮几个</text>
      </view>
    </view>

    <!-- 当日明细 -->
    <view class="section" v-if="selected">
      <view class="section__row">
        <text class="section__title">{{ selectedLabel }}</text>
        <text v-if="selected.isToday" class="section__tag">今天</text>
      </view>
      <view class="detail">
        <view class="detail__col">
          <view class="detail__box" :class="{ 'is-on': d.marks > 0 }">
            <text class="detail__label">观 · 辨源</text>
            <text class="detail__value">{{ d.marks }} 次</text>
          </view>
          <view class="detail__box" :class="{ 'is-on': d.focusMin > 0 }">
            <text class="detail__label">止 · 静修</text>
            <text class="detail__value">{{ d.focusMin }} 分</text>
          </view>
        </view>
        <view class="detail__col">
          <view class="detail__box" :class="{ 'is-on': d.cards > 0 || d.answered }">
            <text class="detail__label">知 · 产出</text>
            <text class="detail__value">{{ d.cards }} 卡{{ d.answered ? ' + 答卡' : '' }}</text>
          </view>
          <view class="detail__box" :class="{ 'is-on': d.traces > 0 || d.habitDone > 0 }">
            <text class="detail__label">行 · 痕迹</text>
            <text class="detail__value">{{ d.traces }} 迹 · {{ d.habitDone }} 习惯</text>
          </view>
        </view>
      </view>
      <text v-if="detailNote" class="detail__note">{{ detailNote }}</text>
    </view>

    <view class="foot">
      <text class="foot__text">把日子过成自己看得见的样子</text>
    </view>
  </view>
</template>

<script setup lang="ts">
/**
 * 活跃日历（批次 C · 我）· 分包 subpkg-me。
 * 按月回看观止知行的真实投入：观=辨源标注、止=静修分钟、知=知识卡/拷问、
 * 行=痕迹/习惯打卡；格子深浅 = 六个投入维度点亮几个，点任意一天看当日明细。
 * 数据来自各 store 的历史聚合（growth.ts 的 dayStats），纯本地。
 */
import { computed, ref } from 'vue'
import { dayStats, activeDimCount, fmtKey, type DayStats } from '@/utils/growth'
import { useSkinClass } from '@/composables/useSkin'
import { ROUTES } from '@/router/routes'

const skinClass = useSkinClass()
const WEEK = ['一', '二', '三', '四', '五', '六', '日']

const now = new Date()
const todayKey = fmtKey(now)
/** 视图锚点：所在月份的 1 号 */
const anchor = ref(new Date(now.getFullYear(), now.getMonth(), 1))
const viewYear = computed(() => anchor.value.getFullYear())
const viewMonth = computed(() => anchor.value.getMonth())

interface Cell {
  key: string
  day: number
  void: boolean
  future: boolean
  isToday: boolean
  selected: boolean
  level: number
  stats: DayStats | null
}

const selectedKey = ref(todayKey)

function dateKey(y: number, m: number, d: number): string {
  return `${y}-${`${m + 1}`.padStart(2, '0')}-${`${d}`.padStart(2, '0')}`
}

/** 生成 6 行 × 7 列的格子（周一开头），逐格取真实 stats */
const cells = computed<Cell[]>(() => {
  const y = viewYear.value
  const m = viewMonth.value
  const firstDow = (new Date(y, m, 1).getDay() + 6) % 7
  const daysInMonth = new Date(y, m + 1, 0).getDate()
  const out: Cell[] = []
  for (let i = 0; i < firstDow; i++) {
    out.push({ key: '', day: 0, void: true, future: false, isToday: false, selected: false, level: 0, stats: null })
  }
  for (let d = 1; d <= daysInMonth; d++) {
    const key = dateKey(y, m, d)
    const future = key > todayKey
    const isToday = key === todayKey
    const stats = future ? null : dayStats(key)
    out.push({
      key,
      day: d,
      void: false,
      future,
      isToday,
      selected: key === selectedKey.value,
      level: stats ? activeDimCount(stats) : 0,
      stats,
    })
  }
  while (out.length < 42) {
    out.push({ key: '', day: 0, void: true, future: false, isToday: false, selected: false, level: 0, stats: null })
  }
  return out
})

/* 月汇总（只统计到今天为止，未来不计） */
const monthAgg = computed(() => {
  const agg = { active: 0, focusMin: 0, marks: 0, traces: 0 }
  cells.value.forEach((c) => {
    if (!c.stats) return
    if (c.level > 0) agg.active += 1
    agg.focusMin += c.stats.focusMin
    agg.marks += c.stats.marks
    agg.traces += c.stats.traces
  })
  return agg
})

/* 选中当天（未来日期不可作为详情选中） */
const selected = computed<Cell | null>(() => {
  const y = viewYear.value
  const m = viewMonth.value
  const mm = `${m + 1}`.padStart(2, '0')
  const k = selectedKey.value
  if (k.startsWith(`${y}-${mm}-`)) {
    return cells.value.find((c) => c.key === k && !c.void && !c.future) ?? null
  }
  return null
})

const d = computed<DayStats>(() => {
  const s = selected.value?.stats
  if (s) return s
  return { date: selectedKey.value, focusMin: 0, marks: 0, traces: 0, habitDone: 0, cards: 0, answered: false }
})

const selectedLabel = computed(() => {
  const k = selected.value?.key ?? selectedKey.value
  const [, m, day] = k.split('-').map(Number)
  if (k === todayKey) return '今天'
  return `${m} 月 ${day} 日`
})

const detailNote = computed(() => {
  if (!selected.value) return ''
  if (selected.value.level === 0) return '这一天没有留下修行痕迹 —— 也可以是，那天你歇了歇。'
  const groups: string[] = []
  if (d.value.marks > 0) groups.push('观')
  if (d.value.focusMin > 0) groups.push('止')
  if (d.value.cards > 0 || d.value.answered) groups.push('知')
  if (d.value.traces > 0 || d.value.habitDone > 0) groups.push('行')
  return `点亮了 ${groups.length} 个维度：${groups.join(' · ')}`
})

function pick(cell: Cell): void {
  if (cell.void || cell.future) return
  selectedKey.value = cell.key
}

function stepMonth(delta: number): void {
  const a = new Date(anchor.value)
  a.setMonth(a.getMonth() + delta)
  anchor.value = a
  /* 切月后默认选中该月今天（若非未来）；否则 1 号 */
  const y = a.getFullYear()
  const m = a.getMonth()
  const mk = dateKey(y, m, 1)
  const max = new Date(y, m + 1, 0).getDate()
  const cur = Number(now.getDate())
  const pickDay = cur <= max ? dateKey(y, m, cur) : mk
  selectedKey.value = pickDay <= todayKey ? pickDay : mk
}

function jumpToday(): void {
  const y = now.getFullYear()
  const m = now.getMonth()
  anchor.value = new Date(y, m, 1)
  selectedKey.value = todayKey
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

/* 月份条 */
.month {
  margin-top: 16rpx;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 18rpx 22rpx;
  background: $gz-surface;
  border: 1rpx solid $gz-line;
  border-radius: $gz-radius-lg;
}

.month__step {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 64rpx;
  height: 64rpx;
  border: 1rpx solid $gz-line;
  border-radius: 50%;
  font-size: 40rpx;
  color: $gz-ink-2;
}

.month__mid {
  display: flex;
  flex-direction: column;
  align-items: center;
}

.month__label {
  font-size: 34rpx;
  font-weight: 700;
  color: $gz-ink;
}

.month__hint {
  margin-top: 4rpx;
  font-size: 18rpx;
  color: $gz-ink-3;
}

/* 月汇总 */
.sum {
  margin-top: 18rpx;
  display: flex;
  padding: 26rpx 10rpx;
  background: $gz-surface;
  border: 1rpx solid $gz-line;
  border-radius: $gz-radius-lg;
}

.sum__item {
  flex: 1;
  text-align: center;
}

.sum__n {
  display: block;
  font-size: 40rpx;
  font-weight: 800;
  color: $gz-accent;
  line-height: 1;
  font-variant-numeric: tabular-nums;
}

.sum__cap {
  display: block;
  margin-top: 10rpx;
  font-size: 18rpx;
  color: $gz-ink-3;
}

/* 日历 */
.cal {
  margin-top: 18rpx;
  padding: 24rpx 18rpx 18rpx;
  background: $gz-surface;
  border: 1rpx solid $gz-line;
  border-radius: $gz-radius-lg;
}

.cal__week {
  display: flex;
}

.cal__weekday {
  flex: 1;
  text-align: center;
  font-size: 20rpx;
  color: $gz-ink-3;
}

.cal__grid {
  margin-top: 12rpx;
  display: flex;
  flex-wrap: wrap;
}

.cell {
  width: calc(100% / 7);
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 4rpx 0;
}

.cell__dot {
  width: 68rpx;
  height: 68rpx;
  border-radius: 18rpx;
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--gz-line-soft);
  box-sizing: border-box;
}

/* 深浅档：六个投入维度点亮几个 */
.cell__dot.lv-1,
.cell__dot.lv-2 {
  background: $gz-accent-soft;
}

.cell__dot.lv-3,
.cell__dot.lv-4 {
  background: $gz-accent;
  opacity: 0.72;
}

.cell__dot.lv-5,
.cell__dot.lv-6 {
  background: $gz-accent;
}

.cell__day {
  font-size: 22rpx;
  color: $gz-ink-3;
}

.cell__day.is-in {
  color: $gz-surface;
  font-weight: 700;
}

.cell.is-today .cell__dot {
  border: 2rpx solid $gz-accent;
  box-shadow: 0 0 0 2rpx $gz-surface inset;
}

.cell.is-sel .cell__dot {
  border: 2rpx solid $gz-accent;
}

.cell.is-future {
  opacity: 0.35;
}

.cell--hover {
  opacity: 0.8;
}

.cal__legend {
  margin-top: 18rpx;
  display: flex;
  align-items: center;
  gap: 16rpx;
}

.cal__legend-item {
  display: flex;
  align-items: center;
  gap: 6rpx;
  font-size: 18rpx;
  color: $gz-ink-3;
}

.cal__swatch {
  width: 20rpx;
  height: 20rpx;
  border-radius: 6rpx;
  background: var(--gz-line-soft);
}

.cal__swatch.lv-1 {
  background: $gz-accent-soft;
}

.cal__swatch.lv-3 {
  background: $gz-accent;
  opacity: 0.72;
}

.cal__swatch.lv-5 {
  background: $gz-accent;
}

.cal__hint {
  margin-left: auto;
  font-size: 16rpx;
  color: $gz-ink-3;
}

/* 当日明细 */
.section {
  margin-top: 34rpx;
}

.section__row {
  display: flex;
  align-items: center;
  gap: 14rpx;
}

.section__title {
  font-size: 32rpx;
  font-weight: 700;
  color: $gz-ink;
}

.section__tag {
  padding: 2rpx 14rpx;
  border-radius: 999rpx;
  background: $gz-accent-soft;
  color: $gz-accent;
  font-size: $gz-fs-caption;
}

.detail {
  margin-top: 16rpx;
  display: flex;
  gap: 14rpx;
}

.detail__col {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 14rpx;
}

.detail__box {
  padding: 22rpx 24rpx;
  background: $gz-surface;
  border: 1rpx solid $gz-line;
  border-radius: $gz-radius-md;
}

.detail__box.is-on {
  border-color: $gz-accent;
  background: $gz-accent-soft;
}

.detail__label {
  display: block;
  font-size: $gz-fs-caption;
  color: $gz-ink-3;
}

.detail__value {
  display: block;
  margin-top: 8rpx;
  font-size: 30rpx;
  font-weight: 700;
  color: $gz-ink;
}

.detail__note {
  display: block;
  margin-top: 16rpx;
  font-size: $gz-fs-caption;
  line-height: 1.7;
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

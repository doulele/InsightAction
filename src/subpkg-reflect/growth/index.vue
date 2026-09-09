<template>
  <view class="page" :class="skinClass">
    <!-- 顶栏：返回 + 标题（子页统一样式） -->
    <view class="nav">
      <view class="nav__side" hover-class="gz-hover" @click="goBack">
        <text class="nav__back">‹</text>
      </view>
      <text class="nav__title">认知成长曲线</text>
      <view class="nav__side" />
    </view>

    <!-- 总览 -->
    <view class="overview">
      <view class="stat">
        <text class="stat__n">{{ total }}</text>
        <text class="stat__cap">累计沉淀</text>
      </view>
      <view class="stat">
        <text class="stat__n">{{ avgDepth.toFixed(1) }}</text>
        <text class="stat__cap">平均深度</text>
      </view>
      <view class="stat">
        <text class="stat__n">{{ lv3Pct }}%</text>
        <text class="stat__cap">内化占比</text>
      </view>
    </view>
    <text class="overview__note">
      深度：Lv.1 转述 → Lv.2 重构 → Lv.3 内化。曲线向上，说明你不再只是「看过」。
    </text>

    <!-- 近 8 周趋势 -->
    <view class="section">
      <view class="section__head">
        <text class="section__title">近 8 周沉淀</text>
        <view class="legend">
          <view class="legend__item"><view class="legend__dot is-1" /> Lv.1</view>
          <view class="legend__item"><view class="legend__dot is-2" /> Lv.2</view>
          <view class="legend__item"><view class="legend__dot is-3" /> Lv.3</view>
        </view>
      </view>

      <view v-if="!weeks.length" class="empty">
        <view class="empty__seal">线</view>
        <text class="empty__title">还没有数据</text>
        <text class="empty__desc">先答几次灵魂拷问、存几张卡片。\n每周沉淀会在这里长成一条向上的曲线。</text>
      </view>
      <view v-else class="chart">
        <view v-for="(w, wi) in weeks" :key="w.label" class="row">
          <view class="row__label">
            <text class="row__name" :class="{ 'is-cur': wi === 0 }">{{ w.label }}</text>
            <text class="row__date">{{ w.range }}</text>
          </view>
          <view class="row__chart">
            <view class="row__bar">
              <view
                v-if="w.c1 > 0"
                class="row__seg is-1"
                :style="{ width: segWidth(w.c1, w.total) }"
              />
              <view
                v-if="w.c2 > 0"
                class="row__seg is-2"
                :style="{ width: segWidth(w.c2, w.total) }"
              />
              <view
                v-if="w.c3 > 0"
                class="row__seg is-3"
                :style="{ width: segWidth(w.c3, w.total) }"
              />
            </view>
            <text class="row__total">{{ w.total }}</text>
          </view>
        </view>
      </view>
      <text v-if="weeks.length" class="chart__note">
        每格为该周沉淀卡片数（含拷问作答）；色块按深度分层。当前周尚未走完。
      </text>
    </view>

    <view class="foot">
      <text class="foot__text">看见曲线，才知道自己在生长</text>
    </view>
  </view>
</template>

<script setup lang="ts">
/**
 * 认知成长曲线（批次 C）· 分包 subpkg-reflect。
 * 以自然周（周一始）聚合近 8 周的知识沉淀：卡片数按深度分层 + 每周拷问作答并入 Lv.3；
 * 总览卡给出累计数 / 平均深度 / Lv.3 占比。
 */
import { computed } from 'vue'
import { useKnowledgeStore } from '@/stores/knowledge'
import { useQuestionStore } from '@/stores/question'
import { useSkinClass } from '@/composables/useSkin'
import { ROUTES } from '@/router/routes'

const knowledge = useKnowledgeStore()
const question = useQuestionStore()
const skinClass = useSkinClass()

function pad(n: number): string {
  return String(n).padStart(2, '0')
}

function dayKey(d: Date): string {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

/** 周一 0 点 */
function mondayOf(d: Date): Date {
  const t = new Date(d)
  const dow = (t.getDay() + 6) % 7
  t.setDate(t.getDate() - dow)
  t.setHours(0, 0, 0, 0)
  return t
}

interface WeekRow {
  label: string
  range: string
  c1: number
  c2: number
  c3: number
  total: number
}

const weeks = computed<WeekRow[]>(() => {
  const now = new Date()
  const curMon = mondayOf(now)
  const out: WeekRow[] = []
  for (let i = 0; i < 8; i++) {
    const start = new Date(curMon.getTime() - i * 7 * 24 * 60 * 60 * 1000)
    const end = new Date(start.getTime() + 7 * 24 * 60 * 60 * 1000)
    const startKey = dayKey(start)
    const endKey = dayKey(end) // 开区间用
    const inRange = (createdAt: number) => {
      const k = dayKey(new Date(createdAt))
      return k >= startKey && k < endKey
    }
    const arr = knowledge.cards.filter((c) => inRange(c.createdAt))
    let c1 = arr.filter((c) => c.depth === 1).length
    let c2 = arr.filter((c) => c.depth === 2).length
    let c3 = arr.filter((c) => c.depth === 3).length
    // 拷问作答也算一次沉淀，并入 Lv.3（遍历题期记录里本自然周已回答的）
    Object.entries(question.records).forEach(([key, rec]) => {
      if (rec.answer && key >= startKey && key < endKey) c3 += 1
    })
    const endDate = new Date(end.getTime() - 86400000)
    const row: WeekRow = {
      label: i === 0 ? '本周' : i === 1 ? '上周' : `${i} 周前`,
      range: `${start.getMonth() + 1}.${start.getDate()} - ${endDate.getMonth() + 1}.${endDate.getDate()}`,
      c1,
      c2,
      c3,
      total: c1 + c2 + c3,
    }
    out.push(row)
  }
  return out
})

/** 总览：累计沉淀 / 平均深度 / Lv.3 占比 */
const total = computed(() => knowledge.cards.length + countAnsweredAll())
const avgDepth = computed(() => {
  const sum =
    knowledge.cards.reduce((s, c) => s + c.depth, 0) + countAnsweredAll() * 3
  const n = knowledge.cards.length + countAnsweredAll()
  return n > 0 ? sum / n : 0
})
const lv3Pct = computed(() => {
  const n = knowledge.cards.length + countAnsweredAll()
  if (n === 0) return 0
  const lv3 =
    knowledge.cards.filter((c) => c.depth === 3).length + countAnsweredAll()
  return Math.round((lv3 / n) * 100)
})

function countAnsweredAll(): number {
  return Object.values(question.records).filter((r) => r.answer).length
}

/** 柱内色块宽度（%） */
function segWidth(part: number, all: number): string {
  if (!(all > 0)) return '0%'
  return `${Math.max(6, Math.round((part / all) * 100))}%`
}

function goBack(): void {
  const pages = getCurrentPages()
  if (pages.length > 1) {
    uni.navigateBack()
  } else {
    uni.switchTab({ url: ROUTES.tabReflect })
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

/* 总览 */
.overview {
  margin-top: 16rpx;
  display: flex;
  gap: 14rpx;
}

.stat {
  flex: 1;
  padding: 26rpx 10rpx 22rpx;
  background: $gz-surface;
  border: 1rpx solid $gz-line;
  border-radius: $gz-radius-md;
  display: flex;
  flex-direction: column;
  align-items: center;
}

.stat__n {
  font-size: 48rpx;
  font-weight: 800;
  color: $gz-accent;
  line-height: 1.1;
}

.stat__cap {
  margin-top: 10rpx;
  font-size: $gz-fs-caption;
  color: $gz-ink-3;
}

.overview__note {
  display: block;
  margin-top: 16rpx;
  font-size: $gz-fs-caption;
  line-height: 1.7;
  color: $gz-ink-3;
}

.section {
  margin-top: 34rpx;
}

.section__head {
  display: flex;
  align-items: flex-end;
  justify-content: space-between;
  margin-bottom: 20rpx;
}

.section__title {
  font-size: 32rpx;
  font-weight: 700;
  color: $gz-ink;
}

.legend {
  display: flex;
  gap: 14rpx;
}

.legend__item {
  display: flex;
  align-items: center;
  gap: 6rpx;
  font-size: 18rpx;
  color: $gz-ink-3;
}

.legend__dot {
  width: 16rpx;
  height: 16rpx;
  border-radius: 4rpx;
}

.legend__dot.is-1 {
  background: #84a268;
}

.legend__dot.is-2 {
  background: #4e8fd4;
}

.legend__dot.is-3 {
  background: #9c8ac4;
}

/* 空态 */
.empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 80rpx 30rpx 0;
}

.empty__seal {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 100rpx;
  height: 100rpx;
  border: 2rpx solid $gz-accent;
  border-radius: 24rpx;
  background: $gz-accent-soft;
  color: $gz-accent;
  font-size: 44rpx;
  font-weight: 700;
}

.empty__title {
  margin-top: 26rpx;
  font-size: $gz-fs-title;
  font-weight: 700;
  color: $gz-ink;
}

.empty__desc {
  margin-top: 14rpx;
  font-size: $gz-fs-small;
  line-height: 1.9;
  text-align: center;
  color: $gz-ink-3;
  white-space: pre-line;
}

/* 图 */
.chart {
  display: flex;
  flex-direction: column;
  gap: 16rpx;
  background: $gz-surface;
  border: 1rpx solid $gz-line;
  border-radius: $gz-radius-md;
  padding: 26rpx 24rpx;
}

.row {
  display: flex;
  align-items: center;
  gap: 18rpx;
}

.row__label {
  flex: none;
  width: 96rpx;
}

.row__name {
  display: block;
  font-size: $gz-fs-caption;
  font-weight: 600;
  color: $gz-ink-2;
}

.row__name.is-cur {
  color: $gz-accent;
}

.row__date {
  display: block;
  margin-top: 4rpx;
  font-size: 18rpx;
  color: $gz-ink-3;
}

.row__chart {
  flex: 1;
  display: flex;
  align-items: center;
  gap: 14rpx;
}

.row__bar {
  flex: 1;
  height: 30rpx;
  border-radius: 8rpx;
  background: var(--gz-line-soft);
  overflow: hidden;
  display: flex;
}

.row__seg {
  height: 100%;
}

.row__seg.is-1 {
  background: #84a268;
}

.row__seg.is-2 {
  background: #4e8fd4;
}

.row__seg.is-3 {
  background: #9c8ac4;
}

.row__total {
  flex: none;
  min-width: 34rpx;
  text-align: right;
  font-size: $gz-fs-caption;
  font-weight: 700;
  color: $gz-ink-2;
}

.chart__note {
  display: block;
  margin-top: 20rpx;
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

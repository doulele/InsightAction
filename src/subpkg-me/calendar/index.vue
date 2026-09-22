<template>
  <view class="page" :class="skinClass">
    <!-- 顶栏 -->
        <SubNav :fallback="ROUTES.tabMe">活跃日历</SubNav>

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
        <text class="sum__n">{{ monthAgg.obsN }}</text>
        <text class="sum__cap">观 · 条数</text>
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
          <view v-if="!cell.void" class="cell__dot" :class="[`lv-${cell.level}`, { 'is-rest': cell.sabbath }]">
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
        <!-- 安息日（2026-09-17）：那天是"休"，不是"漏" —— 必须说一句，否则空白会被读成缺口 -->
        <text v-if="monthAgg.rest" class="cal__rest">
          虚框是安息日 · 本月 {{ monthAgg.rest }} 天 —— 那天不计分也不提醒，不算缺口
        </text>
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
          <view class="detail__box" :class="{ 'is-on': d.obsN > 0 }">
            <text class="detail__label">{{ dl('observe') }}</text>
            <text class="detail__value">{{ d.obsN }} 条</text>
          </view>
          <view class="detail__box" :class="{ 'is-on': d.focusMin > 0 }">
            <text class="detail__label">{{ dl('pause') }}</text>
            <text class="detail__value">{{ d.focusMin }} 分</text>
          </view>
        </view>
        <view class="detail__col">
          <view class="detail__box" :class="{ 'is-on': d.cards > 0 || d.answered }">
            <text class="detail__label">{{ dl('reflect') }}</text>
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
import { dayStats, activeDimCount, type DayStats } from '@/utils/growth'
import { dateKeyOf } from '@/utils/dateKey'
import { isSabbathDay } from '@/utils/sabbath'
import { useSkinClass } from '@/composables/useSkin'
import { ROUTES } from '@/router/routes'
import { useDimLabel } from '@/composables/usePhrase'

const skinClass = useSkinClass()
/** 四维标签（只换前三个：行那一格展示的是「痕迹/习惯」指标名，不是维度名） */
const dl = useDimLabel()
const WEEK = ['一', '二', '三', '四', '五', '六', '日']

const now = new Date()
const todayK = dateKeyOf(now)
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
  /** 安息日（2026-09-17）：画虚框并在地图说明里单独交代，避免"空白 = 缺口" */
  sabbath: boolean
}

const selectedKey = ref(todayK)

/** 页内小工具：由年/月/日直接得到日键（本月格子在生成时手里只有这三个数） */
function dateKey(y: number, m: number, d: number): string {
  return dateKeyOf(new Date(y, m, d))
}

/** 生成 6 行 × 7 列的格子（周一开头），逐格取真实 stats */
const cells = computed<Cell[]>(() => {
  const y = viewYear.value
  const m = viewMonth.value
  const firstDow = (new Date(y, m, 1).getDay() + 6) % 7
  const daysInMonth = new Date(y, m + 1, 0).getDate()
  const out: Cell[] = []
  const blank: Cell = {
    key: '',
    day: 0,
    void: true,
    future: false,
    isToday: false,
    selected: false,
    level: 0,
    stats: null,
    sabbath: false,
  }
  for (let i = 0; i < firstDow; i++) out.push({ ...blank })
  for (let d = 1; d <= daysInMonth; d++) {
    const key = dateKey(y, m, d)
    const future = key > todayK
    const isToday = key === todayK
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
      /* 未来的日子不标（安息日是按星期算的，将来的也会命中，但没必要提前显示） */
      sabbath: !future && isSabbathDay(key),
    })
  }
  while (out.length < 42) out.push({ ...blank })
  return out
})

/* 月汇总（只统计到今天为止，未来不计） */
const monthAgg = computed(() => {
  const agg = { active: 0, focusMin: 0, obsN: 0, traces: 0, rest: 0 }
  cells.value.forEach((c) => {
    if (c.future) return
    if (c.sabbath) agg.rest += 1
    if (!c.stats) return
    if (c.level > 0) agg.active += 1
    agg.focusMin += c.stats.focusMin
    agg.obsN += c.stats.obsN
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
  return { date: selectedKey.value, focusMin: 0, obsN: 0, traces: 0, habitDone: 0, cards: 0, answered: false }
})

const selectedLabel = computed(() => {
  const k = selected.value?.key ?? selectedKey.value
  const [, m, day] = k.split('-').map(Number)
  if (k === todayK) return '今天'
  return `${m} 月 ${day} 日`
})

const detailNote = computed(() => {
  if (!selected.value) return ''
  /* 安息日单独说 —— 与周报同一口径（"休"不是缺口），两处说法不能打架 */
  if (selected.value.sabbath && selected.value.level === 0) {
    return '这天是安息日 —— 不计分、不提醒，什么都没记也完全不算缺口。'
  }
  if (selected.value.level === 0) return '这一天没有留下修行痕迹 —— 也可以是，那天你歇了歇。'
  const groups: string[] = []
  if (d.value.obsN > 0) groups.push('观')
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
  selectedKey.value = pickDay <= todayK ? pickDay : mk
}

function jumpToday(): void {
  const y = now.getFullYear()
  const m = now.getMonth()
  anchor.value = new Date(y, m, 1)
  selectedKey.value = todayK
}

</script>

<style lang="scss" scoped>
@import './index.scss';
</style>

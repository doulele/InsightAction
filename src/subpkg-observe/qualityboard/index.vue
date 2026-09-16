<template>
  <view class="page" :class="skinClass">
    <!-- 顶栏：返回 + 标题（子页统一样式） -->
    <view class="nav">
      <view class="nav__side" hover-class="gz-hover" @click="goBack">
        <text class="nav__back">‹</text>
      </view>
      <text class="nav__title">信息源质量榜</text>
      <view class="nav__side" />
    </view>

    <!-- 规则说明 -->
    <view class="lead">
      <text class="lead__title">消息有来源，来源有口碑</text>
      <text class="lead__desc">
        在观大厅读过某条消息，顺手标「有用 / 没用」。\n标得多了，榜会把真正值得读的少数留下。
      </text>
    </view>

    <!-- 筛选 -->
    <view class="filters">
      <view
        v-for="f in FILTERS"
        :key="f.key"
        class="filter"
        :class="{ 'is-on': filter === f.key }"
        @click="filter = f.key"
      >
        {{ f.label }}
      </view>
    </view>

    <!-- 榜单 / 空态 -->
    <view v-if="!list.length" class="empty">
      <view class="empty__seal">榜</view>
      <text class="empty__title">这个筛选下空着</text>
      <text class="empty__desc">去观大厅读几条消息，顺手标一标，榜就慢慢长出来了。</text>
    </view>
    <view v-else class="list">
      <view v-for="s in list" :key="s.name" class="row" :class="{ 'is-off': !s.watched }">
        <view class="row__top">
          <text class="row__name">{{ s.name }}</text>
          <view class="row__watch" :class="{ 'is-on': s.watched }" hover-class="gz-hover" @click="toggleWatch(s)">
            {{ s.watched ? '追更中' : '已停更' }}
          </view>
        </view>

        <view class="row__body">
          <view v-if="s.total > 0" class="row__rate">
            <text class="row__rate-num">{{ s.rate }}%</text>
            <text class="row__rate-cap">有用率</text>
            <text class="row__advice" :class="{ 'is-bad': s.advice }">
              {{ s.advice ? '建议停更' : '值得继续' }}
            </text>
          </view>
          <text v-else class="row__rate-empty">还没有人给它标过 · 你来开第一标</text>
        </view>

        <view class="row__meta">
          <text class="row__count">
            <text class="row__count-n">+{{ s.useful }}</text> 有用 ·
            <text class="row__count-n is-no">-{{ s.useless }}</text> 没用
          </text>
          <view class="row__acts">
            <view class="act act--yes" hover-class="gz-hover" @click="vote(s, true)">标有用</view>
            <view class="act act--no" hover-class="gz-hover" @click="vote(s, false)">标没用</view>
          </view>
        </view>
      </view>
    </view>

    <view class="foot">
      <text class="foot__text">一次标注 · 一分清醒 · 榜随你手长出来</text>
    </view>
  </view>
</template>

<script setup lang="ts">
/**
 * 观 · 信息源质量榜 —— 批次 B 收尾真实子页（分包 subpkg-observe）。
 * 记录每个来源被标「有用 / 没用」的次数，算有用率；支持追更开关与停更建议。
 * 数据入口：观大厅简报标注 + 本页直接标注，均落在 quality store。
 */
import { computed, ref } from 'vue'
import { useQualityStore, type SourceStat } from '@/stores/quality'
import { useSkinClass } from '@/composables/useSkin'
import { ROUTES } from '@/router/routes'

const quality = useQualityStore()
const skinClass = useSkinClass()

const FILTERS = [
  { key: 'all', label: '全部' },
  { key: 'on', label: '追更中' },
  { key: 'off', label: '已停更' },
] as const
type FilterKey = (typeof FILTERS)[number]['key']
const filter = ref<FilterKey>('all')

interface Row extends SourceStat {
  total: number
  rate: number
  advice: boolean
}

const rows = computed<Row[]>(() =>
  quality.sources.map((s) => {
    const total = s.useful + s.useless
    const rate = total > 0 ? Math.round((s.useful / total) * 100) : 0
    return { ...s, total, rate, advice: total >= 3 && rate < 50 }
  }),
)

const list = computed<Row[]>(() => {
  const f = filter.value
  const filtered = rows.value.filter((s) => (f === 'all' ? true : f === 'on' ? s.watched : !s.watched))
  // 追更在前，标记多的在前，有用率高的在前
  return [...filtered].sort((a, b) => {
    if (a.watched !== b.watched) return a.watched ? -1 : 1
    if (a.total !== b.total) return b.total - a.total
    return b.rate - a.rate
  })
})

function vote(s: Row, useful: boolean): void {
  quality.mark(s.name, useful)
  uni.showToast({ title: useful ? '已记一笔有用' : '已记一笔没用', icon: 'none' })
}

function toggleWatch(s: Row): void {
  quality.setWatched(s.name, !s.watched)
}

function goBack(): void {
  const pages = getCurrentPages()
  if (pages.length > 1) {
    uni.navigateBack()
  } else {
    uni.switchTab({ url: ROUTES.tabObserve })
  }
}
</script>

<style lang="scss" scoped>
@import './index.scss';
</style>

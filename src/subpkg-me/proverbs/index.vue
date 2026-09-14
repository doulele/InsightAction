<template>
  <view class="page" :class="skinClass">
    <!-- 顶栏 -->
    <view class="nav">
      <view class="nav__side" hover-class="gz-hover" @click="goBack">
        <text class="nav__back">‹</text>
      </view>
      <text class="nav__title">我的箴言</text>
      <view class="nav__side" />
    </view>

    <!-- 概览 -->
    <view class="sum">
      <view class="sum__main">
        <text class="sum__num">{{ store.count }}</text>
        <text class="sum__unit">句</text>
      </view>
      <text class="sum__sub">
        {{
          store.count > 0
            ? `开屏 ${bySource.startup} · 小枢 ${bySource.buddy} · 日课 ${bySource.daily}`
            : '遇到想留住的句子，点亮「记住这句」就会收进这里'
        }}
      </text>
    </view>

    <!-- 搜索 + 来源筛选 -->
    <view v-if="store.count > 0" class="tools">
      <input
        v-model="kw"
        class="tools__input"
        placeholder="搜索你记住的句子 / 出处"
        placeholder-class="tools__ph"
        confirm-type="search"
      />
      <view class="chips">
        <view
          v-for="f in FILTERS"
          :key="f.key"
          class="chip"
          :class="{ 'is-on': filter === f.key }"
          hover-class="gz-hover"
          @click="filter = f.key"
        >
          {{ f.label }}
        </view>
      </view>
    </view>

    <!-- 列表 -->
    <view class="sec">
      <view v-if="store.count === 0" class="empty gz-motion">
        <text class="empty__title">还没有记住的句子</text>
        <text class="empty__text">开屏箴言、小枢说的话，都可以点亮 ♡ 记住。收进来只是开始，回看才算真的记住。</text>
      </view>
      <view v-else-if="view.length === 0" class="empty">
        <text class="empty__title">没有匹配的箴言</text>
        <text class="empty__text">换个词试试，或点「全部」看回所有收藏。</text>
      </view>

      <view v-for="item in view" :key="item.id" class="fav">
        <text class="fav__mark">「</text>
        <view class="fav__body">
          <text class="fav__text">{{ item.text }}</text>
          <text v-if="item.from" class="fav__from">—— {{ item.from }}</text>
          <view class="fav__meta">
            <text v-if="item.pinned" class="fav__pin">置顶</text>
            <text class="fav__src">{{ SOURCE_LABEL[item.source] }}</text>
            <text class="fav__time">{{ dayLabel(item.createdAt) }}</text>
          </view>
        </view>
        <view class="fav__acts">
          <view class="fav__btn" hover-class="gz-hover" @click="togglePin(item.id)">
            {{ item.pinned ? '取消置顶' : '置顶' }}
          </view>
          <view class="fav__btn" hover-class="gz-hover" @click="copyLine(item)">复制</view>
          <view class="fav__btn fav__btn--off" hover-class="gz-hover" @click="remove(item.id)">移除</view>
        </view>
      </view>
    </view>

    <view class="foot">
      <text class="foot__text">收藏不是终点 · 回看才是</text>
    </view>
  </view>
</template>

<script setup lang="ts">
/**
 * 我 · 我的箴言（分包 subpkg-me/proverbs）：收藏句子的统一落点。
 * 数据 = stores/proverb.ts（开屏箴言 / 小枢对话 / 日课三处来源都汇到这里），
 * 支持搜索、来源筛选、置顶、复制、移除；纯本地，随备份体系一起导出/恢复。
 */
import { computed, ref } from 'vue'
import { useProverbStore, SOURCE_LABEL, type ProverbItem, type ProverbSource } from '@/stores/proverb'
import { useSkinClass } from '@/composables/useSkin'
import { ROUTES } from '@/router/routes'

const store = useProverbStore()
const skinClass = useSkinClass()

const kw = ref('')
const filter = ref<ProverbSource | 'all'>('all')

const FILTERS: Array<{ key: ProverbSource | 'all'; label: string }> = [
  { key: 'all', label: '全部' },
  { key: 'startup', label: '开屏' },
  { key: 'buddy', label: '小枢' },
  { key: 'daily', label: '日课' },
]

const bySource = computed(() => store.countBySource)

/** 置顶优先 → 收藏时间倒序 → 关键词/来源过滤 */
const view = computed<ProverbItem[]>(() => {
  const q = kw.value.trim()
  return store.items
    .filter((it) => (filter.value === 'all' ? true : it.source === filter.value))
    .filter((it) => (q ? it.text.includes(q) || (it.from ?? '').includes(q) : true))
    .slice()
    .sort((a, b) => Number(b.pinned) - Number(a.pinned) || b.createdAt - a.createdAt)
})

const pad = (n: number): string => String(n).padStart(2, '0')

function dayLabel(at: number): string {
  const d = new Date(at)
  const now = new Date()
  const same = (x: Date, y: Date): boolean =>
    x.getFullYear() === y.getFullYear() && x.getMonth() === y.getMonth() && x.getDate() === y.getDate()
  if (same(d, now)) return `今天 ${pad(d.getHours())}:${pad(d.getMinutes())}`
  const yest = new Date(now)
  yest.setDate(now.getDate() - 1)
  if (same(d, yest)) return `昨天 ${pad(d.getHours())}:${pad(d.getMinutes())}`
  return `${d.getMonth() + 1} 月 ${d.getDate()} 日`
}

function copyLine(item: ProverbItem): void {
  const text = item.from ? `「${item.text}」 —— ${item.from}` : `「${item.text}」`
  uni.setClipboardData({
    data: text,
    success: () => uni.showToast({ title: '已复制', icon: 'none' }),
  })
}

function remove(id: number): void {
  uni.showModal({
    title: '移除这句箴言？',
    content: '移除后不可恢复（本机数据，不上传服务器）。',
    confirmText: '移除',
    confirmColor: '#C4602E',
    success: (res) => {
      if (!res.confirm) return
      store.remove(id)
      uni.showToast({ title: '已移除', icon: 'none' })
    },
  })
}

function togglePin(id: number): void {
  store.togglePin(id)
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
  padding: 24rpx $gz-page-pad 60rpx;
}

.nav {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 8rpx 0 20rpx;
}

.nav__side {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 72rpx;
  height: 72rpx;
}

.nav__back {
  font-size: 56rpx;
  color: $gz-ink-2;
  line-height: 1;
}

.nav__title {
  font-size: $gz-fs-title;
  font-weight: 700;
  color: $gz-ink;
}

/* ---- 概览 ---- */
.sum {
  padding: 30rpx 32rpx;
  background: var(--gz-surface);
  border: 1rpx solid var(--gz-line);
  border-radius: $gz-radius-lg;
  box-shadow: 0 10rpx 30rpx rgba(0, 0, 0, 0.05);
}

.sum__main {
  display: flex;
  align-items: baseline;
  gap: 8rpx;
}

.sum__num {
  font-size: 64rpx;
  font-weight: 800;
  color: var(--gz-accent);
  line-height: 1.1;
}

.sum__unit {
  font-size: $gz-fs-small;
  color: $gz-ink-3;
}

.sum__sub {
  display: block;
  margin-top: 10rpx;
  font-size: $gz-fs-small;
  line-height: 1.7;
  color: $gz-ink-3;
}

/* ---- 搜索 / 筛选 ---- */
.tools {
  margin-top: 22rpx;
}

.tools__input {
  width: 100%;
  height: 80rpx;
  padding: 0 26rpx;
  box-sizing: border-box;
  background: $gz-surface;
  border: 1rpx solid $gz-line;
  border-radius: $gz-radius-md;
  font-size: $gz-fs-body;
  color: $gz-ink;
}

.chips {
  display: flex;
  gap: 12rpx;
  margin-top: 16rpx;
}

.chip {
  padding: 10rpx 26rpx;
  border-radius: 999rpx;
  background: $gz-surface;
  border: 1rpx solid $gz-line;
  font-size: $gz-fs-caption;
  color: $gz-ink-2;
}

.chip.is-on {
  background: $gz-accent-soft;
  border-color: $gz-accent;
  color: $gz-accent;
  font-weight: 700;
}

.sec {
  margin-top: 24rpx;
}

/* ---- 箴言卡 ---- */
.fav {
  display: flex;
  align-items: flex-start;
  gap: 12rpx;
  padding: 24rpx 26rpx;
  margin-bottom: 16rpx;
  background: $gz-surface;
  border: 1rpx solid $gz-line;
  border-radius: $gz-radius-md;
}

.fav__mark {
  flex: none;
  color: $gz-accent;
  font-size: 44rpx;
  line-height: 1;
}

.fav__body {
  flex: 1;
  min-width: 0;
}

.fav__text {
  display: block;
  font-size: $gz-fs-body;
  line-height: 1.7;
  color: $gz-ink;
}

.fav__from {
  display: block;
  margin-top: 6rpx;
  font-size: $gz-fs-caption;
  color: $gz-ink-3;
}

.fav__meta {
  display: flex;
  align-items: center;
  gap: 14rpx;
  margin-top: 12rpx;
}

.fav__pin {
  padding: 2rpx 12rpx;
  border-radius: 999rpx;
  background: $gz-accent-soft;
  color: $gz-accent;
  font-size: $gz-fs-caption;
}

.fav__src,
.fav__time {
  font-size: $gz-fs-caption;
  color: $gz-ink-3;
}

.fav__acts {
  flex: none;
  display: flex;
  flex-direction: column;
  gap: 10rpx;
}

.fav__btn {
  padding: 6rpx 18rpx;
  border-radius: 999rpx;
  background: $gz-accent-soft;
  color: $gz-accent;
  font-size: $gz-fs-caption;
  text-align: center;
}

.fav__btn--off {
  background: transparent;
  border: 1rpx solid $gz-line;
  color: $gz-ink-3;
}

/* ---- 空态 ---- */
.empty {
  padding: 70rpx 40rpx;
  text-align: center;
  background: $gz-surface;
  border: 1rpx dashed $gz-line;
  border-radius: $gz-radius-lg;
}

.empty__title {
  display: block;
  font-size: $gz-fs-title;
  font-weight: 700;
  color: $gz-ink-2;
}

.empty__text {
  display: block;
  margin-top: 12rpx;
  font-size: $gz-fs-small;
  line-height: 1.8;
  color: $gz-ink-3;
}

.foot {
  padding: 40rpx 0 10rpx;
  text-align: center;
}

.foot__text {
  font-size: $gz-fs-caption;
  letter-spacing: 0.1em;
  color: $gz-ink-3;
}
</style>

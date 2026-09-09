<template>
  <view class="page" :class="skinClass">
    <!-- 顶栏：返回 + 标题（子页统一样式） -->
    <view class="nav">
      <view class="nav__side" hover-class="gz-hover" @click="goBack">
        <text class="nav__back">‹</text>
      </view>
      <text class="nav__title">稍后读 · 碎片回收</text>
      <view class="nav__side" />
    </view>

    <!-- 收纳条 -->
    <view class="add">
      <input
        v-model="draft"
        class="add__input"
        placeholder="把此刻想读的，先放在这…"
        placeholder-class="add__ph"
        :maxlength="80"
        confirm-type="done"
        @confirm="save"
      />
      <view
        class="add__btn"
        :class="{ 'is-off': !canSave }"
        hover-class="gz-hover"
        @click="save"
      >
        存下
      </view>
    </view>
    <view class="rule">
      <text class="rule__text">留 24 小时 · 读不完自会清走 · 不养收藏夹僵尸</text>
      <text v-if="store.items.length" class="rule__num">{{ store.items.length }} 条待读</text>
    </view>

    <!-- 列表 / 空态 -->
    <view v-if="!store.items.length" class="empty">
      <view class="empty__seal">存</view>
      <text class="empty__title">此刻空空如也</text>
      <text class="empty__desc">读到舍不得放下的，先存一句在这。\n24 小时内读掉，读不掉的会被时间带走。</text>
    </view>
    <view v-else class="list">
      <view v-for="it in store.items" :key="it.createdAt" class="card">
        <text class="card__text">{{ it.text }}</text>
        <view class="card__meta">
          <text class="card__time">{{ leftLabel(it) }}</text>
          <text class="card__drop" hover-class="gz-hover" @click="dropItem(it.createdAt)">弃</text>
        </view>
      </view>
    </view>

    <view class="foot">
      <text class="foot__text">不读完，不积压</text>
    </view>
  </view>
</template>

<script setup lang="ts">
/**
 * 观 · 稍后读 —— 批次 B 第一个真实功能子页（分包 subpkg-observe）。
 * 「临时收藏，24 小时未读自动清理」：本页提供 存 / 读 / 弃 与过期自动回收，
 * 让"收藏"保持在够得着的量级。纯本地，云同步后端期接入。
 */
import { computed, onBeforeUnmount, ref } from 'vue'
import { onHide, onShow } from '@dcloudio/uni-app'
import { useReadLaterStore, READ_LATER_HOLD_MS, type ReadLaterItem } from '@/stores/readLater'
import { useSkinClass } from '@/composables/useSkin'
import { ROUTES } from '@/router/routes'

const store = useReadLaterStore()
const skinClass = useSkinClass()

const draft = ref('')
/** 剩余时效文案依赖的「现在」：半分钟一跳，让数字缓慢走动 */
const nowTick = ref(Date.now())
const canSave = computed(() => draft.value.trim().length > 0)

let ticker: ReturnType<typeof setInterval> | null = null

function save(): void {
  const ok = store.add(draft.value)
  if (ok) {
    draft.value = ''
    nowTick.value = Date.now()
  }
}

function dropItem(createdAt: number): void {
  store.remove(createdAt)
  uni.showToast({ title: '已丢弃', icon: 'none' })
}

/** 剩余时效：不足 1 分钟 / X 小时后自清 */
function leftLabel(it: ReadLaterItem): string {
  const left = it.createdAt + READ_LATER_HOLD_MS - nowTick.value
  if (left <= 0) return '已过期 · 打开即清'
  const mins = Math.ceil(left / 60_000)
  if (mins < 60) return `${mins} 分钟后自清`
  const hours = Math.ceil(mins / 60)
  if (hours <= 24) return `${hours} 小时后自清`
  return '即将自清'
}

/** 返回：正常栈内 navigateBack；异常兜底回「观」大厅 */
function goBack(): void {
  const pages = getCurrentPages()
  if (pages.length > 1) {
    uni.navigateBack()
  } else {
    uni.switchTab({ url: ROUTES.tabObserve })
  }
}

onShow(() => {
  const cleared = store.prune()
  if (cleared > 0) {
    uni.showToast({ title: `已自动清走 ${cleared} 条过期收藏`, icon: 'none' })
  }
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

/* 顶栏（与设置页同款） */
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

/* 收纳条 */
.add {
  display: flex;
  gap: 16rpx;
  margin-top: 20rpx;
}

.add__input {
  flex: 1;
  min-width: 0;
  padding: 24rpx 26rpx;
  background: $gz-input-bg;
  border: 1rpx solid $gz-line;
  border-radius: $gz-radius-md;
  font-size: $gz-fs-body;
  color: $gz-ink;
}

.add__ph {
  color: $gz-ink-3;
}

.add__btn {
  display: flex;
  align-items: center;
  justify-content: center;
  flex: none;
  padding: 0 34rpx;
  border-radius: $gz-radius-md;
  background: $gz-accent;
  color: $gz-on-cta;
  font-size: $gz-fs-body;
  font-weight: 600;
  transition: opacity 0.2s ease;
}

.add__btn.is-off {
  opacity: 0.45;
}

.rule {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin: 18rpx 4rpx 26rpx;
}

.rule__text {
  font-size: $gz-fs-caption;
  color: $gz-ink-3;
}

.rule__num {
  font-size: $gz-fs-caption;
  color: $gz-accent;
}

/* 列表 */
.list {
  display: flex;
  flex-direction: column;
  gap: 18rpx;
}

.card {
  padding: 28rpx 28rpx 20rpx;
  background: $gz-surface;
  border: 1rpx solid $gz-line;
  border-radius: $gz-radius-md;
}

.card__text {
  display: block;
  font-size: $gz-fs-body;
  line-height: 1.7;
  color: $gz-ink;
  word-break: break-all;
}

.card__meta {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-top: 16rpx;
}

.card__time {
  font-size: $gz-fs-caption;
  color: $gz-ink-3;
}

.card__drop {
  padding: 6rpx 20rpx;
  border-radius: 999rpx;
  border: 1rpx solid $gz-line;
  color: $gz-ink-2;
  font-size: $gz-fs-caption;
}

/* 空态 */
.empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 120rpx 40rpx 0;
}

.empty__seal {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 108rpx;
  height: 108rpx;
  border: 2rpx solid $gz-accent;
  border-radius: 26rpx;
  background: $gz-accent-soft;
  color: $gz-accent;
  font-size: 48rpx;
  font-weight: 700;
}

.empty__title {
  margin-top: 28rpx;
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

.foot {
  margin-top: 48rpx;
  display: flex;
  justify-content: center;
}

.foot__text {
  font-size: $gz-fs-caption;
  letter-spacing: 0.1em;
  color: $gz-ink-3;
}
</style>

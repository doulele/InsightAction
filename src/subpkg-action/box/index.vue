<template>
  <view class="page" :class="skinClass">
    <!-- 顶栏：返回 + 标题 -->
    <view class="nav">
      <view class="nav__side" hover-class="gz-hover" @click="goBack">
        <text class="nav__back">‹</text>
      </view>
      <text class="nav__title">微行动盲盒</text>
      <view class="nav__side" />
    </view>

    <!-- 已抽中 -->
    <view v-if="current" class="stage">
      <view class="stage__seal">{{ done ? '成' : '盒' }}</view>
      <text class="stage__eyebrow">今日盲盒 · 第 {{ current.index + 1 }} 号行动</text>
      <text class="stage__idea">{{ ideaText }}</text>

      <view class="stage__hint">{{ stageHint }}</view>

      <button v-if="!done" class="cta" hover-class="gz-hover" @click="finish">我做完了</button>
      <view v-else class="stage__done-line">很好。身体的开关，已经被你拨开一次了。</view>

      <view class="stage__again" hover-class="gz-hover" @click="redraw">
        换一只（今天只算一次）
      </view>
      <view class="stage__rule">明天完成三件事后再来开 · 每天一只</view>
    </view>

    <!-- 未解锁 -->
    <view v-else-if="!daily.allDone" class="lock">
      <view class="lock__box">盲盒</view>
      <text class="lock__title">今天的盲盒还没解锁</text>
      <text class="lock__desc">
        先去「行 · 今日三件事」把今天要做的三件事全部勾完成。\n行动之后的奖励，才配叫奖励。
      </text>
      <button class="cta" hover-class="gz-hover" @click="goAction">去完成今日三件事</button>
    </view>

    <!-- 可开 -->
    <view v-else class="ready">
      <view class="ready__box" hover-class="gz-hover" @click="openOnce">
        <text class="ready__mark">?</text>
      </view>
      <text class="ready__title">三事已成。开一只？</text>
      <text class="ready__desc">它会给你一个 3 分钟就能完成的线下小行动。\n跟手机无关，跟身体有关。</text>
      <button class="cta" hover-class="gz-hover" @click="openOnce">打开盲盒</button>
    </view>

    <view class="foot">
      <text class="foot__text">不给大脑更多信息 · 给身体一个动作</text>
    </view>

    <!-- 换一只确认：主题随当前模式 -->
    <GzDialog
      :show="redrawOpen"
      title="换一只？"
      content="换了它，今天也只算一次。"
      confirm-text="换"
      cancel-text="留着"
      @cancel="redrawOpen = false"
      @confirm="doRedraw"
    />
  </view>
</template>

<script setup lang="ts">
/**
 * 微行动盲盒（批次 C）· 分包 subpkg-action：
 * 今日三件事全部完成后解锁，随机抽一个 3 分钟线下行动；
 * 当天只算一次（抽中后可选换一只，但不重复计）。开盒动作写入痕迹流。
 */
import { computed, ref } from 'vue'
import GzDialog from '@/components/GzDialog/GzDialog.vue'
import { onShow } from '@dcloudio/uni-app'
import { BOX_IDEAS, useBoxStore } from '@/stores/box'
import { useDailyStore } from '@/stores/daily'
import { useTraceStore } from '@/stores/trace'
import { useXpStore } from '@/stores/xp'
import { useSkinClass } from '@/composables/useSkin'
import { navigateTo, ROUTES } from '@/router/routes'

const box = useBoxStore()
const daily = useDailyStore()
const trace = useTraceStore()
const skinClass = useSkinClass()

onShow(() => {
  daily.ensureToday()
})

const current = computed(() => box.todayDrawn())
const done = computed(() => Boolean(current.value?.done))
const ideaText = computed(() => (current.value ? BOX_IDEAS[current.value.index] : ''))

const stageHint = computed(() => {
  if (done.value) return '这次动作已完成。明天同一时刻，再开一只。'
  return '花不了几分钟。先放下手机，把这件事做完再回来。'
})

function openOnce(): void {
  if (!daily.allDone) return
  box.draw(false)
  trace.push('box', '开启微行动盲盒')
}

const redrawOpen = ref(false)

function redraw(): void {
  if (!current.value) return
  redrawOpen.value = true
}

function doRedraw(): void {
  redrawOpen.value = false
  if (!current.value) return
  box.draw(true)
}

function finish(): void {
  box.markDone()
  trace.push('box', '完成今日微行动')
  useXpStore().gain(12)
  uni.showToast({ title: '完成。回来给身体鼓个掌', icon: 'none' })
}

function goAction(): void {
  navigateTo(ROUTES.tabAction)
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
  display: flex;
  flex-direction: column;
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

/* 已抽中 */
.stage {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  margin-top: 40rpx;
}

.stage__seal {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 140rpx;
  height: 140rpx;
  border-radius: 34rpx;
  background: $gz-accent-soft;
  border: 3rpx solid $gz-accent;
  color: $gz-accent;
  font-size: 64rpx;
  font-weight: 800;
}

.stage__eyebrow {
  margin-top: 30rpx;
  font-size: $gz-fs-caption;
  letter-spacing: 0.12em;
  color: $gz-ink-3;
}

.stage__idea {
  margin-top: 20rpx;
  max-width: 560rpx;
  font-size: 40rpx;
  font-weight: 700;
  line-height: 1.6;
  text-align: center;
  color: $gz-ink;
}

.stage__hint {
  margin-top: 18rpx;
  font-size: $gz-fs-caption;
  color: $gz-ink-3;
}

.cta {
  width: 100%;
  margin-top: 44rpx;
  background: $gz-cta-bg;
  color: $gz-on-cta;
  font-size: $gz-fs-body;
  font-weight: 600;
  letter-spacing: 0.12em;
}

.stage__done-line {
  margin-top: 44rpx;
  font-size: $gz-fs-small;
  color: $gz-accent;
}

.stage__again {
  margin-top: 30rpx;
  padding: 14rpx 40rpx;
  border: 1rpx solid $gz-line;
  border-radius: $gz-radius-md;
  font-size: $gz-fs-small;
  color: $gz-ink-3;
}

.stage__rule {
  margin-top: 26rpx;
  font-size: $gz-fs-caption;
  color: $gz-ink-3;
}

/* 锁定 */
.lock {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  margin-top: 60rpx;
}

.lock__box {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 170rpx;
  height: 170rpx;
  border-radius: 40rpx;
  background: var(--gz-line-soft);
  color: $gz-ink-3;
  font-size: 40rpx;
  letter-spacing: 0.1em;
}

.lock__title {
  margin-top: 34rpx;
  font-size: $gz-fs-title;
  font-weight: 700;
  color: $gz-ink;
}

.lock__desc {
  margin-top: 16rpx;
  max-width: 540rpx;
  font-size: $gz-fs-small;
  line-height: 1.9;
  text-align: center;
  color: $gz-ink-3;
  white-space: pre-line;
}

/* 可开 */
.ready {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  margin-top: 60rpx;
}

.ready__box {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 200rpx;
  height: 200rpx;
  border-radius: 46rpx;
  background: $gz-cta-bg;
  box-shadow: 0 18rpx 44rpx rgba(0, 0, 0, 0.14);
}

.ready__mark {
  color: $gz-on-cta;
  font-size: 96rpx;
  font-weight: 800;
}

.ready__title {
  margin-top: 40rpx;
  font-size: $gz-fs-title;
  font-weight: 700;
  color: $gz-ink;
}

.ready__desc {
  margin-top: 16rpx;
  max-width: 520rpx;
  font-size: $gz-fs-small;
  line-height: 1.9;
  text-align: center;
  color: $gz-ink-3;
  white-space: pre-line;
}

.foot {
  margin-top: 50rpx;
  display: flex;
  justify-content: center;
}

.foot__text {
  font-size: $gz-fs-caption;
  letter-spacing: 0.06em;
  color: $gz-ink-3;
}
</style>

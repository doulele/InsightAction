<template>
  <view class="page" :class="skinClass">
    <!-- 顶栏：返回 + 标题（子页统一样式） -->
    <view class="nav">
      <view class="nav__side" hover-class="gz-hover" @click="goBack">
        <text class="nav__back">‹</text>
      </view>
      <text class="nav__title">禅定沙漏</text>
      <view class="nav__side" />
    </view>

    <!-- 选时 -->
    <template v-if="phase === 'idle'">
      <view class="hero">
        <view class="seal">止</view>
        <text class="hero__title">翻转沙漏，与世无关</text>
        <text class="hero__desc">
          选一段时长，走完全程才算定力入账。\n中途退出需如实作答，这一程不作数。
        </text>
      </view>
      <view class="pills">
        <view
          v-for="d in DURATIONS"
          :key="d"
          class="pill"
          :class="{ 'is-on': d === chosen }"
          @click="chosen = d"
        >
          {{ d }} 分
        </view>
      </view>
      <button class="cta" hover-class="gz-hover" @click="start">
        开始一段静修
      </button>
    </template>

    <!-- 计时中 -->
    <template v-else-if="phase === 'running'">
      <view class="ring">
        <view class="ring__halo" />
        <view class="ring__core">
          <text class="ring__mark">止 · 沙漏中</text>
          <text class="ring__time">{{ remainText }}</text>
          <text class="ring__pct">{{ pctText }} 已过 · {{ chosen }} 分钟</text>
        </view>
      </view>
      <view class="bar">
        <view class="bar__fill" :style="{ width: `${pct * 100}%` }" />
      </view>
      <view class="tip">
        <text class="tip__line">沙漏以真实时间为准：息屏、切走，时间仍在流</text>
        <text class="tip__line">走完全程才会写入今日定力</text>
      </view>
      <button class="giveup" hover-class="gz-hover" @click="openGiveUp">
        提前结束这一程
      </button>
    </template>

    <!-- 完成 -->
    <template v-else>
      <view class="hero">
        <view class="seal seal--done">定</view>
        <text class="hero__title">这一程，守住了</text>
        <text class="hero__num">{{ chosen }}<text class="hero__unit"> 分钟已入账</text></text>
        <text class="hero__desc">今日累计 {{ todayMin }} 分钟 · 小目标 /60</text>
      </view>
      <button class="cta" hover-class="gz-hover" @click="leave">收功</button>
    </template>

    <!-- 中途退出作答 -->
    <view v-if="giveUpOpen" class="mask" @click="giveUpOpen = false">
      <view class="sheet" @click.stop>
        <text class="sheet__title">为什么提前结束？</text>
        <text class="sheet__sub">如实作答 · 这一程将不计入定力</text>
        <view class="sheet__opts">
          <view
            v-for="c in GIVE_UP_CAUSES"
            :key="c"
            class="sheet__opt"
            hover-class="gz-hover"
            @click="giveUp(c)"
          >
            {{ c }}
          </view>
        </view>
        <view class="sheet__cancel" hover-class="gz-hover" @click="giveUpOpen = false">
          再坚持一下
        </view>
      </view>
    </view>
  </view>
</template>

<script setup lang="ts">
/**
 * 止 · 禅定沙漏 —— 批次 B 真实功能子页（分包 subpkg-pause）。
 * 规则：
 *  - 选 5/15/30/60 分钟，走完全程才写入今日定力（focus store）；
 *  - 中途退出需选因作答、不入账（不养"刷定力"的念头）；
 *  - 计时以墙上时间为准：息屏/切走不暂停（如真实沙漏），
 *    小程序后台会挂起 setInterval，故用绝对时间戳 targetTs 对表，
 *    切走期间跑满了回到前台也照实结算。
 */
import { computed, ref } from 'vue'
import { onHide, onShow, onUnload, onBackPress } from '@dcloudio/uni-app'
import { useFocusStore } from '@/stores/focus'
import { useSkinClass } from '@/composables/useSkin'
import { ROUTES } from '@/router/routes'

const focus = useFocusStore()
const skinClass = useSkinClass()

const DURATIONS = [5, 15, 30, 60] as const
const GIVE_UP_CAUSES = ['心神不宁', '被外物打断', '身体不适', '另有安排'] as const

type Phase = 'idle' | 'running' | 'done'
const phase = ref<Phase>('idle')
const chosen = ref<number>(15)

/** 目标完成时刻（墙上时间），跑满才结算 */
const targetTs = ref(0)
const totalMs = ref(0)
const remainMs = ref(0)
const giveUpOpen = ref(false)

const todayMin = computed(() => focus.minutesOn())

const remainText = computed(() => {
  const s = Math.max(0, Math.ceil(remainMs.value / 1000))
  const m = Math.floor(s / 60)
  const r = s % 60
  return `${String(m).padStart(2, '0')}:${String(r).padStart(2, '0')}`
})

const pct = computed(() => (totalMs.value > 0 ? 1 - remainMs.value / totalMs.value : 0))
const pctText = computed(() => `${Math.floor(pct.value * 100)}%`)

let ticker: ReturnType<typeof setInterval> | null = null

function syncRemain(): void {
  remainMs.value = targetTs.value - Date.now()
}

/** 每 250ms 对表；跑满瞬间自动结算入账 */
function tick(): void {
  syncRemain()
  if (Date.now() >= targetTs.value) settle()
}

function clearTicker(): void {
  if (ticker) {
    clearInterval(ticker)
    ticker = null
  }
}

function start(): void {
  totalMs.value = chosen.value * 60_000
  targetTs.value = Date.now() + totalMs.value
  syncRemain()
  phase.value = 'running'
  uni.setKeepScreenOn({ keepScreenOn: true })
  clearTicker()
  ticker = setInterval(tick, 250)
}

/** 跑满结算：全程唯一的入账点 */
function settle(): void {
  focus.addMinutes(chosen.value)
  clearTicker()
  uni.setKeepScreenOn({ keepScreenOn: false })
  phase.value = 'done'
  uni.vibrateShort({ type: 'medium' })
}

/** 中途退出：选因后不入账，回到选时态 */
function giveUp(cause: string): void {
  giveUpOpen.value = false
  clearTicker()
  uni.setKeepScreenOn({ keepScreenOn: false })
  phase.value = 'idle'
  uni.showToast({ title: `${cause} · 这一程未计入`, icon: 'none' })
}

function openGiveUp(): void {
  giveUpOpen.value = true
}

/** 统一离页：计时中只能先作答 */
function backOrGiveUp(): void {
  if (phase.value === 'running') {
    openGiveUp()
    return
  }
  const pages = getCurrentPages()
  if (pages.length > 1) {
    uni.navigateBack()
  } else {
    uni.switchTab({ url: ROUTES.tabPause })
  }
}

function goBack(): void {
  backOrGiveUp()
}

function leave(): void {
  const pages = getCurrentPages()
  if (pages.length > 1) {
    uni.navigateBack()
  } else {
    uni.switchTab({ url: ROUTES.tabPause })
  }
}

onShow(() => {
  if (phase.value !== 'running') return
  if (Date.now() >= targetTs.value) {
    // 切走期间其实已跑满 → 回前台诚实结算
    settle()
    uni.showToast({ title: '后台亦在计时 · 定力已入账', icon: 'none' })
    return
  }
  syncRemain()
  clearTicker()
  ticker = setInterval(tick, 250)
})

onHide(() => {
  clearTicker()
})

onUnload(() => {
  clearTicker()
  uni.setKeepScreenOn({ keepScreenOn: false })
})

/* 物理返回 / 侧滑：计时中拦截为作答层 */
onBackPress(() => {
  if (phase.value === 'running') {
    openGiveUp()
    return true
  }
  return false
})
</script>

<style lang="scss" scoped>
.page {
  min-height: 100vh;
  padding: calc(var(--status-bar-height) + 16rpx) $gz-page-pad 60rpx;
  box-sizing: border-box;
}

/* 顶栏（子页同款） */
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

/* 选择 / 完成态 */
.hero {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 70rpx 30rpx 54rpx;
}

.seal {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 128rpx;
  height: 128rpx;
  border: 3rpx solid $gz-accent;
  border-radius: 30rpx;
  background: $gz-accent-soft;
  color: $gz-accent;
  font-size: 62rpx;
  font-weight: 800;
  box-shadow: 0 16rpx 40rpx $gz-accent-soft;
}

.seal--done {
  animation: breathe 1.6s ease-in-out infinite;
}

@keyframes breathe {
  0%,
  100% {
    transform: scale(1);
  }
  50% {
    transform: scale(1.06);
  }
}

.hero__title {
  display: block;
  margin-top: 34rpx;
  font-size: 36rpx;
  font-weight: 700;
  letter-spacing: 0.06em;
  color: $gz-ink;
}

.hero__desc {
  display: block;
  margin-top: 14rpx;
  font-size: $gz-fs-small;
  line-height: 1.9;
  text-align: center;
  color: $gz-ink-3;
  white-space: pre-line;
}

.hero__num {
  margin-top: 22rpx;
  font-size: 58rpx;
  font-weight: 800;
  color: $gz-accent;
}

.hero__unit {
  font-size: $gz-fs-body;
  font-weight: 400;
  color: $gz-ink-3;
}

/* 时长选择 */
.pills {
  display: flex;
  gap: 16rpx;
  margin-bottom: 40rpx;
}

.pill {
  flex: 1;
  padding: 20rpx 0;
  text-align: center;
  font-size: $gz-fs-small;
  color: $gz-ink-2;
  background: $gz-surface;
  border: 1rpx solid $gz-line;
  border-radius: $gz-radius-md;
}

.pill.is-on {
  color: $gz-accent;
  border-color: $gz-accent;
  font-weight: 600;
}

.cta {
  width: 100%;
  padding: 28rpx 0;
  border-radius: $gz-radius-md;
  background: $gz-accent;
  color: $gz-on-cta;
  font-size: $gz-fs-body;
  font-weight: 600;
  letter-spacing: 0.08em;
}

/* 计时中 */
.ring {
  position: relative;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 460rpx;
  height: 460rpx;
  margin: 80rpx auto 0;
}

.ring__halo {
  position: absolute;
  inset: 0;
  border-radius: 50%;
  border: 2rpx solid $gz-accent;
  animation: halo 3.2s ease-in-out infinite;
}

@keyframes halo {
  0%,
  100% {
    transform: scale(0.95);
    opacity: 0.85;
  }
  50% {
    transform: scale(1.08);
    opacity: 0.25;
  }
}

.ring__core {
  position: relative;
  display: flex;
  flex-direction: column;
  align-items: center;
}

.ring__mark {
  font-size: 34rpx;
  font-weight: 700;
  letter-spacing: 0.14em;
  color: $gz-accent;
}

.ring__time {
  margin-top: 20rpx;
  font-size: 96rpx;
  font-weight: 800;
  letter-spacing: 0.04em;
  color: $gz-ink;
  line-height: 1.1;
  font-variant-numeric: tabular-nums;
}

.ring__pct {
  margin-top: 14rpx;
  font-size: $gz-fs-caption;
  color: $gz-ink-3;
}

.bar {
  width: 480rpx;
  margin: 36rpx auto 0;
  height: 10rpx;
  border-radius: 999rpx;
  background: var(--gz-line-soft);
  overflow: hidden;
}

.bar__fill {
  height: 100%;
  border-radius: 999rpx;
  background: linear-gradient(90deg, $gz-accent, $gz-grad-to);
  transition: width 0.2s linear;
}

.tip {
  margin-top: 34rpx;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8rpx;
}

.tip__line {
  font-size: $gz-fs-caption;
  color: $gz-ink-3;
}

.giveup {
  margin-top: 52rpx;
  padding: 20rpx 0;
  width: 100%;
  border-radius: $gz-radius-md;
  border: 1rpx solid $gz-line;
  background: transparent;
  color: $gz-ink-3;
  font-size: $gz-fs-small;
}

/* 作答层 */
.mask {
  position: fixed;
  inset: 0;
  z-index: 20;
  display: flex;
  align-items: flex-end;
  background: rgba(0, 0, 0, 0.42);
}

.sheet {
  width: 100%;
  padding: 40rpx 34rpx calc(40rpx + env(safe-area-inset-bottom));
  box-sizing: border-box;
  background: $gz-paper;
  border-radius: 32rpx 32rpx 0 0;
}

.sheet__title {
  display: block;
  font-size: 34rpx;
  font-weight: 700;
  color: $gz-ink;
}

.sheet__sub {
  display: block;
  margin-top: 8rpx;
  font-size: $gz-fs-caption;
  color: $gz-ink-3;
}

.sheet__opts {
  display: flex;
  flex-direction: column;
  gap: 16rpx;
  margin-top: 30rpx;
}

.sheet__opt {
  padding: 24rpx 28rpx;
  text-align: center;
  font-size: $gz-fs-body;
  color: $gz-ink-2;
  background: $gz-surface;
  border: 1rpx solid $gz-line;
  border-radius: $gz-radius-md;
}

.sheet__cancel {
  margin-top: 20rpx;
  padding: 24rpx 0;
  text-align: center;
  font-size: $gz-fs-body;
  font-weight: 600;
  color: $gz-accent;
}
</style>

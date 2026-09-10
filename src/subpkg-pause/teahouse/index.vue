<template>
  <view class="page" :class="skinClass">
    <!-- 顶栏：返回 + 标题 -->
    <view class="nav">
      <view class="nav__side" hover-class="gz-hover" @click="goBack">
        <text class="nav__back">‹</text>
      </view>
      <text class="nav__title">静心茶室</text>
      <view class="nav__side" />
    </view>

    <!-- 选盏 -->
    <template v-if="phase === 'pick'">
      <view class="hero">
        <view class="seal">闲</view>
        <text class="hero__title">选一盏，坐下</text>
        <text class="hero__desc">
          五种方式，都是一盏茶的工夫。\n中途离席需如实作答，这一盏不作数。
        </text>
      </view>

      <view class="menu">
        <view
          v-for="t in TEA"
          :key="t.id"
          class="menu__item"
          hover-class="gz-hover"
          @click="start(t.id)"
        >
          <view class="menu__dot" :style="{ background: t.accent }" />
          <view class="menu__body">
            <text class="menu__name">{{ t.name }}</text>
            <text class="menu__mood">{{ t.mood }}</text>
          </view>
          <text class="menu__go">›</text>
        </view>
      </view>

      <text class="foot">一盏 5 分钟 · 走完全程入账今日定力</text>
    </template>

    <!-- 静守中 -->
    <template v-else-if="phase === 'brew'">
      <view class="brew">
        <text class="brew__eyebrow">一盏 {{ active.name }} · {{ active.mood }}</text>

        <!-- 观想卷：五模式各一幅氛围动效 -->
        <view class="scene" :class="`scene--${active.id}`">
          <!-- 焚香：暖米书案 + 一炷香，烟缕次第升 -->
          <template v-if="active.id === 'xiang'">
            <view class="xia" />
            <view class="incense" />
            <view class="smoke smoke--a" />
            <view class="smoke smoke--b" />
            <view class="smoke smoke--c" />
            <view class="scene__ink">烟起烟散，什么都不必做</view>
          </template>
          <!-- 扫尘：青灰庭院，落叶自去 -->
          <template v-else-if="active.id === 'sao'">
            <view class="leaf leaf--1" />
            <view class="leaf leaf--2" />
            <view class="leaf leaf--3" />
            <view class="leaf leaf--4" />
            <view class="leaf leaf--5" />
            <view class="scene__ink">风过处，尘与叶自去</view>
          </template>
          <!-- 听潮：深蓝海岸，潮声往返 -->
          <template v-else-if="active.id === 'ting'">
            <view class="ting-moon" />
            <view class="wave wave--1" />
            <view class="wave wave--2" />
            <view class="scene__ink">潮来了又去，你是岸边</view>
          </template>
          <!-- 观云：浅天流云，看聚散 -->
          <template v-else-if="active.id === 'yun'">
            <view class="cloud cloud--1" />
            <view class="cloud cloud--2" />
            <view class="cloud cloud--3" />
            <view class="yun-hill" />
            <view class="scene__ink">云聚云散，不着于相</view>
          </template>
          <!-- 煮雪：雪青静夜，炉火候雪 -->
          <template v-else>
            <view class="snow snow--a" />
            <view class="snow snow--b" />
            <view class="snow snow--c" />
            <view class="pot" />
            <view class="coal" />
            <view class="steam steam--a" />
            <view class="steam steam--b" />
            <view class="scene__ink">火候到了，水自然会开</view>
          </template>
        </view>

        <!-- 时间与节奏 -->
        <view class="time">{{ remainText }}</view>
        <view class="bar">
          <view class="bar__fill" :style="{ width: `${pct * 100}%` }" />
        </view>
        <text class="brew__hint">{{ active.hint }}</text>
        <text class="brew__note">以真实时间为准：息屏、切走，盏仍守着</text>

        <button class="leave" hover-class="gz-hover" @click="openLeave">提前离席</button>
      </view>
    </template>

    <!-- 一盏毕 -->
    <template v-else>
      <view class="hero">
        <view class="seal seal--done">安</view>
        <text class="hero__title">这一盏，守住了</text>
        <text class="hero__num">5<text class="hero__unit"> 分钟已入账</text></text>
        <text class="hero__desc">今日累计 {{ todayMin }} 分钟 · 小目标 /60</text>
      </view>
      <view class="btns">
        <button class="cta" hover-class="gz-hover" @click="brewAgain">再来一盏</button>
        <button class="cta cta--ghost" hover-class="gz-hover" @click="leave">收盏离开</button>
      </view>
    </template>

    <!-- 中途离席作答 -->
    <view v-if="leaveOpen" class="mask" @click="leaveOpen = false">
      <view class="sheet" @click.stop>
        <text class="sheet__title">为什么提前离席？</text>
        <text class="sheet__sub">如实作答 · 这一盏将不计入定力</text>
        <view class="sheet__opts">
          <view
            v-for="c in LEAVE_CAUSES"
            :key="c"
            class="sheet__opt"
            hover-class="gz-hover"
            @click="leaveFor(c)"
          >
            {{ c }}
          </view>
        </view>
        <view class="sheet__cancel" hover-class="gz-hover" @click="leaveOpen = false">
          再坐一会儿
        </view>
      </view>
    </view>
  </view>
</template>

<script setup lang="ts">
/**
 * 止 · 静心茶室 —— 批次 B 真实功能子页（分包 subpkg-pause）。
 * 一盏 = 5 分钟沉浸练习（焚香 / 扫尘 / 听潮 / 观云 / 煮雪）。
 * 规则与禅定沙漏同源：
 *  - 走完全程才写入今日定力（focus store，单盏 5 分钟）；
 *  - 中途离席需选因作答、不入账；
 *  - 计时以墙上时间为准，后台跑满回前台照实结算。
 */
import { computed, ref } from 'vue'
import { onHide, onLoad, onShow, onUnload, onBackPress } from '@dcloudio/uni-app'
import { useFocusStore } from '@/stores/focus'
import { useSkinClass } from '@/composables/useSkin'
import { ROUTES } from '@/router/routes'

const focus = useFocusStore()
const skinClass = useSkinClass()

const STEADY_MS = 5 * 60_000
const LEAVE_CAUSES = ['心神不宁', '被外物打断', '身体不适', '另有安排'] as const

interface Tea {
  id: 'xiang' | 'sao' | 'ting' | 'yun' | 'zhu'
  name: string
  mood: string
  hint: string
  accent: string
}

const TEA: Tea[] = [
  {
    id: 'xiang',
    name: '焚香',
    mood: '一炷香，不与时间讨价还价',
    hint: '看烟起烟散，什么都不必做',
    accent: '#B4552D',
  },
  {
    id: 'sao',
    name: '扫尘',
    mood: '尘埃落定，心也清了一层',
    hint: '念起即觉，如叶落不追',
    accent: '#7D9B63',
  },
  {
    id: 'ting',
    name: '听潮',
    mood: '潮起潮落，念头不过浪花',
    hint: '声音来了又去，你是岸边',
    accent: '#2F6FA6',
  },
  {
    id: 'yun',
    name: '观云',
    mood: '云聚云散，不着于相',
    hint: '让念头像云一样飘过',
    accent: '#6C84B8',
  },
  {
    id: 'zhu',
    name: '煮雪',
    mood: '守着炉火，等一壶雪水',
    hint: '火候到了，水自然会开',
    accent: '#3F8294',
  },
]

const active = computed(() => TEA.find((t) => t.id === activeId.value) ?? TEA[0])

type Phase = 'pick' | 'brew' | 'done'
const phase = ref<Phase>('pick')
const activeId = ref<Tea['id']>('xiang')

/** 目标完成时刻（墙上时间），跑满才结算 */
const targetTs = ref(0)
const totalMs = ref(STEADY_MS)
const remainMs = ref(STEADY_MS)
const leaveOpen = ref(false)

const todayMin = computed(() => focus.minutesOn())

const remainText = computed(() => {
  const s = Math.max(0, Math.ceil(remainMs.value / 1000))
  const m = Math.floor(s / 60)
  const r = s % 60
  return `${String(m).padStart(2, '0')}:${String(r).padStart(2, '0')}`
})

const pct = computed(() => (totalMs.value > 0 ? 1 - remainMs.value / totalMs.value : 0))

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

/** 从大厅点某一模式进来：query 带 room 则直接开这一盏 */
onLoad((query) => {
  const room = query?.room
  if (typeof room === 'string' && TEA.some((t) => t.id === room)) {
    activeId.value = room as Tea['id']
    start(room as Tea['id'])
  }
})

function start(id: Tea['id']): void {
  activeId.value = id
  totalMs.value = STEADY_MS
  targetTs.value = Date.now() + totalMs.value
  syncRemain()
  phase.value = 'brew'
  uni.setKeepScreenOn({ keepScreenOn: true })
  clearTicker()
  ticker = setInterval(tick, 250)
}

/** 跑满结算：全程唯一的入账点 */
function settle(): void {
  focus.addMinutes(5)
  clearTicker()
  uni.setKeepScreenOn({ keepScreenOn: false })
  phase.value = 'done'
  uni.vibrateShort({ type: 'medium' })
}

function openLeave(): void {
  leaveOpen.value = true
}

/** 中途离席：选因后不入账，回到选盏 */
function leaveFor(cause: string): void {
  leaveOpen.value = false
  clearTicker()
  uni.setKeepScreenOn({ keepScreenOn: false })
  phase.value = 'pick'
  uni.showToast({ title: `${cause} · 这一盏未计入`, icon: 'none' })
}

function brewAgain(): void {
  phase.value = 'pick'
}

function backToPause(): void {
  const pages = getCurrentPages()
  if (pages.length > 1) {
    uni.navigateBack()
  } else {
    uni.switchTab({ url: ROUTES.tabPause })
  }
}

/** 统一离页：静守中只能先作答 */
function goBack(): void {
  if (phase.value === 'brew') {
    openLeave()
    return
  }
  backToPause()
}

function leave(): void {
  backToPause()
}

onShow(() => {
  if (phase.value !== 'brew') return
  if (Date.now() >= targetTs.value) {
    settle()
    uni.showToast({ title: '后台亦在守盏 · 定力已入账', icon: 'none' })
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

/* 物理返回 / 侧滑：静守中拦截为作答层 */
onBackPress(() => {
  if (phase.value === 'brew') {
    openLeave()
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

/* 选盏 / 完成态 */
.hero {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 54rpx 30rpx 40rpx;
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
  margin-top: 30rpx;
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

/* 五盏菜单 */
.menu {
  display: flex;
  flex-direction: column;
  gap: 18rpx;
}

.menu__item {
  display: flex;
  align-items: center;
  gap: 22rpx;
  padding: 24rpx 26rpx;
  background: $gz-surface;
  border: 1rpx solid $gz-line;
  border-radius: $gz-radius-md;
}

.menu__dot {
  flex: none;
  width: 16rpx;
  height: 16rpx;
  border-radius: 50%;
}

.menu__body {
  flex: 1;
  display: flex;
  flex-direction: column;
}

.menu__name {
  font-size: $gz-fs-body;
  font-weight: 700;
  color: $gz-ink;
}

.menu__mood {
  margin-top: 6rpx;
  font-size: $gz-fs-caption;
  color: $gz-ink-3;
}

.menu__go {
  font-size: 40rpx;
  color: $gz-ink-3;
}

.foot {
  display: block;
  margin-top: 26rpx;
  text-align: center;
  font-size: $gz-fs-caption;
  color: $gz-ink-3;
}

/* ---------- 静守中 ---------- */
.brew {
  display: flex;
  flex-direction: column;
  align-items: center;
}

.brew__eyebrow {
  display: block;
  margin-top: 12rpx;
  font-size: $gz-fs-caption;
  letter-spacing: 0.04em;
  color: $gz-ink-3;
}

/* 观想卷：一幅可凝视的画面 */
.scene {
  position: relative;
  overflow: hidden;
  width: 640rpx;
  height: 520rpx;
  margin-top: 26rpx;
  border-radius: $gz-radius-lg;
  box-shadow: 0 18rpx 44rpx rgba(20, 16, 10, 0.16);
}

.scene__ink {
  position: absolute;
  left: 0;
  right: 0;
  bottom: 18rpx;
  text-align: center;
  font-size: $gz-fs-caption;
  letter-spacing: 0.08em;
  color: rgba(30, 26, 20, 0.62);
  text-shadow: 0 1rpx 0 rgba(255, 255, 255, 0.4);
}

/* —— 焚香：暖米书案 —— */
.scene--xiang {
  background: linear-gradient(180deg, #f3e8d2 0%, #e7d3ac 100%);
}

.xia {
  position: absolute;
  left: 0;
  right: 0;
  bottom: 0;
  height: 120rpx;
  background: linear-gradient(180deg, #d9b98a 0%, #c8a272 100%);
}

.incense {
  position: absolute;
  left: 50%;
  bottom: 96rpx;
  width: 6rpx;
  height: 260rpx;
  margin-left: -3rpx;
  background: linear-gradient(180deg, rgba(150, 90, 50, 0.9) 0%, #a8602e 70%);
  border-radius: 999rpx;
}

.smoke {
  position: absolute;
  left: 50%;
  bottom: 340rpx;
  width: 14rpx;
  height: 14rpx;
  margin-left: -7rpx;
  border-radius: 50%;
  background: rgba(120, 96, 66, 0.55);
  animation: smoke-rise 4.4s ease-out infinite;
  opacity: 0;
}

.smoke--b {
  animation-delay: 1.5s;
}

.smoke--c {
  animation-delay: 3s;
}

@keyframes smoke-rise {
  0% {
    transform: translateY(0) scale(0.6);
    opacity: 0;
  }
  18% {
    opacity: 0.5;
  }
  70% {
    opacity: 0.28;
  }
  100% {
    transform: translateY(-190rpx) translateX(10rpx) scale(1.6);
    opacity: 0;
  }
}

/* —— 扫尘：青灰庭院，五片叶次第落 —— */
.scene--sao {
  background: linear-gradient(180deg, #dfe2d4 0%, #c4ccb6 100%);
}

.leaf {
  position: absolute;
  top: -40rpx;
  width: 26rpx;
  height: 40rpx;
  border-radius: 80% 8% 80% 8%;
  background: #8b9373;
  opacity: 0;
  animation: leaf-fall 9s linear infinite;
}

.leaf--1 {
  left: 14%;
  animation-delay: 0s;
}

.leaf--2 {
  left: 32%;
  animation-delay: 1.8s;
  background: #7f8a6a;
}

.leaf--3 {
  left: 52%;
  animation-delay: 3.6s;
}

.leaf--4 {
  left: 70%;
  animation-delay: 5.4s;
  background: #96a085;
}

.leaf--5 {
  left: 84%;
  animation-delay: 7.2s;
}

@keyframes leaf-fall {
  0% {
    transform: translateY(0) rotate(0deg);
    opacity: 0;
  }
  6% {
    opacity: 0.7;
  }
  82% {
    opacity: 0.55;
  }
  100% {
    transform: translateY(540rpx) rotate(320deg);
    opacity: 0;
  }
}

/* —— 听潮：深蓝海岸 —— */
.scene--ting {
  background: linear-gradient(180deg, #1c3a55 0%, #123049 60%, #0e2a40 100%);
}

.ting-moon {
  position: absolute;
  top: 60rpx;
  right: 88rpx;
  width: 64rpx;
  height: 64rpx;
  border-radius: 50%;
  background: rgba(226, 240, 252, 0.9);
  box-shadow: 0 0 40rpx rgba(226, 240, 252, 0.35);
}

.wave {
  position: absolute;
  left: 0;
  right: -140rpx;
  border-radius: 999rpx;
  background: rgba(150, 196, 232, 0.5);
}

.wave--1 {
  top: 62%;
  height: 8rpx;
  animation: tide 7s ease-in-out infinite alternate;
}

.wave--2 {
  top: 78%;
  height: 12rpx;
  background: rgba(190, 222, 246, 0.42);
  animation: tide 9.5s ease-in-out infinite alternate-reverse;
}

@keyframes tide {
  from {
    transform: translateX(-40rpx);
  }
  to {
    transform: translateX(60rpx);
  }
}

.scene--ting .scene__ink {
  color: rgba(226, 240, 252, 0.66);
  text-shadow: none;
}

/* —— 观云：浅天流云 + 远山 —— */
.scene--yun {
  background: linear-gradient(180deg, #cfe0f2 0%, #a9c4e4 72%, #8fb0d6 100%);
}

.cloud {
  position: absolute;
  background: rgba(255, 255, 255, 0.92);
  border-radius: 999rpx;
  animation: cloud-drift 14s ease-in-out infinite alternate;
}

.cloud--1 {
  top: 90rpx;
  left: 90rpx;
  width: 180rpx;
  height: 54rpx;
  box-shadow: 46rpx 18rpx 0 -6rpx rgba(255, 255, 255, 0.9), -36rpx 22rpx 0 -10rpx rgba(255, 255, 255, 0.82);
}

.cloud--2 {
  top: 230rpx;
  left: 380rpx;
  width: 140rpx;
  height: 42rpx;
  opacity: 0.8;
  animation-duration: 18s;
  animation-delay: -6s;
}

.cloud--3 {
  top: 320rpx;
  left: 30rpx;
  width: 110rpx;
  height: 34rpx;
  opacity: 0.66;
  animation-duration: 12s;
  animation-delay: -3s;
}

@keyframes cloud-drift {
  from {
    transform: translateX(-26rpx);
  }
  to {
    transform: translateX(30rpx);
  }
}

.yun-hill {
  position: absolute;
  left: -60rpx;
  right: -60rpx;
  bottom: -90rpx;
  height: 260rpx;
  background: linear-gradient(180deg, rgba(64, 94, 128, 0) 60%, rgba(64, 94, 128, 0.42) 100%),
    linear-gradient(180deg, rgba(70, 100, 132, 0) 55%, rgba(70, 100, 132, 0.5) 100%);
}

/* —— 煮雪：雪青静夜 —— */
.scene--zhu {
  background: linear-gradient(180deg, #1d2f3a 0%, #243c47 100%);
}

.snow {
  position: absolute;
  top: -20rpx;
  width: 10rpx;
  height: 10rpx;
  border-radius: 50%;
  background: rgba(240, 248, 252, 0.8);
  opacity: 0;
  animation: snow-fall 8s linear infinite;
}

.snow--a {
  left: 20%;
  animation-delay: 0s;
}

.snow--b {
  left: 50%;
  animation-delay: 2.7s;
  width: 7rpx;
  height: 7rpx;
}

.snow--c {
  left: 78%;
  animation-delay: 5.3s;
}

@keyframes snow-fall {
  0% {
    transform: translateY(0);
    opacity: 0;
  }
  8% {
    opacity: 0.85;
  }
  100% {
    transform: translateY(520rpx) translateX(16rpx);
    opacity: 0;
  }
}

.coal {
  position: absolute;
  left: 50%;
  bottom: 46rpx;
  width: 200rpx;
  height: 64rpx;
  margin-left: -100rpx;
  border-radius: 999rpx;
  background: linear-gradient(180deg, #ff8a4c 0%, #d85c26 60%, #7c2f14 100%);
  box-shadow: 0 0 46rpx rgba(255, 122, 60, 0.55);
  animation: coal-breathe 3.6s ease-in-out infinite;
}

@keyframes coal-breathe {
  0%,
  100% {
    transform: scale(1);
    opacity: 0.9;
  }
  50% {
    transform: scale(1.08);
    opacity: 1;
  }
}

.pot {
  position: absolute;
  left: 50%;
  bottom: 96rpx;
  width: 150rpx;
  height: 110rpx;
  margin-left: -75rpx;
  border-radius: 26rpx 26rpx 40rpx 40rpx;
  background: linear-gradient(180deg, #dce7ec 0%, #aebec8 100%);
}

.pot::before {
  content: '';
  position: absolute;
  top: -16rpx;
  left: 50%;
  width: 74rpx;
  height: 22rpx;
  margin-left: -37rpx;
  border-radius: 999rpx;
  background: #c3d1d9;
}

.pot::after {
  content: '';
  position: absolute;
  top: -4rpx;
  left: 50%;
  width: 18rpx;
  height: 18rpx;
  margin-left: -9rpx;
  border-radius: 50%;
  background: #8fa6b2;
}

.steam {
  position: absolute;
  left: 50%;
  bottom: 200rpx;
  width: 12rpx;
  height: 12rpx;
  margin-left: -6rpx;
  border-radius: 50%;
  background: rgba(255, 255, 255, 0.5);
  opacity: 0;
  animation: steam-rise 3.2s ease-out infinite;
}

.steam--b {
  animation-delay: 1.6s;
  left: 58%;
}

@keyframes steam-rise {
  0% {
    transform: translateY(0) scale(0.6);
    opacity: 0;
  }
  20% {
    opacity: 0.55;
  }
  100% {
    transform: translateY(-170rpx) translateX(12rpx) scale(1.7);
    opacity: 0;
  }
}

.scene--zhu .scene__ink {
  color: rgba(224, 238, 244, 0.66);
  text-shadow: none;
}

/* 时间 / 进度 */
.time {
  margin-top: 30rpx;
  font-size: 96rpx;
  font-weight: 800;
  letter-spacing: 0.04em;
  color: $gz-ink;
  line-height: 1.1;
  font-variant-numeric: tabular-nums;
}

.bar {
  width: 480rpx;
  margin-top: 18rpx;
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

.brew__hint {
  display: block;
  margin-top: 26rpx;
  font-size: $gz-fs-body;
  font-weight: 600;
  letter-spacing: 0.1em;
  color: $gz-accent;
}

.brew__note {
  display: block;
  margin-top: 10rpx;
  font-size: $gz-fs-caption;
  color: $gz-ink-3;
}

.leave {
  margin-top: 34rpx;
  padding: 20rpx 0;
  width: 100%;
  border-radius: $gz-radius-md;
  border: 1rpx solid $gz-line;
  background: transparent;
  color: $gz-ink-3;
  font-size: $gz-fs-small;
}

/* 按钮组（完成态） */
.btns {
  display: flex;
  flex-direction: column;
  gap: 18rpx;
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

.cta--ghost {
  background: $gz-accent-soft;
  color: $gz-accent;
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

<template>
  <view class="startup" :class="skinClass" hover-class="none" @click="go">
    <!-- 品牌 -->
    <view class="startup__brand">
      <BrandSeal :size="84" />
      <text class="startup__name">观止知行</text>
      <text class="startup__en">INSIGHT · ACTION · DIGITAL PRACTICE</text>
    </view>

    <!-- 今日一签 -->
    <view class="startup__proverb">
      <text class="startup__proverb-text">「{{ proverb.text }}」</text>
      <text v-if="proverb.from" class="startup__proverb-from">—— {{ proverb.from }}</text>

      <!-- 记住这句：收进「我的箴言」（我页一级入口可回看） -->
      <view class="startup__fav" :class="{ 'is-on': faved }" hover-class="gz-hover" @click.stop="onFav">
        <text class="startup__fav-icon">{{ faved ? '♥' : '♡' }}</text>
        <text class="startup__fav-label">{{ faved ? '已记住' : '记住这句' }}</text>
      </view>
    </view>

    <!-- 版心靠上：下方留白交给这块弹性占位 -->
    <view class="startup__spacer" />

    <view class="startup__foot">
      <text class="startup__hint">轻点屏幕，即刻开始 · {{ leftSec }}s</text>
      <view class="startup__bar">
        <view class="startup__bar-fill" :style="{ width: `${progress}%` }" />
      </view>
      <text v-if="favCount > 0" class="startup__favnote">已记住 {{ favCount }} 句 · 在「我 · 我的箴言」回看</text>
    </view>
  </view>
</template>

<script setup lang="ts">
/**
 * 启动箴言页：打开仪式 —— 每次冷启动都会先经过这里约 4 秒（点按即跳过）。
 * 皮肤跟随「上次选择的修行语言」（模式已持久化，无需每次重选），
 * 修仙即旧纸朱砂开屏、科技即深夜网格开屏。
 * 分流：已完成引导 → 主界面（观大厅）；未完成 → 模式选择。
 * 「记住这句」把开屏箴言收进 proverb store，可在「我 · 我的箴言」回看。
 */
import { onLoad, onUnload } from '@dcloudio/uni-app'
import { computed, ref } from 'vue'
import { useAppStore } from '@/stores/app'
import { useSkinClass } from '@/composables/useSkin'
import { useProverbStore } from '@/stores/proverb'
import { ROUTES } from '@/router/routes'

/** 开屏停留时长：留足读完一句箴言的时间（点按屏幕可随时跳过） */
const HOLD_MS = 4000

interface Proverb {
  text: string
  from?: string
}

/** 启动箴言库（内置初版；正式版按来源比例扩充：用户感悟30/古籍25/自定20/小枢原创15/道侣10） */
const PROVERBS: readonly Proverb[] = [
  { text: '知止而后有定，定而后能静', from: '《大学》' },
  { text: '少则得，多则惑', from: '《道德经》' },
  { text: '学而不思则罔，思而不学则殆', from: '《论语》' },
  { text: '博学之，审问之，慎思之，明辨之，笃行之', from: '《中庸》' },
  { text: '不贵其师，不爱其资，虽智大迷', from: '《道德经》' },
  { text: '吾日三省吾身', from: '《论语》' },
  { text: '注意力在哪里，人生就在哪里', from: '观止语录' },
  { text: '看得多不是收获，用得上的才是', from: '观止语录' },
  { text: '慢一点，比较快', from: '观止语录' },
  { text: '把手机放下，把此刻拾起', from: '观止语录' },
]

const appStore = useAppStore()
const proverb = PROVERBS[Math.floor(Math.random() * PROVERBS.length)]

/** 皮肤跟随已保存的模式（normal / tech / dao），三种开屏随用户上次的选择出现 */
const skinClass = useSkinClass()

/* ---------------- 记住这句（收进「我的箴言」） ---------------- */
const proverbs = useProverbStore()

/** 收藏状态与计数（结构化存储：正文 + 出处 + 来源，供后续回响/转知识卡使用） */
const faved = computed(() => proverbs.has(proverb.text, 'startup'))
const favCount = computed(() => proverbs.count)

function onFav(): void {
  const on = proverbs.toggle({ text: proverb.text, from: proverb.from, source: 'startup' })
  uni.showToast({ title: on ? '已记住 · 收进我的箴言' : '已取消记住', icon: 'none' })
}

/* ---------------- 停留与跳过 ---------------- */
let timer: ReturnType<typeof setTimeout> | null = null
let tick: ReturnType<typeof setInterval> | null = null

/** 剩余毫秒（驱动倒计时与进度条） */
const leftMs = ref(HOLD_MS)
const leftSec = computed(() => Math.ceil(leftMs.value / 1000))
const progress = computed(() => Math.round(((HOLD_MS - leftMs.value) / HOLD_MS) * 100))

function stopTimers(): void {
  if (timer) {
    clearTimeout(timer)
    timer = null
  }
  if (tick) {
    clearInterval(tick)
    tick = null
  }
}

/** 跳往下一步 */
function go(): void {
  stopTimers()
  if (appStore.onboarded) {
    uni.switchTab({ url: ROUTES.tabObserve })
  } else {
    uni.reLaunch({ url: ROUTES.entryModeSelect })
  }
}

onLoad(() => {
  timer = setTimeout(go, HOLD_MS)
  tick = setInterval(() => {
    leftMs.value = Math.max(0, leftMs.value - 100)
    if (leftMs.value <= 0 && tick) {
      clearInterval(tick)
      tick = null
    }
  }, 100)
})

onUnload(() => {
  stopTimers()
})
</script>

<style lang="scss" scoped>
/* 版式：品牌 → 箴言 → 记住 依次靠上，下方留白（像纸质扉页，短屏也安全） */
.startup {
  display: flex;
  flex-direction: column;
  align-items: center;
  min-height: 100vh;
  padding: calc(var(--status-bar-height) + 72rpx) $gz-page-pad 64rpx;
  box-sizing: border-box;
}

.startup__brand {
  display: flex;
  flex-direction: column;
  align-items: center;
}

.startup__name {
  margin-top: 28rpx;
  font-size: 44rpx;
  font-weight: 700;
  letter-spacing: 0.24em;
  text-indent: 0.24em; /* 抵消末字间距，保持居中 */
  color: $gz-ink;
}

.startup__en {
  margin-top: 14rpx;
  font-size: $gz-fs-caption;
  letter-spacing: $gz-ls-wide;
  color: $gz-ink-3;
}

.startup__proverb {
  display: flex;
  flex-direction: column;
  align-items: center;
  flex: none;
  margin-top: 96rpx;
  padding: 0 40rpx;
}

/* 弹性留白：把底部提示推到屏底，同时保证版心不被拉散 */
.startup__spacer {
  flex: 1;
  min-height: 60rpx;
}

.startup__proverb-text {
  font-size: 38rpx;
  line-height: 1.9;
  text-align: center;
  color: $gz-ink;
  animation: gz-rise 0.9s ease both;
}

.startup__proverb-from {
  margin-top: 24rpx;
  font-size: $gz-fs-small;
  color: $gz-ink-3;
  animation: gz-rise 0.9s 0.15s ease both;
}

/* 记住这句：文字链形态（无边框无底色，热区靠 padding 撑开，随主题色走） */
.startup__fav {
  display: inline-flex;
  align-items: center;
  gap: 10rpx;
  margin-top: 56rpx;
  padding: 18rpx 30rpx;
  animation: gz-rise 0.9s 0.3s ease both;
}

.startup__fav-icon {
  font-size: 30rpx;
  color: var(--gz-accent);
  opacity: 0.7;
}

.startup__fav-label {
  font-size: $gz-fs-caption;
  letter-spacing: 0.1em;
  color: var(--gz-accent);
  opacity: 0.85;
}

.startup__fav.is-on .startup__fav-icon,
.startup__fav.is-on .startup__fav-label {
  opacity: 1;
  font-weight: 600;
}

.startup__foot {
  display: flex;
  flex-direction: column;
  align-items: center;
}

.startup__hint {
  font-size: $gz-fs-caption;
  letter-spacing: 0.1em;
  color: $gz-ink-3;
  animation: gz-breathe 2.4s ease-in-out infinite;
}

/* 停留进度：让用户知道还要等多久 */
.startup__bar {
  margin-top: 22rpx;
  width: 200rpx;
  height: 6rpx;
  border-radius: 999rpx;
  background: $gz-line-soft;
  overflow: hidden;
}

.startup__bar-fill {
  height: 100%;
  border-radius: 999rpx;
  background: linear-gradient(90deg, var(--gz-accent), var(--gz-grad-to));
  transition: width 0.1s linear;
}

.startup__favnote {
  margin-top: 20rpx;
  font-size: $gz-fs-caption;
  color: $gz-ink-3;
  opacity: 0.8;
}

@keyframes gz-rise {
  from {
    opacity: 0;
    transform: translateY(24rpx);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

@keyframes gz-breathe {
  0%,
  100% {
    opacity: 0.4;
  }
  50% {
    opacity: 1;
  }
}
</style>

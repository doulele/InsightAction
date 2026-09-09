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
    </view>

    <text class="startup__hint">轻点屏幕，即刻开始</text>
  </view>
</template>

<script setup lang="ts">
/**
 * 启动箴言页：打开仪式 —— 每次冷启动都会先经过这里约 2 秒（点按即跳过）。
 * 皮肤跟随「上次选择的修行语言」（模式已持久化，无需每次重选），
 * 修仙即旧纸朱砂开屏、科技即深夜网格开屏。
 * 分流：已完成引导 → 主界面（观大厅）；未完成 → 模式选择。
 */
import { onLoad, onUnload } from '@dcloudio/uni-app'
import { useAppStore } from '@/stores/app'
import { useSkinClass } from '@/composables/useSkin'
import { ROUTES } from '@/router/routes'

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

let timer: ReturnType<typeof setTimeout> | null = null

/** 跳往下一步 */
function go(): void {
  if (timer) {
    clearTimeout(timer)
    timer = null
  }
  if (appStore.onboarded) {
    uni.switchTab({ url: ROUTES.tabObserve })
  } else {
    uni.reLaunch({ url: ROUTES.entryModeSelect })
  }
}

onLoad(() => {
  timer = setTimeout(go, 2200)
})

onUnload(() => {
  if (timer) clearTimeout(timer)
})
</script>

<style lang="scss" scoped>
.startup {
  display: flex;
  flex-direction: column;
  align-items: center;
  min-height: 100vh;
  padding: calc(var(--status-bar-height) + 120rpx) $gz-page-pad 80rpx;
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
  flex: 1;
  justify-content: center;
  padding: 0 20rpx;
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

.startup__hint {
  font-size: $gz-fs-caption;
  letter-spacing: 0.1em;
  color: $gz-ink-3;
  animation: gz-breathe 2.4s ease-in-out infinite;
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

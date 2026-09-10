<template>
  <view class="page" :class="skinClass">
    <view class="head">
      <text class="head__caption">CHOOSE YOUR PATH · 选择你的修行语言</text>
      <text class="head__title">你以什么方式，过这一日？</text>
      <text class="head__sub">一套底层逻辑，三套表达语言。之后可在「我 · 设置」中更换。</text>
    </view>

    <!-- 三模式卡片 -->
    <view class="modes">
      <view
        v-for="mode in MODES"
        :key="mode.id"
        class="mode"
        :class="[`mode--${mode.id}`, { 'is-chosen': chosen === mode.id }]"
        hover-class="gz-hover"
        @click="pick(mode.id)"
      >
        <image
          v-if="artOf(mode.id)"
          class="mode__art"
          :src="artOf(mode.id)"
          mode="aspectFill"
        />
        <!-- 无远程横幅图时的主题兜底饰带：保持卡片顶部视觉完整 -->
        <view v-else class="mode__art mode__art--fallback" />
        <view class="mode__top">
          <view class="mode__dot" :style="{ background: mode.accent }" />
          <text class="mode__name">{{ mode.label }}</text>
          <text class="mode__en">{{ mode.labelEn }}</text>
        </view>

        <view class="mode__tagline">
          <text>{{ mode.tagline }}</text>
        </view>

        <view class="mode__chips">
          <text class="chip">测评 · {{ mode.assessmentName }}</text>
          <text class="chip">成长 · {{ mode.growthName }}</text>
          <text class="chip">{{ mode.assistantName }}</text>
        </view>

        <view class="mode__radio">
          <view class="radio" :class="{ 'is-on': chosen === mode.id }" />
        </view>
      </view>
    </view>

    <!-- 行动 -->
    <view class="foot">
      <button class="cta" hover-class="gz-hover" @click="start">
        以此开始修行
      </button>
      <text class="foot__note">选定后先完成一次 6 题「{{ meta.assessmentName }}」建档，可随时跳过</text>
    </view>
  </view>
</template>

<script setup lang="ts">
/**
 * 模式选择页：首次引导第 2 步（第 1 步为启动箴言页）。
 * 选定后写入 mode store 并标记引导完成，随后进入「首次测评 · 6 题建档」（批次 C）。
 */
import { computed, ref } from 'vue'
import { DEFAULT_MODE_ID, MODES } from '@/config/modes'
import type { ModeId } from '@/config/modes'
import { getModeMeta } from '@/config/modes'
import { useModeStore } from '@/stores/mode'
import { useAppStore } from '@/stores/app'
import { applySkin } from '@/utils/skin'
import { ROUTES } from '@/router/routes'

const modeStore = useModeStore()
const appStore = useAppStore()

const chosen = ref<ModeId>(DEFAULT_MODE_ID)
/** 页面皮肤跟随点击的候选模式：点谁，整页立即变成谁的风格 */
const skinClass = computed(() => `gz-skin gz-skin--${chosen.value}`)
const meta = computed(() => getModeMeta(chosen.value))

/** 卡片横幅：优先后端下发，其次构建期静态配置，都没有则渲染主题兜底饰带 */
function artOf(target: ModeId): string | undefined {
  return modeStore.artOf(target)
}

function pick(id: ModeId): void {
  chosen.value = id
  // 边选边预览：立即把原生控件切到候选模式，反馈直接
  applySkin(id)
}

function start(): void {
  modeStore.setMode(chosen.value)
  appStore.finishOnboarding()
  // 选完模式立刻测评建档（批次 C）；测评页里也可跳过
  uni.navigateTo({ url: `${ROUTES.entryAssessment}?from=onboard` })
}
</script>

<style lang="scss" scoped>
.page {
  min-height: 100vh;
  padding: calc(var(--status-bar-height) + 48rpx) $gz-page-pad 70rpx;
  box-sizing: border-box;
}

.head__caption {
  display: block;
  font-size: $gz-fs-caption;
  letter-spacing: $gz-ls-wide;
  color: $gz-ink-3;
}

.head__title {
  display: block;
  margin-top: 18rpx;
  font-size: 46rpx;
  font-weight: 700;
  line-height: 1.4;
  color: $gz-ink;
}

.head__sub {
  display: block;
  margin-top: 14rpx;
  font-size: $gz-fs-small;
  line-height: 1.7;
  color: $gz-ink-2;
}

.modes {
  margin-top: 44rpx;
  display: flex;
  flex-direction: column;
  gap: 26rpx;
}

.mode {
  position: relative;
  padding: 36rpx 30rpx 32rpx;
  overflow: hidden;
  border: 2rpx solid var(--m-line);
  border-radius: $gz-radius-lg;
  transition: box-shadow 0.2s ease;
  background-color: var(--m-bg);
  color: var(--m-ink);
}

.mode.is-chosen {
  border-color: var(--m-accent);
  box-shadow: 0 0 0 1rpx var(--m-accent), 0 10rpx 34rpx var(--m-glow);
}

/* 三卡各自主题：固定色预览，不随整页皮肤串色 */
.mode--normal {
  --m-accent: #6D8B3F;
  --m-bg: #FCFAF4;
  --m-ink: #26231E;
  --m-ink2: #6B655B;
  --m-ink3: #9C9589;
  --m-line: rgba(38, 35, 30, 0.10);
  --m-chip-bg: rgba(109, 139, 63, 0.10);
  --m-chip-ink: #5E7A38;
  --m-glow: rgba(109, 139, 63, 0.16);
}

.mode--tech {
  --m-accent: #3FA9FF;
  --m-bg: #111926;
  --m-ink: #E6EDF5;
  --m-ink2: #9AA7B8;
  --m-ink3: #5F6E84;
  --m-line: rgba(63, 169, 255, 0.24);
  --m-chip-bg: rgba(63, 169, 255, 0.14);
  --m-chip-ink: #7CC4FF;
  --m-glow: rgba(63, 169, 255, 0.30);
  /* 暗夜 + 极淡电路网格 */
  background-image:
    linear-gradient(rgba(63, 169, 255, 0.05) 1rpx, transparent 1rpx),
    linear-gradient(90deg, rgba(63, 169, 255, 0.04) 1rpx, transparent 1rpx);
  background-size: 44rpx 44rpx;
}

.mode--dao {
  --m-accent: #A4471F;
  --m-bg: #F6F0DE;
  --m-ink: #2A251E;
  --m-ink2: #6E6759;
  --m-ink3: #A29A89;
  --m-line: rgba(42, 37, 30, 0.18);
  --m-chip-bg: rgba(164, 71, 31, 0.08);
  --m-chip-ink: #8C3E1E;
  --m-glow: rgba(164, 71, 31, 0.18);
}

/* 修仙卡顶部横幅（真 <image>，WXSS 不支持本地背景图） */
.mode__art {
  display: block;
  width: auto;
  height: 200rpx;
  margin: -36rpx -30rpx 22rpx;
  border-radius: calc(var(--gz-radius-lg) - 2rpx) calc(var(--gz-radius-lg) - 2rpx) 0 0;
}

/* 无远程横幅图时的三主题兜底饰带（复用 .mode__art 尺寸/出血，保持两态版式一致） */
.mode--normal .mode__art--fallback {
  background: linear-gradient(180deg, rgba(255, 255, 255, 0.16) 0%, rgba(255, 255, 255, 0) 40%),
    linear-gradient(125deg, #a9bb85 0%, #6d8b3f 46%, #46572c 100%);
}

.mode--tech .mode__art--fallback {
  background: linear-gradient(rgba(63, 169, 255, 0.09) 1rpx, transparent 1rpx),
    linear-gradient(90deg, rgba(63, 169, 255, 0.07) 1rpx, transparent 1rpx),
    linear-gradient(125deg, #2a4766 0%, #14202e 52%, #0b1117 100%);
  background-size: 44rpx 44rpx, 44rpx 44rpx, 100% 100%;
}

.mode--dao .mode__art--fallback {
  background: linear-gradient(125deg, rgba(255, 242, 220, 0.16) 0%, rgba(255, 242, 220, 0) 42%),
    linear-gradient(125deg, #b98a52 0%, #a4471f 40%, #6e2c12 72%, #431d0b 100%);
}

.mode__top {
  display: flex;
  align-items: baseline;
  gap: 16rpx;
}

.mode__dot {
  align-self: center;
  width: 14rpx;
  height: 14rpx;
  border-radius: 50%;
}

.mode__name {
  font-size: 38rpx;
  font-weight: 700;
  color: var(--m-accent);
}

.mode__en {
  font-size: $gz-fs-caption;
  letter-spacing: 0.2em;
  color: var(--m-ink3);
}

.mode__tagline {
  display: block;
  margin-top: 18rpx;
  padding-left: 20rpx;
  border-left: 4rpx solid var(--m-accent);
  border-radius: 2rpx;
  font-size: $gz-fs-body;
  line-height: 1.8;
  color: var(--m-ink2);
}

.mode__chips {
  margin-top: 22rpx;
  display: flex;
  flex-wrap: wrap;
  gap: 12rpx;
}

.chip {
  padding: 6rpx 18rpx;
  border-radius: 999rpx;
  background: var(--m-chip-bg);
  border: 1rpx solid var(--m-line);
  font-size: $gz-fs-caption;
  color: var(--m-chip-ink);
}

.mode__radio {
  position: absolute;
  top: 30rpx;
  right: 30rpx;
}

.radio {
  width: 32rpx;
  height: 32rpx;
  border: 2rpx solid var(--m-ink3);
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
}

.radio.is-on {
  border-color: var(--m-accent);
}

.radio.is-on::after {
  content: '';
  width: 16rpx;
  height: 16rpx;
  border-radius: 50%;
  background: var(--m-accent);
}

.foot {
  margin-top: 44rpx;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 20rpx;
}

.cta {
  width: 100%;
  padding: 28rpx 0;
  background: $gz-cta-bg;
  color: $gz-on-cta;
  font-size: $gz-fs-body;
  font-weight: 600;
  letter-spacing: 0.2em;
  text-align: center;
  border-radius: $gz-radius-md;
}

.foot__note {
  font-size: $gz-fs-caption;
  line-height: 1.7;
  text-align: center;
  color: $gz-ink-3;
}
</style>

<template>
  <view class="page" :class="skinClass" :style="pageStyle">
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
          <text class="chip">测评 · {{ bankOf(mode.id).title }}</text>
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
      <button class="cta gz-motion" hover-class="gz-hover" @click="start">
        {{ p('start.cta', chosen) }}
      </button>
      <text class="foot__note">
        选定后可做一次 {{ bankOf(chosen).questions.length }} 题「{{ bankOf(chosen).title }}」建档（{{ p('assess.cost', chosen) }}）；
        只想先逛逛，也可以直接跳过，之后在「我」里随时补上。
        配色、文案与图标会整套随所选语言变化，之后可在设置里随时换回。
      </text>
    </view>
  </view>
</template>

<script setup lang="ts">
/**
 * 模式选择页：首次引导第 2 步（第 1 步为启动箴言页）。
 * 选定后写入 mode store 并标记引导完成，随后进入「首次测评 · 8 题建档」（批次 C）。
 */
import { computed, ref } from 'vue'
import { DEFAULT_MODE_ID, MODES } from '@/config/modes'
import type { ModeId } from '@/config/modes'
import type { PhraseKey } from '@/config/phrases'
import { useModeStore } from '@/stores/mode'
import { useAppStore } from '@/stores/app'
import { useContentStore } from '@/stores/content'
import { applySkin } from '@/utils/skin'
import { safeTopPx } from '@/utils/safeArea'
import { ROUTES } from '@/router/routes'

const modeStore = useModeStore()
const appStore = useAppStore()
const contentStore = useContentStore()

/** 题库（测评名与题数都取它；远端可改，故 chip 与说明文案会随之变化） */
function bankOf(id: ModeId) {
  return contentStore.bankOf(id)
}

/** 主题化取词：主按钮随所选模式换说法（就从今天开始 / 初始化并开始 / 择日不如就今日） */
function p(key: PhraseKey, mode: ModeId): string {
  return contentStore.phraseOf(key, mode)
}

const chosen = ref<ModeId>(DEFAULT_MODE_ID)
/** 页面皮肤跟随点击的候选模式：点谁，整页立即变成谁的风格 */
const skinClass = computed(() => `gz-skin gz-skin--${chosen.value}`)

/** 页首顶距：状态栏真值 + 48rpx（原 `calc(var(--status-bar-height) + 48rpx)`，见 utils/safeArea.ts） */
const pageStyle = { paddingTop: `${safeTopPx(48)}px` }

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
@import './mode-select.scss';
</style>

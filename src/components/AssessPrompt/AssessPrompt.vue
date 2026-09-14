<template>
  <view v-if="visible" class="prompt">
    <view class="prompt__body">
      <text class="prompt__title">{{ $p('prompt.title') }}</text>
      <text class="prompt__note">{{ $p('prompt.note') }}</text>
    </view>
    <view class="prompt__acts">
      <view class="prompt__cta" hover-class="gz-hover" @click="go">{{ $p('prompt.cta') }}</view>
      <view class="prompt__later" hover-class="gz-hover" @click="later">{{ $p('prompt.later') }}</view>
    </view>
  </view>
</template>

<script setup lang="ts">
/**
 * 未建档提醒条（挂在观大厅顶部）。
 *
 * 设计取舍：
 *  · **不是弹窗**，是一条可忽略的横幅 —— 不打断正在做的事；
 *  · **跳过当天不出现**（那一刻已经解释过一遍），隔 2 天才温和出现；
 *  · 点「稍后再说」静默 3 天 —— 最坏强度也只是"每三天提醒一次"，不构成骚扰；
 *  · **建档后自动消失**（store 里该模式有结果即不显示）；
 *  · 全程不锁任何功能，只是把"少了一件事"摆在那里。
 *
 * 判定逻辑全在 stores/assessment.ts 的 shouldPrompt()，便于以后统一调松紧。
 */
import { computed, ref } from 'vue'
import { onShow } from '@dcloudio/uni-app'
import { useAssessmentStore } from '@/stores/assessment'
import { useModeStore } from '@/stores/mode'
import { ROUTES } from '@/router/routes'

const assessment = useAssessmentStore()
const modeStore = useModeStore()

/**
 * shouldPrompt 里有「距跳过是否满 2 天」这类**基于时间**的判断，
 * 而时间不会触发响应式 —— 每次 onShow 手动 tick 一次重新判定。
 */
const tick = ref(0)
const visible = computed(() => {
  void tick.value
  return assessment.shouldPrompt(modeStore.id)
})

onShow(() => {
  tick.value += 1
})

function go(): void {
  uni.navigateTo({ url: ROUTES.entryAssessment })
}

function later(): void {
  assessment.snoozePrompt()
  tick.value += 1
}
</script>

<style lang="scss" scoped>
.prompt {
  margin-bottom: 22rpx;
  padding: 24rpx 26rpx;
  border: 1rpx solid $gz-line;
  border-radius: $gz-radius-md;
  background: $gz-surface;
}

.prompt__body {
  display: flex;
  flex-direction: column;
}

.prompt__title {
  font-size: $gz-fs-body;
  font-weight: 700;
  color: $gz-ink;
}

.prompt__note {
  margin-top: 10rpx;
  font-size: $gz-fs-caption;
  line-height: 1.7;
  color: $gz-ink-2;
}

.prompt__acts {
  margin-top: 22rpx;
  display: flex;
  align-items: center;
  gap: 20rpx;
}

.prompt__cta {
  padding: 14rpx 34rpx;
  border-radius: $gz-radius-md;
  background: $gz-accent;
  color: $gz-on-cta;
  font-size: $gz-fs-small;
  font-weight: 600;
}

.prompt__later {
  padding: 14rpx 22rpx;
  border-radius: $gz-radius-md;
  font-size: $gz-fs-caption;
  color: $gz-ink-3;
}
</style>

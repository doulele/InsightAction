<template>
  <view
    class="step"
    :class="{ 'is-done': item.done, 'is-overdue': item.overdue && !item.done }"
    hover-class="gz-hover"
    @click="onTap"
  >
    <view class="step__check" :class="{ 'is-on': item.done }">
      <text v-if="item.done" class="step__tick">✓</text>
    </view>

    <view class="step__body">
      <view class="step__head">
        <text class="step__title" :class="{ 'is-done': item.done }">{{ item.title }}</text>
        <text v-if="item.challenge" class="step__tag">{{ challengeText }}</text>
      </view>
      <view class="step__meta">
        <text v-if="item.kind === 'node'" class="step__from">{{ item.planTitle }}</text>
        <text v-if="item.overdue && !item.done" class="step__shelf">{{ shelfText }}</text>
      </view>
      <!-- 调用方追加的动作区（如待办池的「排到今天 / 不做」） -->
      <view v-if="$slots.default" class="step__acts" @click.stop>
        <slot />
      </view>
    </view>
  </view>
</template>

<script setup lang="ts">
/**
 * PlanStep —— 一条「步子」行（今天要走的步子 / 待办池 / 计划详情共用）。
 * 只做展示 + 一个勾选事件；逾期提示与挑战小印都按当前模式取词（config/lexicon.planWords）。
 *
 * 样式外置在 PlanStep.scss（超过 100 行，按项目约定拆出）。
 */
import { computed } from 'vue'
import type { StepItem } from '@/stores/plan'
import { CHALLENGE_LABEL, planWords } from '@/config/lexicon'
import { useModeStore } from '@/stores/mode'

const props = defineProps<{ item: StepItem }>()
const emit = defineEmits<{ (e: 'toggle', item: StepItem): void }>()

const mode = useModeStore()
const w = computed(() => planWords(mode.id))
const shelfText = computed(() => w.value.shelf(props.item.shelfDays))
const challengeText = computed(() => (props.item.challenge ? CHALLENGE_LABEL[props.item.challenge] : ''))

function onTap(): void {
  emit('toggle', props.item)
}
</script>

<style lang="scss" scoped>
@import './PlanStep.scss';
</style>

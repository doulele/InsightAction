<template>
  <view v-if="show" class="overlay" @touchmove.stop.prevent @click="skip">
    <view class="sheet" @click.stop>
      <text class="sheet__title">收束「{{ plan?.title || '' }}」</text>
      <text class="sheet__q">{{ question }}</text>
      <textarea
        v-model="text"
        class="sheet__ta"
        :maxlength="120"
        placeholder="一句就够（可留空）"
        placeholder-class="sheet__ph"
      />
      <text class="sheet__hint">
        写下的这句会进【知】的知识库（Lv.2 重构）；不想写就跳过，收束与 20 点修为照给。
      </text>
      <view class="sheet__row">
        <view class="btn btn--ghost" hover-class="gz-hover" @click="skip">跳过</view>
        <view class="btn" hover-class="gz-hover" @click="confirm">收束</view>
      </view>
    </view>
  </view>
</template>

<script setup lang="ts">
/**
 * PlanReflect —— 计划收束时的「回望」浮层。
 *
 * 为什么要有这一步：规格 §4.4 要求三类挑战「完成后必须产出」——
 * 戒断要一句「最难的是哪天」，尝试要一句「和我想的不一样在哪」，认知要回写原判断。
 * 这三句是「行 → 知」的闭环，也是这条计划唯一值得留下的东西。
 *
 * 但**不强制**（2026-09-15 定案）：能给就给，写不出来也能收束，只是少一张卡。
 * 样式外置在 PlanReflect.scss（超过 100 行，按项目约定拆出）。
 */
import { computed, ref, watch } from 'vue'
import type { Plan } from '@/stores/plan'
import { CHALLENGE_REFLECT, PLAN_REFLECT_DEFAULT } from '@/config/lexicon'

const props = defineProps<{ show: boolean; plan: Plan | null }>()
const emit = defineEmits<{ (e: 'confirm', text: string): void; (e: 'skip'): void }>()

const text = ref('')

watch(
  () => props.show,
  (v) => {
    if (v) text.value = ''
  },
)

const question = computed(() =>
  props.plan?.challenge ? CHALLENGE_REFLECT[props.plan.challenge] : PLAN_REFLECT_DEFAULT,
)

function confirm(): void {
  emit('confirm', text.value)
}

function skip(): void {
  emit('skip')
}
</script>

<style lang="scss" scoped>
@import './PlanReflect.scss';
</style>

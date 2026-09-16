<template>
  <view v-if="show" class="overlay" @touchmove.stop.prevent @click="close">
    <view class="sheet" @click.stop>
      <text class="sheet__title">这件事因何而起</text>
      <text class="sheet__q">
        把它挂回一条理 / 一张卡片 / 一次冲动 —— 做完之后，周报会把这条路讲出来。
      </text>

      <view class="list">
        <view
          v-for="o in options"
          :key="o.ref"
          class="opt"
          :class="{ 'is-on': o.ref === current }"
          hover-class="gz-hover"
          @click="pick(o)"
        >
          <text class="opt__kind">{{ REF_KIND_LABEL[o.kind] }}</text>
          <view class="opt__main">
            <text class="opt__text">{{ o.text }}</text>
            <text class="opt__sub">{{ o.sub }}</text>
          </view>
          <text v-if="o.ref === current" class="opt__tick">✓</text>
        </view>
        <text v-if="!options.length" class="empty">
          还没有可挂的东西 —— 先去【观】立一条理，或记一次冲动。
        </text>
      </view>

      <view class="sheet__row">
        <view class="btn btn--ghost" hover-class="gz-hover" @click="pickNone">无出处</view>
        <view class="btn" hover-class="gz-hover" @click="close">好了</view>
      </view>
    </view>
  </view>
</template>

<script setup lang="ts">
/**
 * TodoSource —— 三件事的「关联来源」浮层（规格 §4.4 回应式行动）。
 *
 * 三件事不再是凭空的待办清单，而是从观/知里回应出来的：
 * 每条都可以回指一条理、一张卡片或一次冲动记录。
 *
 * 为什么允许「无出处」而不是强制：多数人今天要做的事确实没有出处，
 * 强行要求关联会让这一步变成填写负担，最后要么乱挂要么放弃。
 * 诚实标一句「无出处」，比挂错一条理更有价值 —— 它至少不污染脊椎的 ref。
 */
import { computed } from 'vue'
import { REF_KIND_LABEL, refOptions, type RefOption } from '@/utils/refSource'

const props = defineProps<{ show: boolean; current?: string }>()
const emit = defineEmits<{ (e: 'pick', o: RefOption | null): void; (e: 'close'): void }>()

const options = computed<RefOption[]>(() => refOptions())

function pick(o: RefOption): void {
  emit('pick', o)
}

function pickNone(): void {
  emit('pick', null)
}

function close(): void {
  emit('close')
}
</script>

<style lang="scss" scoped>
@import './TodoSource.scss';
</style>

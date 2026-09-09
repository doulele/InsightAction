<template>
  <view class="seal" :class="{ 'is-large': size >= 120 }">
    <text class="seal__text">{{ text }}</text>
  </view>
</template>

<script setup lang="ts">
/**
 * 品牌印章：以「观」字为核心的极简视觉徽标。
 * 通过 CSS 描绘方章轮廓，不依赖任何图片资源。
 */
withDefaults(
  defineProps<{
    /** 印章内字（默认取品牌首字） */
    text?: string
    /** 尺寸 rpx（默认 96） */
    size?: number
  }>(),
  { text: '观', size: 96 },
)
</script>

<style lang="scss" scoped>
.seal {
  position: relative;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 96rpx;
  height: 96rpx;
  border: 3rpx solid $gz-brand;
  border-radius: 10rpx;
  opacity: 0.95;

  /* 内层细线，增强"印章"层次 */
  &::after {
    content: '';
    position: absolute;
    inset: 8rpx;
    border: 1rpx solid rgba(164, 71, 31, 0.35);
    border-radius: 6rpx;
    pointer-events: none;
  }

  &.is-large {
    width: 128rpx;
    height: 128rpx;
    border-width: 4rpx;

    &::after {
      inset: 11rpx;
    }
  }
}

.seal__text {
  color: $gz-brand;
  font-size: 52rpx;
  font-weight: 600;
  line-height: 1;
}
</style>

<template>
  <view v-if="show" class="gd-mask" :style="{ zIndex }" @touchmove.stop.prevent @click="onMaskTap">
    <view class="gd__holder">
      <!-- 皮肤类挂面板：随当前模式 / 目标模式整套换 CSS 变量（accent/surface/圆角…） -->
      <view
        class="gd"
        :class="[skinClass, { 'is-danger': variant === 'danger' }]"
        @click.stop
      >
        <image v-if="art && variant !== 'danger'" class="gd__art" :src="art" mode="aspectFill" />
        <view v-else-if="variant !== 'danger'" class="gd__art gd__art--fallback" />
        <view class="gd__body">
          <text v-if="title" class="gd__title">{{ title }}</text>
          <text v-if="subtitle" class="gd__sub">{{ subtitle }}</text>
          <!-- 优先自定义插槽；未提供则按 props 文案渲染 -->
          <view v-if="$slots.default" class="gd__slot">
            <slot />
          </view>
          <template v-else>
            <text v-if="content" class="gd__content">{{ content }}</text>
            <view v-if="note" class="gd__note">{{ note }}</view>
          </template>
        </view>
        <view class="gd__acts">
          <view
            v-if="showCancel"
            class="gd__btn is-ghost"
            hover-class="gz-hover"
            @click="close(false)"
          >
            {{ cancelText }}
          </view>
          <view class="gd__btn is-main" hover-class="gz-hover" @click="onConfirm">
            {{ confirmText }}
          </view>
        </view>
      </view>
    </view>
  </view>
</template>

<script setup lang="ts">
/**
 * GzDialog —— 通用主题弹框
 * =====================================
 * 三模式共用一个组件：面板把 `gz-skin gz-skin--<mode>` 挂在自身，
 * 因此主色 / 纸底 / 文字 / 圆角等整套随「当前模式」或传入的「目标模式」(skin) 变化；
 * 覆盖各处原生 uni.showModal，保证任意确认场景都跟随皮肤。
 *
 * 用法（easycom 自动注册，无需 import）：
 *   <GzDialog
 *     v-model:show="open"
 *     :skin="pendingMode ?? modeStore.id"   // 预览目标模式皮肤时可传
 *     variant="danger"                        // danger：主按钮/提示块转语义红
 *     title="重置今日三件事"
 *     content="……"
 *     note="……"
 *     cancel-text="再想想"
 *     confirm-text="重置"
 *     @confirm="onConfirm"
 *   />
 *   @confirm：点主按钮触发（由调用方执行动作并自行关闭）
 *   @cancel / 遮罩点击 / @update:show=false：取消路径
 */
import { computed } from 'vue'
import { useModeStore } from '@/stores/mode'
import type { ModeId } from '@/config/modes'

interface Props {
  /** 是否显示（受控） */
  show: boolean
  /** 皮肤跟随：缺省 = 当前模式；传目标模式可预览切换后的主题 */
  skin?: ModeId
  /** 语义变体：danger 用于破坏性操作（删除/重置），确认键固定语义红 */
  variant?: 'default' | 'danger'
  /** 顶部横幅图（danger 变体自动忽略） */
  art?: string
  title?: string
  /** 标题下小标 */
  subtitle?: string
  /** 正文（未提供默认插槽时生效） */
  content?: string
  /** 正文下的强调块（浅主色底） */
  note?: string
  cancelText?: string
  confirmText?: string
  showCancel?: boolean
  /** 点遮罩 = 取消 */
  maskClosable?: boolean
  zIndex?: number
}

const props = withDefaults(defineProps<Props>(), {
  variant: 'default',
  cancelText: '取消',
  confirmText: '确认',
  showCancel: true,
  maskClosable: true,
  zIndex: 300,
})

const emit = defineEmits<{
  (e: 'update:show', v: boolean): void
  (e: 'confirm'): void
  (e: 'cancel'): void
}>()

const modeStore = useModeStore()
const skinClass = computed(() => `gz-skin gz-skin--${props.skin ?? modeStore.id}`)

function close(isMask: boolean): void {
  if (isMask && !props.maskClosable) return
  emit('update:show', false)
  emit('cancel')
}

function onMaskTap(): void {
  close(true)
}

function onConfirm(): void {
  emit('confirm')
}
</script>

<style lang="scss" scoped>
.gd-mask {
  position: fixed;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 0 56rpx;
  background: rgba(0, 0, 0, 0.48);
  animation: gdFade 0.18s ease both;
}

.gd__holder {
  width: 100%;
}

.gd {
  overflow: hidden;
  background: $gz-surface;
  border: 1rpx solid $gz-line;
  border-radius: $gz-radius-lg;
  box-shadow: 0 24rpx 80rpx rgba(0, 0, 0, 0.28);
  animation: gdPop 0.2s ease both;
}

.gd__art {
  display: block;
  width: 100%;
  height: 240rpx;
}

/* 无远程横幅图时的主题兜底饰带（跟随当前/目标皮肤，danger 变体不渲染） */
.gz-skin--normal .gd__art--fallback {
  background: linear-gradient(180deg, rgba(255, 255, 255, 0.16) 0%, rgba(255, 255, 255, 0) 40%),
    linear-gradient(125deg, #a9bb85 0%, #6d8b3f 46%, #46572c 100%);
}

.gz-skin--tech .gd__art--fallback {
  background: linear-gradient(rgba(63, 169, 255, 0.09) 1rpx, transparent 1rpx),
    linear-gradient(90deg, rgba(63, 169, 255, 0.07) 1rpx, transparent 1rpx),
    linear-gradient(125deg, #2a4766 0%, #14202e 52%, #0b1117 100%);
  background-size: 44rpx 44rpx, 44rpx 44rpx, 100% 100%;
}

.gz-skin--dao .gd__art--fallback {
  background: linear-gradient(125deg, rgba(255, 242, 220, 0.16) 0%, rgba(255, 242, 220, 0) 42%),
    linear-gradient(125deg, #b98a52 0%, #a4471f 40%, #6e2c12 72%, #431d0b 100%);
}

.gd__body {
  padding: 32rpx 30rpx 4rpx;
}

.gd__title {
  display: block;
  font-size: 40rpx;
  font-weight: 800;
  letter-spacing: 0.04em;
  color: $gz-ink;
}

.gd__sub {
  display: block;
  margin-top: 10rpx;
  font-size: $gz-fs-caption;
  line-height: 1.6;
  color: $gz-ink-3;
}

.gd__content {
  display: block;
  margin-top: 16rpx;
  font-size: $gz-fs-small;
  line-height: 1.8;
  color: $gz-ink-2;
}

.gd__slot {
  margin-top: 16rpx;
}

.gd__note {
  margin-top: 22rpx;
  padding: 18rpx 22rpx;
  border-radius: $gz-radius-sm;
  background: $gz-accent-soft;
  font-size: $gz-fs-caption;
  line-height: 1.7;
  color: $gz-ink-2;
}

.gd__acts {
  display: flex;
  gap: 18rpx;
  padding: 28rpx 30rpx calc(32rpx + env(safe-area-inset-bottom) / 2);
}

.gd__btn {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  height: 84rpx;
  border-radius: $gz-radius-md;
  font-size: $gz-fs-body;
  font-weight: 600;
  letter-spacing: 0.04em;
}

.gd__btn.is-ghost {
  background: transparent;
  border: 1rpx solid $gz-line;
  color: $gz-ink-2;
}

.gd__btn.is-main {
  background: $gz-accent;
  color: $gz-on-cta;
}

/* danger：破坏性操作用固定语义红（不随皮肤，避免「普通红=丑」歧义） */
.gd.is-danger .gd__btn.is-main {
  background: #b5482c;
}

.gd.is-danger .gd__note {
  background: rgba(181, 72, 44, 0.1);
  color: #b5482c;
}

@keyframes gdFade {
  from {
    opacity: 0;
  }
  to {
    opacity: 1;
  }
}

@keyframes gdPop {
  from {
    opacity: 0;
    transform: scale(0.94) translateY(10rpx);
  }
  to {
    opacity: 1;
    transform: scale(1) translateY(0);
  }
}
</style>

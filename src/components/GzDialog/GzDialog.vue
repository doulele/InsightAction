<template>
  <view v-if="show" class="gd-mask" :style="{ zIndex }" @touchmove.stop.prevent @click="onMaskTap">
    <view class="gd__holder">
      <!-- 皮肤类挂面板：随当前模式 / 目标模式整套换 CSS 变量（accent/surface/圆角…） -->
      <view
        class="gd"
        :class="[skinClass, { 'is-danger': variant === 'danger' }]"
        @click.stop
      >
        <image v-if="banner && art && variant !== 'danger'" class="gd__art" :src="art" mode="aspectFill" />
        <view v-else-if="banner && variant !== 'danger'" class="gd__art gd__art--fallback" />
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
  /**
   * 是否显示顶部装饰横幅（远程横幅图 / 主题兜底饰带）。
   * 信息说明类弹框建议关掉：省下 240rpx，面板更紧凑，不会显得"占满屏幕"。
   */
  banner?: boolean
  zIndex?: number
}

const props = withDefaults(defineProps<Props>(), {
  variant: 'default',
  cancelText: '取消',
  confirmText: '确认',
  showCancel: true,
  maskClosable: true,
  banner: true,
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
@import './GzDialog.scss';
</style>

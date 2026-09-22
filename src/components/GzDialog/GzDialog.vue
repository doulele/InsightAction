<template>
  <view v-if="show" class="gd-mask" :style="{ zIndex }" @touchmove.stop.prevent @click="onMaskTap">
    <view class="gd__holder">
      <!-- 皮肤类挂面板：随当前模式 / 目标模式整套换 CSS 变量（accent/surface/圆角…） -->
      <view
        class="gd"
        :class="[skinClass, { 'is-danger': variant === 'danger' }]"
        @click.stop
      >
        <image
          v-if="banner && artSrc && variant !== 'danger'"
          class="gd__art"
          :src="artSrc"
          mode="aspectFill"
          @error="onArtError"
        />
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
 *
 * 横幅图（art）**不用每个调用方都传**：缺省自动取当前模式的主题图；
 * 只有换肤确认这类「要预览另一个模式」的场景才显式传目标模式的图。
 */
import { computed } from 'vue'
import { useModeStore } from '@/stores/mode'
import { useImageStore } from '@/stores/images'
import type { ModeId } from '@/config/modes'

interface Props {
  /** 是否显示（受控） */
  show: boolean
  /** 皮肤跟随：缺省 = 当前模式；传目标模式可预览切换后的主题 */
  skin?: ModeId
  /** 语义变体：danger 用于破坏性操作（删除/重置），确认键固定语义红 */
  variant?: 'default' | 'danger'
  /**
   * 顶部横幅图。**缺省 = 当前模式的主题横幅**（组件自己去 modeStore 取）；
   * 只有「预览切换后的模式」才需要显式传目标模式的图（见 settings / me 的换肤确认）。
   * danger 变体自动忽略。
   */
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

/**
 * 横幅图源：显式传入的优先，**没传就用当前模式的图**。
 *
 * 为什么要有这层兜底：横幅图必须走 `modeStore.art`（后端 /skins 下发 + 本地缓存，
 * 见 HallHead 的同款注释），早先每个调用方各自传一遍，漏传就静默退回渐变饰带 ——
 * 表现是「这个弹框看起来没加载出主题图」，而代码不报错、极难被发现
 * （2026-09-21 设置页「开启云备份」与盲盒「换一只」两处即如此）。
 * 兜底后调用方只在「预览别的模式」时才需要传 art，其余一律自动跟随当前模式。
 */
const artSrc = computed(() => props.art ?? modeStore.art)

/**
 * 横幅读不出来（本地缓存被系统清掉 / 开发者工具里本地文件失效）→ 作废这条缓存。
 * 作废后 `artSrc` 自动回落到**远端地址**（弹框照常出图），且缓存层自带 5 分钟冷却，
 * 不会「报错 → 重下 → 再报错」打转。与 HallHead 同一套自愈
 * （2026-09-16 立的口径：凡是渲染本地图的 `<image>` 都要有 @error 自愈）。
 */
function onArtError(): void {
  useImageStore().invalidate(modeStore.remoteArtOf(props.skin ?? modeStore.id))
}

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

<template>
  <!--
    子页顶栏（39 个子页共用）。
    为什么要有它：2026-09-22 前，这 4 行标记 + 4 条样式在 39 个页面里各抄了一份，
    而且抄漏了 7 个页面（echo / interrupt / proverbs / bond / capsule / wishes / body）
    的 `--status-bar-height` 顶距 —— 那 7 页的返回键会顶到状态栏 / 胶囊按钮上。
    现在顶距归组件，抄漏这事结构上就不可能再发生。

    标题走**默认插槽**而不是 prop：年度回顾那页的标题是 `{{ year }} 年度回顾`，
    插槽能原样搬过来，不必为它发明一个计算属性。带副标题的两页用 `subtitle`。

    返回：
      · 传 `fallback`（tab 页路由常量）→ 组件自己处理（栈里只有这一页时 switchTab 回大厅，
        与原先各页手写的逻辑逐字等价）；
      · 不传 `fallback` 且监听 `@back` → 由页面自己处理（茶室要确认、沙漏要二次确认、分享页
        要按来源决定回哪、图谱只需 navigateBack）。
    两者都没有时只做 navigateBack。

    右侧动作：`#right` 插槽只能放**图标 / 文字本身**（如 `＋`、「改」），
    外层的可点盒子由组件提供 —— 插槽内容算父页面的节点，拿不到组件作用域的
    `.nav__side` 尺寸，交给页面自己写会两处不一致。

    2026-09-22 修：**右侧动作原来完全被微信胶囊盖住**（收件匣 / 理库的「＋」、
    详情的「分享」、计划详情的「改」四个都点不到 —— 系统里看着像"没做这个功能"）。
    原因是这 4 个动作盒贴着屏幕右缘，而胶囊也贴着右缘且**画在应用层之上**。
    现在按胶囊的真实位置让位，动作落到胶囊左边（见 script 里 rightStyle 的说明）。

    2026-09-22 修（二）：**顶距不再用 CSS 变量定量**。
    `--status-bar-height` 在微信小程序端被 uni-app 写死成 25px（构建产物 app.wxss
    里就是 `page{--status-bar-height:25px}`），而 iPhone 全面屏真实状态栏是 44 / 47 / 59px
    —— 顶距不够，返回键整个落进状态栏、压在胶囊按钮上（用户报"返回按钮飘走"）。
    现在真实值由 `utils/safeArea.ts` 从 `getSystemInfoSync().statusBarHeight` 取，
    经内联 CSS 变量 `--nav-top` 同时喂给 `.nav` 的 padding-top 与标题的绝对定位 top
    （两处必须是同一个值，否则标题与返回键会错行）。
  -->
  <view class="nav" :class="skinClass" :style="navVars">
    <view class="nav__side" hover-class="gz-hover" @click="onBack">
      <text class="nav__back">‹</text>
    </view>

    <!-- 两行版（标题 + 副标题）：记一笔 / 一条详情 -->
    <view v-if="subtitle" class="nav__mid">
      <text class="nav__title"><slot /></text>
      <text class="nav__sub">{{ subtitle }}</text>
    </view>
    <text v-else class="nav__title"><slot /></text>

    <!-- 右边距按胶囊位置算（让到胶囊左侧），见 script 的 rightStyle -->
    <view
      v-if="hasRight"
      class="nav__side nav__side--right"
      :style="rightStyle"
      hover-class="gz-hover"
      @click="emit('right')"
    >
      <slot name="right" />
    </view>
    <view v-else class="nav__side" />
  </view>
</template>

<script setup lang="ts">
import { computed, useSlots } from 'vue'
import { useSkinClass } from '@/composables/useSkin'
import { capsuleInsetPx, safeTopPx } from '@/utils/safeArea'
import type { RoutePath } from '@/router/routes'

const props = defineProps<{
  /**
   * 栈里只有这一页时退回哪个 tab（`ROUTES.tabObserve` 等）。
   * 给了它就由组件负责返回；不给则由页面监听 `@back` 自己处理。
   */
  fallback?: RoutePath
  /** 标题下的第二行（可选）。给了就用两行版：标题左对齐、副标题更轻一档 */
  subtitle?: string
}>()

const emit = defineEmits<{ (e: 'back'): void; (e: 'right'): void }>()

const slots = useSlots()
const hasRight = computed(() => !!slots.right)

/** 皮肤类挂在组件**自己**的根节点上：组件 wxss 选不中组件外的祖先类（见 HallHead 的说明） */
const skinClass = useSkinClass()

/**
 * 顶距（24rpx = 原先各页「.page 顶距 16rpx + .nav 顶距 8rpx」的合计）。
 * 走内联 CSS 变量而不是 scss 里的 `calc(var(--status-bar-height) + 24rpx)`：
 * 那个变量在小程序端固定 25px，刘海屏不够（详见 utils/safeArea.ts）。
 * 内联优先级最高 —— `.nav` 的 padding-top 与标题绝对定位的 top 都读它。
 */
const navVars = `--nav-top:${safeTopPx(24)}px`

/**
 * 右侧动作盒的右边距 —— 让开微信右上角那个胶囊（2026-09-22）。
 *
 * 算法与"为什么不能写死 rpx"见 `utils/safeArea.ts` 的 `capsuleInsetPx()`：
 * 胶囊物理尺寸固定、rpx 随屏宽缩放，写死 rpx 在小屏让不够、大屏让过头。
 * 取不到胶囊信息时（H5 等非微信端）它为 0 —— 那端本来也没有胶囊。
 *
 * 只在有 `#right` 时生效（空的占位盒没有视觉，不必让）。
 */
const rightStyle = { marginRight: `${capsuleInsetPx()}px` }

function onBack(): void {
  if (!props.fallback) {
    emit('back')
    return
  }
  /* 从分享卡片等入口直接进来时栈里只有这一页：退回大厅，而不是卡在子页里 */
  const pages = getCurrentPages()
  if (pages.length > 1) {
    uni.navigateBack()
  } else {
    uni.switchTab({ url: props.fallback })
  }
}
</script>

<style lang="scss" scoped>
@import './SubNav.scss';
</style>

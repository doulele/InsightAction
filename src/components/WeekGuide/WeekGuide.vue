<template>
  <view v-if="show" class="wguide" hover-class="gz-hover" @click="go">
    <view class="wguide__head">
      <text class="wguide__badge">第 {{ plan!.day }} / 7 天 · 今天的主角「{{ plan!.mark }}」</text>
      <text class="wguide__go">去 ›</text>
    </view>
    <view class="wguide__body">
      <text class="wguide__title">{{ plan!.title }}</text>
      <text class="wguide__todo">{{ plan!.todo }}</text>
    </view>
  </view>
</template>

<script setup lang="ts">
/**
 * 第一周解锁引导（规格 §7.3）：一天只在一个大厅挂一条「今天的主角」任务。
 * 由每个大厅传入自己的 hall，组件只在「今日主角 == 本大厅」时显示，
 * 其余大厅完全不出现 —— 避免七个大厅同时刷引导的骚扰感。
 * 七天后（weekDayIndex 返回 0）整套自动消失，连渲染都不发生。
 */
import { computed } from 'vue'
import { useAppStore } from '@/stores/app'
import { todayPlan, type GuideHall } from '@/config/unlock'
import { todayKey } from '@/stores/daily'
import { navigateTo, ROUTES, type RoutePath } from '@/router/routes'

const props = defineProps<{ for: GuideHall }>()

const app = useAppStore()
const plan = computed(() => todayPlan(app.firstLaunchAt, todayKey()))
const show = computed(() => plan.value != null && plan.value.hall === props.for)

/** 主角大厅 → 所属 tab 页（防御用：正常不该走到，卡片本来就只挂在主角大厅页里） */
const HALL_ROUTE: Record<GuideHall, RoutePath> = {
  observe: ROUTES.tabObserve,
  action: ROUTES.tabAction,
  pause: ROUTES.tabPause,
  reflect: ROUTES.tabReflect,
  me: ROUTES.tabMe,
}

/** 当前页面路径（形如 '/pages/observe/index'） */
function currentPath(): string {
  const pages = getCurrentPages()
  const top = pages[pages.length - 1] as unknown as { route?: string } | undefined
  return top?.route ? `/${top.route}` : ''
}

/**
 * 点「去」= 把今天要做的那件事送到眼前，而不是只喊一声「去」。
 *
 * 早先的实现只 switchTab 到主角大厅 —— 但卡片本来就只渲染在主角大厅页里，
 * 于是这个按钮对用户等于「点了没反应」（2026-09-16 反馈）。
 * 现在按任务落点分三种走法：跨页任务直接开目标页；页内任务滚到锚点；
 * 锚点找不到时给一句话，不静默失败。
 */
function go(): void {
  const p = plan.value
  if (!p) return

  // 1) 任务在别的页面（冲动记录 / 理库 / 修行看板 / 行动周报）
  if (p.route) {
    navigateTo(p.route)
    return
  }

  // 2) 防御：万一卡片被挂到了非主角大厅页，先把人送到主角大厅
  const target = HALL_ROUTE[p.hall]
  if (currentPath() !== target) {
    navigateTo(target)
    return
  }

  // 3) 就地滚到当天的任务区块
  if (!p.anchor) return
  uni.pageScrollTo({
    selector: p.anchor,
    duration: 300,
    fail: () => {
      uni.showToast({ title: '往下翻一点，就在下面', icon: 'none' })
    },
  })
}
</script>

<style lang="scss" scoped>
@import './WeekGuide.scss';
</style>

<template>
  <view class="page" :class="skinClass">
    <!-- 顶栏 -->
    <view class="nav">
      <view class="nav__side" hover-class="gz-hover" @click="goBack">
        <text class="nav__back">‹</text>
      </view>
      <text class="nav__title">痕迹时间轴</text>
      <view class="nav__side" />
    </view>

    <!-- 汇总 -->
    <view class="head">
      <text class="head__range">全部留痕 · 共 {{ total }} 条 / {{ daysN }} 天</text>
      <view class="stats">
        <view class="stat">
          <text class="stat__n">{{ n.todo }}</text>
          <text class="stat__cap">完成三件事</text>
        </view>
        <view class="stat">
          <text class="stat__n">{{ n.habit }}</text>
          <text class="stat__cap">习惯打卡</text>
        </view>
        <view class="stat">
          <text class="stat__n">{{ n.box }}</text>
          <text class="stat__cap">盲盒动作</text>
        </view>
      </view>
    </view>

    <!-- 时间轴 -->
    <view v-if="!groups.length" class="empty">
      <view class="empty__seal gz-motion">痕</view>
      <text class="empty__title">{{ $p('empty.timeline.title') }}</text>
      <text class="empty__desc">{{ $p('empty.timeline.desc') }}</text>
    </view>

    <view v-else class="axis">
      <view v-for="(g, gi) in groups" :key="g.key" class="group">
        <view class="group__head">
          <text class="group__label">{{ g.label }}</text>
          <text class="group__count">{{ g.items.length }} 条</text>
        </view>
        <view v-if="gi < groups.length - 1" class="group__line" />
        <view class="group__list">
          <view v-for="(t, ti) in g.items" :key="`${g.key}-${ti}`" class="item">
            <view class="item__rail">
              <view class="item__dot" :class="`is-${t.hall}`" />
            </view>
            <view class="item__body">
              <text class="item__text">{{ t.text }}</text>
              <view class="item__meta">
                <text class="item__type">{{ labelOf(t.kind) }}</text>
                <text class="item__time">{{ t.time }}</text>
              </view>
            </view>
          </view>
        </view>
      </view>
    </view>

    <view class="foot">
      <text class="foot__text">痕迹不是奖杯 · 是活过的证据</text>
    </view>
  </view>
</template>

<script setup lang="ts">
/**
 * 痕迹时间轴（批次 C · 我）· 分包 subpkg-me。
 * 与行厅「行动周报」同源（trace store 的痕迹流），此处是「我」视角的全量时间轴：
 * 三件事完成 / 习惯打卡 / 盲盒动作按天成组，时间新在前。
 */
import { computed } from 'vue'
import { useTraceStore, type Trace } from '@/stores/trace'
import { TRACE_LABEL } from '@/config/trace'
import type { TraceKind } from '@/config/trace'
import type { HallId } from '@/config/lexicon'
import { useSkinClass } from '@/composables/useSkin'
import { ROUTES } from '@/router/routes'

const trace = useTraceStore()
const skinClass = useSkinClass()

function pad(n: number): string {
  return String(n).padStart(2, '0')
}

function friendlyLabel(key: string): string {
  const today = new Date()
  const tk = `${today.getFullYear()}-${pad(today.getMonth() + 1)}-${pad(today.getDate())}`
  if (key === tk) return '今天'
  const y = new Date(today)
  y.setDate(y.getDate() - 1)
  const yk = `${y.getFullYear()}-${pad(y.getMonth() + 1)}-${pad(y.getDate())}`
  if (key === yk) return '昨天'
  const [, m, d] = key.split('-').map(Number)
  return `${today.getFullYear()} 年 ${m} 月 ${d} 日`
}

interface Item {
  kind: TraceKind
  /** 所属环（用于圆点配色） */
  hall: HallId
  text: string
  time: string
}

interface DayGroup {
  key: string
  label: string
  items: Item[]
}

const groups = computed<DayGroup[]>(() => {
  const map = new Map<string, Item[]>()
  trace.list.forEach((t: Trace) => {
    const list = map.get(t.day) ?? []
    const d = new Date(t.at)
    list.push({
      kind: t.kind,
      hall: t.hall,
      text: t.text,
      time: `${pad(d.getHours())}:${pad(d.getMinutes())}`,
    })
    map.set(t.day, list)
  })
  // traces 本就新在前；按出现的先后成组
  const seen = new Set<string>()
  const out: DayGroup[] = []
  trace.list.forEach((t) => {
    if (seen.has(t.day)) return
    seen.add(t.day)
    out.push({ key: t.day, label: friendlyLabel(t.day), items: map.get(t.day) ?? [] })
  })
  return out
})

const total = computed(() => trace.list.length)
const daysN = computed(() => groups.value.length)
const n = computed(() => {
  const acc = { todo: 0, habit: 0, box: 0 }
  trace.list.forEach((t) => {
    if (t.kind === 'action.box') acc.box += 1
    else if (t.kind === 'action.habit') acc.habit += 1
    else if (t.kind === 'action.todo') acc.todo += 1
  })
  return acc
})

function labelOf(kind: TraceKind): string {
  return TRACE_LABEL[kind] ?? '痕迹'
}

function goBack(): void {
  const pages = getCurrentPages()
  if (pages.length > 1) {
    uni.navigateBack()
  } else {
    uni.switchTab({ url: ROUTES.tabMe })
  }
}
</script>

<style lang="scss" scoped>
@import './index.scss';
</style>

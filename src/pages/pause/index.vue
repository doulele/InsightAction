<template>
  <view class="page" :class="skinClass">
    <!-- 大厅头（五页共用组件：主题艺术画作背景 + 印章 + 定位 + 状态） -->
    <HallHead mark="止" en="HOLD · 止刷 → 止行 → 止念" :line="headLine" :stats="headStats" />

    <!-- 第一周解锁引导：今天的主角在这里才挂出 -->
    <WeekGuide for="pause" />

    <!-- 今日定力 -->
    <view class="today">
      <view class="today__row">
        <view>
          <text class="today__label">今日定力目标</text>
          <text class="today__sub">走完一段沙漏即入账 · 连续天数正在守护</text>
        </view>
        <text class="today__num">{{ todayMin }}<text class="today__unit">/{{ focus.dailyGoal }} 分</text></text>
      </view>
      <view class="bar">
        <view class="bar__fill" :style="{ width: `${focusPct}%` }" />
      </view>
      <view class="today__streak" hover-class="gz-hover" @click="toStreak">{{ streakText }}</view>
    </view>

    <!-- 禅定沙漏 -->
    <view class="section">
      <view class="section__head">
        <text class="section__title">禅定沙漏</text>
        <text class="section__hint">翻转手机触发 · 中途退出需作答</text>
      </view>
      <view class="pills">
        <view
          v-for="d in durations"
          :key="d"
          class="pill"
          :class="{ 'is-on': d === chosenDur }"
          @click="chosenDur = d"
        >
          {{ d }} 分
        </view>
      </view>
      <button class="cta cta--ghost" hover-class="gz-hover" @click="onStartSandglass">
        开始一段静修
      </button>
    </view>

    <!-- 静心茶室（受远端功能开关控制：features.teahouse = false 时整块隐藏） -->
    <view v-if="remote.feature('teahouse')" class="section">
      <view class="section__head">
        <text class="section__title">静心茶室</text>
        <text class="section__hint">五种方式 · 每次 5 分钟</text>
      </view>
      <view class="tea">
        <view v-for="room in teaRooms" :key="room.id" class="tea__room" hover-class="gz-hover" @click="onTea(room.id)">
          <view class="tea__dot" :style="{ background: room.accent }" />
          <text class="tea__name">{{ room.name }}</text>
          <text class="tea__desc">{{ room.desc }}</text>
        </view>
      </view>
    </view>

    <!-- 更深入口 -->
    <view class="section">
      <view class="section__head">
        <text class="section__title">养成定力</text>
      </view>
      <view class="entries">
        <EntryItem
          v-for="item in moreEntries"
          :key="item.title"
          :title="item.title"
          :subtitle="item.subtitle"
          :mark="item.mark"
          :badge="item.badge"
          :url="item.url"
          :disabled="item.disabled"
        />
      </view>
    </view>

    <!-- 批次 D · 小枢全局浮层 -->
    <BuddyFloat />

    <!-- 远端提示层：公告 + 版本更新（强制更新 / 新包已下载、重启生效） -->
    <RemoteNotice />
  </view>
</template>

<script setup lang="ts">
/**
 * 止 · 静修大厅：训练中断默认模式（止刷/止行/止念）。
 * 批次 A：定力展示 + 时长选择视觉；批次 B：禅定沙漏 / 静心茶室均为真实子页（分包），计时走完全程写入今日定力。
 */
import { computed, ref } from 'vue'
import HallHead from '@/components/HallHead/HallHead.vue'
import WeekGuide from '@/components/WeekGuide/WeekGuide.vue'
import { onShow } from '@dcloudio/uni-app'
import { useModeStore } from '@/stores/mode'
import { useRemoteStore } from '@/stores/remote'
import { useFocusStore } from '@/stores/focus'
import { useReminderStore } from '@/stores/reminder'
import { useInterruptStore } from '@/stores/interrupt'
import { useUrgeStore } from '@/stores/urge'
import { useVowStore } from '@/stores/vow'
import { todayKey } from '@/stores/daily'
import { useDimLabel } from '@/composables/usePhrase'
import { poke } from '@/composables/useBuddy'
import { useSkinClass } from '@/composables/useSkin'
import { syncTabBar } from '@/utils/skin'
import { hallLine } from '@/config/lexicon'
import { navigateTo, ROUTES } from '@/router/routes'
import type { RoutePath } from '@/router/routes'
import type { EntryBadge } from '@/components/EntryItem/EntryItem.vue'

const modeStore = useModeStore()
/** 远端功能开关（features.teahouse 等）：整块入口可控隐藏 */
const remote = useRemoteStore()
const skinClass = useSkinClass()
const focus = useFocusStore()
const reminder = useReminderStore()
const interrupt = useInterruptStore()
/** 立约（当日档）与冲动记录（长期档）——规格 v2 §4.2 的两个新增件 */
const vow = useVowStore()
const urge = useUrgeStore()

/** 立约入口徽标：今天的状态一眼可见（未立 / 待回看 / 守住 / 破了） */
const vowBadge = computed<EntryBadge>(() => {
  const v = vow.todayVow
  if (!v) return { text: '今日未立', tone: 'muted' }
  if (v.status === 'open') return { text: '待回看', tone: 'accent' }
  return v.status === 'kept' ? { text: '守住了', tone: 'accent' } : { text: '破了 · 已记原因', tone: 'muted' }
})

const urgeToday = computed(() => urge.ofDay().length)
/** 四维取词：大厅标题用「止 · 静修 / 专注 / 定力」 */
const dl = useDimLabel()

/* tabBar 原生样式/图标只能在本类大厅页上同步 */
onShow(() => {
  /* 批次 D · 小枢：评估到点激励 / 入定到点提醒 */
  poke()
  syncTabBar(modeStore.id)
  /* 昨天的立约若还没回看 → 归档（不催、不补看） */
  vow.ensureToday()
  /**
   * 大厅标题随模式换说法：止 · 静修 / 止 · 专注 / 止 · 定力大厅。
   * pages.json 里的静态标题只作首帧兜底（它不是动态的），这行让冷启动后立刻对上。
   */
  uni.setNavigationBarTitle({ title: `${dl('pause')}大厅` })
})

/** 今日定力：真实专注累计（沙漏/茶室子页写入）；连胜按自然日真实统计 */
const todayMin = computed(() => focus.minutesOn())
const streak = computed(() => focus.currentStreak)
const streakText = computed(() =>
  streak.value > 0
    ? `已连续 ${streak.value} 天 · 错过一天，重新计数`
    : todayMin.value > 0 ? '今天已入账 · 明天续上即第 2 天' : '今天走完一段，就是第 1 天',
)
const heldToday = computed(() => interrupt.heldOn(todayKey()))
const focusPct = computed(() => Math.min(100, Math.round((todayMin.value / focus.dailyGoal) * 100)))

/**
 * 大厅头部的「一句」（2026-09-16 与用户定下的形态：一句主张 + 两个关键数字）。
 * 三模式措辞来自 lexicon.hallLine；模板不可用时回落到本页现成的连胜提示，
 * 保证任何模式下这一行都不会空着。
 */
const headLine = computed(() => hallLine('pause', modeStore.id, streakText.value))

/**
 * 头部两个关键数字：刻意避开下面「今日定力」卡已经在报的进度 ——
 * 这里给"连续天数"（累计）与"每日目标"（设定值），进度条与今日分钟留给那张卡，
 * 一眼扫下来两处不重复。
 */
const headStats = computed(() => [
  { value: `${streak.value}`, label: '连续天数' },
  { value: `${focus.dailyGoal}`, label: '每日目标 · 分' },
])

/** 点连胜卡直达目标设置页 */
function toStreak(): void {
  navigateTo(ROUTES.pauseStreak)
}

const durations = [5, 15, 30, 60] as const
const chosenDur = ref<number>(15)

interface TeaRoom {
  /** 对应静心茶室子页的 room 场景 id */
  id: string
  name: string
  desc: string
  accent: string
}

/** 茶室五色：取「暗底也清晰」的一档，三套皮肤下都能辨认 */
const teaRooms: TeaRoom[] = [
  { id: 'xiang', name: '焚香', desc: '看烟起，什么都不做', accent: '#C4602E' },
  { id: 'sao', name: '扫尘', desc: '风过处，落叶自去', accent: '#84A268' },
  { id: 'ting', name: '听潮', desc: '潮来潮往，你是岸边', accent: '#4E8FD4' },
  { id: 'yun', name: '观云', desc: '看云聚散，不着于相', accent: '#9C8AC4' },
  { id: 'zhu', name: '煮雪', desc: '守着炉火，候雪水开', accent: '#7AA0B2' },
]

/** 禅定沙漏已是真实子页：进分包选时计时，走完全程写入今日定力 */
function onStartSandglass(): void {
  navigateTo(ROUTES.pauseSandglass)
}

/** 点某一盏直达茶室沉浸页：走完全程同样入账今日定力 */
function onTea(id: string): void {
  navigateTo(ROUTES.pauseTeaHouse, { room: id })
}

interface MoreEntry {
  mark: string
  title: string
  subtitle: string
  badge?: EntryBadge
  /** 已落地的子页跳转目标；缺省不跳 */
  url?: RoutePath
  /** 筹备中入口置灰；缺省即可点 */
  disabled?: boolean
}

const activeReminders = computed(() => reminder.reminders.filter((r) => r.enabled).length)

const moreEntries = computed<MoreEntry[]>(() => [
  {
    mark: '统',
    title: '专注统计',
    subtitle: '今日 / 本周 / 本月专注总时长与趋势',
    url: ROUTES.pauseStats,
  },
  {
    mark: '定',
    title: '定时入定',
    subtitle: '预设每日固定专注时段，到点提醒',
    badge:
      activeReminders.value > 0
        ? { text: `${activeReminders.value} 段待命`, tone: 'accent' }
        : { text: '未设置', tone: 'muted' },
    url: ROUTES.pauseSchedule,
  },
  {
    mark: '守',
    title: '每日定力目标 · 连胜',
    subtitle: '自设每日目标分钟 · 中断重计，诚实守护',
    badge:
      streak.value > 0
        ? { text: `连胜 ${streak.value}`, tone: 'accent' }
        : { text: '设定目标', tone: 'muted' },
    url: ROUTES.pauseStreak,
  },
  {
    mark: '约',
    title: '立约 · 当日一条',
    subtitle: '触发条件 + 我承诺 + 替代动作 —— 只立今天，晚上回看一次',
    badge: vowBadge.value,
    url: ROUTES.pauseVow,
  },
  {
    mark: '动',
    title: '冲动记录 · 触发点地图',
    subtitle: '想刷 / 嘴馋 / 想下单时记一笔，攒够十几次就看出形状了',
    badge:
      urgeToday.value > 0
        ? { text: `今日 ${urgeToday.value} 次`, tone: 'accent' }
        : urge.records.length > 0
          ? { text: `累计 ${urge.records.length} 次`, tone: 'muted' }
          : { text: '记第一笔', tone: 'muted' },
    url: ROUTES.pauseUrge,
  },
  {
    mark: '停',
    title: '触发干预卡片',
    subtitle: '想打开某开关的瞬间 · 用 1-3 分钟呼吸把它摁回去',
    badge:
      heldToday.value > 0
        ? { text: `今日守住 ${heldToday.value} 次`, tone: 'accent' }
        : { text: '1-3 分钟', tone: 'muted' },
    url: ROUTES.pauseInterrupt,
  },
])
</script>

<style lang="scss" scoped>
@import './index.scss';
</style>

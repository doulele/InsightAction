<template>
  <view class="page" :class="skinClass">
    <!-- 大厅头（五页共用组件：主题艺术画作背景 + 印章 + 定位 + 状态） -->
    <HallHead mark="止" en="HOLD · 止行 → 止念 → 止欲" :line="headLine" :stats="headStats" />

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

    <!-- ================= 层一 · 止行（含原「止刷」）================= -->
    <!-- 止的是"你正在做的那个动作"：把时间收回来 → 把今天守住 → 长期守护 -->
    <view class="layer">
      <view class="layer__head">
        <text class="layer__name">止行</text>
        <text class="layer__desc">手在动的时候，先让它停下来</text>
      </view>

      <!-- 静心茶室（受远端功能开关控制：features.teahouse = false 时整块隐藏） -->
      <view v-if="remote.feature('teahouse')" class="section">
        <view class="section__head">
          <text class="section__title">静心茶室</text>
          <text class="section__hint">五种方式 · 每次 5 分钟</text>
        </view>
        <!-- 五盏一行放下：只留「色点 + 名」（原 3+2 两行带意境句，占掉近一半屏高）
             —— 意境句在茶室页说得更全（选盏页的 mood、场景里的那一行），大厅不重复讲 -->
        <view class="tea">
          <view v-for="room in teaRooms" :key="room.id" class="tea__room" hover-class="gz-hover" @click="onTea(room.id)">
            <view class="tea__dot" :style="{ background: room.accent }" />
            <text class="tea__name">{{ room.name }}</text>
          </view>
        </view>
      </view>

      <!-- 禅定沙漏（文案与实现对齐：实际是点按钮开始，没有陀螺仪监听） -->
      <view class="section">
        <view class="section__head">
          <text class="section__title">禅定沙漏</text>
          <text class="section__hint">走完全程才入账 · 中途退出需作答</text>
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

      <view class="section">
        <view class="entries">
          <EntryItem
            v-for="item in holdEntries"
            :key="item.title"
            :title="item.title"
            :subtitle="item.subtitle"
            :mark="item.mark"
            :badge="item.badge"
            :url="item.url"
          />
        </view>
      </view>
    </view>

    <!-- ================= 层二 · 止念 ================= -->
    <!-- 止的是"脑子里反复转的念头"：落到纸上，判它现在有没有解 -->
    <view class="layer">
      <view class="layer__head">
        <text class="layer__name">止念</text>
        <text class="layer__desc">脑子在转的时候，把念头落到纸上</text>
      </view>

      <view class="entries">
        <EntryItem
          v-for="item in thinkEntries"
          :key="item.title"
          :title="item.title"
          :subtitle="item.subtitle"
          :mark="item.mark"
          :badge="item.badge"
          :url="item.url"
          :params="item.params"
        />
      </view>

      <!-- 止念条：今天写得多却一条没用上 → 停笔去实践（与知大厅同一份判定） -->
      <view v-if="stopPen" class="stoppen" hover-class="gz-hover" @click="goAction">
        <view class="stoppen__body">
          <text class="stoppen__title">停笔，去实践</text>
          <text class="stoppen__text">{{ stopPen }}</text>
        </view>
        <text class="stoppen__go">去行厅 ›</text>
      </view>
    </view>

    <!-- ================= 层三 · 止欲 ================= -->
    <!-- 止的是"心里那点想要"：记下来看清形状，先不决策 -->
    <view class="layer">
      <view class="layer__head">
        <text class="layer__name">止欲</text>
        <text class="layer__desc">心里痒的时候，先不决策</text>
      </view>

      <view class="entries">
        <EntryItem
          v-for="item in wantEntries"
          :key="item.title"
          :title="item.title"
          :subtitle="item.subtitle"
          :mark="item.mark"
          :badge="item.badge"
          :url="item.url"
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
 * 止 · 静修大厅：训练中断默认模式。
 *
 * 三层按「被止掉的对象」分（规格 v2 §4.2 轴一，2026-09-17 定案）：
 *   止行 —— 手在动的那个动作（含原「止刷」，不再单列一层）
 *   止念 —— 脑子里反复转的念头
 *   止欲 —— 心里那点「想要」
 * 页面按这三层分组渲染：层是"止什么"，组内的即时 / 当日 / 长期是"管多久"（轴二）。
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
import { useUrgeStore, cooldownKindMeta } from '@/stores/urge'
import { MAP_NEED, useThoughtStore } from '@/stores/thought'
import { useVowStore } from '@/stores/vow'
import { todayKey } from '@/stores/daily'
import { useDimLabel } from '@/composables/usePhrase'
import { poke } from '@/composables/useBuddy'
import { useSkinClass } from '@/composables/useSkin'
import { syncTabBar } from '@/utils/skin'
import { hallLine } from '@/config/lexicon'
import { stopPenTip } from '@/utils/growth'
import { navigateTo, ROUTES } from '@/router/routes'
import { prefetchAllCues } from '@/utils/audio'
import type { RouteParams, RoutePath } from '@/router/routes'
import type { EntryBadge } from '@/components/EntryItem/EntryItem.vue'

const modeStore = useModeStore()
/** 远端功能开关（features.teahouse 等）：整块入口可控隐藏 */
const remote = useRemoteStore()
const skinClass = useSkinClass()
const focus = useFocusStore()
const reminder = useReminderStore()
const interrupt = useInterruptStore()
/** 立约（止行 · 当日档）与冲动记录（止欲）——规格 v2 §4.2 */
const vow = useVowStore()
const urge = useUrgeStore()
/** 止念（止念层）：今天已止几念 */
const thought = useThoughtStore()

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
  /*
   * 一记全集预热（2026-09-22）：约 90KB 换「从大厅点进任何一页都立刻有声」。
   * `setSoundEnabled` 那一路已在启动时试过一次，这里是**兜底**：启动那次没网 / 下载失败、
   * 或用户从通知等入口直接落到本页时，都能补上。函数幂等，反复调无成本。
   * 环境音刻意不在这里预热（全集 3.1MB，一次只用一项），见 utils/audio.ts 的 prefetchAllCues。
   */
  prefetchAllCues()
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
  accent: string
}

/**
 * 茶室五色：取「暗底也清晰」的一档，三套皮肤下都能辨认。
 * 这里**刻意不写意境句**（原先每条带一句，如「看烟起，什么都不做」）：
 * 大厅这一排只负责"选一盏"；意境在茶室页说得更全（选盏页的 mood、场景里那行 ink 句），
 * 而且那五句本身就是它的近义重复 —— 摆在这里既占两行高度，又把同一句话说两遍。
 */
const teaRooms: TeaRoom[] = [
  { id: 'xiang', name: '焚香', accent: '#C4602E' },
  { id: 'sao', name: '扫尘', accent: '#84A268' },
  { id: 'ting', name: '听潮', accent: '#4E8FD4' },
  { id: 'yun', name: '观云', accent: '#9C8AC4' },
  { id: 'zhu', name: '煮雪', accent: '#7AA0B2' },
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
  /** 跳转参数（拼到 url 后面）——止念三张卡就是靠它直达 `?tab=map` / `?tab=shelf` */
  params?: RouteParams
  /** 筹备中入口置灰；缺省即可点 */
  disabled?: boolean
}

const activeReminders = computed(() => reminder.reminders.filter((r) => r.enabled).length)

/**
 * 三层各自的入口（层内的先后即使用顺序）。
 *
 * 止行的分界是「你主动安排的动作」：沙漏 / 茶室（把时间收回来）、立约（当日守住）、
 * 统计 / 定时 / 目标与连胜（长期守护）—— 原「止刷」六项整组都在这里，刷是动作的一种。
 * 止念只有一件：把念头落到纸上（止念条是条件出现的提醒，不算入口）。
 * 止欲的分界是「冲动来袭时」：摁住 → 看清 → 先不决策，是同一件事的三个时间尺度
 * （2026-09-17 二次修正：触发干预卡片由止行改归止欲 —— 它的五个预设场景全是冲动型，
 * 与冲动记录、冷却期本就是一伙）。
 */

/** 止行 · 列表型入口（沙漏与茶室在页面里是两个 section，不在这里） */
const holdEntries = computed<MoreEntry[]>(() => [
  {
    mark: '约',
    title: '立约 · 当日一条',
    subtitle: '触发条件 + 我承诺 + 替代动作 —— 只立今天，晚上回看一次',
    badge: vowBadge.value,
    url: ROUTES.pauseVow,
  },
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
])

/**
 * 止念 · 把念头落到纸上（"能做"的转成「行」里的一件事）。
 *
 * 2026-09-17「止念分三面」：按**动作**拆成三张卡（写一笔 / 看形状 / 处理悬着的事），
 * 与止念页的三个 tab 一一对应（`params` 直达 `?tab=…`），也与止欲的三张卡同构。
 * 拆的依据：「到点了」原是混在地图（陈述）里的**待处理事项**，两种性质混装会让形状那一面变脏。
 *
 * 徽标口径：到点条数挂「候着的」那张卡上 —— 搁置窗口是纯派生（computed），
 * 只有走进止念页才算得出来，不带到入口上「到期轻问」就等于没人问。
 * 不加定时器、不加推送，只改这一个徽标。
 */
const thinkEntries = computed<MoreEntry[]>(() => {
  const n = thought.ofDay().length
  const totalN = thought.records.length
  const dueN = thought.dueCount
  const pendN = thought.pendingCount
  return [
    {
      mark: '念',
      title: '止念一刻',
      subtitle: '把反复想的那件事写下来，判它现在有没有解',
      badge:
        n > 0 ? { text: `今日 ${n} 念`, tone: 'accent' } : { text: '写一句就够', tone: 'muted' },
      url: ROUTES.pauseThought,
    },
    {
      mark: '图',
      title: '念头地图',
      subtitle: '能做 / 先放下、常出现的时段、跨天回来的那几件',
      /* 门槛与地图页一致（MAP_NEED.band），不在这里另写一个数 */
      badge:
        totalN >= MAP_NEED.band
          ? { text: `累计 ${totalN} 念`, tone: 'accent' }
          : { text: '还不够看', tone: 'muted' },
      url: ROUTES.pauseThought,
      params: { tab: 'map' },
    },
    {
      mark: '候',
      title: '候着的',
      subtitle: '当时说要看一眼的，到点在这儿问一句',
      badge:
        dueN > 0
          ? { text: `${dueN} 条到点了`, tone: 'accent' }
          : pendN > 0
            ? { text: `候着 ${pendN} 条`, tone: 'muted' }
            : { text: '没有悬着的', tone: 'muted' },
      url: ROUTES.pauseThought,
      params: { tab: 'shelf' },
    },
  ]
})

/** 止念条：今天写得多却一条没用上 —— 与知大厅共用同一份判定（utils/growth） */
const stopPen = computed(() => stopPenTip())

function goAction(): void {
  navigateTo(ROUTES.tabAction)
}

/** 冷却期的状态徽标：起没起、哪一档（倒计时在冲动记录页里看） */
const coolBadge = computed<EntryBadge>(() => {
  const meta = cooldownKindMeta(urge.cooldownKind)
  return urge.cooldownRemain() > 0
    ? { text: `冷却中 · ${meta.label}`, tone: 'accent' }
    : { text: '10 分钟 / 48 小时', tone: 'muted' }
})

/** 止欲 · 冲动来袭时的三件：摁住（即时）→ 看清（长期）→ 先不决策（分钟~两天） */
const wantEntries = computed<MoreEntry[]>(() => [
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
  {
    mark: '冷',
    title: '冷静脉冲 · 先不决策',
    subtitle: '10 分钟当下一口气 / 48 小时给大决定 —— 过一会儿还想做吗',
    badge: coolBadge.value,
    url: ROUTES.pauseUrge,
  },
  {
    mark: '录',
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
])
</script>

<style lang="scss" scoped>
@import './index.scss';
</style>

<template>
  <view class="page" :class="skinClass">
    <!-- 顶栏：返回 + 标题 -->
        <SubNav :fallback="ROUTES.tabAction">行动周报 · 痕迹</SubNav>

    <!-- 周总况 -->
    <view class="head">
      <view class="head__range">{{ rangeText }}</view>
      <view class="stats">
        <view class="stat">
          <text class="stat__n">{{ todoCount }}</text>
          <text class="stat__cap">完成行动</text>
        </view>
        <view class="stat">
          <text class="stat__n">{{ habitCount }}</text>
          <text class="stat__cap">习惯打卡</text>
        </view>
        <view class="stat">
          <text class="stat__n">{{ boxCount }}</text>
          <text class="stat__cap">盲盒达成</text>
        </view>
      </view>
    </view>

    <!-- 这一周：四环分布 + 修为（规格 §14） -->
    <view class="sum">
      <view class="sum__row">
        <text class="sum__k">四环分布</text>
        <view class="sum__halls">
          <text v-for="h in HALLS" :key="h" class="sum__hall" :class="`is-${h}`">
            {{ TAB_LABEL[h] }} {{ report.hallCount[h] }}
          </text>
        </view>
      </view>
      <view class="sum__row">
        <text class="sum__k">修为入账</text>
        <text class="sum__v">+{{ report.xpGain }}（累计 {{ report.xpTotal }} · {{ report.level }}）</text>
      </view>
      <!-- 安息日：把这天标出来，免得"空白"被读成"漏了"（见 utils/weekly.ts 的 sabbathDays） -->
      <view v-if="report.sabbathDays.length" class="sum__row">
        <text class="sum__k">安息日</text>
        <text class="sum__v">{{ sabbathText }} · 那天不算缺口</text>
      </view>
    </view>

    <!-- 一条路：只能由 trace 的 ref 生成；没有跨环关联就不编 -->
    <view class="section">
      <view class="section__title">一条路</view>
      <text v-if="!report.path.length" class="empty-line">{{ pathEmpty }}</text>
      <view v-else class="path">
        <view v-for="(p, i) in report.path" :key="i" class="path__row">
          <text class="path__dot">·</text>
          <text class="path__text">{{ p }}</text>
        </view>
      </view>
    </view>

    <!-- 四环各自 -->
    <view class="section">
      <view class="section__title">四环各自</view>
      <view v-for="h in HALLS" :key="h" class="hrow">
        <text class="hrow__mark" :class="`is-${h}`">{{ TAB_LABEL[h] }}</text>
        <text class="hrow__text">{{ report.halls[h] }}</text>
      </view>
    </view>

    <!-- 小枢的一句话：规则生成，不靠 AI -->
    <view v-if="report.buddy" class="buddy">
      <text class="buddy__mark">枢</text>
      <text class="buddy__text">{{ report.buddy }}</text>
    </view>

    <!--
      在走的计划（2026-09-15）：周报只看「这周做了什么」，跨天的路不属于任何一周，
      所以这里不做完成率统计，只把它们摆出来 —— 让「我还在走一条路」这件事被看见。
    -->
    <view v-if="activePlans.length" class="plans">
      <view class="plans__head">
        <text class="plans__title">在走的{{ planW.plan }}</text>
        <text class="plans__n">{{ activePlans.length }}</text>
      </view>
      <view
        v-for="p in activePlans"
        :key="p.id"
        class="prow"
        hover-class="gz-hover"
        @click="openPlan(p)"
      >
        <text class="prow__title">{{ p.title }}</text>
        <text class="prow__progress">{{ planW.progress(planStore.progressOf(p).done, planStore.progressOf(p).total) }}</text>
      </view>
    </view>

    <!-- 近 7 日柱状 -->
    <view class="section">
      <view class="section__title">近 7 日痕迹</view>
      <view class="bars">
        <view v-for="d in days" :key="d.key" class="bar-col" @click="activeDay = d.key">
          <view class="bar-col__track">
            <view
              class="bar-col__fill"
              :class="{ 'is-cur': d.key === activeDay }"
              :style="{ height: `${barHeight(d.count)}%` }"
            />
          </view>
          <text class="bar-col__n">{{ d.count }}</text>
          <text class="bar-col__label" :class="{ 'is-cur': d.key === activeDay }">{{ d.label }}</text>
        </view>
      </view>
      <text class="bars__note">柱高为该日三件事完成 / 习惯打卡 / 盲盒动作的总痕迹数</text>
    </view>

    <!-- 当天明细 -->
    <view class="section">
      <view class="section__row">
        <text class="section__title">明细 · {{ activeLabel }}</text>
        <text class="section__more" hover-class="gz-hover" @click="goMe">全部痕迹 →</text>
      </view>
      <view v-if="!activeTraces.length" class="empty-line">
        这天没有痕迹。也可以是——那天你休息了一下。
      </view>
      <view v-else class="mini-list">
        <view v-for="t in activeTraces" :key="t.id" class="mini">
          <view class="mini__dot" :class="`is-${t.hall}`" />
          <text class="mini__label">{{ labelOf(t.kind) }}</text>
          <text class="mini__text">{{ t.text }}</text>
          <text class="mini__time">{{ timeOf(t.at) }}</text>
        </view>
      </view>
    </view>

    <!--
      情境化省察（规格 §4.3）：周报本身就是「由头」，看完就地反问一句。
      锚点按周计（weekly-<周一>），所以一周只问一次，答过就留着那句答案。
    -->
    <!-- 下周：留白，用户自己写（规格 §14 · 不自动填） -->
    <view class="section">
      <view class="section__title">下周</view>
      <textarea
        v-model="nextNote"
        class="next"
        :maxlength="60"
        placeholder="给自己留一句（不填也行）"
        placeholder-class="next__ph"
        @blur="saveNext"
      />
      <text class="next__hint">这一句只有你自己能改 —— 系统不替你写。</text>
    </view>

    <SceneProbe scene="weekly" :anchor="weekAnchor" />

    <view class="foot">
      <text class="foot__text">一周回头看 · 才知道脚步没白走</text>
    </view>
  </view>
</template>

<script setup lang="ts">
/**
 * 行动周报 · 痕迹时间轴（批次 C）· 分包 subpkg-action。
 * 本周三件事完成 / 习惯打卡 / 盲盒动作聚合 + 近 7 日痕迹柱 + 当日明细；
 * 时间轴复用「痕迹流」store，我页时间轴为同源不同视图。
 */
import { computed, ref } from 'vue'
import { useTraceStore, type Trace } from '@/stores/trace'
import { TRACE_LABEL } from '@/config/trace'
import type { TraceKind } from '@/config/trace'
import { useHabitStore } from '@/stores/habit'
import { usePlanStore, type Plan } from '@/stores/plan'
import { planWords } from '@/config/lexicon'
import { useModeStore } from '@/stores/mode'
import { todayKey } from '@/stores/daily'
import { useSkinClass } from '@/composables/useSkin'
import SceneProbe from '@/components/SceneProbe/SceneProbe.vue'
import { navigateTo, ROUTES } from '@/router/routes'
import { buildWeekly, HALLS } from '@/utils/weekly'
import { TAB_LABEL } from '@/config/skins'

const trace = useTraceStore()
const habit = useHabitStore()
const planStore = usePlanStore()
const mode = useModeStore()
const planW = computed(() => planWords(mode.id))
const skinClass = useSkinClass()

/** 在走的长期计划：周报不做完成率，只让它们被看见 */
const activePlans = computed(() => planStore.activeLong)

function openPlan(p: Plan): void {
  navigateTo(ROUTES.actionPlanDetail, { id: p.id })
}

function pad(n: number): string {
  return String(n).padStart(2, '0')
}

function fmtDate(d: Date): string {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

function mondayOf(d: Date): Date {
  const t = new Date(d)
  const dow = (t.getDay() + 6) % 7
  t.setDate(t.getDate() - dow)
  t.setHours(0, 0, 0, 0)
  return t
}

const now = new Date()
const monday = mondayOf(now)
const mondayKey = fmtDate(monday)
const todayK = todayKey()

/** 本周的省察锚点：一周一个，天然一周只问一次 */
const weekAnchor = `weekly-${mondayKey}`

/** 周报（规格 §14）：四环分布 / 一条路 / 四环各自 / 小枢一句话 */
const report = computed(() => buildWeekly(mondayKey, todayK, mode.id))

/** 安息日：显示成 9/16（周三）这种一眼能对上的写法，只列日期 */
const sabbathText = computed(() => report.value.sabbathDays.map((d) => d.slice(5)).join(' / '))

/** 「一条路」为空时的文案：空周与「没连成线」是两回事，分开说 */
const pathEmpty = computed(() =>
  report.value.empty
    ? '这周你没有留下痕迹 —— 也可以，那是休息的一周。'
    : '这周的痕迹还没有连成线：在【行】的三件事上挂一个出处，下周这里就会有路。',
)

/** 下周留白：按周存本地，只有用户自己能改 */
const NEXT_KEY = `insight:weekly:next:${mondayKey}`
const nextNote = ref<string>((uni.getStorageSync(NEXT_KEY) as string) || '')

function saveNext(): void {
  uni.setStorageSync(NEXT_KEY, nextNote.value)
}

/* 本周事件数 */
const weekTraces = computed(() => trace.between(mondayKey, todayK))
const todoCount = computed(() => weekTraces.value.filter((t) => t.kind === 'action.todo').length)
const boxCount = computed(
  () => weekTraces.value.filter((t) => t.kind === 'action.box' && t.text.includes('完成')).length,
)
/** 习惯打卡：本周各习惯打卡的「习惯×天」总数 */
const habitCount = computed(() =>
  habit.habits.reduce(
    (sum, h) => sum + habit.daysOf(h.id).filter((d) => d >= mondayKey && d <= todayK).length,
    0,
  ),
)

function rangeTextOf(): string {
  const last = todayK === fmtDate(now) ? now : new Date()
  const start = `${monday.getMonth() + 1} 月 ${monday.getDate()} 日`
  const end = `${last.getMonth() + 1} 月 ${last.getDate()} 日`
  return `${start} - ${end} · 本周`
}

const rangeText = rangeTextOf()

/** 近 7 天（含今天） */
interface DayCell {
  key: string
  label: string
  count: number
}

const days = computed<DayCell[]>(() => {
  const out: DayCell[] = []
  for (let i = 6; i >= 0; i--) {
    const d = new Date()
    d.setDate(d.getDate() - i)
    const key = fmtDate(d)
    const tracesN = trace.ofDay(key).length
    const habitN = habit.doneOn(key)
    out.push({ key, label: i === 0 ? '今' : `${d.getMonth() + 1}/${d.getDate()}`, count: tracesN + habitN })
  }
  return out
})

const maxCount = computed(() => Math.max(1, ...days.value.map((d) => d.count)))

function barHeight(count: number): string {
  return `${Math.max(count > 0 ? 10 : 0, Math.round((count / maxCount.value) * 100))}%`
}

const activeDay = ref(todayK)
const activeLabel = computed(() => days.value.find((d) => d.key === activeDay.value)?.label ?? '')
const activeTraces = computed<Trace[]>(() => {
  const traces = trace.ofDay(activeDay.value)
  const fromHabit: Trace[] = []
  habit.habits.forEach((h) => {
    if (habit.isDone(h.id, activeDay.value)) {
      // 无时间戳，作为当天 08:00 之后一条伪记录展示明细
      fromHabit.push({
        id: -h.id - 1,
        kind: 'action.habit' as TraceKind,
        hall: 'action',
        text: h.name,
        day: activeDay.value,
        at: new Date(`${activeDay.value}T08:00:00`).getTime(),
        value: 0,
      })
    }
  })
  return [...traces, ...fromHabit].sort((a, b) => b.at - a.at).slice(0, 30)
})

function labelOf(kind: TraceKind): string {
  return TRACE_LABEL[kind] ?? '痕迹'
}

function timeOf(at: number): string {
  const d = new Date(at)
  return `${pad(d.getHours())}:${pad(d.getMinutes())}`
}

function goMe(): void {
  navigateTo(ROUTES.tabMe)
}

</script>

<style lang="scss" scoped>
@import './index.scss';
</style>

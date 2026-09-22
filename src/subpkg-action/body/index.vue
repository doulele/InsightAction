<template>
  <view class="page" :class="skinClass">
    <!-- 顶栏 -->
    <view class="nav">
      <view class="nav__side" hover-class="gz-hover" @click="goBack">
        <text class="nav__back">‹</text>
      </view>
      <text class="nav__title">身体电量</text>
      <view class="nav__side" />
    </view>

    <!-- 今日电量 -->
    <view class="bat">
      <view class="bat__top">
        <text class="bat__label">今日电量</text>
        <text class="bat__time">{{ syncText }}</text>
      </view>

      <view class="bat__num">
        <text class="bat__value">{{ body.hasToday ? body.todayStep : '—' }}</text>
        <text class="bat__unit">步</text>
        <text class="bat__goal">/ 目标 {{ goalText }}</text>
      </view>

      <view class="bat__cell">
        <view class="bat__fill" :style="{ width: `${body.pct}%` }" />
      </view>
      <text class="bat__word">{{ word }}</text>

      <text v-if="body.latest && !body.hasToday" class="bat__stale">
        最新一条停在 {{ body.latest.date }} —— 今天还没有步数传回来。
      </text>
    </view>

    <!--
      目标：四档预设 + 自定义。
      一行要放五个选项，四位数的「10000」会把这一行挤爆，所以统一写短：k = 千、w = 万。
    -->
    <view class="goals">
      <view class="goals__top">
        <text class="goals__label">今日目标</text>
        <text class="goals__now">当前 {{ goalText }} 步</text>
      </view>
      <view class="goals__list">
        <view
          v-for="g in GOALS"
          :key="g"
          class="goal"
          :class="{ 'is-on': body.goal === g }"
          hover-class="gz-hover"
          @click="body.goal = g"
        >
          {{ goalTextOf(g) }}
        </view>
        <view class="goal" :class="{ 'is-on': isCustom }" hover-class="gz-hover" @click="toggleCustom">
          {{ isCustom ? goalText : '自定义' }}
        </view>
      </view>
      <view v-if="customOpen" class="goals__custom">
        <input
          v-model="customGoal"
          class="goals__input"
          type="number"
          placeholder="步数：1000 ~ 100000"
          placeholder-class="goals__ph"
          confirm-type="done"
          @confirm="applyCustom"
        />
        <view class="goals__ok" hover-class="gz-hover" @click="applyCustom">定为今日目标</view>
      </view>
    </view>

    <!-- 最近七天 -->
    <view class="week">
      <view class="week__head">
        <text class="week__title">最近七天</text>
        <text class="week__tip">空着的那天是没读到数据，不是走了零步</text>
      </view>
      <view class="week__bars">
        <view v-for="d in body.recent" :key="d.date" class="col">
          <view class="col__track">
            <view class="col__bar" :style="{ height: barHeight(d) }" />
          </view>
          <text class="col__n">{{ stepText(d.step) }}</text>
          <text class="col__d">{{ d.label }}</text>
        </view>
      </view>
    </view>

    <!--
      最近三十天：微信只给约 31 天，"三十天"就是能拿到的最长窗口。
      这里只摆形状，不出现"完成率""达标率"这类评判词。
    -->
    <view class="month">
      <view class="month__head">
        <text class="month__title">最近三十天</text>
        <text class="month__tip">只摆形状，不下结论</text>
      </view>
      <view class="month__bars">
        <view v-for="d in body.bars30" :key="d.date" class="mcol">
          <view
            class="mcol__bar"
            :class="{ 'is-empty': d.step === null }"
            :style="{ height: monthHeight(d) }"
          />
        </view>
      </view>
      <view class="month__facts">
        <text class="month__fact">这三十天里，有读数的 {{ body.insight.knownDays }} 天，没读到的 {{ body.insight.missingDays }} 天。</text>
        <text v-if="medianText" class="month__fact">{{ medianText }}</text>
        <text v-if="compareText" class="month__fact">{{ compareText }}</text>
        <text class="month__fact month__fact--dim">没读到不等于没走 —— 可能是没带手机，也可能那天没打开过小程序。</text>
      </view>
    </view>

    <!--
      输入与输出（2026-09-21）：同一天，观环存进多少条 vs 行环走了多少步。
      这是别处做不出的对照（微信运动没有你的阅读记录），所以只把它俩摆在一起。
    -->
    <view class="io">
      <view class="io__head">
        <text class="io__title">输入与输出</text>
        <text class="io__tip">看了多少 / 走了多少</text>
      </view>
      <view v-for="r in ioRows" :key="r.date" class="io__row">
        <text class="io__date">{{ r.label }}</text>
        <text class="io__in">{{ r.read ? `读了 ${r.read} 条` : '没存东西' }}</text>
        <text class="io__out">{{ r.step === null ? '步数没读到' : `走了 ${stepText(r.step)} 步` }}</text>
      </view>
      <text v-if="ioNote" class="io__note">{{ ioNote }}</text>
    </view>

    <!-- 同步 -->
    <view class="sync" :class="{ 'is-busy': syncing }" hover-class="gz-hover" @click="onSync">
      <text>{{ syncing ? '读取中…' : '同步今日步数' }}</text>
    </view>
    <view v-if="body.auth === 'denied'" class="again" hover-class="gz-hover" @click="openSetting">
      在系统设置里重新允许读取步数 ›
    </view>

    <view class="note">
      <text class="note__row">步数来自微信运动。第一次要你点一下授权；之后隔几天进「行」大厅会自动续接一次。没授权之前，我们不会读。</text>
      <text class="note__row">自动续接失败不打扰你，也不会一直重试 —— 连续两次没拿到更新的数据就改回你手动点。</text>
      <text class="note__row">服务端只负责解开微信的密文，解开即刻返回，不留存、不写日志。</text>
      <text class="note__row">步数存在你这台手机上：云备份不带它，本地备份文件才带得走。</text>
      <text class="note__row">它只是身体活动的粗略参考，不构成健康建议。</text>
    </view>

    <!-- 隐私授权门：步数 / 剪贴板 / 选文件 / 头像昵称都要过这道门 -->
    <PrivacyGate />
  </view>
</template>

<script setup lang="ts">
/**
 * 行 · 身体电量（微信运动）。
 *
 * 产品的取舍写在前头：
 *  1. **授权手动、取数自动**（2026-09-21 改）—— 授权窗只在用户主动点「同步」时才弹
 *     （冷启动就弹是惹人不快也要不到授权的）。拿到授权之后进「行」大厅会静默续接一次，
 *     因为那时 `getWeRunData` 已不再弹窗、用户全程无感；判定见 `stores/body.ts` 的
 *     `canAutoSync`（数据过期 ≥2 天、距上次尝试 ≥20 小时、不在 23:00–06:00）。
 *     微信运动本来就要"用户主动进入小程序"才会刷新数据，所以自动也只是补一次；
 *  2. **诚实标空** —— 没读到数据显示「—」而不是 0，柱状图同样留白。
 *     把「没数据」画成「走了 0 步」，是另一种形式的自欺；
 *  3. **不评判** —— 不给连续达标 / 断签才会有回头cue，只有一句平铺直叙的话；
 *  4. **只跟自己比**（2026-09-21）—— 三十天视图比的是**自己的中位数**与自己的工作日/周末，
 *     不跟达标线比、更不跟别人比；没读到的天数如实报出来，但明确写着"没读到不等于没走"；
 *  5. **输入与输出**（2026-09-21）—— 同一天"观环存了几条"与"走了多少步"摆在一起。
 *     这是微信运动与系统数字健康都做不出的对照，所以只摆结构、不下结论。
 */
import { computed, ref } from 'vue'
import { useSkinClass } from '@/composables/useSkin'
import { useBodyStore, GOAL_PRESETS, GOAL_MIN, GOAL_MAX, formatGoal } from '@/stores/body'
import type { BodyBar } from '@/stores/body'
import { dayStats } from '@/utils/growth'
import { WerunError, openWeRunSetting, readWeRun } from '@/utils/werun'
import { logTrace } from '@/utils/traceLog'

const skinClass = useSkinClass()
const body = useBodyStore()
const syncing = ref(false)

/** 可选目标：4k 起手、6k 常规、8k 有余、1w 有余力时 */
const GOALS = GOAL_PRESETS

/** 当前目标的短写法（k / w） */
const goalText = computed(() => formatGoal(body.goal))
function goalTextOf(n: number): string {
  return formatGoal(n)
}

/** 当前目标不在预设四档里 = 用户自己定的 */
const isCustom = computed(() => !GOALS.some((g) => g === body.goal))

const customOpen = ref(false)
const customGoal = ref('')

function toggleCustom(): void {
  customOpen.value = !customOpen.value
  if (customOpen.value) customGoal.value = String(body.goal)
}

function applyCustom(): void {
  const raw = Number(customGoal.value)
  if (!raw || !Number.isFinite(raw)) {
    uni.showToast({ title: '先填一个步数', icon: 'none' })
    return
  }
  if (body.setGoal(raw)) {
    customOpen.value = false
    uni.showToast({ title: `今日目标 ${formatGoal(body.goal)} 步`, icon: 'none' })
    return
  }
  uni.showToast({ title: `填 ${GOAL_MIN} ~ ${GOAL_MAX} 之间的步数`, icon: 'none', duration: 2400 })
}

/** 页面上的一句话：按电量分档，语气平实，不外挂鸡血 */
const word = computed<string>(() => {
  if (body.todayStep === null) {
    return body.latest ? '今天还没有读数。点下面的按钮，把步数读进来。' : '还没有步数。先看一次你今天走到了哪里。'
  }
  if (body.todayStep === 0) return '一步都还没算进来 —— 手机可能没在计步。'
  if (body.pct < 25) return '电量见底。不必专门去跑，站起来走五分钟也算数。'
  if (body.pct < 50) return '走起来了。这一格电量，够撑一轮静修。'
  if (body.pct < 80) return '电量过半，身体已经醒透。'
  if (body.pct < 100) return '快满了 —— 今天的最后一步，可以走得体面些。'
  return '今日电量已满。剩下的每一步，都是赚的。'
})

/** 上次同步时间（人话，不给 ISO 原文） */
const syncText = computed<string>(() => {
  if (!body.lastSyncAt) return '尚未同步'
  const d = new Date(body.lastSyncAt)
  const hh = String(d.getHours()).padStart(2, '0')
  const mm = String(d.getMinutes()).padStart(2, '0')
  return `上次 ${hh}:${mm}`
})

/**
 * 柱子上方的数字：七列并排，四位数会把那一列撑破，所以满一千也用 k / w 写短。
 * 不足一千的照写原数 —— 650 步写成 0.7k 反而看不懂。
 */
function stepText(n: number | null): string {
  if (n === null) return '—'
  return n < 1000 ? String(n) : formatGoal(n)
}

/** 柱高：没有数据就彻底空着（见注释「诚实标空」） */
function barHeight(d: BodyBar): string {
  if (d.step === null) return '0%'
  const pct = (d.step / Math.max(1, body.barMax)) * 100
  return `${Math.max(3, Math.round(pct))}%`
}

/** 三十天柱高：只按这 30 天的峰值归一（不掺目标值，否则整排都会被压扁） */
function monthHeight(d: BodyBar): string {
  if (d.step === null) return '0%'
  const pct = (d.step / Math.max(1, body.peak30)) * 100
  return `${Math.max(4, Math.round(pct))}%`
}

/** 「只跟自己比」第一句：今天与自己的中位数比 */
const medianText = computed<string>(() => {
  const s = body.insight
  if (s.median === null) return ''
  const base = `你最近的中间值是 ${s.median} 步`
  if (s.diff === null) return `${base}。`
  if (s.diff === 0) return `${base}，今天正好停在线上。`
  return `${base}，今天${s.diff > 0 ? '多' : '少'}了 ${Math.abs(s.diff)} 步。`
})

/** 「只跟自己比」第二句：工作日 vs 周末（两边样本不够就整句不出现） */
const compareText = computed<string>(() => {
  const s = body.insight
  if (s.workdayAvg === null || s.weekendAvg === null) return ''
  const gap = s.weekendAvg - s.workdayAvg
  if (gap === 0) return `工作日与周末走得一样多，都是 ${s.workdayAvg} 步。`
  return `工作日日均 ${s.workdayAvg} 步，周末 ${s.weekendAvg} 步。`
})

/** 最近七天的「输入与输出」逐日对照（观环痕迹数复用 utils/growth 的同一口径） */
const ioRows = computed(() =>
  body.recent.map((d) => ({
    date: d.date,
    label: d.label,
    read: dayStats(d.date).obsN,
    step: d.step,
  })),
)

/**
 * 对照的收束句：只指出"存得最多"与"走得最多"落在哪一天，不说这两件事谁好谁坏。
 * 步数样本不足 3 天、或这一周压根没存东西时整句不出现 —— 宁可不说话，也别硬凑一句。
 */
const ioNote = computed<string>(() => {
  const rows = ioRows.value
  const withStep = rows.filter((r) => r.step !== null)
  if (withStep.length < 3) return ''
  const busiest = [...rows].sort((a, b) => b.read - a.read)[0]
  const farthest = [...withStep].sort((a, b) => (b.step ?? 0) - (a.step ?? 0))[0]
  if (!busiest || busiest.read === 0 || !farthest) return ''
  return busiest.date === farthest.date
    ? `存得最多和走得最多，落在同一天（${farthest.label}）。`
    : `存得最多的是 ${busiest.label}，走得最多的是 ${farthest.label}。`
})

async function onSync(): Promise<void> {
  if (syncing.value) return
  syncing.value = true
  try {
    const res = await readWeRun()
    body.record(res.days)
    /*
     * 入账：同步本身就是"回头看了一眼身体"这个行为，值 2 分。
     * 一天只计一次（config/trace.ts 的 DAY_CAP），第二次起照常留痕、不再入账 ——
     * 否则反复点同步就是反复领分。安息日由 logTrace 统一处理，页面不判断。
     */
    logTrace({
      kind: 'action.body',
      text: body.hasToday ? `今天 ${body.todayStep} 步` : '同步了步数，今天暂无数据',
    })
    /*
     * 手动同步成功也顺手把"自动续接连败"清零：那道闸是给取不到数的情况兜底的，
     * 用户自己点通了，说明路是通的，自动该恢复。
     */
    body.finishTry()
    uni.showToast({
      title: body.hasToday ? `今天 ${body.todayStep} 步` : '已同步，今天暂无数据',
      icon: 'none',
    })
  } catch (e) {
    const err = e instanceof WerunError ? e : new WerunError('error', '读取步数失败，稍后再试')
    if (err.reason === 'denied') body.markDenied()
    if (err.reason === 'denied') {
      uni.showToast({ title: err.message, icon: 'none', duration: 2400 })
    } else {
      /*
       * 非「没授权」的失败一律弹窗给**完整原文**。
       * toast 一行只能放十来个字，而排查这类问题恰恰全靠原文 ——
       * 「没在隐私指引里声明该信息类型」和「手机没开微信运动」长得完全不一样，
       * 截断了就等于没报。
       */
      uni.showModal({ title: '读取步数失败', content: err.message, showCancel: false, confirmText: '知道了' })
    }
  } finally {
    syncing.value = false
  }
}

function openSetting(): void {
  openWeRunSetting()
}

function goBack(): void {
  uni.navigateBack()
}
</script>

<style lang="scss" scoped>
@import './index.scss';
</style>

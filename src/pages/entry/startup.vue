<template>
  <view class="startup" :class="skinClass" :style="pageStyle" hover-class="none" @click="go">
    <!-- 品牌 -->
    <view class="startup__brand">
      <BrandSeal :size="84" />
      <text class="startup__name">观止知行</text>
      <text class="startup__en">INSIGHT · ACTION · DIGITAL PRACTICE</text>
    </view>

    <!-- 今日一签：有到期回响就重看旧的；否则按天排班，或给自己的道、或回池子挑一句 -->
    <view class="startup__proverb">
      <text v-if="today.echoId" class="startup__echo">回响 · 第 {{ today.echoStage }} 次见面</text>
      <text class="startup__proverb-text">「{{ proverb.text }}」</text>
      <text v-if="proverb.from" class="startup__proverb-from">—— {{ proverb.from }}</text>

      <!--
        三种状态各有各的落点：
         回响 → 「还在记着」= 显式确认（这一条若还没结算，点它就推一阶；结算过了只给回执）；
         自己的道 → 去母题库看那条道（**不给"记住这句"**：那是自己收自己）；
         别人的句子 → 收进「我的箴言」。
      -->
      <view
        v-if="today.echoId"
        class="startup__fav is-echo"
        hover-class="gz-hover"
        @click.stop="onReviewed"
      >
        <text class="startup__fav-icon">↻</text>
        <text class="startup__fav-label">还在记着</text>
      </view>
      <view v-else-if="today.mineId" class="startup__fav is-mine" hover-class="gz-hover" @click.stop="goMyDao">
        <text class="startup__fav-icon">道</text>
        <text class="startup__fav-label">这是我的道 · 去母题库 ›</text>
      </view>
      <view v-else class="startup__fav" :class="{ 'is-on': faved }" hover-class="gz-hover" @click.stop="onFav">
        <text class="startup__fav-icon">{{ faved ? '♥' : '♡' }}</text>
        <text class="startup__fav-label">{{ faved ? '已记住' : '记住这句' }}</text>
      </view>
    </view>

    <!-- 版心靠上：下方留白交给这块弹性占位 -->
    <view class="startup__spacer" />

    <view class="startup__foot">
      <text class="startup__hint">轻点屏幕，即刻开始 · {{ leftSec }}s</text>
      <view class="startup__bar">
        <view class="startup__bar-fill" :style="{ width: `${progress}%` }" />
      </view>
      <text v-if="favCount > 0" class="startup__favnote">
        已记住 {{ favCount }} 句{{ dueCount ? ` · 今日 ${dueCount} 句在回响` : '' }} · 在「我 · 我的箴言」回看
      </text>
    </view>
  </view>
</template>

<script setup lang="ts">
/**
 * 启动箴言页：打开仪式 —— 每次冷启动都会先经过这里约 4 秒（点按即跳过）。
 * 皮肤跟随「上次选择的修行语言」（模式已持久化，无需每次重选），
 * 修仙即旧纸朱砂开屏、科技即深夜网格开屏。
 * 分流：已完成引导 → 主界面（观大厅）；未完成 → 模式选择。
 * 「记住这句」把开屏箴言收进 proverb store，可在「我 · 我的箴言」回看。
 * 到期回响**展示即推进**（进页面结算一次、一天最多一条，口径在 `stores/proverb.ts` 的
 * `settleEcho`）—— 不能靠「还在记着」推进：整页 `@click="go"` 点哪都跳过，那个按钮基本按不到。
 */
import { onLoad, onUnload } from '@dcloudio/uni-app'
import { computed, ref } from 'vue'
import { useAppStore } from '@/stores/app'
import { useSkinClass } from '@/composables/useSkin'
import { safeTopPx } from '@/utils/safeArea'
import { isDue, REVIEW_DAYS, reviewFinished, useProverbStore } from '@/stores/proverb'
import { useObserveStore } from '@/stores/observe'
import { todayKey } from '@/stores/daily'
import { daysSinceEpoch } from '@/config/daily'
import { DAO_FROM_LABEL, daoEntries, daoLineOf } from '@/config/dao'
import { STARTUP_DAO_SLOTS, STARTUP_PERIOD, STARTUP_PROVERBS, type StartupProverb } from '@/config/proverbs'
import { ROUTES } from '@/router/routes'

/** 开屏停留时长：留足读完一句箴言的时间（点按屏幕可随时跳过） */
const HOLD_MS = 4000

/*
 * 句子池搬去了 `config/proverbs.ts`（2026-09-21）—— 文案不写在页面里是本项目的硬约定，
 * 这一处原先是个例外。池子里只有"别人的句子"：用户自己的句子走另外两条路，
 * 收藏过的（1/3/7 天回响）与他凝练过的道（`config/dao.ts`）。
 */

const appStore = useAppStore()

/** 皮肤跟随已保存的模式（normal / tech / dao），三种开屏随用户上次的选择出现 */
const skinClass = useSkinClass()

/** 页首顶距：状态栏真值 + 72rpx（原 `calc(var(--status-bar-height) + 72rpx)`，见 utils/safeArea.ts） */
const pageStyle = { paddingTop: `${safeTopPx(72)}px` }

/* ---------------- 今日这句：回响 → 按天排班（自己的道 / 池子加权挑一句） ---------------- */
const proverbs = useProverbStore()
const observe = useObserveStore()

/**
 * 偏好加权挑选：你记住的句子里某标签越多，同标签的新句子越容易在这儿出现。
 *
 * 用日期键播种，**不用 `Math.random`**：同一天里多次冷启动要抽到同一句 ——
 * 否则"今天就这一句"的仪式感没了（与 `config/dao.ts` 的按天定值同一条口径）。
 * 没有收藏记录时退化为等概率随机 —— 还没读懂你的偏好，就不假装读懂了。
 * 已收藏的不再进随机池：它们会走回响机制回来，在这儿重复撞见是浪费一屏。
 */
function pickWeighted(dateKey: string): StartupProverb {
  const liked = proverbs.tagPreference
  const pool = STARTUP_PROVERBS.filter((p) => !proverbs.has(p.text, 'startup'))
  const candidates = pool.length ? pool : STARTUP_PROVERBS
  const weights = candidates.map((p) => p.tags.reduce((w, t) => w + (liked[t] ?? 0), 1))
  const total = weights.reduce((a, b) => a + b, 0)
  const rnd = rngOf(seedOf(dateKey))
  let r = rnd() * total
  for (let i = 0; i < candidates.length; i += 1) {
    r -= weights[i]
    if (r <= 0) return candidates[i]
  }
  return candidates[candidates.length - 1]
}

/** 日期键 → 稳定种子（FNV-1a）：同一天永远同一个数，够散也够快 */
function seedOf(text: string): number {
  let h = 2166136261
  for (let i = 0; i < text.length; i += 1) {
    h ^= text.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  return h >>> 0
}

/** mulberry32：小、无依赖、够用 —— 只为把"当天抽到哪一句"钉死，不做密码用途 */
function rngOf(seed: number): () => number {
  let s = seed >>> 0
  return () => {
    s = (s + 0x6d2b79f5) >>> 0
    let t = s
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

interface TodayProverb {
  text: string
  from?: string
  tags?: string[]
  /** 有值 = 本次是回响（到期重看的旧句） */
  echoId?: number
  /** 回响第几阶（1/2/3） */
  echoStage?: number
  /** 有值 = 本次显示的是**自己凝的道**（不提供"记住这句"，改给一条回母题库的路） */
  mineId?: string
}

/**
 * 这一屏的日期键：**进页面时取一次、整页复用**。
 * 排班与回响结算必须看同一天 —— 各取一次会在跨零点的几毫秒里错开一整天。
 */
const pageDayKey = todayKey()

/**
 * 这一屏显示的句子，**进页面的那一刻就定住**。
 * 否则点一下「还在记着」，回响队列立刻变化，句子会在眼前跳走。
 */
const today = ref<TodayProverb>(resolveToday())

function resolveToday(): TodayProverb {
  const due = proverbs.dueReviews[0]
  if (due) {
    const stage = Math.min(due.reviewCount, REVIEW_DAYS.length - 1)
    return { text: due.text, from: due.from, tags: due.tags, echoId: due.id, echoStage: stage + 1 }
  }
  /*
   * 剩下的两种按天排班（周期与格数在 `config/proverbs.ts`）：
   * 每个周期里，前 `min(道数, STARTUP_DAO_SLOTS)` 天给自己的道，其余天回池子。
   *
   * 为什么不是"有就用、没有才回落"：那样只要凝过一条道，池子就再也不出现；
   * 只有一条道时更是同一句天天钉在扉页上（`天 % 1 = 0`，连轮换都算不上）。
   * 现在的写法让"自己的道"仍是主角（占多数格），但不把别人的句子饿死。
   *
   * 回响仍排在它俩前面 —— 那是你答应过要重看的。
   * 道那句出自 `config/dao.ts`，一天一句；出处带上母题名（title 是那个问句），
   * 让人想得起这句是从哪条道上凝的。
   */
  const daoCount = daoEntries(observe.mothers).length
  /*
   * 两个常量都先过一遍下限保护（配置是给人改的）：
   *   - 周期至少 1 天，否则 `% 0` 是 NaN，`slot` 恒为 NaN、池子与道都判不出来；
   *   - 道占的格数至少给池子留一格，否则有人把 DAO_SLOTS 改成 >= PERIOD 时
   *     池子会被彻底挤掉 —— 那正是这个排班要防的事，且会**静默**发生。
   * 当前配置（3 / 2）算出来与不保护时完全一致。
   */
  const period = Math.max(1, STARTUP_PERIOD)
  const daoSlots = Math.min(Math.max(0, STARTUP_DAO_SLOTS), period - 1)
  const slot = ((daysSinceEpoch(pageDayKey) % period) + period) % period
  if (slot < Math.min(daoCount, daoSlots)) {
    const mine = daoLineOf(pageDayKey, observe.mothers)
    if (mine) {
      return { text: mine.line, from: `${DAO_FROM_LABEL} · ${mine.name}`, tags: [], mineId: mine.id }
    }
  }
  return pickWeighted(pageDayKey)
}

/** 模板用：正文与出处 */
const proverb = computed(() => ({ text: today.value.text, from: today.value.from }))

/** 收藏状态与计数（结构化存储：正文 + 出处 + 来源，供后续回响/转知识卡使用） */
const faved = computed(() => proverbs.has(today.value.text, 'startup'))
const favCount = computed(() => proverbs.count)
/** 今天到点该重看的条数（回响队列长度） */
const dueCount = computed(() => proverbs.dueReviews.length)

/** 记住这句：连标签一起存 —— 往后的偏好加权全靠它 */
function onFav(): void {
  const on = proverbs.toggle({
    text: today.value.text,
    from: today.value.from,
    source: 'startup',
    tags: today.value.tags,
  })
  uni.showToast({ title: on ? '已记住 · 明天回来看你' : '已取消记住', icon: 'none' })
}

/**
 * 回响：「还在记着」= 显式确认还记得。
 *
 * 这一条若**还没结算**（自动结算一天只推一条，队列里多出来的那些仍到期）就当场推一阶；
 * 已经结算过（今天第一屏那条）就只给回执。`isDue` 正好兼作"防连点"：
 * 推完就不再到期，`today` 虽冻结、连点两下也不会连推两阶。
 * 天数从**推进后的真实状态**读（不再拿冻结的 `echoStage` 换算），两种情形都如实。
 */
function onReviewed(): void {
  const id = today.value.echoId
  if (!id) return
  const item = proverbs.byId(id)
  if (!item) return
  if (isDue(item)) proverbs.markReviewed(id)
  const done = reviewFinished(item)
  uni.showToast({
    title: done ? '这句已经是你的了' : `${REVIEW_DAYS[item.reviewCount]} 天后再来看你`,
    icon: 'none',
  })
}

/**
 * 开屏这句是用户自己的道：点它回母题库看那条道（改凝练句 / 看挂在它下面的内容）。
 * 先停表再跳 —— 否则跳走时倒计时还在跑，回来页面会自己再跳一次。
 */
function goMyDao(): void {
  stopTimers()
  uni.navigateTo({ url: ROUTES.observeMotherLib })
}

/* ---------------- 停留与跳过 ---------------- */
let timer: ReturnType<typeof setTimeout> | null = null
let tick: ReturnType<typeof setInterval> | null = null

/** 剩余毫秒（驱动倒计时与进度条） */
const leftMs = ref(HOLD_MS)
const leftSec = computed(() => Math.ceil(leftMs.value / 1000))
const progress = computed(() => Math.round(((HOLD_MS - leftMs.value) / HOLD_MS) * 100))

function stopTimers(): void {
  if (timer) {
    clearTimeout(timer)
    timer = null
  }
  if (tick) {
    clearInterval(tick)
    tick = null
  }
}

/** 跳往下一步 */
function go(): void {
  stopTimers()
  if (appStore.onboarded) {
    uni.switchTab({ url: ROUTES.tabObserve })
  } else {
    uni.reLaunch({ url: ROUTES.entryModeSelect })
  }
}

onLoad(() => {
  /*
   * 回响在**进页面时**结算（展示即推进、一天最多一条，规则在 `stores/proverb.ts`）。
   * 放在这里而不是 `resolveToday()` 里（那是纯取值，不该改状态），也不放在离页时 ——
   * 用户直接杀掉小程序时 `onUnload` 不一定跑，那条就白"见"了。
   */
  const id = today.value.echoId
  if (id) proverbs.settleEcho(pageDayKey, id)

  timer = setTimeout(go, HOLD_MS)
  tick = setInterval(() => {
    leftMs.value = Math.max(0, leftMs.value - 100)
    if (leftMs.value <= 0 && tick) {
      clearInterval(tick)
      tick = null
    }
  }, 100)
})

onUnload(() => {
  stopTimers()
})
</script>

<style lang="scss" scoped>
@import './startup.scss';
</style>

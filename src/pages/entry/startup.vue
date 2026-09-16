<template>
  <view class="startup" :class="skinClass" hover-class="none" @click="go">
    <!-- 品牌 -->
    <view class="startup__brand">
      <BrandSeal :size="84" />
      <text class="startup__name">观止知行</text>
      <text class="startup__en">INSIGHT · ACTION · DIGITAL PRACTICE</text>
    </view>

    <!-- 今日一签：有到期回响就重看旧的，没有才挑一句新的 -->
    <view class="startup__proverb">
      <text v-if="today.echoId" class="startup__echo">回响 · 第 {{ today.echoStage }} 次见面</text>
      <text class="startup__proverb-text">「{{ proverb.text }}」</text>
      <text v-if="proverb.from" class="startup__proverb-from">—— {{ proverb.from }}</text>

      <!-- 回响态：确认还记得，间隔就往后推一阶；普通态：收进「我的箴言」 -->
      <view
        v-if="today.echoId"
        class="startup__fav is-echo"
        hover-class="gz-hover"
        @click.stop="onReviewed"
      >
        <text class="startup__fav-icon">↻</text>
        <text class="startup__fav-label">还在记着</text>
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
 */
import { onLoad, onUnload } from '@dcloudio/uni-app'
import { computed, ref } from 'vue'
import { useAppStore } from '@/stores/app'
import { useSkinClass } from '@/composables/useSkin'
import { REVIEW_DAYS, reviewFinished, useProverbStore } from '@/stores/proverb'
import { ROUTES } from '@/router/routes'

/** 开屏停留时长：留足读完一句箴言的时间（点按屏幕可随时跳过） */
const HOLD_MS = 4000

interface Proverb {
  text: string
  from?: string
  /** 主题标签：记住这句时会一并存下，用来推算"你偏好看哪一类句子" */
  tags: string[]
}

/** 启动箴言库（内置初版；正式版按来源比例扩充：用户感悟30/古籍25/自定20/小枢原创15/道侣10） */
const PROVERBS: readonly Proverb[] = [
  { text: '知止而后有定，定而后能静', from: '《大学》', tags: ['收敛', '专注'] },
  { text: '少则得，多则惑', from: '《道德经》', tags: ['取舍', '专注'] },
  { text: '学而不思则罔，思而不学则殆', from: '《论语》', tags: ['学习', '自省'] },
  { text: '博学之，审问之，慎思之，明辨之，笃行之', from: '《中庸》', tags: ['学习', '行动'] },
  { text: '不贵其师，不爱其资，虽智大迷', from: '《道德经》', tags: ['学习', '自省'] },
  { text: '吾日三省吾身', from: '《论语》', tags: ['自省'] },
  { text: '注意力在哪里，人生就在哪里', from: '观止语录', tags: ['专注'] },
  { text: '看得多不是收获，用得上的才是', from: '观止语录', tags: ['取舍', '行动'] },
  { text: '慢一点，比较快', from: '观止语录', tags: ['收敛'] },
  { text: '把手机放下，把此刻拾起', from: '观止语录', tags: ['收敛', '专注'] },
]

const appStore = useAppStore()

/** 皮肤跟随已保存的模式（normal / tech / dao），三种开屏随用户上次的选择出现 */
const skinClass = useSkinClass()

/* ---------------- 今日这句：回响优先，否则按偏好加权挑一句 ---------------- */
const proverbs = useProverbStore()

/**
 * 偏好加权挑选：你记住的句子里某标签越多，同标签的新句子越容易在这儿出现。
 *
 * 没有收藏记录时退化为等概率随机 —— 还没读懂你的偏好，就不假装读懂了。
 * 已收藏的不再进随机池：它们会走回响机制回来，在这儿重复撞见是浪费一屏。
 */
function pickWeighted(): Proverb {
  const liked = proverbs.tagPreference
  const pool = PROVERBS.filter((p) => !proverbs.has(p.text, 'startup'))
  const candidates = pool.length ? pool : PROVERBS
  const weights = candidates.map((p) => p.tags.reduce((w, t) => w + (liked[t] ?? 0), 1))
  const total = weights.reduce((a, b) => a + b, 0)
  let r = Math.random() * total
  for (let i = 0; i < candidates.length; i += 1) {
    r -= weights[i]
    if (r <= 0) return candidates[i]
  }
  return candidates[candidates.length - 1]
}

interface TodayProverb {
  text: string
  from?: string
  tags?: string[]
  /** 有值 = 本次是回响（到期重看的旧句） */
  echoId?: number
  /** 回响第几阶（1/2/3） */
  echoStage?: number
}

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
  return pickWeighted()
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

/** 回响：「还在记着」把这条推进下一阶（1→3→7 天），走完就不再自动出现 */
function onReviewed(): void {
  const id = today.value.echoId
  if (!id) return
  proverbs.markReviewed(id)
  const item = proverbs.byId(id)
  const done = item ? reviewFinished(item) : true
  // echoStage（第几次见面）正好等于新的 reviewCount，也就是下一阶的天数下标
  const nextIdx = today.value.echoStage ?? 0
  uni.showToast({
    title: done ? '这句已经是你的了' : `${REVIEW_DAYS[nextIdx]} 天后再来看你`,
    icon: 'none',
  })
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

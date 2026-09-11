<template>
  <view class="page" :class="skinClass">
    <!-- 顶栏：返回 + 标题 + 跳过 -->
    <view class="nav">
      <view class="nav__side" hover-class="gz-hover" @click="goBack">
        <text class="nav__back">‹</text>
      </view>
      <text class="nav__title">首次测评 · {{ bank.title }}</text>
      <view class="nav__side nav__skip" hover-class="gz-hover" @click="skip">{{ skipLabel }}</view>
    </view>

    <!-- ===== 答题中 ===== -->
    <template v-if="screen === 'quiz'">
      <!-- 进度 -->
      <view class="prog">
        <view class="prog__bar">
          <view class="prog__fill" :style="{ width: `${progressPct}%` }" />
        </view>
        <text class="prog__text">第 {{ qIndex + 1 }} / {{ bank.questions.length }} 题 · {{ bank.intro }}</text>
      </view>

      <!-- 题目卡 -->
      <view class="qcard">
        <text class="qcard__text">{{ current.q }}</text>
        <view class="opts">
          <view
            v-for="(o, oi) in current.options"
            :key="oi"
            class="opt"
            :class="{ 'is-on': picked === oi }"
            hover-class="gz-hover"
            @click="picked = oi"
          >
            <view class="opt__dot" :class="{ 'is-on': picked === oi }">
              <view v-if="picked === oi" class="opt__dot-in" />
            </view>
            <text class="opt__text">{{ o.text }}</text>
          </view>
        </view>
      </view>

      <!-- 导航 -->
      <view class="qnav">
        <view v-if="qIndex > 0" class="qnav__prev" hover-class="gz-hover" @click="prev">上一题</view>
        <button class="qnav__next" :class="{ 'is-off': picked === null }" hover-class="gz-hover" @click="next">
          {{ isLast ? '建档完成' : '下一题' }}
        </button>
      </view>
    </template>

    <!-- ===== 结果 ===== -->
    <template v-else>
      <view class="done">
        <view class="done__seal" :class="`is-${result?.tier}`">{{ sealChar }}</view>
        <text class="done__eyebrow">{{ bank.title }} · 已建档</text>
        <text class="done__tier">{{ tierName }}</text>
        <view class="done__score">
          <text class="done__score-n">{{ result?.score }}</text>
          <text class="done__score-cap">/ {{ MAX_SCORE }} 分</text>
        </view>
        <text class="done__desc">{{ tierDesc }}</text>
        <text v-if="dateText" class="done__date">{{ dateText }} 建档</text>

        <view v-if="!canRetakeNow" class="done__cooldown">还剩 {{ remainDays }} 天可重测 · 这段时间先修行</view>
        <view v-else class="done__cooldown is-ok">间隔已满 · 可以重测一次看变化</view>

        <button class="cta" hover-class="gz-hover" @click="enterApp">
          {{ fromOnboard ? '开始修行' : '返回' }}
        </button>
        <view v-if="canRetakeNow" class="retake" hover-class="gz-hover" @click="retake">重新测评一次</view>
      </view>
    </template>
  </view>
</template>

<script setup lang="ts">
/**
 * 首次测评页（批次 C）：选完模式立刻建档（from=onboard），
 * 也可从「我 → 初始测评」进入——有档案则先看结果，满 30 天才可重测。
 */
import { computed, ref } from 'vue'
import { onLoad } from '@dcloudio/uni-app'
import { tierIndex, type AssessmentQuestion } from '@/config/assessment'
import { useAssessmentStore, type AssessmentResult } from '@/stores/assessment'
import { useContentStore } from '@/stores/content'
import { useModeStore } from '@/stores/mode'
import { useSkinClass } from '@/composables/useSkin'
import { ROUTES } from '@/router/routes'

const modeStore = useModeStore()
const assessment = useAssessmentStore()
const contentStore = useContentStore()
const skinClass = useSkinClass()

const fromOnboard = ref(false)

/** 题库：远端下发优先，接口不可用时回落到内置题库（见 stores/content.ts） */
const bank = computed(() => contentStore.bankOf(modeStore.id))

/** 满分跟着题量走：题数由内容运营位决定，不再是写死的 18 */
const MAX_SCORE = computed(() => bank.value.questions.length * 3)
const existing = computed(() => assessment.get(modeStore.id))

type Screen = 'quiz' | 'result'
const screen = ref<Screen>('quiz')

const qIndex = ref(0)
/** 每题选中的选项下标；null = 未选 */
const picks = ref<(number | null)[]>(bank.value.questions.map(() => null))

const current = computed<AssessmentQuestion>(() => bank.value.questions[qIndex.value])
const picked = computed<number | null>({
  get: () => picks.value[qIndex.value],
  set: (v) => {
    picks.value[qIndex.value] = v
  },
})
const isLast = computed(() => qIndex.value === bank.value.questions.length - 1)
const progressPct = computed(() => Math.round(((qIndex.value + 1) / bank.value.questions.length) * 100))

const skipLabel = computed(() => (fromOnboard.value ? '跳过' : ''))

/* —— 结果展示（来自存档或刚完成） —— */
const result = ref<AssessmentResult | null>(null)
const canRetakeNow = ref(true)
const remainDays = ref(0)
const dateText = ref('')

const tierName = computed(() => bank.value.tierNames[tierIndex(result.value?.tier ?? 'low')])
const tierDesc = computed(() => bank.value.tierDescs[tierIndex(result.value?.tier ?? 'low')])
const sealChar = computed(() =>
  result.value?.tier === 'high' ? '高' : result.value?.tier === 'mid' ? '中' : '初',
)

onLoad((query) => {
  fromOnboard.value = query?.from === 'onboard'
  const r = assessment.get(modeStore.id)
  if (r) {
    showResult(r)
  } else {
    screen.value = 'quiz'
  }
})

function showResult(r: AssessmentResult): void {
  result.value = r
  screen.value = 'result'
  canRetakeNow.value = assessment.canRetake(modeStore.id)
  remainDays.value = assessment.retakeRemainDays(modeStore.id)
  if (r.takenAt) {
    const d = new Date(r.takenAt)
    dateText.value = `${d.getFullYear()} 年 ${d.getMonth() + 1} 月 ${d.getDate()} 日`
  }
}

function next(): void {
  if (picked.value === null) return
  if (isLast.value) {
    const score = picks.value.reduce<number>((sum, p, i) => {
      const v = p ?? 0
      return sum + bank.value.questions[i].options[v].score
    }, 0)
    // 分档阈值同样跟着内容运营位走（默认 <=6 低 / >=13 高）
    assessment.save(modeStore.id, score, contentStore.tierOf(score))
    const r = assessment.get(modeStore.id)
    if (r) showResult(r)
  } else {
    qIndex.value += 1
  }
}

function prev(): void {
  if (qIndex.value > 0) qIndex.value -= 1
}

function retake(): void {
  picks.value = bank.value.questions.map(() => null)
  qIndex.value = 0
  screen.value = 'quiz'
}

function enterApp(): void {
  if (fromOnboard.value) {
    uni.switchTab({ url: ROUTES.tabObserve })
  } else {
    const pages = getCurrentPages()
    if (pages.length > 1) {
      uni.navigateBack()
    } else {
      uni.switchTab({ url: ROUTES.tabMe })
    }
  }
}

function skip(): void {
  if (!fromOnboard.value) return
  uni.switchTab({ url: ROUTES.tabObserve })
}

function goBack(): void {
  const pages = getCurrentPages()
  if (pages.length > 1) {
    uni.navigateBack()
  } else {
    uni.switchTab({ url: fromOnboard.value ? ROUTES.tabObserve : ROUTES.tabMe })
  }
}
</script>

<style lang="scss" scoped>
.page {
  min-height: 100vh;
  padding: calc(var(--status-bar-height) + 16rpx) $gz-page-pad 70rpx;
  box-sizing: border-box;
}

.nav {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 8rpx 0 10rpx;
}

.nav__side {
  width: 120rpx;
  height: 76rpx;
}

.nav__back {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 76rpx;
  height: 76rpx;
  border: 1rpx solid $gz-line;
  border-radius: 50%;
  background: $gz-surface;
  color: $gz-ink-2;
  font-size: 52rpx;
  line-height: 1;
  padding-bottom: 8rpx;
}

.nav__skip {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  font-size: $gz-fs-small;
  color: $gz-ink-3;
}

.nav__title {
  font-size: 32rpx;
  font-weight: 700;
  letter-spacing: 0.06em;
  color: $gz-ink;
}

/* 进度 */
.prog {
  margin-top: 16rpx;
}

.prog__bar {
  height: 10rpx;
  border-radius: 999rpx;
  background: var(--gz-line-soft);
  overflow: hidden;
}

.prog__fill {
  height: 100%;
  border-radius: 999rpx;
  background: linear-gradient(90deg, $gz-accent, $gz-grad-to);
  transition: width 0.35s ease;
}

.prog__text {
  display: block;
  margin-top: 14rpx;
  font-size: $gz-fs-caption;
  color: $gz-ink-3;
}

/* 题目卡 */
.qcard {
  margin-top: 22rpx;
  padding: 36rpx 30rpx;
  background: $gz-surface;
  border: 1rpx solid $gz-line;
  border-radius: $gz-radius-lg;
}

.qcard__text {
  display: block;
  font-size: 36rpx;
  font-weight: 700;
  line-height: 1.6;
  color: $gz-ink;
}

.opts {
  margin-top: 30rpx;
  display: flex;
  flex-direction: column;
  gap: 18rpx;
}

.opt {
  display: flex;
  align-items: center;
  gap: 20rpx;
  padding: 24rpx 26rpx;
  border: 1rpx solid $gz-line;
  border-radius: $gz-radius-md;
  background: $gz-input-bg;
}

.opt.is-on {
  border-color: $gz-accent;
  background: $gz-accent-soft;
}

.opt__dot {
  flex: none;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 36rpx;
  height: 36rpx;
  border: 2rpx solid $gz-ink-3;
  border-radius: 50%;
}

.opt__dot.is-on {
  border-color: $gz-accent;
}

.opt__dot-in {
  width: 18rpx;
  height: 18rpx;
  border-radius: 50%;
  background: $gz-accent;
}

.opt__text {
  font-size: $gz-fs-small;
  line-height: 1.6;
  color: $gz-ink-2;
}

.opt.is-on .opt__text {
  color: $gz-ink;
  font-weight: 600;
}

/* 导航 */
.qnav {
  display: flex;
  align-items: stretch; /* 上一题/下一题等高，避免一高一矮 */
  justify-content: space-between;
  gap: 20rpx;
  margin-top: 30rpx;
}

/**
 * 上一题 / 下一题共用外观。
 * ⚠️ App.vue 对 <button> 做了全局重置（padding / line-height / border-radius 全部清零），
 * 所以 <button> 必须自己给 padding 或 min-height，否则高度只剩一行文字（≈48rpx），
 * 比旁边的 <view> 矮近一半，且是直角。
 */
.qnav__prev,
.qnav__next {
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 92rpx; /* 与题目选项 .opt 同一视觉高度 */
  padding: 0 40rpx;
  border-radius: $gz-radius-md;
  line-height: 1.4;
}

.qnav__prev {
  flex: none;
  border: 1rpx solid $gz-line;
  color: $gz-ink-3;
  font-size: $gz-fs-small;
}

.qnav__next {
  flex: 1;
  margin: 0;
  background: $gz-accent;
  color: $gz-on-cta;
  font-size: $gz-fs-body;
  font-weight: 600;
}

.qnav__next.is-off {
  opacity: 0.45;
}

/* 结果 */
.done {
  display: flex;
  flex-direction: column;
  align-items: center;
  margin-top: 40rpx;
}

.done__seal {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 150rpx;
  height: 150rpx;
  border-radius: 34rpx;
  font-size: 68rpx;
  font-weight: 800;
  background: $gz-accent-soft;
  color: $gz-accent;
  border: 3rpx solid $gz-accent;
  transform: rotate(-6deg);
}

.done__seal.is-high {
  background: rgba(196, 96, 46, 0.14);
  color: #b25a2c;
  border-color: #b25a2c;
}

.done__eyebrow {
  margin-top: 36rpx;
  font-size: $gz-fs-caption;
  letter-spacing: 0.16em;
  color: $gz-ink-3;
}

.done__tier {
  margin-top: 14rpx;
  font-size: 60rpx;
  font-weight: 800;
  letter-spacing: 0.04em;
  color: $gz-accent;
}

.done__score {
  margin-top: 18rpx;
  display: flex;
  align-items: baseline;
  gap: 8rpx;
}

.done__score-n {
  font-size: 48rpx;
  font-weight: 800;
  color: $gz-ink;
}

.done__score-cap {
  font-size: $gz-fs-caption;
  color: $gz-ink-3;
}

.done__desc {
  margin-top: 26rpx;
  max-width: 560rpx;
  font-size: $gz-fs-small;
  line-height: 1.9;
  text-align: center;
  color: $gz-ink-2;
}

.done__date {
  margin-top: 18rpx;
  font-size: $gz-fs-caption;
  color: $gz-ink-3;
}

.done__cooldown {
  margin-top: 18rpx;
  padding: 12rpx 28rpx;
  border-radius: 999rpx;
  background: var(--gz-line-soft);
  font-size: $gz-fs-caption;
  color: $gz-ink-3;
}

.done__cooldown.is-ok {
  background: $gz-accent-soft;
  color: $gz-accent;
}

.cta {
  width: 100%;
  margin-top: 44rpx;
  /* button 的 padding/border-radius 被 App.vue 全局重置过，这里必须显式补回（对齐 mode-select 的 .cta） */
  padding: 28rpx 0;
  border-radius: $gz-radius-md;
  background: $gz-cta-bg;
  color: $gz-on-cta;
  font-size: $gz-fs-body;
  font-weight: 600;
  letter-spacing: 0.14em;
  line-height: 1.4;
}

.retake {
  margin-top: 26rpx;
  padding: 14rpx 40rpx;
  border: 1rpx solid $gz-line;
  border-radius: $gz-radius-md;
  font-size: $gz-fs-small;
  color: $gz-ink-3;
}
</style>

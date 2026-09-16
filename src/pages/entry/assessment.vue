<template>
  <view class="page" :class="skinClass">
    <!-- 顶栏：返回 + 标题 + 跳过 -->
    <view class="nav">
      <view class="nav__side" hover-class="gz-hover" @click="goBack">
        <text class="nav__back">‹</text>
      </view>
      <text class="nav__title">{{ navTitle }}</text>
      <!-- 答题全程都有出口（结果屏不再显示，免得误点） -->
      <view v-if="screen === 'quiz'" class="nav__side nav__skip" hover-class="gz-hover" @click="skip">
        {{ skipLabel }}
      </view>
    </view>

    <!-- ===== 答题中 ===== -->
    <template v-if="screen === 'quiz'">
      <!-- 进度 -->
      <view class="prog">
        <view class="prog__bar">
          <view class="prog__fill" :style="{ width: `${progressPct}%` }" />
        </view>
        <!-- 「约 1 分钟」写在每一屏上：把"又一堆题"的预期压到最低 -->
        <text class="prog__text">
          第 {{ qIndex + 1 }} / {{ bank.questions.length }} 题 · {{ p('assess.cost') }} · {{ bank.intro }}
        </text>
      </view>

      <!-- 题目卡 -->
      <view class="qcard">
        <!--
          时间锚：先说清「按哪段时间回答」，再问问题。
          顺序为什么是题干在上、探测什么时期的字在下 —— 因为「回想最近 7 天」这种
          提示写成小字放在题干下方，不会喧宾夺主，却能在用户读题时产生影响：
          他是去数次数，而不是凭印象给自己打分。
        -->
        <text class="qcard__text">{{ current.q }}</text>
        <text class="qcard__win">{{ windowNote }}</text>
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
        <view v-if="qIndex > 0" class="qnav__prev" hover-class="gz-hover" @click="prev">
          {{ p('assess.prev') }}
        </view>
        <button class="qnav__next" :class="{ 'is-off': picked === null }" hover-class="gz-hover" @click="next">
          {{ isLast ? submitLabel : p('assess.next') }}
        </button>
      </view>

      <!-- 第一题下方再给一个看得见的出口：右上角的小字太容易被忽略 -->
      <view v-if="qIndex === 0" class="qskip" hover-class="gz-hover" @click="skip">
        {{ p('assess.skipBottom') }}
      </view>
    </template>

    <!-- ===== 结果 ===== -->
    <template v-else>
      <view class="done">
        <view class="done__seal gz-motion" :class="`is-${result?.tier}`">{{ sealChar }}</view>
        <text class="done__eyebrow">{{ bank.title || '本次' }} · 已建档</text>
        <text class="done__tier">{{ tierName }}</text>
        <view class="done__score">
          <text class="done__score-n">{{ result?.score ?? '—' }}</text>
          <text class="done__score-cap">/ {{ maxScore || '—' }} 分 · {{ scorePct }}%</text>
        </view>
        <text class="done__desc">{{ tierDesc }}</text>

        <!--
          可信度：先回答「这份结论能当真几分」，再谈别的。
          一个没有可信度的分数，用户要么全信、要么全不信，两种都很糟 ——
          这里把判断依据（完整性 / 一致性 / 作答节奏）交还给用户自己看。
        -->
        <view class="conf" :class="`is-${confidence}`">
          <view class="conf__head">
            <text class="conf__label">{{ p('assess.confLabel') }}</text>
            <text class="conf__tag">{{ confTag }}</text>
          </view>
          <text class="conf__note">{{ confNote }}</text>
        </view>

        <!-- 维度分布：同样是 8 次点击，给出一张图而不只是一个数字 —— 直接指向「下一步练哪一维」 -->
        <view v-if="dimRows.length" class="dims">
          <text class="dims__title">{{ p('assess.dimTitle') }}</text>
          <view v-for="d in dimRows" :key="d.key" class="dimrow">
            <view class="dimrow__head">
              <text class="dimrow__label">
                {{ d.label }}<text v-if="d.count" class="dimrow__count"> · {{ d.count }} 题</text>
              </text>
              <text class="dimrow__val">{{ d.score }} / {{ d.max }}</text>
            </view>
            <view class="dimrow__bar">
              <view class="dimrow__fill" :style="{ width: `${d.pct}%` }" />
            </view>
          </view>
        </view>

        <!--
          下一步：只给最弱的一维，一次一条具体的动作。
          给四条建议等于没给 —— 人一次只会执行一件，剩下的只会变成负罪感。
        -->
        <view v-if="nextStep" class="step">
          <text class="step__title">{{ p('assess.nextStep') }}</text>
          <text class="step__dim">{{ nextStep.label }}</text>
          <text class="step__text">{{ nextStep.text }}</text>
        </view>

        <!-- 与上次对比：两次以上建档才有；比的是归一化得分，题库改版后照样能比 -->
        <text v-if="trendText" class="done__trend">{{ trendText }}</text>

        <!-- 作答质量提示：低质量不判废、不清零，只提示并建议 30 天后重测 -->
        <view v-if="qualityNote" class="done__qual">
          <text class="done__qual-text">{{ qualityNote }}</text>
        </view>

        <text v-if="dateText" class="done__date">{{ dateText }} 建档</text>

        <view v-if="!canRetakeNow" class="done__cooldown">还剩 {{ remainDays }} 天可重测 · 这段时间先修行</view>
        <view v-else class="done__cooldown is-ok">间隔已满 · 可以重测一次看变化</view>

        <button class="cta" hover-class="gz-hover" @click="enterApp">
          {{ (fromOnboard ? p('start.cta') : p('back.cta')) || '返回' }}
        </button>
        <view v-if="canRetakeNow" class="retake" hover-class="gz-hover" @click="retake">
          {{ p('retake.cta') }}
        </view>
      </view>
    </template>

    <!--
      跳过建档的二次确认。
      产品取舍：不拦人，但要把「不建档也能用」和「会缺什么、怎么补」一次讲清 ——
      含糊的"确定要跳过吗"会让人以为整款应用被锁住，反而更焦虑。
    -->
    <GzDialog
      :show="askSkip"
      :skin="modeStore.id"
      :banner="false"
      :title="p('assess.skipTitle')"
      :note="p('assess.skipNote')"
      :cancel-text="p('assess.skipCancel')"
      :confirm-text="p('assess.skipConfirm')"
      @cancel="askSkip = false"
      @confirm="confirmSkip"
    />
  </view>
</template>

<script setup lang="ts">
/**
 * 首次测评页（批次 C）：选完模式立刻建档（from=onboard），
 * 也可从「我 → 初始测评」进入——有档案则先看结果，满 30 天才可重测。
 */
import { computed, ref, watch } from 'vue'
import { onLoad } from '@dcloudio/uni-app'
import {
  bankMax,
  evaluate,
  extremeDims,
  tierIndex,
  DEFAULT_WINDOW_NOTE,
  type AssessmentQuestion,
  type AssessConfidence,
  type AssessDim,
  type AssessTiming,
} from '@/config/assessment'
import type { PhraseKey } from '@/config/phrases'
import { useAssessmentStore, type AssessmentResult } from '@/stores/assessment'
import { useContentStore } from '@/stores/content'
import { useModeStore } from '@/stores/mode'
import { useSkinClass } from '@/composables/useSkin'
import { ROUTES } from '@/router/routes'
import { useDimLabel } from '@/composables/usePhrase'

const modeStore = useModeStore()
const assessment = useAssessmentStore()
const contentStore = useContentStore()
const skinClass = useSkinClass()

const fromOnboard = ref(false)

/** 题库：远端下发优先，接口不可用时回落到内置题库（见 stores/content.ts） */
const bank = computed(() => contentStore.bankOf(modeStore.id))

/** 主题化取词：答题按钮与结果页动作随模式换说法（下一题/下一项/继续问心 …） */
const p = (key: PhraseKey): string => contentStore.phraseOf(key, modeStore.id)

/** 四维标签（结果页维度分布的轴名）：符号固定，职能词随模式 */
const dl = useDimLabel()

/** 满分跟着题库走：各题选项最高分之和（允许运营侧写 0-2 分的题，不再假定每题 3 分） */
const maxScore = computed(() => bankMax(bank.value))

type Screen = 'quiz' | 'result'
const screen = ref<Screen>('quiz')

const qIndex = ref(0)
/** 每题选中的选项下标；null = 未选 */
const picks = ref<(number | null)[]>(bank.value.questions.map(() => null))

/**
 * 每题停留时长（毫秒）—— 只用于识别「题没读完就点完了」的作答。
 * 不传也不会出错：evaluate() 发现没有足够的计时数据就不把「作答节奏」计入可信度。
 */
const dwellMs = ref<number[]>(bank.value.questions.map(() => 0))
/** 当前题的进入时刻（计时起点） */
const enteredAt = ref(Date.now())

/**
 * 远端题库可能晚于本页初始化到达：题量一旦变化就重建答题数组。
 * 否则会出现「最后两题根本答不了」或「多余的答案被丢弃」——两种都很难排查。
 */
watch(
  () => bank.value.questions.length,
  (n) => {
    if (n <= 0) return
    if (picks.value.length !== n) picks.value = Array.from({ length: n }, () => null)
    if (dwellMs.value.length !== n) dwellMs.value = Array.from({ length: n }, () => 0)
    if (qIndex.value > n - 1) qIndex.value = Math.max(0, n - 1)
  },
)

const current = computed<AssessmentQuestion>(() => bank.value.questions[qIndex.value])
const picked = computed<number | null>({
  get: () => picks.value[qIndex.value],
  set: (v) => {
    picks.value[qIndex.value] = v
  },
})
const isLast = computed(() => qIndex.value === bank.value.questions.length - 1)

/** 题干旁的时间锚：题目可自带 hint（如「按 7 天平均估算」），缺省用题库统一口径 */
const windowNote = computed(() => current.value.hint || bank.value.windowNote || DEFAULT_WINDOW_NOTE)

/** 记下当前题停留了多久 —— 离开这一题（前进或后退）时调用 */
function stampDwell(): void {
  dwellMs.value[qIndex.value] = Math.max(1, Date.now() - enteredAt.value)
}

/** 重新计时：切到另一题后立刻调用 */
function resetClock(): void {
  enteredAt.value = Date.now()
}

/** 交给 evaluate() 的作答节奏数据 */
const timing = (): AssessTiming => ({ perQuestion: dwellMs.value })

/** 最后一题的提交按钮文案：三模式不同（远端可改，缺省「建档完成」） */
const submitLabel = computed(() => bank.value.submitLabel || '建档完成')

/**
 * 顶部标题：直接用题库名（三模式天然不同：生活基线 / 数字画像 / 灵根检测）。
 * 已有的档案重新作答时标「重测」——不再一律写「首次测评」（那在重测场景是错的）。
 */
const isRetake = computed(() => screen.value === 'quiz' && !!assessment.get(modeStore.id))
const navTitle = computed(() => `${bank.value.title}${isRetake.value ? ' · 重测' : ''}`)
const progressPct = computed(() => Math.round(((qIndex.value + 1) / bank.value.questions.length) * 100))

/**
 * 「跳过」也随模式换说法（跳过 / 略过 / 不测也罢）。
 *
 * ⚠️ 只看"是否在答题中"，**不再依赖 `?from=onboard`** ——
 * 之前靠这个参数决定显不显示，一旦参数缺失（开发者工具直接编译到本页、
 * 或从「我」页进来补测），按钮就变成一个看不见的空条，等于没有跳过入口。
 * 参数现在的唯一作用是决定跳过之后去哪（引导流程 → 大厅；补测 → 退回原页）。
 */
const skipLabel = computed(() => p('assess.skip'))

/* —— 结果展示（来自存档或刚完成） —— */
const result = ref<AssessmentResult | null>(null)
const canRetakeNow = ref(true)
const remainDays = ref(0)
const dateText = ref('')
/** 跳过确认弹窗是否打开 */
const askSkip = ref(false)

/** 得分率：用存档里的满分算（老存档按 18 分归档），题库换版后也说得通 */
const scorePct = computed(() => {
  const r = result.value
  if (!r) return 0
  const max = r.maxScore || maxScore.value
  return max > 0 ? Math.round((r.score / max) * 100) : 0
})

/** 维度分布（固定按「观止知行」排序；老存档没有维度数据 → 空数组，模板自动不渲染） */
const dimRows = computed(() =>
  (result.value?.dims ?? []).map((d) => ({
    key: d.dim,
    /* 标签走主题化取词（同一维度在科技模式显示「观 · 摄入」、修仙显示「观 · 鉴源」） */
    label: dl(d.dim),
    score: d.score,
    max: d.max,
    count: d.count,
    pct: d.max > 0 ? Math.round((d.score / d.max) * 100) : 0,
  })),
)

/** 与上次对比：比的是归一化得分之差（题库改版后唯一仍可比的量） */
const trendText = computed(() => {
  const t = assessment.trendOf(modeStore.id)
  if (!t) return p('assess.trendFirst')
  const dPct = Math.round(t.deltaRatio * 100)
  return `${p('assess.trend')} ${dPct > 0 ? '+' : ''}${dPct}%`
})

/** 作答质量提示：低质量不判废、不清零，只提示并建议 30 天后重测 */
const qualityNote = computed(() => {
  const q = result.value?.quality
  if (q === 'straight') return p('assess.qualityStraight')
  if (q === 'inconsistent') return p('assess.qualityInconsistent')
  if (q === 'hasty') return p('assess.qualityHasty')
  return ''
})

/* —— 可信度：告诉用户这份结论能多当真 —— */
const confidence = computed<AssessConfidence>(() => result.value?.confidence ?? 'high')
const confTag = computed(() => (confidence.value === 'high' ? '高' : confidence.value === 'mid' ? '中' : '低'))
const confNote = computed(() =>
  p(
    confidence.value === 'high'
      ? 'assess.confHigh'
      : confidence.value === 'mid'
        ? 'assess.confMid'
        : 'assess.confLow',
  ),
)

/** 下一步练哪一维度 → 取哪条建议（四选一，不并列给） */
const ADVICE_KEY: Record<AssessDim, PhraseKey> = {
  observe: 'advice.observe',
  pause: 'advice.pause',
  reflect: 'advice.reflect',
  action: 'advice.action',
}

/**
 * 下一步动作：只看**最弱的一维**，且要求它与最强一维确有差距（≥8%）。
 * 差距太小还硬要指名个别维度，等于把噪声当建议 —— 那种建议用户照做也看不到效果。
 */
const nextStep = computed(() => {
  const weakest = extremeDims(result.value?.dims ?? []).weakest
  if (!weakest) return null
  return { label: dl(weakest), text: p(ADVICE_KEY[weakest]) }
})

/* 称号与描述：题库缺字段时给占位符，绝不渲染成空白（空白卡片比"未记录"更让人困惑） */
const tierName = computed(() => bank.value.tierNames?.[tierIndex(result.value?.tier ?? 'low')] || '本次结果')
const tierDesc = computed(() => bank.value.tierDescs?.[tierIndex(result.value?.tier ?? 'low')] || '')
const sealChar = computed(() =>
  result.value?.tier === 'high' ? '高' : result.value?.tier === 'mid' ? '中' : '初',
)

onLoad((query) => {
  fromOnboard.value = query?.from === 'onboard'
  const r = assessment.get(modeStore.id)
  /**
   * 只有"结构完整"的存档才直接展示结果页。
   * 老结构存档（没有 score / tier）若也走结果页，会渲染出一张全空的卡片 ✗，
   * 那种情况直接进答题反而正确 —— 等于提示用户重测一次。
   */
  if (r && typeof r.score === 'number' && r.tier) {
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
  // 先结掉当前题的计时，再判断是否收尾 —— 顺序反了会漏掉最后一题
  stampDwell()
  if (isLast.value) {
    /*
     * 计分统一走 evaluate()：比例分档 + 逐题满分 + 维度分布 + 作答质量一次算清。
     * 结果页、「我」页入口、历史对比都读同一份结论，不会再出现"各处各算一套"。
     * 第三个参数带上作答节奏，用于（且仅用于）判定这次结论能多当真。
     */
    const evaluated = evaluate(bank.value, picks.value, contentStore.tiers(), timing())
    showResult(assessment.save(modeStore.id, evaluated))
  } else {
    qIndex.value += 1
    resetClock()
  }
}

function prev(): void {
  if (qIndex.value <= 0) return
  stampDwell()
  qIndex.value -= 1
  resetClock()
}

function retake(): void {
  picks.value = bank.value.questions.map(() => null)
  dwellMs.value = bank.value.questions.map(() => 0)
  qIndex.value = 0
  resetClock()
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

/**
 * 跳过：先弹确认，把「不建档也能用」与「会缺什么、怎么补」一次讲清。
 * 注意这里**不设任何功能锁** —— 产品态度是「少即是多」，不是「不填就惩罚」。
 * 含糊的「确定要跳过吗」会让人以为整款应用被锁住，反而更焦虑。
 */
function skip(): void {
  askSkip.value = true
}

function confirmSkip(): void {
  askSkip.value = false
  // 记一笔跳过时间：之后只温和提醒（隔 2 天起、每 3 天一次），不做每日骚扰
  assessment.markSkipped(modeStore.id)
  uni.showToast({ title: p('assess.skipDone'), icon: 'none', duration: 2200 })
  setTimeout(() => {
    // 引导流程来 → 直接进大厅；从「我」页来补测 → 退回原页（保持来路）
    if (fromOnboard.value) uni.switchTab({ url: ROUTES.tabObserve })
    else goBack()
  }, 420)
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
@import './assessment.scss';
</style>

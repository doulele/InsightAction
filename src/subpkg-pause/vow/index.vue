<template>
  <view class="page" :class="skinClass">
        <SubNav :fallback="ROUTES.tabPause">立约</SubNav>

    <!--
      ① 在守的长约（2026-09-23 加）：禁欲这类"需要毅力"的长期承诺。
      它走的是「行 · 计划」的日课（cadence=daily + challenge=abstain），**不是** vow 的第二份数据 ——
      这里显示的与日课页是同一个 store 的同一份状态，两处都能点，不会各记一套账。
      （之所以敢放两处入口：数据只有一份，操作都落回 plan store。）
    -->
    <view v-if="longVows.length" class="longs">
      <view class="longs__head">
        <text class="longs__label">在守的长约</text>
        <text class="longs__hint">每天来点一下 · 断了不清零</text>
      </view>

      <view v-for="p in longVows" :key="p.id" class="lv">
        <view class="lv__top">
          <text class="lv__title">{{ p.title }}</text>
          <text v-if="p.challenge" class="lv__tag">{{ challengeText(p) }}</text>
          <text v-if="p.status !== 'active'" class="lv__tag">已收束</text>
        </view>

        <view class="bar">
          <view class="bar__fill" :style="{ width: `${plan.progressOf(p).pct}%` }" />
        </view>
        <view class="lv__meta">
          <text class="lv__days">
            守住 {{ plan.progressOf(p).done }} / {{ plan.progressOf(p).total }} 天
          </text>
          <text v-if="plan.dailyStreak(p) > 1" class="lv__streak">
            已连续 {{ plan.dailyStreak(p) }} 天
          </text>
        </view>

        <!--
          里程碑刻度：按**累计**守住天数点亮，只增不减。
          断一天会让"已连续"退回去，但这里不会 —— 那是它能给人成就感的前提。
        -->
        <view class="ms">
          <view
            v-for="m in VOW_MILESTONES"
            :key="m"
            class="ms__item"
            :class="{ 'is-on': plan.progressOf(p).done >= m }"
          >
            <text class="ms__n">{{ m }}</text>
            <text class="ms__cap">天</text>
          </view>
        </view>

        <view v-if="p.status === 'active'" class="lv__acts">
          <view
            class="lv__btn"
            :class="{ 'is-on': stateOf(p.id) === 'kept' }"
            hover-class="gz-hover"
            @click="keepLong(p)"
          >
            {{ stateOf(p.id) === 'kept' ? '今天守住了' : '今天守住' }}
          </view>
          <view
            class="lv__btn lv__btn--break"
            :class="{ 'is-on': stateOf(p.id) === 'broken' }"
            hover-class="gz-hover"
            @click="askBreakLong(p)"
          >
            {{ stateOf(p.id) === 'broken' ? '今天破了' : '破了' }}
          </view>
        </view>
        <text v-else class="lv__done">守满就是走完了 —— 想再来一次，去「行 · 计划」立新的。</text>
      </view>
    </view>

    <!-- ② 今天的约（当日档，仍是本页的主角） -->
    <view class="head">
      <text class="head__eyebrow">只立今天 · {{ today }}</text>
      <text class="head__title">{{ headTitle }}</text>
      <text class="head__sub">{{ headSub }}</text>
    </view>

    <!-- 未立：三要素表单 -->
    <view v-if="!vow.todayVow" class="form">
      <!-- 照昨天的立：禁欲这类事天天重填三要素太烦 -->
      <view v-if="yesterday" class="again" hover-class="gz-hover" @click="fillFromYesterday">
        <view class="again__body">
          <text class="again__label">照昨天的立</text>
          <text class="again__text">{{ yesterday.promise }}</text>
        </view>
        <text class="again__go">填回 ›</text>
      </view>

      <view class="field">
        <text class="field__label">① 触发条件 · 什么时候会发生</text>
        <input
          v-model="trigger"
          class="field__input"
          placeholder="例如：今天 22 点后"
          placeholder-class="field__ph"
          :maxlength="20"
        />
      </view>
      <view class="field">
        <text class="field__label">② 我承诺（不做 / 做什么）</text>
        <input
          v-model="promise"
          class="field__input"
          placeholder="例如：不看短视频"
          placeholder-class="field__ph"
          :maxlength="20"
        />
      </view>
      <view class="field">
        <text class="field__label">③ 替代动作 · 那时手往哪放</text>
        <input
          v-model="alternative"
          class="field__input"
          placeholder="例如：改看两页书，或直接去洗漱"
          placeholder-class="field__ph"
          :maxlength="24"
        />
      </view>

      <!--
        守多久（2026-09-23）：只今天走当日档；选天数则立成**戒断长约**（去「行 · 计划」的日课）。
        两条档刻意分开 —— 当日档讲"今天这一件事"，长约讲"要守多久"，混成一条会两头都不像。
      -->
      <view class="span">
        <text class="span__label">守多久</text>
        <view class="span__chips">
          <view
            class="span__chip"
            :class="{ 'is-on': span === 'today' }"
            hover-class="gz-hover"
            @click="span = 'today'"
          >
            只今天
          </view>
          <view
            v-for="n in VOW_LONG_PRESETS"
            :key="n"
            class="span__chip"
            :class="{ 'is-on': span === n }"
            hover-class="gz-hover"
            @click="span = n"
          >
            守住 {{ n }} 天
          </view>
        </view>
        <text class="span__hint">{{ spanHint }}</text>
      </view>

      <view class="btn" hover-class="gz-hover" @click="askCommit">
        {{ span === 'today' ? '立下今天的约' : `立下这条 ${span} 天的长约` }}
      </view>
      <text class="form__note">
        三个都填才立得住 —— 只说「不做」而不说「改成什么」，多半会在同一个时间点再破一次。
      </text>
    </view>

    <!-- 已立：三要素 + 回看 -->
    <template v-else>
      <view class="card">
        <view class="card__row">
          <text class="card__k">触发条件</text>
          <text class="card__v">{{ vow.todayVow.trigger }}</text>
        </view>
        <view class="card__row">
          <text class="card__k">我承诺</text>
          <text class="card__v">{{ vow.todayVow.promise }}</text>
        </view>
        <view class="card__row">
          <text class="card__k">替代动作</text>
          <text class="card__v">{{ vow.todayVow.action }}</text>
        </view>
      </view>

      <template v-if="vow.todayVow.status === 'open'">
        <view class="review">
          <text class="review__label">今天过得怎么样？</text>
          <view class="review__acts">
            <view class="review__btn review__btn--keep" hover-class="gz-hover" @click="doKeep">
              守住了
            </view>
            <view class="review__btn review__btn--break" hover-class="gz-hover" @click="askBreakToday">
              破了
            </view>
          </view>
          <text class="review__note">回看一次就好，不用写长文。破了也不用愧疚 —— 写下为什么就够了。</text>
        </view>
      </template>

      <view v-else class="result" :class="`is-${vow.todayVow.status}`">
        <text class="result__title">{{ vow.todayVow.status === 'kept' ? '守住了' : '破了 · 原因已记下' }}</text>
        <text v-if="vow.todayVow.reason" class="result__reason">{{ vow.todayVow.reason }}</text>
        <text class="result__note">
          {{ vow.todayVow.status === 'kept' ? '明天的同一时刻，再守一次。' : '这句已经进了「知」的省察 —— 知道自己为什么破，比没破更有价值。' }}
        </text>
        <view class="result__reset" hover-class="gz-hover" @click="doReset">立错了？换一条</view>
      </view>

      <!--
        情境化省察（规格 §4.3）：只有「破了」才有这一问。
        守住了不追问 —— 那就变成每天必答的打卡，恰恰是省察要避开的（§4.3 / §13.1）。
      -->
      <SceneProbe v-if="vow.todayVow.status === 'broken'" scene="vow" :anchor="lastAnchor" />
    </template>

    <!-- 统计 -->
    <view class="tally">
      <view class="tally__item">
        <text class="tally__n">{{ vow.tally.kept }}</text>
        <text class="tally__cap">守住</text>
      </view>
      <view class="tally__item">
        <text class="tally__n">{{ vow.tally.broken }}</text>
        <text class="tally__cap">破过</text>
      </view>
      <view class="tally__item">
        <text class="tally__n">{{ vow.tally.missed }}</text>
        <text class="tally__cap">没回看</text>
      </view>
      <view class="tally__item">
        <text class="tally__n">{{ vow.keepStreak }}</text>
        <text class="tally__cap">连守天数</text>
      </view>
    </view>

    <!-- 历史 -->
    <view v-if="vow.history.length" class="section">
      <view class="section__title">回看记录</view>
      <view class="hist">
        <view v-for="h in vow.history" :key="h.day" class="hist__row">
          <text class="hist__day">{{ shortDay(h.day) }}</text>
          <text class="hist__promise">{{ h.promise }}</text>
          <text class="hist__badge" :class="`is-${h.missed ? 'miss' : h.status}`">{{ statusText(h) }}</text>
        </view>
      </view>
    </view>

    <text class="foot">不扣修为 · 不断连胜 · 不写愧疚话术 —— 立约只做一件事：让「不做」有一个具体的替代。</text>

    <!-- 破约理由（必填）：当日档与长约共用同一个弹层，靠 breakPlanId 区分 -->
    <view v-if="breakOpen" class="overlay" @touchmove.stop.prevent @click="breakOpen = false">
      <view class="sheet" @click.stop>
        <text class="sheet__title">{{ breakTitle }}</text>
        <text class="sheet__q">一句就够。它会被记进「知」的省察里。</text>
        <textarea
          v-model="reason"
          class="sheet__ta"
          :maxlength="80"
          placeholder="例如：加班回来太累，躺着就刷到了 1 点"
          placeholder-class="field__ph"
        />
        <text v-if="!reason.trim()" class="sheet__hint">不写这句话就不能结算 —— 这是立约唯一强制的一步。</text>
        <view class="sheet__row">
          <view class="sheet__btn sheet__btn--ghost" hover-class="gz-hover" @click="breakOpen = false">取消</view>
          <view class="sheet__btn" :class="{ 'is-off': !reason.trim() }" hover-class="gz-hover" @click="doBreak">
            记住了
          </view>
        </view>
      </view>
    </view>

    <!--
      落印前的确认（2026-09-23）：把这份"约"整张摊开给你看一遍，确认后才写下。
      仪式感就落在这里 —— 不是加一段动画，而是"按下之前你得先看清自己答应了什么"。
    -->
    <GzDialog
      :show="confirmOpen"
      :title="confirmTitle"
      :banner="false"
      cancel-text="再想想"
      confirm-text="立下"
      @cancel="confirmOpen = false"
      @confirm="doCommit"
    >
      <view class="pact">
        <view class="pact__row">
          <text class="pact__k">触发条件</text>
          <text class="pact__v">{{ trigger }}</text>
        </view>
        <view class="pact__row">
          <text class="pact__k">我承诺</text>
          <text class="pact__v">{{ promise }}</text>
        </view>
        <view class="pact__row">
          <text class="pact__k">替代动作</text>
          <text class="pact__v">{{ alternative }}</text>
        </view>
        <view class="pact__row">
          <text class="pact__k">守多久</text>
          <text class="pact__v">{{ span === 'today' ? '只今天，晚上回看一次' : `${span} 天 · 每天来点一下「守住」` }}</text>
        </view>
      </view>
    </GzDialog>
  </view>
</template>

<script setup lang="ts">
/**
 * 止 · 立约（分包 subpkg-pause）—— 规格 v2 §4.2 + 2026-09-23 的「长约」扩展。
 *
 * 两条档，刻意分开（这是本页最要紧的一条口径）：
 *  · **今天的约**（`stores/vow.ts`）：只立当天、晚上回看一次、破了必须写一句为什么。
 *    它的四条铁律一个字没动 —— 它就该是"今天这一件事"。
 *  · **长约**（走「行 · 计划」的日课）：7 / 30 / 100 天的戒断承诺（禁欲这类需要毅力的事）。
 *    **没有新建数据结构**：它本来就是 `cadence='daily'` + `challenge='abstain'` 的日课，
 *    立约页只是把入口与看板放到用户找得到的地方（想立长久的约，第一反应是来这里）。
 *    所以这一页的进度 / 守住 / 破了操作的都是 plan store —— 与日课页同一份数据，不存在两份账。
 *
 * 仪式感与成就感（2026-09-23）：
 *  · 落印前把整份"约"摊在弹框里看一遍，确认后才写下；写下那一刻给一记声音；
 *  · 长约带进度条 + 当前连续天数 + 7 / 21 / 30 / 100 里程碑刻度（按累计守住天数点亮，只增不减）。
 *
 * 其余口径不变：不扣修为、不中断连胜、不写愧疚类文案。
 * 样式外置在 vow/index.scss（超过 100 行，按项目约定拆出）。
 */
import { computed, ref } from 'vue'
import { CHALLENGE_LABEL } from '@/config/lexicon'
import { useVowStore, VOW_LONG_PRESETS, VOW_MILESTONES, type Vow } from '@/stores/vow'
import { usePlanStore, type Plan } from '@/stores/plan'
import { useSettingsStore } from '@/stores/settings'
import { useSkinClass } from '@/composables/useSkin'
import SceneProbe from '@/components/SceneProbe/SceneProbe.vue'
import GzDialog from '@/components/GzDialog/GzDialog.vue'
import { playCue } from '@/utils/audio'
import { todayKey } from '@/stores/daily'
import { ROUTES } from '@/router/routes'
import { showModal } from '@/utils/dialog'

const vow = useVowStore()
const plan = usePlanStore()
const settings = useSettingsStore()
const skinClass = useSkinClass()

const today = todayKey()
vow.ensureToday()

/* ---------------- 在守的长约（戒断型日课） ---------------- */

/**
 * 只看**戒断型**（abstain）：另两型（try 去做一件事 / cog 推翻一个判断）不是"忍住不做"，
 * 摆到立约页会稀释这个页面在讲的事。要立它们去「行 · 计划」。
 */
const longVows = computed<Plan[]>(() => plan.dailyPlans.filter((p) => p.challenge === 'abstain'))

/** 今天各条日课的状态（'' = 还没记；未记不等于破了） */
const todayStates = computed(() => {
  const map = new Map<number, '' | 'kept' | 'broken'>()
  for (const d of plan.dailyToday()) map.set(d.planId, d.state)
  return map
})

function stateOf(planId: number): '' | 'kept' | 'broken' {
  return todayStates.value.get(planId) ?? ''
}

function challengeText(p: Plan): string {
  return p.challenge ? CHALLENGE_LABEL[p.challenge] : ''
}

/** 今天守住（再点一次 = 取消今天这一笔，与日课页同一语义） */
function keepLong(p: Plan): void {
  const res = plan.checkDaily(p.id)
  if (res.closed) {
    uni.showToast({ title: `守满 ${plan.progressOf(p).total} 天 · 这条长约走完了`, icon: 'none' })
    return
  }
  uni.showToast({ title: res.done ? '今天守住了' : '已退回今天这一笔', icon: 'none' })
}

/* ---------------- 头部 ---------------- */

const headTitle = computed(() => {
  const v = vow.todayVow
  if (!v) return '今天，你想守住什么？'
  if (v.status === 'open') return '这一条已经立下'
  return v.status === 'kept' ? '今日已守住' : '今日破了一次'
})

const headSub = computed(() => {
  const v = vow.todayVow
  if (!v) return '三句话，一分钟。今天结束时回来看一次。'
  if (v.status === 'open') return '晚上睡前回到这里，点一下「守住了」或「破了」。'
  return '明天可以再立一条 —— 立约一天一条，不累积。'
})

/* ---------------- 立约表单 ---------------- */

const trigger = ref('')
const promise = ref('')
const alternative = ref('')

/** 守多久：'today' = 当日档；数字 = 长约天数（走日课） */
const span = ref<'today' | number>('today')

const spanHint = computed(() =>
  span.value === 'today'
    ? '只今天这一条 —— 今晚回来看一次，守住 / 破了都说一声。'
    : `会立成一条 ${span.value} 天的戒断长约：每天来这一页点一下「守住」，进度与里程碑就在上面。`,
)

/** 昨天那条（已归档的最近一条）——「照昨天的立」的来源 */
const yesterday = computed<Vow | null>(() => vow.history[0] ?? null)

function fillFromYesterday(): void {
  const y = yesterday.value
  if (!y) return
  trigger.value = y.trigger
  promise.value = y.promise
  alternative.value = y.action
  uni.showToast({ title: '已照昨天那份填好 · 改一改再立', icon: 'none' })
}

/* ---------------- 落印（确认 → 写入 → 一记） ---------------- */

const confirmOpen = ref(false)

const confirmTitle = computed(() =>
  span.value === 'today' ? '立下今天的约？' : `立下这条 ${span.value} 天的长约？`,
)

/** 先过校验再弹确认 —— 三个空没填满时不该走到"看约"那一步 */
function askCommit(): void {
  if (!trigger.value.trim() || !promise.value.trim() || !alternative.value.trim()) {
    uni.showToast({ title: '三个空都要填 —— 少一个就立不住', icon: 'none' })
    return
  }
  confirmOpen.value = true
}

function doCommit(): void {
  confirmOpen.value = false

  if (span.value === 'today') {
    if (!vow.open(trigger.value, promise.value, alternative.value)) return
    afterCommit('已立下 · 收下这 10 点修为')
    return
  }

  /* 长约落到「行 · 计划」的日课：challenge=abstain，三要素进 note（那里是它的住处） */
  const days = span.value
  const created = plan.addPlan({
    title: promise.value.trim(),
    note: `${trigger.value.trim()} → 改做：${alternative.value.trim()}`,
    kind: 'long',
    challenge: 'abstain',
    cadence: 'daily',
    targetDays: days,
  })
  if (!created) {
    uni.showToast({ title: '没能立上 —— 看看日课是不是已经到上限了', icon: 'none' })
    return
  }
  afterCommit(`已立下 ${days} 天 · 第 1 天从今天开始`)
}

/** 立下之后的同一个收尾：清空表单 + 一记声音（仪式感的落脚点） */
function afterCommit(message: string): void {
  trigger.value = ''
  promise.value = ''
  alternative.value = ''
  span.value = 'today'
  if (settings.soundOn) playCue('open')
  uni.showToast({ title: message, icon: 'none' })
}

/* ---------------- 回看 ---------------- */

function doKeep(): void {
  if (vow.keep()) uni.showToast({ title: '守住了 · 15 点修为入账', icon: 'none' })
}

const breakOpen = ref(false)
const reason = ref('')
/** 正被"破了"的是哪一条：null = 今天的约；数字 = 某条长约的计划 id */
const breakPlanId = ref<number | null>(null)
/** 破约的溯源锚点（破约后才有值） */
const lastAnchor = ref('')

const breakTitle = computed(() =>
  breakPlanId.value !== null ? '长约破了一次，为什么？' : '破了这一次，为什么？',
)

/** 今天的约：破了 */
function askBreakToday(): void {
  breakPlanId.value = null
  reason.value = ''
  breakOpen.value = true
}

/** 长约：破了（与当日档同一口径 —— 必须写一句为什么，那句进「知」的省察） */
function askBreakLong(p: Plan): void {
  breakPlanId.value = p.id
  reason.value = ''
  breakOpen.value = true
}

function doBreak(): void {
  const r = reason.value.trim()
  if (!r) return

  const planId = breakPlanId.value
  if (planId !== null) {
    if (!plan.markDailyBroken(planId, r)) return
    reason.value = ''
    breakPlanId.value = null
    breakOpen.value = false
    uni.showToast({ title: '已记下 · 这句进了「知」', icon: 'none' })
    return
  }

  if (vow.breakIt(r)) {
    reason.value = ''
    breakOpen.value = false
    lastAnchor.value = `vow-${vow.todayVow?.createdAt ?? Date.now()}`
    uni.showToast({ title: '已记下 · 这句进了「知」', icon: 'none' })
  }
}

function doReset(): void {
  showModal({
    title: '重新立一条？',
    content: '今天的这条回看记录会一并撤掉。',
    confirmText: '重立',
    cancelText: '算了',
    success: (res) => {
      if (res.confirm) vow.reset()
    },
  })
}

/* ---------------- 展示 ---------------- */

function shortDay(day: string): string {
  const [, m, d] = day.split('-')
  return `${Number(m)}/${Number(d)}`
}

function statusText(v: Vow): string {
  if (v.missed) return '没回看'
  return v.status === 'kept' ? '守住' : '破了'
}
</script>

<style lang="scss" scoped>
@import './index.scss';
</style>

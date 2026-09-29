<template>
  <view class="page" :class="skinClass">
        <SubNav :fallback="ROUTES.tabAction">{{ w.plan }}</SubNav>

    <!-- 日课 / 短期 / 中期 / 长期 -->
    <view class="tabs">
      <view
        v-for="t in TABS"
        :key="t.id"
        class="tab"
        :class="{ 'is-on': tab === t.id }"
        hover-class="gz-hover"
        @click="tab = t.id"
      >
        {{ t.label }}
        <text v-if="t.id === 'daily' && dailyList.length" class="tab__n">{{ dailyTodayKept }}/{{ dailyList.length }}</text>
        <text v-else-if="isHorizonTab(t.id) && horizonCount(t.id)" class="tab__n">{{ horizonCount(t.id) }}</text>
      </view>
    </view>

    <!--
      2026-09-29：这里原本还有一档「今日」（三件事之外的步子 + 待办池），整块搬去了
      独立页「待办 · 备忘」（入口在行大厅三件事正下方）—— 那一页才是"多出来的事写哪儿"
      的答案。计划页从这天起只管"路"：日课 / 短期 / 中期 / 长期。

      日课（2026-09-17）：早睡 / 锻炼 / 戒色这类"每天重复一次"的事。
      与长路分开一栏、分开计数（各 3 条）：一条"30 天早睡"和一条"重做作品集"占的心智不是一回事。
    -->
    <template v-if="tab === 'daily'">
      <text class="horizon-note">{{ w.dailyNote }}</text>

      <view v-if="dailyList.length">
        <view
          v-for="p in dailyList"
          :key="p.id"
          class="plan"
          :class="{ 'is-off': p.status !== 'active' }"
          hover-class="gz-hover"
          @click="openDetail(p)"
        >
          <view class="plan__head">
            <text class="plan__title">{{ p.title }}</text>
            <text v-if="p.challenge" class="plan__tag">{{ challengeLabel(p) }}</text>
            <text class="plan__status">{{ statusLabel(p) }}</text>
          </view>
          <text v-if="p.note" class="plan__note">{{ p.note }}</text>
          <view class="bar">
            <view class="bar__fill" :style="{ width: `${plan.progressOf(p).pct}%` }" />
          </view>
          <view class="plan__meta">
            <text class="plan__progress">{{ w.dailyProgress(plan.progressOf(p).done, plan.progressOf(p).total) }}</text>
            <text class="plan__next">{{ dailyTodayText(p) }}</text>
          </view>
        </view>
      </view>

      <view v-else class="empty">
        <view class="empty__seal">课</view>
        <text class="empty__text">{{ w.emptyDaily }}</text>
      </view>

      <view class="add" hover-class="gz-hover" @click="openNew">
        <text class="add__mark">＋</text>
        <text class="add__text">{{ w.newDaily }}</text>
      </view>
      <text class="add__cap">{{ w.dailyCap }}</text>
    </template>

    <!-- 短期 / 中期 / 长期：同一套列表，只是按期限档筛过 -->
    <template v-else>
      <text v-if="horizonNote" class="horizon-note">{{ horizonNote }}</text>

      <view v-if="staleList.length" class="stale">
        <text class="stale__text">{{ w.stale }}</text>
      </view>

      <!-- 入门挑战（规格 §11 · 行：三类各一个）。只给从没立过长路的人 —— 有过长路，就不再是"入门" -->
      <view v-if="isStarter" class="starter">
        <text class="starter__title">第一次不知道走什么？三条现成的</text>
        <view
          v-for="c in STARTER_CHALLENGES"
          :key="c.id"
          class="starter__row"
          hover-class="gz-hover"
          @click="startChallenge(c)"
        >
          <text class="starter__tag">{{ CHALLENGE_LABEL[c.id] }}</text>
          <view class="starter__body">
            <text class="starter__name">{{ c.title }}</text>
            <text class="starter__note">{{ c.note }}</text>
          </view>
          <text class="starter__go">立它 ›</text>
        </view>
      </view>

      <view v-if="!horizonList.length" class="empty">
        <view class="empty__seal">划</view>
        <text class="empty__text">{{ emptyText }}</text>
      </view>

      <view
        v-for="p in horizonList"
        :key="p.id"
        class="plan"
        :class="{ 'is-off': p.status !== 'active' }"
        hover-class="gz-hover"
        @click="openDetail(p)"
      >
        <view class="plan__head">
          <text class="plan__title">{{ p.title }}</text>
          <text v-if="p.challenge" class="plan__tag">{{ challengeLabel(p) }}</text>
          <text class="plan__status">{{ statusLabel(p) }}</text>
        </view>
        <text v-if="p.note" class="plan__note">{{ p.note }}</text>
        <view class="bar">
          <view class="bar__fill" :style="{ width: `${plan.progressOf(p).pct}%` }" />
        </view>
        <view class="plan__meta">
          <text class="plan__progress">{{ w.progress(plan.progressOf(p).done, plan.progressOf(p).total) }}</text>
          <text v-if="nextTitle(p)" class="plan__next">{{ w.next }} · {{ nextTitle(p) }}</text>
        </view>
        <text v-if="dueText(p)" class="plan__due">{{ dueText(p) }}</text>
      </view>

      <view class="add" hover-class="gz-hover" @click="openNew">
        <text class="add__mark">＋</text>
        <text class="add__text">{{ newLabel }}</text>
      </view>
      <text class="add__cap">三档合计上限 {{ MAX_LONG_ACTIVE }} 条 —— {{ w.cap }}</text>
    </template>

    <!-- 新建长路 / 新建日课 -->
    <view v-if="newOpen" class="overlay" @touchmove.stop.prevent @click="newOpen = false">
      <view class="sheet" @click.stop>
        <text class="sheet__title">{{ newLabel }}</text>
        <input v-model="newTitle" class="sheet__input" placeholder="这条路叫什么" placeholder-class="quick__ph" :maxlength="20" />
        <input v-model="newNote" class="sheet__input" placeholder="为什么走它 / 走成什么样（选填）" placeholder-class="quick__ph" :maxlength="40" />

        <!-- 日课：要的是"守住多少天"，不是期限档 -->
        <template v-if="isDailyTab">
          <text class="sheet__label">{{ w.targetLabel }}</text>
          <view class="chips">
            <view
              v-for="n in DAILY_PRESETS"
              :key="n"
              class="chip"
              :class="{ 'is-on': !customOn && newTarget === n }"
              hover-class="gz-hover"
              @click="pickPreset(n)"
            >
              {{ w.days(n) }}
            </view>
            <!-- 自定义天数（2026-09-17）：3 ~ 365 天，超出取边界值，不静默丢弃 -->
            <view class="chip" :class="{ 'is-on': customOn }" hover-class="gz-hover" @click="toggleCustom">自定义</view>
          </view>
          <view v-if="customOn" class="custom">
            <input
              v-model="customDays"
              class="custom__input"
              type="number"
              :maxlength="3"
              :placeholder="`${DAILY_MIN_DAYS} ~ ${DAILY_MAX_DAYS}`"
              placeholder-class="quick__ph"
              @input="onCustomInput"
            />
            <text class="custom__unit">天</text>
          </view>
          <text class="sheet__hint">{{ targetHint }}</text>
        </template>

        <template v-else>
          <text class="sheet__label">期限档</text>
          <view class="chips">
            <view
              v-for="h in HORIZONS"
              :key="h.id"
              class="chip"
              :class="{ 'is-on': newHorizon === h.id }"
              hover-class="gz-hover"
              @click="newHorizon = h.id"
            >
              {{ h.label }}
            </view>
          </view>
          <text class="sheet__hint">{{ HORIZON_DESC[newHorizon] }}</text>
        </template>

        <text class="sheet__label">挑战类型（选填）</text>
        <view class="chips">
          <view
            v-for="c in CHALLENGES"
            :key="c.id"
            class="chip"
            :class="{ 'is-on': newChallenge === c.id }"
            hover-class="gz-hover"
            @click="toggleChallenge(c.id)"
          >
            {{ c.label }}
          </view>
        </view>
        <text v-if="newChallenge" class="sheet__hint">{{ channelDesc(newChallenge) }}</text>
        <view class="sheet__row">
          <view class="btn btn--ghost" hover-class="gz-hover" @click="newOpen = false">先不立</view>
          <view class="btn" hover-class="gz-hover" @click="savePlan">立下</view>
        </view>
      </view>
    </view>

    <PlanReflect :show="!!reflectPlan" :plan="reflectPlan" @confirm="onReflectConfirm" @skip="onReflectSkip" />
  </view>
</template>

<script setup lang="ts">
/**
 * 行 · 计划列表（分包 subpkg-action）—— 日课 / 短期 / 中期 / 长期四个视图。
 *
 * 三档 = 在走的路按**期限**分开看：短期一周内、中期一个月内、长期更久或不定日子；
 * 「日课」是另一条轴（每天重复一次，见 stores/plan.ts 的 cadence），与三档并列。
 * 期限存 Plan.horizon（立路时定下，不随日子流逝自己换档，见 stores/plan.ts 的注释）。
 * 计分与收束规则全部在 stores/plan.ts 里闭环，本页只负责展示与转发。
 *
 * 2026-09-29：「今日」那一档（三件事之外的步子 + 待办池）搬去了独立页「待办 · 备忘」——
 * 那一页才是"多出来的事写哪儿"的答案，这一页从此只管"路"。
 * 样式外置在 plans/index.scss（超过 100 行，按项目约定拆出）。
 */
import { computed, ref } from 'vue'
import { onShow } from '@dcloudio/uni-app'
import {
  usePlanStore,
  MAX_LONG_ACTIVE,
  DAILY_PRESETS,
  DAILY_DEFAULT_DAYS,
  DAILY_MIN_DAYS,
  DAILY_MAX_DAYS,
  type Plan,
  type ChallengeType,
  type PlanHorizon,
} from '@/stores/plan'
import { CHALLENGE_DESC, CHALLENGE_LABEL, HORIZON_DESC, HORIZON_LABEL, planWords } from '@/config/lexicon'
import { useModeStore } from '@/stores/mode'
import { useSkinClass } from '@/composables/useSkin'
import { navigateTo, ROUTES } from '@/router/routes'

const plan = usePlanStore()
const mode = useModeStore()
const skinClass = useSkinClass()
const w = computed(() => planWords(mode.id))

/**
 * 期限三档 + 日课；tab 的 id 直接复用 PlanHorizon，省一层映射。
 * 「日课」（2026-09-17）是另一条轴：它没有期限档，只有"守住 N 天"。
 *
 * 2026-09-29：原来的第一档「今日」整块搬去了独立页「待办 · 备忘」，
 * 这一页只剩"路" —— 默认落在「日课」（它与长路同级，都是已经在走的东西）。
 */
type TabId = 'daily' | PlanHorizon

/** tab 名随模式（"日课 / 每日任务 / 日行"—— 见 config/lexicon.ts 的 PlanWords） */
const TABS = computed<ReadonlyArray<{ id: TabId; label: string }>>(() => [
  { id: 'daily', label: w.value.daily },
  { id: 'short', label: HORIZON_LABEL.short },
  { id: 'mid', label: HORIZON_LABEL.mid },
  { id: 'long', label: HORIZON_LABEL.long },
])

/** 期限三档的 tab（日课不算） */
function isHorizonTab(id: TabId): id is PlanHorizon {
  return id !== 'daily'
}
const HORIZONS: ReadonlyArray<{ id: PlanHorizon; label: string }> = (
  ['short', 'mid', 'long'] as PlanHorizon[]
).map((id) => ({ id, label: HORIZON_LABEL[id] }))
const CHALLENGES: Array<{ id: ChallengeType; label: string }> = (
  ['abstain', 'try', 'cog'] as ChallengeType[]
).map((id) => ({ id, label: CHALLENGE_LABEL[id] }))

const tab = ref<TabId>('daily')

onShow(() => {
  /*
   * 搁置满 3 天的 today 型计划自动收走（静默，不打扰）。
   * 这一页已经不展示它们了，但收走的动作仍在行大厅与「待办 · 备忘」的 onShow 里跑 ——
   * 留在这里只是"顺手对齐一次"，不依赖它。
   */
  plan.sweep()
})

/* ---------------- 日课（2026-09-17） ---------------- */
const dailyList = computed<Plan[]>(() => plan.dailyPlans)
const dailyTodayKept = computed(() => plan.dailyToday().filter((d) => d.state === 'kept').length)

/** 今天这条日课的状态：还没记 / 守住了 / 破了 —— 未记不写成"未完成"（那是审判） */
function dailyTodayText(p: Plan): string {
  if (p.status !== 'active') return ''
  const st = plan.checkOf(p)?.state
  if (st === 'kept') return w.value.keptAct
  if (st === 'broken') return `${w.value.brokenAct} · 明天照常`
  return w.value.notYet
}

/* ---------------- 短期 / 中期 / 长期 ---------------- */
/** 当前这一档的路（进行中在前，已收束 / 已收起在后） */
const horizonList = computed<Plan[]>(() => (isHorizonTab(tab.value) ? plan.horizonPlans(tab.value) : []))

/** 当前这一档还在走几条（tab 徽标） */
function horizonCount(h: PlanHorizon): number {
  return plan.horizonActiveCount(h)
}

/** 当前这一档的一句话说明（放在列表最上面，说清这一档是什么） */
const horizonNote = computed<string>(() => (isHorizonTab(tab.value) ? HORIZON_DESC[tab.value] : ''))

/** 空态：长期沿用原来的话，另两档按档名生成 */
const emptyText = computed<string>(() =>
  tab.value === 'long' ? w.value.emptyLong : w.value.emptyHorizon(isHorizonTab(tab.value) ? HORIZON_LABEL[tab.value] : ''),
)

/** 正在新建的是不是日课（弹层里据此换掉"期限档"那一组选项） */
const isDailyTab = computed(() => tab.value === 'daily')

/** 「立一条…」按钮与弹层标题：长期用原话，另两档带上档名，日课走自己的话 */
const newLabel = computed<string>(() => {
  if (tab.value === 'daily') return w.value.newDaily
  if (isHorizonTab(tab.value)) return `立一条${HORIZON_LABEL[tab.value]}的路`
  return w.value.newLong
})

const staleList = computed(() =>
  isHorizonTab(tab.value) ? plan.staleLong().filter((p) => plan.horizonOf(p) === tab.value) : [],
)

function challengeLabel(p: Plan): string {
  return p.challenge ? CHALLENGE_LABEL[p.challenge] : ''
}

function statusLabel(p: Plan): string {
  if (p.status === 'done') return w.value.statusDone
  if (p.status === 'archived') return w.value.statusArchived
  return w.value.statusActive
}

function nextTitle(p: Plan): string {
  return p.status === 'active' ? plan.nextNodeOf(p)?.title ?? '' : ''
}

function dueText(p: Plan): string {
  if (!p.dueDay) return ''
  const remain = plan.remainDaysOf(p)
  if (remain === null) return ''
  if (remain > 0) return `目标日 ${p.dueDay} · 还剩 ${remain} 天`
  if (remain === 0) return `今天是目标日 ${p.dueDay}`
  return `目标日 ${p.dueDay} 已过 ${-remain} 天`
}

function openDetail(p: Plan): void {
  navigateTo(ROUTES.actionPlanDetail, { id: p.id })
}

/* ---------------- 新建 ---------------- */
const newOpen = ref(false)
const newTitle = ref('')
const newNote = ref('')
const newChallenge = ref<ChallengeType | undefined>(undefined)
const newHorizon = ref<PlanHorizon>('long')
/** 日课的目标天数（只在「日课」档的新建弹层里用） */
const newTarget = ref<number>(DAILY_DEFAULT_DAYS)
/** 自定义天数是否展开（展开时预设 chip 不显示选中，避免"两个都选中"） */
const customOn = ref(false)
const customDays = ref('')

/** 预设 chip：点了就收起自定义，让"现在到底按哪个数走"一目了然 */
function pickPreset(n: number): void {
  newTarget.value = n
  customOn.value = false
}

function toggleCustom(): void {
  customOn.value = !customOn.value
  if (customOn.value) customDays.value = String(newTarget.value)
}

/**
 * 自定义输入 → 目标天数。
 * 越界取边界值（3 ~ 365）而不是拒绝：用户输入 500 时把它变成 365，比弹一句错更难懂。
 * 只在真越界时把值回写进输入框，否则不打断输入（不然打"1"就立刻被改成 3，没法往下打）。
 */
function onCustomInput(): void {
  const raw = Number(customDays.value)
  if (!Number.isFinite(raw) || raw <= 0) return
  const v = Math.round(raw)
  newTarget.value = Math.min(DAILY_MAX_DAYS, Math.max(DAILY_MIN_DAYS, v))
  if (raw !== newTarget.value) customDays.value = String(newTarget.value)
}

/** 目标天数的说明：跟着当前值走，避免用户以为自己选的还是预设那一档 */
const targetHint = computed(() =>
  customOn.value
    ? `自己定 ${DAILY_MIN_DAYS} ~ ${DAILY_MAX_DAYS} 天 · 现在按 ${newTarget.value} 天算`
    : '勾满这天数就收束；中途想改随时能改（改了不清记录）',
)

/**
 * 打开新建弹层：在哪一档点的「＋」，期限档就默认那一档 ——
 * 让用户在「短期」页立路时不用再回头选一次。今日页没有档，默认长期。
 */
function openNew(): void {
  newHorizon.value = isHorizonTab(tab.value) ? tab.value : 'long'
  /* 弹层是共用的，每次打开都把日课那组状态复位，避免上次开着的自定义输入框留到这一次 */
  customOn.value = false
  customDays.value = ''
  newOpen.value = true
}

function toggleChallenge(id: ChallengeType): void {
  newChallenge.value = newChallenge.value === id ? undefined : id
}

function channelDesc(id: ChallengeType): string {
  return CHALLENGE_DESC[id]
}

/* ---------------- 入门挑战（规格 §11 · 三类各一个） ---------------- */

/**
 * 只预填、不代立：点了把它填进新建表单（标题 / 缘由 / 挑战类型），
 * 用户自己看过、改过、亲手按「立下」—— 代用户立下的路，走不远。
 */
const STARTER_CHALLENGES: ReadonlyArray<{
  id: ChallengeType
  title: string
  note: string
  horizon: PlanHorizon
}> = [
  {
    id: 'abstain',
    title: '七天睡前不刷手机',
    note: '不靠忍，靠放远：睡前把它放到够不着的地方',
    horizon: 'short',
  },
  {
    id: 'try',
    title: '七天，每天出门走 20 分钟',
    note: '不求快，只求出门。走成什么样，七天后回来收束回望',
    horizon: 'short',
  },
  {
    id: 'cog',
    title: '推翻一个「我一直这么认为」',
    note: '挑一个你从不怀疑的说法，认真替它找反例',
    horizon: 'short',
  },
]

/** 从没立过长路（含已收束）才算入门 —— 立过第一条，路就该是他自己的了 */
const isStarter = computed(() => !plan.plans.some((p) => p.kind === 'long'))

function startChallenge(c: { id: ChallengeType; title: string; note: string; horizon: PlanHorizon }): void {
  newTitle.value = c.title
  newNote.value = c.note
  newChallenge.value = c.id
  newHorizon.value = c.horizon
  newOpen.value = true
}

function savePlan(): void {
  const daily = isDailyTab.value
  const created = plan.addPlan({
    title: newTitle.value,
    note: newNote.value,
    kind: 'long',
    challenge: newChallenge.value,
    horizon: newHorizon.value,
    cadence: daily ? 'daily' : 'steps',
    targetDays: daily ? newTarget.value : undefined,
  })
  if (!created) {
    if (!newTitle.value.trim()) uni.showToast({ title: '先给它起个名字', icon: 'none' })
    return
  }
  newTitle.value = ''
  newNote.value = ''
  newChallenge.value = undefined
  newHorizon.value = 'long'
  newTarget.value = DAILY_DEFAULT_DAYS
  customOn.value = false
  customDays.value = ''
  newOpen.value = false
  uni.showToast({ title: daily ? '已立下 · 今天就可以开始守' : '已立下 · 去拆成几步吧', icon: 'none' })
  navigateTo(ROUTES.actionPlanDetail, { id: created.id })
}

/* ---------------- 收束回望 ---------------- */
const reflectPlan = ref<Plan | null>(null)

function onReflectConfirm(text: string): void {
  const p = reflectPlan.value
  reflectPlan.value = null
  if (!p) return
  if (plan.writeReflection(p.id, text)) {
    uni.showToast({ title: '这句已存进【知】', icon: 'none' })
  } else {
    uni.showToast({ title: '这条长路走完了', icon: 'none' })
  }
}

function onReflectSkip(): void {
  reflectPlan.value = null
  uni.showToast({ title: '这条长路走完了', icon: 'none' })
}

</script>

<style lang="scss" scoped>
@import './index.scss';
</style>

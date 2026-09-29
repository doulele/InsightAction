<template>
  <view class="page" :class="skinClass">
    <!-- 顶栏：标题 + 一行"这儿干嘛的"（副标题走 SubNav 的两行版） -->
    <SubNav :fallback="ROUTES.tabAction" :subtitle="w.sub">{{ w.title }}</SubNav>

    <!--
      与「今日三件事」的分工（页面第一句，也是这一页存在的原因）：
      不进 config 的话，用户看不出"这里和三件事有什么不一样"。
    -->
    <text class="intro">{{ w.intro }}</text>

    <!--
      常驻输入框 —— 整页第一件东西，不藏在按钮或弹层后面。
      默认进「以后」：这一页要接的正是"不一定今天做"的事（今天那三件在行大厅已经够了）。
    -->
    <view class="quick">
      <input
        v-model="draft"
        class="quick__input"
        :placeholder="w.inputPh"
        placeholder-class="quick__ph"
        :maxlength="MEMO_TEXT_MAX"
        confirm-type="done"
        @confirm="add"
      />
      <view class="quick__btn" hover-class="gz-hover" @click="add">{{ w.addAct }}</view>
    </view>

    <!-- 整页空态：这是新用户看到的唯一一句话，必须把"不会丢"说出来 -->
    <view v-if="empty" class="empty">
      <view class="empty__seal">{{ w.mark }}</view>
      <text class="empty__text">{{ w.emptyAll }}</text>
    </view>

    <template v-else>
      <!--
        今天 / 以后 / 已办 —— 三段各是一张独立卡片，**分类落在卡片头**上：
        顶上一条模式色带 + 淡底条 + 段小印字（今 / 后 / 已）+ 段名 + 计数 + 分界线。
        三张卡是同一套（色带、底色、线都不分彼此）—— "今天"靠**排在最前**说话，
        不靠与众不同的外观（2026-09-29 定）。
      -->
      <view class="card">
        <view class="card__head">
          <text class="card__mark">{{ MARK.today }}</text>
          <text class="card__title">{{ w.today }}</text>
          <text v-if="todaySteps.length" class="card__n">{{ todayDone }}/{{ todaySteps.length }}</text>
        </view>
        <view v-if="todaySteps.length" class="card__body">
          <PlanStep v-for="s in todaySteps" :key="s.key" :item="s" @toggle="onToggle">
            <view v-if="s.kind === 'memo'" class="mini" hover-class="gz-hover" @click="unplan(s)">
              {{ w.unplan }}
            </view>
          </PlanStep>
        </view>
        <text v-else class="card__empty">{{ w.emptyToday }}</text>
      </view>

      <!-- 以后：没排期的、排到别的日子的、过了日子的 —— 全部留着，不会被收走 -->
      <view class="card">
        <view class="card__head">
          <text class="card__mark">{{ MARK.later }}</text>
          <text class="card__title">{{ w.later }}</text>
          <text v-if="laterSteps.length" class="card__n">{{ laterSteps.length }}</text>
        </view>
        <view v-if="laterSteps.length" class="card__body">
          <PlanStep v-for="s in laterSteps" :key="s.key" :item="s" @toggle="onToggle">
            <view class="mini" hover-class="gz-hover" @click="planToday(s)">{{ w.planToday }}</view>
            <view class="mini" hover-class="gz-hover" @click="drop(s)">{{ w.drop }}</view>
          </PlanStep>
        </view>
        <text v-else class="card__empty">{{ w.emptyLater }}</text>
      </view>

      <!-- 已办：整头可点开合，默认收起（它不是这一页的主角） -->
      <view class="card card--done">
        <view class="card__head card__head--fold" hover-class="gz-hover" @click="doneOpen = !doneOpen">
          <text class="card__mark">{{ MARK.done }}</text>
          <text class="card__title">{{ w.done }}</text>
          <text v-if="doneList.length" class="card__n">{{ doneList.length }}</text>
          <text class="card__fold">{{ doneOpen ? FOLD.close : FOLD.open }}</text>
        </view>
        <template v-if="doneOpen">
          <view v-if="doneList.length" class="card__body">
            <PlanStep v-for="s in doneList" :key="s.key" :item="s" @toggle="onToggle">
              <text class="stamp">{{ doneAt(s) }}</text>
            </PlanStep>
          </view>
          <text v-else class="card__empty">{{ w.emptyDone }}</text>
        </template>
      </view>
    </template>

    <!-- 长路节点勾完会收束 —— 回望那一步与计划页同一套（待办自己不弹） -->
    <PlanReflect
      :show="!!reflectOn"
      :plan="reflectOn"
      @confirm="onReflectConfirm"
      @skip="onReflectSkip"
    />
  </view>
</template>

<script setup lang="ts">
/**
 * 行 · 待办 · 备忘（分包 subpkg-action，2026-09-29）。
 *
 * 这一页解决的是一个具体的抱怨：「三件事只有三条，多出来的事该去哪儿写？」
 * 答案不是放开三件事（它的价值就是逼你挑最重要的三件），而是给它一个真去处。
 *
 * 三段 = 一件事的三种状态，全部来自 `stores/plan.ts` 的三个口：
 *   今天（stepsOf）· 以后（poolStepsOf）· 已办（memoDoneOf）
 * 也就是说：**这里不新建数据**，待办就是 `kind='memo'` 的一条 Plan —— 排期、勾选、
 * 计分（action.todo）、周报的「一条路」、云备份全部复用，只有一份待办真相。
 *
 * 三条定死的口径（改这一页之前先读）：
 *   1. **默认进「以后」** —— 这一页接的是"不一定今天做"的事，今天那三件在行大厅已经够了；
 *   2. **不会自己消失**：不排期就不属于任何一天，也不进 `sweep()` 的归档范围（只有 today 型才收走）；
 *      "已搁 N 天"只是标一句事实，不催办、不扣分、不清理；
 *   3. **勾上就是办掉了**，进「已办」；再点一下退回「待办」—— 取消不是失败，是当时点错了。
 *
 * 文案全部来自 `config/lexicon.ts` 的 `memoWords()`（三模式各一套），页面里不写死中文。
 */
import { computed, ref } from 'vue'
import { onShow } from '@dcloudio/uni-app'
import { MEMO_TEXT_MAX, usePlanStore, type Plan, type StepItem } from '@/stores/plan'
import { ACTION_FOLD_WORDS, MEMO_SECTION_MARK, memoWords } from '@/config/lexicon'
import { useModeStore } from '@/stores/mode'
import { useSkinClass } from '@/composables/useSkin'
import { todayKey } from '@/stores/daily'
import { ROUTES } from '@/router/routes'
import { showModal } from '@/utils/dialog'

const plan = usePlanStore()
const mode = useModeStore()
const skinClass = useSkinClass()
const w = computed(() => memoWords(mode.id))
/** 三段卡片头的段小印字（今 / 后 / 已，不随模式变 —— 见 lexicon 的 MEMO_SECTION_MARK） */
const MARK = MEMO_SECTION_MARK
/** 展开 / 收起与行大厅共用一处措辞（见 lexicon 的 ACTION_FOLD_WORDS） */
const FOLD = ACTION_FOLD_WORDS

/** 页面自己持一份"今天是哪天"：跨天回页时要重新取，不能拿组件创建那一刻的日期 */
const day = ref(todayKey())

const todaySteps = computed<StepItem[]>(() => plan.stepsOf(day.value))
const laterSteps = computed<StepItem[]>(() => plan.poolStepsOf(day.value))
const doneList = computed<StepItem[]>(() => plan.memoDoneOf())
/**
 * 今天那一格的计数用「已完成 / 总数」—— 与行大厅三件事同一个口径。
 * **别写成"还剩几件"**：那会得到一个 `1/1`（还有 1 件要办 / 共 1 件），
 * 看着却像"已经办完了 1/1"，与勾选框的空白状态自相矛盾。
 */
const todayDone = computed(() => todaySteps.value.filter((s) => s.done).length)

/** 三段都空 → 整页空态（比三段各说一句"这里没有"更像话） */
const empty = computed(
  () => !todaySteps.value.length && !laterSteps.value.length && !doneList.value.length,
)

const draft = ref('')
const doneOpen = ref(false)

/* ---------------- 记一条 ---------------- */

function add(): void {
  if (!draft.value.trim()) return
  /* 默认不排期（进「以后」）：这一页接的正是"不一定今天做"的事 */
  const created = plan.addMemo(draft.value)
  if (!created) return
  draft.value = ''
  uni.showToast({ title: w.value.saved, icon: 'none' })
}

/* ---------------- 勾选 / 退回 ---------------- */

const reflectOn = ref<Plan | null>(null)

function onToggle(item: StepItem): void {
  const res = plan.toggleStep(item.planId, item.nodeId)
  if (!res.closed) {
    uni.showToast({ title: res.done ? w.value.doneToast : w.value.undoneToast, icon: 'none' })
    return
  }
  /*
   * 收束只有一种情况要拦一下：勾掉的是**长路的最后一个节点**（那要写一句回望）。
   * 待办与 today 型到这就是结束 —— 它们没有回望，也不必假装有。
   */
  const target = plan.byId(item.planId)
  if (target && target.kind === 'long') {
    reflectOn.value = target
    return
  }
  uni.showToast({ title: w.value.doneToast, icon: 'none' })
}

function onReflectConfirm(text: string): void {
  const p = reflectOn.value
  reflectOn.value = null
  if (!p) return
  if (plan.writeReflection(p.id, text)) uni.showToast({ title: '收束 · 这句已存进【知】', icon: 'none' })
}

function onReflectSkip(): void {
  reflectOn.value = null
  uni.showToast({ title: w.value.doneToast, icon: 'none' })
}

/* ---------------- 排期 / 不做了 ---------------- */

/**
 * 排到今天。三种条目走三条不同的路 —— 但它们对用户是同一个动作：
 * memo 改自己的 `dueDay`，老 today 型被"带回今天"，计划节点被排到今天。
 */
function planToday(item: StepItem): void {
  let ok = false
  if (item.kind === 'memo') ok = plan.setMemoDay(item.planId, day.value)
  else if (item.kind === 'plan') ok = plan.rollToToday(item.planId, day.value)
  else if (item.nodeId !== undefined) ok = plan.scheduleNode(item.planId, item.nodeId, day.value)
  if (ok) uni.showToast({ title: w.value.planned, icon: 'none' })
}

/** 放回「以后」（只对 memo）：取消了那一句"今天要办" */
function unplan(item: StepItem): void {
  if (item.kind !== 'memo') return
  if (plan.setMemoDay(item.planId, '')) uni.showToast({ title: w.value.unplanned, icon: 'none' })
}

/**
 * 不做了：**只移除、不扣分、不留痕**（记错一条不该有代价）。
 * 三种条目的后果不同，所以弹框里如实说清是哪一种 —— 别用一句笼统的话糊过去。
 */
function drop(item: StepItem): void {
  const note =
    item.kind === 'memo' ? w.value.dropNote : item.kind === 'plan' ? w.value.dropNotePlan : w.value.dropNoteNode
  showModal({
    title: w.value.dropTitle,
    content: note,
    confirmText: w.value.drop,
    cancelText: w.value.cancel,
    success: (res) => {
      if (!res.confirm) return
      if (item.kind === 'memo') plan.dropMemo(item.planId)
      else if (item.kind === 'plan') plan.archivePlan(item.planId)
      else if (item.nodeId !== undefined) plan.removeNode(item.planId, item.nodeId)
      uni.showToast({ title: w.value.dropped, icon: 'none' })
    },
  })
}

/* ---------------- 已办段的落款 ---------------- */

/**
 * 完成时刻（`月-日`）。放页面里是因为它是**数据格式化**，不是可替换的措辞
 * （与行大厅收功落款的 `fmtClock` 同一处理）。
 */
function doneAt(item: StepItem): string {
  if (!item.doneAt) return ''
  const d = new Date(item.doneAt)
  return `${d.getMonth() + 1} 月 ${d.getDate()} 日办`
}

onShow(() => {
  /* 跨天回页：先对齐日期，再顺手把 today 型的自动收走跑一遍（**不收 memo**，见 sweep 的注释） */
  day.value = todayKey()
  plan.sweep()
})
</script>

<style lang="scss" scoped>
@import './index.scss';
</style>

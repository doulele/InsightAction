<template>
  <view class="page" :class="skinClass">
    <!-- 大厅头（五页共用组件：主题艺术画作背景 + 印章 + 定位 + 状态） -->
    <HallHead mark="行" en="ACT · 验证 → 创造 → 痕迹" :line="headLine" :stats="headStats" />

    <!--
      安息日（2026-09-17）：每周留一天，什么都不必记。
      它不是"今天不许写"，而是**不要求你写** —— 所有入口照常，只是不入账、也不催。
    -->
    <view v-if="sabbath" class="sabbath">
      <text class="sabbath__text">{{ sabbathText }}</text>
    </view>

    <!-- 第一周解锁引导：今天的主角在这里才挂出 -->
    <WeekGuide for="action" />

    <!-- 今日三件事 -->
    <!-- id="today"：第一周引导「立一件事」的滚动落点（WeekGuide 的 #today），改名要同步改 config/unlock.ts -->
    <view id="today" class="block block--hero today">
      <view class="block__head">
        <!--
          标题右边的「？」= 这三块到底有什么区别（2026-09-22）。
          之前每块只有一行小字说明「它是什么」，用户仍然看不懂 → 现在点开是一整篇：
          定义 + 举例 + **忘了做会怎样**（后者才是三块真正的分界）。
        -->
        <view class="block__title">
          <text class="block__mark">{{ MARK.three }}</text>
          <text class="block__label">今日三件事</text>
          <text class="today__ask" hover-class="gz-hover" @click="ask('three')">?</text>
        </view>
        <!-- 安息日不报完成度：那天没有"还差几件"这回事 -->
        <text class="block__badge is-accent">{{ sabbath ? '—' : `${daily.doneCount}/${daily.planCount || 3}` }}</text>
      </view>
      <!-- 三本待办账的分工说明（见 config/lexicon.ts 的 actionSplit）：不说清就像重复了三遍 -->
      <text class="block-hint">{{ exThree.hint }}</text>

      <!--
        每条三件事的「出处」（规格 §4.4 回应式行动）：
        没挂来源时诚实标一个「＋」，挂错的理比不挂更糟 —— 它会污染脊椎的 ref。
        2026-09-22 定案：**一行一事，出处是行尾一枚极窄的单字标记**。
        两行式（出处另起一行）更好认，但三条就多出三行、首屏立刻吃亏；
        单行式里若摆"品类 + 摘要"的药丸，它会吃掉 45% 宽、把窄屏输入框压到十来个字 ——
        所以标记只回答"挂没挂、挂的是哪一类"（理 / 卡 / 冲 / 念 / 计），点开面板才看全。
      -->
      <view v-for="todo in daily.todos" :key="todo.id" class="todo" :class="{ 'is-done': todo.done }">
        <view class="todo__check" :class="{ 'is-on': todo.done }" @click="onToggleTodo(todo)">
          <text v-if="todo.done" class="todo__tick">✓</text>
        </view>
        <input
          v-model="todo.text"
          class="todo__input"
          :class="{ 'is-done': todo.done }"
          placeholder="写下一件今天要做成的事…"
          placeholder-class="todo__ph"
          :maxlength="40"
          @blur="onEdited"
        />
        <view
          class="todo__src"
          :class="{ 'is-none': !todo.ref }"
          hover-class="gz-hover"
          @click="openSource(todo)"
        >
          <text class="todo__src-tag">{{ srcTag(todo) }}</text>
        </view>
      </view>

      <view v-if="daily.allDone" class="today__done">
        <text class="today__done-title">今日三事已成。</text>
        <text class="today__done-sub" hover-class="gz-hover" @click="openBox">
          已完成已回写【知】 · 去开一只微行动盲盒 →
        </text>
        <!--
          做完了 → 给今天收个尾（2026-09-22）。
          收功原先埋在页尾一屏半之外，"做完了想留一句"的人根本找不到它；
          这里只在**三件事全成且今天还没收**时出现，送人到那一块并摊开。
        -->
        <text
          v-if="!sabbath && !closing.todayClosed"
          class="today__done-close"
          hover-class="gz-hover"
          @click="gotoClosing"
        >
          {{ cw.title }} · 留一句给今天 →
        </text>
      </view>
    </view>

    <!--
      今天要守的日课（2026-09-17）：早睡 / 锻炼 / 戒色这类"每天重复一次"的事。
      三态是「守住 / 破了 / 没记」—— 没记只是空白，不是破了（不自我审判）。
      "破了"只有戒断型（abstain）才有这一颗按钮：锻炼没做不等于破戒。
    -->
    <view v-if="dailyItems.length" class="block dailies">
      <view class="block__head block__head--fold" hover-class="gz-hover" @click="dailyOpen = !dailyOpen">
        <view class="block__title">
          <text class="block__mark">{{ MARK.daily }}</text>
          <text class="block__label">{{ planW.daily }} · 今天</text>
          <text class="today__ask" hover-class="gz-hover" @click.stop="ask('daily')">?</text>
        </view>
        <view class="block__right">
          <text class="block__badge" :class="dailyKept < dailyItems.length ? 'is-accent' : 'is-muted'">
            {{ dailyKept }}/{{ dailyItems.length }}
          </text>
          <text class="block__fold">{{ dailyOpen ? FOLD.close : FOLD.open }}</text>
        </view>
      </view>
      <template v-if="dailyOpen">
        <text class="block-hint">{{ exDaily.hint }}</text>
        <view
          v-for="d in dailyItems"
          :key="d.planId"
          class="daily"
          :class="{ 'is-kept': d.state === 'kept', 'is-broken': d.state === 'broken' }"
        >
          <view class="daily__main">
            <text class="daily__title">{{ d.title }}</text>
            <text class="daily__meta">守住 {{ d.kept }} 天 / 共 {{ d.target }} 天</text>
          </view>
          <view class="daily__act" hover-class="gz-hover" @click="onCheckDaily(d)">{{ dailyActText(d) }}</view>
          <view v-if="d.challenge === 'abstain'" class="daily__break" hover-class="gz-hover" @click="onBreakDaily(d)">
            破了
          </view>
        </view>
        <!--
          日课与习惯打卡的区别（2026-09-22）：两者都是"每天重复一次"，
          不说清这一句，用户就不知道该建哪个 —— 答案只有"有没有期限"。
        -->
        <text class="block-hint block-hint--tail">{{ dailyVs }}</text>
        <text class="block-hint block-hint--tail">{{ planW.dailyHint }}</text>
      </template>
    </view>
    <!--
      今天要走的步子（2026-09-15 计划模块）：
      三件事是「今天最重要的三件」，这里是「三件之外还要往前挪的步子」——
      派到今天的节点 + 只活今天的一件事。未完成的会过期待办池，不催办、不扣分。
    -->
    <view class="block steps">
      <view class="block__head block__head--fold" hover-class="gz-hover" @click="stepOpen = !stepOpen">
        <view class="block__title">
          <text class="block__mark">{{ MARK.step }}</text>
          <text class="block__label">{{ planW.today }}</text>
          <text class="today__ask" hover-class="gz-hover" @click.stop="ask('step')">?</text>
        </view>
        <view class="block__right">
          <text
            class="block__badge"
            :class="todaySteps.length === 0 || stepDone < todaySteps.length ? 'is-accent' : 'is-muted'"
          >
            {{ stepDone }}/{{ todaySteps.length }}
          </text>
          <text class="block__fold">{{ stepOpen ? FOLD.close : FOLD.open }}</text>
        </view>
      </view>
      <template v-if="stepOpen">
        <text class="block-hint">{{ exStep.hint }}</text>

        <view v-if="todaySteps.length" class="steps__list">
          <PlanStep v-for="s in todaySteps" :key="s.key" :item="s" @toggle="onToggleStep" />
        </view>
        <text v-else class="steps__empty">今天还没有额外的步子 —— 有想推进的，写一条。</text>

        <view class="steps__quick">
          <input
            v-model="newStep"
            class="steps__input"
            :placeholder="planW.newToday"
            placeholder-class="steps__ph"
            :maxlength="30"
            confirm-type="done"
            @confirm="addStep"
          />
          <view class="steps__btn" hover-class="gz-hover" @click="addStep">加</view>
        </view>

        <text v-if="todaySteps.length > TODAY_STEP_COMFORT" class="steps__warn">
          今天排了 {{ todaySteps.length }} 条 —— 比平时多，走得完吗？
        </text>
        <text v-if="poolHint" class="steps__pool" hover-class="gz-hover" @click="goPlans">{{ poolHint }}</text>
      </template>
    </view>

    <!-- 在走的长路 -->
    <view v-if="longTop.length" class="section">
      <view class="section__head">
        <text class="section__title">在走的{{ planW.plan }}</text>
        <text class="section__more" hover-class="gz-hover" @click="goPlans">全部 ›</text>
      </view>
      <view v-for="p in longTop" :key="p.id" class="plan" hover-class="gz-hover" @click="openPlan(p)">
        <view class="plan__row">
          <text class="plan__title">{{ p.title }}</text>
          <text class="plan__tag">{{ horizonText(p) }}</text>
          <text v-if="p.challenge" class="plan__tag">{{ challengeText(p) }}</text>
        </view>
        <view class="bar bar--plan">
          <view class="bar__fill" :style="{ width: `${planStore.progressOf(p).pct}%` }" />
        </view>
        <view class="plan__meta">
          <text class="plan__progress">{{ planW.progress(planStore.progressOf(p).done, planStore.progressOf(p).total) }}</text>
          <text class="plan__next">{{ nextHint(p) }}</text>
        </view>
      </view>
    </view>

    <!-- 行动入口 -->
    <view class="section">
      <view class="section__head">
        <text class="section__title">把念头变成痕迹</text>
      </view>
      <view class="entries">
        <EntryItem
          v-for="item in moreEntries"
          :key="item.title"
          :title="item.title"
          :subtitle="item.subtitle"
          :mark="item.mark"
          :badge="item.badge"
          :url="item.url"
          :disabled="item.disabled"
        />
      </view>
    </view>

    <!--
      今日收功（2026-09-17 建；09-22 改形态与位置）：一天结束前把它收个尾。安息日那天不出现。

      四条形态：
        1. **全页最后一块**：原先它夹在「在走的长路」与「把念头变成痕迹」之间 ——
           语义上它是"一天的句号"，却排在两块"还能继续做"的内容中间。
        2. **默认摊开**（09-22 定案）：不按钟点自浮 —— 白天也展开，收起只是用户自己的选择；
           三件事已成时那条捷径（`gotoClosing`）仍会把它摊开并滚过来。
        3. **收起态不做成卡片**：`is-fold` 时只留一条窄行（约 76rpx）。
        4. **已收态给足落点**：那句自己写给自己的话排成引文 + 落款时间 ——
           它不该是整页最轻的一个"完成了"反馈。
    -->
    <view v-if="!sabbath" id="closing" class="closing" :class="{ 'is-fold': !closeShown }">
      <view class="closing__head">
        <view class="block__title">
          <text class="block__mark">{{ cw.mark }}</text>
          <text class="closing__label">{{ cw.title }}</text>
        </view>
        <text v-if="closing.todayClosed" class="closing__stamp">{{ cw.tag }} · {{ closedAt }}</text>
        <text v-else class="block__fold" hover-class="gz-hover" @click="closeOpen = !closeOpen">
          {{ closeOpen ? FOLD.close : FOLD.open }}
        </text>
      </view>

      <!-- 折叠态：一条窄行，点了摊开 -->
      <text v-if="!closeShown" class="closing__fold" hover-class="gz-hover" @click="closeOpen = true">
        {{ cw.fold }}
      </text>

      <template v-else>
        <!-- 收尾时顺手带一句身体读数（2026-09-21）：今天没读数就整句不出现，不留空壳 -->
        <text v-if="bodyTodayLine" class="closing__body">{{ bodyTodayLine }}</text>
        <template v-if="closing.todayClosed">
          <view v-if="closing.todayRecord?.text" class="closing__quote">
            <text class="closing__quote-text">{{ closing.todayRecord?.text }}</text>
          </view>
          <text v-else class="closing__none">{{ cw.none }}</text>
          <text class="closing__redo" hover-class="gz-hover" @click="closing.reopen()">{{ cw.redo }}</text>
        </template>
        <template v-else>
          <text class="closing__hint">{{ cw.hint }}</text>
          <textarea
            v-model="closeDraft"
            class="closing__input"
            maxlength="120"
            auto-height
            :placeholder="cw.ph"
            placeholder-class="closing__ph"
          />
          <view class="closing__btn" hover-class="gz-hover-btn" @click="doClose">{{ cw.act }}</view>
        </template>
      </template>
    </view>

    <!-- 批次 D · 小枢全局浮层 -->
    <BuddyFloat />

    <!-- 远端提示层：公告 + 版本更新（强制更新 / 新包已下载、重启生效） -->
    <RemoteNotice />

    <!-- 计划收束时的回望（可跳过） -->
    <PlanReflect
      :show="!!reflectOn"
      :plan="reflectOn"
      @confirm="onReflectConfirm"
      @skip="onReflectSkip"
    />

    <!-- 三件事的关联来源（§4.4 回应式行动） -->
    <TodoSource :show="!!sourceOn" :current="sourceOn?.ref ?? ''" @pick="onPickSource" @close="sourceOn = null" />

    <!--
      三份「今日清单」各自的解释（2026-09-22）。
      点哪一块的「?」就把那一块排到最前 —— 用户是带着具体那一块的疑问点开的。
      说明类弹框关掉横幅（省 240rpx，见 GzDialog 的 banner 注释）。
    -->
    <GzDialog
      v-model:show="explainOpen"
      title="这三个清单，分别管什么"
      subtitle="它们长得像，但不是一回事"
      :banner="false"
      confirm-text="知道了"
      :show-cancel="false"
    >
      <view class="exp">
        <view v-for="b in explainList" :key="b.key" class="exp__item" :class="{ 'is-on': b.key === askedKey }">
          <text class="exp__name">{{ b.name }}</text>
          <text class="exp__what">{{ b.what }}</text>
          <text class="exp__eg">例：{{ b.eg }}</text>
          <text class="exp__fate">{{ b.fate }}</text>
        </view>
      </view>
    </GzDialog>
  </view>
</template>

<script setup lang="ts">
/**
 * 行 · 行动大厅：验证→创造→痕迹。
 * 三件事勾选完成即回写【知】知识卡片（Lv.2 行动回写）并留下痕迹；
 * 习惯打卡 / 微行动盲盒 / 行动周报均为真实子页。
 */
import { computed, nextTick, ref } from 'vue'
import HallHead from '@/components/HallHead/HallHead.vue'
import WeekGuide from '@/components/WeekGuide/WeekGuide.vue'
import { onShow } from '@dcloudio/uni-app'
import { useModeStore } from '@/stores/mode'
import { useRemoteStore } from '@/stores/remote'
import { useSkinClass } from '@/composables/useSkin'
import { useDailyStore, todayKey, type DailyTodo } from '@/stores/daily'
import { useKnowledgeStore } from '@/stores/knowledge'
import { useHabitStore } from '@/stores/habit'
import { usePlanStore, TODAY_STEP_COMFORT, type DailyItem, type Plan, type StepItem } from '@/stores/plan'
import { useBodyStore } from '@/stores/body'
import { autoSyncWeRun } from '@/utils/werun'
import { useClosingStore } from '@/stores/closing'
import { isSabbathToday, sabbathLine } from '@/utils/sabbath'
import { logTrace } from '@/utils/traceLog'
import { poke } from '@/composables/useBuddy'
import { useXpStore } from '@/stores/xp'
import { useWishStore } from '@/stores/wish'
import { syncTabBar } from '@/utils/skin'
import {
  ACTION_BLOCK_MARK,
  ACTION_BLOCK_ORDER,
  ACTION_FOLD_WORDS,
  CHALLENGE_LABEL,
  HORIZON_LABEL,
  actionSplit,
  closingWords,
  dailyVsHabit,
  hallLine,
  planWords,
  type ActionBlockKey,
} from '@/config/lexicon'
import { navigateTo, ROUTES } from '@/router/routes'
import type { RoutePath } from '@/router/routes'
import type { EntryBadge } from '@/components/EntryItem/EntryItem.vue'
import { REF_KIND_SHORT, type RefOption } from '@/utils/refSource'
import { showModal } from '@/utils/dialog'

const modeStore = useModeStore()
/** 远端功能开关（features.box / teahouse …）：入口整块可控隐藏，页面代码无需改动 */
const remote = useRemoteStore()
const skinClass = useSkinClass()
const daily = useDailyStore()
const knowledge = useKnowledgeStore()
const habit = useHabitStore()
const wishStore = useWishStore()
const xpTotal = useXpStore()
/** 计划（2026-09-15）：长期目标 + 节点 + 今天的步子 */
const planStore = usePlanStore()
/** 身体电量（2026-09-15）：微信运动步数，只在本机留存 */
const body = useBodyStore()
/** 今日收功（2026-09-17）：一天结束前把它收个尾 */
const closing = useClosingStore()
const planW = computed(() => planWords(modeStore.id))
/** 三块今日清单的小印字 + 展开/收起措辞（与「把念头变成痕迹」入口行同一套语言） */
const MARK = ACTION_BLOCK_MARK
const FOLD = ACTION_FOLD_WORDS

/* ---------------- 安息日（2026-09-17） ----------------
 * 一周留一天，什么都不必记：功能全开、只是不入账、也不催（见 utils/sabbath.ts）。
 * 全页只需要两处判断：头部那句话换成安息语，三件事不报完成度。
 */
const sabbath = computed(() => isSabbathToday())
const sabbathText = computed(() => sabbathLine(modeStore.id))

/* ---------------- 三份今日清单的「各自是什么」（2026-09-22）----------------
 * 三块的名词跟着模式走（日课 / 每日任务 / 日行），所以解释统一由 actionSplit 现取，
 * 页面不写死任何一句说明文案。
 */
const exThree = computed(() => actionSplit('three', planW.value))
const exDaily = computed(() => actionSplit('daily', planW.value))
const exStep = computed(() => actionSplit('step', planW.value))

/** 日课与习惯打卡的区别（有日课时才可能显示） */
const dailyVs = computed(() => dailyVsHabit(planW.value.daily))

/** 正在被问的那一块；弹窗里把它排到最前 */
const askedKey = ref<ActionBlockKey>('three')
const explainOpen = ref(false)

const explainList = computed(() =>
  [askedKey.value, ...ACTION_BLOCK_ORDER.filter((k) => k !== askedKey.value)].map((k) => ({
    key: k,
    ...actionSplit(k, planW.value),
  })),
)

function ask(key: ActionBlockKey): void {
  askedKey.value = key
  explainOpen.value = true
}

/* ---------------- 今日收功 ----------------
 * **默认摊开**（2026-09-22 定案）：不按钟点自浮 —— 白天也展开，收起只是用户自己的选择。
 * 其余仍照旧：今天已经收了（要看那句）、三件事已成（捷径滚过来）、
 * 小枢结算面板点了「留一句」（`takeFocus`）都会把它摊开。
 */
const cw = computed(() => closingWords(modeStore.id))
const closeDraft = ref('')
const closeOpen = ref(true)

/**
 * 已收落款的时间（2026-09-22）：收功那一刻的钟点。
 * 不放进文案表，因为它是**数据格式化**（HH:mm），不是可替换的措辞。
 */
function fmtClock(ts: number): string {
  const d = new Date(ts)
  return `${`${d.getHours()}`.padStart(2, '0')}:${`${d.getMinutes()}`.padStart(2, '0')}`
}

const closedAt = computed(() => (closing.todayRecord ? fmtClock(closing.todayRecord.createdAt) : ''))

/* ---------------- 分类行的展开态（2026-09-22） ----------------
 * 三块今日清单里，三件事是主角（恒展开、就地可编辑）；日课与步子收成分类行，点了才摊开。
 * 初值每次进页面重算（见 onShow）：还有没做完的就默认摊开，全做完了才收成一行 ——
 * **不记住上次的手动开合**，免得"上次收起了，今天忘了看"。
 */
const dailyOpen = ref(true)
const stepOpen = ref(true)

/** 摊开与否的最终判定：已收 → 恒摊；否则看上面那三条 */
const closeShown = computed(() => closing.todayClosed || closeOpen.value)

/** 滚到收功那一块（三件事已成时的小捷径、小枢唤起来时用） */
function gotoClosing(): void {
  closeOpen.value = true
  nextTick(() => {
    uni.pageScrollTo({
      selector: '#closing',
      duration: 300,
      fail: () => {
        uni.showToast({ title: '往下翻一点，就在下面', icon: 'none' })
      },
    })
  })
}

/**
 * 收功时带一句身体读数（2026-09-21）：
 * 一天收尾看见的不只是四环，还有身体这一格。**今天没读数就整句不出现** ——
 * 不留"今天走了 — 步"这种空壳（标空是这一页的底线，收功这里同样守）。
 */
const bodyTodayLine = computed(() => (body.todayStep === null ? '' : `今天走了 ${body.todayStep} 步。`))

function doClose(): void {
  const wrote = !!closeDraft.value.trim()
  const first = closing.close(closeDraft.value)
  closeDraft.value = ''
  /* 写了字的如实说一句它去了哪儿（回写【知】）；没写字也一样算收了 —— 不写字不是失败 */
  const tail = wrote ? ' · 这句已存进【知】' : ' · 不留字也算'
  uni.showToast({
    title: (first ? `${cw.value.tag}${tail}` : `已更新这句${tail}`),
    icon: 'none',
  })
}

/* ---------------- 今天要守的日课 ---------------- */
const dailyItems = computed<DailyItem[]>(() => planStore.dailyToday())
const dailyKept = computed(() => dailyItems.value.filter((d) => d.state === 'kept').length)

function dailyActText(d: DailyItem): string {
  if (d.state === 'kept') return planW.value.keptAct
  if (d.state === 'broken') return planW.value.brokenAct
  return planW.value.keepAct
}

function onCheckDaily(d: DailyItem): void {
  const res = planStore.checkDaily(d.planId)
  if (res.closed) {
    const target = planStore.byId(d.planId)
    if (target) reflectOn.value = target
    return
  }
  uni.showToast({
    title: res.done ? `「${d.title}」· ${planW.value.keptAct}` : '已退回今天这一笔',
    icon: 'none',
  })
}

/** 破了：不归零、不扣分 —— 可以写一句为什么，那一句会进【知】的省察 */
function onBreakDaily(d: DailyItem): void {
  showModal({
    title: `「${d.title}」· ${planW.value.brokenAct}`,
    content: '',
    editable: true,
    placeholderText: '写一句为什么（可留空）—— 知道原因比没破更有用',
    confirmText: '记下',
    cancelText: '算了',
    success: (res) => {
      if (!res.confirm) return
      planStore.markDailyBroken(d.planId, res.content ?? '')
      uni.showToast({ title: '记下了 · 明天照常', icon: 'none' })
    },
  })
}

onShow(() => {
  daily.ensureToday()
  /*
   * 跨 tab 交接的预填（2026-09-17）：止念里判了"能做"的那一念 → 止念页放一条 handoff
   * 后 switchTab 过来（**tab 页带不了 query**，`navigateTo` 对 tab 走的是 `switchTab`，
   * 参数会丢，所以只能走 store 交接）。
   * 口径是**只预填、不代立**（§4.2）：只落进输入框，改不改、勾不勾都由用户定；
   * 三条都写满时如实说一声，**不悄悄挤掉**用户已经写好的一条。
   */
  const handoff = daily.takeHandoff()
  if (handoff) {
    const ok = daily.applyHandoff(handoff)
    uni.showToast({
      title: ok ? '已放进三件事 · 自己改一改再算' : '三件事已经写满，先删一条再预填',
      icon: 'none',
    })
  }
  /* 搁置满 3 天的「今天做的一件事」自动收走（静默，不打扰） */
  planStore.sweep()
  /*
   * 分类行的初值（2026-09-22）：日课还有没守住的、步子还有没走完的（或一条都还没排），
   * 就默认摊开；全做完了才收成一行。**不记住上次的手动开合** ——
   * 免得"上次收起了，今天忘了看"。
   */
  dailyOpen.value = dailyKept.value < dailyItems.value.length
  stepOpen.value = todaySteps.value.length === 0 || stepDone.value < todaySteps.value.length
  /*
   * 小枢结算面板（23:00 后）点了「留一句」→ 直接摊开并滚过去。
   * （收工现在**默认摊开**，所以这里不再按钟点重算 `closeOpen`。）
   */
  if (closing.takeFocus()) gotoClosing()
  /*
   * 身体电量静默续接（2026-09-21）：授权过之后，隔几天进「行」时补一次步数。
   * 不 await —— 它不该挡住页面；失败也不提示（见 autoSyncWeRun 的说明）。
   * 挂在这里而不是 App.onLaunch：那时隐私授权门还没挂载，隐私接口会挂起。
   */
  void autoSyncWeRun()
  /* 批次 D · 小枢：评估到点激励 / 入定到点提醒 */
  poke()
  /* tabBar 原生样式/图标只能在本类大厅页上同步 */
  syncTabBar(modeStore.id)
})

/* ---------------- 今天要走的步子 ---------------- */
const todaySteps = computed<StepItem[]>(() => planStore.stepsOf())
const stepDone = computed(() => todaySteps.value.filter((s) => s.done).length)

/** 待办池提示：有搁置的才出现，平时不占位（不催办，只是让它可被找到） */
const poolHint = computed(() => {
  const n = planStore.poolStepsOf().length
  return n > 0 ? `${planW.value.pool}里还搁着 ${n} 条 · 去看看 ›` : ''
})

const newStep = ref('')

function addStep(): void {
  const title = newStep.value.trim()
  if (!title) return
  if (planStore.addPlan({ title, kind: 'today' })) {
    newStep.value = ''
    uni.showToast({ title: '已记下 · 今天多做一件', icon: 'none' })
  }
}

/** 勾选一步：收束时按计划类型决定是否弹回望（today 型没有回望） */
function onToggleStep(s: StepItem): void {
  const res = planStore.toggleStep(s.planId, s.nodeId)
  if (!res.closed) return
  const target = planStore.byId(s.planId)
  if (target && target.kind === 'long') {
    reflectOn.value = target
  } else {
    uni.showToast({ title: '今日事已了', icon: 'none' })
  }
}

/* ---------------- 在走的长路 ---------------- */
const longTop = computed(() => planStore.activeLong.slice(0, 2))

function challengeText(p: Plan): string {
  return p.challenge ? CHALLENGE_LABEL[p.challenge] : ''
}

/** 期限档（短期 / 中期 / 长期）：大厅只给一眼能认出的档名，详细的去「划」里看 */
function horizonText(p: Plan): string {
  return HORIZON_LABEL[planStore.horizonOf(p)]
}

function nextHint(p: Plan): string {
  const node = planStore.nextNodeOf(p)
  if (node) return `${planW.value.next} · ${node.title}`
  const remain = planStore.remainDaysOf(p)
  if (remain !== null && remain > 0) return `还剩 ${remain} 天`
  return '步子都走完了'
}

function openPlan(p: Plan): void {
  navigateTo(ROUTES.actionPlanDetail, { id: p.id })
}

function goPlans(): void {
  navigateTo(ROUTES.actionPlans)
}

/* ---------------- 收束回望 ---------------- */
const reflectOn = ref<Plan | null>(null)

function onReflectConfirm(text: string): void {
  const p = reflectOn.value
  reflectOn.value = null
  if (!p) return
  if (planStore.writeReflection(p.id, text)) {
    uni.showToast({ title: '收束 · 这句已存进【知】', icon: 'none' })
  }
}

function onReflectSkip(): void {
  reflectOn.value = null
  uni.showToast({ title: '已收束 · 收下这 20 点修为', icon: 'none' })
}

/**
 * 大厅头部的「一句」+ 两个关键数字（2026-09-16 定的形态）。
 * 一句走 lexicon.hallLine 的三模式措辞；数字给"今日三件事"与"累计修为" ——
 * 「做了事 → 涨修为」这条因果在行大厅最贴切，也让下面那份待办列表不必再报总数。
 */
const headLine = computed(() => (sabbath.value ? sabbathText.value : hallLine('action', modeStore.id)))

const headStats = computed(() => [
  { value: `${daily.doneCount}/${daily.planCount || 3}`, label: '今日三件事' },
  { value: `${xpTotal.total}`, label: '累计修为 · 点' },
])

function onEdited(): void {
  // v-model 已实时同步 store，无需额外动作；跨天在 onShow ensureToday 处理
}

/** 勾选/取消完成：完成时行→知回写 + 痕迹入账（带上出处，周报的「一条路」靠它串） */
function onToggleTodo(todo: DailyTodo): void {
  const text = todo.text.trim()
  const willDone = !todo.done
  const from = todo.ref
  daily.toggle(todo.id)
  if (willDone && text) {
    writeBack(text, from)
  }
}

function writeBack(text: string, from?: string): void {
  const k = todayKey()
  const dup = knowledge.cards.some((c) => {
    if (c.kind !== 'action') return false
    const d = new Date(c.createdAt)
    const day = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
    return day === k && c.title === text
  })
  if (!dup) {
    knowledge.add({ kind: 'action', title: text, content: text, tags: ['行动'], depth: 2, src: '行 · 行动回写' })
    // 首次回写入账修为（value 取事件表 10 分）；重复内容只留痕，不给分（防刷）
    logTrace({ kind: 'action.todo', text, ref: from })
  } else {
    logTrace({ kind: 'action.todo', text, value: 0, ref: from })
  }
}

/* ---------------- 三件事的出处（§4.4 回应式行动） ---------------- */
/** 正在给哪一条找出处 */
const sourceOn = ref<DailyTodo | null>(null)

function openSource(todo: DailyTodo): void {
  if (!todo.text.trim()) {
    uni.showToast({ title: '先写下要做什么，再挂出处', icon: 'none' })
    return
  }
  sourceOn.value = todo
}

function onPickSource(o: RefOption | null): void {
  const t = sourceOn.value
  sourceOn.value = null
  if (!t) return
  // o 为 null = 用户选了「无出处」：不猜、不硬挂
  if (o) daily.setRef(t.id, o.ref, o.kind, o.text)
  else daily.setRef(t.id, '', 'none', '')
}

/** 行尾那枚出处标记：挂了显示品类单字，没挂显示「＋」（点开面板去挂） */
function srcTag(todo: DailyTodo): string {
  return todo.ref ? REF_KIND_SHORT[todo.refKind ?? 'none'] : '＋'
}

function openBox(): void {
  navigateTo(ROUTES.actionBox)
}

interface MoreEntry {
  mark: string
  title: string
  subtitle: string
  badge: EntryBadge
  url?: RoutePath
  disabled?: boolean
}

const moreEntries = computed<MoreEntry[]>(() => {
  const todayDone = habit.doneOn()
  const habitTotal = habit.habits.length
  const wishes = wishStore.wishes
  const wishReady = wishes.filter((w) => !w.claimedAt && xpTotal.total >= w.needXp).length
  const wishClaimed = wishes.filter((w) => w.claimedAt).length
  const stepTodo = todaySteps.value.filter((s) => !s.done).length
  const poolN = planStore.poolStepsOf().length
  return [
    {
      mark: planW.value.mark,
      title: planW.value.plan,
      /* 长路与日课是两条账（各 3 条）：入口把两边都报出来，别让人以为日课不算 */
      subtitle: '跨天的目标拆成一步步走 · 每天重复的事走「日课」',
      badge:
        longTop.value.length > 0 || stepTodo > 0 || planStore.activeDailyCount > 0
          ? { text: `进行中 ${planStore.activeLongCount + planStore.activeDailyCount} 个`, tone: 'accent' }
          : poolN > 0
            ? { text: `${poolN} 条搁置`, tone: 'muted' }
            : { text: '立一条', tone: 'muted' },
      url: ROUTES.actionPlans,
    },
    {
      mark: '惯',
      title: '习惯打卡',
      /* 与日课的区别当场说清：习惯**没有期限**，日课守满就收束 */
      subtitle: `没有期限的每天一勾 · 想给它一个期限，就用「立为${planW.value.daily}」`,
      badge:
        habitTotal > 0
          ? todayDone > 0
            ? { text: `今日 ${todayDone}/${habitTotal}`, tone: 'accent' }
            : { text: `${habitTotal} 个习惯`, tone: 'muted' }
          : { text: '去建习惯', tone: 'muted' },
      url: ROUTES.actionHabits,
    },
    // 功能开关（远端可关，默认开）：关掉「微行动盲盒」时整条入口消失，页面代码无需改动
    // 注意 as MoreEntry[]：条件展开会让 badge.tone 的字面量类型被放宽成 string
    ...((remote.feature('box')
      ? [
          {
            mark: '盒',
            title: '微行动盲盒',
            subtitle: '随机 3 分钟线下行动，给身体一个开关',
            badge: daily.allDone
              ? { text: '可开启', tone: 'accent' }
              : { text: '先完成三件事', tone: 'muted' },
            url: ROUTES.actionBox,
          },
        ]
      : []) as MoreEntry[]),
    {
      mark: '迹',
      title: '行动周报 · 痕迹时间轴',
      subtitle: '本周完成统计与趋势，看见自己在真实世界的痕迹',
      badge: { text: '周报', tone: 'accent' },
      url: ROUTES.actionWeekly,
    },
    /* 身体电量：微信运动步数（手动同步，本机留存），未同步时引导去读一次 */
    {
      mark: '电',
      title: '身体电量 · 微信运动',
      subtitle: '今天的步数与最近七天，给自己一个身体的读数',
      badge: body.hasToday
        ? { text: `今日 ${body.todayStep} 步`, tone: 'accent' }
        : { text: '去同步', tone: 'muted' },
      url: ROUTES.actionBody,
    },
    {
      mark: '愿',
      title: '愿望清单',
      subtitle: '把戒断与专注攒下的修为 · 兑成现实里想得到的东西',
      badge:
        wishReady > 0
          ? { text: `${wishReady} 可兑现`, tone: 'accent' }
          : wishClaimed > 0
            ? { text: `已兑 ${wishClaimed}`, tone: 'accent' }
            : wishes.length > 0
              ? { text: '攒修为中', tone: 'muted' }
              : { text: '立一个愿望', tone: 'muted' },
      url: ROUTES.actionWishes,
    },
  ]
})
</script>

<style lang="scss" scoped>
@import './index.scss';
</style>

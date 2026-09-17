<template>
  <view class="page" :class="skinClass">
    <view class="nav">
      <view class="nav__side" hover-class="gz-hover" @click="goBack">
        <text class="nav__back">‹</text>
      </view>
      <text class="nav__title">止念一刻</text>
      <view class="nav__side" />
    </view>

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
      </view>
    </view>

    <!-- ================= ① 一刻：写下一念并判它有没有解 ================= -->
    <template v-if="tab === 'log'">
      <view class="intro">
        <text class="intro__text">
          想不想得停，不由意志决定。能做的只有一件事：把那个反复转的念头挪到纸上，再看它现在有没有解。
        </text>
      </view>

      <view class="form">
        <text class="form__label">① 此刻在反复想的是什么</text>
        <input
          v-model="text"
          class="form__input"
          placeholder="一句话就够，例如：明天那件事会不会搞砸"
          placeholder-class="form__ph"
          :maxlength="THOUGHT_TEXT_MAX"
        />

        <!--
          ② 重复识别：同一件事反复回来是反刍最核心的特征，而用户自己看不见。
          只陈述「什么时候也停过笔、当时判了什么」，不带"又 / 还是 / 再一次"这类暗示。
        -->
        <view v-if="echo" class="echo">
          <text class="echo__text">
            这事你 {{ echoDay }} 也停过笔（当时判「{{ echo.rec.answer === 'act' ? '能做' : '先放下' }}」）
          </text>
        </view>

        <text class="form__label">② 它现在有没有解</text>
        <view class="chips">
          <view
            class="chip"
            :class="{ 'is-on': answer === 'act' }"
            hover-class="gz-hover"
            @click="answer = 'act'"
          >
            现在能做什么
          </view>
          <view
            class="chip"
            :class="{ 'is-on': answer === 'let' }"
            hover-class="gz-hover"
            @click="answer = 'let'"
          >
            现在做不了
          </view>
        </view>

        <template v-if="answer === 'act'">
          <text class="form__label">③ 第一件能做的事（一句话）</text>
          <input
            v-model="action"
            class="form__input"
            placeholder="例如：今晚把前三页过一遍"
            placeholder-class="form__ph"
            :maxlength="THOUGHT_ACTION_MAX"
          />
        </template>

        <!--
          ③ 搁置：判"做不了"就得给这件事一个去处，否则"先放下"只是一句空话。
          默认不选 = 就此放下（沿用第一版行为：写下来就完了，不候回看）。
        -->
        <template v-else>
          <text class="form__label">③ 放哪儿</text>
          <view class="chips">
            <view
              v-for="k in SHELVE_KINDS"
              :key="k.id"
              class="chip"
              :class="{ 'is-on': shelved === k.id }"
              hover-class="gz-hover"
              @click="shelved = k.id"
            >
              {{ k.label }}
            </view>
            <view
              class="chip"
              :class="{ 'is-on': shelved === null }"
              hover-class="gz-hover"
              @click="shelved = null"
            >
              就此放下
            </view>
          </view>
          <text class="form__hint">{{ shelveNote }}</text>
        </template>

        <view class="btn" hover-class="gz-hover" @click="save">记下这一念</view>
        <text class="form__note">
          "做不了"的那一类不用想办法 —— 写下来放到纸上，就是把它从脑子里挪走了。
        </text>

        <!--
          ④ 反刍后省察（规格 §4.3）：只在「判了做不了、而且给了一个回看的窗口」时挂。
          act 的已经给了去「行」的出路、null 的已经翻篇，都不该再追一句 ——
          否则一天写十念就被追问十次，省察就成了第二个每日待办（违反 §13.1）。
        -->
        <SceneProbe v-if="probeAnchor" scene="thought" :anchor="probeAnchor" />
      </view>

      <!--
        刚记完的出路：有解的那一念，给一条去「行」的路。
        只给路、不代建 —— 立不立这件事由用户定（规格 §4.2「不代建」）。
      -->
      <view v-if="justAct" class="next" hover-class="gz-hover" @click="goAction">
        <view class="next__body">
          <text class="next__title">这一念有解，去行里立起来</text>
          <text class="next__text">立成「今日三件事」里的一件，才算真动手。</text>
        </view>
        <text class="next__go">去行厅 ›</text>
      </view>

      <view class="section">
        <view class="section__head">
          <text class="section__title">今天已止 {{ todayCount }} 念</text>
          <text class="section__hint">不排名 · 不比较</text>
        </view>
        <view v-if="recent.length" class="logs">
          <view v-for="r in recent" :key="r.id" class="log">
            <view class="log__top">
              <text class="log__when">{{ whenOf(r.at) }}</text>
              <text class="log__del" hover-class="gz-hover" @click="remove(r.id)">删</text>
            </view>
            <text class="log__text">{{ r.text }}</text>
            <text class="log__ans" :class="{ 'is-let': r.answer === 'let' }">
              {{ r.answer === 'act' ? '能做' : '先放下' }}{{ r.action ? ` · ${r.action}` : '' }}
            </text>
            <text
              v-if="r.answer === 'let'"
              class="log__shelf"
              :class="{ 'is-due': shelfStateOf(r) === 'due' }"
            >
              {{ shelfTextOf(r) }}
            </text>
          </view>
        </view>
        <text v-else class="empty">还没有记过。下一次念头转起来的时候，回来写一句。</text>
      </view>
    </template>

    <!-- ================= ② 地图：这批念头的形状 ================= -->
    <template v-else>
      <view class="insight">
        <text class="insight__text">{{ thought.insight }}</text>
      </view>

      <!--
        到期轻问：无门槛 —— 它不是统计，是"到点了"这一件事实。
        三个出口：还想（再放三天）/ 现在能做了（去行厅，只给路不代建）/ 过去了（了结）。
      -->
      <view v-if="thought.due.length" class="section">
        <view class="section__title">到点了（{{ thought.due.length }}）</view>
        <view class="dues">
          <view v-for="r in thought.due" :key="r.id" class="due">
            <text class="due__when">{{ dueWhenOf(r) }} · 当初说要看一眼</text>
            <text class="due__text">{{ r.text }}</text>
            <text class="due__q">现在还想吗？</text>
            <view class="due__row">
              <view class="due__btn" hover-class="gz-hover" @click="onStill(r.id)">还想</view>
              <view class="due__btn due__btn--go" hover-class="gz-hover" @click="goAction">
                现在能做了
              </view>
              <view class="due__btn" hover-class="gz-hover" @click="onDone(r.id)">过去了</view>
            </view>
          </view>
        </view>
      </view>

      <view class="section">
        <view class="section__title">能做 / 先放下</view>
        <view v-if="total >= MAP_NEED.ratio" class="ratios">
          <view v-for="row in ratioRows" :key="row.name" class="ratio">
            <text class="ratio__name">{{ row.name }}</text>
            <view class="ratio__bar">
              <view class="ratio__fill" :style="{ width: `${row.pct}%` }" />
            </view>
            <text class="ratio__n">{{ row.count }} 条</text>
          </view>
        </view>
        <text v-else class="empty">还不够看 —— 再写 {{ MAP_NEED.ratio - total }} 念，这里才有得比。</text>
      </view>

      <view class="section">
        <view class="section__title">按时段</view>
        <view v-if="total >= MAP_NEED.band" class="bands">
          <view v-for="b in thought.byHourBand" :key="b.label" class="band">
            <view class="band__track">
              <view class="band__fill" :style="{ height: `${bandPct(b.count)}%` }" />
            </view>
            <text class="band__n">{{ b.count }}</text>
            <text class="band__label">{{ b.label }}</text>
          </view>
        </view>
        <text v-else class="empty">还不够看 —— 再写 {{ MAP_NEED.band - total }} 念，才画得出时段形状。</text>
      </view>

      <!--
        反复出现的那几件：门槛是「跨天出现 ≥ 2 次」—— 同一天写两遍不算反复回来。
        只摆事实（来过几次、最近一次判了什么），不写"你一直在想这件事"。
      -->
      <view class="section">
        <view class="section__title">反复回来的</view>
        <view v-if="total >= MAP_NEED.theme && thought.recurring.length" class="themes">
          <view v-for="t in thought.recurring" :key="t.sample" class="theme">
            <text class="theme__text">{{ t.sample }}</text>
            <text class="theme__meta">
              来过 {{ t.count }} 次 · 最近 {{ mdOf(t.lastDay) }}（当时判「{{
                t.lastAnswer === 'act' ? '能做' : '先放下'
              }}」）
            </text>
          </view>
        </view>
        <text v-else-if="total < MAP_NEED.theme" class="empty">
          还不够看 —— 再写 {{ MAP_NEED.theme - total }} 念，才认得出哪些是回来过的。
        </text>
        <text v-else class="empty">还没有同一件事跨天回来过。这是好事，不必找。</text>
      </view>
    </template>
  </view>
</template>

<script setup lang="ts">
/**
 * 止 · 止念一刻 —— 规格 v2 §4.2 轴一「止念」层。
 *
 * 两个 tab（与冲动记录页同构）：
 *   一刻 —— 写下此刻在反复想的那件事 → 判它现在有没有解 → 记一笔
 *   地图 —— 这批念头的形状（能做/先放下、时段、反复回来的、到点了）
 *
 * 刻意不设计时器：给一段时间是沙漏与茶室的职责（详见 stores/thought.ts 头注释）。
 * 地图只陈述不评价 —— 不给百分比、不写"深夜那一箱"这类结论（见 store 里的 insight）。
 * 样式外置在 thought/index.scss（超过 100 行，按项目约定拆出）。
 */
import { computed, ref } from 'vue'
import { onLoad } from '@dcloudio/uni-app'
import {
  MAP_NEED,
  SHELVE_KINDS,
  THOUGHT_ACTION_MAX,
  THOUGHT_TEXT_MAX,
  shelfStateOf,
  shelfTextOf,
  useThoughtStore,
} from '@/stores/thought'
import type { ShelveKind, ThoughtAnswer, ThoughtRecord } from '@/stores/thought'
import { useSkinClass } from '@/composables/useSkin'
import SceneProbe from '@/components/SceneProbe/SceneProbe.vue'
import { ROUTES } from '@/router/routes'

const thought = useThoughtStore()
const skinClass = useSkinClass()

const TABS = [
  { id: 'log' as const, label: '一刻' },
  { id: 'map' as const, label: '地图' },
]
const tab = ref<'log' | 'map'>('log')

onLoad((query) => {
  if (query?.tab === 'map') tab.value = 'map'
})

/* ---------------- ① 一刻 ---------------- */
const text = ref('')
const action = ref('')
/** 默认「现在能做什么」：止念的落点是行动，先给能走的那条路 */
const answer = ref<ThoughtAnswer>('act')
/** 判「做不了」时的去处：默认不选 = 就此放下（不候回看） */
const shelved = ref<ShelveKind | null>(null)
/** 刚记下的那一念「有解」→ 页面里给一条去「行」的路（跳页后自然消失） */
const justAct = ref(false)
/** 刚记下的那一念的溯源锚点 —— 只在 let + 给了窗口时才有值（省察的由头） */
const probeAnchor = ref('')

const todayCount = computed(() => thought.ofDay().length)
const recent = computed(() => thought.records.slice(0, 8))

/**
 * ② 重复识别：输入 ≥ 4 字时在历史里找最像的一条。
 * 用 computed 而非 watch —— 同一段文本只算一次，且不产生额外副作用。
 */
const echo = computed(() => thought.matchPrior(text.value))

const shelveNote = computed(() => {
  if (shelved.value) return SHELVE_KINDS.find((k) => k.id === shelved.value)?.note ?? ''
  return '不给窗口：写下来就算翻篇，之后不再问你。'
})

const echoDay = computed(() => (echo.value ? mdOf(echo.value.rec.day) : ''))

function save(): void {
  const rec = thought.add({
    text: text.value,
    answer: answer.value,
    action: action.value,
    shelved: answer.value === 'let' ? shelved.value : null,
  })
  if (!rec) {
    uni.showToast({ title: '先写下在反复想的那件事', icon: 'none' })
    return
  }

  justAct.value = rec.answer === 'act'
  /**
   * 省察的由头只有一种：判了做不了、而且给了回看的窗口（还惦记着）。
   * act 已经有去「行」的出路，null 已经翻篇 —— 都不再追问。
   */
  probeAnchor.value = rec.answer === 'let' && rec.shelved ? `thought-${rec.id}` : ''

  text.value = ''
  action.value = ''
  shelved.value = null

  uni.showToast({ title: toastOf(rec), icon: 'none' })
}

function toastOf(rec: ThoughtRecord): string {
  if (rec.answer === 'act') return '记下了 · 5 点修为'
  if (rec.shelved === 'tonight') return '先放下 · 今晚 21:30 再看一眼'
  if (rec.shelved === 'days3') return '先放下 · 三天后见'
  return '先放下 · 不再候着'
}

/** 有解的那一念 → 去行厅立起来（只跳转，不代建） */
function goAction(): void {
  uni.switchTab({ url: ROUTES.tabAction })
}

/* ---------------- ② 地图 ---------------- */
const total = computed(() => thought.records.length)

/** 比例条：只给两个计数，**不给百分比** —— "75% 都只能先放下"本身就是一句负向评价 */
const ratioRows = computed(() => {
  const a = thought.byAnswer
  const n = Math.max(1, a.act + a.let)
  return [
    { name: '能做', count: a.act, pct: Math.round((a.act / n) * 100) },
    { name: '先放下', count: a.let, pct: Math.round((a.let / n) * 100) },
  ]
})

/** 时段柱高按最高的一桶铺满（不按总样本，否则样本一多全是矮桩看不出来） */
function bandPct(count: number): number {
  const max = Math.max(1, ...thought.byHourBand.map((b) => b.count))
  return Math.round((count / max) * 100)
}

/** 到期卡片的头一行：什么时候放下的、放了多久 */
function dueWhenOf(r: ThoughtRecord): string {
  return `${mdOf(r.day)} 放下的`
}

function onStill(id: number): void {
  thought.reshelve(id)
  uni.showToast({ title: '再放三天 · 到点再说', icon: 'none' })
}

function onDone(id: number): void {
  thought.closeShelf(id)
  uni.showToast({ title: '了结了', icon: 'none' })
}

/* ---------------- 通用 ---------------- */
/** 'YYYY-MM-DD' → 'M月D日'（只给月日，年份在止念这个尺度上没有信息量） */
function mdOf(day: string): string {
  const [, m, d] = day.split('-')
  return `${Number(m)}月${Number(d)}日`
}

function whenOf(at: number): string {
  const d = new Date(at)
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getMonth() + 1}/${d.getDate()} ${pad(d.getHours())}:${pad(d.getMinutes())}`
}

function remove(id: number): void {
  uni.showModal({
    title: '删掉这一念？',
    content: '它会从列表里移除，已入账的修为不退。',
    confirmText: '删除',
    cancelText: '留着',
    success: (res) => {
      if (res.confirm) thought.remove(id)
    },
  })
}

function goBack(): void {
  const pages = getCurrentPages()
  if (pages.length > 1) {
    uni.navigateBack()
  } else {
    uni.switchTab({ url: ROUTES.tabPause })
  }
}
</script>

<style lang="scss" scoped>
@import './index.scss';
</style>

<template>
  <view class="page" :class="skinClass">
    <!-- 大厅头：模式化状态栏 -->
    <view class="hall-head">
      <view class="hall-head__row">
        <text class="hall-head__mark">观</text>
        <text class="hall-head__en">INSIGHT · 观事 → 观理 → 观道</text>
      </view>
      <text class="hall-head__state">{{ stateText }}</text>
    </view>

    <!-- 未建档提醒条：跳过建档的人，隔两天在这里温和提一次（不弹窗、不锁功能） -->
    <AssessPrompt />

    <!-- 当前修行语言横幅：与模式选择卡同套艺术画，随皮肤更换 -->
    <view class="hero">
      <!--
        ⚠️ 必须走 modeStore.art（后端 /skins 下发 → 带版本号 → 命中本地缓存读盘），
        不能用 modeMeta.art：那是构建期变量 VITE_SKIN_BASE_URL 拼的静态地址，
        没配该变量时恒为 undefined ✗ → 图永远不出现（「观」页顶部空白就是这个原因）。
      -->
      <image v-if="modeStore.art" class="hero__art" :src="modeStore.art" mode="aspectFill" />
      <view class="hero__veil" />
      <view class="hero__cap">
        <text class="hero__eyebrow">今日修行 · {{ modeMeta.label }} · {{ modeMeta.labelEn }}</text>
        <text class="hero__quote">{{ modeMeta.tagline }}</text>
      </view>
    </view>

    <!-- 每日一则：首开即可见的常驻卡（不进浮层），一日一条、不补不累计 -->
    <view class="section">
      <view class="section__head">
        <text class="section__title">每日一则</text>
        <text class="section__badge">不补不累计</text>
      </view>

      <view class="daily">
        <view class="daily__top">
          <text class="daily__kind">{{ daily.kind }}</text>
          <text v-if="isToday" class="daily__today">今天</text>
          <text v-else-if="isFuture" class="daily__today daily__today--future">未到</text>
          <text v-else class="daily__today daily__today--back">回看</text>
          <!-- 换一个：同一天内在库里往后挪一格，转完一圈自然回到原条（不是随机抽） -->
          <view
            class="daily__swap"
            :class="{ 'is-on': swapCount > 0 }"
            hover-class="gz-hover"
            @click="swapDaily"
          >
            <text class="daily__swap-ico">⟳</text>
            <text class="daily__swap-text">{{ swapCount > 0 ? `换过 ${swapCount}` : '换一个' }}</text>
          </view>
        </view>
        <text class="daily__title">{{ daily.title }}</text>
        <text class="daily__text">{{ daily.text }}</text>
        <text v-if="daily.counter" class="daily__counter">反过来想：{{ daily.counter }}</text>
        <text v-if="daily.source" class="daily__src">{{ daily.source }}</text>

        <!-- 四动作：同一动作不重复计分，当日首次互动入账 -->
        <view class="acts">
          <view
            v-for="a in ACTIONS"
            :key="a.id"
            class="act"
            :class="{ 'is-done': doneActions.includes(a.id) }"
            hover-class="gz-hover"
            @click="doAction(a.id)"
          >
            <text class="act__text">{{ a.label }}</text>
          </view>
        </view>
      </view>

      <!-- 日期拨轮：像密码锁的滚轮，左右拨到哪天，上面就是哪天那一则 -->
      <view class="dial" :class="[`dial--${modeStore.id}`, { 'is-ready': dialReady }]">
        <scroll-view
          class="dial__scroll"
          scroll-x
          :scroll-left="scrollLeft"
          :scroll-with-animation="dialAnim"
          :show-scrollbar="false"
          @scroll="onDialScroll"
        >
          <view class="dial__track" :style="{ paddingLeft: `${padPx}px`, paddingRight: `${padPx}px` }">
            <view
              v-for="(d, i) in dialDays"
              :key="d.date"
              class="dial__cell"
              :class="{ 'is-cur': i === curIndex }"
              @click="pick(i)"
            >
              <text class="dial__num" :style="numStyle(i)">{{ d.day }}</text>
              <text class="dial__sub" :style="subStyle(i)">{{ d.week }}</text>
            </view>
          </view>
        </scroll-view>

        <!-- 两侧毛玻璃：把边缘的日子"糊"掉，视觉重心压回中间 -->
        <view class="dial__veil dial__veil--l" />
        <view class="dial__veil dial__veil--r" />

        <!-- 中心取景窗：只有落在这里的那一格是"选中"的 -->
        <view class="dial__win">
          <view class="dial__bar dial__bar--t" />
          <view class="dial__bar dial__bar--b" />
        </view>
      </view>

      <view class="dial__foot">
        <text class="dial__hint">左右拨动 · 拨到哪天看哪天</text>
        <text class="dial__picked">{{ pickedLabel }}</text>
      </view>
    </view>

    <!-- 强制清理：存了 7 天没动的东西，必须处理或删（不弹窗，只在这里露一句） -->
    <view v-if="dueCount > 0" class="cleandue" hover-class="gz-hover" @click="goDue">
      <text class="cleandue__text">{{ dueCount }} 条存了 7 天还没处理</text>
      <text class="cleandue__go">处理或删 ›</text>
    </view>

    <!-- 记一笔：通栏主入口（不放右下角，避免与小枢浮层打架） -->
    <view class="compose" hover-class="gz-hover" @click="goCompose">
      <text class="compose__plus">＋</text>
      <text class="compose__text">记一笔</text>
      <text class="compose__hint">文章 / 一句话 / 视频</text>
    </view>

    <!-- 信息配额（可点：说清「一次」是什么、额度从哪来） -->
    <view class="quota" :class="{ 'is-out': quotaLeft === 0 }" hover-class="gz-hover" @click="explainQuota">
      <text class="quota__left">今日信息配额</text>
      <text class="quota__right">
        {{ quotaLeft > 0 ? `${quotaLeft} 次深度阅读机会 · 用完即止` : `${quota} 次已用完 · 明天刷新` }}
      </text>
    </view>

    <!-- 观理 / 观道 入口 -->
    <view class="section">
      <view class="section__head">
        <text class="section__title">更深的观察</text>
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

    <!-- 批次 D · 小枢全局浮层 -->
    <BuddyFloat />
  </view>
</template>

<script setup lang="ts">
/**
 * 观 · 信息大厅：观事（发生了什么）→ 观理（意味着什么）→ 观道（底层逻辑）。
 *
 * 批次 E 的重心：把「AI 极简报」换成**每日一则** ——
 *  - 首开即可见的常驻卡（不进浮层），一日一条、不补不累计；
 *  - 下方是**日期拨轮**（密码锁滚轮），今天居正中、前后各 7 天，拨到哪天看哪天；
 *  - 四个动作（认领 / 记住 / 反驳 / 记一笔）都有落点，不是点了就消失的按钮；
 *  - 「记一笔」是用户主动输入的统一入口（事/理/道 × 文章/一句话/视频）。
 */
import { computed, getCurrentInstance, ref } from 'vue'
import { onReady, onShow } from '@dcloudio/uni-app'
import { useModeStore } from '@/stores/mode'
import { useSkinClass } from '@/composables/useSkin'
import { syncTabBar } from '@/utils/skin'
import { getModeMeta } from '@/config/modes'
import { hallStatus } from '@/config/lexicon'
import { dailyOf } from '@/config/daily'
import { useContentStore } from '@/stores/content'
import { useObserveStore } from '@/stores/observe'
import { useReadLaterStore } from '@/stores/readLater'
import { useQualityStore } from '@/stores/quality'
import { poke } from '@/composables/useBuddy'
import { navigateTo, ROUTES } from '@/router/routes'
import type { RoutePath } from '@/router/routes'
import { todayKey } from '@/stores/daily'
import type { EntryBadge } from '@/components/EntryItem/EntryItem.vue'

const modeStore = useModeStore()
const skinClass = useSkinClass()
const readLater = useReadLaterStore()
const quality = useQualityStore()
const observe = useObserveStore()

/* tabBar 原生样式/图标只能在本类大厅页上同步；顺手清理超过 24h 的临时收藏 */
onShow(() => {
  /* 批次 D · 小枢：评估到点激励 / 入定到点提醒 */
  poke()
  syncTabBar(modeStore.id)
  const cleared = readLater.prune()
  if (cleared > 0) {
    uni.showToast({ title: `已自动清走 ${cleared} 条过期收藏`, icon: 'none' })
  }
  /* 只在真的跨天时才把拨轮回正到今天 —— 同一天内来回切 tab 不该丢失你拨到的位置 */
  const t = todayKey()
  if (t !== today.value) {
    today.value = t
    center.value = TODAY_INDEX
    scrollToIndex(TODAY_INDEX)
  }
})

const modeMeta = computed(() => getModeMeta(modeStore.id))

/**
 * 每日信息配额（深度阅读次数）。
 * 基线 3，按**测评的「观」这一维**浮动 ±1 —— 规则与「为什么不可信的结果不采信」
 * 都写在 config/quota.ts 里，这里只负责取数。
 */
const quota = computed(() => observe.quotaTotal())

/* —— 每日一则（远端下发优先，未下发时用内置 30 条） —— */
const content = useContentStore()
const today = ref(todayKey())
const dailyList = computed(() => content.dailyItems())

/* —— 日期拨轮 —— */
/**
 * 一格宽度（rpx）。JS 侧要按它算 scroll-left，所以必须与 .dial__cell 的
 * width 保持一致 —— 改样式请连带改这里，否则"拨到哪天"会和"高亮哪天"错位。
 */
const CELL_RPX = 116
/**
 * 今天左右各留几天。
 *
 * ⚠️ 今天**不放最左端**：拨轮是一根连续的日子轴，今天只是"当前落点"，
 * 两边都得有能拨过去的日子，否则左半边是空杆（而且手指也没法往右拨）。
 * 右侧的未来日期同样算得出来 —— dailyOf 是按「距起始日的天数 % 条数」轮转的，
 * 与"是否已到来"无关，所以往未来拨是有内容的（卡片上标「未到」）。
 */
const PAST_DAYS = 7
const FUTURE_DAYS = 7
const DIAL_COUNT = PAST_DAYS + FUTURE_DAYS + 1
/** 今天在轴上正好居中 */
const TODAY_INDEX = PAST_DAYS

const WEEK = ['周日', '周一', '周二', '周三', '周四', '周五', '周六']

/** 窗口宽度（rpx→px 换算要用到；拿不到就按 375 兜底，只是拨轮略有偏移） */
const winW = ref(375)
try {
  const info = uni.getSystemInfoSync()
  if (info && info.windowWidth) winW.value = info.windowWidth
} catch {
  /* 拿不到系统信息时保持 375 */
}

/**
 * 实测的一格宽度 / 拨轮可视宽度（px）。
 *
 * ⚠️ 别用 `winW * 116 / 750` 去"算" rpx→px：实测这个比例和 windowWidth/750
 * **并不相等**（差几个百分点），乘到第 7 格就是二三十 px —— "今天"会偏出中心窗。
 * 所以以**实际布局结果**为准，公式只当首屏兜底。
 */
const cellPxReal = ref(0)
const boxWReal = ref(0)
/** 量完真实尺寸、并定位到今天之后才显示，避免首屏看到一次跳位 */
const dialReady = ref(false)

/** 一格 / 两侧留白的实际像素 */
const cellPx = computed(() => cellPxReal.value || (winW.value * CELL_RPX) / 750)
const padPx = computed(() => {
  const w = boxWReal.value || winW.value
  return Math.max(0, (w - cellPx.value) / 2)
})

/** 量一下拨轮的真实尺寸；量不到就沿用公式兜底，绝不让拨轮卡在"不可用"状态 */
function measureDial(): Promise<void> {
  return new Promise((resolve) => {
    let done = false
    const finish = (): void => {
      if (done) return
      done = true
      resolve()
    }
    /* 兜底：查询万一不回，也不能让拨轮一直不显示 */
    setTimeout(finish, 300)

    const run = (scoped: boolean): void => {
      let q: ReturnType<typeof uni.createSelectorQuery>
      try {
        const base = uni.createSelectorQuery()
        const inst = getCurrentInstance()
        q = scoped && inst ? base.in(inst.proxy) : base
      } catch {
        finish()
        return
      }
      q.select('.dial__cell').boundingClientRect()
      q.select('.dial__scroll').boundingClientRect()
      q.exec((res: unknown) => {
        if (done) return
        const arr = res as Array<{ width?: number } | null>
        const cw = arr?.[0]?.width
        const bw = arr?.[1]?.width
        if (cw && bw) {
          cellPxReal.value = cw
          boxWReal.value = bw
          finish()
          return
        }
        /* 挂在组件实例上的查询拿不到节点时，退回页面级查询再试一次 */
        if (scoped) run(false)
        else finish()
      })
    }
    run(true)
  })
}

/** 日子轴：左旧右新（与日历方向一致），中间那格是今天 */
const dialDays = computed(() => {
  const base = Date.parse(`${today.value}T12:00:00`)
  const out: Array<{ date: string; day: string; week: string }> = []
  for (let i = -PAST_DAYS; i <= FUTURE_DAYS; i++) {
    const d = new Date(base + i * 86400000)
    const m = `${d.getMonth() + 1}`.padStart(2, '0')
    const day = `${d.getDate()}`.padStart(2, '0')
    out.push({
      date: `${d.getFullYear()}-${m}-${day}`,
      day: `${d.getDate()}`,
      week: i === 0 ? '今天' : WEEK[d.getDay()],
    })
  }
  return out
})

/** 拨轮当前停在哪个"浮点下标"（TODAY_INDEX = 今天；小数表示正在两格之间） */
const center = ref(TODAY_INDEX)
/** 实际滚动位置（px），用于判断"是否已经在这一格"，避免重复下发 scroll-left */
const actualLeft = ref(0)
/** 下发给 scroll-view 的目标位置；只由 pick() / snap / onReady 修改 */
const scrollLeft = ref(TODAY_INDEX * cellPx.value)
/** 首屏定位要"瞬间到位"，之后才开动画（否则一进页面拨轮自己滑一段） */
const dialAnim = ref(false)
/** 落在中心窗里的那一格 */
const curIndex = computed(() => {
  const i = Math.round(center.value)
  return Math.min(DIAL_COUNT - 1, Math.max(0, i))
})
const selectedDate = computed(() => dialDays.value[curIndex.value]?.date ?? today.value)

/** 换一个：同一天内在库里往后挪几条（按天记，切回来还是你换到的那条） */
const offsets = ref<Record<string, number>>({})
const swapCount = computed(() => offsets.value[selectedDate.value] ?? 0)

const daily = computed(() => dailyOf(selectedDate.value, dailyList.value, swapCount.value))
const isToday = computed(() => selectedDate.value === today.value)
/** 拨到了今天之后的日子（日期串是 YYYY-MM-DD，直接比字典序即可） */
const isFuture = computed(() => selectedDate.value > today.value)
const doneActions = computed(() => observe.dailyActionsOf(selectedDate.value))

/**
 * 三模式的拨轮手感：中间字号 / 两侧字号 / 两侧最淡到什么程度。
 *
 * dimMin 别压太狠 —— 拨轮的意义是"两边看得见、能拨过去"，
 * 侧边日期淡到看不见就退化成一个孤零零的数字了。
 */
const DIAL_CORE: Record<string, number> = { normal: 46, tech: 42, dao: 48 }
const DIAL_SIDE: Record<string, number> = { normal: 26, tech: 24, dao: 26 }
const DIAL_DIM: Record<string, number> = { normal: 0.36, tech: 0.34, dao: 0.42 }
const coreFs = computed(() => DIAL_CORE[modeStore.id] ?? 46)
const sideFs = computed(() => DIAL_SIDE[modeStore.id] ?? 26)
const dimMin = computed(() => DIAL_DIM[modeStore.id] ?? 0.36)

/** 某格到中心的档位差（0 = 正中） */
function dist(i: number): number {
  return Math.abs(i - center.value)
}

/** 中间大且实，两侧小且淡 —— 连续插值，跟着手指走，不是"停稳了才变" */
function numStyle(i: number): { opacity: string; fontSize: string } {
  const d = dist(i)
  const fs = Math.max(sideFs.value, coreFs.value - d * (coreFs.value - sideFs.value) * 0.34)
  const op = Math.max(dimMin.value, 1 - d * 0.26)
  return { opacity: `${op}`, fontSize: `${Math.round(fs * 10) / 10}rpx` }
}

function subStyle(i: number): { opacity: string } {
  const d = dist(i)
  return { opacity: `${Math.max(0.3, 1 - d * 0.3)}` }
}

/** 滚到第 i 格。scroll-left 下发相同值不会触发滚动，所以统一"先偏 1px 再回正" */
function scrollToIndex(i: number, force = false): void {
  const target = i * cellPx.value
  if (!force && Math.abs(actualLeft.value - target) < 0.5) return
  scrollLeft.value = target + 1
  setTimeout(() => {
    scrollLeft.value = target
  }, 30)
}

/** 点某一格：让它滑到中心（日期由滚动过程自然带出来，卡片跟着变） */
function pick(i: number): void {
  if (i === curIndex.value) return
  scrollToIndex(i)
}

let snapTimer: ReturnType<typeof setTimeout> | null = null

function onDialScroll(e: { detail?: { scrollLeft?: number } }): void {
  const sl = e?.detail?.scrollLeft ?? 0
  actualLeft.value = sl
  center.value = cellPx.value > 0 ? sl / cellPx.value : 0

  /* 停手后吸附到最近一格：拨轮不能卡在两格中间 */
  if (snapTimer) clearTimeout(snapTimer)
  snapTimer = setTimeout(() => {
    const target = curIndex.value * cellPx.value
    if (Math.abs(scrollLeft.value - target) >= 0.5) {
      scrollLeft.value = target
      try {
        uni.vibrateShort({ type: 'light' })
      } catch {
        /* 不支持震动就算了 */
      }
    }
  }, 130)
}

function swapDaily(): void {
  offsets.value = { ...offsets.value, [selectedDate.value]: swapCount.value + 1 }
}

/**
 * 首屏把拨轮挪到今天（今天在正中，两边各 7 天）。
 *
 * 顺序不能反：**先量真实格宽，再按它定位**。用公式算的格宽会差几个百分点，
 * 乘到第 7 格就足够让"今天"偏出中心窗。定位完成前拨轮整体不显示，
 * 所以用户看不到这次校正动作。保持 dialAnim=false → 首屏是瞬间到位，不会自己滑一段。
 */
onReady(() => {
  measureDial().then(() => {
    scrollToIndex(TODAY_INDEX, true)
    setTimeout(() => {
      dialReady.value = true
      dialAnim.value = true
    }, 80)
  })
})

/** 拨轮下方那行：今天 / X 月 X 日 · 周X */
const pickedLabel = computed(() => {
  const d = selectedDate.value
  const md = `${Number(d.slice(5, 7))} 月 ${Number(d.slice(8, 10))} 日`
  const wk = WEEK[new Date(`${d}T12:00:00`).getDay()]
  return isToday.value ? `今天 · ${wk}` : `${md} · ${wk}`
})

const ACTIONS = [
  { id: 'claim', label: '认领' },
  { id: 'remember', label: '记住' },
  { id: 'refute', label: '反驳' },
  { id: 'note', label: '记一笔' },
] as const

/** 已用配额：今天新存入、且今天读完写完的条数（存量补处理不占额，见 store.quotaUsed） */
const usedQuota = computed(() => observe.quotaUsed())
/** 剩余次数 */
const quotaLeft = computed(() => Math.max(0, quota.value - usedQuota.value))

const stateText = computed(() => hallStatus('observe', modeStore.id, { read: usedQuota.value, quota: quota.value }))

/**
 * 配额说明。
 * 为什么要能点开：只显示「还剩 2 次」，用户不知道「一次」算什么，就会在心里把它
 * 当成一个装饰数字。说清楚「一次 = 今天存 + 今天读完写完，补旧账不算」，
 * 这道闸门才真的能影响他「这篇值不值得占名额」的判断。
 */
function explainQuota(): void {
  uni.showModal({
    title: '今日信息配额',
    content: `今日 ${usedQuota.value}/${quota.value} 次。\n\n「一次」= 今天新存进来的内容，今天读完并写下自己的话。前几天存下的补处理不占额 —— 还债不受限。\n\n${observe.quotaNote()}`,
    showCancel: false,
    confirmText: '知道了',
  })
}

/** 四动作：每个都有落点，且当日同一动作只记一次 */
function doAction(id: (typeof ACTIONS)[number]['id']): void {
  const d = daily.value
  const key = selectedDate.value
  switch (id) {
    case 'claim':
      // 认领 = 立理：带着这一则去写「为什么成立」
      navigateTo(ROUTES.observeCompose, {
        kind: 'theory',
        form: 'quote',
        title: d.title,
        content: d.text,
        src: d.source,
        tag: ['每日一则', d.kind].join(','),
      })
      observe.markDaily(key, 'claim')
      break
    case 'remember': {
      const ok = observe.remember({
        title: d.title,
        content: d.text,
        tags: ['每日一则', d.kind],
        sourceName: d.source,
      })
      observe.markDaily(key, 'remember')
      uni.showToast({
        title: ok ? '已收进待整理 · 记得去补一句为什么成立' : '待整理满了 20 条，先去理一理',
        icon: 'none',
      })
      break
    }
    case 'refute':
      uni.showModal({
        title: '它哪里不成立',
        editable: true,
        placeholderText: '举一个反例，或说出不适用的条件',
        confirmText: '记下',
        cancelText: '算了',
        success: (res) => {
          if (!res.confirm) return
          const text = ((res as { content?: string }).content ?? '').trim()
          if (!text) return
          observe.add({
            kind: 'theory',
            form: 'quote',
            title: `反驳：${d.title}`,
            topics: [],
            tags: ['反驳', d.kind],
            summary: '',
            content: text,
            golden: [],
            sourceName: d.source,
          })
          observe.markDaily(key, 'refute')
          uni.showToast({ title: '已记下这一笔反驳', icon: 'none' })
        },
      })
      break
    case 'note':
      uni.showModal({
        title: '就这一则，写一句',
        editable: true,
        placeholderText: '它让你想到什么',
        confirmText: '记下',
        cancelText: '算了',
        success: (res) => {
          if (!res.confirm) return
          const text = ((res as { content?: string }).content ?? '').trim()
          if (!text) return
          observe.add({
            kind: d.kind === '理' ? 'theory' : 'thing',
            form: 'quote',
            title: d.title,
            topics: [],
            tags: ['每日一则', d.kind],
            summary: '',
            content: text,
            golden: [],
            sourceName: d.source,
          })
          observe.markDaily(key, 'note')
          uni.showToast({ title: '已记下', icon: 'none' })
        },
      })
      break
  }
}

function goCompose(): void {
  navigateTo(ROUTES.observeCompose)
}

/** 存了 7 天没处理的数量（统一清理队列） */
const dueCount = computed(() => observe.dueForCleanup().length)

function goDue(): void {
  navigateTo(ROUTES.observeInbox, { filter: 'due' })
}

interface MoreEntry {
  mark: string
  title: string
  subtitle: string
  badge: EntryBadge
  /** 已落地的子页跳转目标；缺省不跳 */
  url?: RoutePath
  /** 筹备中入口置灰；缺省即可点 */
  disabled?: boolean
}

/** 已被标注过的来源数（质量榜入榜数） */
const ratedSources = computed(() => quality.sources.filter((s) => s.useful + s.useless > 0).length)

/** 更深的观察：收件匣 / 理库 / 母题库 / 质量榜 / 稍后读 */
const moreEntries = computed<MoreEntry[]>(() => {
  const pending = readLater.items.length
  const unhandled = observe.pendingCount
  return [
    {
      mark: '收',
      title: '收件匣',
      subtitle: '你存下的事、理、道，读过写下才算数',
      badge: unhandled > 0 ? { text: `${unhandled} 未处理`, tone: 'accent' } : { text: '都处理了', tone: 'muted' },
      url: ROUTES.observeInbox,
    },
    {
      mark: '理',
      title: '理库',
      subtitle: '你认定「它在什么条件下成立」的那些话 · 含概念播种',
      badge:
        observe.theories.length > 0
          ? { text: `${observe.theories.length} 条理`, tone: 'accent' }
          : { text: '还没有理', tone: 'muted' },
      url: ROUTES.observeTheoryLib,
    },
    {
      mark: '道',
      title: '母题库',
      subtitle: '被同一件事绊倒很多次之后，才认出来的那个问题',
      badge:
        observe.mothers.length > 0
          ? { text: `${observe.mothers.length} 个母题`, tone: 'accent' }
          : { text: '12 个待认领', tone: 'muted' },
      url: ROUTES.observeMotherLib,
    },
    {
      mark: '理',
      title: '信息源质量榜',
      subtitle: '统计各来源历史有用率，留下真正值得读的少数',
      badge:
        ratedSources.value > 0
          ? { text: `${ratedSources.value} 源在榜`, tone: 'accent' }
          : { text: '读后标一笔', tone: 'muted' },
      url: ROUTES.observeQualityBoard,
    },
    {
      mark: '存',
      title: '稍后读 · 碎片回收',
      subtitle: '临时收藏，24 小时未读自动清理，不养"收藏夹僵尸"',
      badge: pending > 0 ? { text: `${pending} 待读`, tone: 'accent' } : { text: '24h 自清', tone: 'muted' },
      url: ROUTES.observeReadLater,
    },
  ]
})
</script>

<style lang="scss" scoped>
.page {
  min-height: 100vh;
  padding: 24rpx $gz-page-pad 60rpx;
}

.hall-head {
  padding: 16rpx 0 30rpx;
}

.hall-head__row {
  display: flex;
  align-items: center;
  gap: 20rpx;
}

/* 模式印章：随皮肤走主色 —— 修仙=朱砂印、科技=电光蓝、普通=橄榄 */
.hall-head__mark {
  display: flex;
  align-items: center;
  justify-content: center;
  flex: none;
  width: 84rpx;
  height: 84rpx;
  font-size: 44rpx;
  font-weight: 800;
  color: $gz-accent;
  background: $gz-accent-soft;
  border: 2rpx solid $gz-accent;
  border-radius: 22rpx;
  line-height: 1;
}

.hall-head__en {
  font-size: $gz-fs-caption;
  letter-spacing: $gz-ls-wide;
  color: $gz-ink-3;
}

.hall-head__state {
  display: block;
  margin-top: 12rpx;
  font-size: $gz-fs-small;
  color: $gz-accent;
}

/* 主屏横幅：三套艺术画之一，随模式切换；底部深色罩保证文字任何图上可读 */
.hero {
  position: relative;
  height: 250rpx;
  border-radius: $gz-radius-lg;
  overflow: hidden;
  box-shadow: 0 12rpx 32rpx rgba(20, 16, 10, 0.14);
  /* 图还没到（首屏弱网 / 下发未就绪）时的兜底：主题渐变占住画面，不让它是个空框 */
  background: linear-gradient(135deg, $gz-accent-soft, $gz-accent);
}

.hero__art {
  display: block;
  width: 100%;
  height: 100%;
}

.hero__veil {
  position: absolute;
  left: 0;
  right: 0;
  bottom: 0;
  height: 78%;
  background: linear-gradient(180deg, rgba(12, 10, 6, 0) 0%, rgba(12, 10, 6, 0.62) 100%);
}

.hero__cap {
  position: absolute;
  left: 30rpx;
  right: 30rpx;
  bottom: 22rpx;
  display: flex;
  flex-direction: column;
}

.hero__eyebrow {
  font-size: $gz-fs-caption;
  letter-spacing: 0.14em;
  color: rgba(255, 255, 255, 0.88);
}

.hero__quote {
  display: block;
  margin-top: 6rpx;
  font-size: 28rpx;
  line-height: 1.55;
  color: #ffffff;
}

.section {
  margin-top: 34rpx;
}

.section__head {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  margin-bottom: 20rpx;
}

.section__title {
  font-size: 32rpx;
  font-weight: 700;
  color: $gz-ink;
}

.section__badge {
  font-size: $gz-fs-caption;
  color: $gz-ink-3;
}

/* 每日一则 */
.daily {
  padding: 30rpx 28rpx 24rpx;
  background: $gz-surface;
  border: 1rpx solid $gz-line;
  border-radius: $gz-radius-md;
}

.daily__top {
  display: flex;
  align-items: center;
  gap: 14rpx;
}

.daily__kind {
  padding: 4rpx 18rpx;
  border-radius: 999rpx;
  background: $gz-accent-soft;
  color: $gz-accent;
  font-size: $gz-fs-caption;
  font-weight: 700;
}

.daily__today {
  font-size: $gz-fs-caption;
  color: $gz-ink-3;
}

.daily__today--back {
  color: #b24a3a;
}

/* 往未来拨到的日子：内容算得出来，但还没到来，标一下别让人误会 */
.daily__today--future {
  color: #8a6a3c;
}

/* 换一个：文字链形态，撑出足够热区；换过之后变成主题色，让人知道"这不是今日原条" */
.daily__swap {
  margin-left: auto;
  display: flex;
  align-items: center;
  gap: 6rpx;
  padding: 6rpx 18rpx;
  border: 1rpx solid $gz-line;
  border-radius: 999rpx;
  background: $gz-input-bg;
}

.daily__swap.is-on {
  border-color: $gz-accent;
  background: $gz-accent-soft;
}

.daily__swap-ico {
  font-size: $gz-fs-caption;
  line-height: 1;
  color: $gz-ink-3;
}

.daily__swap.is-on .daily__swap-ico {
  color: $gz-accent;
}

.daily__swap-text {
  font-size: $gz-fs-caption;
  color: $gz-ink-2;
}

.daily__swap.is-on .daily__swap-text {
  color: $gz-accent;
  font-weight: 600;
}

.daily__title {
  display: block;
  margin-top: 18rpx;
  font-size: 34rpx;
  font-weight: 700;
  line-height: 1.5;
  color: $gz-ink;
}

.daily__text {
  display: block;
  margin-top: 14rpx;
  font-size: $gz-fs-small;
  line-height: 1.9;
  color: $gz-ink-2;
}

.daily__counter {
  display: block;
  margin-top: 16rpx;
  padding: 14rpx 18rpx;
  border-left: 4rpx solid #d9a15b;
  background: #fbf3e6;
  border-radius: 0 $gz-radius-sm $gz-radius-sm 0;
  font-size: $gz-fs-caption;
  line-height: 1.8;
  color: #8a6a3c;
}

.daily__src {
  display: block;
  margin-top: 14rpx;
  font-size: $gz-fs-caption;
  color: $gz-ink-3;
}

/* 四动作 */
.acts {
  display: flex;
  gap: 12rpx;
  margin-top: 22rpx;
  padding-top: 20rpx;
  border-top: 1rpx dashed $gz-line;
}

.act {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 14rpx 0;
  border: 1rpx solid $gz-line;
  border-radius: $gz-radius-sm;
  background: $gz-input-bg;
}

.act.is-done {
  border-color: $gz-accent;
  background: $gz-accent-soft;
}

.act__text {
  font-size: $gz-fs-caption;
  color: $gz-ink-2;
}

.act.is-done .act__text {
  color: $gz-accent;
  font-weight: 600;
}

/* ---------- 日期拨轮（密码锁滚轮） ---------- */
.dial {
  position: relative;
  height: 132rpx;
  margin-top: 18rpx;
  border: 1rpx solid $gz-line;
  border-radius: $gz-radius-md;
  background: $gz-input-bg;
  overflow: hidden;

  /* 三模式可调项，被下方 .dial--xxx 覆盖 */
  --dial-edge: rgba(246, 240, 226, 0.92); // 两端收边色（只在最外侧不足一格处起淡出）
  --dial-win-bg: rgba(255, 255, 255, 0.72); // 中心取景窗填充（在字下层，可以给足）
  --dial-win-line: rgba(109, 139, 63, 0.34); // 中心取景窗描边
}

.dial__scroll {
  position: relative;
  /* 数字压在取景窗**之上**：底衬可以有底色，字永远清晰 */
  z-index: 2;
  height: 100%;
  white-space: nowrap;
  /* 首屏"量格宽 → 定位到今天"期间先藏着，避免看到一次跳位（定位完 .is-ready 放出来） */
  opacity: 0;
  transition: opacity 0.16s ease;
}

.dial.is-ready .dial__scroll {
  opacity: 1;
}

.dial__track {
  display: inline-flex;
  align-items: stretch;
  height: 100%;
}

.dial__cell {
  flex: none;
  width: 116rpx; // ⚠️ 与脚本里的 CELL_RPX 必须一致
  height: 100%;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
}

.dial__num {
  font-size: 26rpx;
  font-weight: 700;
  line-height: 1.05;
  color: $gz-ink;
}

.dial__sub {
  margin-top: 6rpx;
  font-size: 20rpx;
  line-height: 1.1;
  color: $gz-ink-3;
}

/* 正中那一格：主题色 + 加粗，其余靠内联 opacity/font-size 渐变 */
.dial__cell.is-cur .dial__num {
  font-weight: 800;
  color: $gz-accent;
}

.dial__cell.is-cur .dial__sub {
  font-weight: 600;
  color: $gz-accent;
}

/**
 * 两端收边。
 * ⚠️ 宽度**必须小于一格**（116rpx）：它只负责把被容器切掉的那半格柔化掉，
 * 不能盖住完整的日子 —— 之前 170rpx 的宽遮罩 + backdrop-filter 直接把
 * 左半边拨轮糊没了，看不出两边有日期。
 */
.dial__veil {
  position: absolute;
  z-index: 3;
  top: 0;
  bottom: 0;
  width: 92rpx;
  pointer-events: none;
}

.dial__veil--l {
  left: 0;
  background: linear-gradient(90deg, var(--dial-edge) 0%, rgba(255, 255, 255, 0) 100%);
}

.dial__veil--r {
  right: 0;
  background: linear-gradient(270deg, var(--dial-edge) 0%, rgba(255, 255, 255, 0) 100%);
}

/**
 * 中心取景窗：告诉用户"只有这一格是选中的"。
 * ⚠️ 必须在数字**下层**（z-index 1 + .dial__scroll 是 2）——之前它盖在字上，
 * 那层半透明白等于给「今天」糊了层雾，反而比两侧的邻格还虚。
 */
.dial__win {
  position: absolute;
  z-index: 1;
  top: 14rpx;
  bottom: 14rpx;
  left: 50%;
  width: 104rpx;
  margin-left: -52rpx;
  border-radius: 14rpx;
  border: 1rpx solid var(--dial-win-line);
  background: var(--dial-win-bg);
  pointer-events: none;
}

.dial__bar {
  position: absolute;
  left: 50%;
  width: 60rpx;
  height: 2rpx;
  margin-left: -30rpx;
  background: transparent;
}

.dial__bar--t {
  top: 0;
}

.dial__bar--b {
  bottom: 0;
}

.dial__foot {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  margin-top: 12rpx;
}

.dial__hint {
  font-size: $gz-fs-caption;
  color: $gz-ink-3;
}

.dial__picked {
  font-size: $gz-fs-caption;
  color: $gz-ink-2;
  font-weight: 600;
}

/* —— 普通 · 手账纸：圆润纸槽，柔和不抢 —— */
.dial--normal {
  --dial-edge: rgba(246, 240, 226, 0.92);
  --dial-win-bg: rgba(255, 255, 255, 0.78);
  --dial-win-line: rgba(109, 139, 63, 0.34);
}

.dial--normal .dial__win {
  border-radius: 16rpx;
}

/* —— 科技 · 实验室：锐利取景框 + 电光蓝上下卡尺 —— */
.dial--tech {
  --dial-edge: rgba(26, 36, 49, 0.92);
  --dial-win-bg: rgba(63, 169, 255, 0.16);
  --dial-win-line: rgba(63, 169, 255, 0.55);
}

.dial--tech .dial__win {
  border-radius: 6rpx;
  box-shadow: inset 0 0 18rpx rgba(63, 169, 255, 0.16);
}

.dial--tech .dial__bar {
  width: 92rpx;
  margin-left: -46rpx;
  background: #3fa9ff;
}

.dial--tech .dial__num {
  font-variant-numeric: tabular-nums;
}

/* —— 修仙 · 水墨：朱砂印框，宽字距 —— */
.dial--dao {
  --dial-edge: rgba(239, 231, 208, 0.92);
  --dial-win-bg: rgba(255, 255, 255, 0.64);
  --dial-win-line: rgba(164, 71, 31, 0.5);
}

.dial--dao .dial__win {
  border-radius: 8rpx;
}

.dial--dao .dial__bar {
  background: #a4471f;
}

.dial--dao .dial__num {
  letter-spacing: 0.08em;
}

/* 7 天清理提示 */
.cleandue {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-top: 18rpx;
  padding: 18rpx 26rpx;
  border: 1rpx solid #e0b3a8;
  border-radius: $gz-radius-md;
  background: #fbf0ec;
}

.cleandue__text {
  font-size: $gz-fs-small;
  color: #b24a3a;
}

.cleandue__go {
  font-size: $gz-fs-caption;
  color: #b24a3a;
  font-weight: 600;
}

/* 记一笔通栏入口 */
.compose {
  display: flex;
  align-items: center;
  gap: 16rpx;
  margin-top: 26rpx;
  padding: 28rpx 30rpx;
  border-radius: $gz-radius-md;
  background: $gz-accent;
}

.compose__plus {
  font-size: 40rpx;
  line-height: 1;
  color: $gz-on-cta;
}

.compose__text {
  font-size: 32rpx;
  font-weight: 700;
  letter-spacing: 0.06em;
  color: $gz-on-cta;
}

.compose__hint {
  margin-left: auto;
  font-size: $gz-fs-caption;
  color: $gz-on-cta;
  opacity: 0.85;
}

.quota {
  margin-top: 16rpx;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 20rpx 26rpx;
  border: 1rpx dashed $gz-line;
  border-radius: $gz-radius-md;
}

.quota__left {
  font-size: $gz-fs-small;
  font-weight: 600;
  color: $gz-ink;
}

/* 用尽：虚线「提醒」变成实线「到位」—— 让它看起来像一道真的关上了的门 */
.quota.is-out {
  border-style: solid;
  border-color: $gz-accent;
  background: $gz-accent-soft;
}

.quota__right {
  font-size: $gz-fs-caption;
  color: $gz-ink-3;
}

.quota.is-out .quota__right {
  color: $gz-accent;
  font-weight: 600;
}

.entries {
  display: flex;
  flex-direction: column;
  gap: 18rpx;
}
</style>

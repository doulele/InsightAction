<template>
  <view class="page" :class="skinClass" @touchstart="armDwell">
    <!-- 大厅头（五页共用组件：主题艺术画作背景 + 印章 + 定位 + 状态 + 修行语言横幅） -->
    <HallHead mark="观" en="INSIGHT · 观事 → 观理 → 观道" :state="stateText" show-cap />

    <!-- 第一周解锁引导：今天的主角在这里才挂出 -->
    <WeekGuide for="observe" />

    <!-- 未建档提醒条：跳过建档的人，隔两天在这里温和提一次（不弹窗、不锁功能） -->
    <AssessPrompt />

    <!--
      外部入口（信息工作台）：只有「今天几个事件」与一个出口，**不含任何新闻内容**。
      个人主体小程序不可选「新闻资讯」类目，页面里出现标题/摘要即构成类目不符，
      所以事实层留在网站侧，这里只做一道"门"（形态上是入口条，不是内容卡）。

      位置在每日一则之上：它是"外面世界"的入口 —— 先让用户知道"那边有人替你盯着"，
      再进入今天那一条。顺序与「观事 → 观理 → 观道」一致。
    -->
    <view v-if="portal" class="portal" hover-class="gz-hover" @click="openPortal">
      <text class="portal__title">今日要闻</text>
      <text class="portal__sub">{{ PORTAL_HINT }}</text>
      <text class="portal__arrow">›</text>
    </view>

    <!-- 每日一则：首开即可见的常驻卡（不进浮层），一日一条、不补不累计 -->
    <!-- id="daily"：第一周引导「先读一条」的滚动落点（WeekGuide 的 #daily），改名要同步改 config/unlock.ts -->
    <view id="daily" class="section">
      <view class="section__head">
        <text class="section__title">每日一则</text>
        <text class="section__badge">不补不累计</text>
      </view>

      <view class="daily">
        <view class="daily__top">
          <!-- 类别胶囊：「事 · 最近发生的」—— 类别按天分派后，必须让用户知道这一条属于哪个范畴 -->
          <text class="daily__kind">{{ daily.kind }} · {{ kindNote }}</text>
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
        <!-- 正文限高可滚：最长 600 字，全展开会把卡片撑到两三屏，反例/四动作/追问都被挤走 -->
        <scroll-view class="daily__text-box" scroll-y>
          <text class="daily__text">{{ daily.text }}</text>
        </scroll-view>
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

        <!--
          读完追问：把「观」和「知」接上（观 → 知 的最小闭环）。
          只对"今天"开放 —— 它的意义是"刚读完这一条，顺手想一想"，
          回看历史时不该再冒出来（也不该让同一天堆出第二张卡）。
        -->
        <view v-if="isToday" class="ask">
          <view v-if="askAnswered" class="ask__done">
            <text class="ask__done-text">已想过 · 收进「知」的最近所悟</text>
          </view>

          <view v-else-if="!askOpen" class="ask__entry" hover-class="gz-hover" @click="askOpen = true">
            <text class="ask__entry-text">读完想想 ›</text>
          </view>

          <view v-else class="ask__body">
            <text class="ask__q">{{ askQuestion }}</text>
            <textarea
              v-model="askDraft"
              class="ask__input"
              :maxlength="300"
              placeholder="一句话就行，不必写成文章…"
              placeholder-class="ask__ph"
            />
            <view class="ask__acts">
              <text class="ask__cancel" hover-class="gz-hover" @click="askOpen = false">先不想</text>
              <text class="ask__save" hover-class="gz-hover" @click="saveAsk">存下</text>
            </view>
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
        <!-- 底噪过滤器：只切显示，不删数据（生存刚需模式） -->
        <text
          class="noise"
          :class="{ 'is-on': settings.lowNoise }"
          hover-class="gz-hover"
          @click="toggleLowNoise"
        >
          {{ settings.lowNoise ? '底噪过滤器 · 已开' : '底噪过滤器' }}
        </text>
      </view>
      <text v-if="settings.lowNoise" class="noise__note">
        生存刚需模式：只留今天要处理的事和今天那一条。数据一条没删，关掉就回来。
      </text>
      <view class="entries">
        <EntryItem
          v-for="item in visibleEntries"
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

    <!-- 出口说明：讲清"为什么不在这里看"，而不是直接甩一个外链 -->
    <GzDialog
      :show="portalOpen"
      :art="modeStore.art"
      title="去信息工作台"
      content="今天的要闻、多源核实与事件脉络都在信息工作台 —— 那是你的网站。小程序里只留认知与修行：看完就关，想追源头时再过去。"
      note="复制后请在浏览器或聊天窗口粘贴打开"
      cancel-text="知道了"
      confirm-text="复制链接"
      @cancel="portalOpen = false"
      @confirm="copyPortal"
    />

    <!-- 隐私授权拦截弹窗：复制链接前需征得同意 -->
    <PrivacyGate />

    <!-- 批次 D · 小枢全局浮层 -->
    <BuddyFloat />

    <!-- 远端提示层：公告 + 版本更新（强制更新 / 新包已下载、重启生效） -->
    <RemoteNotice />
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
import { computed, getCurrentInstance, ref, watch } from 'vue'
import HallHead from '@/components/HallHead/HallHead.vue'
import WeekGuide from '@/components/WeekGuide/WeekGuide.vue'
import { onHide, onReady, onShow } from '@dcloudio/uni-app'
import { useModeStore } from '@/stores/mode'
import { useSkinClass } from '@/composables/useSkin'
import { syncTabBar } from '@/utils/skin'
import { hallStatus } from '@/config/lexicon'
import { dailyOf } from '@/config/daily'
import type { DailyKind } from '@/config/daily'
import { useContentStore } from '@/stores/content'
import { useObserveStore } from '@/stores/observe'
import { useKnowledgeStore } from '@/stores/knowledge'
import { useReadLaterStore } from '@/stores/readLater'
import { useQualityStore } from '@/stores/quality'
import { useSettingsStore } from '@/stores/settings'
import { DWELL_MS, dwellTip, poke } from '@/composables/useBuddy'
import { navigateTo, ROUTES } from '@/router/routes'
import type { RoutePath } from '@/router/routes'
import { todayKey } from '@/stores/daily'
import GzDialog from '@/components/GzDialog/GzDialog.vue'
import type { EntryBadge } from '@/components/EntryItem/EntryItem.vue'

const modeStore = useModeStore()
const skinClass = useSkinClass()
const readLater = useReadLaterStore()
const quality = useQualityStore()
const observe = useObserveStore()
const settings = useSettingsStore()

/* tabBar 原生样式/图标只能在本类大厅页上同步；顺手清理超过 24h 的临时收藏 */
onShow(() => {
  /* 批次 D · 小枢：评估到点激励 / 入定到点提醒 */
  poke()
  syncTabBar(modeStore.id)
  armDwell()
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

onHide(() => {
  clearDwell()
})

/*
 * 心魔预警：在「观」里停留满 5 分钟且没有任何操作 → 小枢气泡把人拉去「止」。
 * 任何一次触摸都会重新计时（页面根节点绑 touchstart），所以只有"停着不动"才会触发。
 */
let dwellTimer: ReturnType<typeof setTimeout> | null = null

function clearDwell(): void {
  if (dwellTimer) {
    clearTimeout(dwellTimer)
    dwellTimer = null
  }
}

function armDwell(): void {
  clearDwell()
  dwellTimer = setTimeout(() => dwellTip('observe'), DWELL_MS)
}

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

/* —— 外部入口（信息工作台）：只有数字与出口，内容全部留在网站侧 —— */
const portal = computed(() => content.portal)
const portalOpen = ref(false)

/**
 * 入口右侧文案 —— 固定一句话。
 *
 * 为什么不用数字：事件数实测每天都是 40~60（取决于清晨那次抓取抓了多少），
 * 用户看久了会把它当装饰。少一个会变的数字，反而少一分"每天一样"的疲态。
 *
 * 为什么是「替你」而不是「已」：这个入口存在的理由就是省下你自己刷的力气 ——
 * "已归拢"只是陈述一个状态，"替你归拢"说的才是它替你做了什么。
 */
const PORTAL_HINT = '今日消息已替你归拢'

function openPortal(): void {
  portalOpen.value = true
}

/**
 * 复制出口地址。
 *
 * 为什么是复制而不是跳转：个人主体小程序没有业务域名白名单，web-view 打不开外站
 * —— 与本项目其它外链同一套做法（见 subpkg-observe 的 copyThenTip）。
 */
function copyPortal(): void {
  const url = portal.value?.url
  portalOpen.value = false
  if (!url) return
  uni.setClipboardData({
    data: url,
    success: () => uni.showToast({ title: '已复制 · 粘贴到浏览器打开', icon: 'none', duration: 2600 }),
    fail: () => uni.showToast({ title: '复制失败，请手动输入网址', icon: 'none' }),
  })
}

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

/**
 * 类别的一句话说明。
 *
 * 为什么需要：类别按天分派后，用户某天看到的是「理」或「典」—— 不点明范畴，
 * 他会以为"今天怎么没讲事"。这句话也让「观事 → 观理 → 观道」的结构在界面上看得见。
 */
const KIND_NOTE: Record<DailyKind, string> = {
  事: '最近发生的',
  理: '一条规律',
  典: '前人说的',
}
const kindNote = computed(() => KIND_NOTE[daily.value.kind])

/* —— 读完追问：观 → 知 的最小闭环 —— */
const knowledge = useKnowledgeStore()
const askOpen = ref(false)
const askDraft = ref('')

/**
 * 追问问题：后端下发优先（将来若用模型生成更贴题的问题就下发到 daily.ask），
 * 否则按类别取模板。
 *
 * 模板为什么按类别分：三类内容"该想什么"本来就不同 ——
 * 「事」要迁移（在哪还见过）、「理」要找边界（何时不成立）、
 * 「典」要落地（上次用它是什么时候）。零成本，且够用。
 */
const ASK_TEMPLATE: Record<DailyKind, string> = {
  事: '你最近在哪见过同一个机制？',
  理: '它在什么条件下不成立？',
  典: '你上一次用它是什么时候？',
}
const askQuestion = computed(() => daily.value.ask || ASK_TEMPLATE[daily.value.kind])

/**
 * 今天是否已答过。
 *
 * 靠卡片 src 里的日期判断（格式约定：`每日一则 · 追问 · YYYY-MM-DD`）——
 * 这样"一天一条"不需要额外的状态存储，答案本身就在知识库里。
 */
const askAnswered = computed(() =>
  knowledge.cards.some((c) => c.kind === 'daily' && c.src.endsWith(today.value)),
)

/* 拨到别的日期时收起输入区，避免回看时还开着今天的输入框 */
watch(selectedDate, () => {
  askOpen.value = false
})

/** 存下追问的答案 → 成为「知」里的一张 Lv.2 卡片 */
function saveAsk(): void {
  const text = askDraft.value.trim()
  if (!text) {
    uni.showToast({ title: '写一句再存', icon: 'none' })
    return
  }
  knowledge.add({
    kind: 'daily',
    title: `读「${daily.value.title.slice(0, 14)}」`,
    content: text,
    tags: ['每日一则', daily.value.kind],
    depth: 2,
    src: `每日一则 · 追问 · ${today.value}`,
  })
  askOpen.value = false
  askDraft.value = ''
  uni.showToast({ title: '已收进「知」的最近所悟', icon: 'none' })
}
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
  /** 生存刚需：底噪过滤器打开时仍保留（目前只有「今天要处理的事」） */
  essential?: boolean
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
      /* 生存刚需：待处理的事是「刚需」，底噪过滤器开着时它依然在 */
      essential: true,
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

/* —— 底噪过滤器（生存刚需模式）：只切显示，不删数据 —— */
const visibleEntries = computed<MoreEntry[]>(() =>
  settings.lowNoise ? moreEntries.value.filter((e) => e.essential) : moreEntries.value,
)

function toggleLowNoise(): void {
  settings.lowNoise = !settings.lowNoise
  uni.showToast({
    title: settings.lowNoise ? '已开 · 只看今天要处理的事' : '已关 · 恢复全部入口',
    icon: 'none',
  })
}
</script>

<style lang="scss" scoped>
@import './index.scss';
</style>

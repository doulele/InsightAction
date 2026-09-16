<template>
  <view class="page" :class="skinClass" @touchstart="armDwell">
    <!-- 大厅头（五页共用组件：主题艺术画作背景 + 印章 + 定位 + 状态） -->
    <HallHead mark="知" en="KNOW · 转述 → 重构 → 内化" :line="headLine" :stats="headStats" />

    <!-- 第一周解锁引导：今天的主角在这里才挂出 -->
    <WeekGuide for="reflect" />

    <!-- 每日灵魂拷问 -->
    <!-- id="question"：第一周引导「第一次省察」的滚动落点（WeekGuide 的 #question），改名要同步改 config/unlock.ts -->
    <view id="question" class="question">
      <view class="question__head">
        <text class="question__label">每日灵魂拷问</text>
        <text v-if="answered" class="question__tag">已答</text>
      </view>
      <text class="question__text">{{ questionText }}</text>
      <textarea
        v-model="draft"
        class="question__input"
        :placeholder="answered ? '当天可修改，回答以最新为准' : questionPlaceholder"
        placeholder-class="question__ph"
        :maxlength="200"
        auto-height
      />
      <button class="question__btn" hover-class="gz-hover" @click="submitAnswer">
        {{ answered ? '更新回答' : '写下回答' }}
      </button>
      <text class="question__note">{{ questionNote }}</text>
    </view>

    <!-- 认知卡片流 -->
    <view class="section">
      <view class="section__head">
        <view>
          <text class="section__title">最近所悟</text>
          <text class="section__hint">拷问 / 播种收成 / 行动回写，都汇到这里</text>
        </view>
        <text class="section__badge">{{ cards.length }} 条 · 深度 Lv.1-3</text>
      </view>

      <view v-if="!cards.length" class="empty">
        <view class="empty__seal gz-motion">悟</view>
        <text class="empty__title">{{ $p('empty.reflect.title') }}</text>
        <text class="empty__desc">{{ $p('empty.reflect.desc') }}</text>
      </view>
      <view v-else class="list">
        <view
          v-for="card in cards"
          :key="card.key"
          class="card"
          hover-class="gz-hover"
          @click="openCard(card)"
        >
          <view class="card__top">
            <text class="card__tag" :style="{ color: card.color, background: card.colorSoft }">
              {{ card.depthLabel }}
            </text>
            <text class="card__src">{{ card.src }}</text>
          </view>
          <text class="card__title">{{ card.title }}</text>
          <text class="card__digest">{{ card.content }}</text>
          <view v-if="card.tags.length" class="card__tags">
            <text v-for="t in card.tags" :key="t" class="card__tag-mini">{{ t }}</text>
          </view>
        </view>
      </view>
    </view>

    <!--
      自我画像（规格 §9.4）：系统从脊椎里算出来的形状。
      口径是**只摆形状，不下结论** —— 每条只报样本数与分布，样本不够就如实说还差多少。
      不写「你是一个……的人」，也不给建议：判语指不回任何一条记录，用久了会把人钉住（§7 反目标）。
    -->
    <view class="section">
      <view class="section__head">
        <view>
          <text class="section__title">自我画像</text>
          <text class="section__hint">从你留下的痕迹里算出来的，不是你自己填的</text>
        </view>
        <text class="section__badge">{{ profile.readyCount }}/{{ profile.items.length }} 成形</text>
      </view>
      <view class="pf">
        <view v-for="it in profile.items" :key="it.key" class="pf__row">
          <view class="pf__side">
            <text class="pf__label">{{ it.label }}</text>
            <text class="pf__n" :class="{ 'is-on': it.samples >= it.need }">
              {{ it.samples >= it.need ? `${it.samples} 次` : `${it.samples}/${it.need}` }}
            </text>
          </view>
          <text class="pf__text" :class="{ 'is-pend': it.samples < it.need }">
            {{ it.samples >= it.need ? it.text : it.pend }}
          </text>
        </view>
      </view>
      <text v-if="profile.summary" class="pf__summary">{{ profile.summary }}</text>
      <text class="pf__note">只摆形状，不下结论 —— 攒够样本才出现，不够就如实说还差多少。</text>
    </view>

    <!-- 工具入口 -->
    <!--
      止念机制（规格 §4.1「止念」）：知这一环最容易停在纸上。
      写完却一条都没用过时，这里不再鼓励多写，而是主动建议「停笔，去实践」。
    -->
    <view v-if="stopPen" class="stoppen" hover-class="gz-hover" @click="goAction">
      <view class="stoppen__body">
        <text class="stoppen__title">停笔，去实践</text>
        <text class="stoppen__text">{{ stopPen }}</text>
      </view>
      <text class="stoppen__go">去行厅 ›</text>
    </view>

    <view class="section">
      <view class="section__head">
        <text class="section__title">把输入变成思想</text>
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
          :params="item.params"
          :disabled="item.disabled"
        />
      </view>
    </view>

    <!-- 卡片详情层 -->
    <view v-if="active" class="mask" @click="closeSheet">
      <view class="sheet" @click.stop>
        <view class="sheet__head">
          <text class="sheet__tag" :style="{ color: active.color, background: active.colorSoft }">
            {{ active.depthLabel }}
          </text>
          <text class="sheet__src">{{ active.src }}</text>
        </view>
        <text class="sheet__title">{{ active.title }}</text>
        <text class="sheet__content">{{ active.content }}</text>
        <view v-if="active.tags.length" class="sheet__tags">
          <text v-for="t in active.tags" :key="t" class="card__tag-mini">{{ t }}</text>
        </view>

        <!--
          「我用上了」= 知 → 行的唯一出口（规格 §9.4：知必须有迁移，否则只停在纸上）。
          点它 = 承认这条已经不在纸上：记一笔 reflect.apply(15) 并把这张卡推到 Lv.3 内化。
        -->
        <view v-if="active.depth < 3" class="sheet__apply" hover-class="gz-hover" @click="applyCard">
          我用上了 · 记一笔内化
        </view>
        <view v-else class="sheet__applied">已内化 · 这条已经在现实里用过了</view>

        <view v-if="canDeepen" class="sheet__deepen" hover-class="gz-hover" @click="deepen">
          再加工一层 → {{ nextLabel }}
        </view>
        <button v-if="!isLiveQuestion" class="sheet__btn sheet__btn--danger" hover-class="gz-hover" @click="dropCard">
          移除这张卡
        </button>
        <view class="sheet__close" hover-class="gz-hover" @click="closeSheet">关闭</view>
      </view>
    </view>

    <!-- 批次 D · 小枢全局浮层 -->
    <BuddyFloat />

    <!-- 远端提示层：公告 + 版本更新（强制更新 / 新包已下载、重启生效） -->
    <RemoteNotice />
  </view>
</template>

<script setup lang="ts">
/**
 * 知 · 悟道大厅（批次 C 起真实接线）：
 * - 每日灵魂拷问：每晚 21:00 换题，回答按题期存档，连续作答有记录；
 * - 认知卡片流：拷问作答 / 概念播种收成 / 行动回写 / 手动转述，统一流入知识库；
 * - 知识库 / 成长曲线为真实子页；费曼速记（AI 语音转写）需后端，保持规划态。
 */
import { computed, ref } from 'vue'
import HallHead from '@/components/HallHead/HallHead.vue'
import { hallLine } from '@/config/lexicon'
import WeekGuide from '@/components/WeekGuide/WeekGuide.vue'
import { onHide, onShow } from '@dcloudio/uni-app'
import { useModeStore } from '@/stores/mode'
import { useQuestionStore, rolloverRemainMin } from '@/stores/question'
import { useKnowledgeStore, DEPTH_LABEL, depthColor, type CardDepth, type KnowledgeCard } from '@/stores/knowledge'
import { useTraceStore } from '@/stores/trace'
import { DWELL_MS, dwellTip, poke } from '@/composables/useBuddy'
import { logTrace } from '@/utils/traceLog'
import { useSkinClass } from '@/composables/useSkin'
import { syncTabBar } from '@/utils/skin'
import { dayStats } from '@/utils/growth'
import { buildProfile } from '@/utils/profile'
import { refOfCard } from '@/utils/refSource'
import { todayKey } from '@/stores/daily'
import { navigateTo, ROUTES } from '@/router/routes'
import type { RouteParams, RoutePath } from '@/router/routes'
import type { EntryBadge } from '@/components/EntryItem/EntryItem.vue'

const modeStore = useModeStore()
const skinClass = useSkinClass()
const question = useQuestionStore()
const knowledge = useKnowledgeStore()
const trace = useTraceStore()

onShow(() => {
  /* 批次 D · 小枢：评估到点激励 / 入定到点提醒 */
  poke()
  syncTabBar(modeStore.id)
  armDwell()
  question.ensureToday()
  draft.value = question.today()?.answer ?? ''
})

onHide(() => {
  clearDwell()
})

/* 止念：停留过久且无操作 → 小枢把人赶去「行」（同一天只提醒一次） */
let dwellTimer: ReturnType<typeof setTimeout> | null = null

function clearDwell(): void {
  if (dwellTimer) {
    clearTimeout(dwellTimer)
    dwellTimer = null
  }
}

function armDwell(): void {
  clearDwell()
  dwellTimer = setTimeout(() => dwellTip('reflect'), DWELL_MS)
}

/**
 * 止念触发条件：今天产出过东西（卡片 / 拷问作答）但一次「我用上了」都还没有。
 * 刻意不在产出为 0 时出现 —— 那会让「知」还没开始就被劝退。
 */
/* 自我画像：派生数据，不入库、不持久化 —— 每次进场按当前脊椎重算一遍 */
const profile = computed(() => buildProfile())

const stopPen = computed(() => {
  const k = todayKey()
  const st = dayStats(k)
  const produced = st.cards + (st.answered ? 1 : 0)
  if (produced <= 0) return ''
  const used = trace.ofDay(k).some((t) => t.kind === 'reflect.apply')
  if (used) return ''
  return `今天写了 ${produced} 条，一条都还没用上 —— 用过的才算你的。`
})

function goAction(): void {
  navigateTo(ROUTES.tabAction)
}

/* —— 每日灵魂拷问 —— */
const draft = ref('')
const answered = computed(() => question.answeredToday())
const questionText = computed(() => question.today()?.q ?? '')
const questionPlaceholder = '哪怕一句话。写下它，它才算被你吸收…'

const questionNote = computed(() => {
  const streak = question.consecutiveDays()
  const rollover = rolloverRemainMin()
  const hour = Math.floor(rollover / 60)
  const min = rollover % 60
  const remain = hour > 0 ? `${hour} 小时 ${min} 分` : `${min} 分`
  return answered.value
    ? `已连续 ${streak} 天作答 · ${remain} 后换题`
    : `每晚 21:00 换题 · ${remain} 后换题 · 连续作答建立复盘习惯`
})

function submitAnswer(): void {
  const t = draft.value.trim()
  if (!t) {
    uni.showToast({ title: '先写点什么吧', icon: 'none' })
    return
  }
  const first = !question.answeredToday()
  question.setAnswer(t)
  // 仅首次作答入账（沿用原 8 分口径，与事件表 10 分不同 → 显式指定）
  if (first) logTrace({ kind: 'reflect.probe', text: '回答了今日一问', value: 8 })
  uni.showToast({ title: answered.value ? '已更新今天的回答' : '已记录 · 流入今日所悟', icon: 'none' })
}

/* —— 认知卡片流（合并：拷问作答即时卡 + 知识库卡） —— */
interface ViewCard {
  key: string
  raw: KnowledgeCard | null
  depth: CardDepth
  depthLabel: string
  color: string
  colorSoft: string
  title: string
  content: string
  tags: string[]
  src: string
}

/** 今日拷问的回答即时成为 Lv.3 内化卡 */
const liveQuestionCard = computed<ViewCard | null>(() => {
  if (!question.answeredToday()) return null
  const rec = question.today()
  if (!rec) return null
  return {
    key: `question:${questionSlotDate()}`,
    raw: null,
    depth: 3,
    depthLabel: DEPTH_LABEL[3],
    color: depthColor(3),
    colorSoft: 'rgba(156, 138, 196, 0.16)',
    title: `答今日拷问 · ${questionSlotDate()}`,
    content: rec.answer,
    tags: ['拷问'],
    src: '每日灵魂拷问 · Lv.3 内化',
  }
})

function questionSlotDate(): string {
  // 题期键即 'YYYY-MM-DD'，直接展示
  const d = new Date()
  const h = d.getHours()
  const t = h >= 21 ? new Date(d.getTime() + 24 * 60 * 60 * 1000) : d
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${t.getFullYear()}-${pad(t.getMonth() + 1)}-${pad(t.getDate())}`
}

const cards = computed<ViewCard[]>(() => {
  const list: ViewCard[] = []
  const q = liveQuestionCard.value
  if (q) list.push(q)
  knowledge.cards.forEach((c) => {
    list.push({
      key: `card:${c.createdAt}`,
      raw: c,
      depth: c.depth,
      depthLabel: DEPTH_LABEL[c.depth],
      color: depthColor(c.depth),
      colorSoft: `rgba(${c.depth === 1 ? '132, 162, 104' : c.depth === 2 ? '78, 143, 212' : '156, 138, 196'}, 0.14)`,
      title: c.title,
      content: c.content,
      tags: c.tags,
      src: c.src,
    })
  })
  return list.slice(0, 20)
})

/**
 * 大厅头部的「一句」+ 两个关键数字（2026-09-16 定的形态）。
 * 一句走 lexicon.hallLine 的三模式措辞；数字给"知识卡总数"与"连续省察天数"，
 * 与下面「每日灵魂拷问」卡（问题 + 输入）不是同一维度，不重复。
 */
const headLine = computed(() => hallLine('reflect', modeStore.id))

const headStats = computed(() => [
  { value: `${cards.value.length}`, label: '知识卡 · 张' },
  { value: `${question.consecutiveDays()}`, label: '连续省察 · 天' },
])

/* —— 详情层 —— */
const detailOpen = ref(false)
const active = ref<ViewCard | null>(null)

const isLiveQuestion = computed(() => Boolean(active.value && !active.value.raw))
const nextLabel = computed(() =>
  active.value && active.value.depth < 3 ? DEPTH_LABEL[(active.value.depth + 1) as CardDepth] : '',
)
/** 仅对「可再加工」的真卡片（非拷问即时卡）显示加深入口 */
const canDeepen = computed(() => {
  const a = active.value
  return Boolean(a && a.raw && a.raw.depth < 3)
})

function openCard(card: ViewCard): void {
  active.value = card
  detailOpen.value = true
}

function closeSheet(): void {
  detailOpen.value = false
  active.value = null
}

function deepen(): void {
  if (!active.value?.raw) return
  if (knowledge.deepen(active.value.raw.createdAt)) {
    uni.showToast({ title: '已加深一层', icon: 'none' })
    closeSheet()
  }
}

/**
 * 我用上了：知 → 行的唯一出口。
 * 记 reflect.apply(15，同一张卡只给一次分) 并把卡片推到 Lv.3 内化。
 */
function applyCard(): void {
  const raw = active.value?.raw
  if (!raw) return
  // ref 必须是 card-<createdAt>：与三件事挂出处、周报「一条路」同一个口径（见 utils/refSource）
  const ref = refOfCard(raw.createdAt)
  const already = trace.list.some(
    (t) => t.kind === 'reflect.apply' && (t.ref === ref || t.ref === String(raw.createdAt)),
  )
  logTrace({ kind: 'reflect.apply', text: raw.title, ref, level: 3, value: already ? 0 : undefined })

  // 一次到位推到 Lv.3：既然已经用上了，就没必要让人再点两次「加深」
  let guard = 0
  while ((knowledge.byId(raw.createdAt)?.depth ?? 3) < 3 && guard < 3) {
    knowledge.deepen(raw.createdAt)
    guard += 1
  }
  closeSheet()
  uni.showToast({
    title: already ? '已内化 · 这张卡之前记过' : '已内化 · 收下这 15 点修为',
    icon: 'none',
  })
}

function dropCard(): void {
  if (!active.value?.raw) return
  uni.showModal({
    title: '移除这张卡？',
    content: '它会从你的知识库消失，不可找回。',
    confirmText: '移除',
    confirmColor: '#C4602E',
    success: (res) => {
      if (res.confirm && active.value?.raw) {
        knowledge.remove(active.value.raw.createdAt)
        closeSheet()
      }
    },
  })
}

/* —— 工具入口 —— */
interface MoreEntry {
  mark: string
  title: string
  subtitle: string
  badge: EntryBadge
  url?: RoutePath
  /** 跳转参数（如费曼速记要带 ?add=1 直接展开转述面板） */
  params?: RouteParams
  disabled?: boolean
}

const moreEntries = computed<MoreEntry[]>(() => [
  /*
   * 费曼速记（2026-09-16 转为真实入口）：
   * 语音转文字走微信同声传译插件 —— 识别在微信侧完成、**音频不出微信**，
   * 我们只拿文本，所以不需要登录、不花 AI 的钱、也不涉及上传（见 utils/voice.ts）。
   * 带 ?add=1 进知识库并直接展开转述面板：这个入口要的是"立刻说一段"，
   * 不该让人先过一屏卡片列表。
   */
  {
    mark: '说',
    title: '费曼速记',
    subtitle: '按住说 60 秒 → 转成文字 → 检验讲没讲明白（识别在微信侧完成，音频不出微信）',
    badge: { text: '语音', tone: 'accent' },
    url: ROUTES.reflectLibrary,
    params: { add: '1' },
  },
  {
    mark: '存',
    title: '知识库 · 标签检索',
    subtitle: '全部卡片按关键词 / 标签 / 深度检索 · 可手动打标，也可让 AI 给建议',
    badge: { text: `${knowledge.cards.length} 张`, tone: knowledge.cards.length ? 'accent' : 'muted' },
    url: ROUTES.reflectLibrary,
  },
  {
    mark: '长',
    title: '认知成长曲线',
    subtitle: '每周卡片数量与加工深度的变化趋势',
    badge: { text: '近 8 周', tone: 'muted' },
    url: ROUTES.reflectGrowth,
  },
  /*
   * 碎片回收站 · 截图分析（2026-09-16 复核标注）。
   *
   * 原来标「后端期」不准确 —— 查证后：微信官方的「通用印刷体识别」（`/cv/ocr/comm`）
   * **明确对小程序开放，且免费 100 次/天**，只是必须走服务端（文档写明"不可在前端直接调用"），
   * 而后端我们本来就有。所以它缺的不是后端。
   *
   * 真正让它押后的是两件事：
   *  1. **截图要离开手机**（上传到我们服务器再转给微信）—— 截图里可能有什么，无法保证；
   *  2. 用户得**手动截「屏幕使用时间」再上传**，而 iOS/安卓的数字健康数据本来就在系统里，
   *     直接打开系统看更快更准。它替代不了那一下，只是多一条上传路径。
   *
   * 结论：技术上随时可做，但先想清楚「它到底替用户省了什么」。未排期。
   */
  {
    mark: '碎',
    title: '碎片回收站 · 截图分析',
    subtitle: '导入截图识别文字 —— 技术上可行，但截图要离开手机，且不比系统自带的数字健康更准',
    badge: { text: '未排期', tone: 'muted' },
    disabled: true,
  },
])
</script>

<style lang="scss" scoped>
@import './index.scss';
</style>

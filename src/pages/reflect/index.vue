<template>
  <view class="page" :class="skinClass">
    <!-- 大厅头 -->
    <view class="hall-head">
      <view class="hall-head__row">
        <text class="hall-head__mark">知</text>
        <text class="hall-head__en">KNOW · 转述 → 重构 → 内化</text>
      </view>
      <text class="hall-head__state">{{ stateText }}</text>
    </view>

    <!-- 每日灵魂拷问 -->
    <view class="question">
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
        <view class="empty__seal">悟</view>
        <text class="empty__title">还没有所悟</text>
        <text class="empty__desc">
          从今天的灵魂拷问写起，或在观里种的概念收成后导入。\n每一条都会按「转述 → 重构 → 内化」标注深度。
        </text>
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

    <!-- 工具入口 -->
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

    <!-- 移除确认：主题随当前模式，破坏性键语义红 -->
    <GzDialog
      variant="danger"
      :show="dropOpen"
      title="移除这张卡？"
      content="它会从你的知识库消失，不可找回。"
      confirm-text="移除"
      cancel-text="留着"
      @cancel="dropOpen = false"
      @confirm="dropConfirm"
    />
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
import GzDialog from '@/components/GzDialog/GzDialog.vue'
import { onShow } from '@dcloudio/uni-app'
import { useModeStore } from '@/stores/mode'
import { useQuestionStore, rolloverRemainMin } from '@/stores/question'
import { useKnowledgeStore, DEPTH_LABEL, depthColor, type CardDepth, type KnowledgeCard } from '@/stores/knowledge'
import { poke } from '@/composables/useBuddy'
import { useXpStore } from '@/stores/xp'
import { useSkinClass } from '@/composables/useSkin'
import { syncTabBar } from '@/utils/skin'
import { ROUTES } from '@/router/routes'
import type { RoutePath } from '@/router/routes'
import type { EntryBadge } from '@/components/EntryItem/EntryItem.vue'

const modeStore = useModeStore()
const skinClass = useSkinClass()
const question = useQuestionStore()
const knowledge = useKnowledgeStore()

onShow(() => {
  /* 批次 D · 小枢：评估到点激励 / 入定到点提醒 */
  poke()
  syncTabBar(modeStore.id)
  question.ensureToday()
  draft.value = question.today()?.answer ?? ''
})

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
  if (first) useXpStore().gain(8)
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

const stateText = computed(
  () =>
    `已沉淀 ${cards.value.length} 条 · 连续复盘 ${question.consecutiveDays()} 天`,
)

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

const dropOpen = ref(false)

function dropCard(): void {
  if (!active.value?.raw) return
  dropOpen.value = true
}

function dropConfirm(): void {
  dropOpen.value = false
  const raw = active.value?.raw
  if (!raw) return
  knowledge.remove(raw.createdAt)
  closeSheet()
}

/* —— 工具入口 —— */
interface MoreEntry {
  mark: string
  title: string
  subtitle: string
  badge: EntryBadge
  url?: RoutePath
  disabled?: boolean
}

const moreEntries = computed<MoreEntry[]>(() => [
  {
    mark: '说',
    title: '费曼速记',
    subtitle: '60 秒语音转文字 → 生成知识卡片（AI，需登录，后端期开放）',
    badge: { text: 'AI · 后端期', tone: 'muted' },
    disabled: true,
  },
  {
    mark: '存',
    title: '知识库 · 标签检索',
    subtitle: '全部卡片按关键词 / 标签 / 深度检索，手动打标签（AI 打标后端期）',
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
])
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

.question {
  position: relative;
  overflow: hidden;
  padding: 34rpx 30rpx 30rpx;
  background: $gz-surface;
  border: 1rpx solid $gz-line;
  border-radius: $gz-radius-lg;

  &::before {
    content: '';
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    height: 6rpx;
    background: linear-gradient(90deg, $gz-accent, $gz-grad-to);
  }
}

.question__head {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.question__label {
  font-size: $gz-fs-caption;
  letter-spacing: 0.12em;
  color: $gz-accent;
}

.question__tag {
  padding: 4rpx 16rpx;
  border-radius: 999rpx;
  background: $gz-accent-soft;
  color: $gz-accent;
  font-size: $gz-fs-caption;
}

.question__text {
  display: block;
  margin-top: 16rpx;
  font-size: 34rpx;
  font-weight: 700;
  line-height: 1.6;
  color: $gz-ink;
}

.question__input {
  width: 100%;
  margin-top: 24rpx;
  padding: 22rpx;
  min-height: 120rpx;
  background: $gz-input-bg;
  border: 1rpx solid $gz-line;
  border-radius: $gz-radius-md;
  font-size: $gz-fs-small;
  line-height: 1.8;
  color: $gz-ink;
  box-sizing: border-box;
}

.question__ph {
  color: $gz-ink-3;
}

.question__btn {
  margin-top: 20rpx;
  padding: 22rpx 0;
  background: $gz-cta-bg;
  color: $gz-on-cta;
  font-size: $gz-fs-small;
  letter-spacing: 0.14em;
  border-radius: $gz-radius-md;
}

.question__note {
  display: block;
  margin-top: 16rpx;
  font-size: $gz-fs-caption;
  color: $gz-ink-3;
}

.section {
  margin-top: 36rpx;
}

.section__head {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  margin-bottom: 20rpx;
  gap: 12rpx;
}

.section__title {
  font-size: 32rpx;
  font-weight: 700;
  color: $gz-ink;
}

.section__hint {
  display: block;
  font-size: $gz-fs-caption;
  color: $gz-ink-3;
}

.section__badge {
  flex: none;
  font-size: $gz-fs-caption;
  color: $gz-ink-3;
}

.list {
  display: flex;
  flex-direction: column;
  gap: 18rpx;
}

.card {
  padding: 26rpx 28rpx;
  background: $gz-surface;
  border: 1rpx solid $gz-line;
  border-radius: $gz-radius-md;
}

.card__top {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.card__tag {
  padding: 4rpx 14rpx;
  border-radius: 999rpx;
  font-size: $gz-fs-caption;
}

.card__src {
  font-size: $gz-fs-caption;
  color: $gz-ink-3;
}

.card__title {
  display: block;
  margin-top: 14rpx;
  font-size: $gz-fs-body;
  font-weight: 700;
  line-height: 1.5;
  color: $gz-ink;
}

.card__digest {
  display: -webkit-box;
  -webkit-box-orient: vertical;
  -webkit-line-clamp: 2;
  overflow: hidden;
  margin-top: 10rpx;
  font-size: $gz-fs-small;
  line-height: 1.8;
  color: $gz-ink-2;
}

.card__tags {
  display: flex;
  flex-wrap: wrap;
  gap: 10rpx;
  margin-top: 14rpx;
}

.card__tag-mini {
  padding: 4rpx 14rpx;
  border-radius: 999rpx;
  font-size: 20rpx;
  background: var(--gz-line-soft);
  color: $gz-ink-3;
}

/* 空态 */
.empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 60rpx 30rpx;
  background: $gz-surface;
  border: 1rpx dashed $gz-line;
  border-radius: $gz-radius-md;
}

.empty__seal {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 96rpx;
  height: 96rpx;
  border: 2rpx solid $gz-accent;
  border-radius: 22rpx;
  background: $gz-accent-soft;
  color: $gz-accent;
  font-size: 42rpx;
  font-weight: 700;
}

.empty__title {
  margin-top: 24rpx;
  font-size: $gz-fs-body;
  font-weight: 600;
  color: $gz-ink-2;
}

.empty__desc {
  margin-top: 12rpx;
  font-size: $gz-fs-caption;
  line-height: 1.9;
  text-align: center;
  color: $gz-ink-3;
  white-space: pre-line;
}

.entries {
  display: flex;
  flex-direction: column;
  gap: 18rpx;
}

/* 详情层 */
.mask {
  position: fixed;
  inset: 0;
  z-index: 20;
  display: flex;
  align-items: flex-end;
  background: rgba(20, 16, 10, 0.5);
}

.sheet {
  width: 100%;
  padding: 32rpx 32rpx calc(env(safe-area-inset-bottom) + 30rpx);
  background: $gz-surface;
  border-radius: 32rpx 32rpx 0 0;
  box-sizing: border-box;
}

.sheet__head {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.sheet__tag {
  padding: 4rpx 16rpx;
  border-radius: 999rpx;
  font-size: $gz-fs-caption;
}

.sheet__src {
  font-size: $gz-fs-caption;
  color: $gz-ink-3;
}

.sheet__title {
  display: block;
  margin-top: 18rpx;
  font-size: 34rpx;
  font-weight: 700;
  line-height: 1.5;
  color: $gz-ink;
}

.sheet__content {
  display: block;
  margin-top: 14rpx;
  font-size: $gz-fs-small;
  line-height: 1.9;
  color: $gz-ink-2;
}

.sheet__tags {
  display: flex;
  flex-wrap: wrap;
  gap: 10rpx;
  margin-top: 18rpx;
}

.sheet__deepen {
  margin-top: 24rpx;
  padding: 20rpx 0;
  text-align: center;
  background: $gz-accent-soft;
  color: $gz-accent;
  border-radius: $gz-radius-md;
  font-size: $gz-fs-body;
  font-weight: 600;
}

.sheet__btn {
  margin-top: 16rpx;
  padding: 16rpx 0;
  background: transparent;
  border: 1rpx solid rgba(196, 96, 46, 0.5);
  color: #b25a2c;
  font-size: $gz-fs-small;
  border-radius: $gz-radius-md;
}

.sheet__close {
  margin-top: 18rpx;
  padding: 12rpx 0;
  text-align: center;
  font-size: $gz-fs-small;
  color: $gz-ink-3;
}
</style>

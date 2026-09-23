<template>
  <view class="page" :class="skinClass">
    <!-- 顶栏 -->
        <SubNav :fallback="ROUTES.tabMe">我的箴言</SubNav>

    <!-- 概览 -->
    <view class="sum">
      <view class="sum__main">
        <text class="sum__num">{{ store.count }}</text>
        <text class="sum__unit">句</text>
      </view>
      <text class="sum__sub">
        {{
          store.count > 0
            ? `开屏 ${bySource.startup} · 小枢 ${bySource.buddy} · 日课 ${bySource.daily}`
            : '遇到想留住的句子，点亮「记住这句」就会收进这里'
        }}
      </text>
      <text v-if="dueCount > 0" class="sum__due">今日 {{ dueCount }} 句在回响 · 开屏会先见到它们</text>
    </view>

    <!-- 搜索 + 来源筛选 -->
    <view v-if="store.count > 0" class="tools">
      <input
        v-model="kw"
        class="tools__input"
        placeholder="搜索你记住的句子 / 出处"
        placeholder-class="tools__ph"
        confirm-type="search"
      />
      <view class="chips">
        <view
          v-for="f in FILTERS"
          :key="f.key"
          class="chip"
          :class="{ 'is-on': filter === f.key }"
          hover-class="gz-hover"
          @click="filter = f.key"
        >
          {{ f.label }}
        </view>
      </view>
    </view>

    <!-- 列表 -->
    <view class="sec">
      <view v-if="store.count === 0" class="empty gz-motion">
        <text class="empty__title">还没有记住的句子</text>
        <text class="empty__text">开屏箴言、小枢说的话，都可以点亮 ♡ 记住。收进来只是开始，回看才算真的记住。</text>
      </view>
      <view v-else-if="view.length === 0" class="empty">
        <text class="empty__title">没有匹配的箴言</text>
        <text class="empty__text">换个词试试，或点「全部」看回所有收藏。</text>
      </view>

      <view v-for="item in view" :key="item.id" class="fav">
        <!-- 正文与来源走一条主线：左侧只有一个引号，不再被竖排按钮挤成窄条 -->
        <view class="fav__main">
          <text class="fav__mark">「</text>
          <view class="fav__body">
            <text class="fav__text">{{ item.text }}</text>
            <text v-if="item.from" class="fav__from">—— {{ item.from }}</text>
            <view class="fav__meta">
              <text v-if="item.pinned" class="fav__pin">已置顶</text>
              <text class="fav__echo" :class="{ 'is-due': isDue(item) }">{{ reviewHint(item) }}</text>
              <text class="fav__src">{{ SOURCE_LABEL[item.source] }}</text>
              <text class="fav__time">{{ dayLabel(item.createdAt) }}</text>
            </view>
          </view>
        </view>
        <!--
          操作收在卡底一行（2026-09-23）。
          此前是最多五个按钮竖排在右侧（还在记着 / 置顶 / 复制 / 转知识卡 / 移除），
          卡片被撑成「左边一句、右边一列按钮」的怪形状，窄屏上按钮列甚至比正文还宽。
          横排一行 + 右对齐之后，正文拿回整行宽度，按钮也不再和正文抢视线。
        -->
        <view class="fav__acts">
          <view
            v-if="isDue(item)"
            class="fav__btn fav__btn--echo"
            hover-class="gz-hover"
            @click="markEcho(item)"
          >
            还在记着
          </view>
          <view class="fav__btn" hover-class="gz-hover" @click="togglePin(item.id)">
            {{ item.pinned ? '取消置顶' : '置顶' }}
          </view>
          <view class="fav__btn" hover-class="gz-hover" @click="copyLine(item)">复制</view>
          <view v-if="!item.cardAt" class="fav__btn fav__btn--card" hover-class="gz-hover" @click="toCard(item)">
            转知识卡
          </view>
          <view v-else class="fav__btn fav__btn--done">已入卡</view>
          <view class="fav__btn fav__btn--off" hover-class="gz-hover" @click="remove(item.id)">移除</view>
        </view>
      </view>
    </view>

    <view class="foot">
      <text class="foot__text">收藏不是终点 · 回看才是</text>
    </view>

    <!--
      主题输入弹框（2026-09-23）：转知识卡前问「为什么记住它」（可留空 → Lv.1 转述）。
      原先走原生 `editable` 弹框（白底不跟皮肤，且会把说明当成输入框初始值）；
      这里默认值取这句**已经写过的批注**（改自己的话，不是要用户删说明）。
    -->
    <GzDialog
      v-model:show="cardShow"
      :input="true"
      :banner="false"
      :multiline="true"
      title="转到知识库"
      content="为什么记住它？写了算 Lv.2 重构，只搬原句算 Lv.1 转述。"
      placeholder="为什么记住它？（可留空）"
      confirm-text="转存"
      cancel-text="算了"
      :default-value="cardDefault"
      :maxlength="140"
      @confirm="onCardConfirm"
    />

    <!-- 隐私授权拦截弹窗（复制箴言前需征得同意） -->
    <PrivacyGate />
  </view>
</template>

<script setup lang="ts">
/**
 * 我 · 我的箴言（分包 subpkg-me/proverbs）：收藏句子的统一落点。
 * 数据 = stores/proverb.ts（开屏箴言 / 小枢对话 / 日课三处来源都汇到这里），
 * 支持搜索、来源筛选、置顶、复制、移除，以及到点的回响在这里显式确认（「还在记着」）；
 * 纯本地，随备份体系一起导出/恢复。
 */
import { computed, ref } from 'vue'
import {
  useProverbStore,
  SOURCE_LABEL,
  REVIEW_DAYS,
  isDue,
  reviewFinished,
  reviewHint,
  type ProverbItem,
  type ProverbSource,
} from '@/stores/proverb'
import { useKnowledgeStore } from '@/stores/knowledge'
import { useSkinClass } from '@/composables/useSkin'
import { logTrace } from '@/utils/traceLog'
import { refOfCard } from '@/utils/refSource'
import { ROUTES } from '@/router/routes'
import { showModal } from '@/utils/dialog'

const store = useProverbStore()
const knowledge = useKnowledgeStore()
const skinClass = useSkinClass()

const kw = ref('')
const filter = ref<ProverbSource | 'all'>('all')

const FILTERS: Array<{ key: ProverbSource | 'all'; label: string }> = [
  { key: 'all', label: '全部' },
  { key: 'startup', label: '开屏' },
  { key: 'buddy', label: '小枢' },
  { key: 'daily', label: '日课' },
]

const bySource = computed(() => store.countBySource)
/** 今天到点的回响条数（口径与开屏页一致） */
const dueCount = computed(() => store.dueReviews.length)

/** 置顶优先 → 收藏时间倒序 → 关键词/来源过滤 */
const view = computed<ProverbItem[]>(() => {
  const q = kw.value.trim()
  return store.items
    .filter((it) => (filter.value === 'all' ? true : it.source === filter.value))
    .filter((it) => (q ? it.text.includes(q) || (it.from ?? '').includes(q) : true))
    .slice()
    .sort((a, b) => Number(b.pinned) - Number(a.pinned) || b.createdAt - a.createdAt)
})

const pad = (n: number): string => String(n).padStart(2, '0')

function dayLabel(at: number): string {
  const d = new Date(at)
  const now = new Date()
  const same = (x: Date, y: Date): boolean =>
    x.getFullYear() === y.getFullYear() && x.getMonth() === y.getMonth() && x.getDate() === y.getDate()
  if (same(d, now)) return `今天 ${pad(d.getHours())}:${pad(d.getMinutes())}`
  const yest = new Date(now)
  yest.setDate(now.getDate() - 1)
  if (same(d, yest)) return `昨天 ${pad(d.getHours())}:${pad(d.getMinutes())}`
  return `${d.getMonth() + 1} 月 ${d.getDate()} 日`
}

function copyLine(item: ProverbItem): void {
  const text = item.from ? `「${item.text}」 —— ${item.from}` : `「${item.text}」`
  uni.setClipboardData({
    data: text,
    success: () => uni.showToast({ title: '已复制', icon: 'none' }),
  })
}

/**
 * 转知识卡：转之前先问一句「为什么记住它」。
 * 写了理由 → Lv.2 重构；只搬原句 → Lv.1 转述。
 * 不替用户编理由 —— 没写就是没写，级别如实。
 */
/** 正为哪一句写"为什么记住它"（null = 没在写） */
const cardFor = ref<number | null>(null)
const cardShow = computed({
  get: () => cardFor.value !== null,
  set: (v: boolean) => {
    if (!v) cardFor.value = null
  },
})
/** 输入框初始值 = 这一句已经写过的批注（有的老条目已带 note） */
const cardDefault = computed(() =>
  cardFor.value === null ? '' : store.items.find((it) => it.id === cardFor.value)?.note ?? '',
)

function toCard(item: ProverbItem): void {
  if (item.cardAt) {
    uni.showToast({ title: '这句已经在知识库里了', icon: 'none' })
    return
  }
  cardFor.value = item.id
}

/**
 * 转存（弹框确认）。
 * 口径不变：写了理由 → Lv.2 重构；只搬原句 → Lv.1 转述 ——
 * 不替用户编理由，没写就是没写。
 */
function onCardConfirm(value: string): void {
  const id = cardFor.value
  cardFor.value = null
  if (id === null) return
  const item = store.items.find((it) => it.id === id)
  if (!item) return
  const note = value.trim()
  if (note) store.setNote(item.id, note)
  const card = knowledge.importProverb({
    text: item.text,
    from: item.from,
    note,
    tags: item.tags,
    src: `我的箴言 · ${SOURCE_LABEL[item.source]}`,
  })
  store.markCarded(item.id)
  logTrace({
    kind: 'reflect.note',
    text: `「${item.text}」转入知识库`,
    ref: refOfCard(card.createdAt),
    level: card.depth,
  })
  uni.showToast({ title: note ? '已入知识库 · Lv.2 重构' : '已入知识库 · Lv.1 转述', icon: 'none' })
}

function remove(id: number): void {
  showModal({
    title: '移除这句箴言？',
    content: '移除后不可恢复（本机数据，不上传服务器）。',
    confirmText: '移除',
    confirmColor: '#C4602E',
    success: (res) => {
      if (!res.confirm) return
      store.remove(id)
      uni.showToast({ title: '已移除', icon: 'none' })
    },
  })
}

function togglePin(id: number): void {
  store.togglePin(id)
}

/**
 * 「还在记着」：主动确认还记得 —— 这一条推进下一阶（1 / 3 / 7 天）。
 *
 * 为什么列表页也要有：开屏的自动结算（`store.settleEcho`）一天只推一条，
 * 队列里剩下的在这里可以手动清；而此前 `markReviewed` 全项目只有开屏那个按钮一个调用点，
 * 那个按钮又基本按不到 —— 阶梯于是永远停在第 1 阶、最早那条天天钉在扉页上（2026-09-22 自查）。
 * 按钮只在 `isDue()` 时出现：没到点的句子不该被"确认"，也顺带避免一天里被连推两阶。
 */
function markEcho(item: ProverbItem): void {
  /*
   * 自己判到期（与开屏、与 store 的 settleEcho 同一道守卫）：`markReviewed` 是
   * **无条件推一阶**的原语，连点两下就会一天连推两阶。第一次推完就不再到期，
   * 第二次直接返回（按钮也会随之消失）。
   */
  if (!isDue(item)) return
  store.markReviewed(item.id)
  const done = reviewFinished(item)
  uni.showToast({
    title: done ? '这句已经是你的了' : `${REVIEW_DAYS[item.reviewCount]} 天后再回响`,
    icon: 'none',
  })
}

</script>

<style lang="scss" scoped>
@import './index.scss';
</style>

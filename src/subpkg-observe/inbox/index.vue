<template>
  <view class="page" :class="skinClass">
    <!-- 顶栏 -->
    <view class="nav">
      <view class="nav__side" hover-class="gz-hover" @click="goBack">
        <text class="nav__back">‹</text>
      </view>
      <text class="nav__title">收件匣</text>
      <view class="nav__side nav__side--right" hover-class="gz-hover" @click="goCompose">
        <text class="nav__add">＋</text>
      </view>
    </view>

    <!-- 搜索 -->
    <input
      v-model="kw"
      class="search"
      placeholder="搜标题 / 正文 / 金句 / 标签 / 来源"
      placeholder-class="search__ph"
      :maxlength="40"
      confirm-type="search"
    />

    <!-- 筛选：全部 / 事 / 理 / 道 / 待清理 -->
    <view class="filters">
      <view
        v-for="f in FILTERS"
        :key="f.id"
        v-show="f.id !== 'due' || dueCount > 0"
        class="filter"
        :class="{ 'is-on': filter === f.id }"
        hover-class="gz-hover"
        @click="filter = f.id"
      >
        <text class="filter__text">{{ f.label }}{{ f.id === 'due' ? ` ${dueCount}` : '' }}</text>
      </view>
    </view>

    <!-- 来源筛选（从「来源账本」点进来时才有）：复用筛选胶囊的样式，看得见、点得掉 -->
    <view v-if="srcFilter" class="filters">
      <view class="filter is-on" hover-class="gz-hover" @click="srcFilter = ''">
        <text class="filter__text">来源 · {{ srcFilter }} ×</text>
      </view>
    </view>

    <!-- 清理提示：存了 7 天没动的东西 -->
    <view v-if="dueCount > 0" class="due" hover-class="gz-hover" @click="filter = 'due'">
      <text class="due__text">{{ dueCount }} 条存了 7 天还没处理</text>
      <text class="due__go">处理或删 ›</text>
    </view>

    <!-- 统计条 -->
    <view class="rule">
      <text class="rule__text">存下不算数 · 读过写下才算数</text>
      <text class="rule__num">未处理 {{ store.pendingCount }} / 共 {{ store.items.length }}</text>
    </view>

    <!-- 空态 -->
    <view v-if="!shown.length" class="empty">
      <view class="empty__seal gz-motion">观</view>
      <text class="empty__title">{{ kw ? '没有匹配的条目' : '这里还空着' }}</text>
      <text class="empty__desc">
        {{ kw ? '换个词试试，或清空搜索' : '看到什么、想到什么，先存进来。\n存的时候必须写一句，不然不让它进来。' }}
      </text>
    </view>

    <!-- 列表 -->
    <view v-else class="list">
      <view
        v-for="it in shown"
        :key="it.id"
        class="card"
        :class="{ 'is-due': isDue(it) }"
        hover-class="gz-hover"
        @click="goDetail(it.id)"
      >
        <view class="card__top">
          <text class="card__kind" :class="`is-${it.kind}`">{{ kindText(it.kind) }}</text>
          <text class="card__form">{{ formText(it.form) }}</text>
          <text v-for="t in it.topics" :key="t" class="card__topic">{{ t }}</text>
          <text v-if="isDue(it)" class="card__due">待处理</text>
        </view>

        <text v-if="it.title" class="card__title">{{ it.title }}</text>
        <!-- 列表只给两行摘要（点卡片进详情看全文），长逐字稿不再把列表淹掉 -->
        <text v-if="brief(it)" class="card__brief">{{ brief(it) }}</text>

        <!-- 经典语句（你挑的原话） -->
        <view v-if="it.golden.length" class="golden">
          <text v-for="(g, i) in it.golden" :key="i" class="golden__line">「{{ g }}」</text>
        </view>

        <!-- 链接 / 视频 / 来源 -->
        <view v-if="it.sourceName || it.link || it.videoUrl" class="card__links">
          <text v-if="it.sourceName" class="card__src">来源 · {{ it.sourceName }}</text>
          <text v-if="it.link" class="card__link" hover-class="gz-hover" @click.stop="openLink(it.link)">
            原文链接 ›
          </text>
          <text v-if="it.videoUrl" class="card__link" hover-class="gz-hover" @click.stop="openVideo(it.videoUrl)">
            ▶ 打开视频
          </text>
        </view>

        <view v-if="it.tags.length" class="tags">
          <text v-for="t in it.tags" :key="t" class="tag">{{ t }}</text>
        </view>

        <!-- 操作：详情 / 编辑 / 处理 / 删（都 .stop，别把卡片的"点开详情"也顺带触发） -->
        <view class="ops" @click.stop>
          <text class="ops__state">{{ stateText(it) }}</text>
          <view class="ops__right">
            <text class="ops__btn" hover-class="gz-hover" @click.stop="goDetail(it.id)">详情</text>
            <text class="ops__btn" hover-class="gz-hover" @click.stop="goEdit(it.id)">编辑</text>
            <text
              v-if="!it.handledAt"
              class="ops__btn ops__btn--main"
              :class="{ 'is-off': !store.canDeepRead(it.id) }"
              hover-class="gz-hover"
              @click.stop="handle(it.id)"
            >
              {{ store.canDeepRead(it.id) ? '处理' : '明日再读' }}
            </text>
            <text class="ops__btn" hover-class="gz-hover" @click.stop="drop(it.id)">删</text>
          </view>
        </view>
      </view>
    </view>

    <view class="foot">
      <text class="foot__text">存是为了处理，不是为了攒</text>
    </view>

    <!-- 隐私授权拦截弹窗（复制链接前需征得同意） -->
    <PrivacyGate />
  </view>
</template>

<script setup lang="ts">
/**
 * 观 · 收件匣 —— 所有主动输入内容的统一落点（事 / 理 / 道）。
 *
 * 四件事：
 *  1. 检索：筛选 + 搜索（标题/正文/摘要/重要观点/金句/感悟/标签/来源/主题）；
 *  2. 处理：读过并写下自己的话 → 深度 +1、修为入账（store.markHandled）；
 *  3. 清理：存了 7 天没动的进「待清理」，必须处理或删 —— 收藏夹不养僵尸；
 *  4. 这一页只当**索引**：卡片给标题 + 两行摘要 + 操作（详情 / 编辑 / 处理 / 删），
 *     全文与所有字段在详情页（subpkg-observe/detail）—— 正文上限 10000 字，
 *     铺在列表里会把整页淹掉；「编辑」则带 id 回录入页，复用那一套表单。
 */
import { computed, ref } from 'vue'
import { onLoad, onShow } from '@dcloudio/uni-app'
import { useObserveStore, type ObsItem } from '@/stores/observe'
import { LEDGER_UNNAMED } from '@/config/ledger'
import { useSkinClass } from '@/composables/useSkin'
import { navigateTo, ROUTES } from '@/router/routes'

const store = useObserveStore()
const skinClass = useSkinClass()

type FilterId = 'all' | 'thing' | 'theory' | 'mother' | 'due'
const FILTERS: Array<{ id: FilterId; label: string }> = [
  { id: 'all', label: '全部' },
  { id: 'thing', label: '事' },
  { id: 'theory', label: '理' },
  { id: 'mother', label: '道' },
  { id: 'due', label: '待清理' },
]

const filter = ref<FilterId>('all')
const kw = ref('')
/**
 * 来源筛选（2026-09-17）：从「来源账本」点一行进来时带 `?src=`。
 * 它是一层**附加**筛选（与类型筛选、搜索叠加），所以页面上必须看得见、点得掉 ——
 * 否则用户会以为"我存的东西怎么少了"。
 */
const srcFilter = ref('')

const dueList = computed(() => store.dueForCleanup())
const dueCount = computed(() => dueList.value.length)

const shown = computed<ObsItem[]>(() => {
  const base = kw.value.trim() ? store.search(kw.value) : store.items
  const ofSrc = srcFilter.value
    ? base.filter((i) => (i.sourceName?.trim() || LEDGER_UNNAMED) === srcFilter.value)
    : base
  if (filter.value === 'all') return ofSrc
  if (filter.value === 'due') return ofSrc.filter((i) => isDue(i))
  return ofSrc.filter((i) => i.kind === filter.value)
})

function isDue(it: ObsItem): boolean {
  return !it.handledAt && Date.now() - it.createdAt >= 7 * 24 * 60 * 60 * 1000
}

function kindText(kind: ObsItem['kind']): string {
  return kind === 'thing' ? '事' : kind === 'theory' ? '理' : '道'
}

function formText(form: ObsItem['form']): string {
  return form === 'article' ? '文章' : form === 'video' ? '视频' : '一句话'
}

/** 列表里的两行摘要：优先你自己写的那一句（总结 / 摘要 / 第一条观点），最后才用正文 */
function brief(it: ObsItem): string {
  const vp = it.viewpoints?.[0]
  return it.summary || it.digest || vp?.title || vp?.text || it.content
}

function stateText(it: ObsItem): string {
  if (it.handledAt) return `已处理 · Lv.${it.depth}`
  if (it.kind === 'theory') return it.state === 'confirmed' ? '已入册' : it.state === 'pending' ? '待整理' : '草稿'
  return '未处理'
}

/**
 * 处理：读过并写下自己的话（可空，但写下才算真的读过）。
 *
 * 配额用尽时**先解释再拦**，不静默失败：点了「处理」却毫无反应，
 * 用户只会以为坏了。说的是「今天读不动了」，不是「你不能做」——
 * 前几天存下的补处理照样可以，删也照样可以，所以不会卡在这里出不去。
 */
function handle(id: string): void {
  if (!store.canDeepRead(id)) {
    uni.showModal({
      title: '今天的深度阅读用完了',
      content: `每日 ${store.quotaTotal()} 次，只用来读「今天新存进来」的东西。\n这条明天再读；前几天存下的补处理不占额，现在就能处理。`,
      showCancel: false,
      confirmText: '知道了',
    })
    return
  }
  uni.showModal({
    title: '写下你的一句话',
    editable: true,
    placeholderText: '它让你想到什么 / 哪里不成立',
    confirmText: '处理',
    cancelText: '再想想',
    success: (res) => {
      if (!res.confirm) return
      const note = (res as { content?: string }).content ?? ''
      // 用返回值兜底：store 是唯一判据（页面可能算漏，比如刚跨过午夜）
      const ok = store.markHandled(id, note)
      uni.showToast({ title: ok ? '已处理 · 修为入账' : '今天的配额用完了', icon: 'none' })
    },
  })
}

function drop(id: string): void {
  uni.showModal({
    title: '删掉这条',
    content: '删了就找不回来了',
    confirmText: '删',
    confirmColor: '#B24A3A',
    cancelText: '留着',
    success: (res) => {
      if (!res.confirm) return
      store.remove(id)
      uni.showToast({ title: '已删', icon: 'none' })
    },
  })
}

/**
 * 外链一律走「复制 + 提示」：
 * 个人主体小程序没有业务域名白名单，web-view 打不开外站，视频更不可能内嵌播放。
 */
function copyThenTip(url: string, tip: string): void {
  uni.setClipboardData({
    data: url,
    success: () => uni.showToast({ title: tip, icon: 'none' }),
    fail: () => uni.showToast({ title: '复制失败，长按链接手动复制', icon: 'none' }),
  })
}

function openLink(url?: string): void {
  if (url) copyThenTip(url, '链接已复制，粘贴到浏览器打开')
}

function openVideo(url?: string): void {
  if (url) copyThenTip(url, '视频链接已复制，去对应 App 或浏览器打开')
}

function goCompose(): void {
  navigateTo(ROUTES.observeCompose)
}

/** 详情：全文 + 编辑 / 处理 / 删都在那边（列表只当索引，长文不再把列表淹掉） */
function goDetail(id: string): void {
  navigateTo(ROUTES.observeDetail, { id })
}

/** 编辑：带 id 回录入页复用那套表单，不在这一页再养一份字段 */
function goEdit(id: string): void {
  navigateTo(ROUTES.observeCompose, { id })
}

function goBack(): void {
  const pages = getCurrentPages()
  if (pages.length > 1) {
    uni.navigateBack()
  } else {
    uni.switchTab({ url: ROUTES.tabObserve })
  }
}

onLoad((query) => {
  const q = (query ?? {}) as Record<string, string>
  // 从大厅的「N 条存了 7 天没处理」进来时直接落到待清理
  if (q.filter === 'due') filter.value = 'due'
  // 从「来源账本」点一行进来时只看那个来源（页面上有胶囊可一键取消）
  if (q.src) srcFilter.value = decodeURIComponent(q.src)
})
</script>

<style lang="scss" scoped>
@import './index.scss';
</style>

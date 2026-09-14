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

const dueList = computed(() => store.dueForCleanup())
const dueCount = computed(() => dueList.value.length)

const shown = computed<ObsItem[]>(() => {
  const base = kw.value.trim() ? store.search(kw.value) : store.items
  if (filter.value === 'all') return base
  if (filter.value === 'due') return base.filter((i) => isDue(i))
  return base.filter((i) => i.kind === filter.value)
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
  // 从大厅的「N 条存了 7 天没处理」进来时直接落到待清理
  if ((query as Record<string, string>)?.filter === 'due') filter.value = 'due'
})
</script>

<style lang="scss" scoped>
.page {
  min-height: 100vh;
  padding: calc(var(--status-bar-height) + 16rpx) $gz-page-pad 60rpx;
  box-sizing: border-box;
}

.nav {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 8rpx 0 10rpx;
}

.nav__side {
  width: 76rpx;
  height: 76rpx;
}

.nav__side--right {
  display: flex;
  align-items: center;
  justify-content: flex-end;
}

.nav__back,
.nav__add {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 76rpx;
  height: 76rpx;
  border: 1rpx solid $gz-line;
  border-radius: 50%;
  background: $gz-surface;
  color: $gz-ink-2;
  font-size: 46rpx;
  line-height: 1;
}

.nav__back {
  font-size: 52rpx;
  padding-bottom: 8rpx;
}

.search {
  margin-top: 12rpx;
  padding: 20rpx 24rpx;
  background: $gz-input-bg;
  border: 1rpx solid $gz-line;
  border-radius: 999rpx;
  font-size: $gz-fs-small;
  color: $gz-ink;
}

.search__ph {
  color: $gz-ink-3;
}

.filters {
  display: flex;
  gap: 12rpx;
  margin-top: 18rpx;
}

.filter {
  padding: 10rpx 24rpx;
  border: 1rpx solid $gz-line;
  border-radius: 999rpx;
  background: $gz-surface;
}

.filter.is-on {
  border-color: $gz-accent;
  background: $gz-accent-soft;
}

.filter__text {
  font-size: $gz-fs-caption;
  color: $gz-ink-2;
}

.filter.is-on .filter__text {
  color: $gz-accent;
  font-weight: 600;
}

.due {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-top: 18rpx;
  padding: 18rpx 24rpx;
  border: 1rpx solid #e0b3a8;
  border-radius: $gz-radius-md;
  background: #fbf0ec;
}

.due__text {
  font-size: $gz-fs-small;
  color: #b24a3a;
}

.due__go {
  font-size: $gz-fs-caption;
  color: #b24a3a;
  font-weight: 600;
}

.rule {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin: 18rpx 4rpx 8rpx;
}

.rule__text {
  font-size: $gz-fs-caption;
  color: $gz-ink-3;
}

.rule__num {
  font-size: $gz-fs-caption;
  color: $gz-accent;
}

.list {
  display: flex;
  flex-direction: column;
  gap: 18rpx;
  margin-top: 12rpx;
}

.card {
  padding: 26rpx 26rpx 18rpx;
  background: $gz-surface;
  border: 1rpx solid $gz-line;
  border-radius: $gz-radius-md;
}

.card.is-due {
  border-color: #e0b3a8;
}

.card__top {
  display: flex;
  align-items: center;
  gap: 12rpx;
  margin-bottom: 12rpx;
}

.card__kind {
  padding: 4rpx 16rpx;
  border-radius: 999rpx;
  font-size: $gz-fs-caption;
  font-weight: 700;
  background: $gz-accent-soft;
  color: $gz-accent;
}

.card__kind.is-thing {
  background: #eef3e8;
  color: #5f7f4e;
}

.card__kind.is-theory {
  background: #eaf0f8;
  color: #4e8fd4;
}

.card__kind.is-mother {
  background: #f2edf8;
  color: #7a63a8;
}

.card__form,
.card__topic {
  font-size: $gz-fs-caption;
  color: $gz-ink-3;
}

.card__due {
  margin-left: auto;
  font-size: $gz-fs-caption;
  color: #b24a3a;
}

.card__title {
  display: block;
  font-size: $gz-fs-body;
  font-weight: 700;
  color: $gz-ink;
  line-height: 1.6;
}

/* 两行摘要：溢出的裁掉，全文点进详情看（正文上限 10000 字，铺在列表里会淹掉整页） */
.card__brief {
  display: -webkit-box;
  -webkit-box-orient: vertical;
  -webkit-line-clamp: 2;
  overflow: hidden;
  margin-top: 8rpx;
  font-size: $gz-fs-small;
  line-height: 1.8;
  color: $gz-ink-2;
  word-break: break-all;
}

.golden {
  margin-top: 14rpx;
  padding: 14rpx 18rpx;
  border-left: 4rpx solid $gz-accent;
  background: $gz-accent-soft;
  border-radius: 0 $gz-radius-sm $gz-radius-sm 0;
}

.golden__line {
  display: block;
  font-size: $gz-fs-small;
  line-height: 1.9;
  color: $gz-ink;
}

.card__links {
  display: flex;
  flex-wrap: wrap;
  gap: 18rpx;
  margin-top: 14rpx;
}

.card__src {
  font-size: $gz-fs-caption;
  color: $gz-ink-3;
}

.card__link {
  font-size: $gz-fs-caption;
  color: $gz-accent;
}

.tags {
  display: flex;
  flex-wrap: wrap;
  gap: 10rpx;
  margin-top: 12rpx;
}

.tag {
  padding: 4rpx 16rpx;
  border-radius: 999rpx;
  background: $gz-input-bg;
  font-size: $gz-fs-caption;
  color: $gz-ink-3;
}

.ops {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-top: 16rpx;
  padding-top: 14rpx;
  border-top: 1rpx solid $gz-line;
}

.ops__state {
  font-size: $gz-fs-caption;
  color: $gz-ink-3;
}

.ops__right {
  display: flex;
  gap: 10rpx;
}

.ops__btn {
  padding: 8rpx 20rpx;
  border: 1rpx solid $gz-line;
  border-radius: 999rpx;
  font-size: $gz-fs-caption;
  color: $gz-ink-2;
}

.ops__btn--main {
  border-color: $gz-accent;
  background: $gz-accent-soft;
  color: $gz-accent;
  font-weight: 600;
}

/* 配额用尽：按钮变灰但仍可点 —— 点了会解释原因，比置灰不响应更诚实 */
.ops__btn--main.is-off {
  border-color: $gz-line;
  background: $gz-surface;
  color: $gz-ink-3;
  font-weight: 400;
}

.empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 110rpx 40rpx 0;
}

.empty__seal {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 108rpx;
  height: 108rpx;
  border: 2rpx solid $gz-accent;
  border-radius: 26rpx;
  background: $gz-accent-soft;
  color: $gz-accent;
  font-size: 48rpx;
  font-weight: 700;
}

.empty__title {
  margin-top: 28rpx;
  font-size: $gz-fs-title;
  font-weight: 700;
  color: $gz-ink;
}

.empty__desc {
  margin-top: 14rpx;
  font-size: $gz-fs-small;
  line-height: 1.9;
  text-align: center;
  color: $gz-ink-3;
  white-space: pre-line;
}

.foot {
  margin-top: 44rpx;
  display: flex;
  justify-content: center;
}

.foot__text {
  font-size: $gz-fs-caption;
  letter-spacing: 0.1em;
  color: $gz-ink-3;
}
</style>

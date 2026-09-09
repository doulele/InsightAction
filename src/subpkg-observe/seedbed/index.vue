<template>
  <view class="page" :class="skinClass">
    <!-- 顶栏：返回 + 标题（子页统一样式） -->
    <view class="nav">
      <view class="nav__side" hover-class="gz-hover" @click="goBack">
        <text class="nav__back">‹</text>
      </view>
      <text class="nav__title">概念播种</text>
      <view class="nav__side" />
    </view>

    <!-- 种植面板 -->
    <view class="plant">
      <text class="plant__label">种下一个概念</text>
      <input
        v-model="concept"
        class="plant__input"
        placeholder="一词即可，如：第二大脑 / 刻意练习…"
        placeholder-class="plant__ph"
        :maxlength="16"
      />
      <textarea
        v-model="note"
        class="plant__area"
        placeholder="备注：为什么值得种下它？"
        placeholder-class="plant__ph"
        :maxlength="120"
        auto-height
      />
      <view class="plant__tag-row">
        <view
          v-for="t in SUGGEST_TAGS"
          :key="t"
          class="chip"
          :class="{ 'is-on': tags.includes(t) }"
          hover-class="gz-hover"
          @click="toggleTag(t)"
        >
          {{ t }}
        </view>
      </view>
      <button class="plant__btn" :class="{ 'is-off': !canPlant }" hover-class="gz-hover" @click="plantSeed">
        种下
      </button>
      <text class="plant__rule">七日后可回看收成 · 种太多会种不过来</text>
    </view>

    <!-- 分区切换 -->
    <view class="tabs">
      <view class="tab" :class="{ 'is-on': tab === 'growing' }" @click="tab = 'growing'">
        生长中 {{ growing.length }}
      </view>
      <view class="tab" :class="{ 'is-on': tab === 'done' }" @click="tab = 'done'">
        已收成 {{ done.length }}
      </view>
    </view>

    <!-- 生长中 -->
    <view v-if="tab === 'growing'">
      <view v-if="!growing.length" class="empty">
        <view class="empty__seal">芽</view>
        <text class="empty__title">地还空着</text>
        <text class="empty__desc">把阅读里那句让你心里一动的话，种下来。\n交给时间，七天后回来看它。</text>
      </view>
      <view v-else class="list">
        <view v-for="s in growing" :key="s.plantedAt" class="card" :class="{ 'is-ripe': isRipeNow(s) }">
          <view class="card__top">
            <text class="card__tag" :class="{ 'is-ripe': isRipeNow(s) }">
              {{ isRipeNow(s) ? '可收成' : '幼苗' }}
            </text>
            <text class="card__days">{{ dayLabel(s) }}</text>
          </view>
          <text class="card__concept">{{ s.concept }}</text>
          <text v-if="s.note" class="card__note">{{ s.note }}</text>
          <view v-if="s.tags.length" class="card__tags">
            <text v-for="t in s.tags" :key="t" class="card__tag-mini">{{ t }}</text>
          </view>
          <view class="card__acts">
            <view v-if="isRipeNow(s)" class="act act--main" hover-class="gz-hover" @click="openHarvest(s)">
              回看 · 收成
            </view>
            <view v-else class="act act--ghost" hover-class="gz-hover" @click="dropSeed(s)">
              拔掉（不值）
            </view>
          </view>
        </view>
      </view>
    </view>

    <!-- 已收成 -->
    <view v-else>
      <view v-if="!done.length" class="empty">
        <view class="empty__seal">果</view>
        <text class="empty__title">还没有收成</text>
        <text class="empty__desc">第一颗种子满七天后，来这写下它长出了什么。</text>
      </view>
      <view v-else class="list">
        <view v-for="s in done" :key="s.plantedAt" class="card card--done">
          <view class="card__top">
            <text class="card__tag is-done">已收成</text>
            <text class="card__days">{{ doneDate(s) }} · 种后 {{ doneGap(s) }} 天</text>
          </view>
          <text class="card__concept">{{ s.concept }}</text>
          <text v-if="s.note" class="card__note">{{ s.note }}</text>
          <view class="card__harvest">
            <text class="card__harvest-label">长出了什么</text>
            <text class="card__harvest-text">{{ s.harvestNote }}</text>
          </view>
        </view>
      </view>
    </view>

    <!-- 收成作答层 -->
    <view v-if="harvestOpen" class="mask" @click="harvestOpen = false">
      <view class="sheet" @click.stop>
        <text class="sheet__title">回看「{{ harvesting?.concept }}」</text>
        <text class="sheet__sub">这七天里，它在你身上长出了什么？</text>
        <textarea
          v-model="harvestNote"
          class="sheet__area"
          placeholder="一句新的认识、一个想法的变形、一件想做的小事…"
          placeholder-class="sheet__ph"
          :maxlength="200"
          auto-height
        />
        <button class="sheet__btn" hover-class="gz-hover" @click="doHarvest">写下收成</button>
        <view class="sheet__cancel" hover-class="gz-hover" @click="harvestOpen = false">
          再想想
        </view>
      </view>
    </view>

    <view class="foot">
      <text class="foot__text">收藏是把东西留住 · 播种是让念头自己长</text>
    </view>

    <!-- 拔种子确认：主题随当前模式，破坏性键语义红 -->
    <GzDialog
      variant="danger"
      :show="!!dropTarget"
      title="拔掉这颗种子？"
      :content="dropHint"
      confirm-text="拔掉"
      cancel-text="留着"
      @cancel="dropTarget = null"
      @confirm="dropConfirm"
    />
  </view>
</template>

<script setup lang="ts">
/**
 * 观 · 概念播种 —— 批次 B 收尾真实子页（分包 subpkg-observe）。
 * 念头 → 种子 → 七天 → 回看收成（写下它长出了什么）；收成内容之后可进入知·知识卡片流。
 */
import { computed, ref } from 'vue'
import GzDialog from '@/components/GzDialog/GzDialog.vue'
import { isRipe, RIPE_AFTER_MS, useSeedStore, type Seed } from '@/stores/seed'
import { useSkinClass } from '@/composables/useSkin'
import { ROUTES } from '@/router/routes'

const seedStore = useSeedStore()
const skinClass = useSkinClass()

const SUGGEST_TAGS = ['认知', '工作流', '关系', '身心', '创造'] as const

const concept = ref('')
const note = ref('')
const tags = ref<string[]>([])
const canPlant = computed(() => concept.value.trim().length > 0)

function toggleTag(t: string): void {
  tags.value = tags.value.includes(t) ? tags.value.filter((x) => x !== t) : [...tags.value, t]
}

function plantSeed(): void {
  if (!canPlant.value) return
  const ok = seedStore.plant(concept.value, note.value, tags.value)
  if (ok) {
    concept.value = ''
    note.value = ''
    tags.value = []
    uni.showToast({ title: '已种下 · 七天后见', icon: 'none' })
  }
}

const tab = ref<'growing' | 'done'>('growing')

const nowTick = ref(Date.now())

/** 7 天幼苗期走完即「可收成」 */
function isRipeNow(s: Seed): boolean {
  return isRipe(s, nowTick.value)
}

const growing = computed(() =>
  seedStore.seeds
    .filter((s) => !s.harvestAt)
    .sort((a, b) => (isRipe(a, nowTick.value) ? -1 : 1) - (isRipe(b, nowTick.value) ? -1 : 1)),
)
const done = computed(() => seedStore.seeds.filter((s) => s.harvestAt).slice(0, 50))

function dayLabel(s: Seed): string {
  const passed = Math.floor((nowTick.value - s.plantedAt) / (24 * 60 * 60 * 1000))
  const remain = 7 - passed
  return remain > 0 ? `第 ${Math.min(7, passed + 1)} 天 · ${remain} 天后可收` : '已满七天 · 等回看'
}

function doneGap(s: Seed): number {
  return Math.max(7, Math.round(((s.harvestAt ?? nowTick.value) - s.plantedAt) / (24 * 60 * 60 * 1000)))
}

function doneDate(s: Seed): string {
  if (!s.harvestAt) return ''
  const d = new Date(s.harvestAt)
  return `${d.getMonth() + 1} 月 ${d.getDate()} 日`
}

/** 待拔除种子（null = 弹框关闭） */
const dropTarget = ref<Seed | null>(null)
const dropHint = computed(() =>
  dropTarget.value ? `「${dropTarget.value.concept}」将不再生长，不可找回。` : '',
)

function dropSeed(s: Seed): void {
  dropTarget.value = s
}

function dropConfirm(): void {
  const target = dropTarget.value
  dropTarget.value = null
  if (!target) return
  seedStore.remove(target.plantedAt)
}

/** 收成层 */
const harvestOpen = ref(false)
const harvesting = ref<Seed | null>(null)
const harvestNote = ref('')

function openHarvest(s: Seed): void {
  harvesting.value = s
  harvestNote.value = ''
  harvestOpen.value = true
}

function doHarvest(): void {
  if (!harvesting.value) return
  const ok = seedStore.harvest(harvesting.value.plantedAt, harvestNote.value)
  if (ok) {
    harvestOpen.value = false
    uni.showToast({ title: '已收成 · 留待长进知识库', icon: 'none' })
  } else {
    uni.showToast({ title: '写下点什么再收成吧', icon: 'none' })
  }
}

function goBack(): void {
  const pages = getCurrentPages()
  if (pages.length > 1) {
    uni.navigateBack()
  } else {
    uni.switchTab({ url: ROUTES.tabObserve })
  }
}
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

.nav__back {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 76rpx;
  height: 76rpx;
  border: 1rpx solid $gz-line;
  border-radius: 50%;
  background: $gz-surface;
  color: $gz-ink-2;
  font-size: 52rpx;
  line-height: 1;
  padding-bottom: 8rpx;
}

.nav__title {
  font-size: 34rpx;
  font-weight: 700;
  letter-spacing: 0.08em;
  color: $gz-ink;
}

/* 种植面板 */
.plant {
  margin-top: 16rpx;
  padding: 28rpx 28rpx 26rpx;
  background: $gz-surface;
  border: 1rpx solid $gz-line;
  border-radius: $gz-radius-lg;
}

.plant__label {
  display: block;
  font-size: $gz-fs-caption;
  letter-spacing: 0.12em;
  color: $gz-accent;
}

.plant__input {
  margin-top: 18rpx;
  padding: 18rpx 22rpx;
  background: $gz-input-bg;
  border: 1rpx solid $gz-line;
  border-radius: $gz-radius-md;
  font-size: $gz-fs-body;
  color: $gz-ink;
}

.plant__area {
  width: 100%;
  margin-top: 14rpx;
  padding: 18rpx 22rpx;
  min-height: 96rpx;
  background: $gz-input-bg;
  border: 1rpx solid $gz-line;
  border-radius: $gz-radius-md;
  font-size: $gz-fs-small;
  line-height: 1.8;
  color: $gz-ink;
  box-sizing: border-box;
}

.plant__ph {
  color: $gz-ink-3;
}

.plant__tag-row {
  display: flex;
  flex-wrap: wrap;
  gap: 12rpx;
  margin-top: 14rpx;
}

.chip {
  padding: 6rpx 20rpx;
  border-radius: 999rpx;
  border: 1rpx solid $gz-line;
  font-size: $gz-fs-caption;
  color: $gz-ink-3;
}

.chip.is-on {
  border-color: $gz-accent;
  background: $gz-accent-soft;
  color: $gz-accent;
}

.plant__btn {
  margin-top: 20rpx;
  background: $gz-accent;
  color: $gz-on-cta;
  font-size: $gz-fs-body;
  font-weight: 600;
}

.plant__btn.is-off {
  opacity: 0.45;
}

.plant__rule {
  display: block;
  margin-top: 14rpx;
  font-size: $gz-fs-caption;
  text-align: center;
  color: $gz-ink-3;
}

/* 分区 */
.tabs {
  display: flex;
  gap: 14rpx;
  margin: 26rpx 0 20rpx;
}

.tab {
  padding: 10rpx 30rpx;
  border-radius: 999rpx;
  background: $gz-surface;
  border: 1rpx solid $gz-line;
  font-size: $gz-fs-caption;
  color: $gz-ink-3;
}

.tab.is-on {
  color: $gz-accent;
  border-color: $gz-accent;
  font-weight: 600;
  background: $gz-accent-soft;
}

/* 卡片 */
.list {
  display: flex;
  flex-direction: column;
  gap: 18rpx;
}

.card {
  padding: 26rpx 28rpx 22rpx;
  background: $gz-surface;
  border: 1rpx solid $gz-line;
  border-radius: $gz-radius-md;
}

.card.is-ripe {
  border-color: $gz-accent;
  background: linear-gradient(180deg, $gz-accent-soft, $gz-surface 46%);
}

.card__top {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.card__tag {
  padding: 4rpx 16rpx;
  border-radius: 999rpx;
  font-size: $gz-fs-caption;
  background: rgba(132, 162, 104, 0.2);
  color: #6d8b3f;
}

.card__tag.is-ripe {
  background: $gz-accent;
  color: $gz-on-cta;
}

.card__tag.is-done {
  background: var(--gz-line-soft);
  color: $gz-ink-3;
}

.card__days {
  font-size: $gz-fs-caption;
  color: $gz-ink-3;
}

.card__concept {
  display: block;
  margin-top: 18rpx;
  font-size: 34rpx;
  font-weight: 700;
  line-height: 1.5;
  color: $gz-ink;
}

.card__note {
  display: block;
  margin-top: 8rpx;
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

.card__acts {
  margin-top: 20rpx;
  display: flex;
  justify-content: flex-end;
}

.act {
  padding: 12rpx 30rpx;
  border-radius: 999rpx;
  font-size: $gz-fs-small;
}

.act--main {
  background: $gz-accent;
  color: $gz-on-cta;
}

.act--ghost {
  border: 1rpx solid $gz-line;
  color: $gz-ink-3;
}

.card--done {
  opacity: 0.92;
}

.card__harvest {
  margin-top: 20rpx;
  padding: 18rpx 20rpx;
  border-radius: $gz-radius-md;
  background: var(--gz-line-soft);
}

.card__harvest-label {
  display: block;
  font-size: $gz-fs-caption;
  color: $gz-ink-3;
}

.card__harvest-text {
  display: block;
  margin-top: 8rpx;
  font-size: $gz-fs-small;
  line-height: 1.8;
  color: $gz-ink-2;
}

/* 空态 */
.empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 90rpx 40rpx 0;
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

/* 收成作答层 */
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
  padding: 34rpx 32rpx calc(env(safe-area-inset-bottom) + 30rpx);
  background: $gz-surface;
  border-radius: 32rpx 32rpx 0 0;
  box-sizing: border-box;
}

.sheet__title {
  display: block;
  font-size: 32rpx;
  font-weight: 700;
  color: $gz-ink;
}

.sheet__sub {
  display: block;
  margin-top: 8rpx;
  font-size: $gz-fs-small;
  color: $gz-ink-3;
}

.sheet__area {
  width: 100%;
  margin-top: 20rpx;
  padding: 20rpx;
  min-height: 140rpx;
  background: $gz-input-bg;
  border: 1rpx solid $gz-line;
  border-radius: $gz-radius-md;
  font-size: $gz-fs-small;
  line-height: 1.8;
  color: $gz-ink;
  box-sizing: border-box;
}

.sheet__ph {
  color: $gz-ink-3;
}

.sheet__btn {
  margin-top: 22rpx;
  background: $gz-accent;
  color: $gz-on-cta;
  font-size: $gz-fs-body;
  font-weight: 600;
}

.sheet__cancel {
  margin-top: 14rpx;
  padding: 18rpx 0;
  text-align: center;
  font-size: $gz-fs-small;
  color: $gz-ink-3;
}

.foot {
  margin-top: 44rpx;
  display: flex;
  justify-content: center;
}

.foot__text {
  font-size: $gz-fs-caption;
  letter-spacing: 0.08em;
  color: $gz-ink-3;
}
</style>

<template>
  <view class="page" :class="skinClass">
    <!-- 顶栏 -->
    <view class="nav">
      <view class="nav__side" hover-class="gz-hover" @click="goBack">
        <text class="nav__back">‹</text>
      </view>
      <text class="nav__title">母题库</text>
      <view class="nav__side" />
    </view>

    <view class="intro">
      <text class="intro__text">
        母题不是学到的名词，是被同一件事绊倒很多次之后，才认出来的那个底层问题。
        写不出自己的，先从下面 12 个里认领一个。
      </text>
    </view>

    <view class="rule">
      <text class="rule__text">一个母题下挂满三五条理，才叫看清了它</text>
      <text class="rule__num">{{ mothers.length }} 个 · 共 {{ childrenTotal }} 条</text>
    </view>

    <!-- 我的母题 -->
    <view v-if="!mothers.length" class="empty">
      <view class="empty__seal gz-motion">道</view>
      <text class="empty__title">还没有母题</text>
      <text class="empty__desc">认领一个预置母题，或去理库把某条理「提炼母题」。</text>
    </view>

    <view v-else class="list">
      <view v-for="m in mothers" :key="m.id" class="card">
        <view class="card__top">
          <text v-for="t in m.topics" :key="t" class="card__topic">{{ t }}</text>
          <text class="card__count" :class="{ 'is-thin': countOf(m.id) < 3 }">{{ countOf(m.id) }} 条</text>
        </view>

        <text class="card__name" hover-class="gz-hover" @click="toggle(m.id)">{{ m.title }}</text>
        <text class="card__line">{{ m.content }}</text>

        <!-- 挂靠的内容（展开） -->
        <view v-if="openId === m.id" class="kids">
          <view v-if="!kidsOf(m.id).length" class="kids__empty">
            还空着 —— 去理库把相关的理挂上来，或就这个母题写一条
          </view>
          <view v-for="k in kidsOf(m.id)" :key="k.id" class="kid">
            <text class="kid__kind">{{ k.kind === 'theory' ? '理' : '事' }}</text>
            <text class="kid__text">{{ k.title || k.content.slice(0, 24) }}</text>
            <text class="kid__x" hover-class="gz-hover" @click="detach(k.id)">解挂</text>
          </view>
        </view>

        <view class="ops">
          <text class="ops__state">{{ openId === m.id ? '收起' : '展开' }}</text>
          <view class="ops__right">
            <text class="ops__btn" hover-class="gz-hover" @click="drop(m.id)">删</text>
            <text class="ops__btn" hover-class="gz-hover" @click="writeFor(m)">写一笔</text>
            <text class="ops__btn ops__btn--main" hover-class="gz-hover" @click="attachTo(m.id)">挂靠</text>
          </view>
        </view>
      </view>
    </view>

    <!-- 预置母题 -->
    <view class="section">
      <text class="section__title">12 个常见的母题</text>
      <view class="presets">
        <view v-for="p in PRESET_MOTHERS" :key="p.id" class="preset" :class="{ 'is-taken': taken(p.name) }">
          <view class="preset__top">
            <text class="preset__topic">{{ p.topic }}</text>
            <text v-if="taken(p.name)" class="preset__taken">已收下</text>
          </view>
          <text class="preset__name">{{ p.name }}</text>
          <text class="preset__line">{{ p.line }}</text>
          <view v-if="!taken(p.name)" class="preset__cta" hover-class="gz-hover" @click="adopt(p)">收下 +</view>
        </view>
      </view>
    </view>

    <view class="foot">
      <text class="foot__text">理是认定的 · 道是甩不掉的</text>
    </view>

    <GzDialog
      variant="danger"
      :show="!!dropTarget"
      title="删掉这个母题？"
      :content="dropHint"
      confirm-text="删"
      cancel-text="留着"
      @cancel="dropTarget = null"
      @confirm="dropConfirm"
    />
  </view>
</template>

<script setup lang="ts">
/**
 * 观 · 母题库 —— 「道」这一层的展示层（批次 E 收尾）。
 *
 * 设计取舍：
 *  - **不新开 store**：母题就是 observe 里 kind='mother' 的条目，预置只是"样本"，
 *    认领后变成一条普通的母题条目。避免"预置库 / 我的库"两套数据结构互相打架；
 *  - **认领不入账**：别人写好的问题不算功夫，挂上第一条自己的内容才算；
 *  - **删母题要先解挂**：直接删会留下一堆指向空 id 的内容（脏引用），
 *    所以删之前把挂靠内容的 motherId 全部清掉，它们退回理库，不会消失。
 */
import { computed, ref } from 'vue'
import GzDialog from '@/components/GzDialog/GzDialog.vue'
import { PRESET_MOTHERS, type PresetMother } from '@/config/mothers'
import { useObserveStore, type ObsItem } from '@/stores/observe'
import { useSkinClass } from '@/composables/useSkin'
import { navigateTo, ROUTES } from '@/router/routes'

const observe = useObserveStore()
const skinClass = useSkinClass()

const mothers = computed(() => observe.mothers)
/** 当前展开的母题 id */
const openId = ref('')

const childrenTotal = computed(() => mothers.value.reduce((n, m) => n + countOf(m.id), 0))

function kidsOf(id: string): ObsItem[] {
  return observe.childrenOf(id)
}

function countOf(id: string): number {
  return observe.childrenOf(id).length
}

function toggle(id: string): void {
  openId.value = openId.value === id ? '' : id
}

function taken(name: string): boolean {
  return mothers.value.some((m) => m.title === name)
}

/** 认领预置母题：先让他写下自己的第一笔，空着也能收下（用预置那句垫底） */
function adopt(p: PresetMother): void {
  uni.showModal({
    title: p.name,
    content: p.probe,
    editable: true,
    placeholderText: '写下你自己的第一笔（可留空）',
    confirmText: '收下',
    cancelText: '再想想',
    success: (res) => {
      if (!res.confirm) return
      const mine = ((res as { content?: string }).content ?? '').trim()
      const item = observe.adoptPreset({
        name: p.name,
        topics: [p.topic],
        content: mine ? `${p.line}\n${mine}` : p.line,
      })
      if (!item) {
        uni.showToast({ title: '收件满了，先去处理几条', icon: 'none' })
        return
      }
      uni.showToast({ title: '已收下 · 去挂上第一条内容', icon: 'none' })
    },
  })
}

/**
 * 挂靠：列出还没挂母题的理让用户挑。
 * 已经全挂满了就不装作有事可做 —— 提示去立新的理。
 */
function attachTo(motherId: string): void {
  const free = observe.theories.filter((i) => !i.motherId).slice(0, 8)
  if (!free.length) {
    uni.showModal({
      title: '没有可挂的理',
      content: '去理库立一条新理，或直接就这个母题写一笔？',
      confirmText: '写一笔',
      cancelText: '去理库',
      success: (res) => {
        if (res.confirm) writeFor(observe.find(motherId))
        else navigateTo(ROUTES.observeTheoryLib)
      },
    })
    return
  }
  uni.showActionSheet({
    itemList: free.map((i) => i.title || i.content.slice(0, 16)),
    success: (r) => {
      const target = free[r.tapIndex]
      if (!target) return
      observe.attachMother(target.id, motherId)
      openId.value = motherId
      uni.showToast({ title: '已挂上', icon: 'none' })
    },
  })
}

function detach(id: string): void {
  observe.attachMother(id, undefined)
}

/** 就这个母题写一笔：带好上下文跳到录入页（存成理，回来再挂） */
function writeFor(m?: ObsItem): void {
  if (!m) return
  navigateTo(ROUTES.observeCompose, {
    kind: 'theory',
    form: 'quote',
    title: m.title,
    tag: ['母题', ...m.topics].join(','),
  })
}

const dropTarget = ref<ObsItem | null>(null)
const dropHint = computed(() => {
  const m = dropTarget.value
  if (!m) return ''
  const n = countOf(m.id)
  return n
    ? `「${m.title}」下挂着的 ${n} 条会退回理库（内容不丢），母题本身不可找回。`
    : `「${m.title}」将不再出现，不可找回。`
})

function drop(id: string): void {
  dropTarget.value = observe.find(id) ?? null
}

function dropConfirm(): void {
  const m = dropTarget.value
  dropTarget.value = null
  if (!m) return
  // 先解挂再删：不留指向空 id 的脏引用
  for (const k of observe.childrenOf(m.id)) observe.attachMother(k.id, undefined)
  if (openId.value === m.id) openId.value = ''
  observe.remove(m.id)
  uni.showToast({ title: '已删', icon: 'none' })
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

.intro {
  margin-top: 12rpx;
  padding: 22rpx 24rpx;
  border-left: 4rpx solid $gz-accent;
  background: $gz-accent-soft;
  border-radius: 0 $gz-radius-sm $gz-radius-sm 0;
}

.intro__text {
  font-size: $gz-fs-small;
  line-height: 1.85;
  color: $gz-ink-2;
}

.rule {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin: 20rpx 4rpx 8rpx;
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

.card__top {
  display: flex;
  align-items: center;
  gap: 12rpx;
}

.card__topic {
  padding: 4rpx 16rpx;
  border-radius: 999rpx;
  background: #f2edf8;
  color: #7a63a8;
  font-size: $gz-fs-caption;
}

.card__count {
  margin-left: auto;
  font-size: $gz-fs-caption;
  color: $gz-accent;
  font-weight: 600;
}

.card__count.is-thin {
  color: $gz-ink-3;
  font-weight: 400;
}

.card__name {
  display: block;
  margin-top: 16rpx;
  font-size: 34rpx;
  font-weight: 700;
  line-height: 1.5;
  color: $gz-ink;
}

.card__line {
  display: block;
  margin-top: 10rpx;
  font-size: $gz-fs-small;
  line-height: 1.85;
  color: $gz-ink-2;
}

.kids {
  margin-top: 18rpx;
  padding: 16rpx 18rpx;
  border-radius: $gz-radius-md;
  background: $gz-input-bg;
}

.kids__empty {
  font-size: $gz-fs-caption;
  line-height: 1.8;
  color: $gz-ink-3;
}

.kid {
  display: flex;
  align-items: center;
  gap: 12rpx;
  padding: 8rpx 0;
}

.kid__kind {
  flex: none;
  padding: 2rpx 12rpx;
  border-radius: 999rpx;
  background: #eaf0f8;
  color: #4e8fd4;
  font-size: 20rpx;
}

.kid__text {
  flex: 1;
  min-width: 0;
  font-size: $gz-fs-small;
  color: $gz-ink;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.kid__x {
  flex: none;
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
  gap: 14rpx;
}

.ops__btn {
  padding: 8rpx 26rpx;
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

.section {
  margin-top: 40rpx;
}

.section__title {
  display: block;
  margin-bottom: 18rpx;
  font-size: 30rpx;
  font-weight: 700;
  color: $gz-ink;
}

.presets {
  display: flex;
  flex-direction: column;
  gap: 16rpx;
}

.preset {
  padding: 24rpx 26rpx 22rpx;
  background: $gz-surface;
  border: 1rpx solid $gz-line;
  border-radius: $gz-radius-md;
}

.preset.is-taken {
  opacity: 0.62;
}

.preset__top {
  display: flex;
  align-items: center;
  gap: 12rpx;
}

.preset__topic {
  padding: 4rpx 16rpx;
  border-radius: 999rpx;
  background: $gz-input-bg;
  font-size: $gz-fs-caption;
  color: $gz-ink-3;
}

.preset__taken {
  margin-left: auto;
  font-size: $gz-fs-caption;
  color: $gz-accent;
}

.preset__name {
  display: block;
  margin-top: 14rpx;
  font-size: $gz-fs-body;
  font-weight: 700;
  line-height: 1.6;
  color: $gz-ink;
}

.preset__line {
  display: block;
  margin-top: 8rpx;
  font-size: $gz-fs-small;
  line-height: 1.85;
  color: $gz-ink-2;
}

.preset__cta {
  margin-top: 16rpx;
  padding: 12rpx 0;
  text-align: center;
  border: 1rpx solid $gz-accent;
  border-radius: 999rpx;
  font-size: $gz-fs-small;
  color: $gz-accent;
}

.empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 80rpx 40rpx 0;
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

<template>
  <view class="page" :class="skinClass">
    <!-- 顶栏 -->
    <view class="nav">
      <view class="nav__side" hover-class="gz-hover" @click="goBack">
        <text class="nav__back">‹</text>
      </view>
      <text class="nav__title">理道图谱</text>
      <view class="nav__side" />
    </view>

    <view class="intro">
      <text class="intro__text">
        理认了、母题也认了，连起来是什么样？这页只摆结构，不给结论 ——
        一条理挂上一个母题，才算连进了你的道。
      </text>
    </view>

    <!-- 总览 -->
    <view class="sum">
      <view class="sum__cell">
        <text class="sum__n">{{ theories.length }}</text>
        <text class="sum__k">条理</text>
      </view>
      <view class="sum__cell">
        <text class="sum__n">{{ attached }}</text>
        <text class="sum__k">已挂上</text>
      </view>
      <view class="sum__cell">
        <text class="sum__n">{{ loose }}</text>
        <text class="sum__k">还散着</text>
      </view>
      <view class="sum__cell">
        <text class="sum__n">{{ mothers.length }}</text>
        <text class="sum__k">个母题</text>
      </view>
    </view>

    <!-- 领域分布 -->
    <view v-if="fieldRows.length" class="section">
      <text class="section__title">理的领域分布</text>
      <view class="fields">
        <view v-for="f in fieldRows" :key="f.name" class="fields__row">
          <text class="fields__name">{{ f.name }}</text>
          <view class="fields__bar">
            <view class="fields__fill" :style="{ width: `${f.pct}%` }" />
          </view>
          <text class="fields__n">{{ f.n }}</text>
        </view>
      </view>
      <text class="section__note">一条理可属多个领域，按命中次数计</text>
    </view>

    <!-- 空态：连不起来 -->
    <view v-if="!theories.length" class="empty">
      <view class="empty__seal gz-motion">道</view>
      <text class="empty__title">图谱还连不起来</text>
      <text class="empty__desc">先去理库立一条理（记得写「为什么成立」），再认领一个母题把它挂上去。</text>
      <view class="empty__btn" hover-class="gz-hover" @click="goTheoryLib">去理库</view>
    </view>

    <template v-else>
      <!-- 连起来的：母题 → 挂靠的理（空母题不进图谱，它还没连上任何东西） -->
      <view class="section">
        <text class="section__title">连起来的 · {{ linkedMothers.length }} 个母题</text>
        <view v-if="!linkedMothers.length" class="section__empty">
          还没有一条理挂上母题 —— 母题库认领一个，或在下面把散着的理挂上去
        </view>
        <view v-for="m in linkedMothers" :key="m.id" class="node">
          <view class="node__top" hover-class="gz-hover" @click="goMotherLib">
            <text class="node__name">{{ m.title }}</text>
            <text class="node__n">{{ kidsOf(m.id).length }} 条</text>
          </view>
          <view
            v-for="k in kidsOf(m.id)"
            :key="k.id"
            class="leaf"
            hover-class="gz-hover"
            @click="goDetail(k.id)"
          >
            <text class="leaf__kind">{{ k.kind === 'theory' ? '理' : '事' }}</text>
            <text class="leaf__text">{{ k.title || k.content.slice(0, 26) }}</text>
            <text class="leaf__go">›</text>
          </view>
        </view>
      </view>

      <!-- 还散着的理：就地挂靠 -->
      <view v-if="looseItems.length" class="section">
        <text class="section__title">还散着的理 · {{ loose }}</text>
        <view v-for="t in looseItems" :key="t.id" class="leaf">
          <text class="leaf__kind">理</text>
          <text class="leaf__text">{{ t.title }}</text>
          <text class="leaf__attach" hover-class="gz-hover" @click="attach(t.id)">挂靠</text>
        </view>
        <text v-if="loose > looseItems.length" class="section__note">
          还有 {{ loose - looseItems.length }} 条散着，去理库慢慢挂
        </text>
        <text class="section__note">挂靠只是把结构连起来，不入账 —— 钱在「处理」时付过了</text>
      </view>
    </template>

    <view class="foot">
      <text class="foot__text">理是认定的 · 道是甩不掉的</text>
    </view>
  </view>
</template>

<script setup lang="ts">
/**
 * 观 · 理道图谱（规格 §4.1 观道层 + §15.4）—— 理与母题引用关系的总览。
 *
 * 设计取舍：
 *  - **纯派生，不落库**：关系本来就长在每条理的 motherId 上，这页只是 observe store
 *    的第三个切面（理库按时间列、母题库按母题列、图谱按「关系」列），不新增存储；
 *  - **MVP 用列表，不做力导向图**（§15.4 原文）—— 手机上拖一张网不如一列母子关系好读；
 *  - **只摆结构，不下结论**：不说「你偏科了」—— 连上了就是连上了，散着就是散着。
 */
import { computed } from 'vue'
import { OBSERVE_TOPICS, useObserveStore, type ObsItem } from '@/stores/observe'
import { useSkinClass } from '@/composables/useSkin'
import { navigateTo, ROUTES } from '@/router/routes'

const observe = useObserveStore()
const skinClass = useSkinClass()

const theories = computed(() => observe.theories)
const mothers = computed(() => observe.mothers)

const attached = computed(() => theories.value.filter((t) => t.motherId).length)
const loose = computed(() => theories.value.length - attached.value)
/** 散着的理最多列 8 条，再多去理库 —— 列表页不是收纳页 */
const looseItems = computed(() => theories.value.filter((t) => !t.motherId).slice(0, 8))

/** 有挂靠内容的母题，按条数降序 */
const linkedMothers = computed(() =>
  mothers.value
    .map((m) => ({ m, n: observe.childrenOf(m.id).length }))
    .filter((x) => x.n > 0)
    .sort((a, b) => b.n - a.n)
    .map((x) => x.m),
)

function kidsOf(id: string): ObsItem[] {
  return observe.childrenOf(id)
}

/** 领域分布（只列有数的领域；占比按最大值归一，只比长短不下判断） */
const fieldRows = computed(() => {
  const counts = new Map<string, number>()
  for (const t of theories.value) {
    for (const tp of t.topics) counts.set(tp, (counts.get(tp) ?? 0) + 1)
  }
  const max = Math.max(1, ...counts.values())
  return OBSERVE_TOPICS.filter((name) => counts.has(name)).map((name) => {
    const n = counts.get(name) ?? 0
    return { name, n, pct: Math.round((n / max) * 100) }
  })
})

/**
 * 就地挂靠（与理库同一套）：列出母题让用户挑；
 * 一个母题都没有时不硬塞 —— 送去母题库先认领一个。
 */
function attach(id: string): void {
  const ms = mothers.value
  if (!ms.length) {
    uni.showToast({ title: '还没有母题 · 先去认领一个', icon: 'none' })
    setTimeout(() => goMotherLib(), 600)
    return
  }
  uni.showActionSheet({
    itemList: ms.map((m) => m.title).slice(0, 6),
    success: (res) => {
      const target = ms[res.tapIndex]
      if (!target) return
      observe.attachMother(id, target.id)
      uni.showToast({ title: `已挂到「${target.title}」`, icon: 'none' })
    },
  })
}

function goDetail(id: string): void {
  navigateTo(ROUTES.observeDetail, { id })
}

function goTheoryLib(): void {
  navigateTo(ROUTES.observeTheoryLib)
}

function goMotherLib(): void {
  navigateTo(ROUTES.observeMotherLib)
}

function goBack(): void {
  uni.navigateBack()
}
</script>

<style lang="scss">
@import './index.scss';
</style>

<template>
  <view class="page" :class="skinClass">
    <!-- 顶栏：返回 + 标题（子页统一样式） -->
    <view class="nav">
      <view class="nav__side" hover-class="gz-hover" @click="goBack">
        <text class="nav__back">‹</text>
      </view>
      <text class="nav__title">来源账本</text>
      <view class="nav__side" />
    </view>

    <!-- 规则说明 -->
    <view class="lead">
      <text class="lead__title">你把时间花在谁身上</text>
      <text class="lead__desc">
        这里不给你打分，也不用你投票 —— 它只是把收件匣里的「来源」拢一拢：\n收了谁多少条、读完了几成、都在哪些领域。
      </text>
    </view>

    <!-- 总览 -->
    <view v-if="rows.length" class="sum">
      <view class="sum__item">
        <text class="sum__n">{{ rows.length }}</text>
        <text class="sum__cap">个来源</text>
      </view>
      <view class="sum__item">
        <text class="sum__n">{{ totalItems }}</text>
        <text class="sum__cap">收下条数</text>
      </view>
      <view class="sum__item">
        <text class="sum__n" :class="{ 'is-warn': backlogCount > 0 }">{{ backlogCount }}</text>
        <text class="sum__cap">待消化</text>
      </view>
    </view>

    <!-- 账本 / 空态 -->
    <view v-if="!rows.length" class="empty">
      <view class="empty__seal">账</view>
      <text class="empty__title">还没有来源可记</text>
      <text class="empty__desc">
        「记一笔」时填过「来源」（公众号 / 播客 / 书 / 朋友），账本自然就长出来了。
      </text>
    </view>
    <view v-else class="list">
      <view v-for="r in rows" :key="r.name" class="row" hover-class="gz-hover" @click="open(r)">
        <view class="row__top">
          <text class="row__name">{{ r.name }}</text>
          <text v-if="r.backlog" class="row__tag">待消化</text>
        </view>

        <view class="row__body">
          <text class="row__rate-num">{{ r.total }}</text>
          <text class="row__rate-cap">条 · 读完 {{ r.handled }} 条</text>
          <text class="row__rate">{{ r.rate }}%</text>
        </view>

        <view v-if="r.topics.length" class="row__topics">
          <text v-for="t in r.topics" :key="t.name" class="topic">{{ t.name }} {{ t.count }}</text>
        </view>

        <view class="row__meta">
          <text class="row__time">最近一次 {{ dayLabel(r.lastAt) }}</text>
          <text class="row__go">看这些条目 ›</text>
        </view>
      </view>
    </view>

    <view class="foot">
      <text class="foot__text">收得多不等于读得多 —— 账本只把这件事摆出来</text>
    </view>
  </view>
</template>

<script setup lang="ts">
/**
 * 观 · 来源账本 —— 由「信息源质量榜」改造而来（2026-09-17）。
 *
 * 为什么改：原来这一页要求用户对来源投「有用 / 没用」，而投票的入口（观大厅的极简报标注）
 * 在「极简报 → 每日一则」改版后就没了 —— 榜单里只剩 5 个预置的假来源，既长不大也不指向真实行为。
 * 现在换成**纯派生**的账本：数据全部来自收件池的 `sourceName` + 处理状态 + 主题，
 * 零输入成本，也就没有"忘了标"这回事。统计口径见 utils/sourceLedger.ts，阈值见 config/ledger.ts。
 *
 * 交互只有一件事：点一行 → 去收件匣看这个来源收下的条目（带 `?src=` 筛选，可一键取消）。
 */
import { computed } from 'vue'
import { useObserveStore } from '@/stores/observe'
import { buildLedger, type SourceRow } from '@/utils/sourceLedger'
import { useSkinClass } from '@/composables/useSkin'
import { navigateTo, ROUTES } from '@/router/routes'

const observe = useObserveStore()
const skinClass = useSkinClass()

const rows = computed<SourceRow[]>(() => buildLedger(observe.items))
const totalItems = computed(() => rows.value.reduce((n, r) => n + r.total, 0))
const backlogCount = computed(() => rows.value.filter((r) => r.backlog).length)

/** 最近一次收下的日子（只给到日 —— 账本要的是"多久没碰它了"这个量级） */
function dayLabel(ts: number): string {
  const d = new Date(ts)
  return `${d.getMonth() + 1} 月 ${d.getDate()} 日`
}

function open(r: SourceRow): void {
  navigateTo(ROUTES.observeInbox, { src: r.name })
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
@import './index.scss';
</style>

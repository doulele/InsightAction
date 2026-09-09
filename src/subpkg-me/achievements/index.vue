<template>
  <view class="page" :class="skinClass">
    <!-- 顶栏 -->
    <view class="nav">
      <view class="nav__side" hover-class="gz-hover" @click="goBack">
        <text class="nav__back">‹</text>
      </view>
      <text class="nav__title">成就墙 · 徽章</text>
      <view class="nav__side" />
    </view>

    <!-- 总况 -->
    <view class="head">
      <view class="head__left">
        <text class="head__num">{{ unlockedN }}<text class="head__total"> / {{ list.length }}</text></text>
        <text class="head__cap">枚徽章已解锁</text>
      </view>
      <view class="head__seal" :class="{ 'is-empty': unlockedN === 0 }">
        {{ unlockedN === 0 ? '白' : unlockedN >= list.length ? '满' : unlockedN }}
      </view>
    </view>

    <!-- 下一枚预告 -->
    <view class="next" :class="{ 'is-full': unlockedN === list.length }">
      <text class="next__cap">{{ unlockedN === list.length ? '已是全收集' : '下一枚' }}</text>
      <text class="next__title">{{ nextRule ? nextRule.rule.name : '所有徽章都已点亮' }}</text>
      <text class="next__desc">{{ nextRule ? nextRule.rule.desc : '继续修行，守住日常' }}</text>
    </view>

    <!-- 徽章墙 -->
    <view class="wall">
      <view
        v-for="item in list"
        :key="item.rule.id"
        class="tile"
        :class="{ 'is-locked': !item.unlocked }"
        hover-class="gz-hover"
        @click="open(item)"
      >
        <view class="tile__mark" :class="{ 'is-locked': !item.unlocked }">
          {{ item.rule.name.slice(0, 1) }}
        </view>
        <text class="tile__name">{{ item.rule.name }}</text>
        <text class="tile__state">{{ item.unlocked ? '已解锁' : '未达成' }}</text>
      </view>
    </view>

    <!-- 说明脚注 -->
    <view class="foot">
      <text class="foot__text">本地行为即可判定 · 登录同步后端期开放</text>
    </view>

    <!-- 徽章详情层 -->
    <view v-if="detailOpen" class="mask" @click="detailOpen = false">
      <view class="sheet" @click.stop>
        <view class="sheet__mark" :class="{ 'is-locked': !activeUnlocked }">
          {{ currentRule.name.slice(0, 1) }}
        </view>
        <text class="sheet__title">{{ currentRule.name }}</text>
        <text class="sheet__cap">{{ activeUnlocked ? '已解锁' : '未达成 · 达成条件' }}</text>
        <text class="sheet__desc">{{ currentRule.desc }}</text>
        <view class="sheet__close" hover-class="gz-hover" @click="detailOpen = false">知道了</view>
      </view>
    </view>
  </view>
</template>

<script setup lang="ts">
/**
 * 成就墙 · 徽章（批次 C · 我）· 分包 subpkg-me。
 * 全部 18 枚徽章均由本地行为快照判定（规则见 config/badges.ts），
 * 与「我」页入口的已解锁数同源；点击徽章可看达成条件。
 */
import { computed, ref } from 'vue'
import { evaluateBadges, type BadgeRule } from '@/config/badges'
import { buildBadgeContext } from '@/utils/growth'
import { useSkinClass } from '@/composables/useSkin'
import { ROUTES } from '@/router/routes'

const skinClass = useSkinClass()

interface BadgeItem {
  rule: BadgeRule
  unlocked: boolean
}

const list = computed<BadgeItem[]>(() => evaluateBadges(buildBadgeContext()))
const unlockedN = computed(() => list.value.filter((i) => i.unlocked).length)
const nextRule = computed(() => list.value.find((i) => !i.unlocked))

const detailOpen = ref(false)
const activeRule = ref<BadgeRule | null>(null)
const activeUnlocked = ref(false)
/** 弹层只读展示用（避免模板里做空值判断） */
const currentRule = computed<BadgeRule>(() => activeRule.value ?? { id: '', name: '', desc: '', hit: () => false })

function open(item: BadgeItem): void {
  activeRule.value = item.rule
  activeUnlocked.value = item.unlocked
  detailOpen.value = true
}

function goBack(): void {
  const pages = getCurrentPages()
  if (pages.length > 1) {
    uni.navigateBack()
  } else {
    uni.switchTab({ url: ROUTES.tabMe })
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

/* 总况 */
.head {
  margin-top: 16rpx;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 30rpx 32rpx;
  background: $gz-surface;
  border: 1rpx solid $gz-line;
  border-radius: $gz-radius-lg;
}

.head__num {
  display: block;
  font-size: 72rpx;
  font-weight: 800;
  line-height: 1;
  color: $gz-accent;
  font-variant-numeric: tabular-nums;
}

.head__total {
  font-size: 30rpx;
  color: $gz-ink-3;
}

.head__cap {
  display: block;
  margin-top: 12rpx;
  font-size: $gz-fs-caption;
  color: $gz-ink-3;
}

.head__seal {
  display: flex;
  align-items: center;
  justify-content: center;
  flex: none;
  width: 104rpx;
  height: 104rpx;
  border: 2rpx solid $gz-accent;
  border-radius: 24rpx;
  background: $gz-accent-soft;
  color: $gz-accent;
  font-size: 48rpx;
  font-weight: 800;
}

.head__seal.is-empty {
  opacity: 0.4;
}

/* 下一枚 */
.next {
  margin-top: 22rpx;
  padding: 24rpx 30rpx;
  background: $gz-accent-soft;
  border: 1rpx solid $gz-accent;
  border-radius: $gz-radius-md;
}

.next.is-full {
  background: $gz-surface;
  border-color: $gz-line;
}

.next__cap {
  display: block;
  font-size: $gz-fs-caption;
  letter-spacing: 0.1em;
  color: $gz-accent;
}

.next__title {
  display: block;
  margin-top: 8rpx;
  font-size: $gz-fs-body;
  font-weight: 700;
  color: $gz-ink;
}

.next__desc {
  display: block;
  margin-top: 6rpx;
  font-size: $gz-fs-caption;
  line-height: 1.6;
  color: $gz-ink-3;
}

/* 墙 */
.wall {
  margin-top: 26rpx;
  display: flex;
  flex-wrap: wrap;
  gap: 16rpx;
}

.tile {
  width: calc((100% - 32rpx) / 3);
  box-sizing: border-box;
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 26rpx 8rpx 22rpx;
  background: $gz-surface;
  border: 1rpx solid $gz-line;
  border-radius: $gz-radius-md;
  transition: opacity 0.2s ease;
}

.tile.is-locked {
  opacity: 0.45;
}

.tile__mark {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 84rpx;
  height: 84rpx;
  border-radius: 22rpx;
  border: 2rpx solid $gz-accent;
  background: $gz-accent-soft;
  color: $gz-accent;
  font-size: 38rpx;
  font-weight: 800;
}

.tile__mark.is-locked {
  border-style: dashed;
  filter: grayscale(1);
}

.tile__name {
  display: block;
  margin-top: 14rpx;
  font-size: 24rpx;
  font-weight: 600;
  color: $gz-ink;
  text-align: center;
}

.tile__state {
  display: block;
  margin-top: 6rpx;
  font-size: 18rpx;
  color: $gz-ink-3;
}

.foot {
  margin-top: 44rpx;
  display: flex;
  justify-content: center;
}

.foot__text {
  font-size: $gz-fs-caption;
  letter-spacing: 0.06em;
  color: $gz-ink-3;
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
  padding: 44rpx 40rpx calc(env(safe-area-inset-bottom) + 40rpx);
  background: $gz-surface;
  border-radius: 32rpx 32rpx 0 0;
  box-sizing: border-box;
  display: flex;
  flex-direction: column;
  align-items: center;
}

.sheet__mark {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 120rpx;
  height: 120rpx;
  border: 2rpx solid $gz-accent;
  border-radius: 28rpx;
  background: $gz-accent-soft;
  color: $gz-accent;
  font-size: 56rpx;
  font-weight: 800;
}

.sheet__mark.is-locked {
  border-style: dashed;
  opacity: 0.5;
}

.sheet__title {
  margin-top: 24rpx;
  font-size: 40rpx;
  font-weight: 800;
  color: $gz-ink;
}

.sheet__cap {
  margin-top: 10rpx;
  font-size: $gz-fs-caption;
  letter-spacing: 0.1em;
  color: $gz-accent;
}

.sheet__desc {
  margin-top: 18rpx;
  font-size: $gz-fs-body;
  line-height: 1.8;
  text-align: center;
  color: $gz-ink-2;
}

.sheet__close {
  margin-top: 34rpx;
  width: 100%;
  padding: 22rpx 0;
  text-align: center;
  background: $gz-accent-soft;
  color: $gz-accent;
  font-size: $gz-fs-body;
  font-weight: 600;
  border-radius: $gz-radius-md;
}
</style>

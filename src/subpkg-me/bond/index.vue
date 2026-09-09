<template>
  <view class="page" :class="skinClass">
    <!-- 顶栏：返回 + 标题 -->
    <view class="nav">
      <view class="nav__side" hover-class="gz-hover" @click="goBack">
        <text class="nav__back">‹</text>
      </view>
      <text class="nav__title">小枢羁绊</text>
      <view class="nav__side" />
    </view>

    <!-- 羁绊卡 -->
    <view class="bond">
      <view class="bond__orb">
        <text class="bond__orb-glyph">{{ buddyGlyph }}</text>
      </view>
      <view class="bond__info">
        <view class="bond__head">
          <text class="bond__name">{{ assistantName }}</text>
          <view class="bond__lv">Lv.{{ bondLv }} · {{ bondLvName }}</view>
        </view>
        <text class="bond__sub">
          {{ bondNextGap > 0 ? `再见 ${bondNextGap} 次升级 · 累计见面 ${bondXp} 次` : '已至「一心」之境 · 与君同行' }}
        </text>
        <view class="bar">
          <view class="bar__fill" :style="{ width: `${bondPct}%` }" />
        </view>
      </view>
    </view>
    <text class="bond__note">每一次问候、每一次打开面板，都算一次见面。高阶形态与特效随皮肤系统推进。</text>

    <!-- 对话录 / 箴言墙 切换 -->
    <view class="tabs">
      <view
        class="tabs__item"
        :class="{ 'is-on': tab === 'lines' }"
        hover-class="gz-hover"
        @click="tab = 'lines'"
      >
        对话录
      </view>
      <view
        class="tabs__item"
        :class="{ 'is-on': tab === 'favs' }"
        hover-class="gz-hover"
        @click="tab = 'favs'"
      >
        箴言墙<text v-if="favs.length" class="tabs__count">{{ favs.length }}</text>
      </view>
    </view>

    <!-- 对话录 -->
    <view v-if="tab === 'lines'" class="sec">
      <view v-if="groups.length === 0" class="empty">
        <text class="empty__title">还没有对话</text>
        <text class="empty__text">去大厅走一走、等一次早晚问候，与小枢的每一次见面都会记在这里。</text>
      </view>
      <view v-for="g in groups" :key="g.label" class="grp">
        <text class="grp__label">{{ g.label }}</text>
        <view class="line" v-for="item in g.items" :key="item.key">
          <view class="line__dot" :class="`is-${item.kind}`" />
          <view class="line__body">
            <text class="line__text">{{ item.text }}</text>
            <text class="line__meta">{{ KIND_LABEL[item.kind] }} · {{ item.time }}</text>
          </view>
          <view
            class="line__fav"
            :class="{ 'is-on': item.fav }"
            hover-class="gz-hover"
            @click="toggleFav(item.raw)"
          >
            {{ item.fav ? '♥' : '♡' }}
          </view>
        </view>
      </view>
    </view>

    <!-- 箴言墙 -->
    <view v-else class="sec">
      <view v-if="favs.length === 0" class="empty">
        <text class="empty__title">箴言墙还空着</text>
        <text class="empty__text">遇到想留住的句子，点亮 ♡ 就会收进这里，时时回看。</text>
      </view>
      <view v-for="f in favsView" :key="f.key" class="fav">
        <text class="fav__mark">「</text>
        <view class="fav__body">
          <text class="fav__text">{{ f.text }}</text>
          <text class="fav__meta">{{ f.time }}</text>
        </view>
        <view class="fav__acts">
          <view class="fav__btn" hover-class="gz-hover" @click="copyLine(f.text)">复制</view>
          <view class="fav__btn fav__btn--off" hover-class="gz-hover" @click="toggleFav(f.raw)">移除</view>
        </view>
      </view>
    </view>

    <view class="foot">
      <text class="foot__text">小枢与你 · 来日方长</text>
    </view>
  </view>
</template>

<script setup lang="ts">
/**
 * 我 · 小枢羁绊（m7 批次 · 分包 subpkg-me/bond）：
 * 纯本地——对话录记录每一次到点问候 / 守护提醒 / 见面互动；
 * 箴言墙收纳收藏的小枢语录；羁绊等级随累计见面次数 Lv.1-20 渐进。
 * 数据源与逻辑在 composables/useBuddy.ts（模块级单例，随大厅 onShow poke 自动积累）。
 */
import { computed, ref } from 'vue'
import { useBuddy, type BuddyLine } from '@/composables/useBuddy'
import { useSkinClass } from '@/composables/useSkin'
import { ROUTES } from '@/router/routes'

const {
  buddyGlyph,
  assistantName,
  bondLv,
  bondLvName,
  bondXp,
  bondPct,
  bondNextGap,
  lines,
  favs,
  toggleFav,
} = useBuddy()

const skinClass = useSkinClass()

const tab = ref<'lines' | 'favs'>('lines')

const KIND_LABEL: Record<BuddyLine['kind'], string> = {
  greet: '问候',
  guard: '守护',
  remind: '到点',
  meet: '见面',
}

const pad = (n: number): string => String(n).padStart(2, '0')

function fmtTime(at: number): string {
  const d = new Date(at)
  return `${pad(d.getHours())}:${pad(d.getMinutes())}`
}

function dayLabelOf(at: number): string {
  const d = new Date(at)
  const now = new Date()
  const isSame = (x: Date, y: Date): boolean =>
    x.getFullYear() === y.getFullYear() && x.getMonth() === y.getMonth() && x.getDate() === y.getDate()
  if (isSame(d, now)) return '今天'
  const yest = new Date(now)
  yest.setDate(now.getDate() - 1)
  if (isSame(d, yest)) return '昨天'
  return `${d.getMonth() + 1} 月 ${d.getDate()} 日`
}

interface LineView {
  key: string
  raw: BuddyLine
  kind: BuddyLine['kind']
  text: string
  time: string
  fav: boolean
}

/* favMap 依赖 favs.value，保证收藏状态变化触发重算 */
const favMap = computed(() => new Set(favs.value.map((f) => `${f.kind}:${f.text}`)))

interface Group {
  label: string
  items: LineView[]
}

const groups = computed<Group[]>(() => {
  const out: Group[] = []
  for (const l of lines.value) {
    const label = dayLabelOf(l.at)
    const last = out[out.length - 1]
    const item: LineView = {
      key: `${l.at}-${l.text}`,
      raw: l,
      kind: l.kind,
      text: l.text,
      time: fmtTime(l.at),
      fav: favMap.value.has(`${l.kind}:${l.text}`),
    }
    if (last && last.label === label) {
      last.items.push(item)
    } else {
      out.push({ label, items: [item] })
    }
  }
  return out
})

const favsView = computed(() =>
  favs.value.map((f) => ({
    key: `${f.at}-${f.text}`,
    raw: f,
    text: f.text,
    time: `${dayLabelOf(f.at)} ${fmtTime(f.at)}`,
  })),
)

function copyLine(text: string): void {
  uni.setClipboardData({
    data: text,
    success: () => uni.showToast({ title: '已复制', icon: 'none' }),
  })
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
  padding: 24rpx $gz-page-pad 60rpx;
}

.nav {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 8rpx 0 20rpx;
}

.nav__side {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 72rpx;
  height: 72rpx;
}

.nav__back {
  font-size: 56rpx;
  color: $gz-ink-2;
  line-height: 1;
}

.nav__title {
  font-size: $gz-fs-title;
  font-weight: 700;
  color: $gz-ink;
}

/* ---- 羁绊卡 ---- */
.bond {
  display: flex;
  align-items: center;
  gap: 26rpx;
  padding: 30rpx;
  background: var(--gz-surface);
  border: 1rpx solid var(--gz-line);
  border-radius: $gz-radius-lg;
  box-shadow: 0 10rpx 30rpx rgba(0, 0, 0, 0.05);
}

.bond__orb {
  flex: none;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 116rpx;
  height: 116rpx;
  border-radius: 50%;
  background: radial-gradient(circle at 30% 24%, var(--gz-grad-to), var(--gz-accent) 70%);
  box-shadow: 0 12rpx 28rpx rgba(0, 0, 0, 0.18);
}

.bond__orb-glyph {
  color: #fff;
  font-size: 52rpx;
  font-weight: 800;
}

.bond__info {
  flex: 1;
  min-width: 0;
}

.bond__head {
  display: flex;
  align-items: center;
  gap: 16rpx;
}

.bond__name {
  font-size: 38rpx;
  font-weight: 800;
  letter-spacing: 0.04em;
  color: var(--gz-ink);
}

.bond__lv {
  padding: 4rpx 16rpx;
  border-radius: 999rpx;
  background: var(--gz-accent-soft);
  color: var(--gz-accent);
  font-size: $gz-fs-caption;
  font-weight: 700;
}

.bond__sub {
  display: block;
  margin-top: 8rpx;
  font-size: $gz-fs-small;
  color: var(--gz-ink-3);
}

.bar {
  margin-top: 18rpx;
  height: 14rpx;
  border-radius: 999rpx;
  background: var(--gz-line-soft);
  overflow: hidden;
}

.bar__fill {
  height: 100%;
  border-radius: 999rpx;
  background: linear-gradient(90deg, var(--gz-accent), var(--gz-grad-to));
  transition: width 0.4s ease;
}

.bond__note {
  display: block;
  padding: 18rpx 8rpx 0;
  font-size: $gz-fs-caption;
  line-height: 1.7;
  color: $gz-ink-3;
}

/* ---- 切换 ---- */
.tabs {
  display: flex;
  gap: 12rpx;
  margin-top: 30rpx;
}

.tabs__item {
  position: relative;
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  height: 80rpx;
  border-radius: $gz-radius-md;
  background: $gz-surface;
  border: 1rpx solid $gz-line;
  font-size: $gz-fs-body;
  font-weight: 600;
  color: $gz-ink-2;
}

.tabs__item.is-on {
  background: $gz-accent-soft;
  border-color: $gz-accent;
  color: $gz-accent;
  font-weight: 700;
}

.tabs__count {
  margin-left: 8rpx;
  font-size: $gz-fs-caption;
  color: inherit;
  opacity: 0.8;
}

.sec {
  margin-top: 24rpx;
}

/* ---- 对话录 ---- */
.grp__label {
  display: block;
  padding: 8rpx 4rpx 14rpx;
  font-size: $gz-fs-small;
  letter-spacing: 0.08em;
  color: $gz-ink-3;
}

.line {
  display: flex;
  align-items: flex-start;
  gap: 20rpx;
  padding: 22rpx 26rpx;
  margin-bottom: 16rpx;
  background: $gz-surface;
  border: 1rpx solid $gz-line;
  border-radius: $gz-radius-md;
}

.line__dot {
  flex: none;
  margin-top: 10rpx;
  width: 16rpx;
  height: 16rpx;
  border-radius: 50%;
  background: $gz-line;
}

.line__dot.is-greet {
  background: #6d8b3f;
}

.line__dot.is-guard {
  background: #c4602e;
}

.line__dot.is-remind {
  background: #9c8ac4;
}

.line__dot.is-meet {
  background: #4e8fd4;
}

.line__body {
  flex: 1;
  min-width: 0;
}

.line__text {
  display: block;
  font-size: $gz-fs-body;
  line-height: 1.7;
  color: $gz-ink;
}

.line__meta {
  display: block;
  margin-top: 6rpx;
  font-size: $gz-fs-caption;
  color: $gz-ink-3;
}

.line__fav {
  flex: none;
  width: 56rpx;
  height: 56rpx;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 50%;
  font-size: 32rpx;
  color: $gz-ink-3;
  border: 1rpx solid $gz-line;
}

.line__fav.is-on {
  color: #c4602e;
  border-color: #c4602e;
  background: rgba(196, 96, 46, 0.08);
}

/* ---- 箴言墙 ---- */
.fav {
  display: flex;
  align-items: flex-start;
  gap: 12rpx;
  padding: 24rpx 26rpx;
  margin-bottom: 16rpx;
  background: $gz-surface;
  border: 1rpx solid $gz-line;
  border-radius: $gz-radius-md;
}

.fav__mark {
  flex: none;
  color: $gz-accent;
  font-size: 44rpx;
  line-height: 1;
}

.fav__body {
  flex: 1;
  min-width: 0;
}

.fav__text {
  display: block;
  font-size: $gz-fs-body;
  line-height: 1.7;
  color: $gz-ink;
}

.fav__meta {
  display: block;
  margin-top: 8rpx;
  font-size: $gz-fs-caption;
  color: $gz-ink-3;
}

.fav__acts {
  flex: none;
  display: flex;
  flex-direction: column;
  gap: 10rpx;
}

.fav__btn {
  padding: 6rpx 18rpx;
  border-radius: 999rpx;
  background: $gz-accent-soft;
  color: $gz-accent;
  font-size: $gz-fs-caption;
}

.fav__btn--off {
  background: transparent;
  border: 1rpx solid $gz-line;
  color: $gz-ink-3;
}

/* ---- 空态 ---- */
.empty {
  padding: 70rpx 40rpx;
  text-align: center;
  background: $gz-surface;
  border: 1rpx dashed $gz-line;
  border-radius: $gz-radius-lg;
}

.empty__title {
  display: block;
  font-size: $gz-fs-title;
  font-weight: 700;
  color: $gz-ink-2;
}

.empty__text {
  display: block;
  margin-top: 12rpx;
  font-size: $gz-fs-small;
  line-height: 1.8;
  color: $gz-ink-3;
}

.foot {
  padding: 40rpx 0 10rpx;
  text-align: center;
}

.foot__text {
  font-size: $gz-fs-caption;
  letter-spacing: 0.1em;
  color: $gz-ink-3;
}
</style>

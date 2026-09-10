<template>
  <view class="page" :class="skinClass">
    <!-- 大厅头：模式化状态栏 -->
    <view class="hall-head">
      <view class="hall-head__row">
        <text class="hall-head__mark">观</text>
        <text class="hall-head__en">INSIGHT · 观事 → 观理 → 观道</text>
      </view>
      <text class="hall-head__state">{{ stateText }}</text>
    </view>

    <!-- 当前修行语言横幅：与模式选择卡同套艺术画，随皮肤更换 -->
    <view class="hero">
      <image v-if="modeStore.art" class="hero__art" :src="modeStore.art" mode="aspectFill" />
      <view class="hero__veil" />
      <view class="hero__cap">
        <text class="hero__eyebrow">今日修行 · {{ modeMeta.label }} · {{ modeMeta.labelEn }}</text>
        <text class="hero__quote">{{ modeMeta.tagline }}</text>
      </view>
    </view>

    <!-- AI 极简报：今日三条 -->
    <view class="section">
      <view class="section__head">
        <text class="section__title">AI 极简报</text>
        <text class="section__badge">{{ briefs.length }}/{{ quota }} · 每日重置</text>
      </view>

      <view v-for="(brief, i) in briefs" :key="brief.title" class="brief">
        <view class="brief__tag-row">
          <text class="brief__tag">{{ brief.tag }}</text>
          <text class="brief__depth">观事</text>
        </view>
        <text class="brief__title">{{ brief.title }}</text>
        <text class="brief__digest">{{ brief.digest }}</text>
        <text class="brief__src">{{ brief.src }}</text>
        <!-- 顺手标一笔：喂给信息源质量榜 -->
        <view class="brief__vote">
          <template v-if="voted[i] === null">
            <text class="brief__ask">这条对你有用吗？</text>
            <view class="brief__opts">
              <view class="opt opt--yes" hover-class="gz-hover" @click="vote(i, true)">有用</view>
              <view class="opt opt--no" hover-class="gz-hover" @click="vote(i, false)">没用</view>
            </view>
          </template>
          <text v-else class="brief__voted">
            {{ voted[i] === 'y' ? '已记有用 · 来源口碑 +1' : '已记没用 · 来源口碑 −1' }}
          </text>
        </view>
      </view>
    </view>

    <!-- 信息配额 -->
    <view class="quota">
      <text class="quota__left">今日信息配额</text>
      <text class="quota__right">{{ quota - briefs.length }} 次深度阅读机会 · 用完即止</text>
    </view>

    <!-- 观理 / 观道 入口 -->
    <view class="section">
      <view class="section__head">
        <text class="section__title">更深的观察</text>
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

    <!-- 批次 D · 小枢全局浮层 -->
    <BuddyFloat />

    <!-- 远端提示层：公告 + 版本更新（纯下行配置，无用户数据） -->
    <RemoteNotice />
  </view>
</template>

<script setup lang="ts">
/**
 * 观 · 信息大厅：观事（发生了什么）→ 观理（意味着什么）→ 观道（底层逻辑）。
 * 批次 A：AI 极简报 mock + 状态栏随三模式切换文案；子页功能批次 B 起在分包落地。
 */
import { computed, ref } from 'vue'
import { onShow } from '@dcloudio/uni-app'
import { useModeStore } from '@/stores/mode'
import { useSkinClass } from '@/composables/useSkin'
import { syncTabBar } from '@/utils/skin'
import { getModeMeta } from '@/config/modes'
import { hallStatus } from '@/config/lexicon'
import { useReadLaterStore } from '@/stores/readLater'
import { useQualityStore } from '@/stores/quality'
import { useSeedStore } from '@/stores/seed'
import { poke } from '@/composables/useBuddy'
import { ROUTES } from '@/router/routes'
import type { RoutePath } from '@/router/routes'
import type { EntryBadge } from '@/components/EntryItem/EntryItem.vue'

const modeStore = useModeStore()
const skinClass = useSkinClass()
const readLater = useReadLaterStore()
const quality = useQualityStore()
const seed = useSeedStore()

/* tabBar 原生样式/图标只能在本类大厅页上同步；顺手清理超过 24h 的临时收藏 */
onShow(() => {
  /* 批次 D · 小枢：评估到点激励 / 入定到点提醒 */
  poke()
  syncTabBar(modeStore.id)
  const cleared = readLater.prune()
  if (cleared > 0) {
    uni.showToast({ title: `已自动清走 ${cleared} 条过期收藏`, icon: 'none' })
  }
})

const stateText = computed(() =>
  hallStatus('observe', modeStore.id, { read: briefs.length, quota }),
)

const modeMeta = computed(() => getModeMeta(modeStore.id))

const quota = 3

interface Brief {
  tag: string
  title: string
  digest: string
  src: string
}

/** mock 极简报（正式版由后端 AI 聚合生成） */
const briefs: Brief[] = [
  {
    tag: '认知',
    title: '收藏越多，记住越少：数字囤积的代价',
    digest: '研究显示，"先收藏以后再看"的内容最终再读率不足两成。收藏不是学习，只是缓解了怕错过的焦虑。',
    src: '观止研究 · 今天 07:30',
  },
  {
    tag: '心理',
    title: '刷屏戒断 72 小时后，发生了什么',
    digest: '一篇行为实验记录：短暂脱离信息流后，多数参与者报告专注力回升、睡前焦虑下降。戒断不是失去，而是拿回。',
    src: '专注实验室 · 今天 08:10',
  },
  {
    tag: '工作流',
    title: '从"吃灰笔记"到"第二大脑"的距离',
    digest: '笔记工具层出不穷，但真正拉开差距的不是工具，而是"转述—重构—内化"的加工深度。收藏决定广度，加工决定深度。',
    src: '知识工作周报 · 今天 08:40',
  },
]

interface MoreEntry {
  mark: string
  title: string
  subtitle: string
  badge: EntryBadge
  /** 已落地的子页跳转目标；缺省不跳 */
  url?: RoutePath
  /** 筹备中入口置灰；缺省即可点 */
  disabled?: boolean
}

/** 单条简报的来源名（简报 src 形如「观止研究 · 今天 07:30」） */
function sourceOf(brief: Brief): string {
  return brief.src.split(' · ')[0]
}

/** 本日简报标注态：null 未标 / y 有用 / n 没用（会话级，质量数据落盘） */
const voted = ref<(null | 'y' | 'n')[]>(briefs.map(() => null))

function vote(i: number, useful: boolean): void {
  if (voted.value[i] !== null) return
  voted.value[i] = useful ? 'y' : 'n'
  quality.mark(sourceOf(briefs[i]), useful)
}

/** 已被标注过的来源数（质量榜入榜数） */
const ratedSources = computed(() => quality.sources.filter((s) => s.useful + s.useless > 0).length)
/** 仍在生长的种子数 */
const seeding = computed(() => seed.seeds.filter((s) => !s.harvestAt).length)

/** 更深的观察：质量榜/稍后读/概念播种均为真实子页，badge 显示实时状态 */
const moreEntries = computed<MoreEntry[]>(() => {
  const pending = readLater.items.length
  return [
    {
      mark: '理',
      title: '信息源质量榜',
      subtitle: '统计各来源历史有用率，留下真正值得读的少数',
      badge:
        ratedSources.value > 0
          ? { text: `${ratedSources.value} 源在榜`, tone: 'accent' }
          : { text: '读后标一笔', tone: 'muted' },
      url: ROUTES.observeQualityBoard,
    },
    {
      mark: '存',
      title: '稍后读 · 碎片回收',
      subtitle: '临时收藏，24 小时未读自动清理，不养"收藏夹僵尸"',
      badge: pending > 0 ? { text: `${pending} 待读`, tone: 'accent' } : { text: '24h 自清', tone: 'muted' },
      url: ROUTES.observeReadLater,
    },
    {
      mark: '道',
      title: '概念播种',
      subtitle: '把阅读中的闪光念头种下，让概念与概念之间长出新枝',
      badge:
        seeding.value > 0
          ? { text: `${seeding.value} 在种`, tone: 'accent' }
          : { text: '可播种', tone: 'muted' },
      url: ROUTES.observeSeedbed,
    },
  ]
})
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

/* 模式印章：随皮肤走主色 —— 修仙=朱砂印、科技=电光蓝、普通=橄榄 */
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
  line-height: 1;
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

/* 主屏横幅：三套艺术画之一，随模式切换；底部深色罩保证文字任何图上可读 */
.hero {
  position: relative;
  height: 250rpx;
  border-radius: $gz-radius-lg;
  overflow: hidden;
  box-shadow: 0 12rpx 32rpx rgba(20, 16, 10, 0.14);
  /* 无远程横幅图时的兜底底纹（有图时被 hero__art 完全盖住） */
  background: linear-gradient(150deg, rgba(148, 169, 108, 0.26) 0%, rgba(148, 169, 108, 0) 48%),
    linear-gradient(150deg, #474033 0%, #2a251e 55%, #1d1813 100%);
}

.hero__art {
  display: block;
  width: 100%;
  height: 100%;
}

.hero__veil {
  position: absolute;
  left: 0;
  right: 0;
  bottom: 0;
  height: 78%;
  background: linear-gradient(180deg, rgba(12, 10, 6, 0) 0%, rgba(12, 10, 6, 0.62) 100%);
}

.hero__cap {
  position: absolute;
  left: 30rpx;
  right: 30rpx;
  bottom: 22rpx;
  display: flex;
  flex-direction: column;
}

.hero__eyebrow {
  font-size: $gz-fs-caption;
  letter-spacing: 0.14em;
  color: rgba(255, 255, 255, 0.88);
}

.hero__quote {
  display: block;
  margin-top: 6rpx;
  font-size: 28rpx;
  line-height: 1.55;
  color: #ffffff;
}

.section {
  margin-top: 34rpx;
}

.section__head {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  margin-bottom: 20rpx;
}

.section__title {
  font-size: 32rpx;
  font-weight: 700;
  color: $gz-ink;
}

.section__badge {
  font-size: $gz-fs-caption;
  color: $gz-ink-3;
}

.brief {
  padding: 28rpx 28rpx 26rpx;
  background: $gz-surface;
  border: 1rpx solid $gz-line;
  border-radius: $gz-radius-md;
  margin-bottom: 20rpx;
}

.brief__tag-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.brief__tag {
  padding: 4rpx 14rpx;
  border-radius: 999rpx;
  background: $gz-accent-soft;
  color: $gz-accent;
  font-size: $gz-fs-caption;
}

.brief__depth {
  font-size: $gz-fs-caption;
  letter-spacing: 0.1em;
  color: $gz-ink-3;
}

.brief__title {
  display: block;
  margin-top: 16rpx;
  font-size: 32rpx;
  font-weight: 700;
  line-height: 1.5;
  color: $gz-ink;
}

.brief__digest {
  display: block;
  margin-top: 12rpx;
  font-size: $gz-fs-small;
  line-height: 1.8;
  color: $gz-ink-2;
}

.brief__src {
  display: block;
  margin-top: 14rpx;
  font-size: $gz-fs-caption;
  color: $gz-ink-3;
}

/* 简报顺手标注：喂给信息源质量榜 */
.brief__vote {
  margin-top: 20rpx;
  padding-top: 16rpx;
  border-top: 1rpx dashed $gz-line;
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.brief__ask {
  font-size: $gz-fs-caption;
  color: $gz-ink-3;
}

.brief__opts {
  display: flex;
  gap: 12rpx;
}

.opt {
  padding: 6rpx 24rpx;
  border-radius: 999rpx;
  font-size: $gz-fs-caption;
  border: 1rpx solid $gz-line;
  color: $gz-ink-3;
}

.opt--yes {
  color: $gz-accent;
  border-color: $gz-accent;
  background: $gz-accent-soft;
}

.brief__voted {
  font-size: $gz-fs-caption;
  color: $gz-ink-3;
}

.quota {
  margin-top: 8rpx;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 20rpx 26rpx;
  border: 1rpx dashed $gz-line;
  border-radius: $gz-radius-md;
}

.quota__left {
  font-size: $gz-fs-small;
  font-weight: 600;
  color: $gz-ink;
}

.quota__right {
  font-size: $gz-fs-caption;
  color: $gz-ink-3;
}

.entries {
  display: flex;
  flex-direction: column;
  gap: 18rpx;
}
</style>

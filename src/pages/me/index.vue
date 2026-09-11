<template>
  <view class="page" :class="skinClass">
    <!-- 大厅头 -->
    <view class="hall-head">
      <view class="hall-head__row">
        <text class="hall-head__mark">我</text>
        <text class="hall-head__en">MINE · 看见自己的成长全貌</text>
      </view>
    </view>

    <!-- 等级卡：修为 store 真实累计，三模式各 9 级、叫法随皮肤 -->
    <view class="rank">
      <view class="rank__row">
        <view>
          <text class="rank__mode">{{ modeMeta.label }}模式 · {{ modeMeta.growthName }}</text>
          <text class="rank__title">{{ lvName }} <text class="rank__lv">Lv.{{ lv }}</text></text>
        </view>
        <view class="rank__seal">{{ modeMeta.label.slice(0, 1) }}</view>
      </view>
      <view class="bar">
        <view class="bar__fill" :style="{ width: `${lvPct}%` }" />
      </view>
      <view class="rank__next">{{ nextHint }}</view>
    </view>

    <!-- 修行语言切换：三模式共用一套修行数据，只换「叫法 + 视觉」 -->
    <view class="lang" hover-class="gz-hover" @click="switchLanguage">
      <view class="lang__mark">言</view>
      <view class="lang__body">
        <text class="lang__title">修行语言 · 皮肤</text>
        <text class="lang__sub">
          当前「{{ modeMeta.label }}」· {{ modeMeta.assessmentName }} / {{ modeMeta.growthName }} /
          {{ modeMeta.companionName }}
        </text>
      </view>
      <view class="lang__dots">
        <view
          v-for="m in MODES"
          :key="m.id"
          class="lang__dot"
          :class="{ 'is-on': m.id === modeMeta.id }"
          :style="{ background: m.accent }"
        />
      </view>
    </view>

    <!-- 今日四维 -->
    <view class="section">
      <view class="section__head">
        <text class="section__title">今日四维</text>
        <text class="section__badge">观 · 止 · 知 · 行</text>
      </view>
      <view class="dims">
        <view v-for="dim in dims" :key="dim.label" class="dim">
          <view class="dim__row">
            <text class="dim__label">{{ dim.label }}</text>
            <text class="dim__value">{{ dim.value }}</text>
          </view>
          <view class="bar bar--mini">
            <view class="bar__fill" :style="{ width: `${dim.pct}%`, background: dim.color }" />
          </view>
        </view>
      </view>
    </view>

    <!-- 看板入口 -->
    <view class="section">
      <view class="section__head">
        <text class="section__title">修行档案</text>
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
          :disabled="!item.url"
        />
      </view>
    </view>

    <!-- 今日日课卡入口（批次 D） -->
    <view class="dailytip" hover-class="gz-hover" @click="openDailyCard">
      <view class="dailytip__body">
        <text class="dailytip__title">今日日课卡</text>
        <text class="dailytip__sub">每日一张 · 境界与四维 · 可转发给同道</text>
      </view>
      <text class="dailytip__go">→</text>
    </view>

    <!-- 底部 -->
    <view class="foot">
      <text class="foot__text">观止知行 · 数字修行</text>
      <text class="foot__text is-dim">InsightAction v{{ appStore.versionName }}</text>
    </view>

    <!-- 批次 D · 小枢全局浮层 -->
    <BuddyFloat />

    <!-- 远端提示层：公告 + 版本更新（纯下行配置，无用户数据） -->
    <RemoteNotice />
  </view>
</template>

<script setup lang="ts">
/**
 * 我 · 修行看板（批次 C 起真实接线）：
 * - 等级卡：修为 store 真实累计 → 三模式九级排行（LEVEL_THRESHOLDS），叫法随皮肤；
 * - 今日四维：观=今日辨源、止=今日静修、知=今日产出、行=今日三件事，全部读真实 store；
 * - 修行档案：测评建档 / 成就墙 / 活跃日历 / 痕迹时间轴 / 设置均为可进入的真实子页。
 */
import { computed } from 'vue'
import { onShow } from '@dcloudio/uni-app'
import { useAppStore } from '@/stores/app'
import { useModeStore } from '@/stores/mode'
import { useXpStore } from '@/stores/xp'
import { useAssessmentStore } from '@/stores/assessment'
import { useDailyStore, todayKey } from '@/stores/daily'
import { useFocusStore } from '@/stores/focus'
import { useTraceStore } from '@/stores/trace'
import { poke, openDailyCard, bondLv, bondXp } from '@/composables/useBuddy'
import { useSkinClass } from '@/composables/useSkin'
import { applySkin, syncTabBar } from '@/utils/skin'
import { tierIndex } from '@/config/assessment'
import { useContentStore } from '@/stores/content'
import { LEVEL_NAMES, LEVEL_THRESHOLDS, levelIndexFromXp, levelProgress } from '@/config/levels'
import { BADGE_RULES, unlockedCount } from '@/config/badges'
import { buildBadgeContext, dayStats, monthActiveCount } from '@/utils/growth'
import { MODES } from '@/config/modes'
import type { ModeId } from '@/config/modes'
import type { RoutePath } from '@/router/routes'
import { ROUTES } from '@/router/routes'
import type { EntryBadge } from '@/components/EntryItem/EntryItem.vue'

const appStore = useAppStore()
const modeStore = useModeStore()
const skinClass = useSkinClass()
const daily = useDailyStore()
const assessment = useAssessmentStore()
const contentStore = useContentStore()
const xp = useXpStore()
const focus = useFocusStore()
const trace = useTraceStore()

onShow(() => {
  daily.ensureToday()
  /* 批次 D · 小枢：评估到点激励 / 入定到点提醒 */
  poke()
  /* tabBar 原生样式/图标只能在本类大厅页上同步 */
  syncTabBar(modeStore.id)
})

/**
 * 切换修行语言（三模式）：产品约定——换皮肤绝不清数据，
 * 普通/科技/修仙共用同一份修行记录；如需清空当天进度，去「设置 → 重置今日三件事」。
 */
function switchLanguage(): void {
  uni.showActionSheet({
    itemList: MODES.map((m) => `${m.label} · ${m.labelEn}`),
    success: (res) => {
      const next: ModeId = MODES[res.tapIndex].id
      if (next === modeStore.id) return
      modeStore.setMode(next)
      applySkin(next)
      syncTabBar(next)
      uni.showToast({ title: `已切换：${MODES[res.tapIndex].label} · 修行数据保留`, icon: 'none' })
    },
    fail: () => {
      /* 用户取消 */
    },
  })
}

const modeMeta = computed(() => modeStore.meta)

/* —— 等级卡：修为 store 真实累计 → 三模式九级 —— */
const lvIndex = computed(() => levelIndexFromXp(xp.total))
const lv = computed(() => lvIndex.value + 1)
const lvName = computed(() => (LEVEL_NAMES[modeMeta.value.id] ?? LEVEL_NAMES.normal)[lvIndex.value] ?? '圆满')
const lvPct = computed(() => Math.round(levelProgress(xp.total) * 100))
const nextHint = computed(() => {
  const names = LEVEL_NAMES[modeMeta.value.id] ?? LEVEL_NAMES.normal
  const next = names[lvIndex.value + 1]
  const nextNeed = LEVEL_THRESHOLDS[lvIndex.value + 1]
  if (next === undefined || nextNeed === undefined) {
    return `已达「${lvName.value}」之巅 · 累计 ${xp.total} 点修为`
  }
  const remain = nextNeed - xp.total
  return `距「${next}」还差 ${remain} 点修为 · 累计 ${xp.total} 点`
})

/* —— 今日四维：观/止/知/行全部接真实 store（色值取「暗底也清晰」一档） —— */
const dims = computed(() => {
  const k = todayKey()
  const st = dayStats(k)
  const plan = Math.max(daily.planCount, 1)
  const focusGoal = Math.max(focus.dailyGoal, 1)
  /* 今日知识产出 = 新建卡片 + 今日拷问作答（答卡即时 Lv.3，未落库故并列计入） */
  const know = st.cards + (st.answered ? 1 : 0)
  return [
    { label: '观 · 辨源', value: `${st.marks} 次`, pct: Math.min(100, Math.round((st.marks / 5) * 100)), color: '#4E8FD4' },
    { label: '止 · 静修', value: `${st.focusMin} 分`, pct: Math.min(100, Math.round((st.focusMin / focusGoal) * 100)), color: '#84A268' },
    { label: '知 · 产出', value: `${know} 条`, pct: Math.min(100, Math.round((know / 3) * 100)), color: '#9C8AC4' },
    { label: '行 · 完成', value: `${daily.doneCount}/${plan} 件`, pct: Math.round((daily.doneCount / plan) * 100), color: '#C4602E' },
  ]
})

interface MoreEntry {
  mark: string
  title: string
  subtitle: string
  badge?: EntryBadge
  url?: RoutePath
}

/* 初始测评入口：已建档显示结果与重测倒计时，间隔 30 天 */
const assessmentEntry = computed<{ subtitle: string; badge: EntryBadge }>(() => {
  const r = assessment.get(modeMeta.value.id)
  if (!r) {
    return {
      subtitle: `做一次「${modeMeta.value.assessmentName}」建档，建立你的起点`,
      badge: { text: '待建档', tone: 'muted' },
    }
  }
  const bank = contentStore.bankOf(modeMeta.value.id)
  const tier = bank.tierNames[tierIndex(r.tier)]
  const d = new Date(r.takenAt)
  const date = `${d.getFullYear()}.${d.getMonth() + 1}.${d.getDate()}`
  const remain = assessment.retakeRemainDays(modeMeta.value.id)
  return {
    // 满分按当前题库题量算（题数可由远端内容运营位调整）
    subtitle: `${tier} · ${r.score}/${bank.questions.length * 3} 分 · ${date} 建档`,
    badge:
      remain > 0 ? { text: `${remain} 天后可重测`, tone: 'muted' } : { text: '可重测', tone: 'accent' },
  }
})

/* 成就 / 活跃天数 / 痕迹：同源真实计数，入口文案随之跳动 */
const badgeUnlocked = computed(() => unlockedCount(buildBadgeContext()))
const activeMonth = computed(() => {
  const now = new Date()
  return monthActiveCount(now.getFullYear(), now.getMonth())
})

/* 档案入口文案里的测评名随当前模式变化，故用 computed 保持即时刷新 */
const moreEntries = computed<MoreEntry[]>(() => [
  {
    mark: '测',
    title: '初始测评',
    subtitle: assessmentEntry.value.subtitle,
    badge: assessmentEntry.value.badge,
    url: ROUTES.entryAssessment,
  },
  {
    mark: '勋',
    title: '成就墙 · 徽章',
    subtitle: `已解锁 ${badgeUnlocked.value} / ${BADGE_RULES.length} 枚 · 每一枚都是一段真实的坚持`,
    badge: badgeUnlocked.value > 0 ? { text: `${badgeUnlocked.value}/${BADGE_RULES.length}`, tone: 'accent' } : undefined,
    url: ROUTES.meAchievements,
  },
  {
    mark: '历',
    title: '活跃日历',
    subtitle: '本月已活跃 ' + activeMonth.value + ' 天 · 每一天的投入都看得见',
    badge: activeMonth.value > 0 ? { text: `${activeMonth.value} 天`, tone: 'accent' } : undefined,
    url: ROUTES.meCalendar,
  },
  {
    mark: '时',
    title: '痕迹时间轴',
    subtitle: trace.traces.length > 0 ? `累计留下 ${trace.traces.length} 条痕迹 · 在真实世界的回响` : '从今天的第一件小事开始留痕',
    badge: trace.traces.length > 0 ? { text: `${trace.traces.length} 条`, tone: 'accent' } : undefined,
    url: ROUTES.meTimeline,
  },
  {
    mark: '羁',
    title: '小枢羁绊 · 对话录',
    subtitle: `与「${modeMeta.value.assistantName}」相见 ${bondXp.value} 次 · 对话与收藏的箴言都在这里`,
    badge:
      bondLv.value > 1
        ? { text: `Lv.${bondLv.value}`, tone: 'accent' }
        : { text: '初遇', tone: 'muted' },
    url: ROUTES.meBond,
  },
  {
    mark: '设',
    title: '设置',
    subtitle: '修行语言 · 提醒 · 数据 · 关于',
    badge: { text: '可用', tone: 'accent' },
    url: ROUTES.settings,
  },
])
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

/*
 * 等级卡：卡面/文字/进度全部走模式色板变量（--gz-rank-*），
 * 三套皮肤各自定义：普通=暖白纸卡+橄榄、科技=终端深卡+电光、修仙=宣纸+朱砂。
 * 切换模式即时换肤，无需模板差异。
 */
.rank {
  position: relative;
  overflow: hidden;
  padding: 34rpx 30rpx 30rpx;
  background: var(--gz-rank-bg);
  border: 1rpx solid var(--gz-rank-border);
  border-radius: $gz-radius-lg;
  box-shadow: var(--gz-rank-shadow);
  color: var(--gz-rank-ink);

  /* 顶缘一条模式色渐变带：一瞥即知当前皮肤 */
  &::before {
    content: '';
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    height: 6rpx;
    background: linear-gradient(90deg, var(--gz-accent), var(--gz-grad-to));
  }
}

.rank__row {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.rank__mode {
  display: block;
  font-size: $gz-fs-caption;
  letter-spacing: 0.14em;
  color: var(--gz-rank-sub);
}

.rank__title {
  display: block;
  margin-top: 10rpx;
  font-size: 44rpx;
  font-weight: 800;
  color: var(--gz-rank-ink);
}

.rank__lv {
  font-size: 26rpx;
  font-weight: 600;
  color: var(--gz-rank-sub);
}

.rank__seal {
  display: flex;
  align-items: center;
  justify-content: center;
  flex: none;
  width: 88rpx;
  height: 88rpx;
  background: var(--gz-accent-soft);
  border: 2rpx solid var(--gz-accent);
  border-radius: 20rpx;
  font-size: 40rpx;
  font-weight: 800;
  color: var(--gz-accent);
}

.rank .bar {
  margin-top: 28rpx;
  background: var(--gz-rank-track);
}

.rank .bar__fill {
  background: linear-gradient(90deg, var(--gz-accent), var(--gz-grad-to));
}

.rank__next {
  display: block;
  margin-top: 16rpx;
  font-size: $gz-fs-caption;
  color: var(--gz-rank-sub);
}

/* 修行语言切换行 */
.lang {
  display: flex;
  align-items: center;
  gap: 26rpx;
  margin-top: 22rpx;
  padding: 26rpx 28rpx;
  background: $gz-surface;
  border: 1rpx solid $gz-line;
  border-radius: $gz-radius-md;
}

.lang__mark {
  display: flex;
  align-items: center;
  justify-content: center;
  flex: none;
  width: 76rpx;
  height: 76rpx;
  border: 1rpx solid $gz-line;
  border-radius: 18rpx;
  background: $gz-paper;
  color: $gz-accent;
  font-size: 34rpx;
  font-weight: 600;
}

.lang__body {
  flex: 1;
  min-width: 0;
}

.lang__title {
  display: block;
  font-size: $gz-fs-title;
  font-weight: 600;
  color: $gz-ink;
}

.lang__sub {
  display: block;
  margin-top: 6rpx;
  font-size: $gz-fs-small;
  line-height: 1.6;
  color: $gz-ink-3;
}

/* 三种修行语言缩略色点：当前模式放大 + 主色光圈，点/不点都可整行点击切换 */
.lang__dots {
  flex: none;
  display: flex;
  align-items: center;
  gap: 14rpx;
  padding-left: 12rpx;
}

.lang__dot {
  width: 16rpx;
  height: 16rpx;
  border-radius: 50%;
  opacity: 0.35;
  transition: all 0.25s ease;
}

.lang__dot.is-on {
  width: 30rpx;
  height: 30rpx;
  opacity: 1;
  box-shadow: 0 0 0 6rpx $gz-accent-soft;
}

.section {
  margin-top: 36rpx;
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

.dims {
  padding: 10rpx 30rpx 24rpx;
  background: $gz-surface;
  border: 1rpx solid $gz-line;
  border-radius: $gz-radius-lg;
}

.dim {
  padding: 22rpx 0 6rpx;
}

.dim__row {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  margin-bottom: 12rpx;
}

.dim__label {
  font-size: $gz-fs-small;
  color: $gz-ink-2;
}

.dim__value {
  font-size: $gz-fs-small;
  font-weight: 700;
  color: $gz-ink;
}

.bar {
  height: 12rpx;
  border-radius: 999rpx;
  background: var(--gz-line-soft);
  overflow: hidden;
}

.bar__fill {
  height: 100%;
  border-radius: 999rpx;
  background: linear-gradient(90deg, $gz-accent, $gz-grad-to);
  transition: width 0.6s ease;
}

.bar--mini {
  height: 8rpx;
}

.entries {
  display: flex;
  flex-direction: column;
  gap: 18rpx;
}

/* 今日日课卡入口（批次 D） */
.dailytip {
  margin: 40rpx 0 8rpx;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16rpx;
  padding: 24rpx 26rpx;
  border-radius: $gz-radius-md;
  border: 1rpx solid $gz-accent;
  background: linear-gradient(135deg, $gz-accent-soft, transparent 72%);
}

.dailytip__body {
  display: flex;
  flex-direction: column;
  min-width: 0;
}

.dailytip__title {
  font-size: $gz-fs-body;
  font-weight: 800;
  letter-spacing: 0.04em;
  color: $gz-accent;
}

.dailytip__sub {
  margin-top: 6rpx;
  font-size: $gz-fs-caption;
  color: $gz-ink-3;
}

.dailytip__go {
  flex: none;
  font-size: 34rpx;
  color: $gz-accent;
}

.foot {
  margin-top: 56rpx;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8rpx;
  padding-bottom: 20rpx;
}

.foot__text {
  font-size: $gz-fs-caption;
  letter-spacing: 0.1em;
  color: $gz-ink-2;
}

.foot__text.is-dim {
  color: $gz-ink-3;
}
</style>

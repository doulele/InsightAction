<template>
  <view class="page" :class="skinClass">
    <!-- 顶栏 -->
    <view class="nav">
      <view class="nav__side" hover-class="gz-hover" @click="goBack">
        <text class="nav__back">‹</text>
      </view>
      <text class="nav__title">今日日课卡</text>
      <view class="nav__side" />
    </view>

    <!-- 日课卡主体：每日自动生成，数据真实 -->
    <view class="card">
      <view class="card__head">
        <view class="card__id">
          <text class="card__brand">观止知行 · 日课卡</text>
          <text class="card__date">{{ dateLabel }} · {{ weekday }}</text>
        </view>
        <view class="card__seal">{{ modeMeta.label.slice(0, 1) }}</view>
      </view>

      <!-- 等级/修为 -->
      <view class="lv">
        <view class="lv__row">
          <text class="lv__title">{{ lvName }} <text class="lv__num">Lv.{{ lv }}</text></text>
          <text class="lv__xp">累计修为 {{ xp.total }} 点</text>
        </view>
        <view class="bar">
          <view class="bar__fill" :style="{ width: `${lvPct}%` }" />
        </view>
        <text class="lv__next">{{ nextHint }}</text>
      </view>

      <!-- 今日四维 -->
      <view class="sec">
        <view class="sec__head">
          <text class="sec__title">今日四维</text>
          <text class="sec__hint">观 · 止 · 知 · 行</text>
        </view>
        <view class="dims">
          <view
            v-for="d in dims"
            :key="d.key"
            class="dim"
            :class="{ 'is-top': topKey === d.key }"
          >
            <view class="dim__row">
              <view class="dim__name">
                <text class="dim__label">{{ d.label }}</text>
                <text v-if="topKey === d.key" class="dim__star">今日之星</text>
              </view>
              <text class="dim__value">{{ d.value }}</text>
            </view>
          </view>
        </view>
      </view>

      <!-- 小枢评语 -->
      <view class="say">
        <text class="say__quote">「{{ comment }}」</text>
        <text class="say__from">—— {{ assistantName }} · {{ modeMeta.label }}</text>
      </view>

      <view class="card__foot">
        <text class="card__foot-text">观止知行 · 数字修行 · 每一天都有迹可循</text>
      </view>
    </view>

    <!-- 操作 -->
    <view class="acts">
      <button class="share" hover-class="gz-hover" open-type="share">转发给一位同道</button>
      <view class="copy" hover-class="gz-hover" @click="copyText">复制文字卡片</view>
    </view>
    <view class="acts__hint">把今日修行分享出去 · 数据属于你自己</view>

    <view class="foot">
      <text class="foot__text">日课卡 · 每天自动生成，只在今晚 23 点前属于今天</text>
    </view>
  </view>
</template>

<script setup lang="ts">
/**
 * 今日日课卡（批次 D · 分享）· 分包 subpkg-me。
 * 每日自动生成一张「今日修行卡片」：境界进度 + 今日四维 + 小枢评语。
 * - 转发：button open-type=share → onShareAppMessage 自定义标题；
 * - 复制：纯文本卡片贴进备忘录/长文；
 * - 图片版（canvas 导出保存相册）留待真机能力批次（需相册授权与 canvas2d 适配）。
 */
import { computed } from 'vue'
import { onShareAppMessage } from '@dcloudio/uni-app'
import { useModeStore } from '@/stores/mode'
import { useDailyStore, todayKey } from '@/stores/daily'
import { useXpStore } from '@/stores/xp'
import { dayStats } from '@/utils/growth'
import { levelIndexFromXp, levelProgress, levelName, LEVEL_NAMES, LEVEL_THRESHOLDS } from '@/config/levels'
import { useSkinClass } from '@/composables/useSkin'
import { ROUTES } from '@/router/routes'

const modeStore = useModeStore()
const daily = useDailyStore()
const xp = useXpStore()
const skinClass = useSkinClass()

/* 数据：单日真实快照（在页面每次进入时评估一次即可；跨天重进由 onShow 前的页面重建覆盖） */
const st = dayStats(todayKey())

const modeMeta = computed(() => modeStore.meta)
const assistantName = computed(() => modeStore.meta.assistantName)

const dateLabel = computed(() => {
  const k = st.date // YYYY-MM-DD
  const [y, m, d] = k.split('-')
  return `${y}.${m}.${d}`
})
const weekday = computed(() => {
  const w = ['周日', '周一', '周二', '周三', '周四', '周五', '周六']
  const d = new Date(`${st.date}T12:00:00`)
  return w[d.getDay()]
})

/* —— 境界 —— */
const lv = computed(() => levelIndexFromXp(xp.total) + 1)
const lvName = computed(() => levelName(modeStore.id, xp.total))
const lvPct = computed(() => Math.round(levelProgress(xp.total) * 100))
const nextHint = computed(() => {
  const idx = lv.value - 1
  const next = LEVEL_THRESHOLDS[idx + 1]
  if (next === undefined) return '已至圆满 · 修为仍随每一日累积'
  const need = next - xp.total
  return `距「${(LEVEL_NAMES[modeStore.id] ?? LEVEL_NAMES.normal)[idx + 1]}」还差 ${need} 点修为`
})

/* —— 今日四维 —— */
interface CardDim {
  key: 'observe' | 'pause' | 'reflect' | 'action'
  label: string
  value: string
  score: number
}
const dims = computed<CardDim[]>(() => {
  const done = daily.doneCount
  return [
    { key: 'observe', label: '观 · 辨源', value: `${st.marks} 次`, score: st.marks },
    { key: 'pause', label: '止 · 静修', value: `${st.focusMin} 分钟`, score: st.focusMin },
    { key: 'reflect', label: '知 · 产出', value: `${st.cards} 张卡片`, score: st.cards + (st.answered ? 1 : 0) },
    { key: 'action', label: '行 · 完成', value: `${done}/${daily.planCount || 3} 件`, score: done },
  ]
})

/** 今日最亮维度；全零则 null */
const topKey = computed<CardDim['key'] | null>(() => {
  const order: CardDim['key'][] = ['observe', 'pause', 'reflect', 'action']
  let best: CardDim['key'] | null = null
  let bestScore = 0
  for (const key of order) {
    const d = dims.value.find((it) => it.key === key)
    if (d && d.score > bestScore) {
      best = key
      bestScore = d.score
    }
  }
  return best
})

const litCount = computed(() => dims.value.filter((d) => d.score > 0).length)

/* —— 小枢评语（三模式口吻） —— */
const comment = computed(() => {
  const top = topKey.value
  const miss = dims.value.find((d) => d.key !== top && d.score === 0)

  const topName: Record<CardDim['key'], string> = {
    observe: '观',
    pause: '止',
    reflect: '知',
    action: '行',
  }

  if (litCount.value === 0) {
    if (modeStore.id === 'dao') return '今日未曾动功——明日晨起打坐一刻，便算起手。'
    if (modeStore.id === 'tech') return '今日数据为零：明天任意一次投入，即可破零。'
    return '今天是白的——明天从最小的一件开始，就有了颜色。'
  }

  const topDim = dims.value.find((d) => d.key === top) ?? dims.value[0]
  const lead =
    modeStore.id === 'dao'
      ? `今日主修「${topName[topDim.key]}」一道：${topDim.value}。`
      : modeStore.id === 'tech'
        ? `今日主变量：${topDim.label}，${topDim.value}，贡献度第一。`
        : `今天你在「${topName[topDim.key]}」上最用力：${topDim.value}。`

  if (miss) {
    const tail =
      modeStore.id === 'dao'
        ? `明日宜补「${miss.label}」一课的功课。`
        : modeStore.id === 'tech'
          ? `明日迭代建议：补足「${miss.label}」样本。`
          : `「${miss.label}」还空着，明天从它开始。`
    return `${lead}${tail}`
  }
  if (modeStore.id === 'dao') return `${lead}四道功课齐备，道心又稳一分。`
  if (modeStore.id === 'tech') return `${lead}四维样本完整，今日曲线健康。`
  return `${lead}观止知行走过一遍，今天没有辜负。`
})

/* —— 分享与复制 —— */
const shareTitle = computed(() => `今日日课卡 · ${dateLabel.value} —— ${modeStore.meta.growthName} ${lvName.value}`)

onShareAppMessage(() => ({
  title: shareTitle.value,
  path: ROUTES.meDailyCard,
}))

const textCard = computed(() => {
  const lines = [
    '观止知行 · 今日日课卡',
    `${dateLabel.value} · ${weekday.value}`,
    `${modeStore.meta.growthName}：${lvName.value} Lv.${lv.value} · 累计修为 ${xp.total} 点`,
    ...dims.value.map((d) => `  ${d.label}：${d.value}`),
    `今日之星：${topKey.value ? dims.value.find((d) => d.key === topKey.value)?.label ?? '' : '暂无'}`,
    `小枢评语：「${comment.value}」`,
    '—— 观止知行 · 数据属于你自己',
  ]
  return lines.join('\n')
})

function copyText(): void {
  uni.setClipboardData({
    data: textCard.value,
    success: () => uni.showToast({ title: '文字卡片已复制', icon: 'none' }),
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
  padding: calc(var(--status-bar-height) + 16rpx) $gz-page-pad 60rpx;
  box-sizing: border-box;
}

/* 顶栏 */
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

/* 卡片主体 */
.card {
  position: relative;
  overflow: hidden;
  margin-top: 10rpx;
  padding: 30rpx 30rpx 26rpx;
  background: $gz-surface;
  border: 1rpx solid $gz-line;
  border-radius: $gz-radius-lg;

  /* 模式顶缘色带（与等级卡同一语言） */
  &::before {
    content: '';
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    height: 8rpx;
    background: linear-gradient(90deg, $gz-accent, $gz-grad-to);
  }
}

.card__head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
}
.card__id {
  display: flex;
  flex-direction: column;
}
.card__brand {
  font-size: $gz-fs-body;
  font-weight: 800;
  letter-spacing: 0.1em;
  color: $gz-ink;
}
.card__date {
  margin-top: 4rpx;
  font-size: $gz-fs-caption;
  letter-spacing: 0.08em;
  color: $gz-ink-3;
}
.card__seal {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 72rpx;
  height: 72rpx;
  border: 3rpx solid $gz-accent;
  border-radius: 18rpx;
  color: $gz-accent;
  font-size: 40rpx;
  font-weight: 800;
  background: $gz-accent-soft;
}

/* 等级行 */
.lv {
  margin-top: 24rpx;
  padding: 22rpx 24rpx;
  border-radius: $gz-radius-md;
  background: $gz-surface-2;
}
.lv__row {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
}
.lv__title {
  font-size: 34rpx;
  font-weight: 800;
  color: $gz-ink;
}
.lv__num {
  margin-left: 10rpx;
  font-size: $gz-fs-caption;
  font-weight: 600;
  color: $gz-accent;
}
.lv__xp {
  font-size: $gz-fs-caption;
  color: $gz-ink-3;
}
.bar {
  margin-top: 16rpx;
  height: 12rpx;
  border-radius: 999rpx;
  background: $gz-line-soft;
  overflow: hidden;
}
.bar__fill {
  height: 100%;
  border-radius: 999rpx;
  background: linear-gradient(90deg, $gz-accent, $gz-grad-to);
  transition: width 0.4s ease;
}
.lv__next {
  display: block;
  margin-top: 10rpx;
  font-size: $gz-fs-caption;
  color: $gz-ink-3;
}

/* 四维 */
.sec {
  margin-top: 26rpx;
}
.sec__head {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  margin-bottom: 14rpx;
}
.sec__title {
  font-size: $gz-fs-title;
  font-weight: 800;
  color: $gz-ink;
}
.sec__hint {
  font-size: $gz-fs-caption;
  letter-spacing: 0.06em;
  color: $gz-ink-3;
}
.dims {
  display: flex;
  flex-direction: column;
  gap: 12rpx;
}
.dim {
  padding: 16rpx 20rpx;
  border-radius: $gz-radius-md;
  border: 1rpx solid $gz-line-soft;
  background: transparent;
  transition: border-color 0.2s ease, background 0.2s ease;
}
.dim.is-top {
  border-color: $gz-accent;
  background: $gz-accent-soft;
}
.dim__row {
  display: flex;
  align-items: center;
  justify-content: space-between;
}
.dim__name {
  display: flex;
  align-items: center;
  gap: 12rpx;
}
.dim__label {
  font-size: $gz-fs-body;
  font-weight: 600;
  color: $gz-ink;
}
.dim__star {
  padding: 2rpx 12rpx;
  border-radius: 999rpx;
  background: $gz-accent;
  color: $gz-on-cta;
  font-size: 20rpx;
  letter-spacing: 0.06em;
}
.dim__value {
  font-size: $gz-fs-body;
  font-weight: 800;
  color: $gz-ink-2;
  font-variant-numeric: tabular-nums;
}
.dim.is-top .dim__value {
  color: $gz-accent;
}

/* 评语 */
.say {
  margin-top: 26rpx;
  padding: 22rpx 24rpx;
  border-left: 6rpx solid $gz-accent;
  background: $gz-surface-2;
  border-radius: 0 $gz-radius-md $gz-radius-md 0;
}
.say__quote {
  display: block;
  font-size: $gz-fs-body;
  line-height: 1.9;
  color: $gz-ink-2;
}
.say__from {
  display: block;
  margin-top: 10rpx;
  font-size: $gz-fs-caption;
  letter-spacing: 0.06em;
  color: $gz-ink-3;
  text-align: right;
}

.card__foot {
  margin-top: 26rpx;
  padding-top: 18rpx;
  border-top: 1rpx dashed $gz-line;
  text-align: center;
}
.card__foot-text {
  font-size: $gz-fs-caption;
  letter-spacing: 0.06em;
  color: $gz-ink-3;
}

/* 操作 */
.acts {
  margin-top: 30rpx;
  display: flex;
  gap: 16rpx;
}
.share,
.copy {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  height: 88rpx;
  border-radius: $gz-radius-md;
  font-size: $gz-fs-body;
  font-weight: 700;
  letter-spacing: 0.04em;
}
.share {
  background: $gz-accent;
  color: $gz-on-cta;
  border: none;
  &::after {
    border: none;
  }
}
.copy {
  border: 1rpx solid $gz-line;
  background: $gz-surface;
  color: $gz-ink-2;
}
.acts__hint {
  margin-top: 14rpx;
  text-align: center;
  font-size: $gz-fs-caption;
  color: $gz-ink-3;
}

.foot {
  margin-top: 36rpx;
  display: flex;
  justify-content: center;
}
.foot__text {
  font-size: $gz-fs-caption;
  letter-spacing: 0.04em;
  color: $gz-ink-3;
}
</style>

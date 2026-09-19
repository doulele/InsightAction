<template>
  <view class="page" :class="skinClass">
    <!-- 顶栏 -->
    <view class="nav">
      <view class="nav__side" hover-class="gz-hover" @click="goBack">
        <text class="nav__back">‹</text>
      </view>
      <text class="nav__title">{{ year }} 年度回顾</text>
      <view class="nav__side" />
    </view>

    <!-- 头：一年里最该先看见的一个数 -->
    <view class="hero">
      <text class="hero__year">{{ year }}</text>
      <text class="hero__days">{{ s.activeDays }} <text class="hero__unit">天</text></text>
      <text class="hero__sub">今年你在观止知行留下过痕迹的天数</text>
      <text class="hero__say">「{{ comment }}」</text>
    </view>

    <!-- 空态：不硬凑一段"你的年度关键词是'坚持'"这种假话 -->
    <view v-if="s.activeDays === 0" class="empty">
      <text class="empty__text">今年这里还是空的。</text>
      <text class="empty__sub">不必等到一个像样的开始 —— 明天随便做一件，这页就有第一行了。</text>
    </view>

    <template v-else>
      <!-- 四环：走修为口径，与修行看板同一把尺子 -->
      <view class="card">
        <view class="card__head">
          <text class="card__title">四环</text>
          <text class="card__badge">修为 {{ s.xp }} 点</text>
        </view>
        <view v-for="h in hallRows" :key="h.key" class="hall">
          <text class="hall__label">{{ h.label }}</text>
          <view class="hall__bar">
            <view class="hall__fill" :style="{ width: `${h.pct}%`, background: h.color }" />
          </view>
          <text class="hall__value">{{ h.value }}</text>
        </view>
        <text class="card__note">口径是修为入账值，不是次数 —— 静修 30 分钟与随手一记不该同分。</text>
      </view>

      <!-- 一年下来的数 -->
      <view class="card">
        <text class="card__title">一年下来的数</text>
        <view class="grid">
          <view v-for="it in metrics" :key="it.label" class="grid__cell">
            <text class="grid__n">{{ it.value }}</text>
            <text class="grid__k">{{ it.label }}</text>
          </view>
        </view>
      </view>

      <!-- 今年记住的话 -->
      <view v-if="s.proverbs > 0" class="card">
        <view class="card__head">
          <text class="card__title">今年记住的话</text>
          <text class="card__badge">{{ s.proverbs }} 句</text>
        </view>
        <text v-if="s.proverbsEchoed > 0" class="meta">其中 {{ s.proverbsEchoed }} 句走完了 1·3·7 天回响</text>
        <view v-for="l in yearLines" :key="l.id" class="line">
          <text class="line__text">「{{ l.text }}」</text>
          <text v-if="l.from" class="line__from">—— {{ l.from }}</text>
        </view>
        <view v-if="s.topTags.length" class="tags">
          <text v-for="t in s.topTags" :key="t" class="tag">{{ t }}</text>
        </view>
        <text v-if="s.topTags.length" class="card__note">这些标签来自你反复留住的句子 —— 你在意什么，它们替你说了。</text>
      </view>

      <!-- 最投入的一天 -->
      <view v-if="bestDay" class="card">
        <text class="card__title">最投入的一天</text>
        <text class="best__date">{{ bestDay.date }}</text>
        <text class="best__desc">{{ bestText }}</text>
      </view>
    </template>

    <view v-if="s.activeDays > 0" class="acts">
      <button class="share" hover-class="gz-hover" open-type="share">转发这一年</button>
      <view class="copy" hover-class="gz-hover" @click="copyText">复制文字版</view>
    </view>

    <!-- 隐私授权拦截弹窗（复制回顾前需征得同意） -->
    <PrivacyGate />

    <view class="foot">
      <text class="foot__text">数据全部来自本机 · 换机未同步则不计入</text>
    </view>
  </view>
</template>

<script setup lang="ts">
/**
 * 年度回顾（分包 subpkg-me）：把一年的投入摊开给用户看一眼。
 *
 * 三条刻意的取舍：
 *  1. **只统计真实入账** —— 静修分钟、标注次数、卡片数、痕迹条数全部来自各 store，
 *     没有一项是"估算"或"补全"；数据不够就显示空态，不编造年度关键词；
 *  2. **只统计本机** —— 云同步属于 P2，这里在页脚如实说明"换机未同步则不计入"；
 *  3. **不做月度曲线 / 不做排名** —— 一年已经够长，回看只需要几个能记住的数。
 */
import { computed } from 'vue'
import { onShareAppMessage } from '@dcloudio/uni-app'
import { useModeStore } from '@/stores/mode'
import { useProverbStore } from '@/stores/proverb'
import { useSkinClass } from '@/composables/useSkin'
import { useDimLabel } from '@/composables/usePhrase'
import { dayStats, yearStats } from '@/utils/growth'
import { ROUTES } from '@/router/routes'

const modeStore = useModeStore()
const proverbs = useProverbStore()
const skinClass = useSkinClass()
const dl = useDimLabel()

const year = new Date().getFullYear()
/** 进页面时算一次即可（一次遍历，不是 365 次单日统计） */
const s = yearStats(year)

/* —— 四环 —— */
const HALL_COLOR: Record<'observe' | 'pause' | 'reflect' | 'action', string> = {
  observe: '#6D8B3F',
  pause: '#C4602E',
  reflect: '#4E8FD4',
  action: '#7AA0B2',
}
const hallRows = computed(() => {
  const keys = ['observe', 'pause', 'reflect', 'action'] as const
  const max = Math.max(1, ...keys.map((k) => s.halls[k]))
  return keys.map((k) => ({
    key: k,
    label: dl(k),
    value: s.halls[k],
    pct: Math.round((s.halls[k] / max) * 100),
    color: HALL_COLOR[k],
  }))
})

/* —— 明细：只放能一眼读懂的绝对数 —— */
const metrics = computed(() => [
  { label: '静修分钟', value: s.focusMin },
  { label: '观 · 收下与处理', value: `${s.obsN} 条` },
  { label: '知识卡片', value: `${s.cards} 张` },
  { label: '拷问作答', value: `${s.answerDays} 天` },
  { label: '习惯打卡', value: `${s.habitDone} 次` },
  { label: '痕迹', value: `${s.traces} 条` },
])

/* —— 今年记住的话：最多 3 句，取最近记住的 —— */
const yearLines = computed(() =>
  proverbs.items
    .filter((it) => new Date(it.createdAt).getFullYear() === year)
    .slice(0, 3)
    .map((it) => ({ id: it.id, text: it.text, from: it.from })),
)

/* —— 最投入的一天：当天明细现算一次（只有一天，不担心开销） —— */
const bestDay = computed(() => s.bestDay)
const bestText = computed(() => {
  const b = bestDay.value
  if (!b) return ''
  const d = dayStats(b.date)
  const parts: string[] = []
  if (d.focusMin > 0) parts.push(`静修 ${d.focusMin} 分钟`)
  if (d.obsN > 0) parts.push(`观 ${d.obsN} 条`)
  if (d.cards > 0) parts.push(`写了 ${d.cards} 张卡`)
  if (d.traces > 0) parts.push(`留下 ${d.traces} 条痕迹`)
  if (d.answered) parts.push('答了今天的拷问')
  const body = parts.length ? parts.join('、') : '那天做的事没留下细账'
  return `${body} · 入账 ${b.value} 点修为`
})

/* —— 评语（三模式口吻） —— */
const comment = computed(() => {
  if (s.activeDays === 0) return '空白的一年也是一年 —— 知道自己没动，比假装动过强。'
  const tail =
    modeStore.id === 'dao'
      ? `${s.activeDays} 日有动功，道不虚行。`
      : modeStore.id === 'tech'
        ? `${s.activeDays} 天有样本入账，曲线有效。`
        : `${s.activeDays} 天，你确实来过。`
  if (s.activeDays >= 200) return `${tail}这一年你几乎没断过。`
  if (s.activeDays >= 100) return `${tail}断过，也回来了 —— 这才是常态。`
  return `${tail}不多，但每一笔都是真的。`
})

/* —— 分享与复制 —— */
onShareAppMessage(() => ({
  title: `${year} 年度回顾 · ${s.activeDays} 天 · 修为 ${s.xp} 点`,
  path: ROUTES.meReview,
}))

const textCard = computed(() =>
  [
    `观止知行 · ${year} 年度回顾`,
    `有痕迹的天数：${s.activeDays} 天`,
    `累计修为：${s.xp} 点`,
    ...hallRows.value.map((h) => `  ${h.label}：${h.value}`),
    ...metrics.value.map((m) => `  ${m.label}：${m.value}`),
    s.proverbs > 0 ? `今年记住 ${s.proverbs} 句话，${s.proverbsEchoed} 句走完回响` : '',
    bestDay.value ? `最投入的一天：${bestDay.value.date}（${bestText.value}）` : '',
    '—— 观止知行 · 数据属于你自己',
  ]
    .filter(Boolean)
    .join('\n'),
)

function copyText(): void {
  uni.setClipboardData({
    data: textCard.value,
    success: () => uni.showToast({ title: '年度回顾已复制', icon: 'none' }),
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
@import './index.scss';
</style>

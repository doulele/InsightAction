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

      <!-- 今日箴言：有到期回响就带那一句，否则带最近记住的一句；一句都没有就不出现 -->
      <view v-if="proverbLine" class="prov">
        <text class="prov__label">{{ proverbLabel }}</text>
        <text class="prov__text">「{{ proverbLine.text }}」</text>
        <text v-if="proverbLine.from" class="prov__from">—— {{ proverbLine.from }}</text>
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

    <!-- 隐私授权拦截弹窗（复制日课卡前需征得同意） -->
    <PrivacyGate />

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
import { REVIEW_DAYS, useProverbStore, type ProverbItem } from '@/stores/proverb'
import { dayStats } from '@/utils/growth'
import { levelIndexFromXp, levelProgress, levelName, LEVEL_NAMES, LEVEL_THRESHOLDS } from '@/config/levels'
import { useSkinClass } from '@/composables/useSkin'
import { ROUTES } from '@/router/routes'
import { useDimLabel } from '@/composables/usePhrase'

const modeStore = useModeStore()
const daily = useDailyStore()
const xp = useXpStore()
const skinClass = useSkinClass()
/** 四维标签（日课卡是转发出去的，说法必须和站内一致） */
const dl = useDimLabel()

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
const lv = computed(() => levelIndexFromXp(xp.levelXp) + 1)
const lvName = computed(() => levelName(modeStore.id, xp.levelXp))
const lvPct = computed(() => Math.round(levelProgress(xp.levelXp) * 100))
const nextHint = computed(() => {
  const idx = lv.value - 1
  const next = LEVEL_THRESHOLDS[idx + 1]
  if (next === undefined) return '已至圆满 · 修为仍随每一日累积'
  const need = next - xp.levelXp
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
    { key: 'observe', label: dl('observe'), value: `${st.marks} 次`, score: st.marks },
    { key: 'pause', label: dl('pause'), value: `${st.focusMin} 分钟`, score: st.focusMin },
    { key: 'reflect', label: dl('reflect'), value: `${st.cards} 张卡片`, score: st.cards + (st.answered ? 1 : 0) },
    { key: 'action', label: dl('action'), value: `${done}/${daily.planCount || 3} 件`, score: done },
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

/* —— 今日箴言 —— */
const proverbs = useProverbStore()

/**
 * 日课卡上带哪一句：优先今天到期回响的那句（它今天本来就该再见一次），
 * 否则带最近记住的一句。一句都没记住就整块不出现 —— 不硬凑一句充数。
 */
const proverbLine = computed<ProverbItem | null>(() => proverbs.dueReviews[0] ?? proverbs.items[0] ?? null)
const proverbLabel = computed(() => {
  const due = proverbs.dueReviews[0]
  if (!proverbLine.value) return ''
  return due ? `今日回响 · 第 ${Math.min(due.reviewCount + 1, REVIEW_DAYS.length)} 次见面` : '你记住的这句'
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
    ...(proverbLine.value
      ? [
          `${proverbLabel.value}：「${proverbLine.value.text}」${
            proverbLine.value.from ? ` —— ${proverbLine.value.from}` : ''
          }`,
        ]
      : []),
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
@import './index.scss';
</style>

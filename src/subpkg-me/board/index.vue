<template>
  <view class="page" :class="skinClass">
    <view class="nav">
      <view class="nav__side" hover-class="gz-hover" @click="goBack">
        <text class="nav__back">‹</text>
      </view>
      <text class="nav__title">修行看板</text>
      <view class="nav__side" />
    </view>

    <!-- 四维雷达 -->
    <view class="card">
      <view class="card__head">
        <text class="card__title">今日四维</text>
        <text class="card__badge">{{ litCount }}/4 点亮</text>
      </view>
      <view class="radar-wrap">
        <canvas canvas-id="radar" id="radar" class="radar" :style="canvasStyle" />
      </view>
      <view class="legend">
        <view v-for="d in dims" :key="d.key" class="legend__item">
          <view class="legend__dot" :style="{ background: d.on ? d.color : 'transparent', borderColor: d.color }" />
          <text class="legend__label">{{ d.label }}</text>
          <text class="legend__value">{{ d.value }}</text>
        </view>
      </view>
      <text class="card__note">
        口径是修为入账值，不是次数 —— 静修 30 分钟与读一条都算「一次」的话，雷达会骗人。
      </text>
    </view>

    <!-- 认知深度分布 -->
    <view class="card">
      <view class="card__head">
        <text class="card__title">认知深度分布</text>
        <text class="card__badge">{{ knowledge.cards.length }} 张</text>
      </view>

      <template v-if="knowledge.cards.length">
        <view class="stack">
          <view
            v-for="s in depthDist"
            :key="s.depth"
            class="stack__seg"
            :style="{ width: `${s.pct}%`, background: s.color }"
          />
        </view>
        <view class="dl">
          <view v-for="s in depthDist" :key="s.depth" class="dl__row">
            <view class="dl__dot" :style="{ background: s.color }" />
            <text class="dl__label">{{ s.label }}</text>
            <text class="dl__n">{{ s.count }} 张 · {{ s.pct }}%</text>
          </view>
        </view>
        <text class="card__note">{{ depthNote }}</text>
      </template>
      <text v-else class="empty">还没有卡片。从今天的灵魂拷问写起，或在观里记一笔。</text>
    </view>

    <!-- 知 → 行 转化率 -->
    <view class="card">
      <view class="card__head">
        <text class="card__title">知 → 行 转化率</text>
        <text class="card__badge">本周</text>
      </view>
      <view class="big">
        <text class="big__n">{{ conversion.pct }}<text class="big__unit">%</text></text>
        <text class="big__cap">{{ conversion.caption }}</text>
      </view>
      <view class="bar">
        <view class="bar__fill" :style="{ width: `${conversion.pct}%` }" />
      </view>
      <text class="card__note">{{ conversion.note }}</text>
    </view>

    <!-- 成长图谱 -->
    <view class="card">
      <view class="card__head">
        <text class="card__title">成长图谱 · 走岔的地方</text>
        <text class="card__badge">{{ failures.length }} 笔</text>
      </view>
      <view v-if="failures.length" class="fails">
        <view v-for="f in failures" :key="f.key" class="fail">
          <text class="fail__when">{{ f.when }}</text>
          <text class="fail__text">{{ f.text }}</text>
        </view>
      </view>
      <text v-else class="empty">这段时间没有走岔的记录 —— 稳。</text>
      <text class="card__note">只记「破了 / 中断了 / 搁置了」，不做扣分，也不做红字催办。</text>

      <!-- 行为趋势：近 7 日痕迹数（柱高只为看形状，不标数值） -->
      <view class="trend">
        <view v-for="d in trend" :key="d.key" class="trend__col">
          <view class="trend__track">
            <view
              class="trend__fill"
              :class="{ 'is-cur': d.isToday }"
              :style="{ height: `${d.pct}%` }"
            />
          </view>
          <text class="trend__label" :class="{ 'is-cur': d.isToday }">{{ d.label }}</text>
        </view>
      </view>
    </view>

    <!-- ⑤ 信息食谱体检：本周各领域吃了什么（只摆形状，不下判断） -->
    <view class="card">
      <view class="card__head">
        <text class="card__title">信息食谱 · 本周吃了什么</text>
        <text class="card__badge">{{ diet.saved }} 条</text>
      </view>
      <template v-if="dietReady">
        <view class="stack">
          <view
            v-for="s in diet.slices"
            :key="s.topic"
            class="stack__seg"
            :style="{ width: `${s.pct}%`, background: s.color }"
          />
        </view>
        <view class="dl">
          <view v-for="s in diet.slices" :key="s.topic" class="dl__row">
            <view class="dl__dot" :style="{ background: s.color }" />
            <text class="dl__label">{{ s.topic }}</text>
            <text class="dl__n">{{ s.count }} 次 · {{ s.pct }}%</text>
          </view>
        </view>
      </template>
      <text class="card__note">{{ dietNote }}</text>
      <text v-if="dietReady" class="card__note">
        口径：本周存入的 {{ diet.saved }} 条；一条内容可属多个领域，故按命中次数计。
      </text>
    </view>
  </view>
</template>

<script setup lang="ts">
/**
 * 我 · 修行看板（分包 subpkg-me）—— 把「看不见的成长」摊开成四块：
 *   ① 四维雷达：观/止/知/行 的今日入账值（不是次数）；
 *   ② 认知深度分布：Lv.1 转述 / Lv.2 重构 / Lv.3 内化 各占多少；
 *   ③ 知 → 行 转化率：这周写了多少条，其中多少条真的用上了（reflect.apply）；
 *   ④ 成长图谱：走岔的地方（破誓 / 搁置）+ 近 7 日行为趋势。
 *
 * 全部读本地 store，无需后端；雷达用 canvas 画（小程序里没有 SVG）。
 * 样式外置在 board/index.scss（超过 100 行，按项目约定拆出）。
 */
import { computed, getCurrentInstance, onMounted, watch } from 'vue'
import { onReady, onShow } from '@dcloudio/uni-app'
import { useModeStore } from '@/stores/mode'
import { useTraceStore } from '@/stores/trace'
import { useKnowledgeStore, DEPTH_LABEL } from '@/stores/knowledge'
import { OBSERVE_TOPICS, useObserveStore } from '@/stores/observe'
import { useSkinClass } from '@/composables/useSkin'
import { getSkin } from '@/config/skins'
import { useDimLabel } from '@/composables/usePhrase'
import { todayKey } from '@/stores/daily'
import { ROUTES } from '@/router/routes'
import type { CardDepth } from '@/stores/knowledge'
import type { HallId } from '@/config/lexicon'

const mode = useModeStore()
const trace = useTraceStore()
const knowledge = useKnowledgeStore()
const observe = useObserveStore()
const skinClass = useSkinClass()
const dl = useDimLabel()

const today = todayKey()

/* ---------------- ① 四维雷达 ---------------- */
/** 雷达轴顺序：上 观 → 右 止 → 下 知 → 左 行 */
const HALLS: HallId[] = ['observe', 'pause', 'reflect', 'action']
const DIM_COLORS: Record<HallId, string> = {
  observe: '#4E8FD4',
  pause: '#84A268',
  reflect: '#9C8AC4',
  action: '#C4602E',
}

const dimValues = computed(() => HALLS.map((h) => trace.valueOn(today, h)))
const dims = computed(() =>
  HALLS.map((h, i) => ({
    key: h,
    label: dl(h),
    value: `${dimValues.value[i]} 点`,
    on: dimValues.value[i] > 0,
    color: DIM_COLORS[h],
  })),
)
const litCount = computed(() => dimValues.value.filter((v) => v > 0).length)

/* ---------------- ② 认知深度分布 ---------------- */
const depthDist = computed(() => {
  const total = knowledge.cards.length
  return ([1, 2, 3] as CardDepth[]).map((depth) => {
    const count = knowledge.cards.filter((c) => c.depth === depth).length
    return {
      depth,
      count,
      pct: total ? Math.round((count / total) * 100) : 0,
      label: DEPTH_LABEL[depth],
      color: depth === 1 ? '#84A268' : depth === 2 ? '#4E8FD4' : '#9C8AC4',
    }
  })
})

const depthNote = computed(() => {
  const deep = knowledge.cards.filter((c) => c.depth === 3).length
  if (!knowledge.cards.length) return ''
  if (deep === 0) return '还没有一张走到 Lv.3 —— 写下来只是转述，用上一次才算内化。'
  return `已有 ${deep} 张走到 Lv.3 内化：这些是真正改变了你做法的东西。`
})

/**
 * 本周一（YYYY-MM-DD）—— 转化率与信息食谱共用这一个「本周」口径。
 * 抽出来是因为两处各算一遍迟早会算成两个不同的周（一个按周一、一个按近 7 天）。
 */
const weekFrom = computed(() => {
  const d = new Date()
  const dow = (d.getDay() + 6) % 7
  d.setDate(d.getDate() - dow)
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
})

/* ---------------- ③ 知 → 行 转化率 ---------------- */
const conversion = computed(() => {
  const pad = (n: number) => String(n).padStart(2, '0')
  const from = weekFrom.value

  const cards = knowledge.cards.filter((c) => {
    const d = new Date(c.createdAt)
    const k = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
    return k >= from && k <= today
  }).length
  const applied = trace.between(from, today).filter((t) => t.kind === 'reflect.apply').length
  const pct = cards > 0 ? Math.min(100, Math.round((applied / cards) * 100)) : 0
  return {
    cards,
    applied,
    pct,
    caption: `${applied} / ${cards} 条用上了`,
    note:
      cards === 0
        ? '本周还没写卡片。先去「知」里写下一条，转化率才有分母。'
        : `本周写了 ${cards} 条，其中 ${applied} 条「我用上了」。转化率不是越高越好 —— 写十用一是常态，写十用零才是信号。`,
  }
})

/* ---------------- ④ 成长图谱 ---------------- */
interface Failure {
  key: string
  /** 发生时刻（排序用：破誓与搁置是两类事，必须按时间混排，不能按类型分段） */
  at: number
  when: string
  text: string
}

function fmtWhen(at: number): string {
  const d = new Date(at)
  return `${d.getMonth() + 1}/${d.getDate()}`
}

const failures = computed<Failure[]>(() => {
  const out: Failure[] = []
  // 破誓（立约）：只陈述事实，不写愧疚话术
  trace.list
    .filter((t) => t.kind === 'pause.vow.break')
    .slice(0, 20)
    .forEach((t) =>
      out.push({ key: `v-${t.id}`, at: t.at, when: fmtWhen(t.at), text: `破了一次誓愿 —— ${t.text}` }),
    )
  // 被搁置 / 收起的计划（归档走 logOnly，value 恒为 0）
  trace.list
    .filter((t) => t.kind === 'action.challenge' && t.value === 0 && !!t.ref && t.ref.startsWith('plan-'))
    .slice(0, 20)
    .forEach((t) => out.push({ key: `p-${t.id}`, at: t.at, when: fmtWhen(t.at), text: t.text }))
  // 按时间倒序：key 带 v-/p- 前缀，直接比字符串会把两类分成两段
  return out.sort((a, b) => b.at - a.at).slice(0, 12)
})

/** 近 7 日行为趋势：痕迹条数（看形状，不看绝对值） */
const trend = computed(() => {
  const rows: Array<{ key: string; label: string; count: number; isToday: boolean }> = []
  for (let i = 6; i >= 0; i--) {
    const d = new Date()
    d.setDate(d.getDate() - i)
    const pad = (n: number) => String(n).padStart(2, '0')
    const k = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
    rows.push({ key: k, label: i === 0 ? '今' : `${d.getDate()}`, count: trace.ofDay(k).length, isToday: i === 0 })
  }
  const max = Math.max(1, ...rows.map((r) => r.count))
  return rows.map((r) => ({ ...r, pct: Math.round((r.count / max) * 100) }))
})

/* ---------------- ⑤ 信息食谱体检（§4 反观 / §9.4） ---------------- */

/**
 * 样本下限：少于这个数就不给占比。
 * 一条内容就能算出「你这个星期 100% 在看心智」，这种数字除了吓人没有别的用处 ——
 * 所以宁可空着，等样本够了再下判断（规格 §17 也把「偏食口径」列为待真实数据验证的留白）。
 */
const DIET_MIN = 3

/** 六领域配色（与观厅领域划分一致，顺色排开便于对比） */
const TOPIC_COLORS = ['#4E8FD4', '#84A268', '#C4602E', '#9C8AC4', '#D4A24E', '#6FA9A0']

const diet = computed(() => {
  const items = observe.items.filter((it) => {
    const k = todayKey(new Date(it.createdAt))
    return k >= weekFrom.value && k <= today
  })

  // 一条内容可属多个领域 → 按命中次数计，故各领域占比之和就是 100%（分母是命中总数）
  const hits = new Map<string, number>()
  for (const it of items) {
    for (const t of it.topics ?? []) hits.set(t, (hits.get(t) ?? 0) + 1)
  }
  const total = [...hits.values()].reduce((a, b) => a + b, 0)

  const slices = OBSERVE_TOPICS.map((topic, i) => {
    const count = hits.get(topic) ?? 0
    return {
      topic,
      count,
      pct: total ? Math.round((count / total) * 100) : 0,
      color: TOPIC_COLORS[i % TOPIC_COLORS.length],
    }
  })
  const top = [...slices].sort((a, b) => b.count - a.count)[0]
  return { saved: items.length, total, slices, top, zero: slices.filter((s) => s.count === 0).map((s) => s.topic) }
})

/** 样本够了才谈形状 */
const dietReady = computed(() => diet.value.saved >= DIET_MIN)

/**
 * 结论只陈述事实，不做评价。
 * 「你偏食了」「建议多看点 XX」这类话本页一律不写 —— 看板负责把形状摆出来，
 * 判断留给看的人（这也是 §4 定「反观」而非「指导」的意思）。
 */
const dietNote = computed(() => {
  const d = diet.value
  if (!dietReady.value) {
    return `本周只存了 ${d.saved} 条，还看不出形状 —— 读到 ${DIET_MIN} 条以上，这里才会给占比。`
  }
  const zero = d.zero
  if (zero.length === OBSERVE_TOPICS.length) return '本周存的几条都还没标领域。'
  const bits: string[] = []
  if (d.top && d.top.pct >= 60) bits.push(`${d.top.topic} 占了 ${d.top.pct}%`)
  if (zero.length) bits.push(`${zero.join(' / ')} 一条没碰`)
  if (!bits.length) {
    return `六个领域都碰到了，最集中的是${d.top?.topic ?? '—'}（${d.top?.pct ?? 0}%）—— 这一周没有明显偏口。`
  }
  return `${bits.join('；')}。`
})

/* ---------------- 雷达绘制（canvas） ---------------- */
const SIZE = Math.min(260, Math.round(uni.getSystemInfoSync().windowWidth * 0.6))
const canvasStyle = computed(() => ({ width: `${SIZE}px`, height: `${SIZE}px` }))

/** 轴角度：从正上方开始，顺时针 90° 一个 */
const AXES = HALLS.map((_h, i) => -Math.PI / 2 + (i * Math.PI) / 2)

/** #RRGGBB + alpha → rgba() */
function withAlpha(hex: string, alpha: number): string {
  const v = hex.replace('#', '')
  const r = parseInt(v.slice(0, 2), 16)
  const g = parseInt(v.slice(2, 4), 16)
  const b = parseInt(v.slice(4, 6), 16)
  return `rgba(${r}, ${g}, ${b}, ${alpha})`
}

let ready = false

function drawRadar(): void {
  if (!ready) return
  const skin = getSkin(mode.id)
  const ctx = uni.createCanvasContext('radar', getCurrentInstance() ?? undefined)
  const cx = SIZE / 2
  const cy = SIZE / 2
  const R = SIZE / 2 - 26

  ctx.clearRect(0, 0, SIZE, SIZE)

  const pointAt = (i: number, ratio: number) => ({
    x: cx + R * ratio * Math.cos(AXES[i]),
    y: cy + R * ratio * Math.sin(AXES[i]),
  })

  // 四圈网格
  ctx.setLineWidth(1)
  ctx.setStrokeStyle(withAlpha(skin.ink, 0.12))
  for (let ring = 1; ring <= 4; ring++) {
    ctx.beginPath()
    for (let i = 0; i < 4; i++) {
      const p = pointAt(i, ring / 4)
      if (i === 0) ctx.moveTo(p.x, p.y)
      else ctx.lineTo(p.x, p.y)
    }
    ctx.closePath()
    ctx.stroke()
  }

  // 四条轴
  for (let i = 0; i < 4; i++) {
    const p = pointAt(i, 1)
    ctx.beginPath()
    ctx.moveTo(cx, cy)
    ctx.lineTo(p.x, p.y)
    ctx.stroke()
  }

  // 数据多边形：全部为 0 时给一个最小可见的形状，避免「什么都没画」的困惑
  const max = Math.max(...dimValues.value, 10)
  ctx.beginPath()
  for (let i = 0; i < 4; i++) {
    const ratio = Math.max(0.06, dimValues.value[i] / max)
    const p = pointAt(i, ratio)
    if (i === 0) ctx.moveTo(p.x, p.y)
    else ctx.lineTo(p.x, p.y)
  }
  ctx.closePath()
  ctx.setFillStyle(withAlpha(skin.accent, 0.22))
  ctx.fill()
  ctx.setStrokeStyle(skin.accent)
  ctx.setLineWidth(2)
  ctx.stroke()

  ctx.draw()
}

onReady(() => {
  // 小程序里 canvas 要等页面渲染完才拿得到上下文
  ready = true
  drawRadar()
})

onMounted(() => {
  drawRadar()
})

onShow(() => {
  drawRadar()
})

watch([dimValues, () => mode.id], () => {
  drawRadar()
})

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

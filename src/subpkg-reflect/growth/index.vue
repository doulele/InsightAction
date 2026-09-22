<template>
  <view class="page" :class="skinClass">
    <!-- 顶栏：返回 + 标题（子页统一样式） -->
        <SubNav :fallback="ROUTES.tabReflect">认知成长曲线</SubNav>

    <!-- 总览 -->
    <view class="overview">
      <view class="stat">
        <text class="stat__n">{{ total }}</text>
        <text class="stat__cap">累计沉淀</text>
      </view>
      <view class="stat">
        <text class="stat__n">{{ avgDepth.toFixed(1) }}</text>
        <text class="stat__cap">平均深度</text>
      </view>
      <view class="stat">
        <text class="stat__n">{{ lv3Pct }}%</text>
        <text class="stat__cap">内化占比</text>
      </view>
    </view>
    <text class="overview__note">
      深度：Lv.1 转述 → Lv.2 重构 → Lv.3 内化。曲线向上，说明你不再只是「看过」。
    </text>

    <!-- 近 8 周趋势 -->
    <view class="section">
      <view class="section__head">
        <text class="section__title">近 8 周沉淀</text>
        <view class="legend">
          <view class="legend__item"><view class="legend__dot is-1" /> Lv.1</view>
          <view class="legend__item"><view class="legend__dot is-2" /> Lv.2</view>
          <view class="legend__item"><view class="legend__dot is-3" /> Lv.3</view>
        </view>
      </view>

      <view v-if="!weeks.length" class="empty">
        <view class="empty__seal gz-motion">线</view>
        <text class="empty__title">{{ $p('empty.growth.title') }}</text>
        <text class="empty__desc">{{ $p('empty.growth.desc') }}</text>
      </view>
      <view v-else class="chart">
        <view v-for="(w, wi) in weeks" :key="w.label" class="row">
          <view class="row__label">
            <text class="row__name" :class="{ 'is-cur': wi === 0 }">{{ w.label }}</text>
            <text class="row__date">{{ w.range }}</text>
          </view>
          <view class="row__chart">
            <view class="row__bar">
              <view
                v-if="w.c1 > 0"
                class="row__seg is-1"
                :style="{ width: segWidth(w.c1, w.total) }"
              />
              <view
                v-if="w.c2 > 0"
                class="row__seg is-2"
                :style="{ width: segWidth(w.c2, w.total) }"
              />
              <view
                v-if="w.c3 > 0"
                class="row__seg is-3"
                :style="{ width: segWidth(w.c3, w.total) }"
              />
            </view>
            <text class="row__total">{{ w.total }}</text>
          </view>
        </view>
      </view>
      <text v-if="weeks.length" class="chart__note">
        每格为该周沉淀卡片数（含拷问作答）；色块按深度分层。当前周尚未走完。
      </text>
    </view>

    <view class="foot">
      <text class="foot__text">看见曲线，才知道自己在生长</text>
    </view>
  </view>
</template>

<script setup lang="ts">
/**
 * 认知成长曲线（批次 C）· 分包 subpkg-reflect。
 * 以自然周（周一始）聚合近 8 周的知识沉淀：卡片数按深度分层 + 每周拷问作答并入 Lv.3；
 * 总览卡给出累计数 / 平均深度 / Lv.3 占比。
 */
import { computed } from 'vue'
import { useKnowledgeStore } from '@/stores/knowledge'
import { useQuestionStore } from '@/stores/question'
import { useSkinClass } from '@/composables/useSkin'
import { ROUTES } from '@/router/routes'

const knowledge = useKnowledgeStore()
const question = useQuestionStore()
const skinClass = useSkinClass()

function pad(n: number): string {
  return String(n).padStart(2, '0')
}

function dayKey(d: Date): string {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

/** 周一 0 点 */
function mondayOf(d: Date): Date {
  const t = new Date(d)
  const dow = (t.getDay() + 6) % 7
  t.setDate(t.getDate() - dow)
  t.setHours(0, 0, 0, 0)
  return t
}

interface WeekRow {
  label: string
  range: string
  c1: number
  c2: number
  c3: number
  total: number
}

const weeks = computed<WeekRow[]>(() => {
  const now = new Date()
  const curMon = mondayOf(now)
  const out: WeekRow[] = []
  for (let i = 0; i < 8; i++) {
    const start = new Date(curMon.getTime() - i * 7 * 24 * 60 * 60 * 1000)
    const end = new Date(start.getTime() + 7 * 24 * 60 * 60 * 1000)
    const startKey = dayKey(start)
    const endKey = dayKey(end) // 开区间用
    const inRange = (createdAt: number) => {
      const k = dayKey(new Date(createdAt))
      return k >= startKey && k < endKey
    }
    const arr = knowledge.cards.filter((c) => inRange(c.createdAt))
    let c1 = arr.filter((c) => c.depth === 1).length
    let c2 = arr.filter((c) => c.depth === 2).length
    let c3 = arr.filter((c) => c.depth === 3).length
    // 拷问作答也算一次沉淀，并入 Lv.3（遍历题期记录里本自然周已回答的）
    Object.entries(question.records).forEach(([key, rec]) => {
      if (rec.answer && key >= startKey && key < endKey) c3 += 1
    })
    const endDate = new Date(end.getTime() - 86400000)
    const row: WeekRow = {
      label: i === 0 ? '本周' : i === 1 ? '上周' : `${i} 周前`,
      range: `${start.getMonth() + 1}.${start.getDate()} - ${endDate.getMonth() + 1}.${endDate.getDate()}`,
      c1,
      c2,
      c3,
      total: c1 + c2 + c3,
    }
    out.push(row)
  }
  return out
})

/** 总览：累计沉淀 / 平均深度 / Lv.3 占比 */
const total = computed(() => knowledge.cards.length + countAnsweredAll())
const avgDepth = computed(() => {
  const sum =
    knowledge.cards.reduce((s, c) => s + c.depth, 0) + countAnsweredAll() * 3
  const n = knowledge.cards.length + countAnsweredAll()
  return n > 0 ? sum / n : 0
})
const lv3Pct = computed(() => {
  const n = knowledge.cards.length + countAnsweredAll()
  if (n === 0) return 0
  const lv3 =
    knowledge.cards.filter((c) => c.depth === 3).length + countAnsweredAll()
  return Math.round((lv3 / n) * 100)
})

function countAnsweredAll(): number {
  return Object.values(question.records).filter((r) => r.answer).length
}

/** 柱内色块宽度（%） */
function segWidth(part: number, all: number): string {
  if (!(all > 0)) return '0%'
  return `${Math.max(6, Math.round((part / all) * 100))}%`
}

</script>

<style lang="scss" scoped>
@import './index.scss';
</style>

<template>
  <view class="page" :class="skinClass">
    <!-- 顶栏 -->
    <view class="nav">
      <view class="nav__side" hover-class="gz-hover" @click="goBack">
        <text class="nav__back">‹</text>
      </view>
      <text class="nav__title">母题库</text>
      <view class="nav__side" />
    </view>

    <view class="intro">
      <text class="intro__text">
        母题不是学到的名词，是被同一件事绊倒很多次之后，才认出来的那个底层问题。
        写不出自己的，先从下面 12 个里认领一个。
      </text>
    </view>

    <view class="rule">
      <text class="rule__text">一个母题下挂满三五条理，才叫看清了它</text>
      <text class="rule__num">{{ mothers.length }} 个 · 共 {{ childrenTotal }} 条</text>
    </view>

    <!-- 理道图谱（§15.4）：理与母题连起来是什么样，进图谱看全景 -->
    <view class="graph-entry" hover-class="gz-hover" @click="goGraph">
      <text class="graph-entry__text">连起来是什么样 —— 理道图谱</text>
      <text class="graph-entry__go">›</text>
    </view>

    <!-- 我的母题 -->
    <!--
      §15.2 系统提示：同一标签攒够 3 条理就问一句。
      纯本地统计（按标签共现计数）。**刻意不做**语义相似度与自动归类 ——
      AI 归类一旦误判就会打乱用户自己建的关系，而"挂靠"本就是他自己该做的动作。
    -->
    <view v-if="tagHints.length" class="hint">
      <view v-for="h in tagHints" :key="h.tag" class="hint__row" hover-class="gz-hover" @click="promoteFromTag(h)">
        <text class="hint__text">你有 {{ h.count }} 条理都打了「{{ h.tag }}」这个标签，要提炼成一个母题吗？</text>
        <text class="hint__go">提炼 ›</text>
      </view>
    </view>

    <view v-if="!mothers.length" class="empty">
      <view class="empty__seal gz-motion">道</view>
      <text class="empty__title">还没有母题</text>
      <text class="empty__desc">认领一个预置母题，或去理库把某条理「提炼母题」。</text>
    </view>

    <view v-else class="list">
      <view v-for="m in mothers" :key="m.id" class="card">
        <view class="card__top">
          <text v-for="t in m.topics" :key="t" class="card__topic">{{ t }}</text>
          <text class="card__count" :class="{ 'is-thin': countOf(m.id) < 3 }">{{ countOf(m.id) }} 条</text>
          <!-- §15.2：挂满 3 条就算「长出来了」 -->
          <text v-if="countOf(m.id) >= 3" class="card__grown">长出来了</text>
        </view>

        <text class="card__name" hover-class="gz-hover" @click="toggle(m.id)">{{ m.title }}</text>
        <text class="card__line">{{ m.content }}</text>

        <!-- 挂靠的内容（展开） -->
        <view v-if="openId === m.id" class="kids">
          <view v-if="!kidsOf(m.id).length" class="kids__empty">
            还空着 —— 去理库把相关的理挂上来，或就这个母题写一条
          </view>
          <view v-for="k in kidsOf(m.id)" :key="k.id" class="kid">
            <text class="kid__kind">{{ k.kind === 'theory' ? '理' : '事' }}</text>
            <text class="kid__text">{{ k.title || k.content.slice(0, 24) }}</text>
            <text class="kid__x" hover-class="gz-hover" @click="detach(k.id)">解挂</text>
          </view>
        </view>

        <view class="ops">
          <text class="ops__state">{{ openId === m.id ? '收起' : '展开' }}</text>
          <view class="ops__right">
            <text class="ops__btn" hover-class="gz-hover" @click="drop(m.id)">删</text>
            <text class="ops__btn" hover-class="gz-hover" @click="writeFor(m)">写一笔</text>
            <text class="ops__btn ops__btn--main" hover-class="gz-hover" @click="attachTo(m.id)">挂靠</text>
          </view>
        </view>
      </view>
    </view>

    <!-- 预置母题 -->
    <view class="section">
      <text class="section__title">12 个常见的母题</text>
      <view class="presets">
        <view v-for="p in PRESET_MOTHERS" :key="p.id" class="preset" :class="{ 'is-taken': taken(p.name) }">
          <view class="preset__top">
            <text class="preset__topic">{{ p.topic }}</text>
            <text v-if="taken(p.name)" class="preset__taken">已收下</text>
          </view>
          <text class="preset__name">{{ p.name }}</text>
          <text class="preset__line">{{ p.line }}</text>
          <view v-if="!taken(p.name)" class="preset__cta" hover-class="gz-hover" @click="adopt(p)">收下 +</view>
        </view>
      </view>
    </view>

    <view class="foot">
      <text class="foot__text">理是认定的 · 道是甩不掉的</text>
    </view>

    <GzDialog
      variant="danger"
      :show="!!dropTarget"
      title="删掉这个母题？"
      :content="dropHint"
      confirm-text="删"
      cancel-text="留着"
      @cancel="dropTarget = null"
      @confirm="dropConfirm"
    />
  </view>
</template>

<script setup lang="ts">
/**
 * 观 · 母题库 —— 「道」这一层的展示层（批次 E 收尾）。
 *
 * 设计取舍：
 *  - **不新开 store**：母题就是 observe 里 kind='mother' 的条目，预置只是"样本"，
 *    认领后变成一条普通的母题条目。避免"预置库 / 我的库"两套数据结构互相打架；
 *  - **认领不入账**：别人写好的问题不算功夫，挂上第一条自己的内容才算；
 *  - **删母题要先解挂**：直接删会留下一堆指向空 id 的内容（脏引用），
 *    所以删之前把挂靠内容的 motherId 全部清掉，它们退回理库，不会消失。
 */
import { computed, ref } from 'vue'
import GzDialog from '@/components/GzDialog/GzDialog.vue'
import { PRESET_MOTHERS, type PresetMother } from '@/config/mothers'
import { useObserveStore, type ObsItem } from '@/stores/observe'
import { useSkinClass } from '@/composables/useSkin'
import { navigateTo, ROUTES } from '@/router/routes'

const observe = useObserveStore()
const skinClass = useSkinClass()

const mothers = computed(() => observe.mothers)
/** 当前展开的母题 id */
const openId = ref('')

const childrenTotal = computed(() => mothers.value.reduce((n, m) => n + countOf(m.id), 0))

function kidsOf(id: string): ObsItem[] {
  return observe.childrenOf(id)
}

function countOf(id: string): number {
  return observe.childrenOf(id).length
}

function toggle(id: string): void {
  openId.value = openId.value === id ? '' : id
}

/** 理道图谱：本页按母题列，图谱按「关系」列 —— 同一份数据的第三个切面 */
function goGraph(): void {
  navigateTo(ROUTES.observeGraph)
}

function taken(name: string): boolean {
  return mothers.value.some((m) => m.title === name)
}

/** §15.2 标签共现的候选：同一个标签下攒够 3 条理，且这个标签还没成为母题 */
interface TagHint {
  tag: string
  count: number
}

const tagHints = computed<TagHint[]>(() => {
  const counts = new Map<string, number>()
  for (const it of observe.theories) {
    for (const tag of it.tags) counts.set(tag, (counts.get(tag) ?? 0) + 1)
  }
  const names = new Set(mothers.value.map((m) => m.title))
  return [...counts.entries()]
    .filter(([tag, n]) => n >= 3 && !names.has(tag))
    .map(([tag, count]) => ({ tag, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 2)
})

/**
 * 就着提示提炼一个母题：名字可预填标签名（省一步），
 * 之后问一句要不要把同标签的理一起挂上 —— 规格 §15.3 原本是「勾选要挂的理」，
 * 这里换成一次确认：多选那一步在手机上太重，而多数情况用户就是想全挂。
 */
function promoteFromTag(h: TagHint): void {
  uni.showModal({
    title: '提炼成一个母题',
    content: `你有 ${h.count} 条理都打了「${h.tag}」这个标签。给它一个名字 —— 问句最好。`,
    editable: true,
    placeholderText: '如：什么才算够了',
    confirmText: '提炼',
    cancelText: '再等等',
    success: (res) => {
      if (!res.confirm) return
      const name = ((res as { content?: string }).content ?? '').trim() || h.tag
      const seed = observe.theories.find((i) => i.tags.includes(h.tag))
      if (!seed) return
      const item = observe.promoteToMother(seed.id, name, `${h.tag}：${h.count} 条理都指向它`)
      if (!item) {
        uni.showToast({ title: '没提炼成 · 先在理库处理一条', icon: 'none' })
        return
      }
      const others = observe.theories.filter((i) => i.id !== seed.id && i.tags.includes(h.tag) && !i.motherId)
      if (!others.length) {
        uni.showToast({ title: '已提炼 · 收下这 20 点修为', icon: 'none' })
        return
      }
      uni.showModal({
        title: '顺手挂上？',
        content: `还有 ${others.length} 条理也打了「${h.tag}」，要一起挂到「${name}」下吗？`,
        confirmText: '一起挂',
        cancelText: '不用',
        success: (r) => {
          if (!r.confirm) return
          for (const i of others) observe.attachMother(i.id, item.id)
          uni.showToast({ title: `已挂上 ${others.length} 条`, icon: 'none' })
        },
      })
    },
  })
}

/** 认领预置母题：先让他写下自己的第一笔，空着也能收下（用预置那句垫底） */
function adopt(p: PresetMother): void {
  uni.showModal({
    title: p.name,
    content: p.probe,
    editable: true,
    placeholderText: '写下你自己的第一笔（可留空）',
    confirmText: '收下',
    cancelText: '再想想',
    success: (res) => {
      if (!res.confirm) return
      const mine = ((res as { content?: string }).content ?? '').trim()
      const item = observe.adoptPreset({
        name: p.name,
        topics: [p.topic],
        content: mine ? `${p.line}\n${mine}` : p.line,
      })
      if (!item) {
        uni.showToast({ title: '收件满了，先去处理几条', icon: 'none' })
        return
      }
      uni.showToast({ title: '已收下 · 去挂上第一条内容', icon: 'none' })
    },
  })
}

/**
 * 挂靠：列出还没挂母题的理让用户挑。
 * 已经全挂满了就不装作有事可做 —— 提示去立新的理。
 */
function attachTo(motherId: string): void {
  const free = observe.theories.filter((i) => !i.motherId).slice(0, 8)
  if (!free.length) {
    uni.showModal({
      title: '没有可挂的理',
      content: '去理库立一条新理，或直接就这个母题写一笔？',
      confirmText: '写一笔',
      cancelText: '去理库',
      success: (res) => {
        if (res.confirm) writeFor(observe.find(motherId))
        else navigateTo(ROUTES.observeTheoryLib)
      },
    })
    return
  }
  uni.showActionSheet({
    itemList: free.map((i) => i.title || i.content.slice(0, 16)),
    success: (r) => {
      const target = free[r.tapIndex]
      if (!target) return
      observe.attachMother(target.id, motherId)
      openId.value = motherId
      uni.showToast({ title: '已挂上', icon: 'none' })
    },
  })
}

function detach(id: string): void {
  observe.attachMother(id, undefined)
}

/** 就这个母题写一笔：带好上下文跳到录入页（存成理，回来再挂） */
function writeFor(m?: ObsItem): void {
  if (!m) return
  navigateTo(ROUTES.observeCompose, {
    kind: 'theory',
    form: 'quote',
    title: m.title,
    tag: ['母题', ...m.topics].join(','),
  })
}

const dropTarget = ref<ObsItem | null>(null)
const dropHint = computed(() => {
  const m = dropTarget.value
  if (!m) return ''
  const n = countOf(m.id)
  return n
    ? `「${m.title}」下挂着的 ${n} 条会退回理库（内容不丢），母题本身不可找回。`
    : `「${m.title}」将不再出现，不可找回。`
})

function drop(id: string): void {
  dropTarget.value = observe.find(id) ?? null
}

function dropConfirm(): void {
  const m = dropTarget.value
  dropTarget.value = null
  if (!m) return
  // 先解挂再删：不留指向空 id 的脏引用
  for (const k of observe.childrenOf(m.id)) observe.attachMother(k.id, undefined)
  if (openId.value === m.id) openId.value = ''
  observe.remove(m.id)
  uni.showToast({ title: '已删', icon: 'none' })
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

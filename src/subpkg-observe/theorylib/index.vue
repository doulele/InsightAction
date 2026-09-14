<template>
  <view class="page" :class="skinClass">
    <!-- 顶栏 -->
    <view class="nav">
      <view class="nav__side" hover-class="gz-hover" @click="goBack">
        <text class="nav__back">‹</text>
      </view>
      <text class="nav__title">理库</text>
      <view class="nav__side nav__side--right" hover-class="gz-hover" @click="goCompose">
        <text class="nav__add">＋</text>
      </view>
    </view>

    <!-- 分区：理 / 播种 -->
    <view class="tabs">
      <view class="tab" :class="{ 'is-on': tab === 'theory' }" hover-class="gz-hover" @click="tab = 'theory'">
        我的理 {{ theories.length }}
      </view>
      <view class="tab" :class="{ 'is-on': tab === 'seed' }" hover-class="gz-hover" @click="tab = 'seed'">
        播种 {{ growing.length }}
      </view>
    </view>

    <!-- ================= 理 ================= -->
    <block v-if="tab === 'theory'">
      <input
        v-model="kw"
        class="search"
        placeholder="搜标题 / 为什么成立 / 标签 / 来源"
        placeholder-class="search__ph"
        :maxlength="40"
        confirm-type="search"
      />

      <!-- 领域筛选 -->
      <view class="filters">
        <view
          v-for="f in TOPIC_FILTERS"
          :key="f"
          class="filter"
          :class="{ 'is-on': topic === f }"
          hover-class="gz-hover"
          @click="topic = f"
        >
          <text class="filter__text">{{ f }}</text>
        </view>
      </view>

      <view class="rule">
        <text class="rule__text">写了「为什么成立」才是一条理</text>
        <text class="rule__num">{{ theories.length }} 条 · {{ attachedCount }} 已挂母题</text>
      </view>

      <!-- 空态 -->
      <view v-if="!shown.length" class="empty">
        <view class="empty__seal gz-motion">理</view>
        <text class="empty__title">{{ kw || topic !== '全部' ? '没有匹配的理' : '还没有一条理' }}</text>
        <text class="empty__desc">
          {{
            kw || topic !== '全部'
              ? '换个词或切回「全部」看看'
              : '理不是摘抄，是你认定「它在什么条件下成立」的那句话。\n从每日一则「认领」一条开始，最省力。'
          }}
        </text>
      </view>

      <view v-else class="list">
        <view v-for="it in shown" :key="it.id" class="card">
          <view class="card__top">
            <text v-for="t in it.topics" :key="t" class="card__topic">{{ t }}</text>
            <text v-if="it.motherId" class="card__mother" hover-class="gz-hover" @click="goMother">
              {{ observe.motherName(it.motherId) }}
            </text>
            <text v-else class="card__mother card__mother--none" hover-class="gz-hover" @click="attach(it.id)">
              未挂母题
            </text>
          </view>

          <text class="card__title">{{ it.title || it.content.slice(0, 20) }}</text>
          <text class="card__content">{{ it.content }}</text>

          <view v-if="it.why" class="why">
            <text class="why__label">为什么成立</text>
            <text class="why__text">{{ it.why }}</text>
          </view>

          <view v-if="it.golden.length" class="golden">
            <text v-for="(g, i) in it.golden" :key="i" class="golden__line">「{{ g }}」</text>
          </view>

          <view class="tags">
            <text v-if="it.sourceName" class="card__src">来源 · {{ it.sourceName }}</text>
            <text v-for="t in it.tags" :key="t" class="tag">{{ t }}</text>
          </view>

          <view class="ops">
            <text class="ops__state">{{ it.handledAt ? `已处理 · Lv.${it.depth}` : '未处理' }}</text>
            <view class="ops__right">
              <text v-if="!it.motherId" class="ops__btn" hover-class="gz-hover" @click="promote(it.id)">提炼母题</text>
              <text class="ops__btn ops__btn--main" hover-class="gz-hover" @click="attach(it.id)">
                {{ it.motherId ? '改挂' : '挂靠' }}
              </text>
            </view>
          </view>
        </view>
      </view>
    </block>

    <!-- ================= 播种（概念播种并入） ================= -->
    <block v-else>
      <view class="plant">
        <text class="plant__label">种下一个概念</text>
        <input
          v-model="concept"
          class="plant__input"
          placeholder="一词即可，如：第二大脑 / 刻意练习…"
          placeholder-class="plant__ph"
          :maxlength="16"
        />
        <textarea
          v-model="note"
          class="plant__area"
          placeholder="备注：为什么值得种下它？"
          placeholder-class="plant__ph"
          :maxlength="120"
          auto-height
        />
        <view class="plant__tag-row">
          <view
            v-for="t in SUGGEST_TAGS"
            :key="t"
            class="chip"
            :class="{ 'is-on': seedTags.includes(t) }"
            hover-class="gz-hover"
            @click="toggleTag(t)"
          >
            {{ t }}
          </view>
        </view>
        <button class="plant__btn" :class="{ 'is-off': !canPlant }" hover-class="gz-hover" @click="plantSeed">
          种下
        </button>
        <text class="plant__rule">七日后可回看收成 · 种太多会种不过来</text>
      </view>

      <view class="subtabs">
        <view class="subtab" :class="{ 'is-on': seedTab === 'growing' }" hover-class="gz-hover" @click="seedTab = 'growing'">
          生长中 {{ growing.length }}
        </view>
        <view class="subtab" :class="{ 'is-on': seedTab === 'done' }" hover-class="gz-hover" @click="seedTab = 'done'">
          已收成 {{ done.length }}
        </view>
      </view>

      <!-- 生长中 -->
      <view v-if="seedTab === 'growing'">
        <view v-if="!growing.length" class="empty">
          <view class="empty__seal">芽</view>
          <text class="empty__title">地还空着</text>
          <text class="empty__desc">把阅读里那句让你心里一动的话，种下来。\n交给时间，七天后回来看它。</text>
        </view>
        <view v-else class="list">
          <view v-for="s in growing" :key="s.plantedAt" class="card" :class="{ 'is-ripe': isRipeNow(s) }">
            <view class="card__top">
              <text class="card__tag" :class="{ 'is-ripe': isRipeNow(s) }">
                {{ isRipeNow(s) ? '可收成' : '幼苗' }}
              </text>
              <text class="card__days">{{ dayLabel(s) }}</text>
            </view>
            <text class="card__concept">{{ s.concept }}</text>
            <text v-if="s.note" class="card__note">{{ s.note }}</text>
            <view v-if="s.tags.length" class="card__tags">
              <text v-for="t in s.tags" :key="t" class="card__tag-mini">{{ t }}</text>
            </view>
            <view class="card__acts">
              <view v-if="isRipeNow(s)" class="act act--main" hover-class="gz-hover" @click="openHarvest(s)">
                回看 · 收成
              </view>
              <view v-else class="act act--ghost" hover-class="gz-hover" @click="dropSeed(s)">拔掉（不值）</view>
            </view>
          </view>
        </view>
      </view>

      <!-- 已收成 -->
      <view v-else>
        <view v-if="!done.length" class="empty">
          <view class="empty__seal gz-motion">果</view>
          <text class="empty__title">还没有收成</text>
          <text class="empty__desc">第一颗种子满七天后，来这写下它长出了什么。</text>
        </view>
        <view v-else class="list">
          <view v-for="s in done" :key="s.plantedAt" class="card card--done">
            <view class="card__top">
              <text class="card__tag is-done">已收成</text>
              <text class="card__days">种后 {{ doneGap(s) }} 天</text>
            </view>
            <text class="card__concept">{{ s.concept }}</text>
            <text v-if="s.note" class="card__note">{{ s.note }}</text>
            <view class="card__harvest">
              <text class="card__harvest-label">长出了什么</text>
              <text class="card__harvest-text">{{ s.harvestNote }}</text>
            </view>
          </view>
        </view>
      </view>
    </block>

    <view class="foot">
      <text class="foot__text">事是看见的 · 理是认定的 · 道是甩不掉的</text>
    </view>

    <!-- 收成作答层 -->
    <view v-if="harvestOpen" class="mask" @click="harvestOpen = false">
      <view class="sheet" @click.stop>
        <text class="sheet__title">回看「{{ harvesting?.concept }}」</text>
        <text class="sheet__sub">这七天里，它在你身上长出了什么？</text>
        <textarea
          v-model="harvestNote"
          class="sheet__area"
          placeholder="一句新的认识、一个想法的变形、一件想做的小事…"
          placeholder-class="sheet__ph"
          :maxlength="200"
          auto-height
        />
        <button class="sheet__btn" hover-class="gz-hover" @click="doHarvest">写下收成</button>
        <view class="sheet__cancel" hover-class="gz-hover" @click="harvestOpen = false">再想想</view>
      </view>
    </view>

    <!-- 拔种子确认 -->
    <GzDialog
      variant="danger"
      :show="!!dropTarget"
      title="拔掉这颗种子？"
      :content="dropHint"
      confirm-text="拔掉"
      cancel-text="留着"
      @cancel="dropTarget = null"
      @confirm="dropConfirm"
    />
  </view>
</template>

<script setup lang="ts">
/**
 * 观 · 理库 —— 已入册的「理」的展示层 + 概念播种（批次 E 收尾）。
 *
 * 为什么把播种并进来：它们本来就是同一件事的两头 ——
 * 播种是「还没成形的理」，理是「已经说得清的念头」。拆成两个入口，
 * 用户得先判断自己这个念头算不算理，而这恰恰是最不该让用户做的判断。
 *
 * 三条硬规则：
 *  1. 只有写了「为什么成立」的才进理库（store.theories 已过滤）—— 摘抄不算理；
 *  2. 挂靠母题不入账：整理动作本身不值修为，钱在「处理」时付过了；
 *  3. 提炼母题入账 +20：这是观这一环最贵的一次加工，值得。
 */
import { computed, ref } from 'vue'
import GzDialog from '@/components/GzDialog/GzDialog.vue'
import { OBSERVE_TOPICS, useObserveStore, type ObsItem } from '@/stores/observe'
import { isRipe, useSeedStore, type Seed } from '@/stores/seed'
import { useSkinClass } from '@/composables/useSkin'
import { navigateTo, ROUTES } from '@/router/routes'

const observe = useObserveStore()
const seedStore = useSeedStore()
const skinClass = useSkinClass()

type TabId = 'theory' | 'seed'
const tab = ref<TabId>('theory')

const TOPIC_FILTERS = ['全部', ...OBSERVE_TOPICS] as const
const topic = ref<(typeof TOPIC_FILTERS)[number]>('全部')
const kw = ref('')

const theories = computed(() => observe.theories)
/** 已挂到母题下的理的条数 */
const attachedCount = computed(() => theories.value.filter((i) => i.motherId).length)

const shown = computed<ObsItem[]>(() => {
  const k = kw.value.trim().toLowerCase()
  return theories.value.filter((i) => {
    // 多选后：只要这条的任一个主题命中筛选即可
    if (topic.value !== '全部' && !i.topics.includes(topic.value)) return false
    if (!k) return true
    return [i.title, i.content, i.why ?? '', i.sourceName ?? '', ...i.tags, ...i.golden]
      .join(' ')
      .toLowerCase()
      .includes(k)
  })
})

/**
 * 挂靠母题。
 * 没有母题可挂时不硬塞一个 —— 直接把人送到母题库：先认领一个问题，回来挂才有意义。
 */
function attach(id: string): void {
  const ms = observe.mothers
  if (!ms.length) {
    uni.showToast({ title: '还没有母题 · 先去认领一个', icon: 'none' })
    setTimeout(() => navigateTo(ROUTES.observeMotherLib), 600)
    return
  }
  const cur = observe.find(id)?.motherId
  const items = ms.map((m) => m.title)
  if (cur) items.push('取消挂靠')
  uni.showActionSheet({
    itemList: items,
    success: (res) => {
      const idx = res.tapIndex
      if (cur && idx === ms.length) {
        observe.attachMother(id, undefined)
        uni.showToast({ title: '已取消挂靠', icon: 'none' })
        return
      }
      const target = ms[idx]
      if (!target) return
      observe.attachMother(id, target.id)
      uni.showToast({ title: `已挂到「${target.title}」`, icon: 'none' })
    },
  })
}

/** 提炼母题：给它一个名字（问句最好），原条目自动挂上去并标记已处理 */
function promote(id: string): void {
  const src = observe.find(id)
  if (!src) return
  uni.showModal({
    title: '这个反复出现的问题，叫什么',
    content: `从「${src.title || src.content.slice(0, 12)}」升上去`,
    editable: true,
    placeholderText: '如：我到底在回避什么',
    confirmText: '立为母题',
    cancelText: '再想想',
    success: (res) => {
      if (!res.confirm) return
      const name = ((res as { content?: string }).content ?? '').trim()
      if (!name) {
        uni.showToast({ title: '总得给它一个名字', icon: 'none' })
        return
      }
      const created = observe.promoteToMother(id, name, src.why ?? src.content)
      if (!created) {
        uni.showToast({ title: '收件满了，先去处理几条', icon: 'none' })
        return
      }
      uni.showToast({ title: '母题已立 · 修为 +20', icon: 'none' })
    },
  })
}

function goMother(): void {
  navigateTo(ROUTES.observeMotherLib)
}

function goCompose(): void {
  navigateTo(ROUTES.observeCompose, { kind: 'theory' })
}

/* ---------------- 播种（原概念播种页并入） ---------------- */
const SUGGEST_TAGS = ['认知', '工作流', '关系', '身心', '创造'] as const
const concept = ref('')
const note = ref('')
const seedTags = ref<string[]>([])
const canPlant = computed(() => concept.value.trim().length > 0)
const nowTick = ref(Date.now())
const seedTab = ref<'growing' | 'done'>('growing')

const growing = computed(() =>
  seedStore.seeds
    .filter((s) => !s.harvestAt)
    .sort((a, b) => (isRipe(a, nowTick.value) ? -1 : 1) - (isRipe(b, nowTick.value) ? -1 : 1)),
)
const done = computed(() => seedStore.seeds.filter((s) => s.harvestAt).slice(0, 50))

function toggleTag(t: string): void {
  seedTags.value = seedTags.value.includes(t) ? seedTags.value.filter((x) => x !== t) : [...seedTags.value, t]
}

function plantSeed(): void {
  if (!canPlant.value) return
  if (seedStore.plant(concept.value, note.value, seedTags.value)) {
    concept.value = ''
    note.value = ''
    seedTags.value = []
    uni.showToast({ title: '已种下 · 七天后见', icon: 'none' })
  }
}

function isRipeNow(s: Seed): boolean {
  return isRipe(s, nowTick.value)
}

function dayLabel(s: Seed): string {
  const passed = Math.floor((nowTick.value - s.plantedAt) / (24 * 60 * 60 * 1000))
  const remain = 7 - passed
  return remain > 0 ? `第 ${Math.min(7, passed + 1)} 天 · ${remain} 天后可收` : '已满七天 · 等回看'
}

function doneGap(s: Seed): number {
  return Math.max(7, Math.round(((s.harvestAt ?? nowTick.value) - s.plantedAt) / (24 * 60 * 60 * 1000)))
}

const dropTarget = ref<Seed | null>(null)
const dropHint = computed(() =>
  dropTarget.value ? `「${dropTarget.value.concept}」将不再生长，不可找回。` : '',
)
function dropSeed(s: Seed): void {
  dropTarget.value = s
}
function dropConfirm(): void {
  const t = dropTarget.value
  dropTarget.value = null
  if (t) seedStore.remove(t.plantedAt)
}

const harvestOpen = ref(false)
const harvesting = ref<Seed | null>(null)
const harvestNote = ref('')

function openHarvest(s: Seed): void {
  harvesting.value = s
  harvestNote.value = ''
  harvestOpen.value = true
}

function doHarvest(): void {
  if (!harvesting.value) return
  if (seedStore.harvest(harvesting.value.plantedAt, harvestNote.value)) {
    harvestOpen.value = false
    uni.showToast({ title: '已收成 · 留待长进知识库', icon: 'none' })
  } else {
    uni.showToast({ title: '写下点什么再收成吧', icon: 'none' })
  }
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

.nav__side--right {
  display: flex;
  align-items: center;
  justify-content: flex-end;
}

.nav__back,
.nav__add {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 76rpx;
  height: 76rpx;
  border: 1rpx solid $gz-line;
  border-radius: 50%;
  background: $gz-surface;
  color: $gz-ink-2;
  font-size: 46rpx;
  line-height: 1;
}

.nav__back {
  font-size: 52rpx;
  padding-bottom: 8rpx;
}

.nav__title {
  font-size: 34rpx;
  font-weight: 700;
  letter-spacing: 0.08em;
  color: $gz-ink;
}

/* 分区 */
.tabs {
  display: flex;
  gap: 14rpx;
  margin: 20rpx 0 18rpx;
}

.tab {
  padding: 12rpx 34rpx;
  border-radius: 999rpx;
  background: $gz-surface;
  border: 1rpx solid $gz-line;
  font-size: $gz-fs-small;
  color: $gz-ink-3;
}

.tab.is-on {
  color: $gz-accent;
  border-color: $gz-accent;
  font-weight: 600;
  background: $gz-accent-soft;
}

.subtabs {
  display: flex;
  gap: 12rpx;
  margin: 24rpx 0 18rpx;
}

.subtab {
  padding: 8rpx 26rpx;
  border-radius: 999rpx;
  background: $gz-surface;
  border: 1rpx solid $gz-line;
  font-size: $gz-fs-caption;
  color: $gz-ink-3;
}

.subtab.is-on {
  color: $gz-accent;
  border-color: $gz-accent;
  background: $gz-accent-soft;
}

.search {
  padding: 20rpx 24rpx;
  background: $gz-input-bg;
  border: 1rpx solid $gz-line;
  border-radius: 999rpx;
  font-size: $gz-fs-small;
  color: $gz-ink;
}

.search__ph {
  color: $gz-ink-3;
}

.filters {
  display: flex;
  flex-wrap: wrap;
  gap: 12rpx;
  margin-top: 16rpx;
}

.filter {
  padding: 10rpx 22rpx;
  border: 1rpx solid $gz-line;
  border-radius: 999rpx;
  background: $gz-surface;
}

.filter.is-on {
  border-color: $gz-accent;
  background: $gz-accent-soft;
}

.filter__text {
  font-size: $gz-fs-caption;
  color: $gz-ink-2;
}

.filter.is-on .filter__text {
  color: $gz-accent;
  font-weight: 600;
}

.rule {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin: 18rpx 4rpx 8rpx;
}

.rule__text {
  font-size: $gz-fs-caption;
  color: $gz-ink-3;
}

.rule__num {
  font-size: $gz-fs-caption;
  color: $gz-accent;
}

.list {
  display: flex;
  flex-direction: column;
  gap: 18rpx;
  margin-top: 12rpx;
}

.card {
  padding: 26rpx 26rpx 18rpx;
  background: $gz-surface;
  border: 1rpx solid $gz-line;
  border-radius: $gz-radius-md;
}

.card.is-ripe {
  border-color: $gz-accent;
  background: linear-gradient(180deg, $gz-accent-soft, $gz-surface 46%);
}

.card__top {
  display: flex;
  align-items: center;
  gap: 12rpx;
  margin-bottom: 12rpx;
}

.card__topic {
  padding: 4rpx 16rpx;
  border-radius: 999rpx;
  background: #eaf0f8;
  color: #4e8fd4;
  font-size: $gz-fs-caption;
}

.card__mother {
  margin-left: auto;
  font-size: $gz-fs-caption;
  color: $gz-accent;
}

.card__mother--none {
  color: $gz-ink-3;
}

.card__title {
  display: block;
  font-size: $gz-fs-body;
  font-weight: 700;
  line-height: 1.6;
  color: $gz-ink;
}

.card__content {
  display: block;
  margin-top: 8rpx;
  font-size: $gz-fs-small;
  line-height: 1.85;
  color: $gz-ink-2;
  word-break: break-all;
}

.why {
  margin-top: 14rpx;
  padding: 14rpx 18rpx;
  border-left: 4rpx solid $gz-accent;
  background: $gz-accent-soft;
  border-radius: 0 $gz-radius-sm $gz-radius-sm 0;
}

.why__label {
  display: block;
  font-size: $gz-fs-caption;
  color: $gz-ink-3;
}

.why__text {
  display: block;
  margin-top: 4rpx;
  font-size: $gz-fs-small;
  line-height: 1.8;
  color: $gz-ink-2;
}

.golden {
  margin-top: 14rpx;
}

.golden__line {
  display: block;
  font-size: $gz-fs-small;
  line-height: 1.9;
  color: $gz-ink;
}

.tags {
  display: flex;
  flex-wrap: wrap;
  gap: 10rpx;
  margin-top: 12rpx;
}

.tag {
  padding: 4rpx 16rpx;
  border-radius: 999rpx;
  background: $gz-input-bg;
  font-size: $gz-fs-caption;
  color: $gz-ink-3;
}

.card__src {
  padding: 4rpx 0;
  font-size: $gz-fs-caption;
  color: $gz-ink-3;
}

.ops {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-top: 16rpx;
  padding-top: 14rpx;
  border-top: 1rpx solid $gz-line;
}

.ops__state {
  font-size: $gz-fs-caption;
  color: $gz-ink-3;
}

.ops__right {
  display: flex;
  gap: 14rpx;
}

.ops__btn {
  padding: 8rpx 26rpx;
  border: 1rpx solid $gz-line;
  border-radius: 999rpx;
  font-size: $gz-fs-caption;
  color: $gz-ink-2;
}

.ops__btn--main {
  border-color: $gz-accent;
  background: $gz-accent-soft;
  color: $gz-accent;
  font-weight: 600;
}

/* 种植面板 */
.plant {
  padding: 28rpx 28rpx 26rpx;
  background: $gz-surface;
  border: 1rpx solid $gz-line;
  border-radius: $gz-radius-lg;
}

.plant__label {
  display: block;
  font-size: $gz-fs-caption;
  letter-spacing: 0.12em;
  color: $gz-accent;
}

.plant__input {
  margin-top: 18rpx;
  padding: 18rpx 22rpx;
  background: $gz-input-bg;
  border: 1rpx solid $gz-line;
  border-radius: $gz-radius-md;
  font-size: $gz-fs-body;
  color: $gz-ink;
}

.plant__area {
  width: 100%;
  margin-top: 14rpx;
  padding: 18rpx 22rpx;
  min-height: 96rpx;
  background: $gz-input-bg;
  border: 1rpx solid $gz-line;
  border-radius: $gz-radius-md;
  font-size: $gz-fs-small;
  line-height: 1.8;
  color: $gz-ink;
  box-sizing: border-box;
}

.plant__ph {
  color: $gz-ink-3;
}

.plant__tag-row {
  display: flex;
  flex-wrap: wrap;
  gap: 12rpx;
  margin-top: 14rpx;
}

.chip {
  padding: 6rpx 20rpx;
  border-radius: 999rpx;
  border: 1rpx solid $gz-line;
  font-size: $gz-fs-caption;
  color: $gz-ink-3;
}

.chip.is-on {
  border-color: $gz-accent;
  background: $gz-accent-soft;
  color: $gz-accent;
}

.plant__btn {
  margin-top: 20rpx;
  /* button 被 App.vue 全局重置过 padding/border-radius，必须补回，否则高度塌成一行文字 */
  padding: 26rpx 0;
  border-radius: $gz-radius-md;
  line-height: 1.4;
  background: $gz-accent;
  color: $gz-on-cta;
  font-size: $gz-fs-body;
  font-weight: 600;
}

.plant__btn.is-off {
  opacity: 0.45;
}

.plant__rule {
  display: block;
  margin-top: 14rpx;
  font-size: $gz-fs-caption;
  text-align: center;
  color: $gz-ink-3;
}

/* 种子卡 */
.card__tag {
  padding: 4rpx 16rpx;
  border-radius: 999rpx;
  font-size: $gz-fs-caption;
  background: rgba(132, 162, 104, 0.2);
  color: #6d8b3f;
}

.card__tag.is-ripe {
  background: $gz-accent;
  color: $gz-on-cta;
}

.card__tag.is-done {
  background: var(--gz-line-soft);
  color: $gz-ink-3;
}

.card__days {
  margin-left: auto;
  font-size: $gz-fs-caption;
  color: $gz-ink-3;
}

.card__concept {
  display: block;
  margin-top: 18rpx;
  font-size: 34rpx;
  font-weight: 700;
  line-height: 1.5;
  color: $gz-ink;
}

.card__note {
  display: block;
  margin-top: 8rpx;
  font-size: $gz-fs-small;
  line-height: 1.8;
  color: $gz-ink-2;
}

.card__tags {
  display: flex;
  flex-wrap: wrap;
  gap: 10rpx;
  margin-top: 14rpx;
}

.card__tag-mini {
  padding: 4rpx 14rpx;
  border-radius: 999rpx;
  font-size: 20rpx;
  background: var(--gz-line-soft);
  color: $gz-ink-3;
}

.card__acts {
  margin-top: 20rpx;
  display: flex;
  justify-content: flex-end;
}

.act {
  padding: 12rpx 30rpx;
  border-radius: 999rpx;
  font-size: $gz-fs-small;
}

.act--main {
  background: $gz-accent;
  color: $gz-on-cta;
}

.act--ghost {
  border: 1rpx solid $gz-line;
  color: $gz-ink-3;
}

.card--done {
  opacity: 0.92;
}

.card__harvest {
  margin-top: 20rpx;
  padding: 18rpx 20rpx;
  border-radius: $gz-radius-md;
  background: var(--gz-line-soft);
}

.card__harvest-label {
  display: block;
  font-size: $gz-fs-caption;
  color: $gz-ink-3;
}

.card__harvest-text {
  display: block;
  margin-top: 8rpx;
  font-size: $gz-fs-small;
  line-height: 1.8;
  color: $gz-ink-2;
}

/* 空态 */
.empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 90rpx 40rpx 0;
}

.empty__seal {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 108rpx;
  height: 108rpx;
  border: 2rpx solid $gz-accent;
  border-radius: 26rpx;
  background: $gz-accent-soft;
  color: $gz-accent;
  font-size: 48rpx;
  font-weight: 700;
}

.empty__title {
  margin-top: 28rpx;
  font-size: $gz-fs-title;
  font-weight: 700;
  color: $gz-ink;
}

.empty__desc {
  margin-top: 14rpx;
  font-size: $gz-fs-small;
  line-height: 1.9;
  text-align: center;
  color: $gz-ink-3;
  white-space: pre-line;
}

/* 收成层 */
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
  padding: 34rpx 32rpx calc(env(safe-area-inset-bottom) + 30rpx);
  background: $gz-surface;
  border-radius: 32rpx 32rpx 0 0;
  box-sizing: border-box;
}

.sheet__title {
  display: block;
  font-size: 32rpx;
  font-weight: 700;
  color: $gz-ink;
}

.sheet__sub {
  display: block;
  margin-top: 8rpx;
  font-size: $gz-fs-small;
  color: $gz-ink-3;
}

.sheet__area {
  width: 100%;
  margin-top: 20rpx;
  padding: 20rpx;
  min-height: 140rpx;
  background: $gz-input-bg;
  border: 1rpx solid $gz-line;
  border-radius: $gz-radius-md;
  font-size: $gz-fs-small;
  line-height: 1.8;
  color: $gz-ink;
  box-sizing: border-box;
}

.sheet__ph {
  color: $gz-ink-3;
}

.sheet__btn {
  margin-top: 22rpx;
  padding: 26rpx 0;
  border-radius: $gz-radius-md;
  line-height: 1.4;
  background: $gz-accent;
  color: $gz-on-cta;
  font-size: $gz-fs-body;
  font-weight: 600;
}

.sheet__cancel {
  margin-top: 14rpx;
  padding: 18rpx 0;
  text-align: center;
  font-size: $gz-fs-small;
  color: $gz-ink-3;
}

.foot {
  margin-top: 44rpx;
  display: flex;
  justify-content: center;
}

.foot__text {
  font-size: $gz-fs-caption;
  letter-spacing: 0.08em;
  color: $gz-ink-3;
}
</style>

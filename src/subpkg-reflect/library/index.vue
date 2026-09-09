<template>
  <view class="page" :class="skinClass">
    <!-- 顶栏：返回 + 标题（子页统一样式） -->
    <view class="nav">
      <view class="nav__side" hover-class="gz-hover" @click="goBack">
        <text class="nav__back">‹</text>
      </view>
      <text class="nav__title">知识库</text>
      <view class="nav__side" />
    </view>

    <!-- 顶部操作 -->
    <view class="ops">
      <view class="op op--main" hover-class="gz-hover" @click="addOpen = true">＋ 转述一条（Lv.1）</view>
      <view class="op" hover-class="gz-hover" @click="importOpen = true">从播种导入收成</view>
    </view>

    <!-- 检索 -->
    <view class="search">
      <text class="search__mark">索</text>
      <input
        v-model="kw"
        class="search__input"
        placeholder="搜标题 / 内容 / 标签…"
        placeholder-class="search__ph"
      />
    </view>
    <view class="filters">
      <view
        v-for="d in depthFilters"
        :key="d.key"
        class="filter"
        :class="{ 'is-on': depth === d.key }"
        @click="depth = d.key"
      >
        {{ d.label }}
      </view>
    </view>
    <view v-if="allTags.length" class="tag-row">
      <view
        v-for="t in ['全部', ...allTags]"
        :key="t"
        class="tag"
        :class="{ 'is-on': tag === t }"
        @click="tag = t === '全部' ? '' : t"
      >
        {{ t }}
      </view>
    </view>

    <!-- 列表 -->
    <view v-if="!filtered.length" class="empty">
      <view class="empty__seal">空</view>
      <text class="empty__title">没有找到卡片</text>
      <text class="empty__desc">换个关键词？或者从灵魂拷问写起、把播种的收成导入进来。</text>
    </view>
    <view v-else class="list">
      <view
        v-for="c in filtered"
        :key="c.createdAt"
        class="card"
        hover-class="gz-hover"
        @click="openDetail(c)"
      >
        <view class="card__top">
          <text class="card__tag" :style="{ color: c.color, background: c.colorSoft }">{{ c.depthLabel }}</text>
          <text class="card__src">{{ c.src }}</text>
        </view>
        <text class="card__title">{{ c.title }}</text>
        <text class="card__digest">{{ c.content }}</text>
        <view v-if="c.tags.length" class="card__tags">
          <text v-for="t in c.tags" :key="t" class="card__tag-mini">{{ t }}</text>
        </view>
      </view>
    </view>

    <!-- 转述面板 -->
    <view v-if="addOpen" class="mask" @click="addOpen = false">
      <view class="sheet" @click.stop>
        <text class="sheet__title">转述一条 · Lv.1</text>
        <text class="sheet__sub">用你自己的话把想法讲一遍——转述是内化的第一步。</text>
        <input
          v-model="noteTitle"
          class="sheet__field"
          placeholder="一句话标题（可选，默认截取首句）"
          placeholder-class="sheet__ph"
          :maxlength="40"
        />
        <textarea
          v-model="noteBody"
          class="sheet__area"
          placeholder="转述正文…"
          placeholder-class="sheet__ph"
          :maxlength="400"
          auto-height
        />
        <view class="sheet__tag-row">
          <view
            v-for="t in SUGGEST_TAGS"
            :key="t"
            class="sheet__chip"
            :class="{ 'is-on': noteTags.includes(t) }"
            hover-class="gz-hover"
            @click="toggleNoteTag(t)"
          >
            {{ t }}
          </view>
        </view>
        <button class="sheet__btn" hover-class="gz-hover" @click="saveNote">存进知识库</button>
      </view>
    </view>

    <!-- 播种收成导入层 -->
    <view v-if="importOpen" class="mask" @click="importOpen = false">
      <view class="sheet" @click.stop>
        <text class="sheet__title">从概念播种导入收成</text>
        <text class="sheet__sub">已收成且未导入的种子会以 Lv.2 进入知识库。</text>
        <view v-if="!importable.length" class="import-void">
          没有可导入的收成。先去观里种一颗，满 7 天收成后回来。
        </view>
        <view v-else class="import-list">
          <view v-for="s in importable" :key="s.plantedAt" class="import-row">
            <view class="import-row__body">
              <text class="import-row__name">{{ s.concept }}</text>
              <text class="import-row__note">{{ s.harvestNote }}</text>
            </view>
            <view class="import-row__btn" hover-class="gz-hover" @click="doImport(s)">导入</view>
          </view>
        </view>
      </view>
    </view>

    <!-- 卡片详情 -->
    <view v-if="detailOpen" class="mask" @click="detailOpen = false">
      <view class="sheet" @click.stop>
        <view class="sheet__top">
          <text class="card__tag" :style="{ color: activeColor, background: activeColorSoft }">
            {{ activeDetail?.depthLabel }}
          </text>
          <text class="sheet__src">{{ activeDetail?.src }}</text>
        </view>
        <text class="sheet__title">{{ activeDetail?.title }}</text>
        <text class="sheet__content">{{ activeDetail?.content }}</text>
        <view v-if="activeDetail?.tags.length" class="sheet__tag-row">
          <view v-for="t in activeDetail?.tags" :key="t" class="sheet__chip">{{ t }}</view>
        </view>
        <view
          v-if="activeDetail && activeDetail.depth < 3"
          class="sheet__deepen"
          hover-class="gz-hover"
          @click="deepen"
        >
          再加工一层 → Lv.{{ (activeDetail.depth + 1) as number }}
        </view>
        <view class="sheet__danger" hover-class="gz-hover" @click="drop">移除这张卡</view>
        <view class="sheet__close" hover-class="gz-hover" @click="detailOpen = false">关闭</view>
      </view>
    </view>

    <!-- 移除确认：主题随当前模式，破坏性键语义红 -->
    <GzDialog
      variant="danger"
      :show="dropOpen"
      title="移除这张卡？"
      content="它会从知识库消失，不可找回。"
      confirm-text="移除"
      cancel-text="留着"
      @cancel="dropOpen = false"
      @confirm="dropConfirm"
    />
  </view>
</template>

<script setup lang="ts">
/**
 * 知识库（批次 C）· 分包 subpkg-reflect：全部知识卡片按关键词/标签/深度检索；
 * 支持手动「转述一条」作为 Lv.1 起点、把概念播种的收成导入为 Lv.2；
 * 单卡可加深一层（Lv.1→2→3）。AI 智能打标签为后端期能力，此处手动。
 */
import { computed, ref } from 'vue'
import GzDialog from '@/components/GzDialog/GzDialog.vue'
import {
  DEPTH_LABEL,
  depthColor,
  useKnowledgeStore,
  type CardDepth,
  type KnowledgeCard,
} from '@/stores/knowledge'
import { useSeedStore, type Seed } from '@/stores/seed'
import { useSkinClass } from '@/composables/useSkin'
import { ROUTES } from '@/router/routes'

const knowledge = useKnowledgeStore()
const seed = useSeedStore()
const skinClass = useSkinClass()

const SUGGEST_TAGS = ['认知', '方法', '关系', '身心', '观', '止', '行'] as const

const kw = ref('')
const depth = ref<'all' | CardDepth>('all')
const tag = ref('')

const depthFilters = [
  { key: 'all' as const, label: '全部深度' },
  { key: 1 as const, label: 'Lv.1 转述' },
  { key: 2 as const, label: 'Lv.2 重构' },
  { key: 3 as const, label: 'Lv.3 内化' },
]

const allTags = computed(() => knowledge.allTags().sort())

type RowItem = KnowledgeCard & { color: string; colorSoft: string; depthLabel: string }

const filtered = computed<RowItem[]>(() => {
  const q = kw.value.trim().toLowerCase()
  return knowledge.cards
    .filter((c) => {
      if (depth.value !== 'all' && c.depth !== depth.value) return false
      if (tag.value && !c.tags.includes(tag.value)) return false
      if (q) {
        const hay = `${c.title} ${c.content} ${c.tags.join(' ')}`.toLowerCase()
        if (!hay.includes(q)) return false
      }
      return true
    })
    .map((c) => ({
      ...c,
      color: depthColor(c.depth),
      colorSoft: `rgba(${c.depth === 1 ? '132, 162, 104' : c.depth === 2 ? '78, 143, 212' : '156, 138, 196'}, 0.14)`,
      depthLabel: DEPTH_LABEL[c.depth],
    }))
})

/* 转述 Lv.1 */
const addOpen = ref(false)
const noteTitle = ref('')
const noteBody = ref('')
const noteTags = ref<string[]>([])

function toggleNoteTag(t: string): void {
  noteTags.value = noteTags.value.includes(t) ? noteTags.value.filter((x) => x !== t) : [...noteTags.value, t]
}

function saveNote(): void {
  const body = noteBody.value.trim()
  if (!body) {
    uni.showToast({ title: '转述正文不能为空', icon: 'none' })
    return
  }
  const title = noteTitle.value.trim() || body.slice(0, 22)
  const tags = noteTags.value.length ? noteTags.value : ['转述']
  knowledge.add({ kind: 'note', title, content: body, tags, depth: 1, src: '手动转述 · Lv.1 起点' })
  addOpen.value = false
  noteTitle.value = ''
  noteBody.value = ''
  noteTags.value = []
  uni.showToast({ title: '已存进知识库 · Lv.1', icon: 'none' })
}

/* 播种导入 */
const importOpen = ref(false)
const importable = computed(() =>
  seed.seeds.filter((s) => s.harvestAt && !knowledge.isSeedImported(s.plantedAt)),
)

function doImport(s: Seed): void {
  const card = knowledge.importSeedHarvest(s)
  if (card) {
    uni.showToast({ title: `已导入「${s.concept}」· Lv.2`, icon: 'none' })
  } else {
    uni.showToast({ title: '收成内容为空，无法导入', icon: 'none' })
  }
}

/* 详情 */
const detailOpen = ref(false)
const activeDetail = ref<RowItem | null>(null)

function openDetail(c: RowItem): void {
  activeDetail.value = c
  detailOpen.value = true
}

const activeColor = computed(() => activeDetail.value?.color ?? '#84A268')
const activeColorSoft = computed(() => activeDetail.value?.colorSoft ?? 'rgba(132,162,104,0.14)')

function deepen(): void {
  if (!activeDetail.value) return
  if (knowledge.deepen(activeDetail.value.createdAt)) {
    uni.showToast({ title: '已加深一层', icon: 'none' })
    detailOpen.value = false
  }
}

const dropOpen = ref(false)

function drop(): void {
  if (!activeDetail.value) return
  dropOpen.value = true
}

function dropConfirm(): void {
  dropOpen.value = false
  if (!activeDetail.value) return
  knowledge.remove(activeDetail.value.createdAt)
  detailOpen.value = false
}

function goBack(): void {
  const pages = getCurrentPages()
  if (pages.length > 1) {
    uni.navigateBack()
  } else {
    uni.switchTab({ url: ROUTES.tabReflect })
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

/* 顶部操作 */
.ops {
  display: flex;
  gap: 16rpx;
  margin-top: 16rpx;
}

.op {
  flex: 1;
  text-align: center;
  padding: 22rpx 0;
  border-radius: $gz-radius-md;
  border: 1rpx solid $gz-line;
  font-size: $gz-fs-small;
  color: $gz-ink-2;
}

.op--main {
  background: $gz-accent;
  border-color: $gz-accent;
  color: $gz-on-cta;
  font-weight: 600;
}

/* 检索 */
.search {
  display: flex;
  align-items: center;
  gap: 16rpx;
  margin-top: 26rpx;
  padding: 18rpx 24rpx;
  background: $gz-input-bg;
  border: 1rpx solid $gz-line;
  border-radius: $gz-radius-md;
}

.search__mark {
  color: $gz-accent;
  font-size: $gz-fs-small;
}

.search__input {
  flex: 1;
  font-size: $gz-fs-small;
  color: $gz-ink;
}

.search__ph {
  color: $gz-ink-3;
}

.filters {
  display: flex;
  gap: 12rpx;
  margin-top: 18rpx;
}

.filter {
  padding: 8rpx 22rpx;
  border-radius: 999rpx;
  border: 1rpx solid $gz-line;
  font-size: $gz-fs-caption;
  color: $gz-ink-3;
}

.filter.is-on {
  color: $gz-accent;
  border-color: $gz-accent;
  background: $gz-accent-soft;
  font-weight: 600;
}

.tag-row {
  display: flex;
  flex-wrap: wrap;
  gap: 12rpx;
  margin-top: 16rpx;
}

.tag {
  padding: 6rpx 18rpx;
  border-radius: 999rpx;
  border: 1rpx solid $gz-line;
  font-size: $gz-fs-caption;
  color: $gz-ink-3;
}

.tag.is-on {
  border-color: $gz-accent;
  background: $gz-accent-soft;
  color: $gz-accent;
}

.list {
  display: flex;
  flex-direction: column;
  gap: 18rpx;
  margin-top: 24rpx;
}

.card {
  padding: 26rpx 28rpx;
  background: $gz-surface;
  border: 1rpx solid $gz-line;
  border-radius: $gz-radius-md;
}

.card__top {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.card__tag {
  padding: 4rpx 14rpx;
  border-radius: 999rpx;
  font-size: $gz-fs-caption;
}

.card__src {
  font-size: $gz-fs-caption;
  color: $gz-ink-3;
}

.card__title {
  display: block;
  margin-top: 14rpx;
  font-size: $gz-fs-body;
  font-weight: 700;
  line-height: 1.5;
  color: $gz-ink;
}

.card__digest {
  display: block;
  margin-top: 10rpx;
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

.empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 90rpx 30rpx 0;
}

.empty__seal {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 100rpx;
  height: 100rpx;
  border: 2rpx solid $gz-accent;
  border-radius: 24rpx;
  background: $gz-accent-soft;
  color: $gz-accent;
  font-size: 44rpx;
  font-weight: 700;
}

.empty__title {
  margin-top: 26rpx;
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

/* 底部面板通用 */
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
  max-height: 78vh;
  padding: 32rpx 32rpx calc(env(safe-area-inset-bottom) + 30rpx);
  background: $gz-surface;
  border-radius: 32rpx 32rpx 0 0;
  box-sizing: border-box;
  overflow-y: auto;
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

.sheet__field {
  margin-top: 22rpx;
  padding: 18rpx 20rpx;
  background: $gz-input-bg;
  border: 1rpx solid $gz-line;
  border-radius: $gz-radius-md;
  font-size: $gz-fs-small;
  color: $gz-ink;
}

.sheet__area {
  width: 100%;
  margin-top: 16rpx;
  padding: 18rpx 20rpx;
  min-height: 150rpx;
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

.sheet__tag-row {
  display: flex;
  flex-wrap: wrap;
  gap: 12rpx;
  margin-top: 18rpx;
}

.sheet__chip {
  padding: 6rpx 20rpx;
  border-radius: 999rpx;
  border: 1rpx solid $gz-line;
  font-size: $gz-fs-caption;
  color: $gz-ink-3;
}

.sheet__chip.is-on {
  border-color: $gz-accent;
  background: $gz-accent-soft;
  color: $gz-accent;
}

.sheet__btn {
  margin-top: 26rpx;
  background: $gz-accent;
  color: $gz-on-cta;
  font-size: $gz-fs-body;
  font-weight: 600;
}

.sheet__top {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.sheet__src {
  font-size: $gz-fs-caption;
  color: $gz-ink-3;
}

.sheet__content {
  display: block;
  margin-top: 16rpx;
  font-size: $gz-fs-small;
  line-height: 1.9;
  color: $gz-ink-2;
}

.sheet__deepen {
  margin-top: 26rpx;
  padding: 20rpx 0;
  text-align: center;
  background: $gz-accent-soft;
  color: $gz-accent;
  border-radius: $gz-radius-md;
  font-size: $gz-fs-body;
  font-weight: 600;
}

.sheet__danger {
  margin-top: 16rpx;
  padding: 16rpx 0;
  text-align: center;
  border: 1rpx solid rgba(196, 96, 46, 0.5);
  color: #b25a2c;
  border-radius: $gz-radius-md;
  font-size: $gz-fs-small;
}

.sheet__close {
  margin-top: 18rpx;
  padding: 12rpx 0;
  text-align: center;
  font-size: $gz-fs-small;
  color: $gz-ink-3;
}

.import-void {
  margin-top: 24rpx;
  padding: 34rpx 24rpx;
  border: 1rpx dashed $gz-line;
  border-radius: $gz-radius-md;
  font-size: $gz-fs-caption;
  line-height: 1.8;
  text-align: center;
  color: $gz-ink-3;
}

.import-list {
  display: flex;
  flex-direction: column;
  gap: 16rpx;
  margin-top: 24rpx;
}

.import-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 20rpx;
  padding: 20rpx 22rpx;
  background: $gz-input-bg;
  border-radius: $gz-radius-md;
}

.import-row__body {
  min-width: 0;
}

.import-row__name {
  display: block;
  font-size: $gz-fs-body;
  font-weight: 700;
  color: $gz-ink;
}

.import-row__note {
  display: block;
  margin-top: 6rpx;
  font-size: $gz-fs-caption;
  line-height: 1.6;
  color: $gz-ink-3;
}

.import-row__btn {
  flex: none;
  padding: 10rpx 26rpx;
  border-radius: 999rpx;
  background: $gz-accent;
  color: $gz-on-cta;
  font-size: $gz-fs-caption;
}
</style>

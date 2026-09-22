<template>
  <view class="page" :class="skinClass">
    <!-- 顶栏（顶距与样式统一在 components/SubNav；右侧「＋」走 #right 插槽） -->
    <SubNav :fallback="ROUTES.tabObserve" @right="goCompose">
      理库
      <template #right><text class="nav__add">＋</text></template>
    </SubNav>

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

          <!--
            文章 / 视频：卡片上先给「你写的摘要」（你要找回来的就是这一句），
            正文只留三行预览，全文进详情页 —— 一篇长逐字稿平铺出来会把整列淹掉（2026-09-19）。
          -->
          <view v-if="briefText(it)" class="brief">
            <text class="brief__label">{{ briefLabel(it) }}</text>
            <text class="brief__text">{{ briefText(it) }}</text>
          </view>
          <text v-if="it.content" class="card__content" :class="{ 'is-cut': isDoc(it) }">{{ it.content }}</text>

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
              <!-- 文章 / 视频才有详情可看：一句话的正文就是那一句，本来就全在卡上 -->
              <text v-if="isDoc(it)" class="ops__btn" hover-class="gz-hover" @click="goDetail(it.id)">详情</text>
              <text v-if="!it.motherId" class="ops__btn" hover-class="gz-hover" @click="promote(it.id)">提炼母题</text>
              <text class="ops__btn ops__btn--main" hover-class="gz-hover" @click="attach(it.id)">
                {{ it.motherId ? '改挂' : '挂靠' }}
              </text>
            </view>
          </view>
        </view>
      </view>

      <!-- 三十条预置理（§7.2 空状态原则：理库不依赖用户输入也能站住） -->
      <view class="presets">
        <view class="presets__head">
          <text class="presets__title">三十条预置理</text>
          <text class="presets__sub">已收下 {{ takenCount }}/{{ PRESET_THEORIES.length }}</text>
        </view>
        <view v-for="p in presetList" :key="p.id" class="pcard" :class="{ 'is-taken': isTaken(p) }">
          <text class="pcard__topic">{{ p.topic }}</text>
          <text class="pcard__title">{{ p.title }}</text>
          <text class="pcard__content">{{ p.content }}</text>
          <view class="pcard__why">
            <text class="pcard__why-label">为什么成立</text>
            <text class="pcard__why-text">{{ p.why }}</text>
          </view>
          <view v-if="!isTaken(p)" class="pcard__cta" hover-class="gz-hover" @click="adoptPreset(p)">
            收下
          </view>
          <text v-else class="pcard__taken">已在你的理里</text>
        </view>
        <text v-if="!presetList.length" class="presets__none">这个筛选下没有预置理</text>
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
import { PRESET_THEORIES, recommendOrder, type PresetTheory } from '@/config/theories'
import { useAssessmentStore } from '@/stores/assessment'
import { useModeStore } from '@/stores/mode'
import { isRipe, useSeedStore, type Seed } from '@/stores/seed'
import { useSkinClass } from '@/composables/useSkin'
import { navigateTo, ROUTES } from '@/router/routes'
import { showModal } from '@/utils/dialog'

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

/* ---------------- 三十条预置理（§7.2 空状态兜底 + §7.1 测评映射） ---------------- */
const assessment = useAssessmentStore()
const modeStore = useModeStore()

/**
 * 预置理列表：按测评最弱维度对应的领域排前（recommendOrder），
 * 再服从本页的领域筛选与搜索 —— 推荐只决定先后，不制造看不见。
 */
const presetList = computed<PresetTheory[]>(() => {
  const r = assessment.results[modeStore.id]
  const order = recommendOrder(r?.dims, r?.tier)
  const sorted = [...PRESET_THEORIES].sort(
    (a, b) => order.indexOf(a.topic) - order.indexOf(b.topic),
  )
  const k = kw.value.trim().toLowerCase()
  return sorted.filter((p) => {
    if (topic.value !== '全部' && p.topic !== topic.value) return false
    if (!k) return true
    return `${p.title}${p.content}${p.why}`.toLowerCase().includes(k)
  })
})

/** 已收下判定：按「标题 + 内容」与我的理匹配。不另存一份"收过"清单 —— 那会变成第二份真相 */
function isTaken(p: PresetTheory): boolean {
  return observe.theories.some((t) => t.title === p.title && t.content === p.content)
}

const takenCount = computed(() => PRESET_THEORIES.filter((p) => isTaken(p)).length)

/**
 * 收下一条预置理：写进我的理（自带「为什么成立」，直接入册）。
 * 不入账修为 —— 保存本来就不入账，钱在「处理 / 用上了」时才付。
 */
function adoptPreset(p: PresetTheory): void {
  const item = observe.add({
    kind: 'theory',
    form: 'quote',
    title: p.title,
    content: p.content,
    // 一句话形态没有「你的话」摘要与金句位，置空走理的正门（why）
    summary: '',
    golden: [],
    why: p.why,
    topics: [p.topic],
    tags: ['预置'],
    sourceName: '预置三十条',
  })
  if (!item) {
    uni.showToast({ title: '库满了 · 先清理几条', icon: 'none' })
    return
  }
  uni.showToast({ title: '已收下 · 它现在是你的一条理', icon: 'none' })
}

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
  showModal({
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

/* ---------------- 卡片上的摘要 / 正文限高 / 详情入口（2026-09-19） ----------------
 * 这一页装的是「理」，而理可以是从一篇文章里认出来的 —— 那张卡片于是有两件事不对：
 *  1. 正文最长可以有一万字（记一笔的上限），平铺在列表里会把整列挤没；
 *  2. 而真正要你回头找的「摘要」（你用自己话压出来的那两三句）反而看不见。
 * 所以：卡片先给摘要、正文只留三行预览、要看全文点「详情」去详情页（那一页本来就有展开）。
 * 一句话形态不掺和 —— 它的正文就是那一句，短，也就没有"详情"可点。
 */
function isDoc(it: ObsItem): boolean {
  return it.form !== 'quote'
}

/** 摘要优先，没写摘要就退回「一句话总结」—— 标签跟着换，不能把总结说成摘要 */
function briefLabel(it: ObsItem): string {
  return it.digest ? '摘要' : '一句话总结'
}

function briefText(it: ObsItem): string {
  return it.digest || it.summary || ''
}

/** 全文在详情页（收件匣与理库看的是同一条数据，编辑入口也在那边） */
function goDetail(id: string): void {
  navigateTo(ROUTES.observeDetail, { id })
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

</script>

<style lang="scss" scoped>
@import './index.scss';
</style>

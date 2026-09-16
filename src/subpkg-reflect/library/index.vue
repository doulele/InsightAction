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
      <view class="op op--main" hover-class="gz-hover" @click="openAdd">＋ 转述一条（Lv.1）</view>
      <view class="op" hover-class="gz-hover" @click="importOpen = true">播种收成</view>
      <view class="op" hover-class="gz-hover" @click="openDigest">
        {{ aiAvailable ? 'AI 极简报' : '极简报' }}
      </view>
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
        <!--
          语音转写（微信同声传译插件）：按住说话、松开出字。
          识别在微信侧完成，音频不出微信 —— 我们连录音文件都不读（见 utils/voice.ts）。
          插件不可用（没在后台添加 / 基础库过低）时整条不渲染：宁可没有按钮，
          也不给一个按下去没反应的按钮。
        -->
        <view v-if="voiceOk" class="voice">
          <view
            class="voice__btn"
            :class="{ 'is-rec': recording }"
            hover-class="none"
            @touchstart.prevent="onVoiceStart"
            @touchend.prevent="onVoiceStop"
            @touchcancel.prevent="onVoiceCancel"
          >
            <text class="voice__dot">●</text>
            <text class="voice__label">{{ recording ? '松开 · 出字' : '按住说话' }}</text>
          </view>
          <text class="voice__hint">{{ voiceHint || '说一遍就等于转述一遍 · 最长 60 秒' }}</text>
        </view>
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
        <!--
          已选标签（含 AI 给的）：预设之外的标签也在这里 —— 否则 AI 打了个"复利"，
          它不在预设里，用户根本看不见自己存了什么。AI 给的带角标，点一下移除。
        -->
        <view v-if="noteTags.length" class="sheet__tag-row">
          <view
            v-for="t in noteTags"
            :key="t"
            class="sheet__chip is-on"
            hover-class="gz-hover"
            @click="toggleNoteTag(t)"
          >
            {{ t }}
            <AiBadge v-if="aiAddedTags.includes(t)" source="ai" mini />
          </view>
        </view>
        <!-- 打标签 / 费曼检验：AI 可用走 AI，不可用自动落基础规则（utils/localAi），功能始终可用 -->
        <view class="ai-row">
          <view class="ai-row__btn" :class="{ 'is-off': busy === 'tags' }" hover-class="gz-hover" @click="aiTag">
            {{ aiAvailable ? 'AI 打个标签' : '打个标签' }}
          </view>
          <view
            class="ai-row__btn"
            :class="{ 'is-off': busy === 'feynman' }"
            hover-class="gz-hover"
            @click="aiCheck"
          >
            费曼检验一下
          </view>
        </view>
        <text class="ai-row__hint">
          {{ aiAvailable ? '标签还能再改 · 检验只针对你写的正文' : '当前为基础规则 · 标签还能再改' }}
        </text>

        <!-- 费曼检验结果：先给结论，再给大白话版，最后抛一个追问 -->
        <view v-if="feynman" class="fy">
          <view class="fy__head-row">
            <text class="fy__head" :class="{ 'is-clear': feynman.clear }">
              {{ feynman.clear ? '讲明白了' : '还有没讲透的地方' }}
            </text>
            <!-- AI 出的要标 AI，基础出的也要标基础方便区分：两个方向都不能含糊 -->
            <AiBadge :source="feynman.source" :text="feynman.source === 'ai' ? 'AI 检验' : '基础规则'" />
          </view>
          <!-- 基础兜底额外说一句：规则查不出真正的逻辑漏洞，别让用户以为是模型判断 -->
          <text v-if="feynman.source === 'local'" class="fy__src">按规则检查，不是 AI 判断</text>
          <text v-if="feynman.plainVersion" class="fy__plain">大白话：{{ feynman.plainVersion }}</text>
          <text v-for="(x, i) in feynman.issues" :key="i" class="fy__item">· {{ x }}</text>
          <text v-if="feynman.question" class="fy__ask">追问：{{ feynman.question }}</text>
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

    <!-- AI 极简报：最近一批卡片压成一条 -->
    <view v-if="digestOpen" class="mask" @click="digestOpen = false">
      <view class="sheet" @click.stop>
        <view class="sheet__title-row">
          <text class="sheet__title">极简报</text>
          <AiBadge
            v-if="digest"
            :source="digest.source"
            :text="digest.source === 'ai' ? 'AI 生成' : '基础汇总'"
          />
        </view>
        <text class="sheet__sub">
          {{ digest ? `最近 ${digestSource.length} 张卡，压成了这一条` : '正在整理这批卡片…' }}
        </text>
        <text v-if="digest && digest.source === 'local'" class="sheet__src">
          只做归纳，不判断这几条之间的联系
        </text>
        <text v-if="digest" class="sheet__content">{{ digest.summary }}</text>
        <view v-if="digest && digest.highlights.length" class="hl">
          <text v-for="(h, i) in digest.highlights" :key="i" class="hl__item">{{ h }}</text>
        </view>
        <view class="sheet__btn" hover-class="gz-hover" @click="makeDigest">再压一次</view>
        <view class="sheet__close" hover-class="gz-hover" @click="digestOpen = false">关闭</view>
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

    <!-- 隐私授权拦截弹窗：录音（scope.record）属隐私接口，首次调用前要过这道门 -->
    <PrivacyGate />
  </view>
</template>

<script setup lang="ts">
/**
 * 知识库（批次 C）· 分包 subpkg-reflect：全部知识卡片按关键词/标签/深度检索；
 * 支持「转述一条」作为 Lv.1 起点（可**按住说话**口述，见 utils/voice.ts）、
 * 把概念播种的收成导入为 Lv.2；单卡可加深一层（Lv.1→2→3）。
 * **AI 智能打标与费曼检验已接线**（`/ai/tags`、`/ai/feynman`）：未授权、未在白名单或失败时
 * 自动落 `utils/localAi` 的本机规则，按钮永远不会变成死按钮。
 */
import { computed, ref } from 'vue'
import { onLoad, onUnload } from '@dcloudio/uni-app'
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
import AiBadge from '@/components/AiBadge/AiBadge.vue'
import { useAi } from '@/composables/useAi'
import { startVoice, voiceAvailable, type VoiceSession } from '@/utils/voice'
import { ROUTES } from '@/router/routes'
import type { DigestResult, FeynmanResult } from '@/api/modules/ai'

const knowledge = useKnowledgeStore()
const seed = useSeedStore()
const skinClass = useSkinClass()
/** AI 三能力：智能标签 / 费曼速记 / 极简报。失败只提示，不打断手动录入 */
const ai = useAi()
/** 顶层 ref，模板里可直接判断"哪一项在跑"（busy === 'tags'） */
const busy = ai.busy
/** 当前是否走真 AI（false = 基础兜底，按钮文案要去掉"AI"二字） */
const aiAvailable = ai.available

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

/**
 * 本次由 AI 给的标签 —— 只记**真正新加**的，用户自己点过的不算。
 *
 * 为什么非要记下来：这些标签会跟着卡片存进知识库，事后根本分不清
 * 「这是我写的还是 AI 加的」。当下不打标，过一周就永远说不清了。
 */
const aiAddedTags = ref<string[]>([])

function toggleNoteTag(t: string): void {
  noteTags.value = noteTags.value.includes(t) ? noteTags.value.filter((x) => x !== t) : [...noteTags.value, t]
  // 移除标签时同步摘掉它的 AI 角标，否则再选一次会误标成 AI 给的
  if (!noteTags.value.includes(t)) aiAddedTags.value = aiAddedTags.value.filter((x) => x !== t)
}

/* 智能标签 + 费曼速记 —— 都是增强，AI 不可用时自动落基础规则，功能始终可用 */

/** 费曼检验结果。换一条转述就清掉，避免上一条的结论误导下一条 */
const feynman = ref<FeynmanResult | null>(null)

/** 打标签的素材：标题 + 正文一起给，标题往往已经点明了领域 */
const tagSource = computed(() => `${noteTitle.value.trim()} ${noteBody.value.trim()}`.trim())

/** 正文太短就没必要花这一次调用（也问不出什么） */
const canAi = computed(() => noteBody.value.trim().length >= 10 && !busy.value)

async function aiTag(): Promise<void> {
  if (!canAi.value) {
    uni.showToast({ title: '先写几句正文', icon: 'none' })
    return
  }
  const before = [...noteTags.value]
  const r = await ai.tags(tagSource.value)
  if (!r) return
  // 与已选标签合并去重，AI 的排在后面 —— 不覆盖用户自己选的
  const merged = [...noteTags.value]
  r.tags.forEach((t) => {
    if (!merged.includes(t)) merged.push(t)
  })
  noteTags.value = merged
  // 只标记本次真正新加的：用户自己选过的不算 AI 给的
  const added = merged.filter((t) => !before.includes(t))
  aiAddedTags.value = [...new Set([...aiAddedTags.value, ...added])]
  // toast 里也说明来源，别让用户以为基础规则的结果是模型打的
  uni.showToast({
    title: added.length
      ? `${r.source === 'ai' ? 'AI' : '基础规则'}加了 ${added.length} 个标签`
      : '没想出合适的标签',
    icon: 'none',
  })
}

async function aiCheck(): Promise<void> {
  if (!canAi.value) {
    uni.showToast({ title: '先写几句正文', icon: 'none' })
    return
  }
  const r = await ai.feynman(noteBody.value.trim())
  if (r) feynman.value = r
}

function openAdd(): void {
  feynman.value = null
  aiAddedTags.value = []
  addOpen.value = true
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
  aiAddedTags.value = []
  feynman.value = null
  uni.showToast({ title: '已存进知识库 · Lv.1', icon: 'none' })
}

/* ---------------- 语音转写：按住说话 → 松开出字（费曼速记的入口） ---------------- */

/**
 * 插件可用性在**进页面时探一次**即可：
 * 不可用（没在后台添加插件 / 基础库过低）就整条不渲染 ——
 * 宁可没有按钮，也不给一个按下去没反应的按钮。
 */
const voiceOk = ref(voiceAvailable())
const recording = ref(false)
const voiceHint = ref('')
let voiceSession: VoiceSession | null = null

function onVoiceStart(): void {
  if (recording.value) return
  voiceHint.value = '正在听…'
  voiceSession = startVoice({
    onPartial: (t) => {
      /* 只做"正在听"的即时反馈，不回写正文 —— 边说边改会让整段字在眼前跳 */
      voiceHint.value = `正在听：${t.slice(-10)}`
    },
    onDone: (text) => {
      recording.value = false
      voiceSession = null
      appendVoice(text)
    },
    onFail: (f) => {
      recording.value = false
      voiceSession = null
      if (f.reason === 'unsupported') {
        voiceOk.value = false
        return
      }
      if (f.reason === 'empty') {
        voiceHint.value = '没听清 · 按住再说一遍'
        return
      }
      voiceHint.value = ''
      if (f.reason === 'denied') {
        /* 不硬讨授权：给一条同样走得通的路（手打字），别把用户堵在门口 */
        uni.showModal({
          title: '需要麦克风权限',
          content: '语音转写要用麦克风。可以在设置里打开权限，也可以直接手打 —— 两条路都通向同一张卡片。',
          confirmText: '去设置',
          cancelText: '手打字',
          success: (r) => {
            if (r.confirm) uni.openSetting({})
          },
        })
        return
      }
      uni.showToast({ title: f.message, icon: 'none' })
    },
  })
  if (voiceSession) recording.value = true
  else voiceHint.value = ''
}

function onVoiceStop(): void {
  if (!recording.value || !voiceSession) return
  voiceHint.value = '正在转成文字…'
  voiceSession.stop()
}

/** 手指滑出按钮范围 → 这次不算（与微信语音消息的手感一致） */
function onVoiceCancel(): void {
  if (!voiceSession) return
  voiceSession.abort()
  voiceSession = null
  recording.value = false
  voiceHint.value = ''
}

/**
 * 转写结果**追加**进正文：手打过的字不能被一次语音抹掉。
 * 超出 400 字就截断（与 textarea 的 maxlength 同一口径，不然存下来会被页面截成两半）。
 */
function appendVoice(text: string): void {
  const prev = noteBody.value.trim()
  const merged = prev ? `${prev}${text}` : text
  noteBody.value = merged.slice(0, 400)
  voiceHint.value = merged.length > 400 ? '已转成文字 · 超出 400 字的部分已截断' : '已转成文字 · 再检验一下就更值'
  /* 正文变了，上一条检验结论就作废 —— 理由同 openAdd()：旧结论会误导新内容 */
  feynman.value = null
}

/* 离开页面时把还在录的那次收掉，别让麦克风在后台开着 */
onUnload(() => {
  voiceSession?.abort()
  voiceSession = null
})

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

/* AI 极简报：把最近一批卡片压成一条 */

/** 一次最多压这么多张 —— 再多的边际价值低于多花的钱 */
const DIGEST_N = 12
const digestOpen = ref(false)
const digest = ref<DigestResult | null>(null)

/** 知识库按时间倒序，取前 N 条即"最近这批" */
const digestSource = computed(() => knowledge.cards.slice(0, DIGEST_N).map((c) => `${c.title}：${c.content}`))

async function makeDigest(): Promise<void> {
  if (!digestSource.value.length) {
    uni.showToast({ title: '知识库还是空的', icon: 'none' })
    return
  }
  const r = await ai.digest(digestSource.value)
  if (r) digest.value = r
}

/** 打开即压一次：少一步点击，也让"还没内容时"有明确的进度感 */
function openDigest(): void {
  digestOpen.value = true
  digest.value = null
  void makeDigest()
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

/**
 * `?add=1` = 直接展开转述面板。
 * 知大厅的「费曼速记」入口就是带着它进来的 —— 那个入口要的是"立刻说一段"，
 * 不该让人先看一屏卡片列表再自己找「转述一条」。
 */
onLoad((query) => {
  if ((query as Record<string, string>)?.add === '1') openAdd()
})
</script>

<style lang="scss" scoped>
@import './index.scss';
</style>

<template>
  <view class="page" :class="skinClass">
    <SubNav :fallback="ROUTES.tabMe">{{ words.title }}</SubNav>

    <!--
      页首那一句（2026-09-23 定稿）：把定位讲清楚 ——
      这里不是广场，是「开发者 ↔ 你」的一条线。文案在 config/feedback.ts 的 intro，
      三模式各一句，页面不写中文（那条注释里写了为什么用词要收敛）。
    -->
    <view class="intro">
      <text class="intro__line">{{ words.intro }}</text>
      <view v-if="store.pendingCount > 0" class="intro__pending" hover-class="gz-hover" @click="retryPending(false)">
        <text class="intro__pending-text">{{ store.pendingCount }} 条还没送出去 · 点这里重发</text>
      </view>
    </view>

    <!-- 三段：更新 / 路线 / 回音 -->
    <view class="segs">
      <view
        v-for="t in tabs"
        :key="t.key"
        class="seg"
        :class="{ 'is-on': tab === t.key }"
        hover-class="gz-hover"
        @click="switchTab(t.key)"
      >
        <text class="seg__label">{{ t.label }}</text>
        <text class="seg__hint">{{ t.hint }}</text>
      </view>
    </view>

    <!-- 连不上时的兜底：不装作"这里是空的" -->
    <view v-if="errMsg" class="err">
      <text class="err__text">{{ errMsg }}</text>
      <view class="err__btn" hover-class="gz-hover" @click="reload">重试</view>
    </view>

    <!-- ================= 更新 ================= -->
    <view v-if="tab === 'updates'" class="sec">
      <view v-if="!changelog.length" class="empty">
        <text class="empty__title">{{ words.emptyUpdates }}</text>
      </view>
      <view
        v-for="c in changelog"
        :key="c.version"
        class="rel"
        :class="{ 'is-current': c.current }"
      >
        <view class="rel__head" hover-class="gz-hover" @click="toggleRelease(c.version)">
          <view class="rel__left">
            <text v-if="c.current" class="rel__badge">本次</text>
            <text class="rel__title">{{ c.title }}</text>
            <text class="rel__meta">v{{ c.version }} · {{ c.date }}</text>
          </view>
          <text class="rel__fold">{{ isOpen(c.version) ? '收起' : '展开' }}</text>
        </view>
        <view v-if="isOpen(c.version)" class="rel__items">
          <text v-for="(it, i) in c.items" :key="i" class="rel__item">{{ it }}</text>
        </view>
      </view>
    </view>

    <!-- ================= 路线 ================= -->
    <view v-else-if="tab === 'roadmap'" class="sec">
      <view v-if="!roadmapGroups.length" class="empty">
        <text class="empty__title">{{ words.emptyRoadmap }}</text>
      </view>
      <view v-for="g in roadmapGroups" :key="g.stage" class="stage">
        <view class="stage__head">
          <text class="stage__title">{{ g.label }}</text>
          <text class="stage__num">{{ g.items.length }}</text>
        </view>
        <view v-for="r in g.items" :key="r.id" class="road">
          <text class="road__title">{{ r.title }}</text>
          <text v-if="r.note" class="road__note">{{ r.note }}</text>
          <!--
            「我也想要」：路线图上的那一票。这一票是有用的 ——
            它决定下面这些事我先做哪个（页面刻意不做"热度榜"，只留这一颗按钮）。
          -->
          <view class="road__foot">
            <view
              class="want"
              :class="{ 'is-on': myVote(routeKey(r.id)) === 1 }"
              hover-class="gz-hover"
              @click="toggleVote(routeKey(r.id))"
            >
              <text class="want__label">{{ words.wantUp }}</text>
              <text v-if="r.votes.up > 0" class="want__num">{{ r.votes.up }}</text>
            </view>
          </view>
        </view>
      </view>
    </view>

    <!-- ================= 回音 ================= -->
    <view v-else class="sec">
      <!-- 管理员相关：还没人管 / 我是管的人（都只在这两处出现，页面别处不露） -->
      <view v-if="needBootstrap" class="banner">
        <text class="banner__text">还没有人放行这里的话 · 如果你就是开发者，先认领</text>
        <view class="banner__btn" hover-class="gz-hover" @click="claim">设为我的</view>
      </view>
      <view v-else-if="isAdmin" class="banner banner--admin">
        <text class="banner__text">你是管理员 · 待回应 {{ pendingReview }} 条</text>
        <text class="banner__id" hover-class="gz-hover" @click="copyMyId">我的 ID</text>
      </view>

      <!-- 搜索 + 分类 + 排序 -->
      <view class="tools">
        <input
          v-model="kw"
          class="tools__input"
          placeholder="搜你说过的话"
          placeholder-class="tools__ph"
          confirm-type="search"
          @confirm="loadPosts"
        />
        <view class="chips">
          <view
            v-for="c in typeChips"
            :key="c.key"
            class="chip"
            :class="{ 'is-on': typeFilter === c.key }"
            hover-class="gz-hover"
            @click="pickType(c.key)"
          >
            {{ c.label }}
          </view>
        </view>
        <view class="tools__row">
          <view class="sorts">
            <text
              v-for="s in FEEDBACK_SORTS"
              :key="s.key"
              class="sort"
              :class="{ 'is-on': sort === s.key }"
              @click="pickSort(s.key)"
            >
              {{ s.label }}
            </text>
          </view>
          <text class="mine" :class="{ 'is-on': scope === 'mine' }" @click="pickScope()">
            只看我发的
          </text>
        </view>
      </view>

      <view v-if="loading" class="empty">
        <text class="empty__title">读取中…</text>
      </view>
      <view v-else-if="!posts.length" class="empty">
        <text class="empty__title">{{ words.emptyVoices }}</text>
        <text class="empty__text">{{ words.emptyVoicesHint }}</text>
      </view>

      <view
        v-for="p in posts"
        :key="p.id"
        class="voice"
        hover-class="gz-hover"
        @click="goPost(p.id)"
      >
        <view class="voice__top">
          <text class="voice__type">{{ TYPE_LABEL[p.type] }}</text>
          <text class="voice__status" :class="`is-${statusTone(p.status)}`">
            {{ STATUS_LABEL[p.status] }}
          </text>
        </view>
        <text class="voice__title">{{ p.title }}</text>
        <text v-if="p.preview" class="voice__preview">{{ p.preview }}</text>
        <view class="voice__foot">
          <text class="voice__who">{{ who(p) }}</text>
          <text class="voice__time">{{ when(p.createdAt) }}</text>
        </view>
        <!-- 赞 / 踩：与"我也想要"同一颗心，只是这里还有另一面 -->
        <view class="voice__acts">
          <view
            class="act"
            :class="{ 'is-on': myVote(postKey(p.id)) === 1 }"
            hover-class="gz-hover"
            @click.stop="toggleVote(postKey(p.id))"
          >
            <text class="act__label">{{ words.voteUp }}</text>
            <text class="act__num">{{ p.votes.up }}</text>
          </view>
          <view
            class="act"
            :class="{ 'is-on': myVote(postKey(p.id)) === -1 }"
            hover-class="gz-hover"
            @click.stop="toggleVote(postKey(p.id))"
          >
            <text class="act__label">{{ words.voteDown }}</text>
            <text class="act__num">{{ p.votes.down }}</text>
          </view>
          <text class="voice__replies">
            {{ p.comments > 0 ? `${p.comments} 条回应` : '还没有回应' }}
            <text v-if="p.lastReplyOfficial" class="voice__official"> · 已回</text>
          </text>
        </view>
      </view>
    </view>

    <view class="foot">
      <text class="foot__text">你写的每一句，都会有人看</text>
    </view>

    <!-- 底部一条：写一句（fixed，页面底部留出同高的空位） -->
    <view class="bar">
      <view class="bar__btn" hover-class="gz-hover" @click="openCompose">
        <text class="bar__text">{{ words.write }}</text>
      </view>
    </view>

    <!-- 隐私授权拦截弹窗（复制"我的 ID"要用剪贴板） -->
    <PrivacyGate />
  </view>
</template>

<script setup lang="ts">
/**
 * 我 · 回音壁（分包 subpkg-me/feedback）：更新 / 路线 / 回音 三段。
 *
 * 数据都在服务器上（后端 /guanzhi/feedback），本机只留三样东西（stores/feedback.ts）：
 * 待发的队列、成功送出的条数（徽章用）、更新看到哪一版了。
 *
 * 界面刻意**不做**这些（见 config/feedback.ts 文件头第 1 条）：
 * 大图信息流、热度排行、个人主页、别人的昵称头像（除非他自己选择署名）。
 * 它是"开发者 ↔ 你"的一条线，不是人群之间的广场 —— 页面越像广场，过审越危险。
 */
import { computed, ref } from 'vue'
import { onShow } from '@dcloudio/uni-app'
import {
  claimFeedbackAdmin,
  fetchFeedbackBoard,
  fetchFeedbackPosts,
  fetchFeedbackWhoami,
  voteFeedback,
  type BoardChangelogEntry,
  type BoardRoadmapEntry,
  type FeedbackBoard,
  type FeedbackListItem,
  type FeedbackVoteCounts,
} from '@/api/modules/feedback'
import {
  FEEDBACK_SORTS,
  FEEDBACK_STATUS_LABEL,
  FEEDBACK_TYPE_LABEL,
  FEEDBACK_TYPES,
  feedbackTabs,
  feedbackWords,
  ROADMAP_STAGE_LABEL,
  statusTone,
  type FeedbackTab,
  type FeedbackType,
  type RoadmapStage,
} from '@/config/feedback'
import { useAccountStore } from '@/stores/account'
import { useFeedbackStore } from '@/stores/feedback'
import { useModeStore } from '@/stores/mode'
import { useSkinClass } from '@/composables/useSkin'
import { navigateTo, ROUTES } from '@/router/routes'

const modeStore = useModeStore()
const account = useAccountStore()
const store = useFeedbackStore()
const skinClass = useSkinClass()

const words = computed(() => feedbackWords(modeStore.id))
const tabs = computed(() => feedbackTabs(modeStore.id))

const tab = ref<FeedbackTab>('updates')
const board = ref<FeedbackBoard | null>(null)
const posts = ref<FeedbackListItem[]>([])
const loading = ref(false)
const errMsg = ref('')
const isAdmin = ref(false)
const needBootstrap = ref(false)
/** 待回应的条数（只有管理员拿得到；由 /feedback/board 给，普通用户恒为 0） */
const pendingReview = ref(0)

/* 列表的筛选（服务端算，见 api/modules/feedback.ts） */
const kw = ref('')
const typeFilter = ref<FeedbackType | ''>('')
const scope = ref<'all' | 'mine'>('all')
const sort = ref<'new' | 'hot'>('new')

/* 更新日志的展开态：默认只摊开「本次」那一条 */
const openReleases = ref<Record<string, boolean>>({})

const TYPE_LABEL = FEEDBACK_TYPE_LABEL
const STATUS_LABEL = FEEDBACK_STATUS_LABEL

const changelog = computed<BoardChangelogEntry[]>(() => board.value?.changelog ?? [])

/** 路线图分栏：在做 → 打算做 → 已经做了 → 先搁下（顺序即"离用户最近"的顺序） */
const roadmapGroups = computed(() => {
  const order: RoadmapStage[] = ['doing', 'planned', 'done', 'paused']
  const list = board.value?.roadmap ?? []
  return order
    .map((stage) => ({
      stage,
      label: ROADMAP_STAGE_LABEL[stage],
      items: list.filter((r) => r.stage === stage) as BoardRoadmapEntry[],
    }))
    .filter((g) => g.items.length > 0)
})

interface TypeChip {
  key: FeedbackType | ''
  label: string
}

const typeChips = computed<TypeChip[]>(() => [
  { key: '', label: '全部' },
  ...FEEDBACK_TYPES.map((t) => ({ key: t as FeedbackType | '', label: TYPE_LABEL[t] })),
])

/* ------------------------------------------------------------------ *
 * 取数
 * ------------------------------------------------------------------ */

onShow(() => {
  void boot()
})

/**
 * 进页流程。
 *
 * 先**静默登录**再取数：登录只是一次 wx.login 换 token（不传任何修行数据），
 * 但它是"能认出我"的前提 —— 没有它，你自己那条还在等回应的帖会看不见，
 * 列表里也不会有「我发过的」标记，用户会以为东西丢了。
 * 登录失败（没网）就退回游客视角：公开内容照样看得到。
 */
async function boot(): Promise<void> {
  try {
    await account.ensureToken()
  } catch {
    /* 当游客 */
  }
  await Promise.all([loadBoard(), loadPosts()])
  if (store.pendingCount > 0) await retryPending(true)
}

async function loadBoard(): Promise<void> {
  try {
    const data = await fetchFeedbackBoard(account.token || undefined)
    board.value = data
    /* 记下"服务端现在是第几版"——「我」页入口那枚「有更新」徽标读它（不必为本页之外再发请求） */
    store.noteBoard(data.boardVersion)
    isAdmin.value = data.isAdmin
    needBootstrap.value = data.needBootstrap
    pendingReview.value = data.pendingReview
    const current = data.changelog.find((c) => c.current)
    if (current && openReleases.value[current.version] === undefined) {
      openReleases.value = { ...openReleases.value, [current.version]: true }
    }
    if (tab.value === 'updates') store.markBoardSeen(data.boardVersion)
  } catch {
    errMsg.value = '连不上回音壁 · 检查网络后重试'
  }
}

async function loadPosts(): Promise<void> {
  loading.value = true
  try {
    const data = await fetchFeedbackPosts(account.token || undefined, {
      q: kw.value.trim(),
      type: typeFilter.value,
      scope: scope.value,
      sort: sort.value,
    })
    posts.value = data.items
    isAdmin.value = data.isAdmin
    errMsg.value = ''
  } catch {
    posts.value = []
    errMsg.value = '连不上回音壁 · 检查网络后重试'
  } finally {
    loading.value = false
  }
}

function reload(): void {
  errMsg.value = ''
  void Promise.all([loadBoard(), loadPosts()])
}

/** 有待发时补发一次（silent = 自动补发，成功不弹提示） */
async function retryPending(silent = false): Promise<void> {
  const r = await store.flush()
  if (r.sent) {
    if (!silent) uni.showToast({ title: `送出 ${r.sent} 条`, icon: 'none' })
    await loadPosts()
    if (isAdmin.value) await loadBoard()
  } else if (!silent) {
    uni.showToast({ title: r.failed ? '还是没送出去 · 检查网络' : '没有待发的', icon: 'none' })
  }
}

/* ------------------------------------------------------------------ *
 * 交互
 * ------------------------------------------------------------------ */

function switchTab(key: FeedbackTab): void {
  tab.value = key
  if (key === 'updates' && board.value) store.markBoardSeen(board.value.boardVersion)
}

function isOpen(version: string): boolean {
  return openReleases.value[version] === true
}

function toggleRelease(version: string): void {
  openReleases.value = { ...openReleases.value, [version]: !isOpen(version) }
}

function pickType(key: FeedbackType | ''): void {
  typeFilter.value = key
  void loadPosts()
}

function pickSort(key: 'new' | 'hot'): void {
  sort.value = key
  void loadPosts()
}

function pickScope(): void {
  scope.value = scope.value === 'mine' ? 'all' : 'mine'
  void loadPosts()
}

const postKey = (id: string): string => `post:${id}`
const routeKey = (id: string): string => `route:${id}`

function myVote(key: string): number {
  return board.value?.myVotes?.[key] ?? 0
}

/** 投票 / 取消（同一颗按钮再点一次就是取消） */
async function toggleVote(key: string): Promise<void> {
  const next: 1 | 0 = myVote(key) === 1 ? 0 : 1
  try {
    await account.withAuth(async (token) => {
      const res = await voteFeedback(token, key, next)
      applyVote(key, res)
    })
  } catch {
    uni.showToast({ title: '这一票没记上', icon: 'none' })
  }
}

/** 把投票结果就地写回（重新拉一次列表当然也对，但那样点一下要等一个来回） */
function applyVote(key: string, res: FeedbackVoteCounts): void {
  if (board.value) {
    board.value.myVotes = { ...board.value.myVotes, [key]: res.my }
    if (key.startsWith('route:')) {
      const id = key.slice(6)
      board.value.roadmap = board.value.roadmap.map((r) =>
        r.id === id ? { ...r, votes: { up: res.up, down: res.down } } : r,
      )
    }
  }
  if (key.startsWith('post:')) {
    const id = key.slice(5)
    posts.value = posts.value.map((p) => (p.id === id ? { ...p, votes: res } : p))
  }
}

function goPost(id: string): void {
  navigateTo(ROUTES.meFeedbackPost, { id })
}

function openCompose(): void {
  navigateTo(ROUTES.meFeedbackCompose)
}

/** 还没人管时自举管理员（后端只在名单为空时认，见 services/feedbackStore.js） */
async function claim(): Promise<void> {
  try {
    await account.withAuth((token) => claimFeedbackAdmin(token))
    uni.showToast({ title: '好 · 往后我来回应', icon: 'none' })
    await loadBoard()
  } catch {
    uni.showToast({ title: '已经有人管了', icon: 'none' })
  }
}

/**
 * 把「我的 ID」复制到剪贴板。
 * 存在的理由：配 FEEDBACK_ADMIN_OPENIDS 需要管理员自己的 openid，
 * 而普通人没法从微信那边看到它 —— 长按复制比"去翻服务器日志"现实得多。
 */
async function copyMyId(): Promise<void> {
  try {
    const res = await account.withAuth((token) => fetchFeedbackWhoami(token))
    needBootstrap.value = res.needBootstrap
    uni.setClipboardData({
      data: res.openid,
      success: () => uni.showToast({ title: '已复制 · 填进后台名单即可', icon: 'none' }),
    })
  } catch {
    uni.showToast({ title: '没拿到 · 检查网络', icon: 'none' })
  }
}

/* ------------------------------------------------------------------ *
 * 展示用的小函数
 * ------------------------------------------------------------------ */

/** 谁说的：署名优先；没署名就是「道友 · 称号」（称号拿不到就只写道友） */
function who(item: FeedbackListItem): string {
  if (item.mine) return '我'
  const name = item.author.name
  if (name) return name
  const tier = item.author.tier
  return tier ? `${words.value.anonymous} · ${tier}` : words.value.anonymous
}

const pad = (n: number): string => String(n).padStart(2, '0')

function when(iso: string): string {
  const t = Date.parse(iso)
  if (!Number.isFinite(t)) return ''
  const d = new Date(t)
  const now = new Date()
  const same = (x: Date, y: Date): boolean =>
    x.getFullYear() === y.getFullYear() && x.getMonth() === y.getMonth() && x.getDate() === y.getDate()
  if (same(d, now)) return `今天 ${pad(d.getHours())}:${pad(d.getMinutes())}`
  const yest = new Date(now)
  yest.setDate(now.getDate() - 1)
  if (same(d, yest)) return '昨天'
  return `${d.getMonth() + 1} 月 ${d.getDate()} 日`
}
</script>

<style lang="scss" scoped>
@import './index.scss';
</style>

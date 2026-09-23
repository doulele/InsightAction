<template>
  <view class="page" :class="skinClass">
    <SubNav :fallback="ROUTES.meFeedback">一条回音</SubNav>

    <view v-if="loading && !post" class="empty">
      <text class="empty__title">读取中…</text>
    </view>

    <view v-else-if="!post" class="empty">
      <text class="empty__title">{{ errMsg || '这条已经不在了' }}</text>
      <text class="empty__text">它可能被作者撤回了，或者还没有被放出来。</text>
    </view>

    <template v-else>
      <!-- 原帖 -->
      <view class="post" :class="`is-${tone}`">
        <view class="post__top">
          <text class="post__type">{{ TYPE_LABEL[post.type] }}</text>
          <text class="post__status">{{ STATUS_LABEL[post.status] }}</text>
        </view>
        <text class="post__title">{{ post.title }}</text>
        <text v-if="post.body" class="post__body">{{ post.body }}</text>
        <view class="post__foot">
          <text class="post__who">{{ who }}</text>
          <text class="post__time">{{ when(post.createdAt) }}</text>
        </view>

        <!-- 赞 / 踩 -->
        <view class="post__acts">
          <view
            class="act"
            :class="{ 'is-on': myVote === 1 }"
            hover-class="gz-hover"
            @click="toggleVote()"
          >
            <text class="act__label">{{ words.voteUp }}</text>
            <text class="act__num">{{ post.votes.up }}</text>
          </view>
          <view
            class="act"
            :class="{ 'is-on': myVote === -1 }"
            hover-class="gz-hover"
            @click="toggleVote(true)"
          >
            <text class="act__label">{{ words.voteDown }}</text>
            <text class="act__num">{{ post.votes.down }}</text>
          </view>
        </view>
      </view>

      <!-- 「这次不做」的理由：只有作者与开发者看得到 -->
      <view v-if="post.officialNote" class="note">
        <text class="note__label">为什么不</text>
        <text class="note__text">{{ post.officialNote }}</text>
      </view>

      <!-- 处理（只有开发者看得到）：放行 / 列入 / 在做 / 已做 / 不做 -->
      <view v-if="isAdmin" class="admin">
        <text class="admin__title">处理这条</text>
        <view class="admin__chips">
          <view
            v-for="s in REVIEW_STATES"
            :key="s.key"
            class="chip"
            :class="{ 'is-on': post.status === s.key }"
            hover-class="gz-hover"
            @click="pickStatus(s.key)"
          >
            {{ s.label }}
          </view>
        </view>
        <text class="admin__hint">「放出」之后别人才能看到这条；「不做」会附一句为什么</text>
      </view>

      <!-- 回应 -->
      <view class="sec">
        <view class="sec__head">
          <text class="sec__title">回应</text>
          <text class="sec__num">{{ post.comments.length }}</text>
        </view>

        <view v-if="!post.comments.length" class="empty empty--mini">
          <text class="empty__text">
            {{ post.allowComment ? '还没有人回应' : '作者关掉了这条的回应' }}
          </text>
        </view>

        <view
          v-for="c in post.comments"
          :key="c.id"
          class="cmt"
          :class="{ 'is-official': c.official }"
        >
          <view class="cmt__head">
            <text class="cmt__who">{{ c.official ? OFFICIAL_LABEL : whoOf(c) }}</text>
            <text class="cmt__time">{{ when(c.createdAt) }}</text>
          </view>
          <text class="cmt__body">{{ c.body }}</text>
        </view>
      </view>

      <!-- 撤回（作者本人或开发者） -->
      <view v-if="post.canRemove" class="danger" hover-class="gz-hover" @click="removeSelf">
        <text class="danger__text">撤回这一条</text>
      </view>
    </template>

    <!-- 底部：回一句 -->
    <view class="bar">
      <view
        class="bar__btn"
        :class="{ 'is-off': !canReply }"
        hover-class="gz-hover"
        @click="openReply"
      >
        <text class="bar__text">{{ replyLabel }}</text>
      </view>
    </view>

    <!-- 回应的输入（多行）：用主题弹框而不是常驻 textarea —— 原生组件在小程序里层级最高，
         做成 fixed 底栏会盖住一切，且输入时页面上移会跳（项目内既有解法就是 GzDialog 的输入模式） -->
    <GzDialog
      v-model:show="replyShow"
      :input="true"
      :multiline="true"
      :banner="false"
      :title="words.reply"
      placeholder="写一句回应…"
      :maxlength="FEEDBACK_LIMIT.comment"
      confirm-text="送出"
      cancel-text="算了"
      @confirm="sendReply"
    />

    <!-- 「这次不做」的理由 -->
    <GzDialog
      v-model:show="rejectShow"
      :input="true"
      :multiline="true"
      :banner="false"
      title="这次不做"
      content="写一句为什么 —— 这句话只有写的人看得到。"
      placeholder="为什么这次不做？"
      :maxlength="300"
      confirm-text="就这样"
      cancel-text="再想想"
      @confirm="onReject"
    />
  </view>
</template>

<script setup lang="ts">
/**
 * 回音壁 · 一条回音（分包 subpkg-me/feedback/post，`?id=`）。
 *
 * 这一页是**唯一**能看到「开发者处理动作」的地方（放行 / 列入 / 在做 / 已做 / 不做），
 * 也是唯一能看到「不做」的理由的地方 —— 那些按钮只对管理员渲染，
 * 而理由由服务端判归属，前端伪造不了（见 routes/feedback.js）。
 *
 * 回应一律**匿名**（显示成「道友 · 称号」）：回应是就事论事，不署名能少一层社交压力，
 * 也少一份要保护的隐私面。想让人知道是你说的，可以在自己那条里选择署名。
 */
import { computed, ref } from 'vue'
import { onLoad } from '@dcloudio/uni-app'
import {
  commentFeedbackPost,
  fetchFeedbackBoard,
  fetchFeedbackPost,
  removeFeedbackPost,
  reviewFeedbackPost,
  voteFeedback,
  type FeedbackComment,
  type FeedbackDetail,
  type FeedbackVoteCounts,
} from '@/api/modules/feedback'
import {
  FEEDBACK_LIMIT,
  FEEDBACK_STATUS_LABEL,
  FEEDBACK_TYPE_LABEL,
  feedbackWords,
  statusTone,
  type FeedbackStatus,
} from '@/config/feedback'
import { WARN_COLOR } from '@/config/palette'
import { BizError } from '@/types/api'
import { showModal } from '@/utils/dialog'
import { useAccountStore } from '@/stores/account'
import { useModeStore } from '@/stores/mode'
import { useSkinClass } from '@/composables/useSkin'
import { ROUTES } from '@/router/routes'

/** 「开发者」这个落款不随模式变：身份不该因为说法不同而变成另一个人 */
const OFFICIAL_LABEL = '开发者'

const modeStore = useModeStore()
const account = useAccountStore()
const skinClass = useSkinClass()

const words = computed(() => feedbackWords(modeStore.id))

const id = ref('')
const post = ref<FeedbackDetail | null>(null)
const isAdmin = ref(false)
const myVoteMap = ref<Record<string, number>>({})
const loading = ref(false)
const errMsg = ref('')
const replyShow = ref(false)
const rejectShow = ref(false)

const TYPE_LABEL = FEEDBACK_TYPE_LABEL
const STATUS_LABEL = FEEDBACK_STATUS_LABEL

/** 开发者能改到的状态（顺序 = 从"刚收到"到"做完了"） */
const REVIEW_STATES: ReadonlyArray<{ key: FeedbackStatus; label: string }> = [
  { key: 'open', label: '放出' },
  { key: 'planned', label: '列入路线' },
  { key: 'doing', label: '在做' },
  { key: 'done', label: '已做' },
  { key: 'rejected', label: '这次不做' },
]

const tone = computed(() => statusTone(post.value?.status ?? 'open'))
const voteKey = computed(() => `post:${id.value}`)
const myVote = computed(() => myVoteMap.value[voteKey.value] ?? 0)

/* 回应的大门：作者关了回应 / 还没放出来（pending）时都关着 —— 后者对自己也一样，
   因为那时候连一个"回应"都没有意义（帖子本身还没被看到）。 */
const canReply = computed(() => {
  const p = post.value
  if (!p) return false
  if (!p.allowComment && !isAdmin.value) return false
  if (!isAdmin.value && (p.status === 'pending' || p.status === 'rejected')) return false
  return true
})

const replyLabel = computed(() => {
  const p = post.value
  if (!p) return words.value.reply
  if (!p.allowComment && !isAdmin.value) return '作者关掉了回应'
  if (!isAdmin.value && (p.status === 'pending' || p.status === 'rejected')) return '还没放出来，先等等'
  return words.value.reply
})

onLoad((query) => {
  id.value = String(query?.id ?? '')
  void load()
})

async function load(): Promise<void> {
  if (!id.value) return
  loading.value = true
  try {
    /* 静默登录：为了认出"这是我的"与"我投过什么"（登录不上就按游客看公开内容） */
    await account.ensureToken().catch(() => '')
    const [detail, board] = await Promise.all([
      fetchFeedbackPost(account.token || undefined, id.value),
      fetchFeedbackBoard(account.token || undefined).catch(() => null),
    ])
    post.value = detail.post
    if (board) {
      isAdmin.value = board.isAdmin
      myVoteMap.value = board.myVotes
    }
    errMsg.value = ''
  } catch (e) {
    post.value = null
    errMsg.value = e instanceof BizError && e.code !== -1 ? e.message : '连不上回音壁'
  } finally {
    loading.value = false
  }
}

/* ------------------------------------------------------------------ *
 * 投票
 * ------------------------------------------------------------------ */

async function toggleVote(down = false): Promise<void> {
  const current = myVote.value
  const want: 1 | -1 = down ? -1 : 1
  const next: 1 | -1 | 0 = current === want ? 0 : want
  try {
    await account.withAuth(async (token) => {
      const res: FeedbackVoteCounts = await voteFeedback(token, voteKey.value, next)
      myVoteMap.value = { ...myVoteMap.value, [voteKey.value]: res.my }
      if (post.value) post.value = { ...post.value, votes: res }
    })
  } catch {
    uni.showToast({ title: '这一票没记上', icon: 'none' })
  }
}

/* ------------------------------------------------------------------ *
 * 回应
 * ------------------------------------------------------------------ */

function openReply(): void {
  if (!canReply.value) {
    uni.showToast({ title: replyLabel.value, icon: 'none' })
    return
  }
  replyShow.value = true
}

async function sendReply(text: string): Promise<void> {
  const body = text.trim()
  replyShow.value = false
  if (!body) return
  try {
    await account.withAuth((token) => commentFeedbackPost(token, id.value, { body }))
    uni.showToast({ title: '已送出', icon: 'none' })
    await load()
  } catch (e) {
    uni.showToast({ title: e instanceof BizError ? e.message : '没发出去 · 检查网络', icon: 'none' })
  }
}

/* ------------------------------------------------------------------ *
 * 开发者：改状态 / 撤回
 * ------------------------------------------------------------------ */

function pickStatus(status: FeedbackStatus): void {
  if (post.value?.status === status) return
  /* 「这次不做」要先写一句为什么 —— 那条理由是这个功能存在的意义之一 */
  if (status === 'rejected') {
    rejectShow.value = true
    return
  }
  void setStatus(status)
}

function onReject(text: string): void {
  rejectShow.value = false
  void setStatus('rejected', text.trim())
}

async function setStatus(status: FeedbackStatus, note?: string): Promise<void> {
  try {
    await account.withAuth((token) => reviewFeedbackPost(token, { id: id.value, status, note }))
    uni.showToast({ title: STATUS_LABEL[status], icon: 'none' })
    await load()
  } catch (e) {
    uni.showToast({ title: e instanceof BizError ? e.message : '没改成 · 检查网络', icon: 'none' })
  }
}

function removeSelf(): void {
  showModal({
    title: '撤回这一条？',
    content: '撤回后，这条与它下面的回应都会从服务器上删掉，找不回来。',
    confirmText: '撤回',
    confirmColor: WARN_COLOR,
    success: (res) => {
      if (!res.confirm) return
      void (async () => {
        try {
          await account.withAuth((token) => removeFeedbackPost(token, id.value))
          uni.showToast({ title: '已撤回', icon: 'none' })
          setTimeout(() => uni.navigateBack(), 700)
        } catch {
          uni.showToast({ title: '没撤掉 · 检查网络', icon: 'none' })
        }
      })()
    },
  })
}

/* ------------------------------------------------------------------ *
 * 展示
 * ------------------------------------------------------------------ */

const who = computed(() => {
  const p = post.value
  if (!p) return ''
  if (p.mine) return '我'
  if (p.author.name) return p.author.name
  const tier = p.author.tier
  return tier ? `${words.value.anonymous} · ${tier}` : words.value.anonymous
})

function whoOf(c: FeedbackComment): string {
  if (c.mine) return '我'
  if (c.author.name) return c.author.name
  const tier = c.author.tier
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

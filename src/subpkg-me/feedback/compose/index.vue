<template>
  <view class="page" :class="skinClass">
    <SubNav :fallback="ROUTES.meFeedback">{{ words.write }}</SubNav>

    <view class="card">
      <text class="label">这是哪一类</text>
      <view class="chips">
        <view
          v-for="t in FEEDBACK_TYPES"
          :key="t"
          class="chip"
          :class="{ 'is-on': type === t }"
          hover-class="gz-hover"
          @click="type = t"
        >
          {{ TYPE_LABEL[t] }}
        </view>
      </view>

      <text class="label">一句话说清</text>
      <input
        v-model="title"
        class="input"
        :maxlength="FEEDBACK_LIMIT.title"
        placeholder="比如：沙漏切到后台再回来就停了"
        placeholder-class="ph"
      />

      <text class="label">细说一下（可选）</text>
      <textarea
        v-model="body"
        class="area"
        :maxlength="FEEDBACK_LIMIT.body"
        placeholder="在哪儿、怎么触发的、你希望它变成什么样……"
        placeholder-class="ph"
        :show-confirm-bar="false"
        auto-height
      />
      <text class="count">{{ body.length }} / {{ FEEDBACK_LIMIT.body }}</text>
    </view>

    <view class="card">
      <view class="row">
        <view class="row__main">
          <text class="row__label">{{ words.signAs }}</text>
          <text class="row__hint">{{ signHint }}</text>
        </view>
        <switch :checked="sign" :color="accent" @change="onSign" />
      </view>
      <view class="row row--last">
        <view class="row__main">
          <text class="row__label">允许回应</text>
          <text class="row__hint">关掉之后，别人不能在这条下面说话（我仍然能回你）</text>
        </view>
        <switch :checked="allowComment" :color="accent" @change="onAllow" />
      </view>
    </view>

    <!-- 口径说明：先审后发这件事必须提前讲明白，别让人以为"发出去了没人理" -->
    <view class="note">
      <text class="note__text">
        发出去先落在「已送出 · 等回应」—— 这段时间只有你和我看得见；放出来之后，别人才看得到。
      </text>
    </view>

    <view class="submit" :class="{ 'is-busy': busy }" hover-class="gz-hover" @click="submit">
      <text class="submit__text">{{ busy ? '正在送出…' : '送出' }}</text>
    </view>

    <view class="foot">
      <text class="foot__text">写清"在哪儿、怎么触发"，比写"有问题"有用得多</text>
    </view>
  </view>
</template>

<script setup lang="ts">
/**
 * 回音壁 · 写一句（分包 subpkg-me/feedback/compose）。
 *
 * 三条口径：
 *  1. 只预填、不代写 —— 用户没写"细说"就是没写，不替他编；
 *  2. 送不出去时**入本机队列**（stores/feedback.ts），下次进回音壁自动重发 ——
 *     写完丢字是这一页最不能接受的失败；
 *  3. 业务性失败（内容不合规 / 今天说太多）**不入队** —— 那是重试也没用的，
 *     入队只会让用户下次看到一个永远发不出去的"待发"。
 */
import { computed, ref } from 'vue'
import { BizError } from '@/types/api'
import { createFeedbackPost } from '@/api/modules/feedback'
import {
  FEEDBACK_LIMIT,
  FEEDBACK_TYPE_LABEL,
  FEEDBACK_TYPES,
  feedbackWords,
  type FeedbackType,
} from '@/config/feedback'
import { getSkin } from '@/config/skins'
import { useAccountStore } from '@/stores/account'
import { useFeedbackStore } from '@/stores/feedback'
import { useIdentityStore } from '@/stores/identity'
import { useModeStore } from '@/stores/mode'
import { useXpStore } from '@/stores/xp'
import { useSkinClass } from '@/composables/useSkin'
import { LEVEL_NAMES, levelIndexFromXp } from '@/config/levels'
import { navigateTo, ROUTES } from '@/router/routes'

const modeStore = useModeStore()
const account = useAccountStore()
const store = useFeedbackStore()
const identity = useIdentityStore()
const xp = useXpStore()
const skinClass = useSkinClass()

const words = computed(() => feedbackWords(modeStore.id))
const accent = computed(() => getSkin(modeStore.id).accent)
const TYPE_LABEL = FEEDBACK_TYPE_LABEL

const type = ref<FeedbackType>('idea')
const title = ref('')
const body = ref('')
/** 是否署自己的名号（默认不署：这一页的默认姿态是"就事论事"，不是"我在场"） */
const sign = ref(false)
/** 允许回应（默认允许 —— 需要关掉的是少数） */
const allowComment = ref(true)
const busy = ref(false)

/** 署名后显示成什么（让用户在开关旁边就看见，而不是发完才发现名字不对） */
const myName = computed(() => identity.nickname || '')

/** 称号：等级名（三模式各一套，与「我」页等级卡同一个来源） */
const myTier = computed(() => {
  const names = LEVEL_NAMES[modeStore.id] ?? LEVEL_NAMES.normal
  return names[levelIndexFromXp(xp.levelXp)] ?? ''
})

const signHint = computed(() => {
  if (!sign.value) return `不署名时，别人看到的是「${words.value.anonymous}${myTier.value ? ` · ${myTier.value}` : ''}」`
  return myName.value ? `会显示成「${myName.value}」` : '还没起号 —— 先去「我」页设置昵称，否则仍然显示为道友'
})

/**
 * switch 的事件在小程序端是 `{ detail: { value: boolean } }`，而 TS 认的是 Event
 * （项目里 `uni.showModal` 之类也是这么按真实结构取的，见 pages/me 的 onNameBlur）。
 */
function onSign(e: Event): void {
  const detail = (e as unknown as { detail?: { value?: boolean } } | null)?.detail
  sign.value = Boolean(detail?.value)
}

function onAllow(e: Event): void {
  const detail = (e as unknown as { detail?: { value?: boolean } } | null)?.detail
  allowComment.value = Boolean(detail?.value)
}

/** 标题为空时用正文头一句顶上（后端也这么兜，这里是为了让用户当场看见会发生什么） */
function fallbackTitle(): string {
  const s = body.value.replace(/\s+/g, ' ').trim()
  return s.length > 24 ? `${s.slice(0, 24)}…` : s
}

async function submit(): Promise<void> {
  if (busy.value) return
  const t = title.value.trim()
  const b = body.value.trim()
  if (!t && b.length < 4) {
    uni.showToast({ title: '再多写两个字吧', icon: 'none' })
    return
  }

  const payload = {
    type: type.value,
    title: t || fallbackTitle(),
    body: b,
    allowComment: allowComment.value,
    name: sign.value ? myName.value : '',
    tier: myTier.value,
  }

  busy.value = true
  try {
    await account.withAuth((token) => createFeedbackPost(token, payload))
    store.markSent(1)
    uni.showToast({ title: '已送出 · 等回应', icon: 'none', duration: 1600 })
    setTimeout(() => navigateTo(ROUTES.meFeedback), 700)
  } catch (e) {
    /*
     * 分两类：
     *  · 业务错误（-1 以外的 BizError：内容不合规、今天说太多、服务端闸门）→ 提示，
     *    **不入队** —— 重试也是同一个结果，入队只会让用户下次看到一个永远发不出去的待发；
     *  · 网络异常（-1）→ 入本机队列，下次进回音壁自动重发。
     */
    if (e instanceof BizError && e.code !== -1) {
      uni.showToast({ title: e.message || '这条没发出去', icon: 'none', duration: 2400 })
      return
    }
    store.queue(payload)
    uni.showToast({ title: '现在发不出去 · 已存在本机，下次进来自动重发', icon: 'none', duration: 2600 })
    setTimeout(() => navigateTo(ROUTES.meFeedback), 900)
  } finally {
    busy.value = false
  }
}
</script>

<style lang="scss" scoped>
@import './index.scss';
</style>

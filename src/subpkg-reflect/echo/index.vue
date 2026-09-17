<template>
  <view class="page" :class="skinClass">
    <view class="nav">
      <view class="nav__side" hover-class="gz-hover" @click="goBack">
        <text class="nav__back">‹</text>
      </view>
      <text class="nav__title">旧卡重逢</text>
      <view class="nav__side" />
    </view>

    <!-- 今天这一条 -->
    <view v-if="shown" class="card">
      <view class="card__top">
        <text class="card__depth">{{ depthLabel }}</text>
        <text class="card__age">{{ ageText }}</text>
      </view>
      <text class="card__title">{{ shown.title }}</text>
      <text class="card__content">{{ shown.content }}</text>
      <view v-if="shown.tags.length" class="card__tags">
        <text v-for="t in shown.tags" :key="t" class="card__tag">{{ t }}</text>
      </view>

      <template v-if="phase === 'ask'">
        <text class="card__q">写下来这么久，现在还这么想吗？</text>
        <view class="card__row">
          <view class="btn btn--ghost" hover-class="gz-hover" @click="phase = 'changed'">想法变了</view>
          <view class="btn" hover-class="gz-hover" @click="agree">还这么想</view>
        </view>
      </template>

      <template v-else-if="phase === 'changed'">
        <text class="card__q">哪里不一样了？</text>
        <textarea
          v-model="note"
          class="card__input"
          maxlength="200"
          auto-height
          placeholder="现在怎么看…（写下来会存成一张新卡）"
          placeholder-class="card__ph"
        />
        <view class="card__row">
          <view class="btn btn--ghost" hover-class="gz-hover" @click="phase = 'ask'">再想想</view>
          <view class="btn" hover-class="gz-hover" @click="change">存下现在的想法</view>
        </view>
      </template>

      <template v-else>
        <text class="card__done">{{ resultText }}</text>
        <view class="card__row">
          <view class="btn" hover-class="gz-hover" @click="goLibrary">去知识库 ›</view>
        </view>
      </template>
    </view>

    <!-- 今天已经见过了 / 还没有够格的 -->
    <view v-else class="rest">
      <view class="rest__seal gz-motion">叠</view>
      <text class="rest__title">{{ restTitle }}</text>
      <text class="rest__desc">{{ restDesc }}</text>
      <view v-if="knowledge.echableCount" class="rest__row">
        <view class="btn" hover-class="gz-hover" @click="goLibrary">去知识库翻一条</view>
      </view>
    </view>

    <!-- 口径说明 -->
    <view class="note">
      <text class="note__title">为什么只给一条</text>
      <text class="note__text">
        写下来当天觉得对，不算数 —— 隔一段时间再见，还认它，才算站住了。
        所以一天只递一条：多了就成任务，不是重逢了。
      </text>
      <text class="note__text">
        够格重逢的还有 {{ knowledge.echableCount }} 张（写满 {{ ECHO_MIN_AGE_DAYS }} 天才进队列，被推翻过的不再问）。
      </text>
      <view v-if="card" class="note__skip" hover-class="gz-hover" @click="skip">今天先不见它</view>
    </view>
  </view>
</template>


<script setup lang="ts">
/**
 * 知 · 旧卡重逢（分包 subpkg-reflect，2026-09-17）。
 *
 * 这张库里早有「深度分级」，但深度是**写的时候自己打的**；而内化的检验只有一条路：
 * 过一段时间再看，认不认。所以：
 *  - 「还这么想」= 它站住了，记一笔 reflect.echo；
 *  - 「想法变了」= 派生一张新卡「曾经我以为…」，并给旧卡打上 changedAt（不再问第二次）。
 *
 * 本页只负责问与转发：候选取自 knowledge.dueEcho（30 天以上、未推翻、按上次重逢时间排队），
 * 一天一条的口径在 store 里（echoDay），页面不重复判断。
 */
import { computed, ref } from 'vue'
import { useSkinClass } from '@/composables/useSkin'
import { DEPTH_LABEL, ECHO_MIN_AGE_DAYS, useKnowledgeStore, type KnowledgeCard } from '@/stores/knowledge'
import { navigateTo, ROUTES } from '@/router/routes'

const knowledge = useKnowledgeStore()
const skinClass = useSkinClass()

/** ask = 问还认不认；changed = 写"现在怎么看"；done = 已记下 */
const phase = ref<'ask' | 'changed' | 'done'>('ask')
const note = ref('')
const resultText = ref('')

const card = computed(() => knowledge.dueEcho)

/**
 * 已答过的那一条留个副本。
 * 必须留：答完 `dueEcho` 立刻变成 null（一天一条的口径在 store 里），
 * 只看 `card` 的话，「还这么想 / 想法变了」的结果页会在同一帧被换成空态 —— 人只看到卡片消失。
 */
const doneCard = ref<KnowledgeCard | null>(null)
const shown = computed<KnowledgeCard | null>(() => card.value ?? doneCard.value)

const depthLabel = computed(() => (shown.value ? DEPTH_LABEL[shown.value.depth] : ''))

/** 「N 个月前写的」 */
const ageText = computed(() => {
  if (!shown.value) return ''
  const days = Math.floor((Date.now() - shown.value.createdAt) / 86_400_000)
  if (days >= 365) return `${Math.floor(days / 365)} 年前`
  if (days >= 30) return `${Math.floor(days / 30)} 个月前`
  return `${days} 天前`
})

/** 今天见过了才会有空态；区分"封盘了"与"还不够格"，话不一样 */
const restTitle = computed(() => (knowledge.echableCount ? '今天已经见过一条了' : '还没有够格重逢的卡'))
const restDesc = computed(() =>
  knowledge.echableCount
    ? `明天再递下一条 —— 攒着的那几张还等着跟你对一遍。`
    : `写满 ${ECHO_MIN_AGE_DAYS} 天以后，它们才会重新出现在这里。`,
)

function agree(): void {
  const c = card.value
  if (!c) return
  const copy = { ...c }
  knowledge.echo(c.createdAt, 'agree')
  doneCard.value = knowledge.byId(c.createdAt) ?? copy
  resultText.value = `它站住了 · 第 ${doneCard.value.echoCount ?? 1} 次确认（记一笔痕迹）`
  phase.value = 'done'
}

function change(): void {
  const c = card.value
  if (!c) return
  knowledge.echo(c.createdAt, 'changed', note.value)
  doneCard.value = knowledge.byId(c.createdAt) ?? { ...c }
  resultText.value = '新卡已存进知识库 —— 认知真的动过一次'
  note.value = ''
  phase.value = 'done'
}

/** 今天先不见它：不写痕迹、不给分，明天它还在队首 */
function skip(): void {
  knowledge.skipEcho()
  uni.showToast({ title: '那就明天', icon: 'none' })
}

function goLibrary(): void {
  navigateTo(ROUTES.reflectLibrary)
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
@import './index.scss';
</style>

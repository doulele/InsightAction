<template>
  <view class="page" :class="skinClass">
    <view class="nav">
      <view class="nav__side" hover-class="gz-hover" @click="goBack">
        <text class="nav__back">‹</text>
      </view>
      <text class="nav__title">立约</text>
      <view class="nav__side" />
    </view>

    <!-- 今日状态 -->
    <view class="head">
      <text class="head__eyebrow">只立今天 · {{ today }}</text>
      <text class="head__title">{{ headTitle }}</text>
      <text class="head__sub">{{ headSub }}</text>
    </view>

    <!-- ① 未立：三要素表单 -->
    <view v-if="!vow.todayVow" class="form">
      <view class="field">
        <text class="field__label">① 触发条件 · 什么时候会发生</text>
        <input
          v-model="trigger"
          class="field__input"
          placeholder="例如：今天 22 点后"
          placeholder-class="field__ph"
          :maxlength="20"
        />
      </view>
      <view class="field">
        <text class="field__label">② 我承诺（不做 / 做什么）</text>
        <input
          v-model="promise"
          class="field__input"
          placeholder="例如：不看短视频"
          placeholder-class="field__ph"
          :maxlength="20"
        />
      </view>
      <view class="field">
        <text class="field__label">③ 替代动作 · 那时手往哪放</text>
        <input
          v-model="alternative"
          class="field__input"
          placeholder="例如：改看两页书，或直接去洗漱"
          placeholder-class="field__ph"
          :maxlength="24"
        />
      </view>
      <view class="btn" hover-class="gz-hover" @click="doOpen">立下今天的约</view>
      <text class="form__note">
        三个都填才立得住 —— 只说「不做」而不说「改成什么」，多半会在同一个时间点再破一次。
      </text>
    </view>

    <!-- ② 已立未回看：三要素 + 回看 -->
    <template v-else>
      <view class="card">
        <view class="card__row">
          <text class="card__k">触发条件</text>
          <text class="card__v">{{ vow.todayVow.trigger }}</text>
        </view>
        <view class="card__row">
          <text class="card__k">我承诺</text>
          <text class="card__v">{{ vow.todayVow.promise }}</text>
        </view>
        <view class="card__row">
          <text class="card__k">替代动作</text>
          <text class="card__v">{{ vow.todayVow.action }}</text>
        </view>
      </view>

      <template v-if="vow.todayVow.status === 'open'">
        <view class="review">
          <text class="review__label">今天过得怎么样？</text>
          <view class="review__acts">
            <view class="review__btn review__btn--keep" hover-class="gz-hover" @click="doKeep">
              守住了
            </view>
            <view class="review__btn review__btn--break" hover-class="gz-hover" @click="breakOpen = true">
              破了
            </view>
          </view>
          <text class="review__note">回看一次就好，不用写长文。破了也不用愧疚 —— 写下为什么就够了。</text>
        </view>
      </template>

      <view v-else class="result" :class="`is-${vow.todayVow.status}`">
        <text class="result__title">{{ vow.todayVow.status === 'kept' ? '守住了' : '破了 · 原因已记下' }}</text>
        <text v-if="vow.todayVow.reason" class="result__reason">{{ vow.todayVow.reason }}</text>
        <text class="result__note">
          {{ vow.todayVow.status === 'kept' ? '明天的同一时刻，再守一次。' : '这句已经进了「知」的省察 —— 知道自己为什么破，比没破更有价值。' }}
        </text>
        <view class="result__reset" hover-class="gz-hover" @click="doReset">立错了？换一条</view>
      </view>

      <!--
        情境化省察（规格 §4.3）：只有「破了」才有这一问。
        守住了不追问 —— 那就变成每天必答的打卡，恰恰是省察要避开的（§4.3 / §13.1）。
      -->
      <SceneProbe v-if="vow.todayVow.status === 'broken'" scene="vow" :anchor="lastAnchor" />
    </template>

    <!-- 统计 -->
    <view class="tally">
      <view class="tally__item">
        <text class="tally__n">{{ vow.tally.kept }}</text>
        <text class="tally__cap">守住</text>
      </view>
      <view class="tally__item">
        <text class="tally__n">{{ vow.tally.broken }}</text>
        <text class="tally__cap">破过</text>
      </view>
      <view class="tally__item">
        <text class="tally__n">{{ vow.tally.missed }}</text>
        <text class="tally__cap">没回看</text>
      </view>
      <view class="tally__item">
        <text class="tally__n">{{ vow.keepStreak }}</text>
        <text class="tally__cap">连守天数</text>
      </view>
    </view>

    <!-- 历史 -->
    <view v-if="vow.history.length" class="section">
      <view class="section__title">回看记录</view>
      <view class="hist">
        <view v-for="h in vow.history" :key="h.day" class="hist__row">
          <text class="hist__day">{{ shortDay(h.day) }}</text>
          <text class="hist__promise">{{ h.promise }}</text>
          <text class="hist__badge" :class="`is-${h.missed ? 'miss' : h.status}`">{{ statusText(h) }}</text>
        </view>
      </view>
    </view>

    <text class="foot">不扣修为 · 不断连胜 · 不写愧疚话术 —— 立约只做一件事：让「不做」有一个具体的替代。</text>

    <!-- 破约理由（必填） -->
    <view v-if="breakOpen" class="overlay" @touchmove.stop.prevent @click="breakOpen = false">
      <view class="sheet" @click.stop>
        <text class="sheet__title">破了这一次，为什么？</text>
        <text class="sheet__q">一句就够。它会被记进「知」的省察里。</text>
        <textarea
          v-model="reason"
          class="sheet__ta"
          :maxlength="80"
          placeholder="例如：加班回来太累，躺着就刷到了 1 点"
          placeholder-class="field__ph"
        />
        <text v-if="!reason.trim()" class="sheet__hint">不写这句话就不能结算 —— 这是立约唯一强制的一步。</text>
        <view class="sheet__row">
          <view class="sheet__btn sheet__btn--ghost" hover-class="gz-hover" @click="breakOpen = false">取消</view>
          <view class="sheet__btn" :class="{ 'is-off': !reason.trim() }" hover-class="gz-hover" @click="doBreak">
            记住了
          </view>
        </view>
      </view>
    </view>
  </view>
</template>

<script setup lang="ts">
/**
 * 止 · 立约（当日档，分包 subpkg-pause）—— 规格 v2 §4.2。
 * 只立当天、晚上回看一次；破了必须写一句为什么（这句进「知」的省察）。
 * 不扣修为、不中断连胜、不写愧疚类文案。
 * 样式外置在 vow/index.scss（超过 100 行，按项目约定拆出）。
 */
import { computed, ref } from 'vue'
import { useVowStore, type Vow } from '@/stores/vow'
import { useSkinClass } from '@/composables/useSkin'
import SceneProbe from '@/components/SceneProbe/SceneProbe.vue'
import { todayKey } from '@/stores/daily'
import { ROUTES } from '@/router/routes'

const vow = useVowStore()
const skinClass = useSkinClass()

const today = todayKey()
vow.ensureToday()

const headTitle = computed(() => {
  const v = vow.todayVow
  if (!v) return '今天，你想守住什么？'
  if (v.status === 'open') return '这一条已经立下'
  return v.status === 'kept' ? '今日已守住' : '今日破了一次'
})

const headSub = computed(() => {
  const v = vow.todayVow
  if (!v) return '三句话，一分钟。今天结束时回来看一次。'
  if (v.status === 'open') return '晚上睡前回到这里，点一下「守住了」或「破了」。'
  return '明天可以再立一条 —— 立约一天一条，不累积。'
})

/* ---------------- 立约 ---------------- */
const trigger = ref('')
const promise = ref('')
const alternative = ref('')

function doOpen(): void {
  if (!trigger.value.trim() || !promise.value.trim() || !alternative.value.trim()) {
    uni.showToast({ title: '三个空都要填 —— 少一个就立不住', icon: 'none' })
    return
  }
  if (vow.open(trigger.value, promise.value, alternative.value)) {
    trigger.value = ''
    promise.value = ''
    alternative.value = ''
    uni.showToast({ title: '已立下 · 收下这 10 点修为', icon: 'none' })
  }
}

/* ---------------- 回看 ---------------- */
function doKeep(): void {
  if (vow.keep()) uni.showToast({ title: '守住了 · 15 点修为入账', icon: 'none' })
}

const breakOpen = ref(false)
const reason = ref('')
/** 破约的溯源锚点（破约后才有值） */
const lastAnchor = ref('')

function doBreak(): void {
  if (!reason.value.trim()) return
  if (vow.breakIt(reason.value)) {
    reason.value = ''
    breakOpen.value = false
    lastAnchor.value = `vow-${vow.todayVow?.createdAt ?? Date.now()}`
    uni.showToast({ title: '已记下 · 这句进了「知」', icon: 'none' })
  }
}

function doReset(): void {
  uni.showModal({
    title: '重新立一条？',
    content: '今天的这条回看记录会一并撤掉。',
    confirmText: '重立',
    cancelText: '算了',
    success: (res) => {
      if (res.confirm) vow.reset()
    },
  })
}

/* ---------------- 展示 ---------------- */
function shortDay(day: string): string {
  const [, m, d] = day.split('-')
  return `${Number(m)}/${Number(d)}`
}

function statusText(v: Vow): string {
  if (v.missed) return '没回看'
  return v.status === 'kept' ? '守住' : '破了'
}

function goBack(): void {
  const pages = getCurrentPages()
  if (pages.length > 1) {
    uni.navigateBack()
  } else {
    uni.switchTab({ url: ROUTES.tabPause })
  }
}
</script>

<style lang="scss" scoped>
@import './index.scss';
</style>

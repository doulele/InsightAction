<template>
  <view class="page" :class="skinClass">
    <view class="nav">
      <view class="nav__side" hover-class="gz-hover" @click="goBack">
        <text class="nav__back">‹</text>
      </view>
      <text class="nav__title">止念一刻</text>
      <view class="nav__side" />
    </view>

    <view class="intro">
      <text class="intro__text">
        想不想得停，不由意志决定。能做的只有一件事：把那个反复转的念头挪到纸上，再看它现在有没有解。
      </text>
    </view>

    <view class="form">
      <text class="form__label">① 此刻在反复想的是什么</text>
      <input
        v-model="text"
        class="form__input"
        placeholder="一句话就够，例如：明天那件事会不会搞砸"
        placeholder-class="form__ph"
        :maxlength="THOUGHT_TEXT_MAX"
      />

      <text class="form__label">② 它现在有没有解</text>
      <view class="chips">
        <view
          class="chip"
          :class="{ 'is-on': answer === 'act' }"
          hover-class="gz-hover"
          @click="answer = 'act'"
        >
          现在能做什么
        </view>
        <view
          class="chip"
          :class="{ 'is-on': answer === 'let' }"
          hover-class="gz-hover"
          @click="answer = 'let'"
        >
          现在做不了
        </view>
      </view>

      <template v-if="answer === 'act'">
        <text class="form__label">③ 第一件能做的事（一句话）</text>
        <input
          v-model="action"
          class="form__input"
          placeholder="例如：今晚把前三页过一遍"
          placeholder-class="form__ph"
          :maxlength="THOUGHT_ACTION_MAX"
        />
      </template>

      <view class="btn" hover-class="gz-hover" @click="save">记下这一念</view>
      <text class="form__note">
        "做不了"的那一类不用想办法 —— 写下来放到纸上，就是把它从脑子里挪走了。
      </text>
    </view>

    <!--
      刚记完的出路：有解的那一念，给一条去「行」的路。
      只给路、不代建 —— 立不立这件事由用户定（规格 §4.2「不代建」）。
    -->
    <view v-if="justAct" class="next" hover-class="gz-hover" @click="goAction">
      <view class="next__body">
        <text class="next__title">这一念有解，去行里立起来</text>
        <text class="next__text">立成「今日三件事」里的一件，才算真动手。</text>
      </view>
      <text class="next__go">去行厅 ›</text>
    </view>

    <view class="section">
      <view class="section__head">
        <text class="section__title">今天已止 {{ todayCount }} 念</text>
        <text class="section__hint">不排名 · 不比较</text>
      </view>
      <view v-if="recent.length" class="logs">
        <view v-for="r in recent" :key="r.id" class="log">
          <view class="log__top">
            <text class="log__when">{{ whenOf(r.at) }}</text>
            <text class="log__del" hover-class="gz-hover" @click="remove(r.id)">删</text>
          </view>
          <text class="log__text">{{ r.text }}</text>
          <text class="log__ans" :class="{ 'is-let': r.answer === 'let' }">
            {{ r.answer === 'act' ? '能做' : '先放下' }}{{ r.action ? ` · ${r.action}` : '' }}
          </text>
        </view>
      </view>
      <text v-else class="empty">还没有记过。下一次念头转起来的时候，回来写一句。</text>
    </view>
  </view>
</template>

<script setup lang="ts">
/**
 * 止 · 止念一刻（分包 subpkg-pause）—— 规格 v2 §4.2 轴一「止念」层。
 *
 * 三步：写下此刻在反复想的那件事 → 判它现在有没有解 → 记一笔。
 * 刻意不设计时器：给一段时间是沙漏与茶室的职责（详见 stores/thought.ts 头注释）。
 * 样式外置在 thought/index.scss（超过 100 行，按项目约定拆出）。
 */
import { computed, ref } from 'vue'
import {
  THOUGHT_ACTION_MAX,
  THOUGHT_TEXT_MAX,
  useThoughtStore,
} from '@/stores/thought'
import type { ThoughtAnswer } from '@/stores/thought'
import { useSkinClass } from '@/composables/useSkin'
import { ROUTES } from '@/router/routes'

const thought = useThoughtStore()
const skinClass = useSkinClass()

const text = ref('')
const action = ref('')
/** 默认「现在能做什么」：止念的落点是行动，先给能走的那条路 */
const answer = ref<ThoughtAnswer>('act')
/** 刚记下的那一念「有解」→ 页面里给一条去「行」的路（跳页后自然消失） */
const justAct = ref(false)

const todayCount = computed(() => thought.ofDay().length)
const recent = computed(() => thought.records.slice(0, 8))

function save(): void {
  const rec = thought.add({
    text: text.value,
    answer: answer.value,
    action: action.value,
  })
  if (!rec) {
    uni.showToast({ title: '先写下在反复想的那件事', icon: 'none' })
    return
  }
  justAct.value = rec.answer === 'act'
  text.value = ''
  action.value = ''
  uni.showToast({ title: '记下了 · 5 点修为', icon: 'none' })
}

/** 有解的那一念 → 去行厅立起来（只跳转，不代建） */
function goAction(): void {
  uni.switchTab({ url: ROUTES.tabAction })
}

function whenOf(at: number): string {
  const d = new Date(at)
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getMonth() + 1}/${d.getDate()} ${pad(d.getHours())}:${pad(d.getMinutes())}`
}

function remove(id: number): void {
  uni.showModal({
    title: '删掉这一念？',
    content: '它会从列表里移除，已入账的修为不退。',
    confirmText: '删除',
    cancelText: '留着',
    success: (res) => {
      if (res.confirm) thought.remove(id)
    },
  })
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

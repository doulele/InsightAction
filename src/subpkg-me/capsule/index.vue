<template>
  <view class="page" :class="skinClass">
        <SubNav :fallback="ROUTES.tabMe">时间胶囊</SubNav>

    <!-- 到期：先拆（这是这个页面存在的理由，排最前） -->
    <view v-if="capsule.dueCount" class="due">
      <text class="due__label">到期了 · {{ capsule.dueCount }} 条</text>
      <view v-for="c in capsule.dueList" :key="c.id" class="due__card">
        <text class="due__meta">{{ c.dueDay }} 写下的那句 · {{ ageText(c) }}前</text>

        <template v-if="openId === c.id">
          <text class="due__text">{{ c.text }}</text>
          <textarea
            v-model="reply"
            class="due__input"
            maxlength="200"
            auto-height
            placeholder="现在怎么看？（可留空）"
            placeholder-class="due__ph"
          />
          <view class="due__row">
            <view class="btn btn--ghost" hover-class="gz-hover" @click="openId = null">合上</view>
            <view class="btn" hover-class="gz-hover" @click="confirmOpen(c)">收下这句</view>
          </view>
        </template>

        <template v-else>
          <text class="due__sealed">{{ digest(c.text) }}</text>
          <view class="due__row">
            <view class="btn" hover-class="gz-hover" @click="startOpen(c)">拆开</view>
          </view>
        </template>
      </view>
    </view>

    <!-- 封一条新的 -->
    <view class="write">
      <text class="write__label">给未来的自己留一句</text>
      <textarea
        v-model="draft"
        class="write__input"
        maxlength="200"
        auto-height
        placeholder="此刻想说的话、想问的问题、想记住的决定…"
        placeholder-class="write__ph"
      />
      <text class="write__label">什么时候递给你</text>
      <view class="chips">
        <view
          v-for="d in CAPSULE_PRESETS"
          :key="d"
          class="chip"
          :class="{ 'is-on': days === d }"
          hover-class="gz-hover"
          @click="days = d"
        >
          {{ presetLabel(d) }}
        </view>
      </view>
      <text class="write__hint">到期日 {{ duePreview }} · 不是提醒，只是那天你会看见它</text>
      <view class="write__btn" :class="{ 'is-off': !draft.trim() }" hover-class="gz-hover" @click="seal">封上</view>
    </view>

    <!-- 还封着的 -->
    <view v-if="capsule.sealed.length" class="section">
      <view class="section__head">
        <text class="section__title">还封着 · {{ capsule.sealed.length }}</text>
      </view>
      <view v-for="c in capsule.sealed" :key="c.id" class="row">
        <view class="row__body">
          <text class="row__title">{{ digest(c.text) }}</text>
          <text class="row__meta">{{ c.dueDay }} 到期 · 还有 {{ waitDays(c) }} 天</text>
        </view>
        <text class="row__x" hover-class="gz-hover" @click="drop(c)">撤</text>
      </view>
    </view>

    <!-- 已拆开的 -->
    <view v-if="capsule.opened.length" class="section">
      <view class="section__head">
        <text class="section__title">拆开过的 · {{ capsule.opened.length }}</text>
      </view>
      <view v-for="c in capsule.opened" :key="c.id" class="row row--open">
        <view class="row__body">
          <text class="row__quote">{{ c.text }}</text>
          <text v-if="c.reply" class="row__reply">当时的回应：{{ c.reply }}</text>
          <text class="row__meta">{{ c.dueDay }} 到期 · {{ openedText(c) }}拆开</text>
        </view>
      </view>
    </view>

    <view v-if="!capsule.count" class="empty">
      <view class="empty__seal gz-motion">封</view>
      <text class="empty__title">还没封过一条</text>
      <text class="empty__desc">写一句，选个日子。到期那天打开小程序，它会递给你。</text>
    </view>

    <view class="foot">
      <text class="foot__text">
        ⚠ 胶囊只存在这台手机上（与箴言同一待遇，不上云）。换手机 / 清缓存前，请先在设置里导出备份。
      </text>
    </view>
  </view>
</template>

<script setup lang="ts">
/**
 * 我 · 时间胶囊（分包 subpkg-me）。
 *
 * 为什么做它（2026-09-17）：这个小程序拿不到长期订阅（个人主体限制），
 * 所以「回访」全靠用户自己想起；胶囊是唯一一个**指向未来**的钩子。
 *
 * 三条规则都落在 stores/capsule.ts 里，本页只负责展示与转发：
 *  1. 到期不弹窗、不打扰 —— 只在入口徽标与本页顶部出现；
 *  2. 拆开时可以再回一句（与原句并排存），这才叫"过了这段时间"的证据；
 *  3. 只在本机 —— 页面底部如实说明，不让人以为躺在那儿就万事大吉。
 */
import { computed, ref } from 'vue'
import { onShow } from '@dcloudio/uni-app'
import { useSkinClass } from '@/composables/useSkin'
import {
  CAPSULE_PRESETS,
  dayAfter,
  daysUntil,
  presetLabel,
  useCapsuleStore,
  type Capsule,
} from '@/stores/capsule'
import { todayKey } from '@/stores/daily'
import { ROUTES } from '@/router/routes'
import { showModal } from '@/utils/dialog'

const capsule = useCapsuleStore()
const skinClass = useSkinClass()

const draft = ref('')
/** 选定周期（默认一年 —— 这个功能的意思就在这里） */
const days = ref<number>(365)
/** 正在拆的那一条（null = 都合着） */
const openId = ref<number | null>(null)
const reply = ref('')

onShow(() => {
  /* 拆到一半退出去，回来时保持"合着"——拆开是一个动作，不该被自动复原 */
  openId.value = null
})

const duePreview = computed(() => dayAfter(days.value))

/** 一句话摘要：不把原文摊在列表里（留到拆开那一刻） */
function digest(text: string): string {
  const t = text.replace(/\s+/g, ' ').trim()
  return t.length > 24 ? `${t.slice(0, 24)}…` : t || '（没写字，只封了一个日子）'
}

/** 「N 个月前 / N 天前」 */
function ageText(c: Capsule): string {
  const d = Math.max(0, -daysUntil(todayKey(new Date(c.createdAt))))
  if (d >= 365) return `${Math.floor(d / 365)} 年`
  if (d >= 30) return `${Math.floor(d / 30)} 个月`
  return `${d} 天`
}

function waitDays(c: Capsule): number {
  return Math.max(0, daysUntil(c.dueDay))
}

function openedText(c: Capsule): string {
  if (!c.openedAt) return ''
  const d = new Date(c.openedAt)
  return `${d.getMonth() + 1} 月 ${d.getDate()} 日`
}

function startOpen(c: Capsule): void {
  openId.value = c.id
  reply.value = c.reply ?? ''
}

function confirmOpen(c: Capsule): void {
  const first = capsule.open(c.id, reply.value)
  openId.value = null
  reply.value = ''
  uni.showToast({ title: first ? '收下了 · 记一笔痕迹' : '已更新这句话', icon: 'none' })
}

function seal(): void {
  const created = capsule.add(draft.value, days.value)
  if (!created) {
    uni.showToast({ title: draft.value.trim() ? '先选个日子' : '先写点什么', icon: 'none' })
    return
  }
  draft.value = ''
  uni.showToast({ title: `${created.dueDay} 那天见`, icon: 'none' })
}

function drop(c: Capsule): void {
  showModal({
    title: '撤掉这条胶囊？',
    content: '写的这句会一并删掉，不可找回。',
    confirmText: '撤掉',
    cancelText: '留着',
    success: (res) => {
      if (res.confirm) capsule.remove(c.id)
    },
  })
}

</script>

<style lang="scss" scoped>
@import './index.scss';
</style>

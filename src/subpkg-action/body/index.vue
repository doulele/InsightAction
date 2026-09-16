<template>
  <view class="page" :class="skinClass">
    <!-- 顶栏 -->
    <view class="nav">
      <view class="nav__side" hover-class="gz-hover" @click="goBack">
        <text class="nav__back">‹</text>
      </view>
      <text class="nav__title">身体电量</text>
      <view class="nav__side" />
    </view>

    <!-- 今日电量 -->
    <view class="bat">
      <view class="bat__top">
        <text class="bat__label">今日电量</text>
        <text class="bat__time">{{ syncText }}</text>
      </view>

      <view class="bat__num">
        <text class="bat__value">{{ body.hasToday ? body.todayStep : '—' }}</text>
        <text class="bat__unit">步</text>
        <text class="bat__goal">/ 目标 {{ body.goal }}</text>
      </view>

      <view class="bat__cell">
        <view class="bat__fill" :style="{ width: `${body.pct}%` }" />
      </view>
      <text class="bat__word">{{ word }}</text>

      <text v-if="body.latest && !body.hasToday" class="bat__stale">
        最新一条停在 {{ body.latest.date }} —— 今天还没有步数传回来。
      </text>
    </view>

    <!-- 目标 -->
    <view class="goals">
      <text class="goals__label">今日目标</text>
      <view class="goals__list">
        <view
          v-for="g in GOALS"
          :key="g"
          class="goal"
          :class="{ 'is-on': body.goal === g }"
          hover-class="gz-hover"
          @click="body.goal = g"
        >
          {{ g }}
        </view>
      </view>
    </view>

    <!-- 最近七天 -->
    <view class="week">
      <view class="week__head">
        <text class="week__title">最近七天</text>
        <text class="week__tip">空着的那天是没读到数据，不是走了零步</text>
      </view>
      <view class="week__bars">
        <view v-for="d in body.recent" :key="d.date" class="col">
          <view class="col__track">
            <view class="col__bar" :style="{ height: barHeight(d) }" />
          </view>
          <text class="col__n">{{ d.step === null ? '—' : d.step }}</text>
          <text class="col__d">{{ d.label }}</text>
        </view>
      </view>
    </view>

    <!-- 同步 -->
    <view class="sync" :class="{ 'is-busy': syncing }" hover-class="gz-hover" @click="onSync">
      <text>{{ syncing ? '读取中…' : '同步今日步数' }}</text>
    </view>
    <view v-if="body.auth === 'denied'" class="again" hover-class="gz-hover" @click="openSetting">
      在系统设置里重新允许读取步数 ›
    </view>

    <view class="note">
      <text class="note__row">步数来自微信运动，每次点击才读一次，不会在后台偷着取。</text>
      <text class="note__row">服务端只负责解开微信的密文，解开即刻返回，不留存、不写日志。</text>
      <text class="note__row">步数存在你这台手机上：云备份不带它，本地备份文件才带得走。</text>
      <text class="note__row">它只是身体活动的粗略参考，不构成健康建议。</text>
    </view>

    <!-- 隐私授权门：步数 / 剪贴板 / 选文件 / 头像昵称都要过这道门 -->
    <PrivacyGate />
  </view>
</template>

<script setup lang="ts">
/**
 * 行 · 身体电量（微信运动）。
 *
 * 产品的取舍写在前头：
 *  1. **只手动，不自动** —— 冷启动就弹授权框是惹人不快也要不到授权的，
 *     而且微信运动本来就要"用户主动进入小程序"才会刷新数据；
 *  2. **诚实标空** —— 没读到数据显示「—」而不是 0，柱状图同样留白。
 *     把「没数据」画成「走了 0 步」，是另一种形式的自欺；
 *  3. **不评判** —— 不给连续达标 / 断签才会有回头cue，只有一句平铺直叙的话。
 */
import { computed, ref } from 'vue'
import { useSkinClass } from '@/composables/useSkin'
import { useBodyStore } from '@/stores/body'
import type { BodyBar } from '@/stores/body'
import { WerunError, openWeRunSetting, readWeRun } from '@/utils/werun'

const skinClass = useSkinClass()
const body = useBodyStore()
const syncing = ref(false)

/** 可选目标：4000 起手、6000 常规、8000 有余 */
const GOALS = [4000, 6000, 8000] as const

/** 页面上的一句话：按电量分档，语气平实，不外挂鸡血 */
const word = computed<string>(() => {
  if (body.todayStep === null) {
    return body.latest ? '今天还没有读数。点下面的按钮，把步数读进来。' : '还没有步数。先看一次你今天走到了哪里。'
  }
  if (body.todayStep === 0) return '一步都还没算进来 —— 手机可能没在计步。'
  if (body.pct < 25) return '电量见底。不必专门去跑，站起来走五分钟也算数。'
  if (body.pct < 50) return '走起来了。这一格电量，够撑一轮静修。'
  if (body.pct < 80) return '电量过半，身体已经醒透。'
  if (body.pct < 100) return '快满了 —— 今天的最后一步，可以走得体面些。'
  return '今日电量已满。剩下的每一步，都是赚的。'
})

/** 上次同步时间（人话，不给 ISO 原文） */
const syncText = computed<string>(() => {
  if (!body.lastSyncAt) return '尚未同步'
  const d = new Date(body.lastSyncAt)
  const hh = String(d.getHours()).padStart(2, '0')
  const mm = String(d.getMinutes()).padStart(2, '0')
  return `上次 ${hh}:${mm}`
})

/** 柱高：没有数据就彻底空着（见注释「诚实标空」） */
function barHeight(d: BodyBar): string {
  if (d.step === null) return '0%'
  const pct = (d.step / Math.max(1, body.barMax)) * 100
  return `${Math.max(3, Math.round(pct))}%`
}

async function onSync(): Promise<void> {
  if (syncing.value) return
  syncing.value = true
  try {
    const res = await readWeRun()
    body.record(res.days)
    uni.showToast({
      title: body.hasToday ? `今天 ${body.todayStep} 步` : '已同步，今天暂无数据',
      icon: 'none',
    })
  } catch (e) {
    const err = e instanceof WerunError ? e : new WerunError('error', '读取步数失败，稍后再试')
    if (err.reason === 'denied') body.markDenied()
    if (err.reason === 'denied') {
      uni.showToast({ title: err.message, icon: 'none', duration: 2400 })
    } else {
      /*
       * 非「没授权」的失败一律弹窗给**完整原文**。
       * toast 一行只能放十来个字，而排查这类问题恰恰全靠原文 ——
       * 「没在隐私指引里声明该信息类型」和「手机没开微信运动」长得完全不一样，
       * 截断了就等于没报。
       */
      uni.showModal({ title: '读取步数失败', content: err.message, showCancel: false, confirmText: '知道了' })
    }
  } finally {
    syncing.value = false
  }
}

function openSetting(): void {
  openWeRunSetting()
}

function goBack(): void {
  uni.navigateBack()
}
</script>

<style lang="scss" scoped>
@import './index.scss';
</style>

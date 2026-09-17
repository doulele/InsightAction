<template>
  <view class="page" :class="skinClass">
    <!-- 顶栏：返回 + 标题 -->
    <view class="nav">
      <view class="nav__side" hover-class="gz-hover" @click="goBack">
        <text class="nav__back">‹</text>
      </view>
      <text class="nav__title">静心茶室</text>
      <view class="nav__side" />
    </view>

    <!-- 选盏 -->
    <template v-if="phase === 'pick'">
      <view class="hero">
        <view class="seal">闲</view>
        <text class="hero__title">选一盏，坐下</text>
        <text class="hero__desc">
          五种方式，都是一盏茶的工夫。\n中途离席需如实作答，这一盏不作数。
        </text>
      </view>

      <view class="menu">
        <view
          v-for="t in TEA"
          :key="t.id"
          class="menu__item"
          hover-class="gz-hover"
          @click="start(t.id)"
        >
          <view class="menu__dot" :style="{ background: t.accent }" />
          <view class="menu__body">
            <text class="menu__name">{{ t.name }}</text>
            <text class="menu__mood">{{ t.mood }}</text>
          </view>
          <text class="menu__go">›</text>
        </view>
      </view>

      <text class="foot">一盏 5 分钟 · 每盏自带一种声音 · 走完全程入账今日定力</text>
    </template>

    <!-- 静守中 -->
    <template v-else-if="phase === 'brew'">
      <view class="brew">
        <text class="brew__eyebrow">一盏 {{ active.name }} · {{ active.mood }}</text>

        <!-- 观想卷：五模式各一幅氛围动效 -->
        <view class="scene" :class="`scene--${active.id}`">
          <!-- 焚香：暖米书案 + 一炷香，烟缕次第升 -->
          <template v-if="active.id === 'xiang'">
            <view class="xia" />
            <view class="incense" />
            <view class="smoke smoke--a" />
            <view class="smoke smoke--b" />
            <view class="smoke smoke--c" />
            <view class="scene__ink">烟起烟散，什么都不必做</view>
          </template>
          <!-- 扫尘：青灰庭院，落叶自去 -->
          <template v-else-if="active.id === 'sao'">
            <view class="leaf leaf--1" />
            <view class="leaf leaf--2" />
            <view class="leaf leaf--3" />
            <view class="leaf leaf--4" />
            <view class="leaf leaf--5" />
            <view class="scene__ink">风过处，尘与叶自去</view>
          </template>
          <!-- 听潮：深蓝海岸，潮声往返 -->
          <template v-else-if="active.id === 'ting'">
            <view class="ting-moon" />
            <view class="wave wave--1" />
            <view class="wave wave--2" />
            <view class="scene__ink">潮来了又去，你是岸边</view>
          </template>
          <!-- 观云：浅天流云，看聚散 -->
          <template v-else-if="active.id === 'yun'">
            <view class="cloud cloud--1" />
            <view class="cloud cloud--2" />
            <view class="cloud cloud--3" />
            <view class="yun-hill" />
            <view class="scene__ink">云聚云散，不着于相</view>
          </template>
          <!-- 煮雪：雪青静夜，炉火候雪 -->
          <template v-else>
            <view class="snow snow--a" />
            <view class="snow snow--b" />
            <view class="snow snow--c" />
            <view class="pot" />
            <view class="coal" />
            <view class="steam steam--a" />
            <view class="steam steam--b" />
            <view class="scene__ink">火候到了，水自然会开</view>
          </template>
        </view>

        <!-- 时间与节奏 -->
        <view class="time">{{ remainText }}</view>
        <view class="bar">
          <view class="bar__fill" :style="{ width: `${pct * 100}%` }" />
        </view>
        <text class="brew__hint">{{ active.hint }}</text>
        <text class="brew__note">以真实时间为准：息屏、切走，盏仍守着</text>

        <button class="leave" hover-class="gz-hover" @click="openLeave">提前离席</button>
      </view>
    </template>

    <!-- 一盏毕 -->
    <template v-else>
      <view class="hero">
        <view class="seal seal--done">安</view>
        <text class="hero__title">这一盏，守住了</text>
        <text class="hero__num">5<text class="hero__unit"> 分钟已入账</text></text>
        <text class="hero__desc">今日累计 {{ todayMin }} 分钟 · 小目标 /60</text>
      </view>
      <view class="btns">
        <button class="cta" hover-class="gz-hover" @click="brewAgain">再来一盏</button>
        <button class="cta cta--ghost" hover-class="gz-hover" @click="leave">收盏离开</button>
      </view>
    </template>

    <!-- 中途离席作答 -->
    <view v-if="leaveOpen" class="mask" @click="leaveOpen = false">
      <view class="sheet" @click.stop>
        <text class="sheet__title">为什么提前离席？</text>
        <text class="sheet__sub">如实作答 · 这一盏将不计入定力</text>
        <view class="sheet__opts">
          <view
            v-for="c in LEAVE_CAUSES"
            :key="c"
            class="sheet__opt"
            hover-class="gz-hover"
            @click="leaveFor(c)"
          >
            {{ c }}
          </view>
        </view>
        <view class="sheet__cancel" hover-class="gz-hover" @click="leaveOpen = false">
          再坐一会儿
        </view>
      </view>
    </view>
  </view>
</template>

<script setup lang="ts">
/**
 * 止 · 静心茶室 —— 批次 B 真实功能子页（分包 subpkg-pause）。
 * 一盏 = 5 分钟沉浸练习（焚香 / 扫尘 / 听潮 / 观云 / 煮雪）。
 * 规则与禅定沙漏同源：
 *  - 走完全程才写入今日定力（focus store，单盏 5 分钟）；
 *  - 中途离席需选因作答、不入账；
 *  - 计时以墙上时间为准，后台跑满回前台照实结算。
 */
import { computed, ref } from 'vue'
import { onHide, onLoad, onShow, onUnload, onBackPress } from '@dcloudio/uni-app'
import { useFocusStore } from '@/stores/focus'
import { useSkinClass } from '@/composables/useSkin'
import { TEA_AMBIENTS } from '@/config/audio'
import { playCue, prefetchCue, startAmbient, stopAmbient, teardownAudio } from '@/utils/audio'
import { ROUTES } from '@/router/routes'

const focus = useFocusStore()
const skinClass = useSkinClass()

const STEADY_MS = 5 * 60_000
const LEAVE_CAUSES = ['心神不宁', '被外物打断', '身体不适', '另有安排'] as const

interface Tea {
  id: 'xiang' | 'sao' | 'ting' | 'yun' | 'zhu'
  name: string
  mood: string
  hint: string
  accent: string
}

const TEA: Tea[] = [
  {
    id: 'xiang',
    name: '焚香',
    mood: '一炷香，不与时间讨价还价',
    hint: '看烟起烟散，什么都不必做',
    accent: '#B4552D',
  },
  {
    id: 'sao',
    name: '扫尘',
    mood: '尘埃落定，心也清了一层',
    hint: '念起即觉，如叶落不追',
    accent: '#7D9B63',
  },
  {
    id: 'ting',
    name: '听潮',
    mood: '潮起潮落，念头不过浪花',
    hint: '声音来了又去，你是岸边',
    accent: '#2F6FA6',
  },
  {
    id: 'yun',
    name: '观云',
    mood: '云聚云散，不着于相',
    hint: '让念头像云一样飘过',
    accent: '#6C84B8',
  },
  {
    id: 'zhu',
    name: '煮雪',
    mood: '守着炉火，等一壶雪水',
    hint: '火候到了，水自然会开',
    accent: '#3F8294',
  },
]

const active = computed(() => TEA.find((t) => t.id === activeId.value) ?? TEA[0])

type Phase = 'pick' | 'brew' | 'done'
const phase = ref<Phase>('pick')
const activeId = ref<Tea['id']>('xiang')

/** 目标完成时刻（墙上时间），跑满才结算 */
const targetTs = ref(0)
const totalMs = ref(STEADY_MS)
const remainMs = ref(STEADY_MS)
const leaveOpen = ref(false)

const todayMin = computed(() => focus.minutesOn())

const remainText = computed(() => {
  const s = Math.max(0, Math.ceil(remainMs.value / 1000))
  const m = Math.floor(s / 60)
  const r = s % 60
  return `${String(m).padStart(2, '0')}:${String(r).padStart(2, '0')}`
})

const pct = computed(() => (totalMs.value > 0 ? 1 - remainMs.value / totalMs.value : 0))

let ticker: ReturnType<typeof setInterval> | null = null

function syncRemain(): void {
  remainMs.value = targetTs.value - Date.now()
}

/** 每 250ms 对表；跑满瞬间自动结算入账 */
function tick(): void {
  syncRemain()
  if (Date.now() >= targetTs.value) settle()
}

function clearTicker(): void {
  if (ticker) {
    clearInterval(ticker)
    ticker = null
  }
}

/** 从大厅点某一模式进来：query 带 room 则直接开这一盏 */
onLoad((query) => {
  /* 一记提示音先预热：从大厅带 room 进来时马上就会用到 */
  prefetchCue('open')
  const room = query?.room
  if (typeof room === 'string' && TEA.some((t) => t.id === room)) {
    activeId.value = room as Tea['id']
    start(room as Tea['id'])
  }
})

function start(id: Tea['id']): void {
  activeId.value = id
  totalMs.value = STEADY_MS
  targetTs.value = Date.now() + totalMs.value
  syncRemain()
  phase.value = 'brew'
  uni.setKeepScreenOn({ keepScreenOn: true })
  clearTicker()
  ticker = setInterval(tick, 250)
  /* 一记开局（素材没到位就静默，不影响这一盏） */
  playCue('open')
  /*
   * 这一盏的声音：五盏各不相同（焚香壁炉 / 扫尘叶声 / 听潮海浪 / 观云微风 / 煮雪篝火，
   * 见 config/audio.ts）。用户是随手点的一盏，来不及预热 —— 传 immediate 先出声，
   * 同时把文件缓存好留给下一次（只多耗首次那一份流量）。
   */
  const track = TEA_AMBIENTS[id]
  if (track) startAmbient(track.files, track.volume, { immediate: true })
}

/** 跑满结算：全程唯一的入账点 */
function settle(): void {
  focus.addMinutes(5)
  clearTicker()
  uni.setKeepScreenOn({ keepScreenOn: false })
  phase.value = 'done'
  uni.vibrateShort({ type: 'medium' })
  /* 一记收盏：声音收尾 + 一次震动（沙漏同理，两处口径一致） */
  stopAmbient()
  playCue('close')
}

function openLeave(): void {
  leaveOpen.value = true
}

/** 中途离席：选因后不入账，回到选盏 */
function leaveFor(cause: string): void {
  leaveOpen.value = false
  clearTicker()
  uni.setKeepScreenOn({ keepScreenOn: false })
  phase.value = 'pick'
  stopAmbient()
  uni.showToast({ title: `${cause} · 这一盏未计入`, icon: 'none' })
}

function brewAgain(): void {
  phase.value = 'pick'
}

function backToPause(): void {
  const pages = getCurrentPages()
  if (pages.length > 1) {
    uni.navigateBack()
  } else {
    uni.switchTab({ url: ROUTES.tabPause })
  }
}

/** 统一离页：静守中只能先作答 */
function goBack(): void {
  if (phase.value === 'brew') {
    openLeave()
    return
  }
  backToPause()
}

function leave(): void {
  backToPause()
}

onShow(() => {
  if (phase.value !== 'brew') return
  if (Date.now() >= targetTs.value) {
    settle()
    uni.showToast({ title: '后台亦在守盏 · 定力已入账', icon: 'none' })
    return
  }
  syncRemain()
  clearTicker()
  ticker = setInterval(tick, 250)
})

onHide(() => {
  clearTicker()
})

onUnload(() => {
  clearTicker()
  uni.setKeepScreenOn({ keepScreenOn: false })
  /* 离页立即收干净（不等淡出），免得回到大厅还有一盏在响 */
  teardownAudio()
})

/* 物理返回 / 侧滑：静守中拦截为作答层 */
onBackPress(() => {
  if (phase.value === 'brew') {
    openLeave()
    return true
  }
  return false
})
</script>

<style lang="scss" scoped>
@import './index.scss';
</style>

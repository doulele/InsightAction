<template>
  <view class="page" :class="skinClass">
    <!-- 顶栏：返回 + 标题（子页统一样式） -->
        <SubNav @back="goBack">禅定沙漏</SubNav>

    <!-- 选时 -->
    <template v-if="phase === 'idle'">
      <view class="hero">
        <!-- 模式专属标志物：沙漏 / 全息专注环 / 飞剑（图缺失或加载失败时整块隐身，页面回落到原有视觉） -->
        <ModuleMark mark="pause.focus" />
        <view class="seal">止</view>
        <text class="hero__title">翻转沙漏，与世无关</text>
        <text class="hero__desc">
          选一段时长，走完全程才算定力入账。\n中途退出需如实作答，这一程不作数。
        </text>
      </view>
      <view class="pills">
        <view
          v-for="d in DURATIONS"
          :key="d"
          class="pill"
          :class="{ 'is-on': d === chosen }"
          @click="chosen = d"
        >
          {{ d }} 分
        </view>
      </view>

      <!-- 走时声：计时中循环播放的一段背景音。默认「静」—— 沙漏的语义本来就是安静 -->
      <view class="pills__head">
        <text class="pills__title">走时声</text>
        <text class="pills__hint">{{ ambient.hint }}</text>
      </view>
      <view class="pills pills--sound">
        <view
          v-for="a in AMBIENTS"
          :key="a.id"
          class="pill"
          :class="{ 'is-on': a.id === settings.sandglassAmbient }"
          @click="pickAmbient(a.id)"
        >
          {{ a.name }}
        </view>
      </view>

      <button class="cta" hover-class="gz-hover" @click="start">
        开始一段静修
      </button>
    </template>

    <!-- 计时中 -->
    <template v-else-if="phase === 'running'">
      <view class="ring">
        <view class="ring__halo" />
        <view class="ring__core">
          <text class="ring__mark">止 · 沙漏中</text>
          <text class="ring__time">{{ remainText }}</text>
          <text class="ring__pct">{{ pctText }} 已过 · {{ chosen }} 分钟</text>
        </view>
      </view>
      <view class="bar">
        <view class="bar__fill" :style="{ width: `${pct * 100}%` }" />
      </view>
      <view class="tip">
        <text class="tip__line">沙漏以真实时间为准：息屏、切走，时间仍在流</text>
        <text class="tip__line">走完全程才会写入今日定力</text>
      </view>
      <!-- 走时声：计时中也能换 —— 嫌吵就点「静」，不必中断这一程 -->
      <view class="pills pills--sound pills--runtime">
        <view
          v-for="a in AMBIENTS"
          :key="a.id"
          class="pill"
          :class="{ 'is-on': a.id === settings.sandglassAmbient }"
          @click="pickAmbient(a.id)"
        >
          {{ a.name }}
        </view>
      </view>
      <button class="giveup" hover-class="gz-hover" @click="openGiveUp">
        提前结束这一程
      </button>
    </template>

    <!-- 完成 -->
    <template v-else>
      <view class="hero">
        <view class="seal seal--done">定</view>
        <text class="hero__title">这一程，守住了</text>
        <text class="hero__num">{{ chosen }}<text class="hero__unit"> 分钟已入账</text></text>
        <text class="hero__desc">今日累计 {{ todayMin }} 分钟 · 小目标 /60</text>
      </view>
      <button class="cta" hover-class="gz-hover" @click="leave">收功</button>
    </template>

    <!-- 中途退出作答 -->
    <view v-if="giveUpOpen" class="mask" @click="giveUpOpen = false">
      <view class="sheet" @click.stop>
        <text class="sheet__title">为什么提前结束？</text>
        <text class="sheet__sub">如实作答 · 这一程将不计入定力</text>
        <view class="sheet__opts">
          <view
            v-for="c in GIVE_UP_CAUSES"
            :key="c"
            class="sheet__opt"
            hover-class="gz-hover"
            @click="giveUp(c)"
          >
            {{ c }}
          </view>
        </view>
        <view class="sheet__cancel" hover-class="gz-hover" @click="giveUpOpen = false">
          再坚持一下
        </view>
      </view>
    </view>
  </view>
</template>

<script setup lang="ts">
/**
 * 止 · 禅定沙漏 —— 批次 B 真实功能子页（分包 subpkg-pause）。
 * 规则：
 *  - 选 5/15/30/60 分钟，走完全程才写入今日定力（focus store）；
 *  - 中途退出需选因作答、不入账（不养"刷定力"的念头）；
 *  - 计时以墙上时间为准：息屏/切走不暂停（如真实沙漏），
 *    小程序后台会挂起 setInterval，故用绝对时间戳 targetTs 对表，
 *    切走期间跑满了回到前台也照实结算。
 */
import { computed, ref } from 'vue'
import { onHide, onLoad, onShow, onUnload, onBackPress } from '@dcloudio/uni-app'
import { useFocusStore } from '@/stores/focus'
import { useSettingsStore } from '@/stores/settings'
import { useSkinClass } from '@/composables/useSkin'
import { SANDGLASS_AMBIENTS, sandglassAmbientById } from '@/config/audio'
import { playCue, prefetchAmbient, prefetchCue, startAmbient, stopAmbient, teardownAudio } from '@/utils/audio'
import { ROUTES } from '@/router/routes'

const focus = useFocusStore()
const settings = useSettingsStore()
const skinClass = useSkinClass()

const DURATIONS = [5, 15, 30, 60] as const
const GIVE_UP_CAUSES = ['心神不宁', '被外物打断', '身体不适', '另有安排'] as const

/** 走时声选项（第一项是默认的「静」）；模板直接用，故起个短名 */
const AMBIENTS = SANDGLASS_AMBIENTS
/** 当前选中的走时声（id 存在偏好里，配置表在 config/audio.ts） */
const ambient = computed(() => sandglassAmbientById(settings.sandglassAmbient))

type Phase = 'idle' | 'running' | 'done'
const phase = ref<Phase>('idle')
const chosen = ref<number>(15)

/** 目标完成时刻（墙上时间），跑满才结算 */
const targetTs = ref(0)
const totalMs = ref(0)
const remainMs = ref(0)
const giveUpOpen = ref(false)

const todayMin = computed(() => focus.minutesOn())

const remainText = computed(() => {
  const s = Math.max(0, Math.ceil(remainMs.value / 1000))
  const m = Math.floor(s / 60)
  const r = s % 60
  return `${String(m).padStart(2, '0')}:${String(r).padStart(2, '0')}`
})

const pct = computed(() => (totalMs.value > 0 ? 1 - remainMs.value / totalMs.value : 0))
const pctText = computed(() => `${Math.floor(pct.value * 100)}%`)

let ticker: ReturnType<typeof setInterval> | null = null

/* ---- 走时声（背景音） ---- */

/**
 * 进页面就预热：一记提示音 + 当前选中的走时声。
 *
 * 用户在这里还要挑时长，通常有 3–5 秒 —— 足够把音频下进本地（首次 300–600KB），
 * 点「开始一段静修」时立刻有声，而不是先静几秒（那会让人以为声音坏了。
 * 素材没上传/无网时全程静默，计时照常）。
 */
onLoad(() => {
  prefetchCue('open')
  const track = ambient.value.track
  if (track) prefetchAmbient(track.files)
})

/** 选走时声：写偏好；计时中立刻换（点「静」就是停，不用中断这一程） */
function pickAmbient(id: string): void {
  settings.sandglassAmbient = id
  const track = sandglassAmbientById(id).track
  if (track) prefetchAmbient(track.files)
  if (phase.value === 'running') applyAmbient()
}

/** 把当前选中的走时声落到播放器（「静」= 停环境音） */
function applyAmbient(): void {
  const track = ambient.value.track
  if (track) startAmbient(track.files, track.volume)
  else stopAmbient()
}

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

function start(): void {
  totalMs.value = chosen.value * 60_000
  targetTs.value = Date.now() + totalMs.value
  syncRemain()
  phase.value = 'running'
  uni.setKeepScreenOn({ keepScreenOn: true })
  clearTicker()
  ticker = setInterval(tick, 250)
  /* 一记开场：让"开始"是听得见的（素材没到位时静默，不影响计时） */
  playCue('open')
  applyAmbient()
}

/** 跑满结算：全程唯一的入账点 */
function settle(): void {
  focus.addMinutes(chosen.value)
  clearTicker()
  uni.setKeepScreenOn({ keepScreenOn: false })
  phase.value = 'done'
  uni.vibrateShort({ type: 'medium' })
  /* 一记收功：声音收尾 + 一次震动，把"这一程守住了"落成身体记得的信号 */
  stopAmbient()
  playCue('close')
}

/** 中途退出：选因后不入账，回到选时态 */
function giveUp(cause: string): void {
  giveUpOpen.value = false
  clearTicker()
  uni.setKeepScreenOn({ keepScreenOn: false })
  phase.value = 'idle'
  stopAmbient()
  uni.showToast({ title: `${cause} · 这一程未计入`, icon: 'none' })
}

function openGiveUp(): void {
  giveUpOpen.value = true
}

/** 统一离页：计时中只能先作答 */
function backOrGiveUp(): void {
  if (phase.value === 'running') {
    openGiveUp()
    return
  }
  const pages = getCurrentPages()
  if (pages.length > 1) {
    uni.navigateBack()
  } else {
    uni.switchTab({ url: ROUTES.tabPause })
  }
}

function goBack(): void {
  backOrGiveUp()
}

function leave(): void {
  const pages = getCurrentPages()
  if (pages.length > 1) {
    uni.navigateBack()
  } else {
    uni.switchTab({ url: ROUTES.tabPause })
  }
}

onShow(() => {
  if (phase.value !== 'running') return
  if (Date.now() >= targetTs.value) {
    // 切走期间其实已跑满 → 回前台诚实结算
    settle()
    uni.showToast({ title: '后台亦在计时 · 定力已入账', icon: 'none' })
    return
  }
  syncRemain()
  clearTicker()
  ticker = setInterval(tick, 250)
})

/*
 * 切后台：只是**停掉定时器**，不是停表（2026-09-22 注明，免得后来人修错方向）。
 * 进度按 targetTs 这个墙上时刻算，后台那段时间照数；回前台由上面的 onShow 结算，
 * 声音也不在这儿收 —— App 层统一管（见 App.vue 的 onHide/onShow）。
 */
onHide(() => {
  clearTicker()
})

onUnload(() => {
  clearTicker()
  uni.setKeepScreenOn({ keepScreenOn: false })
  /* 离页立即收干净（不等淡出），免得回到大厅还有声音在响 */
  teardownAudio()
})

/* 物理返回 / 侧滑：计时中拦截为作答层 */
onBackPress(() => {
  if (phase.value === 'running') {
    openGiveUp()
    return true
  }
  return false
})
</script>

<style lang="scss" scoped>
@import './index.scss';
</style>

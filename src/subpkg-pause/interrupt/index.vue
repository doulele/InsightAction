<template>
  <view class="page" :class="skinClass">
    <!-- 顶栏 -->
        <SubNav :fallback="ROUTES.tabPause">触发干预卡片</SubNav>

    <!-- 说明 + 今日统计 -->
    <view class="intro">
      <text class="intro__title">冲动来了，先停一分钟</text>
      <text class="intro__text">
        管住「手先于脑」的时刻：选一个总想打开的开关，陪自己做完一段呼吸，
        把冲动摁回去——这一步比憋一整天更有用。
        {{ guideHint }}
      </text>
      <view class="cards">
        <view class="card">
          <text class="card__value">{{ todayHeld }}<text class="card__unit">次</text></text>
          <text class="card__label">今日守住</text>
        </view>
        <view class="card">
          <text class="card__value">{{ totalHeld }}<text class="card__unit">次</text></text>
          <text class="card__label">累计守住</text>
        </view>
      </view>
    </view>

    <!-- 选场景 -->
    <view class="section">
      <view class="section__head">
        <text class="section__title">此刻是什么开关</text>
        <text class="section__hint">点选 · 可自建</text>
      </view>
      <view class="chips">
        <view
          v-for="s in allScenarios"
          :key="s.id"
          class="chip"
          :class="{ 'is-on': selectedId === s.id }"
          hover-class="gz-hover"
          @click="selectedId = s.id"
        >
          <text class="chip__name">{{ s.name }}</text>
          <text v-if="s.custom" class="chip__del" @click.stop="dropCustom(s.id)">×</text>
        </view>
        <view class="chip chip--add" hover-class="gz-hover" @click="addOpen = true">
          <text class="chip__name">＋ 自建</text>
        </view>
      </view>
      <text v-if="selected.alt" class="chip__alt">替代动作：{{ selected.alt }}</text>
    </view>

    <!-- 时长 + 开始 -->
    <view v-if="!running" class="section">
      <view class="section__head">
        <text class="section__title">停多久</text>
        <text class="section__hint">够了就好</text>
      </view>
      <view class="durs">
        <view
          v-for="d in DURATIONS"
          :key="d"
          class="dur"
          :class="{ 'is-on': minutes === d }"
          hover-class="gz-hover"
          @click="minutes = d"
        >
          <text class="dur__num">{{ d }}</text>
          <text class="dur__unit">分钟</text>
        </view>
      </view>
      <view class="start" hover-class="gz-hover" @click="start">
        现在停一下
      </view>
    </view>

    <!-- 进行中：呼吸倒计时 -->
    <view v-else class="pause">
      <text class="pause__phase" :class="`is-${phase}`">{{ phaseText }}</text>
      <text class="pause__clock">{{ mmss }}</text>
      <text class="pause__scene">正在收住：「{{ selected.name }}」</text>
      <view class="pause__acts">
        <view class="pause__cancel" hover-class="gz-hover" @click="abort">中途退出</view>
      </view>
    </view>

    <view class="foot">
      <text class="foot__text">不是克制 · 是给冲动一个看清自己的机会</text>
    </view>

    <!-- 自建弹层 -->
    <view v-if="addOpen" class="overlay" @click="addOpen = false">
      <view class="sheet" @click.stop>
        <text class="sheet__title">自建触发场景</text>
        <input v-model="newName" class="sheet__input" placeholder="例如：想打开购物 App" maxlength="12" />
        <input
          v-model="newAlt"
          class="sheet__input"
          placeholder="替代动作（可选）：站起来转两圈"
          maxlength="20"
        />
        <view class="sheet__row">
          <view class="sheet__btn sheet__btn--ghost" hover-class="gz-hover" @click="addOpen = false">取消</view>
          <view class="sheet__btn" hover-class="gz-hover" @click="saveCustom">保存</view>
        </view>
      </view>
    </view>

    <!-- 放弃确认：主题随当前模式 -->
    <GzDialog
      :show="abortOpen"
      title="现在就想放弃？"
      content="再陪自己最后 10 个呼吸，冲动常常就这么过去了。仍要退出就点「退出」。"
      confirm-text="继续停"
      cancel-text="退出"
      @cancel="onAbortCancel"
      @confirm="onAbortKeep"
    />
  </view>
</template>

<script setup lang="ts">
/**
 * 止 · 触发干预卡片（m7 批次 · 分包 subpkg-pause）：
 * 针对「想打开某开关」的冲动时刻，提供 1-3 分钟呼吸暂停；
 * 走完全程记一次守住（+修为），中途退出只诚实计数不惩罚。数据本地（stores/interrupt.ts）。
 */
import { computed, onUnmounted, ref, watch } from 'vue'
/* 页面生命周期（onShow / onLoad…）一律从 @dcloudio/uni-app 引入 */
import { onShow } from '@dcloudio/uni-app'
import GzDialog from '@/components/GzDialog/GzDialog.vue'
import { useInterruptStore, PRESET_SCENARIOS } from '@/stores/interrupt'
import { logTrace } from '@/utils/traceLog'
import { useSkinClass } from '@/composables/useSkin'
import { todayKey } from '@/stores/daily'
import { ROUTES } from '@/router/routes'
import { WARN_COLOR } from '@/config/palette'
import { showModal } from '@/utils/dialog'
import type { CueKind } from '@/config/audio'
import {
  BREATH_CUE_CYCLE,
  BREATH_GUIDE,
  BREATH_SPLIT,
  BREATH_TRACK,
  BREATH_TRACK_CYCLE,
} from '@/config/audio'
import {
  playCue,
  prefetchAmbient,
  prefetchCue,
  startAmbient,
  stopAmbient,
  teardownAudio,
} from '@/utils/audio'

const store = useInterruptStore()
const skinClass = useSkinClass()

const DURATIONS = [1, 2, 3] as const

/**
 * 说明文案：一记是"吸 / 呼各一声轻响"（2026-09-22 起**屏息不响**），连续引导是"一段陪到底"。
 *
 * 文案必须跟着 `CUE_SOURCES.hold` 的实际状态走 —— 屏息已经不响，还说"吸 · 屏 · 呼"就是骗人。
 */
const guideHint =
  BREATH_GUIDE === 'track'
    ? '一段连续的呼吸引导会陪着你走完全程（可在「设置 → 静修声音」里关掉）。'
    : '吸气与呼气各有一声轻响领着你，屏息那七秒是静的（可在「设置 → 静修声音」里关掉）。'

const selectedId = ref<string>(PRESET_SCENARIOS[0].id)
const minutes = ref<number>(1)
const addOpen = ref(false)
const newName = ref('')
const newAlt = ref('')

const allScenarios = computed(() => store.scenarios())
const selected = computed(
  () => allScenarios.value.find((s) => s.id === selectedId.value) ?? allScenarios.value[0],
)

const todayHeld = computed(() => store.heldOn(todayKey()))
const totalHeld = computed(() => store.totalHeld())

/** 删自建场景：× 很小、点错就没了，先确认 */
function dropCustom(id: string): void {
  const name = allScenarios.value.find((s) => s.id === id)?.name ?? '这个场景'
  showModal({
    title: `删掉「${name}」？`,
    content: '自建的场景删了就找不回来了，预设场景不受影响。',
    confirmText: '删除',
    confirmColor: WARN_COLOR,
    cancelText: '留着',
    success: (res) => {
      if (!res.confirm) return
      store.removeCustom(id)
      if (selectedId.value === id) selectedId.value = allScenarios.value[0].id
    },
  })
}

function saveCustom(): void {
  const ok = store.addCustom(newName.value, newAlt.value)
  if (!ok) return
  newName.value = ''
  newAlt.value = ''
  addOpen.value = false
  const added = store.custom[store.custom.length - 1]
  if (added) selectedId.value = added.id
  uni.showToast({ title: '已加入场景', icon: 'none' })
}

/* ---- 呼吸暂停计时 ---- */
const running = ref(false)
/** 目标时刻（墙上时间）—— 切后台时定时器会被系统挂起，只有按目标时刻算，那几分钟才不丢 */
const targetTs = ref(0)
const remain = ref(0)
let timer: ReturnType<typeof setInterval> | null = null

/** 剩余秒数由目标时刻反推（不再逐秒递减：递减在后台等于把表停了） */
function syncRemain(): void {
  remain.value = Math.max(0, Math.ceil((targetTs.value - Date.now()) / 1000))
}

const pad = (n: number): string => String(n).padStart(2, '0')

const mmss = computed(() => `${pad(Math.floor(remain.value / 60))}:${pad(remain.value % 60)}`)

/**
 * 一圈多长：一记模式用页面自己的 19 秒；连续引导模式用**素材的实测时长**
 * （`BREATH_TRACK_CYCLE`，换素材必须同步改那一个常量）。
 */
const cycleSeconds = BREATH_GUIDE === 'track' ? BREATH_TRACK_CYCLE : BREATH_CUE_CYCLE

/**
 * 4 秒吸 → 7 秒屏 → 8 秒呼。
 *
 * 切分点按**比例**算（`BREATH_SPLIT / BREATH_CUE_CYCLE`），两种引导方式共用这一段：
 * 一圈 19 秒时正好落在 4 / 11 秒，一圈 19.66 秒时落在 4.14 / 11.38 秒 —— 与素材严格同步。
 */
const phase = computed(() => {
  const cycle = (minutes.value * 60 - remain.value) % cycleSeconds
  if (cycle < (BREATH_SPLIT[0] / BREATH_CUE_CYCLE) * cycleSeconds) return 'in'
  if (cycle < (BREATH_SPLIT[1] / BREATH_CUE_CYCLE) * cycleSeconds) return 'hold'
  return 'out'
})

/** 秒数按 4-7-8 的基准写（一圈 19.66 秒时实际是 4.14 / 7.24 / 8.28，取整显示） */
const phaseText = computed(
  () =>
    ({
      in: '吸气 · 4 秒',
      hold: '屏住 · 7 秒',
      out: '呼气 · 8 秒',
    })[phase.value],
)

/**
 * 一记模式的呼吸引导音（2026-09-17；2026-09-22 起只在 `BREATH_GUIDE === 'cue'` 时启用）：
 * 吸 / 呼各在起手给一声，**屏息不响**（`CUE_SOURCES.hold` 是空链，见那边的注释）——
 * 之前只有文字 + 倒计时，闭着眼根本不知道此刻该吸还是该呼。
 * 音量与总开关由 utils/audio.ts 统一管（设置页的「静修声音」）。
 */
let lastCued = ''

/** 相位真的变了才发声（开始时已显式放过一声，避免同一相位连响两次） */
function cuePhase(p: 'in' | 'hold' | 'out', force = false): void {
  if (!running.value) return
  if (!force && p === lastCued) return
  lastCued = p
  playCue(p as CueKind)
}

/*
 * 一记模式才跟着相位出声；连续引导模式由素材自己领（页面只管相位文字）。
 * 两种方式同时上会互相拆台：一记会抢播放实例、把连续引导打断。
 */
if (BREATH_GUIDE === 'cue') watch(phase, (p) => cuePhase(p))

/*
 * 进页面先把声音备好：一记是三条极短的音；连续引导是一段 19.66 秒的循环
 * （首次要下 150–300KB）。缺素材时静默，不影响任何计时与入账。
 */
if (BREATH_GUIDE === 'track') {
  prefetchAmbient(BREATH_TRACK.files)
} else {
  prefetchCue('in')
  prefetchCue('hold')
  prefetchCue('out')
}

function clearTimer(): void {
  if (timer !== null) {
    clearInterval(timer)
    timer = null
  }
}

/** 每 250ms 对表；跑满瞬间结算（与沙漏 / 茶寮同一口径：对表而不是数拍子） */
function tick(): void {
  syncRemain()
  if (Date.now() >= targetTs.value) {
    clearTimer()
    settle(true)
  }
}

/** 秒表本身：抽出来是为了 installation 与「回前台接着走」共用同一条口径 */
function startTicker(): void {
  clearTimer()
  timer = setInterval(tick, 250)
}

function start(): void {
  running.value = true
  targetTs.value = Date.now() + minutes.value * 60 * 1000
  syncRemain()
  if (BREATH_GUIDE === 'track') {
    /*
     * 连续引导：整段循环与页面同一时刻起走。
     * `immediate` 是为了"点了就出声"——本地还没缓存时先流网络地址（同时把文件存下来）。
     */
    startAmbient(BREATH_TRACK.files, BREATH_TRACK.volume, { immediate: true })
  } else {
    /*
     * 一记模式：一声「吸」起手，显式放、不靠 watch ——
     * 1 分钟档（60 秒）的起手相位和上一轮的落点可能恰好相同，watch 就不会触发。
     */
    lastCued = ''
    cuePhase('in', true)
  }
  startTicker()
}

function settle(held: boolean): void {
  running.value = false
  clearTimer()
  /* 先收掉连续引导，否则收功铃响完它还在转（与沙漏 / 茶寮同一顺序） */
  stopAmbient()
  store.finish(minutes.value, held)
  if (held) {
    // 守住誓愿：走事件流入账（原 +5 不变，显式指定以对齐旧口径）
    logTrace({ kind: 'pause.vow.keep', text: `守住了一次「${selected.value.name}」`, value: 5 })
    uni.showToast({ title: `守住了一次「${selected.value.name}」 · +5 修为`, icon: 'none' })
    /* 一记收功；中途放弃则静默 —— 不为放弃庆祝，但也不惩罚 */
    playCue('close')
  } else {
    uni.showToast({ title: '没有关系，再来一次', icon: 'none' })
  }
}

const abortOpen = ref(false)

function abort(): void {
  clearTimer()
  abortOpen.value = true
}

/** 选「继续停」：接着呼吸计时 */
function onAbortKeep(): void {
  abortOpen.value = false
  start()
}

/** 选「退出」：诚实计数，不算守住 */
function onAbortCancel(): void {
  abortOpen.value = false
  settle(false)
}

onUnmounted(() => {
  clearTimer()
  /* 离页收干净：呼吸引导音不该跟着回到大厅还在响 */
  teardownAudio()
})

/*
 * 切后台**不停表也不停声**（2026-09-22 定）。
 *
 * 这一处曾短暂改成"onHide 停表 + 回前台接着走"，理由是"替人结算一次守住，等于替他说了假话"。
 * 但用户的口径更硬：切后台既不停计时也不停声音 —— 定力这件事不该因为回了一条消息就断。
 * 所以按墙上时间走（targetTs），后台那几分钟真真切切算数，回前台由下方 onShow 结算。
 * 与沙漏 / 茶寮完全同一口径，三处不再各说各话。
 */
onShow(() => {
  if (!running.value) return
  if (Date.now() >= targetTs.value) {
    /* 切走期间其实已经念完 → 回前台诚实结算 */
    settle(true)
    uni.showToast({ title: '后台亦在计时 · 定力已入账', icon: 'none' })
    return
  }
  syncRemain()
  startTicker()
})

</script>

<style lang="scss" scoped>
@import './index.scss';
</style>

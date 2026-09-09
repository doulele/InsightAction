<template>
  <view class="page" :class="skinClass">
    <!-- 顶栏 -->
    <view class="nav">
      <view class="nav__side" hover-class="gz-hover" @click="goBack">
        <text class="nav__back">‹</text>
      </view>
      <text class="nav__title">触发干预卡片</text>
      <view class="nav__side" />
    </view>

    <!-- 说明 + 今日统计 -->
    <view class="intro">
      <text class="intro__title">冲动来了，先停一分钟</text>
      <text class="intro__text">
        管住「手先于脑」的时刻：选一个总想打开的开关，陪自己做完一段呼吸，
        把冲动摁回去——这一步比憋一整天更有用。
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
import { computed, ref } from 'vue'
import GzDialog from '@/components/GzDialog/GzDialog.vue'
import { onUnmounted } from 'vue'
import { useInterruptStore, PRESET_SCENARIOS } from '@/stores/interrupt'
import { useXpStore } from '@/stores/xp'
import { useSkinClass } from '@/composables/useSkin'
import { todayKey } from '@/stores/daily'
import { ROUTES } from '@/router/routes'

const store = useInterruptStore()
const xp = useXpStore()
const skinClass = useSkinClass()

const DURATIONS = [1, 2, 3] as const

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

function dropCustom(id: string): void {
  store.removeCustom(id)
  if (selectedId.value === id) selectedId.value = allScenarios.value[0].id
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
const remain = ref(0)
let timer: ReturnType<typeof setInterval> | null = null

const pad = (n: number): string => String(n).padStart(2, '0')

const mmss = computed(() => `${pad(Math.floor(remain.value / 60))}:${pad(remain.value % 60)}`)

/** 4 秒吸 → 7 秒屏 → 8 秒呼（19 秒一个循环） */
const phase = computed(() => {
  const cycle = ((minutes.value * 60 - remain.value) % 19)
  if (cycle < 4) return 'in'
  if (cycle < 11) return 'hold'
  return 'out'
})

const phaseText = computed(
  () =>
    ({
      in: '吸气 · 4 秒',
      hold: '屏住 · 7 秒',
      out: '呼气 · 8 秒',
    })[phase.value],
)

function clearTimer(): void {
  if (timer !== null) {
    clearInterval(timer)
    timer = null
  }
}

function start(): void {
  running.value = true
  remain.value = minutes.value * 60
  clearTimer()
  timer = setInterval(() => {
    remain.value -= 1
    if (remain.value <= 0) {
      clearTimer()
      settle(true)
    }
  }, 1000)
}

function settle(held: boolean): void {
  running.value = false
  clearTimer()
  store.finish(minutes.value, held)
  if (held) {
    xp.gain(5)
    uni.showToast({ title: `守住了一次「${selected.value.name}」 · +5 修为`, icon: 'none' })
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

onUnmounted(clearTimer)

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
.page {
  min-height: 100vh;
  padding: 24rpx $gz-page-pad 60rpx;
}

.nav {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 8rpx 0 20rpx;
}

.nav__side {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 72rpx;
  height: 72rpx;
}

.nav__back {
  font-size: 56rpx;
  color: $gz-ink-2;
  line-height: 1;
}

.nav__title {
  font-size: $gz-fs-title;
  font-weight: 700;
  color: $gz-ink;
}

/* ---- 顶部 ---- */
.intro {
  padding: 30rpx;
  background: $gz-surface;
  border: 1rpx solid $gz-line;
  border-radius: $gz-radius-lg;
}

.intro__title {
  display: block;
  font-size: 34rpx;
  font-weight: 800;
  color: $gz-ink;
}

.intro__text {
  display: block;
  margin-top: 10rpx;
  font-size: $gz-fs-small;
  line-height: 1.8;
  color: $gz-ink-3;
}

.cards {
  display: flex;
  gap: 16rpx;
  margin-top: 22rpx;
}

.card {
  flex: 1;
  padding: 20rpx;
  text-align: center;
  border-radius: $gz-radius-md;
  background: $gz-accent-soft;
}

.card__value {
  font-size: 40rpx;
  font-weight: 800;
  color: $gz-accent;
}

.card__unit {
  margin-left: 4rpx;
  font-size: $gz-fs-caption;
  font-weight: 400;
  color: $gz-accent;
}

.card__label {
  display: block;
  margin-top: 4rpx;
  font-size: $gz-fs-caption;
  color: $gz-ink-2;
}

.section {
  margin-top: 30rpx;
}

.section__head {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  margin-bottom: 16rpx;
}

.section__title {
  font-size: $gz-fs-body;
  font-weight: 700;
  color: $gz-ink;
}

.section__hint {
  font-size: $gz-fs-caption;
  color: $gz-ink-3;
}

/* ---- 场景 ---- */
.chips {
  display: flex;
  flex-wrap: wrap;
  gap: 14rpx;
}

.chip {
  display: flex;
  align-items: center;
  gap: 8rpx;
  padding: 14rpx 22rpx;
  border-radius: 999rpx;
  border: 1rpx solid $gz-line;
  background: $gz-surface;
}

.chip.is-on {
  background: $gz-accent;
  border-color: $gz-accent;
}

.chip.is-on .chip__name {
  color: $gz-on-cta;
}

.chip__name {
  font-size: $gz-fs-body;
  color: $gz-ink;
}

.chip__del {
  font-size: $gz-fs-small;
  color: $gz-ink-3;
  padding: 0 4rpx;
}

.chip.is-on .chip__del {
  color: $gz-on-cta;
}

.chip--add .chip__name {
  color: $gz-accent;
}

.chip__alt {
  display: block;
  margin-top: 16rpx;
  font-size: $gz-fs-small;
  color: $gz-ink-2;
  line-height: 1.7;
}

/* ---- 时长 ---- */
.durs {
  display: flex;
  gap: 14rpx;
}

.dur {
  flex: 1;
  display: flex;
  align-items: baseline;
  justify-content: center;
  gap: 6rpx;
  height: 96rpx;
  border-radius: $gz-radius-md;
  background: $gz-surface;
  border: 1rpx solid $gz-line;
}

.dur.is-on {
  border-color: $gz-accent;
  background: $gz-accent-soft;
}

.dur__num {
  font-size: 40rpx;
  font-weight: 800;
  color: $gz-ink;
}

.dur__unit {
  font-size: $gz-fs-caption;
  color: $gz-ink-3;
}

.start {
  margin-top: 24rpx;
  height: 96rpx;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: $gz-radius-md;
  background: linear-gradient(90deg, $gz-accent, $gz-grad-to);
  color: #fff;
  font-size: 34rpx;
  font-weight: 700;
  letter-spacing: 0.06em;
  box-shadow: 0 10rpx 24rpx rgba(0, 0, 0, 0.14);
}

/* ---- 呼吸中 ---- */
.pause {
  margin-top: 40rpx;
  padding: 60rpx 40rpx 40rpx;
  text-align: center;
  background: $gz-surface;
  border: 1rpx solid $gz-line;
  border-radius: $gz-radius-lg;
}

.pause__phase {
  display: block;
  font-size: 40rpx;
  font-weight: 800;
  letter-spacing: 0.1em;
  color: $gz-accent;
}

.pause__phase.is-hold {
  color: $gz-ink-2;
}

.pause__phase.is-out {
  color: $gz-ink-3;
}

.pause__clock {
  display: block;
  margin-top: 30rpx;
  font-size: 120rpx;
  font-weight: 800;
  line-height: 1;
  color: $gz-ink;
  font-variant-numeric: tabular-nums;
}

.pause__scene {
  display: block;
  margin-top: 26rpx;
  font-size: $gz-fs-small;
  color: $gz-ink-3;
}

.pause__acts {
  margin-top: 40rpx;
}

.pause__cancel {
  display: inline-flex;
  padding: 16rpx 40rpx;
  border-radius: 999rpx;
  border: 1rpx solid $gz-line;
  color: $gz-ink-3;
  font-size: $gz-fs-small;
}

.foot {
  padding: 44rpx 0 10rpx;
  text-align: center;
}

.foot__text {
  font-size: $gz-fs-caption;
  color: $gz-ink-3;
}

/* ---- 弹层 ---- */
.overlay {
  position: fixed;
  inset: 0;
  z-index: 200;
  display: flex;
  align-items: flex-end;
  background: rgba(0, 0, 0, 0.35);
}

.sheet {
  width: 100%;
  padding: 36rpx 32rpx calc(40rpx + env(safe-area-inset-bottom));
  border-radius: $gz-radius-lg $gz-radius-lg 0 0;
  background: $gz-surface;
}

.sheet__title {
  display: block;
  font-size: 32rpx;
  font-weight: 800;
  color: $gz-ink;
}

.sheet__input {
  margin-top: 20rpx;
  padding: 20rpx 24rpx;
  border-radius: $gz-radius-md;
  background: $gz-surface;
  border: 1rpx solid $gz-line;
  font-size: $gz-fs-body;
  color: $gz-ink;
}

.sheet__row {
  display: flex;
  gap: 16rpx;
  margin-top: 28rpx;
}

.sheet__btn {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  height: 88rpx;
  border-radius: $gz-radius-md;
  background: $gz-accent;
  color: $gz-on-cta;
  font-size: $gz-fs-body;
  font-weight: 600;
}

.sheet__btn--ghost {
  background: transparent;
  border: 1rpx solid $gz-line;
  color: $gz-ink-2;
}
</style>

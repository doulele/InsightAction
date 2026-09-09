<template>
  <view class="page" :class="skinClass">
    <!-- 顶栏：返回 + 标题 -->
    <view class="nav">
      <view class="nav__side" hover-class="gz-hover" @click="goBack">
        <text class="nav__back">‹</text>
      </view>
      <text class="nav__title">习惯打卡</text>
      <view class="nav__side" />
    </view>

    <!-- 今日总况 -->
    <view class="today">
      <text class="today__label">今日打卡</text>
      <text class="today__num">{{ doneToday }}<text class="today__unit">/{{ habit.habits.length }} 个</text></text>
      <text class="today__hint">{{ todayHint }}</text>
    </view>

    <!-- 添加习惯 -->
    <view class="add">
      <input
        v-model="name"
        class="add__input"
        placeholder="加一个想养成的习惯…"
        placeholder-class="add__ph"
        :maxlength="12"
        confirm-type="done"
        @confirm="doAdd"
      />
      <view class="add__btn" hover-class="gz-hover" @click="doAdd">加入</view>
    </view>
    <view v-if="!habit.habits.length" class="suggest">
      <text class="suggest__label">没有头绪？点一个先开始</text>
      <view class="suggest__row">
        <view
          v-for="s in SUGGESTS"
          :key="s"
          class="suggest__chip"
          hover-class="gz-hover"
          @click="fillSuggestion(s)"
        >
          {{ s }}
        </view>
      </view>
    </view>

    <!-- 习惯列表 -->
    <view v-if="!habit.habits.length" class="empty">
      <view class="empty__seal">惯</view>
      <text class="empty__title">还没有习惯</text>
      <text class="empty__desc">习惯别贪多。先守住一两个，\n等它长成身体的一部分，再加新的。</text>
    </view>
    <view v-else class="list">
      <view v-for="h in list" :key="h.id" class="card">
        <view class="card__main">
          <view class="card__name-row">
            <text class="card__name">{{ h.name }}</text>
            <text v-if="h.streak > 0" class="card__streak">连 {{ h.streak }} 天</text>
          </view>
          <!-- 近 7 天点阵 -->
          <view class="card__week">
            <view v-for="c in h.cells" :key="c.day" class="card__dot" :class="c.cls" />
          </view>
          <text class="card__days">{{ h.doneCount }} 次总打卡</text>
        </view>
        <view class="card__act" :class="{ 'is-on': h.doneToday }" hover-class="gz-hover" @click="toggle(h)">
          {{ h.doneToday ? '✓ 已打卡' : '打卡' }}
        </view>
        <view class="card__del" hover-class="gz-hover" @click.stop="drop(h.id)">删</view>
      </view>
    </view>

    <view class="foot">
      <text class="foot__text">习惯是第二天性 · 你喂它什么，它会长成什么</text>
    </view>

    <!-- 删除确认：主题随当前模式，破坏性键语义红 -->
    <GzDialog
      variant="danger"
      :show="dropId !== null"
      title="删掉这个习惯？"
      :content="dropHint"
      confirm-text="删除"
      cancel-text="留着"
      @cancel="dropId = null"
      @confirm="dropConfirm"
    />
  </view>
</template>

<script setup lang="ts">
/**
 * 习惯打卡（批次 C）· 分包 subpkg-action：
 * 自定义习惯（上限 9 个），每日一勾；每习惯展示近 7 天点阵与连续打卡数。
 * 打卡事件同时写入痕迹流（供周报/时间轴聚合）。
 */
import { computed, ref } from 'vue'
import GzDialog from '@/components/GzDialog/GzDialog.vue'
import { onShow } from '@dcloudio/uni-app'
import { useHabitStore, type Habit } from '@/stores/habit'
import { useTraceStore } from '@/stores/trace'
import { useXpStore } from '@/stores/xp'
import { todayKey } from '@/stores/daily'
import { useSkinClass } from '@/composables/useSkin'
import { ROUTES } from '@/router/routes'

const habit = useHabitStore()
const trace = useTraceStore()
const skinClass = useSkinClass()

const SUGGESTS = ['喝水 2L', '早睡 23:30', '阅读 20 分钟', '散步 30 分钟', '复盘 3 行', '戒刷手机 1h'] as const

const name = ref('')

function fillSuggestion(s: string): void {
  name.value = s
  doAdd()
}

function doAdd(): void {
  if (habit.add(name.value)) {
    name.value = ''
  } else {
    uni.showToast({ title: name.value.trim() ? '加不进去' : '先写个名字吧', icon: 'none' })
  }
}

const doneToday = computed(() => habit.doneOn())

const todayHint = computed(() => {
  const n = doneToday.value
  const total = habit.habits.length
  if (total === 0) return '先从一两个习惯开始'
  if (n === total) return '全勤。明天同一时刻，再续一次约'
  return n > 0 ? `还差 ${total - n} 个，稳住` : '今天一个还没打'
})

interface Row {
  id: number
  name: string
  streak: number
  doneToday: boolean
  doneCount: number
  cells: { day: string; cls: string }[]
}

const list = computed<Row[]>(() => {
  const today = todayKey()
  return habit.habits.map((h: Habit) => {
    const days = habit.daysOf(h.id)
    const doneToday = days.includes(today)
    const cells: Row['cells'] = []
    for (let i = 6; i >= 0; i--) {
      const d = new Date()
      d.setDate(d.getDate() - i)
      const k = todayKey(d)
      cells.push({
        day: k,
        cls: k === today && doneToday ? 'is-today' : days.includes(k) ? 'is-on' : '',
      })
    }
    return {
      id: h.id,
      name: h.name,
      streak: habit.streakOf(h.id),
      doneToday,
      doneCount: days.length,
      cells,
    }
  })
})

function toggle(row: Row): void {
  const nowDone = habit.toggle(row.id)
  if (nowDone) {
    trace.push('habit', row.name)
    useXpStore().gain(6)
    uni.showToast({ title: `「${row.name}」今日已打卡`, icon: 'none' })
  }
}

/** 待删除习惯 id（null = 弹框关闭） */
const dropId = ref<number | null>(null)
const dropHint = computed(() => {
  const target = habit.habits.find((h) => h.id === dropId.value)
  return target ? `「${target.name}」的打卡记录将一并清除。` : ''
})

function drop(id: number): void {
  dropId.value = id
}

function dropConfirm(): void {
  const id = dropId.value
  dropId.value = null
  if (id === null) return
  habit.remove(id)
}

function goBack(): void {
  const pages = getCurrentPages()
  if (pages.length > 1) {
    uni.navigateBack()
  } else {
    uni.switchTab({ url: ROUTES.tabAction })
  }
}
</script>

<style lang="scss" scoped>
.page {
  min-height: 100vh;
  padding: calc(var(--status-bar-height) + 16rpx) $gz-page-pad 60rpx;
  box-sizing: border-box;
}

.nav {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 8rpx 0 10rpx;
}

.nav__side {
  width: 76rpx;
  height: 76rpx;
}

.nav__back {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 76rpx;
  height: 76rpx;
  border: 1rpx solid $gz-line;
  border-radius: 50%;
  background: $gz-surface;
  color: $gz-ink-2;
  font-size: 52rpx;
  line-height: 1;
  padding-bottom: 8rpx;
}

.nav__title {
  font-size: 34rpx;
  font-weight: 700;
  letter-spacing: 0.08em;
  color: $gz-ink;
}

/* 今日总况 */
.today {
  margin-top: 16rpx;
  padding: 30rpx;
  background: $gz-surface;
  border: 1rpx solid $gz-line;
  border-radius: $gz-radius-lg;
  display: flex;
  flex-direction: column;
  align-items: center;
}

.today__label {
  font-size: $gz-fs-caption;
  letter-spacing: 0.14em;
  color: $gz-accent;
}

.today__num {
  margin-top: 14rpx;
  font-size: 68rpx;
  font-weight: 800;
  line-height: 1;
  color: $gz-ink;
}

.today__unit {
  font-size: $gz-fs-small;
  font-weight: 400;
  color: $gz-ink-3;
}

.today__hint {
  margin-top: 16rpx;
  font-size: $gz-fs-caption;
  color: $gz-ink-3;
}

/* 添加 */
.add {
  display: flex;
  gap: 16rpx;
  margin-top: 24rpx;
}

.add__input {
  flex: 1;
  padding: 20rpx 24rpx;
  background: $gz-input-bg;
  border: 1rpx solid $gz-line;
  border-radius: $gz-radius-md;
  font-size: $gz-fs-small;
  color: $gz-ink;
}

.add__ph {
  color: $gz-ink-3;
}

.add__btn {
  flex: none;
  display: flex;
  align-items: center;
  padding: 0 34rpx;
  border-radius: $gz-radius-md;
  background: $gz-accent;
  color: $gz-on-cta;
  font-size: $gz-fs-small;
  font-weight: 600;
}

.suggest {
  margin-top: 18rpx;
  padding: 20rpx 24rpx;
  border: 1rpx dashed $gz-line;
  border-radius: $gz-radius-md;
}

.suggest__label {
  font-size: $gz-fs-caption;
  color: $gz-ink-3;
}

.suggest__row {
  display: flex;
  flex-wrap: wrap;
  gap: 12rpx;
  margin-top: 14rpx;
}

.suggest__chip {
  padding: 8rpx 20rpx;
  border-radius: 999rpx;
  background: $gz-accent-soft;
  color: $gz-accent;
  font-size: $gz-fs-caption;
}

/* 列表 */
.list {
  display: flex;
  flex-direction: column;
  gap: 18rpx;
  margin-top: 24rpx;
}

.card {
  display: flex;
  align-items: center;
  gap: 20rpx;
  padding: 26rpx 28rpx;
  background: $gz-surface;
  border: 1rpx solid $gz-line;
  border-radius: $gz-radius-md;
}

.card__main {
  flex: 1;
  min-width: 0;
}

.card__name-row {
  display: flex;
  align-items: baseline;
  gap: 14rpx;
}

.card__name {
  font-size: $gz-fs-body;
  font-weight: 700;
  color: $gz-ink;
}

.card__streak {
  padding: 2rpx 12rpx;
  border-radius: 999rpx;
  font-size: 18rpx;
  background: $gz-accent-soft;
  color: $gz-accent;
}

.card__week {
  display: flex;
  gap: 8rpx;
  margin-top: 16rpx;
}

.card__dot {
  width: 20rpx;
  height: 20rpx;
  border-radius: 50%;
  background: var(--gz-line-soft);
}

.card__dot.is-on {
  background: $gz-accent;
}

.card__dot.is-today {
  background: $gz-accent;
  box-shadow: 0 0 0 4rpx $gz-accent-soft;
}

.card__days {
  display: block;
  margin-top: 10rpx;
  font-size: $gz-fs-caption;
  color: $gz-ink-3;
}

.card__act {
  flex: none;
  padding: 16rpx 24rpx;
  border-radius: 999rpx;
  border: 1rpx solid $gz-line;
  font-size: $gz-fs-caption;
  color: $gz-ink-3;
}

.card__act.is-on {
  background: $gz-accent;
  border-color: $gz-accent;
  color: $gz-on-cta;
  font-weight: 600;
}

.card__del {
  flex: none;
  padding: 6rpx 10rpx;
  font-size: 20rpx;
  color: $gz-ink-3;
}

/* 空态 */
.empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 80rpx 40rpx 0;
}

.empty__seal {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 100rpx;
  height: 100rpx;
  border: 2rpx solid $gz-accent;
  border-radius: 24rpx;
  background: $gz-accent-soft;
  color: $gz-accent;
  font-size: 44rpx;
  font-weight: 700;
}

.empty__title {
  margin-top: 26rpx;
  font-size: $gz-fs-title;
  font-weight: 700;
  color: $gz-ink;
}

.empty__desc {
  margin-top: 14rpx;
  font-size: $gz-fs-small;
  line-height: 1.9;
  text-align: center;
  color: $gz-ink-3;
  white-space: pre-line;
}

.foot {
  margin-top: 44rpx;
  display: flex;
  justify-content: center;
}

.foot__text {
  font-size: $gz-fs-caption;
  letter-spacing: 0.06em;
  color: $gz-ink-3;
}
</style>

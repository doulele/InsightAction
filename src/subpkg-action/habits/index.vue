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
      <view class="empty__seal gz-motion">惯</view>
      <text class="empty__title">{{ $p('empty.habits.title') }}</text>
      <text class="empty__desc">{{ $p('empty.habits.desc') }}</text>
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
import { logTrace } from '@/utils/traceLog'
import { todayKey } from '@/stores/daily'
import { useSkinClass } from '@/composables/useSkin'
import { ROUTES } from '@/router/routes'

const habit = useHabitStore()
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
    logTrace({ kind: 'action.habit', text: row.name })
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
@import './index.scss';
</style>

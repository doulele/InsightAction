<template>
  <view class="page" :class="skinClass">
    <!-- 顶栏：返回 + 标题 -->
        <SubNav :fallback="ROUTES.tabAction">习惯打卡</SubNav>

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
        <!--
          「立为日课」（2026-09-17）：给这条习惯一个期限。
          习惯是永不到期的打卡；日课是"守住 N 天就收束"，有目标、有回望、能进周报。
          转走时把已有的打卡记录一起带过去（checks），然后删掉原习惯 —— 不留两份真相。
        -->
        <view class="card__to" hover-class="gz-hover" @click.stop="toDaily(h)">立为日课</view>
        <view class="card__del" hover-class="gz-hover" @click.stop="drop(h.id)">删</view>
      </view>
    </view>

    <view class="foot">
      <text class="foot__text">习惯是第二天性 · 你喂它什么，它会长成什么</text>
      <text class="foot__text">想给它一个期限（守住 N 天就收束）？点「立为日课」，打卡记录会一并带过去。</text>
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

    <!--
      主题输入弹框（2026-09-23）：立日课时的「自定义守住多少天」。
      原先走原生 `editable` 弹框（白底不跟皮肤，说明会被当成输入框初始值）；
      这里是数字，所以单行 + 数字键盘 + 3 位上限。
    -->
    <GzDialog
      v-model:show="customShow"
      :input="true"
      :banner="false"
      :input-type="'number'"
      title="总共守住多少天"
      :content="`${DAILY_MIN_DAYS} ~ ${DAILY_MAX_DAYS} 天之间 —— 守住这么多天，它就收束。`"
      :placeholder="`${DAILY_MIN_DAYS} ~ ${DAILY_MAX_DAYS} 天`"
      confirm-text="立它"
      cancel-text="算了"
      :maxlength="3"
      @confirm="onCustomConfirm"
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
import { DAILY_MAX_DAYS, DAILY_MIN_DAYS, usePlanStore } from '@/stores/plan'
import { logTrace } from '@/utils/traceLog'
import { todayKey } from '@/stores/daily'
import { useSkinClass } from '@/composables/useSkin'
import { navigateTo, ROUTES } from '@/router/routes'
import { showModal } from '@/utils/dialog'

const habit = useHabitStore()
/** 日课：习惯的"有期限版"（见 stores/plan.ts 的 PlanCadence） */
const plan = usePlanStore()
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

/* ---------------- 立为日课（2026-09-17） ----------------
 * 习惯是"永不到期的打卡"，日课是"守住 N 天就收束"：
 * 有目标天数、有进度、收束时能写回望、能进周报的「一条路」。
 * 所以「每天重复一次」的事最终应该长在计划里；习惯页保留为最轻的入口。
 */
function toDaily(h: Row): void {
  const presets = [7, 21, 30, 100]
  const carried = habit.daysOf(h.id).length
  uni.showActionSheet({
    /* 文案写"总共"：已有的打卡天数会一并计入，不说清会让人以为要从零开始 */
    itemList: [
      ...presets.map((d) => (carried ? `总共守住 ${d} 天（已带 ${carried} 天）` : `总共守住 ${d} 天`)),
      '自定义天数…',
    ],
    success: (res) => {
      /* 自定义（2026-09-17）：与计划页的「自定义」同一区间 3 ~ 365 天 */
      if (res.tapIndex === presets.length) {
        toDailyCustom(h)
        return
      }
      const target = presets[res.tapIndex]
      if (!target) return
      createDaily(h, target)
    },
  })
}

/**
 * 自定义天数（2026-09-23：输入从原生 `editable` 弹框改成 GzDialog 的数字输入）。
 * 口径不变：填了合法值才建，区间外的值夹到边界（store 里还会再兜一道）。
 */
const customFor = ref<Row | null>(null)
const customShow = computed({
  get: () => customFor.value !== null,
  set: (v: boolean) => {
    if (!v) customFor.value = null
  },
})

function toDailyCustom(h: Row): void {
  customFor.value = h
}

function onCustomConfirm(value: string): void {
  const h = customFor.value
  customFor.value = null
  if (!h) return
  const raw = Math.round(Number(value))
  if (!Number.isFinite(raw) || raw <= 0) {
    uni.showToast({ title: `填一个 ${DAILY_MIN_DAYS} ~ ${DAILY_MAX_DAYS} 之间的天数`, icon: 'none' })
    return
  }
  createDaily(h, Math.min(DAILY_MAX_DAYS, Math.max(DAILY_MIN_DAYS, raw)))
}

/** 真正落地：把习惯连同打卡记录转成一条日课 */
function createDaily(h: Row, target: number): void {
  const carried = habit.daysOf(h.id).length
  /* 已有的打卡记录一并带过去：历史是真的，不该因为换了容器就消失 */
  const checks = habit.daysOf(h.id).map((day) => ({ day, state: 'kept' as const }))
  const created = plan.addPlan({
    title: h.name,
    kind: 'long',
    cadence: 'daily',
    targetDays: target,
    checks,
  })
  if (!created) return
  habit.remove(h.id)
  /*
   * 带过来的历史可能已经够了 —— 那时 addPlan 会直接把它收束（见 stores/plan.ts）。
   * 如实说明，不说"已立下、去守 N 天"（那会让人以为还得从头守）。
   */
  uni.showToast({
    title:
      created.status === 'done'
        ? `已达标 · ${carried} 天都算数`
        : carried
          ? `已立为日课 · 已带 ${carried} 天`
          : `已立为日课 · 守住 ${target} 天`,
    icon: 'none',
  })
  navigateTo(ROUTES.actionPlanDetail, { id: created.id })
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

</script>

<style lang="scss" scoped>
@import './index.scss';
</style>

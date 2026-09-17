<template>
  <view class="page" :class="skinClass">
    <view class="nav">
      <view class="nav__side" hover-class="gz-hover" @click="goBack">
        <text class="nav__back">‹</text>
      </view>
      <text class="nav__title">{{ w.plan }}</text>
      <view class="nav__side" hover-class="gz-hover" @click="editOpen = true">
        <text class="nav__edit">改</text>
      </view>
    </view>

    <view v-if="!item" class="missing">
      <text class="missing__text">这条{{ w.plan }}已经不在了（可能已被删除）。</text>
    </view>

    <template v-else>
      <!-- 头：标题 / 内容 / 状态 / 进度 -->
      <view class="head">
        <view class="head__row">
          <text class="head__title">{{ item.title }}</text>
          <text v-if="item.kind === 'long'" class="head__tag">{{ horizonLabel }}</text>
          <text v-if="item.challenge" class="head__tag">{{ challengeLabel }}</text>
          <text class="head__status">{{ statusLabel }}</text>
        </view>
        <text v-if="item.note" class="head__note">{{ item.note }}</text>

        <view class="bar">
          <view class="bar__fill" :style="{ width: `${progress.pct}%` }" />
        </view>
        <view class="head__meta">
          <text class="head__progress">{{ w.progress(progress.done, progress.total) }}</text>
          <text v-if="nextTitle" class="head__next">{{ w.next }} · {{ nextTitle }}</text>
        </view>
        <text class="head__dates">{{ datesText }}</text>
        <text v-if="stale" class="head__stale">{{ w.stale }}</text>
      </view>

      <!-- today 型：单步，勾掉即收束 -->
      <view v-if="item.kind === 'today'" class="card">
        <view class="single" hover-class="gz-hover" @click="toggleWhole">
          <view class="single__check" :class="{ 'is-on': item.status === 'done' }">
            <text v-if="item.status === 'done'" class="single__tick">✓</text>
          </view>
          <text class="single__text">{{ item.status === 'done' ? '已完成' : '完成这件事' }}</text>
        </view>
      </view>

      <!-- long 型：节点列表 -->
      <view v-else class="card">
        <view class="card__head">
          <text class="card__title">{{ w.node }}</text>
          <text class="card__n">{{ progress.done }}/{{ progress.total }}</text>
        </view>

        <view v-if="nodeSteps.length" class="steps">
          <PlanStep v-for="s in nodeSteps" :key="s.key" :item="s" @toggle="onToggleNode">
            <view v-if="!s.done" class="mini" hover-class="gz-hover" @click="schedule(s)">
              {{ scheduledToday(s) ? '取消排期' : '排到今天' }}
            </view>
            <view class="mini" hover-class="gz-hover" @click="dropNode(s)">删除</view>
          </PlanStep>
        </view>
        <text v-else class="card__sub">还没有{{ w.node }}。把它拆成能一步步走完的样子，再开始。</text>

        <view class="quick">
          <input
            v-model="newNode"
            class="quick__input"
            :placeholder="`加一个${w.node}`"
            placeholder-class="quick__ph"
            :maxlength="30"
            confirm-type="done"
            @confirm="addNode"
          />
          <view class="quick__btn" hover-class="gz-hover" @click="addNode">加</view>
        </view>
      </view>

      <!-- 底部动作 -->
      <view class="acts">
        <view v-if="item.status === 'active' && item.kind === 'long'" class="act act--ghost" hover-class="gz-hover" @click="confirmArchive">
          搁置这条
        </view>
        <view v-if="item.status !== 'active'" class="act act--ghost" hover-class="gz-hover" @click="reopen">
          重新开始
        </view>
        <view class="act act--danger" hover-class="gz-hover" @click="confirmRemove">删除</view>
      </view>

      <text class="foot">不催办、不扣分 —— 走不完的路，收起来也是一种诚实。</text>
    </template>

    <!-- 编辑 -->
    <view v-if="editOpen" class="overlay" @touchmove.stop.prevent @click="editOpen = false">
      <view class="sheet" @click.stop>
        <text class="sheet__title">编辑</text>
        <input v-model="editTitle" class="sheet__input" placeholder="标题" placeholder-class="quick__ph" :maxlength="20" />
        <input v-model="editNote" class="sheet__input" placeholder="为什么做 / 做成什么样（选填）" placeholder-class="quick__ph" :maxlength="60" />
        <text class="sheet__label">期限档</text>
        <view class="chips">
          <view
            v-for="h in HORIZONS"
            :key="h.id"
            class="chip"
            :class="{ 'is-on': editHorizon === h.id }"
            hover-class="gz-hover"
            @click="editHorizon = h.id"
          >
            {{ h.label }}
          </view>
        </view>
        <text class="sheet__label">挑战类型</text>
        <view class="chips">
          <view
            v-for="c in CHALLENGES"
            :key="c.id"
            class="chip"
            :class="{ 'is-on': editChallenge === c.id }"
            hover-class="gz-hover"
            @click="editChallenge = editChallenge === c.id ? undefined : c.id"
          >
            {{ c.label }}
          </view>
        </view>
        <text class="sheet__label">目标日</text>
        <picker mode="date" :value="editDue || todayK" @change="onPickDue">
          <view class="picker">{{ editDue || '不设目标日' }}</view>
        </picker>
        <view v-if="editDue" class="clear" hover-class="gz-hover" @click="editDue = ''">清除目标日</view>
        <view class="sheet__row">
          <view class="btn btn--ghost" hover-class="gz-hover" @click="editOpen = false">取消</view>
          <view class="btn" hover-class="gz-hover" @click="saveEdit">保存</view>
        </view>
      </view>
    </view>

    <PlanReflect :show="!!reflectOn" :plan="reflectOn" @confirm="onReflectConfirm" @skip="onReflectSkip" />
  </view>
</template>

<script setup lang="ts">
/**
 * 行 · 计划详情（分包 subpkg-action）：节点增删改勾选 · 排期 · 收束回望 · 搁置 / 重启。
 * 计分、收束、自动归档的规则全部在 stores/plan.ts 里闭环 —— 本页只是它的操作面板。
 * 样式外置在 plans/detail.scss（超过 100 行，按项目约定拆出）。
 */
import { computed, ref, watch } from 'vue'
import { onLoad } from '@dcloudio/uni-app'
import {
  usePlanStore,
  LONG_STALE_DAYS,
  type ChallengeType,
  type PlanHorizon,
  type Plan,
  type StepItem,
} from '@/stores/plan'
import { CHALLENGE_LABEL, HORIZON_LABEL, planWords } from '@/config/lexicon'
import { useModeStore } from '@/stores/mode'
import { useSkinClass } from '@/composables/useSkin'
import { todayKey } from '@/stores/daily'
import { ROUTES } from '@/router/routes'

const plan = usePlanStore()
const mode = useModeStore()
const skinClass = useSkinClass()
const w = computed(() => planWords(mode.id))

const todayK = todayKey()
const id = ref(0)
onLoad((query) => {
  id.value = Number(query?.id ?? 0)
  plan.sweep()
})

const item = computed<Plan | undefined>(() => plan.byId(id.value))
const progress = computed(() => (item.value ? plan.progressOf(item.value) : { done: 0, total: 0, pct: 0 }))
const nextTitle = computed(() => (item.value ? plan.nextNodeOf(item.value)?.title ?? '' : ''))
const challengeLabel = computed(() => (item.value?.challenge ? CHALLENGE_LABEL[item.value.challenge] : ''))
/** 期限档：老数据没有存档，按目标日的跨度推（store 里同一个口径） */
const horizonLabel = computed(() =>
  item.value ? HORIZON_LABEL[plan.horizonOf(item.value)] : '',
)

const HORIZONS: ReadonlyArray<{ id: PlanHorizon; label: string }> = (
  ['short', 'mid', 'long'] as PlanHorizon[]
).map((h) => ({ id: h, label: HORIZON_LABEL[h] }))
const CHALLENGES: Array<{ id: ChallengeType; label: string }> = (
  ['abstain', 'try', 'cog'] as ChallengeType[]
).map((c) => ({ id: c, label: CHALLENGE_LABEL[c] }))

function statusLabelOf(p: Plan): string {
  if (p.status === 'done') return w.value.statusDone
  if (p.status === 'archived') return w.value.statusArchived
  return w.value.statusActive
}
const statusLabel = computed(() => (item.value ? statusLabelOf(item.value) : ''))

const datesText = computed(() => {
  const p = item.value
  if (!p) return ''
  const parts = [`起于 ${p.startDay}`]
  if (p.doneAt) {
    const d = new Date(p.doneAt)
    parts.push(`收束于 ${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`)
  } else if (p.dueDay) {
    const remain = plan.remainDaysOf(p)
    if (remain !== null) {
      if (remain > 0) parts.push(`目标日 ${p.dueDay} · 还剩 ${remain} 天`)
      else if (remain === 0) parts.push(`今天就是目标日`)
      else parts.push(`目标日已过 ${-remain} 天`)
    }
  }
  return parts.join(' · ')
})

/** 30 天无动作的轻问（只提示，不自动处理） */
const stale = computed(() => {
  const p = item.value
  if (!p || p.status !== 'active') return false
  const days = Math.round((Date.parse(`${todayK}T12:00:00`) - p.updatedAt) / 86400000)
  return days >= LONG_STALE_DAYS
})

/* ---------------- 节点 ---------------- */
const nodeSteps = computed<StepItem[]>(() => {
  const p = item.value
  if (!p) return []
  return p.nodes.map((n) => ({
    key: `n-${p.id}-${n.id}`,
    kind: 'node' as const,
    planId: p.id,
    nodeId: n.id,
    title: n.title,
    planTitle: p.title,
    done: n.done,
    overdue: Boolean(n.dueDay && n.dueDay < todayK && !n.done),
    shelfDays: n.dueDay && n.dueDay < todayK && !n.done
      ? Math.round((Date.parse(`${todayK}T12:00:00`) - Date.parse(`${n.dueDay}T12:00:00`)) / 86400000)
      : 0,
    challenge: p.challenge,
  }))
})

const newNode = ref('')

function addNode(): void {
  const title = newNode.value.trim()
  if (!title || !item.value) return
  if (plan.addNode(item.value.id, { title })) {
    newNode.value = ''
  }
}

function onToggleNode(s: StepItem): void {
  if (s.nodeId === undefined) return
  const res = plan.toggleStep(s.planId, s.nodeId)
  if (res.closed && item.value) reflectOn.value = item.value
}

function scheduledToday(s: StepItem): boolean {
  if (!item.value || s.nodeId === undefined) return false
  return item.value.nodes.find((n) => n.id === s.nodeId)?.dueDay === todayK
}

function schedule(s: StepItem): void {
  if (!item.value || s.nodeId === undefined) return
  plan.scheduleNode(item.value.id, s.nodeId, scheduledToday(s) ? '' : todayK)
}

function dropNode(s: StepItem): void {
  if (!item.value || s.nodeId === undefined) return
  uni.showModal({
    title: '拿掉这一步？',
    content: '其余步骤与进度不受影响。',
    confirmText: '拿掉',
    cancelText: '留着',
    success: (res) => {
      if (res.confirm && item.value && s.nodeId !== undefined) plan.removeNode(item.value.id, s.nodeId)
    },
  })
}

/* ---------------- today 型单步 ---------------- */
function toggleWhole(): void {
  if (!item.value) return
  const res = plan.toggleStep(item.value.id, undefined)
  if (res.closed) {
    // today 型没有回望（它只是一件事），直接给轻提示
    uni.showToast({ title: '今日事已了', icon: 'none' })
  }
}

/* ---------------- 编辑 ---------------- */
const editOpen = ref(false)
const editTitle = ref('')
const editNote = ref('')
const editChallenge = ref<ChallengeType | undefined>(undefined)
const editHorizon = ref<PlanHorizon>('long')
const editDue = ref('')

watch(editOpen, (v) => {
  const p = item.value
  if (!v || !p) return
  editTitle.value = p.title
  editNote.value = p.note ?? ''
  editChallenge.value = p.challenge
  editHorizon.value = plan.horizonOf(p)
  editDue.value = p.dueDay ?? ''
})

function onPickDue(e: { detail: { value: string } }): void {
  editDue.value = e.detail.value
}

function saveEdit(): void {
  const p = item.value
  if (!p) return
  const ok = plan.updatePlan(p.id, {
    title: editTitle.value,
    note: editNote.value,
    challenge: editChallenge.value,
    horizon: editHorizon.value,
    dueDay: editDue.value,
  })
  if (!ok) {
    uni.showToast({ title: '标题不能为空', icon: 'none' })
    return
  }
  editOpen.value = false
}

/* ---------------- 收束 / 搁置 / 重启 / 删除 ---------------- */
const reflectOn = ref<Plan | null>(null)

function onReflectConfirm(text: string): void {
  const p = reflectOn.value
  reflectOn.value = null
  if (!p) return
  plan.writeReflection(p.id, text)
  uni.showToast({ title: '收束 · 这句已存进【知】', icon: 'none' })
}

function onReflectSkip(): void {
  reflectOn.value = null
  uni.showToast({ title: '已收束 · 收下这 20 点修为', icon: 'none' })
}

function confirmArchive(): void {
  const p = item.value
  if (!p) return
  uni.showModal({
    title: `搁置这条${w.value.plan}？`,
    content: '它会移到「已收起」，不扣修为。想回来随时可以重新开始。',
    confirmText: '搁置',
    cancelText: '再走走',
    success: (res) => {
      if (res.confirm && item.value) {
        plan.archivePlan(item.value.id)
        uni.showToast({ title: '已收起', icon: 'none' })
      }
    },
  })
}

function reopen(): void {
  if (!item.value) return
  plan.reopenPlan(item.value.id)
  uni.showToast({ title: '重新开始 · 接着走', icon: 'none' })
}

function confirmRemove(): void {
  const p = item.value
  if (!p) return
  uni.showModal({
    title: '删除这条记录？',
    content: '它和它的所有步骤都会消失，不可找回。已入账的修为不受影响。',
    confirmText: '删除',
    confirmColor: '#B5482C',
    cancelText: '留着',
    success: (res) => {
      if (!res.confirm) return
      plan.removePlan(p.id)
      goBack()
    },
  })
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
@import './detail.scss';
</style>

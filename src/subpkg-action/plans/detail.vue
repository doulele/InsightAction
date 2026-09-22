<template>
  <view class="page" :class="skinClass">
    <!-- 顶栏（顶距与样式统一在 components/SubNav；右侧「改」走 #right 插槽） -->
    <SubNav @back="goBack" @right="editOpen = true">
      {{ w.plan }}
      <template #right><text class="nav__edit">改</text></template>
    </SubNav>

    <view v-if="!item" class="missing">
      <text class="missing__text">这条{{ w.plan }}已经不在了（可能已被删除）。</text>
    </view>

    <template v-else>
      <!-- 头：标题 / 内容 / 状态 / 进度 -->
      <view class="head">
        <view class="head__row">
          <text class="head__title">{{ item.title }}</text>
          <!-- 日课不报期限档：它的期限就是"守住 N 天" -->
          <text v-if="isDaily" class="head__tag">{{ w.daily }}</text>
          <text v-else-if="item.kind === 'long'" class="head__tag">{{ horizonLabel }}</text>
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

      <!--
        daily 型（2026-09-17）：每天重复一次的事（早睡 / 锻炼 / 戒色）。
        三态是「守住 / 破了 / 没记」—— 没记只是空白，不是破了；
        "破了"只有戒断型才有，且不归零、不扣分，可写一句为什么（进【知】的省察）。
      -->
      <view v-else-if="isDaily" class="card">
        <view class="card__head">
          <text class="card__title">{{ w.daily }}</text>
          <text class="card__n">{{ progress.done }}/{{ progress.total }}</text>
        </view>
        <text class="card__sub">
          {{ w.dailyProgress(progress.done, progress.total) }}{{ streak > 1 ? ` · 连续 ${streak} 天` : '' }}
        </text>

        <view class="dact">
          <view
            class="dact__btn"
            :class="{ 'is-on': todayState === 'kept' }"
            hover-class="gz-hover"
            @click="checkToday"
          >
            {{ todayState === 'kept' ? w.keptAct : w.keepAct }}
          </view>
          <view
            v-if="item.challenge === 'abstain'"
            class="dact__break"
            :class="{ 'is-on': todayState === 'broken' }"
            hover-class="gz-hover"
            @click="breakToday"
          >
            {{ todayState === 'broken' ? w.brokenAct : w.breakAct }}
          </view>
        </view>
        <text class="dact__hint">{{ w.dailyHint }}</text>

        <!-- 近 14 天点阵：一眼看出哪几天守住了、哪几天是空白 -->
        <view class="dots">
          <view v-for="d in dotDays" :key="d.day" class="dots__cell" :class="d.cls" />
        </view>
        <!-- 刻意用模式中立的话：三模式下"守住 / 完成 / 守"不是一个词，而这一句只是解释点阵 -->
        <text class="dots__note">最近 14 天 · 点阵只分「记上了」与「空着」（空着可能是没记，也可能是还没到）</text>

        <text class="sheet__label">{{ w.targetLabel }}</text>
        <view class="chips">
          <view
            v-for="n in DAILY_PRESETS"
            :key="n"
            class="chip"
            :class="{ 'is-on': !customOn && progress.total === n }"
            hover-class="gz-hover"
            @click="setTarget(n)"
          >
            {{ w.days(n) }}
          </view>
          <!-- 自定义天数（2026-09-17）：3 ~ 365 天。点了「改」才落地，不边打边生效 -->
          <view class="chip" :class="{ 'is-on': customOn }" hover-class="gz-hover" @click="toggleCustom">自定义</view>
        </view>
        <view v-if="customOn" class="custom">
          <input
            v-model="customDays"
            class="custom__input"
            type="number"
            :maxlength="3"
            :placeholder="`${DAILY_MIN_DAYS} ~ ${DAILY_MAX_DAYS}`"
            placeholder-class="quick__ph"
            confirm-type="done"
            @confirm="applyCustom"
          />
          <text class="custom__unit">天</text>
          <view class="custom__btn" hover-class="gz-hover" @click="applyCustom">改</view>
        </view>
      </view>

      <!--
        long 型：节点**树**（2026-09-17 支持嵌套 ≤5 层）。
        只有叶子是任务：能勾、能排期、能自评进度；父步骤只是分组 ——
        所以这里不写递归组件，而是把树拍平成带 depth 的行（缩进靠 padding-left），
        小程序里递归组件成本高，长列表也更容易卡（见 stores/plan.ts 的「树的走法」）。
      -->
      <view v-else class="card">
        <view class="card__head">
          <text class="card__title">{{ w.node }}</text>
          <text class="card__n">{{ progress.done }}/{{ progress.total }}{{ progress.pct !== ratioPct ? ` · ${progress.pct}%` : '' }}</text>
        </view>
        <text class="card__sub">
          最多 {{ MAX_NODE_DEPTH }} 层：父步骤是分组，只有最末一层能勾选、能排期{{ canProgressPlan ? '、能自评进度' : '' }}。
        </text>

        <view v-if="treeRows.length" class="tree">
          <view
            v-for="r in treeRows"
            :key="r.node.id"
            class="tree__row"
            :class="{ 'is-leaf': !r.hasChildren }"
            :style="{ paddingLeft: `${(r.depth - 1) * NODE_INDENT_RPX}rpx` }"
          >
            <view class="tree__main">
              <text
                v-if="r.hasChildren"
                class="tree__caret"
                hover-class="gz-hover"
                @click="toggleOpen(r.node.id)"
              >
                {{ r.open ? '▾' : '▸' }}
              </text>
              <view
                v-else
                class="tree__check"
                :class="{ 'is-on': r.node.done }"
                hover-class="gz-hover"
                @click="onToggleRow(r)"
              >
                <text v-if="r.node.done" class="tree__tick">✓</text>
              </view>
              <text class="tree__title" :class="{ 'is-done': r.node.done, 'is-group': r.hasChildren }">
                {{ r.node.title }}
              </text>
            </view>

            <!-- 叶子的自评进度（只有中长期的叶子有；拉满等于勾上，见 store.updateNodeProgress） -->
            <view v-if="!r.hasChildren && canProgressPlan" class="bar bar--leaf">
              <view class="bar__fill" :style="{ width: `${rowPct(r.node)}%` }" />
            </view>

            <view class="tree__ops" @click.stop>
              <text v-if="r.depth < MAX_NODE_DEPTH" class="mini" hover-class="gz-hover" @click="addChild(r)">
                ＋ 子{{ w.node }}
              </text>
              <template v-if="!r.hasChildren">
                <text class="mini" hover-class="gz-hover" @click="scheduleNode(r)">
                  {{ scheduledTodayNode(r) ? '取消排期' : '排到今天' }}
                </text>
                <text v-if="canProgressPlan" class="mini" hover-class="gz-hover" @click="pickProgress(r)">进度</text>
              </template>
              <text class="mini" hover-class="gz-hover" @click="dropNodeRow(r)">删除</text>
            </view>
          </view>
        </view>
        <text v-else class="card__sub">还没有{{ w.node }}。把它拆成能一步步走完的样子，再开始。</text>

        <view class="quick">
          <input
            v-model="newNode"
            class="quick__input"
            :placeholder="`加一个${w.node}（之后再往下拆）`"
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
  DAILY_PRESETS,
  DAILY_MIN_DAYS,
  DAILY_MAX_DAYS,
  MAX_NODE_DEPTH,
  NODE_INDENT_RPX,
  PROGRESS_HORIZONS,
  type ChallengeType,
  type PlanHorizon,
  type Plan,
  type PlanNode,
} from '@/stores/plan'
import { CHALLENGE_LABEL, HORIZON_LABEL, planWords } from '@/config/lexicon'
import { useModeStore } from '@/stores/mode'
import { useSkinClass } from '@/composables/useSkin'
import { todayKey } from '@/stores/daily'
import { ROUTES } from '@/router/routes'
import { showModal } from '@/utils/dialog'

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
/**
 * done/total 的百分比。
 * 用来和 `progress.pct` 对比：pct 是**含叶子自评进度**的整体完成度，
 * 两者相等时说明没有自评进度，页面上就不多显示一个百分比（少一个数字少一分噪音）。
 */
const ratioPct = computed(() => {
  const p = progress.value
  return p.total > 0 ? Math.round((p.done / p.total) * 100) : 0
})
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

/** 30 天无动作的轻问（只提示，不自动处理）；日课不问 —— 它天天在勾，问"还继续吗"就是催 */
const stale = computed(() => {
  const p = item.value
  if (!p || p.status !== 'active' || plan.isDaily(p)) return false
  const days = Math.round((Date.parse(`${todayK}T12:00:00`) - p.updatedAt) / 86400000)
  return days >= LONG_STALE_DAYS
})

/* ---------------- 日课（2026-09-17） ---------------- */
const isDaily = computed(() => Boolean(item.value && plan.isDaily(item.value)))

const todayState = computed<'' | 'kept' | 'broken'>(() => {
  const p = item.value
  return p ? (plan.checkOf(p)?.state ?? '') : ''
})

const streak = computed(() => (item.value ? plan.dailyStreak(item.value) : 0))

/** 最近 14 天点阵：守住 / 破了 / 空白（空白不等于破，见 stores/plan.ts 的口径） */
const dotDays = computed<Array<{ day: string; cls: string }>>(() => {
  const p = item.value
  if (!p) return []
  const out: Array<{ day: string; cls: string }> = []
  for (let i = 13; i >= 0; i--) {
    const d = new Date()
    d.setDate(d.getDate() - i)
    const k = todayKey(d)
    const st = plan.checkOf(p, k)?.state
    out.push({
      day: k,
      cls: st === 'kept' ? 'is-on' : st === 'broken' ? 'is-broken' : k === todayK ? 'is-today' : '',
    })
  }
  return out
})

function checkToday(): void {
  const p = item.value
  if (!p) return
  const res = plan.checkDaily(p.id)
  if (res.closed) {
    reflectOn.value = p
    return
  }
  uni.showToast({ title: res.done ? w.value.keptAct : '已退回今天这一笔', icon: 'none' })
}

/** 破了：不归零、不扣分，可写一句为什么（那一句会进【知】的省察） */
function breakToday(): void {
  const p = item.value
  if (!p) return
  showModal({
    title: w.value.brokenAct,
    content: '',
    editable: true,
    placeholderText: '写一句为什么（可留空）—— 知道原因比没破更有用',
    confirmText: '记下',
    cancelText: '算了',
    success: (res) => {
      if (!res.confirm) return
      plan.markDailyBroken(p.id, res.content ?? '')
      uni.showToast({ title: '记下了 · 明天照常', icon: 'none' })
    },
  })
}

function setTarget(n: number): void {
  const p = item.value
  if (!p) return
  customOn.value = false
  if (!plan.setTargetDays(p.id, n)) {
    uni.showToast({ title: `目标定在 ${DAILY_MIN_DAYS} ~ ${DAILY_MAX_DAYS} 天之间`, icon: 'none' })
  }
}

/* ---------------- 自定义目标天数（2026-09-17） ----------------
 * 这里与新建弹层不同：是**改一条已经在守的日课**，所以走"填好 → 点改"，
 * 不在输入过程中就落地（否则输入 100 的过程中会先把目标改成 1、10、100，中途还可能收束）。
 */
const customOn = ref(false)
const customDays = ref('')

function toggleCustom(): void {
  customOn.value = !customOn.value
  if (customOn.value) customDays.value = String(progress.value.total)
}

function applyCustom(): void {
  const p = item.value
  if (!p) return
  const raw = Number(customDays.value)
  if (!Number.isFinite(raw) || raw <= 0) {
    uni.showToast({ title: `填一个 ${DAILY_MIN_DAYS} ~ ${DAILY_MAX_DAYS} 之间的天数`, icon: 'none' })
    return
  }
  const v = Math.round(raw)
  const clamped = Math.min(DAILY_MAX_DAYS, Math.max(DAILY_MIN_DAYS, v))
  const ok = plan.setTargetDays(p.id, clamped)
  if (!ok) {
    uni.showToast({ title: `填一个 ${DAILY_MIN_DAYS} ~ ${DAILY_MAX_DAYS} 之间的天数`, icon: 'none' })
    return
  }
  customDays.value = String(clamped)
  customOn.value = false
  uni.showToast({
    title: clamped !== v ? `超出范围，按 ${clamped} 天算` : `目标改为 ${clamped} 天`,
    icon: 'none',
  })
  /* 改小到已达标时 setTargetDays 会顺手收束 —— 这里补一次回望的机会 */
  if (item.value?.status === 'done') reflectOn.value = item.value
}

/* ---------------- 节点树（2026-09-17 支持嵌套 ≤5 层） ---------------- */

/** 展开态：只记"手动折过/展开过"的那几个节点，默认规则见 openOf */
const expanded = ref<Record<number, boolean>>({})

interface TreeRow {
  node: PlanNode
  /** 根下第一层 = 1 */
  depth: number
  hasChildren: boolean
  open: boolean
}

/** 默认展开第 1 层、更深的收起 —— 5 层全展开会把页面撑成一张密不透风的表 */
function openOf(node: PlanNode, depth: number): boolean {
  const manual = expanded.value[node.id]
  return manual === undefined ? depth <= 1 : manual
}

/** 树 → 拍平的行（只含"当前可见"的节点；折叠的分支不进数组） */
const treeRows = computed<TreeRow[]>(() => {
  const p = item.value
  if (!p) return []
  const rows: TreeRow[] = []
  const walk = (parentId: number | undefined, depth: number): void => {
    const kids = parentId === undefined ? plan.rootsOf(p) : plan.childrenOf(p, parentId)
    for (const node of kids) {
      const has = plan.hasChildren(p, node.id)
      const open = has ? openOf(node, depth) : false
      rows.push({ node, depth, hasChildren: has, open })
      if (has && open) walk(node.id, depth + 1)
    }
  }
  walk(undefined, 1)
  return rows
})

/** 这一档的路开放叶子自评进度（短期不给进度条 —— 一周内走得完的事，勾干净就够了） */
const canProgressPlan = computed(() =>
  Boolean(item.value && PROGRESS_HORIZONS.includes(plan.horizonOf(item.value))),
)

function rowPct(node: PlanNode): number {
  return plan.leafPct(node)
}

function toggleOpen(nodeId: number): void {
  const row = treeRows.value.find((r) => r.node.id === nodeId)
  expanded.value = { ...expanded.value, [nodeId]: !(row?.open ?? false) }
}

/** 勾选：只对叶子有效（父节点在 store 里也会被拒，页面这里先不响应） */
function onToggleRow(r: TreeRow): void {
  const p = item.value
  if (!p || r.hasChildren) return
  const res = plan.toggleStep(p.id, r.node.id)
  if (res.closed) reflectOn.value = p
}

const newNode = ref('')

function addNode(): void {
  const title = newNode.value.trim()
  if (!title || !item.value) return
  if (plan.addNode(item.value.id, { title })) {
    newNode.value = ''
  }
}

/** 加子步骤：到第 MAX_NODE_DEPTH 层就拦下并说明原因（不静默失败） */
function addChild(r: TreeRow): void {
  const p = item.value
  if (!p) return
  if (r.depth >= MAX_NODE_DEPTH) {
    uni.showToast({ title: `最多 ${MAX_NODE_DEPTH} 层 —— 再往下拆，不如另立一条路`, icon: 'none' })
    return
  }
  showModal({
    title: `在「${r.node.title}」下面加一步`,
    editable: true,
    placeholderText: '这一步要做什么（它下面还能再拆）',
    confirmText: '加',
    cancelText: '算了',
    success: (res) => {
      if (!res.confirm) return
      const title = (res.content ?? '').trim()
      if (!title) return
      if (plan.addNode(p.id, { title }, r.node.id)) {
        expanded.value = { ...expanded.value, [r.node.id]: true }
        uni.showToast({ title: '已加一步', icon: 'none' })
      }
    },
  })
}

/** 自评进度：五档比滑块准、也比手填快（拉满等于勾上，见 store.updateNodeProgress） */
function pickProgress(r: TreeRow): void {
  const p = item.value
  if (!p) return
  const options = [0, 25, 50, 75, 100]
  uni.showActionSheet({
    itemList: options.map((n) => (n >= 100 ? '做完了（勾上）' : `${n}%`)),
    success: (res) => {
      const v = options[res.tapIndex] ?? 0
      const out = plan.updateNodeProgress(p.id, r.node.id, v)
      if (out.closed) reflectOn.value = p
    },
  })
}

function scheduledTodayNode(r: TreeRow): boolean {
  return r.node.dueDay === todayK
}

function scheduleNode(r: TreeRow): void {
  const p = item.value
  if (!p) return
  plan.scheduleNode(p.id, r.node.id, scheduledTodayNode(r) ? '' : todayK)
}

/** 删除：父节点会**连子树一起删**，所以确认框里如实报数（不吓人，也不骗人） */
function dropNodeRow(r: TreeRow): void {
  const p = item.value
  if (!p) return
  const n = r.hasChildren ? plan.subtreeIds(p, r.node.id).length : 1
  showModal({
    title: n > 1 ? `拿掉「${r.node.title}」和它下面的 ${n - 1} 步？` : '拿掉这一步？',
    content: '其余步骤与进度不受影响。',
    confirmText: '拿掉',
    cancelText: '留着',
    success: (res) => {
      if (res.confirm) plan.removeNode(p.id, r.node.id)
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
  showModal({
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
  showModal({
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

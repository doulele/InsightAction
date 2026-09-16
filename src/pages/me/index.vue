<template>
  <view class="page" :class="skinClass">
    <!--
      大厅头（五页共用组件）：名号已经并到这里 ——
      原先首屏是「印章『我』」与「名号卡『我』」两个我，现在印章位直接是头像、
      昵称当主标题、右侧挂「起号 / 修改」；点它在本页原地展开下面的编辑面板。
    -->
    <HallHead
      :mark="profile.initial"
      :avatar="profile.avatar"
      :title="profile.nickname || '还没起号'"
      :state="profileSub"
      :action="profile.settled ? '修改 ›' : '起号 ›'"
      :line="headLine"
      :stats="headStats"
      @action="startEdit"
    />

    <!--
      名号编辑面板（只在编辑态出现）：展示态已并入大厅头，所以这里不再有「头像 + 名字」那一行。
      仍用微信的「头像昵称填写能力」（chooseAvatar + type=nickname），拿到什么就存本机什么 ——
      默认不过网，开了云备份才随备份一起走（见 PRIVACY.md）。
    -->
    <view v-if="editing" class="profile">
      <!-- 编辑态 -->
      <view class="profile__edit">
        <!-- #ifdef MP-WEIXIN -->
        <button
          class="profile__avatar-btn"
          open-type="chooseAvatar"
          hover-class="none"
          @chooseavatar="onChooseAvatar"
        >
          <image v-if="profile.avatar" class="profile__img" :src="profile.avatar" mode="aspectFill" />
          <text v-else class="profile__letter">{{ profile.initial }}</text>
        </button>
        <!-- #endif -->
        <view class="profile__fields">
          <input
            class="profile__input"
            type="nickname"
            :value="draftName"
            :maxlength="16"
            placeholder="起个名字"
            placeholder-class="profile__ph"
            @blur="onNameBlur"
          />
          <text class="profile__tip">只存在你本机 · 开启云备份后随备份一起走</text>
        </view>
        <view class="profile__ops">
          <text class="profile__op" hover-class="gz-hover" @click="resetAsk = true">用回默认</text>
          <text class="profile__op is-main" hover-class="gz-hover" @click="finishEdit">完成</text>
        </view>
      </view>
    </view>

    <!-- 第一周解锁引导（第 6 天主角是「我」） -->
    <WeekGuide for="me" />

    <!-- 等级卡：修为 store 真实累计，三模式各 9 级、叫法随皮肤 -->
    <view class="rank">
      <view class="rank__row">
        <view>
          <text class="rank__mode">{{ modeMeta.label }}模式 · {{ modeMeta.growthName }}</text>
          <text class="rank__title">{{ lvName }} <text class="rank__lv">Lv.{{ lv }}</text></text>
        </view>
        <view class="rank__seal">{{ modeMeta.label.slice(0, 1) }}</view>
      </view>
      <view class="bar">
        <view class="bar__fill" :style="{ width: `${lvPct}%` }" />
      </view>
      <view class="rank__next">{{ nextHint }}</view>

      <!-- 起点基线：建档结果直接长在等级卡里；未建档时这一行本身就是入口 -->
      <view class="rank__base" hover-class="gz-hover" @click="openAssessment">
        <text class="rank__base-label">{{ p('baseline.title') }}</text>
        <text class="rank__base-text" :class="{ 'is-missing': !baselineReady }">
          {{ baselineReady ? baselineText : p('baseline.missing') }}
        </text>
        <text v-if="!baselineReady" class="rank__base-cta">{{ p('baseline.cta') }}</text>
      </view>
    </view>

    <!--
      数据备份：把「上次备份是什么时候」摆在明面上。
      收件池 / 理库 / 痕迹一多，换机即丢的代价就大了 —— 这个痛要提前露出来，
      而不是等丢的那天才想起来（备份开关本身在设置页，这里只做状态和一键）。
    -->
    <!-- <view class="backup" hover-class="gz-hover" @click="goBackup">
      <view class="backup__body">
        <text class="backup__title">数据备份</text>
        <text class="backup__sub">{{ backupText }}</text>
      </view>
      <text class="backup__go">{{ cloudOn ? '去备份' : '开启 ›' }}</text>
    </view> -->
    
    

    <!-- 今日四维 -->
    <view class="section">
      <view class="section__head">
        <text class="section__title">今日四维</text>
        <text class="section__badge">按今日目标</text>
      </view>
      <!--
        四个维度并列成一行环形进度（2026-09-16 定稿：横条 → 竖柱 → 环形）。
        数字全部进环内：**百分比落在圆心**、数量（今日/目标，如 3/5）贴孔内下缘 ——
        环下只留名称，文字行不再扛数字。环 128rpx、孔径 102rpx。
      -->
      <view class="dims">
        <view v-for="dim in dims" :key="dim.label" class="dimr">
          <view class="dimr__ring" :style="ringStyle(dim)">
            <view class="dimr__hole">
              <text class="dimr__pct" :style="{ color: dim.color }">{{ dim.pct }}%</text>
              <text class="dimr__frac">{{ dim.cur }}/{{ dim.goal }}</text>
            </view>
          </view>
          <text class="dimr__label">{{ dim.label }}</text>
        </view>
      </view>
    </view>

    <!-- 修行语言切换：三模式共用一套修行数据，只换「叫法 + 视觉」 -->
    <view class="lang" hover-class="gz-hover" @click="switchLanguage">
      <view class="lang__mark">言</view>
      <view class="lang__body">
        <text class="lang__title">修行语言 · 皮肤</text>
        <text class="lang__sub">
          当前「{{ modeMeta.label }}」· {{ modeMeta.assessmentName }} / {{ modeMeta.growthName }} /
          {{ modeMeta.companionName }}
        </text>
      </view>
      <view class="lang__dots">
        <view
          v-for="m in MODES"
          :key="m.id"
          class="lang__dot"
          :class="{ 'is-on': m.id === modeMeta.id }"
          :style="{ background: m.accent }"
        />
      </view>
    </view>

    <!-- 看板入口 -->
    <view class="section">
      <view class="section__head">
        <text class="section__title">修行档案</text>
      </view>
      <view class="entries">
        <EntryItem
          v-for="item in moreEntries"
          :key="item.title"
          :title="item.title"
          :subtitle="item.subtitle"
          :mark="item.mark"
          :badge="item.badge"
          :url="item.url"
          :disabled="!item.url"
        />
      </view>
    </view>

    <!-- 底部 -->
    <view class="foot">
      <text class="foot__text">观止知行 · 数字修行</text>
      <text class="foot__text is-dim">InsightAction v{{ appStore.versionName }}</text>
    </view>

    <!-- 切换修行语言确认：面板整套预览目标模式的配色/文案/横幅，并明确"修行数据不受影响" -->
    <GzDialog
      :show="!!pendingMode"
      :skin="pendingMode ?? modeStore.id"
      :art="modeStore.artOf(pendingMeta.id)"
      :title="p('switch.title', pendingMeta.id)"
      :subtitle="switchSub"
      :content="pendingMeta.tagline"
      :note="switchNote"
      :cancel-text="p('switch.cancel', pendingMeta.id)"
      :confirm-text="p('switch.confirm', pendingMeta.id)"
      @cancel="pendingMode = null"
      @confirm="confirmSwitch"
    />

    <!-- 用回默认名号：清掉昵称与头像（修行数据不受影响） -->
    <GzDialog
      :show="resetAsk"
      :skin="modeStore.id"
      title="用回默认名号"
      content="会清掉你设置的昵称与头像（头像文件从本机删除），修行数据不受影响。"
      :banner="false"
      cancel-text="再想想"
      confirm-text="清掉"
      @cancel="resetAsk = false"
      @confirm="confirmReset"
    />

    <!-- 隐私授权拦截弹窗：头像昵称 / 剪贴板等接口在用户同意前会被微信拦下 -->
    <PrivacyGate />

    <!-- 批次 D · 小枢全局浮层 -->
    <BuddyFloat />

    <!-- 远端提示层：公告 + 版本更新（强制更新 / 新包已下载、重启生效） -->
    <RemoteNotice />
  </view>
</template>

<script setup lang="ts">
/**
 * 我 · 修行看板（批次 C 起真实接线）：
 * - 等级卡：修为 store 真实累计 → 三模式九级排行（LEVEL_THRESHOLDS），叫法随皮肤；
 * - 今日四维：观=今日辨源、止=今日静修、知=今日产出、行=今日三件事，全部读真实 store；
 * - 修行档案：测评建档 / 成就墙 / 活跃日历 / 痕迹时间轴 / 设置均为可进入的真实子页。
 */
import { computed, ref } from 'vue'
import HallHead from '@/components/HallHead/HallHead.vue'
import { hallLine } from '@/config/lexicon'
import WeekGuide from '@/components/WeekGuide/WeekGuide.vue'
import { onShow } from '@dcloudio/uni-app'
import { useAppStore } from '@/stores/app'
import { useModeStore } from '@/stores/mode'
import { useXpStore } from '@/stores/xp'
import { useAssessmentStore } from '@/stores/assessment'
import { useDailyStore, todayKey } from '@/stores/daily'
import { useFocusStore } from '@/stores/focus'
import { useKnowledgeStore } from '@/stores/knowledge'
import { useTraceStore } from '@/stores/trace'
import { useProverbStore } from '@/stores/proverb'
import { useAccountStore } from '@/stores/account'
import { useIdentityStore } from '@/stores/identity'
import { backupNow } from '@/utils/cloudBackup'
import { poke, bondLv, bondXp, buddyStageName } from '@/composables/useBuddy'
import { useSkinClass } from '@/composables/useSkin'
import { applySkin, syncTabBar } from '@/utils/skin'
import { requirePrivacyAuthorize } from '@/utils/privacy'
import { getAssessmentBank, tierIndex } from '@/config/assessment'
import { LEVEL_NAMES, LEVEL_THRESHOLDS, levelIndexFromXp, levelProgress } from '@/config/levels'
import { BADGE_RULES, unlockedCount } from '@/config/badges'
import { buildBadgeContext, dayStats, monthActiveCount, yearStats } from '@/utils/growth'
import { useContentStore } from '@/stores/content'
import { getModeMeta, MODES } from '@/config/modes'
import type { ModeId } from '@/config/modes'
import type { RoutePath } from '@/router/routes'
import { navigateTo, ROUTES } from '@/router/routes'
import type { PhraseKey } from '@/config/phrases'
import { useDimLabel } from '@/composables/usePhrase'
import type { EntryBadge } from '@/components/EntryItem/EntryItem.vue'

const appStore = useAppStore()
const modeStore = useModeStore()
const skinClass = useSkinClass()
const daily = useDailyStore()
const assessment = useAssessmentStore()
const xp = useXpStore()
const focus = useFocusStore()
const trace = useTraceStore()
const knowledge = useKnowledgeStore()
const contentStore = useContentStore()
/** 记住的句子（开屏箴言 / 小枢对话 / 日课三处来源都汇到这里） */
const proverbs = useProverbStore()

/** 主题化取词：远端运营位优先、内置兜底（与页面皮肤同一套词） */
const p = (key: PhraseKey, mode: ModeId = modeStore.id): string => contentStore.phraseOf(key, mode)

/** 四维标签（观 · 辨源 / 观 · 摄入 / 观 · 鉴源）：大厅符号固定，职能词随模式 */
const dl = useDimLabel()

onShow(() => {
  daily.ensureToday()
  /* 批次 D · 小枢：评估到点激励 / 入定到点提醒 */
  poke()
  /* tabBar 原生样式/图标只能在本类大厅页上同步 */
  syncTabBar(modeStore.id)
})

/* —— 个人名号：昵称与头像（微信头像昵称填写能力；只存本机） —— */
const profile = useIdentityStore()
/** 编辑态开关：点卡片进入，点「完成」退出 */
const editing = ref(false)
/**
 * 昵称草稿。
 * type="nickname" 的输入框**不会**自动同步 v-model（微信刻意如此，防止随意预填昵称），
 * 只能在 blur 时从 event.detail.value 取 —— 所以这里用草稿 + 完成时再写回 store。
 */
const draftName = ref('')
/** 「用回默认」的二次确认 */
const resetAsk = ref(false)

const profileSub = computed(() =>
  profile.settled ? '点这里换昵称或头像' : '设置昵称与头像 · 只存在你本机',
)

/**
 * 进入名号编辑。
 *
 * 顺序不能反：`<input type="nickname">` 的"微信昵称一键填入"是**渲染时**校验隐私授权的能力，
 * 未授权时组件会当场降级成普通输入（控制台报
 * `showNicknameAccessory:fail ... privacy permission is unauthorized`，errno 104）——
 * 所以必须先要授权、后渲染输入框。
 * 用户拒绝或不支持该 API 时照样进编辑态：那时它就是个普通输入框，手输昵称一样能用。
 */
async function startEdit(): Promise<void> {
  draftName.value = profile.nickname
  await requirePrivacyAuthorize()
  editing.value = true
}

/**
 * 昵称失焦取值。
 * 空串不写回草稿 —— 用户点进来什么都没干就直接退出时，名字不能凭空消失。
 */
function onNameBlur(e: unknown): void {
  /* uni 给 blur 的事件类型里 detail 是 number，实际小程序是 { value } —— 按真实结构取 */
  const detail = (e as { detail?: { value?: string } } | null)?.detail
  const v = String(detail?.value ?? '').trim()
  if (v) draftName.value = v.slice(0, 16)
}

/** 头像：chooseAvatar 只给临时文件路径，落盘（拷进私有永久目录）由 store 负责 */
function onChooseAvatar(e: { detail?: { avatarUrl?: string } }): void {
  const tmp = e?.detail?.avatarUrl
  if (!tmp) return
  if (!profile.setAvatar(tmp)) {
    uni.showToast({ title: '头像没保存成 · 再试一次', icon: 'none' })
  }
}

function finishEdit(): void {
  if (draftName.value.trim()) profile.setNickname(draftName.value)
  editing.value = false
}

function confirmReset(): void {
  profile.clear()
  resetAsk.value = false
  editing.value = false
  uni.showToast({ title: '已用回默认名号', icon: 'none' })
}

/* —— 数据备份：状态可见 + 一键备份（未开启则直达设置） —— */
const account = useAccountStore()
const cloudOn = computed(() => account.cloudEnabled)
const backupText = computed(() => {
  if (!account.cloudEnabled) return '还没开启云备份 · 换机会丢'
  const last = account.lastBackupAt ? Date.parse(account.lastBackupAt) : 0
  if (!last) return '云备份已开启 · 还没备份过'
  const days = Math.floor((Date.now() - last) / 86400000)
  return days <= 0 ? '今天已备份 · 数据在云上' : `上次备份 ${days} 天前`
})

async function goBackup(): Promise<void> {
  if (!account.cloudEnabled) {
    navigateTo(ROUTES.settings)
    uni.showToast({ title: '在设置里开启云备份', icon: 'none' })
    return
  }
  uni.showLoading({ title: '备份中' })
  try {
    const outcome = await backupNow()
    uni.hideLoading()
    if (outcome.saved) {
      uni.showToast({ title: `已备份 ${account.lastBackupStores} 项数据`, icon: 'none' })
    } else {
      uni.showToast({ title: outcome.reason || '这次没备份成', icon: 'none' })
    }
  } catch {
    uni.hideLoading()
    uni.showToast({ title: '备份失败 · 检查网络后重试', icon: 'none' })
  }
}

/**
 * 切换修行语言（三模式）：产品约定——换皮肤绝不清数据，
 * 普通/科技/修仙共用同一份修行记录；如需清空当天进度，去「设置 → 重置今日三件事」。
 *
 * 注意：选中后**不立即切换**，而是先弹确认框把「会换掉什么、不会动什么」讲清
 * （面板整套预览目标模式的配色与横幅），确认后才真正换皮。
 */
function switchLanguage(): void {
  uni.showActionSheet({
    itemList: MODES.map((m) => `${m.label} · ${m.labelEn}`),
    success: (res) => {
      const next: ModeId = MODES[res.tapIndex].id
      if (next === modeStore.id) return
      pendingMode.value = next
    },
    fail: () => {
      /* 用户取消 */
    },
  })
}

/** 待切换的目标模式（null = 没有待确认的切换） */
const pendingMode = ref<ModeId | null>(null)
const pendingMeta = computed(() => getModeMeta(pendingMode.value ?? modeStore.id))
/** 目标模式的称谓对照：切换前先让用户看清"会换掉哪些叫法" */
const switchSub = computed(
  () =>
    `${pendingMeta.value.label} · ${pendingMeta.value.labelEn} · 成长称「${pendingMeta.value.growthName}」· 同行称「${pendingMeta.value.companionName}」`,
)
const switchNote = computed(() => p('switch.note', pendingMeta.value.id))

/** 确认切换：只重挂主题与 tabBar，不碰任何修行数据 */
function confirmSwitch(): void {
  const next = pendingMode.value
  if (!next) return
  modeStore.setMode(next)
  applySkin(next)
  syncTabBar(next)
  pendingMode.value = null
  uni.showToast({ title: p('switch.done', next), icon: 'none' })
}

const modeMeta = computed(() => modeStore.meta)

/* —— 起点基线：把「建档」结果固定展示在等级卡里（未建档则显示入口） —— */
const baselineReady = computed(() => Boolean(assessment.get(modeMeta.value.id)))
const baselineText = computed(() => {
  const r = assessment.get(modeMeta.value.id)
  if (!r) return ''
  const bank = contentStore.bankOf(modeMeta.value.id)
  const d = new Date(r.takenAt)
  const date = `${d.getFullYear()}.${d.getMonth() + 1}.${d.getDate()}`
  return `${bank.tierNames[tierIndex(r.tier)]} · ${Math.round(r.ratio * 100)}% · ${date} 建档`
})

/** 未建档时基线行本身就是入口；已建档则去档案入口重测（30 天冷却） */
function openAssessment(): void {
  navigateTo(ROUTES.entryAssessment)
}

/* —— 等级卡：修为 store 真实累计 → 三模式九级 —— */
/** 等级按历史最高修为（只升不降） */
const lvIndex = computed(() => levelIndexFromXp(xp.levelXp))
const lv = computed(() => lvIndex.value + 1)
const lvName = computed(() => (LEVEL_NAMES[modeMeta.value.id] ?? LEVEL_NAMES.normal)[lvIndex.value] ?? '圆满')
const lvPct = computed(() => Math.round(levelProgress(xp.levelXp) * 100))
const nextHint = computed(() => {
  const names = LEVEL_NAMES[modeMeta.value.id] ?? LEVEL_NAMES.normal
  const next = names[lvIndex.value + 1]
  const nextNeed = LEVEL_THRESHOLDS[lvIndex.value + 1]
  if (next === undefined || nextNeed === undefined) {
    return `已达「${lvName.value}」之巅 · 累计 ${xp.total} 点修为`
  }
  const remain = nextNeed - xp.levelXp
  return `距「${next}」还差 ${remain} 点修为 · 累计 ${xp.total} 点`
})

/* —— 今日四维：观/止/知/行全部接真实 store（色值取「暗底也清晰」一档） —— */
interface Dim {
  /** 维度名（随修行语言变） */
  label: string
  /** 今日已完成 / 今日目标：显示成「3/5」，一眼看出差多少 */
  cur: number
  goal: number
  /** 完成度，用来画环 */
  pct: number
  color: string
}

const dims = computed<Dim[]>(() => {
  const k = todayKey()
  const st = dayStats(k)
  const plan = Math.max(daily.planCount, 1)
  const focusGoal = Math.max(focus.dailyGoal, 1)
  /* 今日知识产出 = 新建卡片 + 今日拷问作答（答卡即时 Lv.3，未落库故并列计入） */
  const know = st.cards + (st.answered ? 1 : 0)
  return [
    { label: dl('observe'), cur: st.marks, goal: 5, pct: Math.min(100, Math.round((st.marks / 5) * 100)), color: '#4E8FD4' },
    { label: dl('pause'), cur: st.focusMin, goal: focusGoal, pct: Math.min(100, Math.round((st.focusMin / focusGoal) * 100)), color: '#84A268' },
    { label: dl('reflect'), cur: know, goal: 3, pct: Math.min(100, Math.round((know / 3) * 100)), color: '#9C8AC4' },
    { label: dl('action'), cur: daily.doneCount, goal: plan, pct: Math.round((daily.doneCount / plan) * 100), color: '#C4602E' },
  ]
})

/**
 * 环的 conic-gradient：从 12 点方向顺时针画到完成度，剩下的是槽。
 * 用 CSS 画环而不用 canvas —— canvas 是原生组件、层级最高，会盖住小枢悬浮球，滚动页里还会闪。
 * 槽色走皮肤变量（三套各有一条），取不到时回落到半透明黑，环不会整个消失。
 */
function ringStyle(dim: Dim): Record<string, string> {
  const slot = 'var(--gz-line-soft, rgba(0, 0, 0, 0.08))'
  return { background: `conic-gradient(${dim.color} 0% ${dim.pct}%, ${slot} ${dim.pct}% 100%)` }
}

interface MoreEntry {
  mark: string
  title: string
  subtitle: string
  badge?: EntryBadge
  url?: RoutePath
}

/* 初始测评入口：已建档显示结果与重测倒计时，间隔 30 天 */
const assessmentEntry = computed<{ subtitle: string; badge: EntryBadge }>(() => {
  const r = assessment.get(modeMeta.value.id)
  if (!r) {
    return {
      subtitle: `做一次「${modeMeta.value.assessmentName}」建档，建立你的起点`,
      badge: { text: '待建档', tone: 'muted' },
    }
  }
  const bank = getAssessmentBank(modeMeta.value.id)
  const tier = bank.tierNames[tierIndex(r.tier)]
  const d = new Date(r.takenAt)
  const date = `${d.getFullYear()}.${d.getMonth() + 1}.${d.getDate()}`
  const remain = assessment.retakeRemainDays(modeMeta.value.id)
  return {
    /* 满分用存档里的 maxScore（老存档 18、新版 24）——写死会造成"分数没变，比例却变了"的困惑 */
    subtitle: `${tier} · ${r.score}/${r.maxScore} 分 · ${date} 建档`,
    badge:
      remain > 0 ? { text: `${remain} 天后可重测`, tone: 'muted' } : { text: '可重测', tone: 'accent' },
  }
})

/* 成就 / 活跃天数 / 痕迹：同源真实计数，入口文案随之跳动 */
const badgeUnlocked = computed(() => unlockedCount(buildBadgeContext()))

/**
 * 知 → 行 转化率（本周）：写了多少条卡片、其中多少条点过「我用上了」。
 * 与「修行看板」页同一个口径 —— 入口徽标与页内大数字不能各说各话。
 */
const conversionPct = computed(() => {
  const now = new Date()
  const pad = (n: number) => String(n).padStart(2, '0')
  const mon = new Date(now)
  mon.setDate(mon.getDate() - ((now.getDay() + 6) % 7))
  const from = `${mon.getFullYear()}-${pad(mon.getMonth() + 1)}-${pad(mon.getDate())}`
  const to = todayKey()
  const cards = knowledge.cards.filter((c) => {
    const d = new Date(c.createdAt)
    const k = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
    return k >= from && k <= to
  }).length
  if (cards === 0) return 0
  const applied = trace.between(from, to).filter((t) => t.kind === 'reflect.apply').length
  return Math.min(100, Math.round((applied / cards) * 100))
})
const activeMonth = computed(() => {
  const now = new Date()
  return monthActiveCount(now.getFullYear(), now.getMonth())
})
/* 年度回顾入口：computed 保证进页回看时跟着变（内部一次遍历，不是逐天扫描） */
const yearStat = computed(() => yearStats())

/**
 * 大厅头部的「一句」+ 两个关键数字（2026-09-16 定的形态）。
 * 「我」大厅没有状态行，头部下半部就靠这两块撑：
 * 一句走 lexicon.hallLine，模板不可用时回落到本页的"距下一级还差 N 点"；
 * 数字给"当前阶位"与"今年有痕迹天数" —— 修为点数与距下一级的差距留给下面那张等级卡，不重复。
 */
const headLine = computed(() => hallLine('me', modeStore.id, nextHint.value))

const headStats = computed(() => [
  { value: `Lv.${lv.value}`, label: '当前阶位' },
  { value: `${yearStat.value.activeDays}`, label: '今年有痕迹 · 天' },
])

/* 档案入口文案里的测评名随当前模式变化，故用 computed 保持即时刷新 */
const moreEntries = computed<MoreEntry[]>(() => [
  /*
   * 今日日课卡：原先在列表外单独写了一个主色描边的 .dailytip 块（批次 D），
   * 统一进列表后放在**第一位**（2026-09-16）：这一列按「越往后越沉淀」排
   * （记录回顾 → 陪伴 → 配置），而它是唯一"每天都会变、当天就要用"的一项
   * （名字带「今日」、可转发），排在末尾（设置之后）与语义相反。
   * 点击本就是纯跳转（原 openDailyCard 只做 navigateTo），走 EntryItem 即可。
   */
  {
    mark: '课',
    title: '今日日课卡',
    subtitle: '每日一张 · 境界与四维 · 可转发给同道',
    url: ROUTES.meDailyCard,
  },
  {
    mark: '测',
    title: '初始测评',
    subtitle: assessmentEntry.value.subtitle,
    badge: assessmentEntry.value.badge,
    url: ROUTES.entryAssessment,
  },
  {
    mark: '板',
    title: '修行看板 · 四维与转化',
    subtitle: '四维雷达 · 认知深度分布 · 知→行转化率 · 成长图谱',
    badge:
      trace.traces.length > 0
        ? { text: `转化 ${conversionPct}%`, tone: 'accent' }
        : { text: '待积累', tone: 'muted' },
    url: ROUTES.meBoard,
  },
  {
    mark: '勋',
    title: '成就墙 · 徽章',
    subtitle: `已解锁 ${badgeUnlocked.value} / ${BADGE_RULES.length} 枚 · 每一枚都是一段真实的坚持`,
    badge: badgeUnlocked.value > 0 ? { text: `${badgeUnlocked.value}/${BADGE_RULES.length}`, tone: 'accent' } : undefined,
    url: ROUTES.meAchievements,
  },
  {
    mark: '历',
    title: '活跃日历',
    subtitle: '本月已活跃 ' + activeMonth.value + ' 天 · 每一天的投入都看得见',
    badge: activeMonth.value > 0 ? { text: `${activeMonth.value} 天`, tone: 'accent' } : undefined,
    url: ROUTES.meCalendar,
  },
  {
    mark: '时',
    title: '痕迹时间轴',
    subtitle: trace.traces.length > 0 ? `累计留下 ${trace.traces.length} 条痕迹 · 在真实世界的回响` : '从今天的第一件小事开始留痕',
    badge: trace.traces.length > 0 ? { text: `${trace.traces.length} 条`, tone: 'accent' } : undefined,
    url: ROUTES.meTimeline,
  },
  {
    mark: '言',
    title: '我的箴言',
    subtitle:
      proverbs.count > 0
        ? `已记住 ${proverbs.count} 句 · 开屏 ${proverbs.countBySource.startup} · 小枢 ${proverbs.countBySource.buddy}`
        : '遇到想留住的句子，点亮「记住这句」就收进这里',
    badge: proverbs.count > 0 ? { text: `${proverbs.count} 句`, tone: 'accent' } : undefined,
    url: ROUTES.meProverbs,
  },
  {
    mark: '年',
    title: '年度回顾',
    subtitle:
      yearStat.value.activeDays > 0
        ? `今年 ${yearStat.value.activeDays} 天有痕迹 · 入账修为 ${yearStat.value.xp} 点`
        : '一年到头回头看一眼：今年你留下了什么',
    badge:
      yearStat.value.activeDays > 0
        ? { text: `${yearStat.value.activeDays} 天`, tone: 'accent' }
        : { text: '待积累', tone: 'muted' },
    url: ROUTES.meReview,
  },
  {
    mark: '羁',
    title: '小枢羁绊 · 对话录',
    subtitle: `与「${modeMeta.value.assistantName}」相见 ${bondXp.value} 次 · 形态「${buddyStageName.value}」· 对话与箴言都在这里`,
    badge:
      bondLv.value > 1
        ? { text: `Lv.${bondLv.value}`, tone: 'accent' }
        : { text: '初遇', tone: 'muted' },
    url: ROUTES.meBond,
  },
  /*
   * 道侣 / 搭档 / 伙伴：结缘码 1v1 绑定 + 互看今日完成度。
   *
   * 押后（2026-09-16 拍板），不只因为"要后端"，更因为它有两个硬伤：
   *  1. **过审**：本质是社交功能，个人主体在社交类目上风险很高；
   *  2. **调性**：修行数据是这个 app 里最私密的东西，互看完成度与「只看自己、
   *     不排名不比较」的定位相冲 —— 陪伴感已由「小枢羁绊」（纯本地、20 级）填住。
   * 保留入口只为让规划可见，标注如实写"后续做"，不写"后端期"——
   * 它缺的不是后端（后端已具备登录与存储），是产品上还没想清楚要不要做。
   */
  {
    mark: '伴',
    title: `道侣 · ${modeMeta.value.companionName}`,
    subtitle: '结缘码绑定、互看今日完成度、低频事件提醒 —— 已排入后续，当前不做',
    badge: { text: '后续做', tone: 'muted' },
  },
  {
    mark: '设',
    title: '设置',
    subtitle: '修行语言 · 提醒 · 数据 · 关于',
    badge: { text: '可用', tone: 'accent' },
    url: ROUTES.settings,
  },
])
</script>

<style lang="scss" scoped>
@import './index.scss';
</style>

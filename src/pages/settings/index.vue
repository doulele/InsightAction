<template>
  <view class="page" :class="skinClass">
    <!-- 顶栏：返回 + 标题（子页统一样式） -->
    <view class="nav">
      <view class="nav__side" hover-class="gz-hover" @click="goBack">
        <text class="nav__back">‹</text>
      </view>
      <text class="nav__title">设置</text>
      <view class="nav__side" />
    </view>

    <!-- 1 · 修行语言：三种表达语言即时预览切换 -->
    <view class="section">
      <view class="section__head">
        <text class="section__title">修行语言</text>
        <text class="section__hint">只换叫法与视觉 · 数据保留</text>
      </view>
      <view class="cards">
        <view
          v-for="m in MODES"
          :key="m.id"
          class="lang"
          :class="{ 'is-on': m.id === modeStore.id }"
          hover-class="gz-hover"
          @click="pick(m.id)"
        >
          <view class="lang__dot" :style="{ background: m.accent }" />
          <view class="lang__body">
            <view class="lang__head">
              <text class="lang__name">{{ m.label }}</text>
              <text class="lang__en">{{ m.labelEn }} · {{ m.growthName }} / {{ m.companionName }}</text>
            </view>
            <text class="lang__desc">{{ m.tagline }}</text>
          </view>
          <view class="radio" :class="{ 'is-on': m.id === modeStore.id }">
            <view v-if="m.id === modeStore.id" class="radio__dot" />
          </view>
        </view>
      </view>
    </view>

    <!-- 2 · 提醒：偏好写入本机；批次 D 起由小枢「到点激励」浮层在前台触发（小程序无后台推送） -->
    <view class="section">
      <view class="section__head">
        <text class="section__title">提醒</text>
        <text class="section__hint">到点激励触发 · 需打开 App</text>
      </view>
      <view class="cards">
        <view class="row">
          <view class="row__body">
            <text class="row__title">每日晚课提醒</text>
            <text class="row__sub">每晚 21:00 换题前，提醒回来写下灵魂拷问的回答</text>
          </view>
          <switch
            class="row__switch"
            :checked="settings.eveningRemind"
            :color="modeMeta.accent"
            @change="onRemind('eveningRemind', $event)"
          />
        </view>
        <view class="row">
          <view class="row__body">
            <text class="row__title">断连守护</text>
            <text class="row__sub">今日三件事还有未完成时，傍晚轻提醒一次</text>
          </view>
          <switch
            class="row__switch"
            :checked="settings.streakRemind"
            :color="modeMeta.accent"
            @change="onRemind('streakRemind', $event)"
          />
        </view>
      </view>
    </view>

    <!-- 3 · 数据 -->
    <view class="section">
      <view class="section__head">
        <text class="section__title">数据</text>
        <text class="section__hint">本机存储 · 不做云端同步</text>
      </view>
      <view class="cards">
        <view class="row" hover-class="gz-hover" @click="exportToday">
          <view class="row__body">
            <text class="row__title">导出今日概览</text>
            <text class="row__sub">复制一份今日修行摘要到剪贴板</text>
          </view>
          <text class="row__arrow">→</text>
        </view>
        <view class="row" hover-class="gz-hover" @click="openResetToday">
          <view class="row__body">
            <text class="row__title is-danger">重置今日三件事</text>
            <text class="row__sub">清空今日待办与完成状态，需二次确认</text>
          </view>
          <text class="row__arrow">→</text>
        </view>
        <view class="row" hover-class="gz-hover" @click="openResetAll">
          <view class="row__body">
            <text class="row__title is-danger">重置全部修行数据</text>
            <text class="row__sub">清空修为/等级/徽章/知识卡/习惯/痕迹等所有修行记录 · 保留语言与提醒偏好</text>
          </view>
          <text class="row__arrow">→</text>
        </view>
      </view>
    </view>

    <!-- 4 · 关于 -->
    <view class="section">
      <view class="section__head">
        <text class="section__title">关于</text>
      </view>
      <view class="cards">
        <view class="about">
          <view class="about__head">
            <text class="about__name">观止知行</text>
            <text class="about__ver">v{{ appStore.versionName }}</text>
          </view>
          <text class="about__desc">
            数字修行：观 · 止 · 知 · 行。一套底层逻辑，三种表达语言——普通像树、科技如实验室、修仙成道场。
          </text>
        </view>
      </view>
    </view>

    <view class="foot">
      <text class="foot__text">本地存储 · 不入云 · 数据属于你</text>
    </view>

    <!-- 通用主题弹框（components/GzDialog，easycom）：skin 传「目标模式」→ 面板整套预览目标皮肤 -->
    <GzDialog
      :show="!!pending"
      :skin="pending ?? modeStore.id"
      :art="targetMeta.art"
      :title="targetMeta.label"
      :subtitle="switchSub"
      :content="targetMeta.tagline"
      :note="switchNote"
      cancel-text="暂不切换"
      confirm-text="确认切换"
      @cancel="pending = null"
      @confirm="confirmSwitch"
    />

    <!-- 危险动作确认：面板跟随当前模式主题，破坏性主键固定语义红 -->
    <GzDialog
      variant="danger"
      :show="dangerKind !== null"
      :title="dangerTitle"
      :content="dangerContent"
      cancel-text="再想想"
      :confirm-text="dangerKind === 'all' ? '全部清空' : '重置'"
      @cancel="dangerKind = null"
      @confirm="runDanger"
    />
  </view>
</template>

<script setup lang="ts">
/**
 * 设置页（批次 B 第一个真实功能子页）：
 *  - 修行语言：切换 = 即时换肤预览并持久化，不碰修行数据（清空重来的入口在「数据」区明示）；
 *  - 提醒：偏好写入本机；批次 D 起由大厅右下角小枢的「到点激励」浮层在前台触发
 *    （晚间窗晚课提醒 / 傍晚断连守护），小程序无法后台推送，需打开 App 才能弹；
 *  - 数据：导出今日概览（真实可用）/ 重置今日（二次确认）/ 重置全部修行数据。
 */
import { computed, ref } from 'vue'
import GzDialog from '@/components/GzDialog/GzDialog.vue'
import { onShow } from '@dcloudio/uni-app'
import { MODES, getModeMeta } from '@/config/modes'
import type { ModeId } from '@/config/modes'
import { useModeStore } from '@/stores/mode'
import { useAppStore } from '@/stores/app'
import { useSettingsStore } from '@/stores/settings'
import { useDailyStore, freshTodos, todayKey } from '@/stores/daily'
import { useXpStore } from '@/stores/xp'
import { useSkinClass } from '@/composables/useSkin'
import { applySkin } from '@/utils/skin'
import { dayStats } from '@/utils/growth'
import { resetPracticeData } from '@/utils/localReset'
import { levelIndexFromXp } from '@/config/levels'
import { ROUTES } from '@/router/routes'

const modeStore = useModeStore()
const appStore = useAppStore()
const settings = useSettingsStore()
const daily = useDailyStore()
const xp = useXpStore()
const skinClass = useSkinClass()
const modeMeta = computed(() => modeStore.meta)

onShow(() => {
  /* 供「导出 / 重置」读取当日最新计数（跨天由 ensureToday 处理） */
  daily.ensureToday()
})

/** 返回：正常栈内 navigateBack；异常兜底回「我」大厅 */
function goBack(): void {
  const pages = getCurrentPages()
  if (pages.length > 1) {
    uni.navigateBack()
  } else {
    uni.switchTab({ url: ROUTES.tabMe })
  }
}

/** 待确认切换的模式（null = 无弹框）；确认框皮肤预览目标模式（components/GzDialog :skin） */
const pending = ref<ModeId | null>(null)
const targetMeta = computed(() => getModeMeta(pending.value ?? modeStore.id))
const switchSub = computed(
  () =>
    `${targetMeta.value.labelEn} · 成长称「${targetMeta.value.growthName}」 · 同行称「${targetMeta.value.companionName}」`,
)
const switchNote = computed(
  () =>
    `确认切到「${targetMeta.value.label}」？只换叫法与视觉；修行数据只有一份，不会清空，随时可换回。`,
)

/** 危险动作（重置）：统一走主题弹框的 danger 变体 */
type DangerKind = 'all' | 'today'
const dangerKind = ref<DangerKind | null>(null)
const dangerTitle = computed(() =>
  dangerKind.value === 'all' ? '重置全部修行数据？' : '重置今日三件事',
)
const dangerContent = computed(() =>
  dangerKind.value === 'all'
    ? '将清空：修为、等级、徽章、知识卡、习惯、痕迹、盲盒、测评、定时与收藏等全部修行记录。此操作不可撤销，语言与提醒偏好会保留。'
    : '将清空今天的三条待办与完成状态。跨天本就会自动重置，此操作仅影响今天。',
)
function openResetAll(): void {
  dangerKind.value = 'all'
}
function openResetToday(): void {
  dangerKind.value = 'today'
}

/**
 * 切换修行语言：先弹「目标模式皮肤」的确认框，确认后才落地（即时换肤并保存）。
 * 产品约定：换皮肤绝不清数据，普通/科技/修仙共用一份修行记录。
 */
function pick(id: ModeId): void {
  if (id === modeStore.id) return
  pending.value = id
}

function confirmSwitch(): void {
  if (!pending.value) return
  const id = pending.value
  modeStore.setMode(id)
  applySkin(id)
  const label = MODES.find((m) => m.id === id)?.label ?? ''
  pending.value = null
  uni.showToast({ title: `已切换：${label} · 修行数据保留`, icon: 'none' })
}

type RemindKey = 'eveningRemind' | 'streakRemind'

/** 提醒开关：写入本机偏好（模板 $event 类型较宽，运行时按 switch detail 取值） */
function onRemind(key: RemindKey, e: Event & { detail?: { value?: boolean } }): void {
  settings[key] = e.detail?.value ?? false
}

/** 导出今日概览：读真实 store 汇总今日观止知行，拼纯文本到剪贴板 */
function exportToday(): void {
  const k = todayKey()
  const st = dayStats(k)
  const lv = levelIndexFromXp(xp.total) + 1
  const plan = daily.planCount || 3
  const lines = [
    '观止知行 · 今日概览',
    `修行语言：${modeMeta.value.label} · ${modeMeta.value.labelEn}`,
    `日期：${k}`,
    `观 · 辨源：${st.marks} 次标注`,
    `止 · 静修：${st.focusMin} 分钟`,
    `知 · 产出：${st.cards} 张卡片${st.answered ? ' · 拷问已答' : ' · 拷问未答'}`,
    `行 · 完成：${daily.doneCount}/${plan} 件 · 习惯打卡 ${st.habitDone} 次`,
    `修为：累计 ${xp.total} 点 · Lv.${lv}`,
    '',
    '—— 数字修行 · 数据属于你自己',
  ].join('\n')
  uni.setClipboardData({
    data: lines,
    success: () => uni.showToast({ title: '今日概览已复制', icon: 'none' }),
  })
}

/** 弹框确认后的执行：今日只清当天待办；全部则清空所有修行/档案记录（语言与提醒偏好保留） */
function runDanger(): void {
  if (dangerKind.value === null) return
  const kind = dangerKind.value
  dangerKind.value = null
  if (kind === 'all') {
    resetPracticeData()
    uni.showToast({ title: '修行数据已清空', icon: 'none' })
    return
  }
  daily.$patch((s) => {
    s.todos = freshTodos()
  })
  uni.showToast({ title: '今日已重置', icon: 'none' })
}
</script>

<style lang="scss" scoped>
.page {
  min-height: 100vh;
  padding: calc(var(--status-bar-height) + 16rpx) $gz-page-pad 60rpx;
  box-sizing: border-box;
}

/* 顶栏 */
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
  padding-bottom: 8rpx; /* 视觉居中 ‹ */
}

.nav__title {
  font-size: 34rpx;
  font-weight: 700;
  letter-spacing: 0.08em;
  color: $gz-ink;
}

/* 分组 */
.section {
  margin-top: 36rpx;
}

.section__head {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  margin-bottom: 20rpx;
}

.section__title {
  font-size: 32rpx;
  font-weight: 700;
  color: $gz-ink;
}

.section__hint {
  font-size: $gz-fs-caption;
  color: $gz-ink-3;
}

.cards {
  display: flex;
  flex-direction: column;
  gap: 18rpx;
}

/* 修行语言卡 */
.lang {
  display: flex;
  align-items: center;
  gap: 22rpx;
  padding: 26rpx 28rpx;
  background: $gz-surface;
  border: 1rpx solid $gz-line;
  border-radius: $gz-radius-md;
  transition: border-color 0.2s ease, box-shadow 0.2s ease;
}

.lang.is-on {
  border-color: $gz-accent;
  box-shadow: 0 0 0 1rpx $gz-accent, 0 10rpx 30rpx $gz-accent-soft;
}

.lang__dot {
  flex: none;
  width: 16rpx;
  height: 16rpx;
  border-radius: 50%;
}

.lang__body {
  flex: 1;
  min-width: 0;
}

.lang__head {
  display: flex;
  align-items: baseline;
  gap: 14rpx;
}

.lang__name {
  font-size: $gz-fs-title;
  font-weight: 700;
  color: $gz-ink;
}

.lang__en {
  font-size: $gz-fs-caption;
  color: $gz-ink-3;
}

.lang__desc {
  display: block;
  margin-top: 6rpx;
  font-size: $gz-fs-caption;
  line-height: 1.6;
  color: $gz-ink-2;
}

.radio {
  flex: none;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 36rpx;
  height: 36rpx;
  border: 2rpx solid $gz-ink-3;
  border-radius: 50%;
  transition: border-color 0.2s ease;
}

.radio.is-on {
  border-color: $gz-accent;
}

.radio__dot {
  width: 18rpx;
  height: 18rpx;
  border-radius: 50%;
  background: $gz-accent;
}

/* 通用行 */
.row {
  display: flex;
  align-items: center;
  gap: 22rpx;
  padding: 26rpx 28rpx;
  background: $gz-surface;
  border: 1rpx solid $gz-line;
  border-radius: $gz-radius-md;
}

.row__body {
  flex: 1;
  min-width: 0;
}

.row__title {
  display: block;
  font-size: $gz-fs-body;
  font-weight: 600;
  color: $gz-ink;
}

/* 危险动作：固定语义红（区别于任意模式主色） */
.row__title.is-danger {
  color: #b5482c;
}

.row__sub {
  display: block;
  margin-top: 4rpx;
  font-size: $gz-fs-caption;
  line-height: 1.6;
  color: $gz-ink-3;
}

.row__arrow {
  flex: none;
  color: $gz-ink-3;
  font-size: 32rpx;
}

.row__switch {
  flex: none;
  transform: scale(0.85);
  transform-origin: right center;
}

/* 关于 */
.about {
  padding: 30rpx;
  background: $gz-surface;
  border: 1rpx solid $gz-line;
  border-radius: $gz-radius-md;
}

.about__head {
  display: flex;
  align-items: baseline;
  gap: 16rpx;
}

.about__name {
  font-size: $gz-fs-title;
  font-weight: 700;
  letter-spacing: 0.06em;
  color: $gz-ink;
}

.about__ver {
  font-size: $gz-fs-caption;
  color: $gz-ink-3;
}

.about__desc {
  display: block;
  margin-top: 12rpx;
  font-size: $gz-fs-small;
  line-height: 1.8;
  color: $gz-ink-2;
}

.foot {
  margin-top: 44rpx;
  display: flex;
  justify-content: center;
}

.foot__text {
  font-size: $gz-fs-caption;
  letter-spacing: 0.08em;
  color: $gz-ink-3;
}

/* 弹框视觉已收敛到通用组件 components/GzDialog（皮肤随模式自动换） */
</style>

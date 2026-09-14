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
        <text class="section__hint">本机存储 · 可导出 · 可恢复</text>
      </view>
      <view class="cards">
        <view class="row" hover-class="gz-hover" @click="exportToday">
          <view class="row__body">
            <text class="row__title">导出今日概览</text>
            <text class="row__sub">{{ $p('settings.exportToday.sub') }}</text>
          </view>
          <text class="row__arrow">→</text>
        </view>
        <view class="row" hover-class="gz-hover" @click="exportAll">
          <view class="row__body">
            <text class="row__title">导出全部数据</text>
            <text class="row__sub">{{ $p('settings.exportAll.sub') }}</text>
          </view>
          <text class="row__arrow">→</text>
        </view>
        <view class="row" hover-class="gz-hover" @click="importFromFile">
          <view class="row__body">
            <text class="row__title">从备份恢复</text>
            <text class="row__sub">{{ $p('settings.importFile.sub') }}</text>
          </view>
          <text class="row__arrow">→</text>
        </view>
        <view class="row" hover-class="gz-hover" @click="resetToday">
          <view class="row__body">
            <text class="row__title is-danger">重置今日三件事</text>
            <text class="row__sub">{{ $p('settings.resetToday.sub') }}</text>
          </view>
          <text class="row__arrow">→</text>
        </view>
        <view class="row" hover-class="gz-hover" @click="resetAll">
          <view class="row__body">
            <text class="row__title is-danger">重置全部修行数据</text>
            <text class="row__sub">{{ $p('settings.resetAll.sub') }}</text>
          </view>
          <text class="row__arrow">→</text>
        </view>
      </view>
    </view>

    <!-- 4 · 云备份：默认关闭；开启后才与服务器交互用户数据（微信标识匿名） -->
    <view class="section">
      <view class="section__head">
        <text class="section__title">云备份</text>
        <text class="section__hint">换机不丢 · 默认关闭</text>
      </view>
      <view class="cards">
        <view class="row">
          <view class="row__body">
            <text class="row__title">开启云备份</text>
            <text class="row__sub">{{ cloudSub }}</text>
          </view>
          <switch
            class="row__switch"
            :checked="account.cloudEnabled"
            :color="modeMeta.accent"
            @change="onCloudToggle"
          />
        </view>
        <view v-if="account.cloudEnabled" class="row" hover-class="gz-hover" @click="backupToCloud">
          <view class="row__body">
            <text class="row__title">立即备份</text>
            <text class="row__sub">把本机当前进度上传一份（手动备份不做缩水拦截）</text>
          </view>
          <text class="row__arrow">→</text>
        </view>
        <view
          v-if="account.cloudEnabled && cloudHasSnapshot"
          class="row"
          hover-class="gz-hover"
          @click="restoreFromCloud('latest')"
        >
          <view class="row__body">
            <text class="row__title">从云端恢复</text>
            <text class="row__sub">取回最近一次云端快照（覆盖本机，需二次确认）</text>
          </view>
          <text class="row__arrow">→</text>
        </view>
        <view
          v-if="account.cloudEnabled && cloudHasSnapshot"
          class="row"
          hover-class="gz-hover"
          @click="restoreFromCloud('prev')"
        >
          <view class="row__body">
            <text class="row__title">恢复上一版</text>
            <text class="row__sub">误覆盖时的救援入口 · 服务器只保留一份上一版</text>
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

    <!-- 换肤确认：面板随「目标模式」整套预览（含主色/纸底/圆角与专属横幅） -->
    <GzDialog
      :show="!!pending"
      :skin="pending ?? modeStore.id"
      :art="modeStore.artOf(targetMeta.id)"
      :title="p('switch.title', targetMeta.id)"
      :subtitle="switchSub"
      :content="targetMeta.tagline"
      :note="switchNote"
      :cancel-text="p('switch.cancel', targetMeta.id)"
      :confirm-text="p('switch.confirm', targetMeta.id)"
      @cancel="pending = null"
      @confirm="confirmSwitch"
    />

    <!-- 危险动作确认：破坏性主键固定语义红 -->
    <GzDialog
      variant="danger"
      :show="dangerKind !== null"
      :title="dangerTitle"
      :note="dangerNote"
      cancel-text="再想想"
      confirm-text="确认清空"
      @cancel="dangerKind = null"
      @confirm="runDanger"
    />

    <!-- 开启云备份：数据会离开本机，必须先讲清楚（由用户主动授权） -->
    <GzDialog
      :show="cloudIntroOpen"
      title="开启云备份？"
      content="开启后会：① 用你的微信标识（匿名，不含昵称头像手机号）区分数据，仅用于找回你自己的备份；② 把你的修行数据加密上传到我的服务器；③ 每次启动若距上次超过 24 小时，会自动备份一次。"
      note="随时可在这里关闭，关闭会同时删除云端数据。"
      cancel-text="暂不开启"
      confirm-text="同意并开启"
      @cancel="cloudIntroOpen = false"
      @confirm="enableCloud"
    />

    <!-- 关闭云备份：删除云端数据（本机不动，但换机就恢复不了了） -->
    <GzDialog
      variant="danger"
      :show="cloudDeleteOpen"
      :title="'删除云端备份？'"
      note="将删除服务器上的全部备份数据，本机进度不受影响。删除后换手机或清缓存，进度就再也找不回来了。"
      cancel-text="保留"
      confirm-text="删除云端"
      @cancel="cloudDeleteOpen = false"
      @confirm="confirmDeleteCloud"
    />

    <!-- 覆盖恢复确认：备份文件与云端快照共用（覆盖式操作，必须二次确认） -->
    <GzDialog
      variant="danger"
      :show="!!restorePayload"
      :title="restoreTitle"
      :note="restoreNote"
      cancel-text="取消"
      confirm-text="覆盖恢复"
      @cancel="cancelRestore"
      @confirm="applyRestore"
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
import { useContentStore } from '@/stores/content'
import { useAccountStore } from '@/stores/account'
import type { PhraseKey } from '@/config/phrases'
import { useDimLabel } from '@/composables/usePhrase'
import {
  applyBackup,
  collectBackup,
  formatBackupTime,
  pickBackupFile,
  shareBackupFile,
  summarize,
  writeBackupFile,
} from '@/utils/localBackup'
import type { BackupPayload } from '@/utils/localBackup'
import { backupNow, disableCloudBackup, fetchCloudSnapshot } from '@/utils/cloudBackup'

const modeStore = useModeStore()
const appStore = useAppStore()
const settings = useSettingsStore()
const daily = useDailyStore()
const xp = useXpStore()
const skinClass = useSkinClass()
const contentStore = useContentStore()
const account = useAccountStore()
const modeMeta = computed(() => modeStore.meta)

/** 主题化取词：远端运营位优先、内置兜底（与页面皮肤同一套词） */
const p = (key: PhraseKey, mode: ModeId = modeStore.id): string => contentStore.phraseOf(key, mode)

/** 四维标签（观 · 辨源 / 观 · 摄入 / 观 · 鉴源）：导出文本里也用同一套说法 */
const dl = useDimLabel()

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

/** 待确认切换的模式（null = 无弹框）；弹框面板整体套用目标皮肤预览 */
const pending = ref<ModeId | null>(null)
const targetMeta = computed(() => getModeMeta(pending.value ?? modeStore.id))

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
  pending.value = null
  uni.showToast({ title: p('switch.done', id), icon: 'none' })
}

/** 目标模式称谓对照（弹框副标题：切换前先让用户看清"会换掉哪些叫法"） */
const switchSub = computed(
  () =>
    `${targetMeta.value.label} · ${targetMeta.value.labelEn} · 成长称「${targetMeta.value.growthName}」· 同行称「${targetMeta.value.companionName}」`,
)
/** 切换说明（三模式各自措辞，讲清"数据不受影响"） */
const switchNote = computed(() => p('switch.note', targetMeta.value.id))

/* ---------------- 危险动作（统一走 GzDialog danger 变体） ---------------- */

const dangerKind = ref<'resetToday' | 'resetAll' | null>(null)
const dangerTitle = computed(() => (dangerKind.value === 'resetToday' ? '重置今日三件事？' : '重置全部修行数据？'))
const dangerNote = computed(() =>
  dangerKind.value === 'resetToday'
    ? '将清空今天的三条待办与完成状态。跨天本就会自动重置，此操作仅影响今天。'
    : '将清空：修为、等级、徽章、知识卡、习惯、痕迹、盲盒、测评、定时与收藏等全部修行记录。此操作不可撤销，语言与提醒偏好会保留。',
)

function resetToday(): void {
  dangerKind.value = 'resetToday'
}

function resetAll(): void {
  dangerKind.value = 'resetAll'
}

function runDanger(): void {
  const kind = dangerKind.value
  dangerKind.value = null
  if (kind === 'resetToday') {
    daily.$patch((s) => {
      s.todos = freshTodos()
    })
    uni.showToast({ title: p('toast.resetDone'), icon: 'none' })
    return
  }
  resetPracticeData()
  uni.showToast({ title: p('toast.resetDone'), icon: 'none' })
}

/* ---------------- 本地备份：导出 / 恢复 ---------------- */

/** 待应用的备份（文件或云端），非空即弹覆盖确认 */
const restorePayload = ref<BackupPayload | null>(null)
const restoreFrom = ref<'file' | 'cloud-latest' | 'cloud-prev'>('file')
const restoreSummary = computed(() => (restorePayload.value ? summarize(restorePayload.value) : null))
const restoreTitle = computed(() => (restoreFrom.value === 'file' ? '用这份备份覆盖本机？' : '用云端备份覆盖本机？'))
const restoreNote = computed(() => {
  const s = restoreSummary.value
  if (!s) return ''
  const src = restoreFrom.value === 'file' ? '备份文件' : restoreFrom.value === 'cloud-prev' ? '云端上一版' : '云端快照'
  return `将用${src}覆盖本机 ${s.storeCount} 项数据（约 ${s.sizeKB}KB，导出于 ${formatBackupTime(s.exportedAt)}）。覆盖后本机现有进度会被替换，且无法撤销。`
})

/** 导出全部数据：写成备份文件 → 转发到聊天（用户自己保存，全程无上行数据） */
async function exportAll(): Promise<void> {
  try {
    const payload = collectBackup()
    const sum = summarize(payload)
    const { filePath, fileName } = writeBackupFile(payload)
    await shareBackupFile(filePath, fileName)
    uni.showToast({ title: `已导出 ${sum.storeCount} 项 · 请把文件留存在聊天里`, icon: 'none' })
  } catch (e) {
    uni.showModal({ title: '导出失败', content: e instanceof Error ? e.message : '未知错误', showCancel: false })
  }
}

/** 从备份文件恢复：选文件 → 解析校验 → 二次确认 → 覆盖本机 */
async function importFromFile(): Promise<void> {
  try {
    restorePayload.value = await pickBackupFile()
    restoreFrom.value = 'file'
  } catch (e) {
    const msg = e instanceof Error ? e.message : '选择文件失败'
    if (msg !== '已取消') uni.showModal({ title: '无法读取备份', content: msg, showCancel: false })
  }
}

function cancelRestore(): void {
  restorePayload.value = null
}

/** 真正落地恢复：写 storage + 回写内存 store，然后重启到启动页（让所有页面吃上新数据） */
function applyRestore(): void {
  const payload = restorePayload.value
  restorePayload.value = null
  if (!payload) return
  try {
    const result = applyBackup(payload)
    uni.showToast({ title: `${p('toast.restored')} · ${result.restoredStores} 项`, icon: 'none' })
    setTimeout(() => uni.reLaunch({ url: ROUTES.entryStartup }), 900)
  } catch (e) {
    uni.showModal({ title: '恢复失败', content: e instanceof Error ? e.message : '未知错误', showCancel: false })
  }
}

/* ---------------- 云备份（默认关闭；开启才与服务器交互） ---------------- */

/** 开启云备份的明示说明（数据会离开本机，必须先讲清楚） */
const cloudIntroOpen = ref(false)
/** 关闭云备份（删除云端数据）确认 */
const cloudDeleteOpen = ref(false)
/** 云端是否有可恢复的快照（未备份过则为 false） */
const cloudHasSnapshot = computed(() => Boolean(account.lastBackupAt))

const cloudSub = computed(() =>
  account.cloudEnabled
    ? account.lastBackupAt
      ? `已开启 · 上次备份 ${formatBackupTime(account.lastBackupAt)} · ${account.lastBackupStores} 项`
      : '已开启 · 尚未备份过，点「立即备份」上传一次'
    : '关闭时数据只在本机 · 开启后仅用微信标识（匿名）区分你自己的备份',
)

/** 开关：开 → 先看说明；关 → 先确认删除云端数据 */
function onCloudToggle(e: Event & { detail?: { value?: boolean } }): void {
  if (e.detail?.value) cloudIntroOpen.value = true
  else cloudDeleteOpen.value = true
}

async function enableCloud(): Promise<void> {
  cloudIntroOpen.value = false
  account.cloudEnabled = true
  await backupToCloud()
}

async function backupToCloud(): Promise<void> {
  try {
    const outcome = await backupNow()
    if (outcome.saved) {
      uni.showToast({ title: '已备份到云端', icon: 'none' })
    } else {
      uni.showModal({ title: '未能备份', content: outcome.reason || '本次备份被跳过', showCancel: false })
    }
  } catch (e) {
    uni.showModal({ title: '备份失败', content: e instanceof Error ? e.message : '未知错误', showCancel: false })
  }
}

async function confirmDeleteCloud(): Promise<void> {
  try {
    const removed = await disableCloudBackup()
    cloudDeleteOpen.value = false
    uni.showToast({ title: `已删除云端 ${removed} 项数据`, icon: 'none' })
  } catch (e) {
    cloudDeleteOpen.value = false
    uni.showModal({ title: '删除失败', content: e instanceof Error ? e.message : '未知错误', showCancel: false })
  }
}

/** 取回云端快照（latest / prev）→ 交给统一的覆盖确认 */
async function restoreFromCloud(which: 'latest' | 'prev'): Promise<void> {
  try {
    restorePayload.value = await fetchCloudSnapshot(which)
    restoreFrom.value = which === 'prev' ? 'cloud-prev' : 'cloud-latest'
  } catch (e) {
    uni.showModal({ title: '取回失败', content: e instanceof Error ? e.message : '未知错误', showCancel: false })
  }
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
    `${dl('observe')}：${st.marks} 次标注`,
    `${dl('pause')}：${st.focusMin} 分钟`,
    `${dl('reflect')}：${st.cards} 张卡片${st.answered ? ' · 拷问已答' : ' · 拷问未答'}`,
    `${dl('action')}：${daily.doneCount}/${plan} 件 · 习惯打卡 ${st.habitDone} 次`,
    `修为：累计 ${xp.total} 点 · Lv.${lv}`,
    '',
    '—— 数字修行 · 数据属于你自己',
  ].join('\n')
  uni.setClipboardData({
    data: lines,
    success: () => uni.showToast({ title: p('toast.copied'), icon: 'none' }),
  })
}

/** 重置全部修行数据：二次确认后清空所有修行/档案记录，语言与提醒偏好保留 */
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

/* 换肤确认框：面板自身挂 gz-skin--<目标>，整套变量来自目标皮肤 */
.mask {
  position: fixed;
  inset: 0;
  z-index: 50;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 0 56rpx;
  background: rgba(0, 0, 0, 0.48);
}

.dialog {
  width: 100%;
  overflow: hidden;
  background: $gz-surface;
  border: 1rpx solid $gz-line;
  border-radius: $gz-radius-lg;
  box-shadow: 0 24rpx 80rpx rgba(0, 0, 0, 0.28);
}

.dialog__art {
  display: block;
  width: 100%;
  height: 240rpx;
}

.dialog__body {
  padding: 28rpx 30rpx 4rpx;
}

.dialog__head {
  display: flex;
  flex-direction: column;
  gap: 8rpx;
}

.dialog__name {
  font-size: 40rpx;
  font-weight: 800;
  letter-spacing: 0.06em;
  color: $gz-ink;
}

.dialog__en {
  font-size: $gz-fs-caption;
  color: $gz-ink-3;
}

.dialog__tag {
  display: block;
  margin-top: 14rpx;
  font-size: $gz-fs-small;
  line-height: 1.7;
  color: $gz-ink-2;
}

.dialog__note {
  margin-top: 22rpx;
  padding: 20rpx 22rpx;
  border-radius: $gz-radius-sm;
  background: $gz-accent-soft;
  font-size: $gz-fs-caption;
  line-height: 1.7;
  color: $gz-ink-2;
}

.dialog__acts {
  display: flex;
  gap: 18rpx;
  padding: 26rpx 30rpx 32rpx;
}

.dbtn {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  height: 84rpx;
  border-radius: $gz-radius-md;
  font-size: $gz-fs-body;
  font-weight: 600;
  letter-spacing: 0.04em;
}

.dbtn--ghost {
  background: transparent;
  border: 1rpx solid $gz-line;
  color: $gz-ink-2;
}

.dbtn--main {
  background: $gz-accent;
  color: $gz-on-cta;
}
</style>

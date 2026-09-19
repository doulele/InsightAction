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
        <text class="section__hint">到点激励 · 需打开小程序才触发（非微信推送）</text>
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

        <!--
          订阅消息（2026-09-16 查证官方文档后的准确口径，别再改回"关掉小程序也能收到"）：
           · 「长期订阅」—— 一次授权可长期多次下发，但**只向政务民生 / 医疗 / 交通 /
             金融 / 教育等线下公共服务类目开放**，本小程序（工具类）没有资格；
           · 「新版一次性订阅（Beta）」—— 靠微信支付订单号或 open-type="liveActivity"
             取 code，模板全是购物 / 物流 / 保险 / 打车 / 餐饮等业态卡片，同样不适用；
           · 唯一能用的是「一次性订阅消息」：用户点一次弹窗授权 = 换**一条**消息，
             想要第二条就得再授权一次 —— 所以「每日固定推送晨钟暮鼓」做不到。
          这一行如实说明，既不装作能用，也不给出做不到的承诺。
        -->
        <view class="row is-off">
          <view class="row__body">
            <text class="row__title">订阅消息 · 微信推送</text>
            <text class="row__sub">
              微信的「长期订阅」只对政务 / 医疗 / 教育等公共服务类目开放；本小程序只能用「一次性订阅」
              —— 你点一次授权，换一条提醒，做不到每天固定推送。当前未开放。
            </text>
          </view>
          <text class="row__badge">未开放</text>
        </view>
      </view>
    </view>

    <!--
      2.5 · 安息日（2026-09-17）：每周留一天，什么都不必记。
      与上面两个提醒开关**不是一类**：那是"什么时候叫你"，这是"什么时候不叫你"。
      口径落在 utils/sabbath.ts：功能全开、只是不入账（痕迹仍完整）、且一律不催。
    -->
    <view class="section">
      <view class="section__head">
        <text class="section__title">安息日</text>
        <text class="section__hint">每周一天 · 可以什么都不做</text>
      </view>
      <view class="cards">
        <view class="row">
          <view class="row__body">
            <text class="row__title">留一天给自己</text>
            <text class="row__sub">{{ sabbathSub }}</text>
          </view>
          <switch
            class="row__switch"
            :checked="settings.sabbathWeekday !== null"
            :color="modeMeta.accent"
            @change="onSabbathToggle"
          />
        </view>
        <template v-if="settings.sabbathWeekday !== null">
          <view class="row">
            <view class="row__body">
              <text class="row__title">定在哪一天</text>
              <text class="row__sub">哪一天都行 —— 那天照常能进来，只是不算、也不催</text>
            </view>
          </view>
          <view class="days">
            <view
              v-for="(d, i) in WEEKDAY_LABEL"
              :key="d"
              class="day"
              :class="{ 'is-on': settings.sabbathWeekday === i }"
              hover-class="gz-hover"
              @click="settings.sabbathWeekday = i"
            >
              {{ d }}
            </view>
          </view>
        </template>
      </view>
    </view>

    <!-- 3 · 静修声音：一记提示音 + 环境音（本机播放；素材按需从服务器取，仅在你开着时请求） -->
    <view class="section">
      <view class="section__head">
        <text class="section__title">静修声音</text>
        <text class="section__hint">亮屏时才有声 · 跟随系统静音</text>
      </view>
      <view class="cards">
        <view class="row">
          <view class="row__body">
            <text class="row__title">静修声音</text>
            <text class="row__sub">{{ soundSub }}</text>
          </view>
          <switch
            class="row__switch"
            :checked="settings.soundOn"
            :color="modeMeta.accent"
            @change="onSoundToggle"
          />
        </view>
      </view>
    </view>

    <!-- 4 · 数据 -->
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
        <view class="row" hover-class="gz-hover" @click="exportArchive">
          <view class="row__body">
            <text class="row__title">导出修行档案</text>
            <text class="row__sub">{{ $p('settings.exportArchive.sub') }}</text>
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

    <!-- 5 · 云备份：默认关闭；开启后才与服务器交互用户数据（微信标识匿名） -->
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

    <!-- 6 · AI 授权：默认关闭。撤回后 AI 一律走基础规则，内容不再离开手机 -->
    <view class="section">
      <view class="section__head">
        <text class="section__title">AI 授权</text>
        <text class="section__hint">默认关闭 · 可随时撤回</text>
      </view>
      <view class="cards">
        <view class="row">
          <view class="row__body">
            <text class="row__title">允许把内容发给 AI</text>
            <text class="row__sub">{{ aiSub }}</text>
          </view>
          <switch
            class="row__switch"
            :checked="account.aiConsent"
            :color="modeMeta.accent"
            @change="onAiConsentToggle"
          />
        </view>
      </view>
    </view>

    <!-- 7 · 关于 -->
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
        <view class="row" hover-class="gz-hover" @click="checkUpdate">
          <view class="row__body">
            <text class="row__title">检查更新</text>
            <text class="row__sub">{{ updateSub }}</text>
          </view>
          <text class="row__arrow">{{ checking ? '…' : '→' }}</text>
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

    <!--
      检查更新结果：只有「新包已下载好」这一种结局带可执行动作（重启生效），
      其余都是说明类，因此关掉横幅、按 canApply 决定要不要给「稍后」这个出口。
    -->
    <GzDialog
      :show="!!updateResult"
      :title="updateResult?.title || ''"
      :content="updateResult?.content || ''"
      :note="updateResult?.note || ''"
      :confirm-text="updateResult?.canApply ? '立即重启' : '好'"
      :show-cancel="updateResult?.canApply === true"
      :banner="false"
      @cancel="updateResult = null"
      @confirm="onUpdateConfirm"
    />

    <!-- 隐私授权拦截弹窗：复制 / 选备份文件这类接口在用户同意前会被微信拦下 -->
    <PrivacyGate />
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
import { computed, ref, watch } from 'vue'
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
import { playCue, setSoundEnabled } from '@/utils/audio'
import { dayStats } from '@/utils/growth'
import { WEEKDAY_LABEL } from '@/utils/sabbath'
import { resetPracticeData } from '@/utils/localReset'
import { levelIndexFromXp } from '@/config/levels'
import { ROUTES } from '@/router/routes'
import { useContentStore } from '@/stores/content'
import { useAccountStore } from '@/stores/account'
import { useRemoteStore } from '@/stores/remote'
import { applyUpdateNow, updateCheckState, updateReady, updateSupported } from '@/utils/update'
import { compareVersion, getRunningVersion } from '@/utils/version'
import type { PhraseKey } from '@/config/phrases'
import { useDimLabel } from '@/composables/usePhrase'
import {
  applyBackup,
  collectBackup,
  formatBackupTime,
  pickBackupFile,
  shareFile,
  summarize,
  writeBackupFile,
} from '@/utils/localBackup'
import type { BackupPayload } from '@/utils/localBackup'
import { buildArchive, writeArchiveFile } from '@/utils/archive'
import { backupNow, disableCloudBackup, fetchCloudSnapshot } from '@/utils/cloudBackup'

const modeStore = useModeStore()
const appStore = useAppStore()
const settings = useSettingsStore()
const daily = useDailyStore()
const xp = useXpStore()
const skinClass = useSkinClass()
const contentStore = useContentStore()
const account = useAccountStore()
const remote = useRemoteStore()
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
    await shareFile(filePath, fileName)
    uni.showToast({ title: `已导出 ${sum.storeCount} 项 · 请把文件留存在聊天里`, icon: 'none' })
  } catch (e) {
    uni.showModal({ title: '导出失败', content: e instanceof Error ? e.message : '未知错误', showCancel: false })
  }
}

/**
 * 导出修行档案（可读版，规格 §16.3）。
 *
 * 与「导出全部数据」的分工：备份是**给机器读的**（用来恢复），档案是**给人读的**（用来回看）。
 * 生成后交给用户选去向：转发成 .md 文件，或直接复制全文 —— 后者在不支持文件转发的机型上也能用。
 */
async function exportArchive(): Promise<void> {
  let text = ''
  let traceShown = 0
  try {
    const built = buildArchive()
    text = built.text
    traceShown = built.traceShown
  } catch (e) {
    uni.showModal({
      title: '生成档案失败',
      content: e instanceof Error ? e.message : '未知错误',
      showCancel: false,
    })
    return
  }

  uni.showActionSheet({
    itemList: ['转发到聊天（.md 文件）', '复制全文到剪贴板'],
    success: async (r) => {
      if (r.tapIndex === 0) {
        try {
          const { filePath, fileName } = writeArchiveFile(text)
          await shareFile(filePath, fileName)
          uni.showToast({ title: '已生成档案 · 请把文件留存在聊天里', icon: 'none' })
        } catch (err) {
          uni.showModal({
            title: '转发失败',
            content: err instanceof Error ? err.message : '未知错误',
            showCancel: false,
          })
        }
        return
      }
      uni.setClipboardData({
        data: text,
        success: () =>
          uni.showToast({
            title: `已复制全部档案 · 含 ${traceShown} 条痕迹`,
            icon: 'none',
          }),
      })
    },
    fail: () => {},
  })
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

/**
 * AI 授权：与云备份是两码事 —— 云备份传的是修行数据到我们自己的服务器，
 * AI 传的是**你写的正文**给第三方服务商，所以单独授权、单独可撤回。
 * 撤回后所有 AI 功能改用基础规则，功能照常，只是不出手机。
 */
const aiSub = computed(() =>
  account.aiConsent
    ? '已授权 · 用 AI 功能时，你写的内容会发给服务商（DeepSeek）'
    : '未授权 · AI 功能改用基础规则，内容不出手机',
)

function onAiConsentToggle(e: Event & { detail?: { value?: boolean } }): void {
  const on = !!e.detail?.value
  account.aiConsent = on
  uni.showToast({ title: on ? '已授权' : '已撤回 · 只用基础规则', icon: 'none' })
}

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

/* ---------------- 安息日（2026-09-17） ---------------- */
/** 开 = 默认落在周日（哪一天都能改）；关 = null，不替用户安排休息 */
function onSabbathToggle(e: Event & { detail?: { value?: boolean } }): void {
  const on = !!e.detail?.value
  settings.sabbathWeekday = on ? 0 : null
  uni.showToast({ title: on ? `已设为${WEEKDAY_LABEL[settings.sabbathWeekday ?? 0]} —— 那天不必记` : '已取消安息日', icon: 'none' })
}

const sabbathSub = computed(() =>
  settings.sabbathWeekday === null
    ? '开一天：那天照常能进来，一切都不计分、不提醒 —— 想做什么都可以，什么都不做也可以'
    : `${WEEKDAY_LABEL[settings.sabbathWeekday]}那天：不入账、不提醒、不算连胜；痕迹照记，只是不付钱`,
)

/** 静修声音的状态说明（开着/静音两种口径写清楚"计时照常"） */
const soundSub = computed(() =>
  settings.soundOn
    ? '开始与结束的一记提示音 · 沙漏与茶室的环境音（只在亮屏时响）'
    : '已静音 · 静修不放任何声音，计时与入账照常',
)

/**
 * 静修声音开关：**当场播一记让用户听到效果**（比任何文案都直观）。
 * 先手动 setSoundEnabled 再播 —— 不然这一刻播放器里的开关可能还是旧值，
 * 开了却听不到声音（App.vue 的 watch 是同一批更新，不保证先后）。
 */
function onSoundToggle(e: Event & { detail?: { value?: boolean } }): void {
  const on = !!e.detail?.value
  settings.soundOn = on
  setSoundEnabled(on)
  if (on) playCue('open')
  uni.showToast({ title: on ? '已开启' : '已静音', icon: 'none' })
}

/** 导出今日概览：读真实 store 汇总今日观止知行，拼纯文本到剪贴板 */
function exportToday(): void {
  const k = todayKey()
  const st = dayStats(k)
  const lv = levelIndexFromXp(xp.levelXp) + 1
  const plan = daily.planCount || 3
  const lines = [
    '观止知行 · 今日概览',
    `修行语言：${modeMeta.value.label} · ${modeMeta.value.labelEn}`,
    `日期：${k}`,
    `${dl('observe')}：${st.obsN} 条`,
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

/* ---------------- 检查更新（手动核对；纯下行，不上报任何东西） ---------------- */

/** 检查结果弹框的文案（canApply = 主按钮能真的执行「重启生效」） */
interface UpdateResult {
  title: string
  content: string
  note: string
  canApply: boolean
}

const checking = ref(false)
const updateResult = ref<UpdateResult | null>(null)
/** 本页会话内最近一次检查时间（不持久化：下次进来重新问一次更省心） */
const lastCheckedAt = ref('')

/**
 * 版本口径：正式版取微信线上版本号（权威 —— 它决定你手上的包新旧），
 * 开发版 / 体验版取不到（返回空串），退回代码里的包版本号 appStore.versionName。
 */
const shownVersion = computed(() => getRunningVersion() || appStore.versionName)

const updateSub = computed(() => {
  if (checking.value) return '正在核对…'
  if (updateReady.value) return '新版本已下载好 · 点一下重启生效'
  if (lastCheckedAt.value) return `上次检查 ${lastCheckedAt.value} · 当前 v${shownVersion.value}`
  return `当前 v${shownVersion.value} · 点一下核对有没有新版本`
})

/** 弹框底部那行版本说明：开发/体验版要讲清"为什么版本号是本机包版本" */
const versionNote = computed(() =>
  getRunningVersion()
    ? `当前 v${shownVersion.value}`
    : `当前 v${shownVersion.value}（开发版 / 体验版取不到微信线上版本号，显示的是本机包版本）`,
)

function hhmm(): string {
  const d = new Date()
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
}

/**
 * 手动检查更新。
 *
 * ⚠️ 能力边界（文案与实际行为都必须守住，别写成"点一下强制拉新版"）：
 *   1. 微信**没有**主动触发检查的接口 —— 它只在小程序冷启动时自动查一次，
 *      结论由 onCheckForUpdate（有无新版）/ onUpdateReady（新版下没下完）回调给出，
 *      这里读的就是那两个回调的状态（见 utils/update.ts）；
 *   2. 服务器侧的 /app/config 会下发 latestVersion（运营手工填，现在线上是空的），
 *      再拉一次即可比对 —— 这是"服务器记录"，不等于微信已放量；
 *   3. 真正能完成的"升级"只有一个动作：新包已下载就绪时 applyUpdate() 重启生效。
 *   所以判断顺序是「就绪 → 微信说有新版 → 微信说没新版 → 网络 → 环境 → 服务器比对 → 说不清」，
 *   最后那条如实告诉用户"微信只在冷启动查，重开一次即可"，不装作查过了。
 */
async function checkUpdate(): Promise<void> {
  if (checking.value) return
  checking.value = true
  uni.showLoading({ title: '正在核对…', mask: true })

  let ok = false
  try {
    ok = await remote.load()
  } finally {
    checking.value = false
    uni.hideLoading()
  }
  lastCheckedAt.value = hhmm()

  const running = getRunningVersion()
  const latest = remote.appInfo?.latestVersion || ''
  const note = versionNote.value

  // ① 新包已经躺在手机上了 —— 唯一能真的"升级"的结局
  if (updateReady.value) {
    updateResult.value = {
      title: '新版本已就绪',
      content: '新版本已经下载到本机，重启一下就能用上。',
      note,
      canApply: true,
    }
    return
  }

  // ② 微信本次启动已确认有新版本，正在后台静默下载
  if (updateCheckState.value === 'has') {
    updateResult.value = {
      title: '发现新版本',
      content: '微信正在后台下载新版本。等一会儿再点一次「检查更新」，或下次打开小程序时自动生效。',
      note,
      canApply: false,
    }
    return
  }

  // ③ 微信侧确认无更新 —— 以它为准（它才是决定放量的那一方）
  if (updateCheckState.value === 'none') {
    updateResult.value = {
      title: '已是最新版本',
      content: '微信侧没有可用的新版本，你用的就是最新的。',
      note,
      canApply: false,
    }
    return
  }

  // ④ 连服务器也失败：明确说"没查到"，不能说成"已是最新"
  if (!ok) {
    updateResult.value = {
      title: '检查失败',
      content: '没能连上服务器核对版本信息，请检查网络后再试一次。本机数据不受影响。',
      note,
      canApply: false,
    }
    return
  }

  // ⑤ 当前环境根本没有 UpdateManager（H5 预览等）
  if (!updateSupported.value) {
    updateResult.value = {
      title: '当前环境无法核对',
      content: '版本核对要用微信小程序自己的更新能力，浏览器预览里取不到。',
      note,
      canApply: false,
    }
    return
  }

  // ⑥ 服务器记录的版本比你手上的新（微信还没把新包推给你）
  if (running && latest && compareVersion(running, latest) < 0) {
    updateResult.value = {
      title: '服务器上已有新版本',
      content: `服务器记录的版本是 v${latest}，比你正用的 v${running} 新。微信还没把新包推给你 —— 关掉小程序再重新打开，通常就能拿到。`,
      note,
      canApply: false,
    }
    return
  }

  // ⑦ 都没有结论：如实说明微信的检查时机，给出唯一可执行的动作
  updateResult.value = {
    title: '暂时核对不了',
    content:
      '微信只在打开小程序的那一刻自动检查更新，手动点这里不会让它再查一次。若你刚收到发版通知，关掉小程序重新打开即可拿到新版本。',
    note: latest ? `${note} · 服务器记录的最新版 v${latest}` : note,
    canApply: false,
  }
}

function onUpdateConfirm(): void {
  const r = updateResult.value
  updateResult.value = null
  if (!r?.canApply) return
  // applyUpdate 会立即重启小程序，成功就不必再管界面
  if (applyUpdateNow()) return
  uni.showModal({
    title: '重启失败',
    content: '没能应用新版本，请关掉小程序后重新进入。',
    showCancel: false,
  })
}

/**
 * 手动检查时新包正好下载完 → 把「正在下载」就地升级成「可以重启」，
 * 用户不用再点一次「检查更新」。（只在结果弹框已开着时升级，不做无端弹窗。）
 */
watch(updateReady, (v) => {
  if (!v || !updateResult.value || updateResult.value.canApply) return
  updateResult.value = {
    title: '新版本已就绪',
    content: '新版本已经下载到本机，重启一下就能用上。',
    note: versionNote.value,
    canApply: true,
  }
})

/** 重置全部修行数据：二次确认后清空所有修行/档案记录，语言与提醒偏好保留 */
</script>

<style lang="scss" scoped>
@import './index.scss';
</style>

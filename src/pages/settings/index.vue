<template>
  <view class="page" :class="skinClass">
    <!-- 顶栏：返回 + 标题（子页统一样式） -->
        <SubNav :fallback="ROUTES.tabMe">设置</SubNav>

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
        <text class="section__hint">切后台尽量续 · 跟随系统静音</text>
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
        <!--
          声音大小（2026-09-23）：挡在"为了听清要去按系统音量键"这件事前面。
          素材已做响度归一，所以这里 1.0（大）就是素材本来的响度，不再有软件衰减。
          只在开着声音时出现 —— 静音时拨它没有任何可听的结果。
        -->
        <template v-if="settings.soundOn">
          <view class="row">
            <view class="row__body">
              <text class="row__title">声音大小</text>
              <text class="row__sub">只改我们自己的音效 · 沙漏与茶室当场跟着变</text>
            </view>
          </view>
          <view class="levels">
            <view
              v-for="l in SOUND_LEVELS"
              :key="l.id"
              class="level"
              :class="{ 'is-on': settings.soundLevel === l.id }"
              hover-class="gz-hover"
              @click="onLevelPick(l.id)"
            >{{ l.label }}</view>
          </view>
        </template>
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
          <view class="row__arrow" />
        </view>
        <view class="row" hover-class="gz-hover" @click="exportAll">
          <view class="row__body">
            <text class="row__title">导出全部数据</text>
            <text class="row__sub">{{ $p('settings.exportAll.sub') }}</text>
          </view>
          <view class="row__arrow" />
        </view>
        <view class="row" hover-class="gz-hover" @click="exportArchive">
          <view class="row__body">
            <text class="row__title">导出修行档案</text>
            <text class="row__sub">{{ $p('settings.exportArchive.sub') }}</text>
          </view>
          <view class="row__arrow" />
        </view>
        <view class="row" hover-class="gz-hover" @click="importFromFile">
          <view class="row__body">
            <text class="row__title">从备份恢复</text>
            <text class="row__sub">{{ $p('settings.importFile.sub') }}</text>
          </view>
          <view class="row__arrow" />
        </view>
        <view class="row" hover-class="gz-hover" @click="resetToday">
          <view class="row__body">
            <text class="row__title is-danger">重置今日三件事</text>
            <text class="row__sub">{{ $p('settings.resetToday.sub') }}</text>
          </view>
          <view class="row__arrow" />
        </view>
        <view class="row" hover-class="gz-hover" @click="resetAll">
          <view class="row__body">
            <text class="row__title is-danger">重置全部修行数据</text>
            <text class="row__sub">{{ $p('settings.resetAll.sub') }}</text>
          </view>
          <view class="row__arrow" />
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
            :checked="cloudSwitchOn"
            :color="modeMeta.accent"
            @change="onCloudToggle"
          />
        </view>
        <view v-if="account.cloudEnabled" class="row" hover-class="gz-hover" @click="backupToCloud">
          <view class="row__body">
            <text class="row__title">立即备份</text>
            <text class="row__sub">把本机当前进度上传一份（手动备份不做缩水拦截）</text>
          </view>
          <view class="row__arrow" />
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
          <view class="row__arrow" />
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
          <view class="row__arrow" />
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
            :checked="aiSwitchOn"
            :color="modeMeta.accent"
            @change="onAiConsentToggle"
          />
        </view>

        <!--
          管理员专用：AI 开通申请的审批入口（2026-09-26）。
          后端回 `admin: true` 时才渲染 —— 但**真正的门在服务端**（`/ai/review/*` 比对登录态里的 openid），
          这里只是不让无关的人看见一行用不上的入口。
        -->
        <view v-if="aiAdmin" class="row" hover-class="gz-hover" @click="openAiReview">
          <view class="row__body">
            <text class="row__title">AI 开通申请</text>
            <text class="row__sub">{{ aiReviewSub }}</text>
          </view>
          <view class="row__arrow" />
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
          <view v-if="!checking" class="row__arrow" />
          <text v-else class="row__arrow-dots">…</text>
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
      @cancel="cancelCloudToggle"
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
      @cancel="cancelCloudToggle"
      @confirm="confirmDeleteCloud"
    />

    <!--
      AI 知情同意：用页面自己的 GzDialog（`askConsentHere`）。
      原生 `uni.showModal` 在本页弹不出来 —— 用户看到的现象就是"点开关后立刻回弹、没有框"。
    -->
    <GzDialog
      :show="aiConsentOpen"
      :title="AI_CONSENT.title"
      :content="AI_CONSENT.body"
      :banner="false"
      :cancel-text="AI_CONSENT.cancel"
      :confirm-text="AI_CONSENT.confirm"
      @cancel="resolveConsent(false)"
      @confirm="resolveConsent(true)"
    />

    <!--
      申请开通：同样走 GzDialog，用插槽放一个输入框收称呼（原生 editable 弹框还会把 content 当初始值）。
      `z-index` 必须高于二维码框（默认 300）—— 两者是同层遮罩，层级相同就会互相盖住。
    -->
    <GzDialog
      :show="applyOpen"
      :z-index="360"
      title="申请开通 AI"
      :banner="false"
      cancel-text="算了"
      confirm-text="发送申请"
      @cancel="applyOpen = false"
      @confirm="sendApply"
    >
      <input
        v-model="applyName"
        class="apply__input"
        placeholder="写一句我怎么称呼你（可留空）"
        placeholder-class="apply__ph"
        :maxlength="20"
      />
    </GzDialog>

    <!--
      AI 不在白名单：本机同意过了、服务端没放行 —— 如实说明 + 一张二维码。
      说明文字走默认插槽（与二维码排在一起），没有二维码时只留文字兜底。
    -->
    <GzDialog
      :show="aiDeniedOpen"
      title="AI 需要开通"
      :banner="false"
      confirm-text="知道了"
      :show-cancel="false"
      @confirm="aiDeniedOpen = false"
    >
      <view class="ai-qr__box">
        <text class="ai-qr__tip">{{ aiDeniedContent }}</text>
        <image
          v-if="aiQrcode"
          class="ai-qr"
          :src="aiQrcode"
          mode="aspectFit"
          show-menu-by-longpress
          @error="aiQrcode = ''"
        />
        <text v-else class="ai-qr__none">二维码没取到 —— 可以在「关于」里找我。</text>
        <view
          class="ai-qr__apply"
          :class="{ 'is-done': aiApplied || aiApplyState === 'pending' }"
          hover-class="gz-hover"
          @click="applyAccess"
        >
          {{ aiApplyLabel }}
        </view>
      </view>
    </GzDialog>

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
import { playCue, setSoundEnabled, setSoundLevel } from '@/utils/audio'
import { SOUND_LEVELS, type SoundLevel } from '@/config/audio'
import { dayStats } from '@/utils/growth'
import { WEEKDAY_LABEL } from '@/utils/sabbath'
import { resetPracticeData } from '@/utils/localReset'
import { levelIndexFromXp } from '@/config/levels'
import { navigateTo, ROUTES } from '@/router/routes'
import { useContentStore } from '@/stores/content'
import { useAccountStore } from '@/stores/account'
import { useShareStore } from '@/stores/share'
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
import type { BackupPayload, BackupSummary } from '@/utils/localBackup'
import { buildArchive, writeArchiveFile } from '@/utils/archive'
import { backupNow, disableCloudBackup, fetchCloudSnapshot } from '@/utils/cloudBackup'
import { showModal } from '@/utils/dialog'
import { AI_CONSENT, aiDeniedText, applyAiAccess, fetchAiAccess } from '@/utils/aiAccess'
import { aiReviewList, type AiApplyState } from '@/api/modules/ai'

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
  /* AI 那一块的状态（是不是管理员 / 申请到哪一步）—— 见 refreshAiAccess 的说明 */
  void refreshAiAccess()
})

/** 返回：正常栈内 navigateBack；异常兜底回「我」大厅 */

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

async function runDanger(): Promise<void> {
  const kind = dangerKind.value
  dangerKind.value = null
  if (kind === 'resetToday') {
    daily.$patch((s) => {
      s.todos = freshTodos()
    })
    uni.showToast({ title: p('toast.resetDone'), icon: 'none' })
    return
  }
  /*
   * 先撤回服务器上的分享，再清本机（2026-09-21）。
   *
   * 顺序不能反：重置会把收件匣清掉，那条内容的详情页也随之消失 ——
   * 而服务器上那些快照**仍然是公开可读的**，那样"重置全部"就等于一句假话。
   * 撤回失败不拦着重置（可能只是没网），但要把没撤成的条数如实说出来。
   */
  const share = useShareStore()
  /*
   * 这一段是"看不出来在忙"的重活：revokeAll 要逐条打服务器（没网还得等超时），
   * resetPracticeData 又要同步清掉 30 个 store。给个 loading，免得用户以为点空了。
   */
  uni.showLoading({ title: '正在清理…', mask: true })
  let revoked: { ok: number; failed: number }
  try {
    revoked = await share.revokeAll()
    resetPracticeData()
  } finally {
    uni.hideLoading()
  }
  uni.showToast({ title: p('toast.resetDone'), icon: 'none' })
  if (revoked.failed) {
    showModal({
      title: '有分享没能撤回',
      content:
        `本机数据已重置，但有 ${revoked.failed} 条分享没能从服务器撤回（多半是网络问题）。\n`
        + '它们会在 30 天后自动失效；你也可以等有网时再试一次。',
      showCancel: false,
      confirmText: '知道了',
    })
  }
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

/**
 * 导出全部数据：打包 → 报体积 → 写文件 → 转发到聊天（用户自己保存，全程无上行数据）。
 *
 * 为什么分两步、且必须先报体积：`collectBackup()` 走的是同步 storage API，
 * 数据一多会**卡住主线程几秒**（看起来像"点了没反应"）；
 * 而"这份文件多大、多少项"是用户决定要不要导的依据 —— 先说清楚再打包一次，比闷头写盘更好。
 */
async function exportAll(): Promise<void> {
  let payload: BackupPayload
  let sum: BackupSummary
  uni.showLoading({ title: '正在打包…', mask: true })
  try {
    payload = collectBackup()
    sum = summarize(payload)
  } catch (e) {
    uni.hideLoading()
    showModal({ title: '打包失败', content: e instanceof Error ? e.message : '未知错误', showCancel: false })
    return
  }
  uni.hideLoading()

  const ok = await new Promise<boolean>((resolve) => {
    showModal({
      title: '导出全部数据？',
      content:
        `共 ${sum.storeCount} 项、约 ${sum.sizeKB}KB。\n`
        + '会生成一个 JSON 备份文件并转发到聊天里，请自己留存好 —— 全程不上传服务器。',
      confirmText: '导出',
      cancelText: '算了',
      success: (r) => resolve(!!r.confirm),
      fail: () => resolve(false),
    })
  })
  if (!ok) return

  uni.showLoading({ title: '正在生成文件…', mask: true })
  try {
    const { filePath, fileName } = writeBackupFile(payload)
    /* 转发面板是微信的原生层，拉起前必须先关掉 loading，否则它会一直悬在页面上 */
    uni.hideLoading()
    await shareFile(filePath, fileName)
    uni.showToast({ title: `已导出 ${sum.storeCount} 项 · 请把文件留存在聊天里`, icon: 'none' })
  } catch (e) {
    uni.hideLoading()
    showModal({ title: '导出失败', content: e instanceof Error ? e.message : '未知错误', showCancel: false })
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
  /* buildArchive() 要把卡片全量 + 500 条痕迹拼成一大段文本，是同步的大计算 —— 先给个转圈 */
  uni.showLoading({ title: '正在生成档案…', mask: true })
  try {
    const built = buildArchive()
    text = built.text
    traceShown = built.traceShown
  } catch (e) {
    uni.hideLoading()
    showModal({
      title: '生成档案失败',
      content: e instanceof Error ? e.message : '未知错误',
      showCancel: false,
    })
    return
  }
  uni.hideLoading()

  /*
   * 体积预估：档案是中文为主的 Markdown，一个字约 3 字节，只能按 len*3 粗估
   * （小程序端拿不到字符串的字节长度）。摆进选项文案里而不是另弹一个框 —— 少一次点击。
   */
  const sizeKB = Math.max(1, Math.round((text.length * 3) / 1024))
  uni.showActionSheet({
    itemList: [
      `转发到聊天（.md · 约 ${sizeKB}KB）`,
      `复制全文到剪贴板（约 ${text.length} 字）`,
    ],
    success: async (r) => {
      if (r.tapIndex === 0) {
        try {
          const { filePath, fileName } = writeArchiveFile(text)
          await shareFile(filePath, fileName)
          uni.showToast({ title: '已生成档案 · 请把文件留存在聊天里', icon: 'none' })
        } catch (err) {
          showModal({
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
    if (msg !== '已取消') showModal({ title: '无法读取备份', content: msg, showCancel: false })
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
  /* 恢复要写全部 storage + patch 30 个 store，全是同步操作；给个转圈免得像卡死 */
  uni.showLoading({ title: '正在恢复…', mask: true })
  try {
    const result = applyBackup(payload)
    uni.hideLoading()
    uni.showToast({ title: `${p('toast.restored')} · ${result.restoredStores} 项`, icon: 'none' })
    setTimeout(() => uni.reLaunch({ url: ROUTES.entryStartup }), 900)
  } catch (e) {
    uni.hideLoading()
    showModal({ title: '恢复失败', content: e instanceof Error ? e.message : '未知错误', showCancel: false })
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
    : '未授权 · AI 功能改用基础规则，内容不出手机（开启时会先核验账号能不能用）',
)

/**
 * 「需要开通」弹框：不在白名单时给二维码（2026-09-23）。
 *
 * 这一步不是"再确认一次"，而是**如实告诉他为什么用不了**：
 * 本机同意（我答应把文字发出去）与服务端放行（我们这边让你用）是两件事 ——
 * 混在一起讲，用户只会觉得"这个功能坏了"。二维码走长按（`show-menu-by-longpress`），
 * 长按即可保存 / 识别，不必再教一遍怎么扫。
 */
const aiDeniedOpen = ref(false)
/** 二维码地址由后端下发（运营物料，换码不用发版）；取不到就只显示文字兜底 */
const aiQrcode = ref('')
/**
 * 我自己当前的申请状态（**服务端说的**，不是本页自己猜的）。
 *
 * 为什么要它：`aiApplied` 那种布尔区分不出"还没申请"与"被拒了"——
 * 而被拒的人最该看到的就是「上次没通过 · 可以再申请一次」（2026-09-26 加）。
 */
const aiApplyState = ref<AiApplyState>('none')
/** 本页会话内是否已发过申请（不持久化 —— 后端对重复申请幂等，重开小程序再点一次也无害） */
const aiApplied = ref(false)

/** 弹框里那段说明：按状态换说法（文案本体在 utils/aiAccess，功能页用的是同一份） */
const aiDeniedContent = computed(() =>
  aiDeniedText(aiApplied.value ? 'pending' : aiApplyState.value),
)

/** 「需要开通」弹框里按钮上的字：没申请过 / 已申请待批 / 上次没通过 */
const aiApplyLabel = computed(() => {
  if (aiApplied.value || aiApplyState.value === 'pending') return '已申请 · 等我开通'
  if (aiApplyState.value === 'rejected') return '再次申请'
  return '申请开通'
})

/* ---------------- 管理员的审批入口（2026-09-26 加） ----------------
 *
 * 只有后端说 `admin: true`（我自己的 openid 在 `AI_ADMIN_OPENIDS` 里）时才渲染那一行。
 * ⚠️「看不见」只是顺手：**真正的门在服务端** —— `/ai/review/*` 会比对登录态里的 openid，
 * 所以就算有人手改路由闯进审批页，也只会拿到 403。
 */
const aiAdmin = ref(false)
/** 待批条数（只在确认是管理员后才查，用来在入口那行提示"有人等你批"） */
const aiPending = ref(0)
const aiReviewSub = computed(() =>
  aiPending.value > 0 ? `${aiPending.value} 条待批 · 点这里审批` : '当前没有待批的申请',
)

function openAiReview(): void {
  navigateTo(ROUTES.meAiReview)
}

/**
 * 进页面时问一次服务端：我是不是管理员、我自己申请到哪一步了。
 *
 * 为什么不等点开关再查：设置页是低频页面，一次请求换来的是
 * 「入口该不该出现」「按钮该写什么」**一进来就是准的** ——
 * 他刚被通过、刚被拒，都能当场看出来（2026-09-26 加）。
 * 查不到一律不打扰：没网时保持原样，点开关时会再查一次。
 */
async function refreshAiAccess(): Promise<void> {
  const info = await fetchAiAccess()
  if (!info) return
  aiAdmin.value = info.admin
  aiApplyState.value = info.applyState
  /* 服务端说还挂着，就把"已申请"这面旗接着举着（他重开小程序也看得到） */
  if (info.applyState === 'pending') aiApplied.value = true
  if (!info.admin) {
    aiPending.value = 0
    return
  }
  try {
    const data = await account.withAuth((t) => aiReviewList(t))
    aiPending.value = data.pending.length
  } catch {
    /* 审批数据取不到不影响本页别的事（点进去再看） */
  }
}

/**
 * AI 开关的**显示值**。
 *
 * 为什么不直接写 `:checked="account.aiConsent"`：小程序 `switch` 是**受控组件**，
 * 用户一点它自己先变成"开"；此后若因为"用户取消 / 账号未开通"而 store 没变，
 * 视图**不会回弹**（值没变 → 不触发重渲染）—— 表现就是"开关绿着、下面却写着未授权"
 * （2026-09-23 用户截图报的正是这个）。所以用本地 ref 跟手：操作没成时把它推回真实值。
 */
const aiSwitchOn = ref(account.aiConsent)
watch(
  () => account.aiConsent,
  (v) => {
    aiSwitchOn.value = v
  },
)

/* ---------------- AI 的两个交互：都用**页面自己的 GzDialog** ----------------
 *
 * 为什么不用 `utils/dialog.ts` 的 `showModal`（它最终走 `uni.showModal`）：
 * 本页实测**弹不出来** —— 2026-09-23 用户报「点开关后立刻回弹、没有任何框」，
 * 那就意味着 `askAiConsent()` 拿到的 Promise 直接 resolve(false)（modal 的 success 从未回来）。
 * 设置页本来就挂着好几个 GzDialog，用它最稳（页面内 `v-if` 控制，不依赖任何原生 API），
 * 而且它**跟随皮肤** —— 原生弹框底永远是白的，这本来就是它被写进 `未做事项 #20.3` 的原因。
 */
const aiConsentOpen = ref(false)
/** 本次询问的 resolver；用户按下按钮后回收（null = 当前没有待答的询问） */
let aiConsentResolve: ((ok: boolean) => void) | null = null
/** 「申请开通」面板（用 GzDialog + 一个输入框收称呼） */
const applyOpen = ref(false)
const applyName = ref('')

/** 弹一次知情同意（等同 `askAiConsent()`，但走页面内的 GzDialog） */
function askConsentHere(): Promise<boolean> {
  return new Promise<boolean>((resolve) => {
    aiConsentResolve = resolve
    aiConsentOpen.value = true
  })
}

function resolveConsent(ok: boolean): void {
  aiConsentOpen.value = false
  const r = aiConsentResolve
  aiConsentResolve = null
  r?.(ok)
}

/**
 * 开关：开 → 先同意、再核名单；关 → 直接撤回。
 *
 * 为什么"核名单"要放在同意之后：同意是必须由用户按下的一次（内容离开设备），
 * 而名单是客观状态 —— 顺序反了会出现"先告诉你没资格，再问你要不要同意"的怪话。
 * 名单里没有 → **不打开开关**（store 保持 false，开关自己弹回），并弹二维码。
 *
 * ⚠️ 这里用 `askAiConsent()`（**每次都弹**）而不是 `ensureAiConsent()`（同意过就跳过）。
 * 原因见 2026-09-23 的报障：老用户点这个开关时 `aiConsent` 早已是 true，
 * 于是走的是"撤回"那一支 —— 他期待看到确认框，实际什么都没发生（只有一句 toast）。
 * 用户**主动开**这个开关，就该每次都看到自己答应的是什么。
 */
async function onAiConsentToggle(e: Event & { detail?: { value?: boolean } }): Promise<void> {
  const on = !!e.detail?.value
  aiSwitchOn.value = on // 先跟手（用户已经点下去了，视觉上先按他的意思走）
  try {
    if (!on) {
      account.aiConsent = false
      uni.showToast({ title: '已撤回 · 只用基础规则', icon: 'none' })
      return
    }
    const agreed = await askConsentHere()
    if (!agreed) {
      aiSwitchOn.value = false // 取消 → 把开关推回去（否则它会一直绿着，与实际状态不符）
      return
    }
    /* 同意本身要落库（否则下一次又得问一遍）；未开通时下面会回滚 */
    account.aiConsent = true

    uni.showLoading({ title: '正在核验…', mask: true })
    const info = await fetchAiAccess()
    uni.hideLoading()

    /* 顺手把「我是不是管理员」「我申请到哪一步了」更新掉（入口与按钮文案都吃这两个） */
    if (info) {
      aiAdmin.value = info.admin
      aiApplyState.value = info.applyState
    }
    /* 没查成（没网 / 服务端异常）不挡人：同意过了就先用着，真调不通时 useAi 会静默兜底 */
    if (info?.mode === 'denied') {
      account.aiConsent = false
      aiSwitchOn.value = false // 没开通 → 开关退回去（"授权不等于放行"的可视化）
      aiQrcode.value = info.qrcode
      aiDeniedOpen.value = true
      return
    }
    uni.showToast({ title: '已授权 · 可以用 AI 了', icon: 'none' })
  } catch (err) {
    /*
     * 兜底：任何没料到的异常都要**给一句提示 + 把开关推回真实值**。
     * 绝不允许这个开关变成"点了什么都不发生" —— 2026-09-23 的报障就是这种沉默。
     */
    uni.hideLoading()
    console.error('[settings] AI 授权开关出错：', err)
    aiSwitchOn.value = account.aiConsent
    uni.showToast({ title: '没完成 · 稍后再试', icon: 'none' })
  }
}

/**
 * 申请开通（2026-09-23 加）：先收一句称呼，再发。
 *
 * 为什么让用户自己填、而不是自动带上他的昵称：昵称是**另一类数据**，
 * 不该在他没意识到的时候跟着申请一起上传（PRIVACY 的边界，别图省事）。
 * 后端只记 openid + 这句称呼 + 时间，开发者照着就能加人。
 */
function applyAccess(): void {
  /* 已经挂着一条待批的就别重复提交（后端也幂等，这里只是少一次来回 + 少一次困惑） */
  if (aiApplied.value || aiApplyState.value === 'pending') {
    uni.showToast({ title: '已经申请过了 · 等我开通就行', icon: 'none' })
    return
  }
  applyName.value = ''
  /*
   * ⚠️ 必须先收起二维码框（2026-09-23 报障「点申请开通没反应」）：
   * 两个 GzDialog 的遮罩层级都是默认的 300，而二维码框在模板里位于输入框**之后** ——
   * 它俩同时展示时，后渲染的二维码框会**整个盖住**输入框，
   * 用户看到的就是"点了一下，什么都没发生"（其实输入框已经弹出来了，只是看不见）。
   * 这里按顺序切换，另外给输入框传了更高的 zIndex 兜底（双保险）。
   */
  aiDeniedOpen.value = false
  applyOpen.value = true
}

/** 真正提交申请（由 GzDialog 的「发送申请」触发） */
async function sendApply(): Promise<void> {
  applyOpen.value = false
  const name = applyName.value.trim().slice(0, 20)
  uni.showLoading({ title: '正在发送…', mask: true })
  const ok = await applyAiAccess(name)
  uni.hideLoading()
  if (!ok) {
    uni.showToast({ title: '没发出去 · 检查网络再试一次', icon: 'none' })
    return
  }
  aiApplied.value = true
  aiApplyState.value = 'pending'
  /*
   * 回到「需要开通」那个框：他会看到按钮已经变成「已申请 · 等我开通」——
   * 比只闪一句 toast 清楚（二维码还留着，想直接加我也顺手）。
   */
  aiDeniedOpen.value = true
  uni.showToast({ title: '已申请 · 开通后回来打开这个开关', icon: 'none' })
}

/**
 * 云备份开关的**显示值** —— 与 AI 授权同一个原因（小程序 `switch` 不会自己回弹）：
 * 它点下去并不直接改 store，而是先弹说明 / 确认框；用户一取消，store 没变，
 * 视图就会停在"已开"的绿色上，与实际状态不符。
 */
const cloudSwitchOn = ref(account.cloudEnabled)
watch(
  () => account.cloudEnabled,
  (v) => {
    cloudSwitchOn.value = v
  },
)

/** 开关：开 → 先看说明；关 → 先确认删除云端数据 */
function onCloudToggle(e: Event & { detail?: { value?: boolean } }): void {
  const on = !!e.detail?.value
  cloudSwitchOn.value = on
  if (on) cloudIntroOpen.value = true
  else cloudDeleteOpen.value = true
}

/** 取消这一轮开关操作：把开关显示推回真实值（受控组件不会自己回弹） */
function cancelCloudToggle(): void {
  cloudIntroOpen.value = false
  cloudDeleteOpen.value = false
  cloudSwitchOn.value = account.cloudEnabled
}

async function enableCloud(): Promise<void> {
  cloudIntroOpen.value = false
  account.cloudEnabled = true
  await backupToCloud()
}

async function backupToCloud(): Promise<void> {
  /* 全量快照上传：数据量 + 网络，慢起来十几秒 —— 没有转圈的话用户会以为点空了 */
  uni.showLoading({ title: '正在上传…', mask: true })
  try {
    const outcome = await backupNow()
    uni.hideLoading()
    if (outcome.saved) {
      uni.showToast({ title: '已备份到云端', icon: 'none' })
    } else {
      showModal({ title: '未能备份', content: outcome.reason || '本次备份被跳过', showCancel: false })
    }
  } catch (e) {
    uni.hideLoading()
    showModal({ title: '备份失败', content: e instanceof Error ? e.message : '未知错误', showCancel: false })
  }
}

async function confirmDeleteCloud(): Promise<void> {
  try {
    const removed = await disableCloudBackup()
    cloudDeleteOpen.value = false
    uni.showToast({ title: `已删除云端 ${removed} 项数据`, icon: 'none' })
  } catch (e) {
    cloudDeleteOpen.value = false
    /* 失败了开关要退回原状（store 没变 → watch 不会触发，得手动推一次） */
    cloudSwitchOn.value = account.cloudEnabled
    showModal({ title: '删除失败', content: e instanceof Error ? e.message : '未知错误', showCancel: false })
  }
}

/** 取回云端快照（latest / prev）→ 交给统一的覆盖确认 */
async function restoreFromCloud(which: 'latest' | 'prev'): Promise<void> {
  /* 从服务器把整份快照拉下来，数据量大时不算快 */
  uni.showLoading({ title: '正在取回…', mask: true })
  try {
    const payload = await fetchCloudSnapshot(which)
    restoreFrom.value = which === 'prev' ? 'cloud-prev' : 'cloud-latest'
    /* 紧接着要弹覆盖确认框（原生 showModal 会顶掉 showLoading）—— 先收起转圈再让它出 */
    uni.hideLoading()
    restorePayload.value = payload
  } catch (e) {
    uni.hideLoading()
    showModal({ title: '取回失败', content: e instanceof Error ? e.message : '未知错误', showCancel: false })
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
    ? '一记提示音 · 沙漏与茶室的环境音（切后台尽量续上，息屏不保证）'
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

/**
 * 声音大小（小 / 中 / 大）：**当场播一记让用户听到效果**（同总开关那一套口径）。
 *
 * 必须"先手动 setSoundLevel、后 playCue"：App.vue 那个 watch 与这里是同一批更新，
 * 不保证先后 —— 反过来的话试听那一声还是旧音量，用户会以为档位没生效。
 */
function onLevelPick(id: SoundLevel): void {
  settings.soundLevel = id
  setSoundLevel(id)
  playCue('open')
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
  showModal({
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

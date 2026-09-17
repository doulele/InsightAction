<script setup lang="ts">
import { onHide, onLaunch, onShow } from '@dcloudio/uni-app'
import { watch } from 'vue'
import { useAppStore } from '@/stores/app'
import { useModeStore } from '@/stores/mode'
import { useRemoteStore } from '@/stores/remote'
import { useContentStore } from '@/stores/content'
import { useImageStore } from '@/stores/images'
import { useProverbStore } from '@/stores/proverb'
import { useIdentityStore } from '@/stores/identity'
import { useObserveStore } from '@/stores/observe'
import { useSettingsStore } from '@/stores/settings'
import { applySkin } from '@/utils/skin'
import { initUpdateManager } from '@/utils/update'
import { initPrivacyGuard } from '@/utils/privacy'
import { autoBackupIfDue } from '@/utils/cloudBackup'
import { initAudioOption, resumeAudio, setSoundEnabled, suspendAudio } from '@/utils/audio'
import { installRouterGuard, ROUTES } from '@/router/routes'

onLaunch(() => {
  /*
   * 路由兜底：`switchTab` 在工具/基础库上出现过 `fail timeout`，而项目里那二十多处 tab 跳转
   * 大多没写 fail 回调 —— 失败会被当成未捕获错误整屏上报，跳转也没发生。
   * 这里包一层，失败自动退一步用 reLaunch（见 router/routes.ts）。放在最前，先于任何跳转。
   */
  installRouterGuard()

  /*
   * 隐私授权拦截：后台隐私保护指引生效后，剪贴板 / 选文件 / 头像昵称 / 微信运动步数
   * 这四类接口在用户同意前会被微信拦下。这里挂上拦截回调，
   * 由页面里的 <PrivacyGate /> 弹窗接住并放行（见 utils/privacy.ts）。
   * 必须最早挂：晚一步就可能漏掉启动时发生的那次调用。
   */
  initPrivacyGuard()

  /*
   * 静修声音（2026-09-17）：先定播放口径 —— 跟随系统静音键、不与其他音频混音；
   * 再把用户的总开关同步进播放器（utils/audio.ts 的模块级开关，
   * 关掉后沙漏 / 茶室 / 呼吸干预的一切播放请求直接返回，不下载也不发声）。
   */
  initAudioOption()
  setSoundEnabled(useSettingsStore().soundOn)

  // 应用级初始化：记录启动
  const appStore = useAppStore()
  appStore.recordLaunch()

  // 头像自检：持久化的本地路径可能已失效（换机恢复 / 系统清理），失效就回落成「名字章」
  useIdentityStore().verify()

  // 打开仪式：每次冷启动一律先进启动箴言页（约 4 秒，点按即跳过）。
  // 该页随用户上次选择的模式皮肤出现；模式已持久化，无需重复选择。
  // 分流（已完成引导 → 主界面 / 首次 → 模式选择）由该页自身负责。
  uni.reLaunch({ url: ROUTES.entryStartup })

  // tabBar / navigationBar 在首帧后才就绪，延迟一帧确保 API 可用
  const modeStore = useModeStore()
  setTimeout(() => applySkin(modeStore.id, true), 60)

  // 箴言收藏迁移：旧版本把收藏存在 insight:buddy-favs（不在备份体系内），
  // 这里一次性搬进 proverb store（幂等，仅首次生效；之后随备份/云备份一起走）
  useProverbStore().migrateLegacy()

  // 观的一条迁移：主题从单选（topic: string）改多选（topics: string[]）。
  // 必须放在这里而不是 store 内部 —— 插件的水合晚于 setup，写在 setup 里会迁到空 state
  useObserveStore().migrateLegacy()

  // 图片缓存：先校验持久化下来的本地文件是否还在（临时目录会被系统清理），
  // 失效的条目会被剔除，用到时会自动重新下载，不会出现"指向空文件"的坏图
  const images = useImageStore()
  void images.verifyExisting()

  // 拉取远端横幅图配置（静默失败：拿不到就用主题渐变兜底，不阻塞任何流程）
  void modeStore.loadSkins().then(() => {
    /**
     * 只预热当前模式的**横幅**（1 张）。
     *
     * 为什么不连模块标志物一起预热：那 4 张都在子页里，用户可能一次都不去，
     * 启动就下属于白花流量（也会让人疑惑"还没进那页怎么先请求了"）。
     * 标志物由 ModuleMark 组件挂载时按需下载 —— 一次下载、之后本地直读。
     */
    images.warmBanner(modeStore.remoteArtOf(modeStore.id))
  })

  // 远端配置（公告 / 版本信息 / 功能开关）+ 新版本下载监听：
  // 纯下行、不含用户数据；失败静默，不阻塞启动
  initUpdateManager()
  void useRemoteStore().load()
  // 内容下发（题库 / 分档 / 称号）：纯下行；拿不到就全程用内置题库
  void useContentStore().load()

  // 云备份自动触发（仅在你开启过云备份之后生效）：
  // 距上次备份超过 24 小时才跑，服务端还有缩水保护兜底；失败静默，不打扰启动。
  setTimeout(() => void autoBackupIfDue(), 3000)

  console.log(`[InsightAction] launch #${appStore.launchCount} ${appStore.firstLaunch ? '(first)' : ''}`)
})

// 后续：用户在「设置 / 模式选择页」变更 mode → 自动重新应用原生控件颜色与图标
const modeStore = useModeStore()
watch(
  () => modeStore.id,
  (id) => {
    applySkin(id)
    /* 切模式 = 换一套图 → 顺手预热新横幅（标志物仍由各页面用到时再下载） */
    useImageStore().warmBanner(modeStore.remoteArtOf(id))
  },
)

// 静修声音总开关：设置页改动即时生效（关掉立即停声，不用等下次进页面）
const settings = useSettingsStore()
watch(
  () => settings.soundOn,
  (on) => setSoundEnabled(on),
)

/*
 * 切后台 / 回前台：普通 innerAudioContext 会被微信挂起，这里主动收干净，
 * 回前台再按记录把环境音续上。页面不用管这件事 ——
 * 计时按墙上时间照走（沙漏/茶室的规则不变），只是声音断一下。
 */
onHide(() => suspendAudio())
onShow(() => resumeAudio())
</script>

<style lang="scss">
@import './App.scss';
</style>
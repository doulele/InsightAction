<script setup lang="ts">
import { onLaunch } from '@dcloudio/uni-app'
import { watch } from 'vue'
import { useAppStore } from '@/stores/app'
import { useModeStore } from '@/stores/mode'
import { useRemoteStore } from '@/stores/remote'
import { useContentStore } from '@/stores/content'
import { applySkin } from '@/utils/skin'
import { initUpdateManager } from '@/utils/update'
import { ROUTES } from '@/router/routes'

onLaunch(() => {
  // 应用级初始化：记录启动
  const appStore = useAppStore()
  appStore.recordLaunch()

  // 打开仪式：每次冷启动一律先进启动箴言页（约 2 秒，点按即跳过）。
  // 该页随用户上次选择的模式皮肤出现；模式已持久化，无需重复选择。
  // 分流（已完成引导 → 主界面 / 首次 → 模式选择）由该页自身负责。
  uni.reLaunch({ url: ROUTES.entryStartup })

  // tabBar / navigationBar 在首帧后才就绪，延迟一帧确保 API 可用
  const modeStore = useModeStore()
  setTimeout(() => applySkin(modeStore.id, true), 60)

  // 拉取远端横幅图配置（静默失败：拿不到就用主题渐变兜底，不阻塞任何流程）
  void modeStore.loadSkins()

  // 远端配置（公告 / 版本信息 / 功能开关）+ 新版本下载监听：
  // 纯下行、不含用户数据；失败静默，不阻塞启动
  initUpdateManager()
  void useRemoteStore().load()
  // 内容下发（题库 / 分档 / 称号）：纯下行；拿不到就全程用内置题库
  void useContentStore().load()

  console.log(`[InsightAction] launch #${appStore.launchCount} ${appStore.firstLaunch ? '(first)' : ''}`)
})

// 后续：用户在「设置 / 模式选择页」变更 mode → 自动重新应用原生控件颜色与图标
const modeStore = useModeStore()
watch(
  () => modeStore.id,
  (id) => applySkin(id),
)
</script>

<style lang="scss">
/* ---------- 全局基线 ---------- */
page {
  /* 默认值（兜底：normal 模式）；.gz-skin--tech / --dao 会覆盖下方任意变量 */
  /* 普通 · 温暖树影：纸墨暖白 + 明快橄榄绿 */
  --gz-accent: #6D8B3F;
  --gz-accent-soft: rgba(109, 139, 63, 0.12);
  --gz-paper: #F4EFE4;
  --gz-paper-deep: #EDE6D6;
  --gz-surface: #FCFAF4;
  --gz-surface-2: #F2ECDD;
  --gz-input-bg: #F6F0E2;
  --gz-ink: #26231E;
  --gz-ink-2: #6B655B;
  --gz-ink-3: #9C9589;
  --gz-line: rgba(38, 35, 30, 0.10);
  --gz-line-soft: rgba(38, 35, 30, 0.05);
  --gz-cta-bg: #6D8B3F;
  --gz-on-cta: #FFFFFF;
  --gz-grad-to: #94A96C;
  --gz-radius-md: 20rpx;
  /* 等级卡专属色板（默认 = normal：暖白纸卡 + 橄榄，亮底深字） */
  --gz-rank-bg: #FCF9F0;
  --gz-rank-border: rgba(38, 35, 30, 0.09);
  --gz-rank-ink: #26231E;
  --gz-rank-sub: #6E675C;
  --gz-rank-track: rgba(38, 35, 30, 0.09);
  --gz-rank-shadow: 0 10rpx 30rpx rgba(38, 35, 30, 0.05);
  --gz-radius-lg: 32rpx;

  background-color: var(--gz-paper);
  color: var(--gz-ink);
  font-size: $gz-fs-body;
  line-height: 1.7;
  -webkit-font-smoothing: antialiased;
  transition: background-color 0.25s ease;
}

view,
text,
button,
input,
textarea {
  box-sizing: border-box;
}

/* 去掉按钮默认样式（我们全程手写视觉） */
button {
  padding: 0;
  margin: 0;
  background: transparent;
  line-height: inherit;
  border-radius: 0;
  font-size: inherit;

  &::after {
    border: none;
  }
}

/* 通用按压反馈：配合 hover-class="gz-hover" 使用（微信小程序 hover 类需全局定义） */
.gz-hover {
  opacity: 0.72;
  transition: opacity 0.2s ease;
}

/* ---------- 三套皮肤 CSS 变量 ---------- */
/* 用类名挂在页面根 view：<view class="page gz-skin gz-skin--tech"> */
.gz-skin {
  min-height: 100vh;
  background-color: var(--gz-paper);
  color: var(--gz-ink);
  transition: background-color 0.25s ease, color 0.25s ease;
}

.gz-skin--normal {
  /* 普通 · 晨光纸：顶部一片极淡的橄榄晨光，像树影间漏下的光，让暖白不呆板 */
  background-image: linear-gradient(180deg, rgba(148, 169, 108, 0.12) 0%, rgba(148, 169, 108, 0) 62%);
}

.gz-skin--tech {
  /* 科技 · 夜间实验室：极暗蓝黑 + 电光蓝，锐利圆角 */
  --gz-accent: #3FA9FF;
  --gz-accent-soft: rgba(63, 169, 255, 0.16);
  --gz-paper: #0D1117;
  --gz-paper-deep: #151B24;
  --gz-surface: #141C27;
  --gz-surface-2: #10161F;
  --gz-input-bg: #1A2431;
  --gz-ink: #E6EDF5;
  --gz-ink-2: #9AA7B8;
  --gz-ink-3: #5F6E84;
  --gz-line: rgba(230, 237, 245, 0.12);
  --gz-line-soft: rgba(230, 237, 245, 0.06);
  --gz-cta-bg: #2E90FF;
  --gz-on-cta: #FFFFFF;
  --gz-grad-to: #3FC8FF;
  --gz-radius-md: 12rpx;
  --gz-radius-lg: 18rpx;
  /* 等级卡 · 科技：终端深卡 + 电光蓝描边（亮色卡片在深空页面会刺眼，故保留深底） */
  --gz-rank-bg: #141C27;
  --gz-rank-border: rgba(63, 169, 255, 0.22);
  --gz-rank-ink: #EAF1F9;
  --gz-rank-sub: #9AA7B8;
  --gz-rank-track: rgba(234, 241, 249, 0.12);
  --gz-rank-shadow: 0 14rpx 40rpx rgba(0, 0, 0, 0.4), 0 0 0 1rpx rgba(63, 169, 255, 0.08);
  /* 全站背景氛围：电路网格 + 右上角一束电光辉光 */
  background-image:
    linear-gradient(225deg, rgba(63, 169, 255, 0.16) 0%, rgba(63, 169, 255, 0) 58%),
    linear-gradient(rgba(148, 197, 255, 0.045) 1rpx, transparent 1rpx),
    linear-gradient(90deg, rgba(148, 197, 255, 0.032) 1rpx, transparent 1rpx);
  background-size: auto, 72rpx 72rpx, 72rpx 72rpx;
  background-position: 0 0, 0 0, 0 0;
}

.gz-skin--dao {
  /* 修仙 · 水墨仙山：旧纸黄底（明显区别于普通暖白）+ 朱砂印章，墨线描边 */
  --gz-accent: #A4471F;
  --gz-accent-soft: rgba(164, 71, 31, 0.14);
  --gz-paper: #E7DFC9;
  --gz-paper-deep: #DCD0B3;
  --gz-surface: #F5EEDC;
  --gz-surface-2: #E9DFC4;
  --gz-input-bg: #EFE7D0;
  --gz-ink: #2A251E;
  --gz-ink-2: #6E6759;
  --gz-ink-3: #9C9381;
  --gz-line: rgba(42, 37, 30, 0.16);
  --gz-line-soft: rgba(42, 37, 30, 0.07);
  --gz-cta-bg: #A4471F;
  --gz-on-cta: #FBF6EA;
  --gz-grad-to: #C4602E;
  --gz-radius-md: 16rpx;
  --gz-radius-lg: 24rpx;
  /* 等级卡 · 修仙：宣纸卡 + 朱砂印（比墨底卡更有“卷轴记功”的轻仪式感） */
  --gz-rank-bg: #F7F1E0;
  --gz-rank-border: rgba(42, 37, 30, 0.15);
  --gz-rank-ink: #2A251E;
  --gz-rank-sub: #6E6759;
  --gz-rank-track: rgba(42, 37, 30, 0.11);
  --gz-rank-shadow: 0 10rpx 28rpx rgba(42, 37, 30, 0.12);
  /* 旧纸做旧感：纸面自上而下微微加深，像岁月浸染 */
  background-image: linear-gradient(180deg, #EAE2CC 0%, var(--gz-paper) 45%, #E2D8BF 100%);
}
</style>
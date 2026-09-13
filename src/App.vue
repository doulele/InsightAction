<script setup lang="ts">
import { onLaunch } from '@dcloudio/uni-app'
import { watch } from 'vue'
import { useAppStore } from '@/stores/app'
import { useModeStore } from '@/stores/mode'
import { useRemoteStore } from '@/stores/remote'
import { useContentStore } from '@/stores/content'
import { applySkin } from '@/utils/skin'
import { initUpdateManager } from '@/utils/update'
import { autoBackupIfDue } from '@/utils/cloudBackup'
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

  // 云备份自动触发（仅在你开启过云备份之后生效）：
  // 距上次备份超过 24 小时才跑，服务端还有缩水保护兜底；失败静默，不打扰启动。
  setTimeout(() => void autoBackupIfDue(), 3000)

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

/* ---------- C3 · 模式专属微动效 ----------
 * 一个类 `.gz-motion` 挂在关键元素上，具体动画由当前皮肤决定：
 *   普通 · 盖印   —— 元素像印章落下（一次性，不循环）
 *   科技 · 扫描线 —— 周期性细线扫过（用 ::after 画，不占布局）
 *   修仙 · 呼吸   —— 极轻的光晕呼吸（循环，不抢内容）
 * 只用 transform / opacity / box-shadow，不触发重排；动效都刻意做得轻，
 * 避免在"专注"这件事上反而制造噪音。
 */
@keyframes gz-stamp {
  0% {
    opacity: 0;
    transform: scale(1.1) translateY(-8rpx);
  }
  60% {
    opacity: 1;
  }
  100% {
    opacity: 1;
    transform: scale(1) translateY(0);
  }
}

@keyframes gz-scan {
  0% {
    transform: translateY(-110%);
    opacity: 0;
  }
  15% {
    opacity: 0.85;
  }
  60% {
    opacity: 0.5;
  }
  100% {
    transform: translateY(330%);
    opacity: 0;
  }
}

@keyframes gz-halo {
  0%,
  100% {
    box-shadow: 0 0 0 0 var(--gz-accent-soft);
  }
  50% {
    box-shadow: 0 0 26rpx 6rpx var(--gz-accent-soft);
  }
}

/* 普通：温润盖印（落到位即停） */
.gz-skin--normal .gz-motion {
  animation: gz-stamp 0.52s cubic-bezier(0.2, 0.85, 0.3, 1) both;
}

/* 科技：扫描线（相对定位 + 裁切，线条不溢出容器） */
.gz-skin--tech .gz-motion {
  position: relative;
  overflow: hidden;

  &::after {
    content: '';
    position: absolute;
    left: 0;
    right: 0;
    top: 0;
    height: 42%;
    pointer-events: none;
    background: linear-gradient(180deg, transparent, var(--gz-accent-soft), transparent);
    animation: gz-scan 5.6s cubic-bezier(0.4, 0, 0.6, 1) infinite;
  }
}

/* 修仙：呼吸光晕 */
.gz-skin--dao .gz-motion {
  animation: gz-halo 4.8s ease-in-out infinite;
}

/* 通用按压反馈：配合 hover-class="gz-hover" 使用（微信小程序 hover 类需全局定义） */
.gz-hover {
  opacity: 0.72;
  transition: opacity 0.2s ease;
}

/* ---------- 三套皮肤 CSS 变量 ---------- */
/**
 * 用类名挂在**页面根 view**：<view class="page gz-skin gz-skin--tech">。
 *
 * ⚠️ 这个类自带 `min-height: 100vh`（页面要铺满一屏）。它是个全局类，
 * 任何**非页面根节点**（卡片、弹框面板…）为了取皮肤变量而挂上它时，
 * 必须自己 `min-height: 0` 清零 —— 否则会被静默地撑成一屏高。
 * 更坑的是 CSS 规则「min-height > max-height 时 min 胜」，
 * 所以连"加个 max-height 兜住"都拦不住它（GzDialog 踩过这个坑，见其 `.gd` 注释）。
 */
.gz-skin {
  min-height: 100vh;
  background-color: var(--gz-paper);
  color: var(--gz-ink);
  transition: background-color 0.25s ease, color 0.25s ease;
}

/**
 * 普通 · 手账纸
 * 材质 = 纸 + 帘纹：手工纸在抄纸时留下的竖密横疏细纹（帘纹），
 * 加上顶部一片极淡的橄榄晨光。目标是"翻开一本本子"的手感，
 * 而不是纯色背景 —— 但强度压到几乎察觉不到，只负责让暖白不呆板。
 */
.gz-skin--normal {
  background-image:
    /* 帘纹 · 竖（密） */
    repeating-linear-gradient(
      90deg,
      rgba(38, 35, 30, 0.026) 0,
      rgba(38, 35, 30, 0.026) 1rpx,
      transparent 1rpx,
      transparent 10rpx
    ),
    /* 帘纹 · 横（疏） */
    repeating-linear-gradient(
      0deg,
      rgba(38, 35, 30, 0.015) 0,
      rgba(38, 35, 30, 0.015) 1rpx,
      transparent 1rpx,
      transparent 14rpx
    ),
    /* 顶部晨光（树影间漏下的光） */
    linear-gradient(180deg, rgba(148, 169, 108, 0.14) 0%, rgba(148, 169, 108, 0) 58%);
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
  /* 全站背景氛围：双密度网格（仪表盘）+ 右上辉光 + 底部地平光 */
  /* 两级网格是关键：粗网格给"结构"，细网格给"仪器刻度感"，比单一网格更像实验室 */
  background-image:
    /* 底部地平光（像屏幕下方的环境光） */
    linear-gradient(0deg, rgba(63, 169, 255, 0.07) 0%, rgba(63, 169, 255, 0) 38%),
    /* 右上角一束电光辉光 */
    linear-gradient(225deg, rgba(63, 169, 255, 0.18) 0%, rgba(63, 169, 255, 0) 54%),
    /* 粗网格 72rpx */
    linear-gradient(rgba(148, 197, 255, 0.05) 1rpx, transparent 1rpx),
    linear-gradient(90deg, rgba(148, 197, 255, 0.036) 1rpx, transparent 1rpx),
    /* 细网格 24rpx（刻度） */
    linear-gradient(rgba(148, 197, 255, 0.018) 1rpx, transparent 1rpx),
    linear-gradient(90deg, rgba(148, 197, 255, 0.012) 1rpx, transparent 1rpx);
  background-size: auto, auto, 72rpx 72rpx, 72rpx 72rpx, 24rpx 24rpx, 24rpx 24rpx;
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
  /**
   * 修仙 · 宣纸水墨
   * 材质 = 宣纸（双向纤维）+ 纸上未干的一痕墨（右下墨晕）+ 左上一点水色 + 纸面渐深。
   * 与普通的区别在"纤维走向"：普通是抄纸的**帘纹**（正交细线），
   * 这里是宣纸的**斜向纤维**，加上墨晕，所以两张纸一眼能分清。
   */
  background-image:
    /* 宣纸纤维 · 斜向一 */
    repeating-linear-gradient(
      45deg,
      rgba(42, 37, 30, 0.022) 0,
      rgba(42, 37, 30, 0.022) 1rpx,
      transparent 1rpx,
      transparent 9rpx
    ),
    /* 宣纸纤维 · 斜向二（交错，避免变成规则网纹） */
    repeating-linear-gradient(
      -45deg,
      rgba(42, 37, 30, 0.015) 0,
      rgba(42, 37, 30, 0.015) 1rpx,
      transparent 1rpx,
      transparent 13rpx
    ),
    /* 右下角墨晕（一痕淡墨，像纸上未干） */
    radial-gradient(120% 95% at 100% 100%, rgba(42, 37, 30, 0.075) 0%, rgba(42, 37, 30, 0) 56%),
    /* 左上角水色（极淡朱砂，呼应印章） */
    radial-gradient(85% 60% at 8% 0%, rgba(164, 71, 31, 0.05) 0%, rgba(164, 71, 31, 0) 60%),
    /* 底：纸面自上而下微微加深，像岁月浸染 */
    linear-gradient(180deg, #eae2cc 0%, var(--gz-paper) 45%, #e2d8bf 100%);
}
</style>
<template>
  <!--
    小枢 BuddyFloat · 批次 D 全局浮层
    - 右下角常驻小枢（形态随三模式：温和助手/数据分析师/护法灵兽）；
    - 到点激励：早间窗 06-08 / 晚间窗 21-23 首次进入时弹一次（同窗节流防骚扰）；
    - 入定到点：预设入定时段当前生效时弹「该去翻转沙漏」，每 10 分钟至多一次；
    - 展开面板：今日四维 + 缺维建议 + 打开今日日课卡。
  -->
  <view class="bf">
    <!-- 到点激励 / 入定到点 横幅（不遮内容，可点走） -->
    <view
      v-if="tip"
      class="bf__tip"
      :class="{ 'is-reminder': tip.kind === 'reminder' }"
      @click="tip.kind === 'reminder' ? goSandglass() : dismissTip()"
    >
      <text class="bf__tip-mark">{{ tip.kind === 'reminder' ? '时' : buddyGlyph }}</text>
      <view class="bf__tip-body">
        <text class="bf__tip-title">{{ tip.title }}</text>
        <text class="bf__tip-text">{{ tip.text }}</text>
      </view>
      <view class="bf__tip-act">
        {{ tip.kind === 'reminder' ? '现在去' : '知道了' }}
      </view>
      <view v-if="tip.kind !== 'reminder'" class="bf__tip-x" @click.stop="dismissTip">×</view>
    </view>

    <!-- 展开面板 -->
    <view v-if="open" class="bf__mask" @click="close" />
    <view v-if="open" class="bf__panel">
      <view class="bf__panel-head">
        <view class="bf__orb">
          <text class="bf__orb-glyph">{{ buddyGlyph }}</text>
        </view>
        <view class="bf__panel-id">
          <text class="bf__panel-name">{{ assistantName }}</text>
          <text class="bf__panel-mode">{{ modeLabel }}模式 · 今日已点亮 {{ litCount }}/4 维</text>
        </view>
        <view class="bf__close" hover-class="gz-hover" @click="close">×</view>
      </view>

      <text class="bf__panel-greet">{{ greeting }}</text>
      <view class="bf__greet-fav" hover-class="gz-hover" @click="favGreeting">收藏这句</view>

      <view class="bf__dims">
        <view v-for="d in dims" :key="d.key" class="bf__dim">
          <view class="bf__dim-line">
            <view class="bf__dim-dot" :class="{ 'is-on': d.on }" :style="d.on ? { background: d.color } : {}" />
            <text class="bf__dim-label">{{ d.label }}</text>
            <text class="bf__dim-value" :class="{ 'is-dim': !d.on }">{{ d.value }}</text>
          </view>
        </view>
      </view>

      <view v-if="suggestion" class="bf__suggest">
        <text class="bf__suggest-label">小枢建议</text>
        <text class="bf__suggest-text">{{ suggestion }}</text>
      </view>

      <view class="bf__acts">
        <view class="bf__btn bf__btn--ghost" hover-class="gz-hover" @click="goMissing">
          {{ missingLabel || '四处逛逛' }}
        </view>
        <view class="bf__btn bf__btn--main" hover-class="gz-hover" @click="openDailyCard">
          今日日课卡
        </view>
      </view>
    </view>

    <!-- 悬浮球 -->
    <view
      v-if="!open"
      class="bf__fob"
      :class="{ 'has-tip': tip && tip.kind === 'reminder' }"
      hover-class="gz-hover"
      @click="open = true"
    >
      <view class="bf__fob-halo" />
      <text class="bf__fob-glyph">{{ buddyGlyph }}</text>
      <view v-if="reminderDue" class="bf__fob-dot" />
    </view>
  </view>
</template>

<script setup lang="ts">
/**
 * 小枢全局浮层（批次 D 前端）：
 * UI 薄壳 —— 所有状态与触发逻辑在 composables/useBuddy.ts（模块级单例），
 * 由宿主大厅页在自身 onShow 里调用 poke() 驱动（早/晚到点激励、入定到点、面板数据）。
 */
import { useBuddy } from '@/composables/useBuddy'

const {
  open,
  tip,
  due: reminderDue,
  buddyGlyph,
  assistantName,
  modeLabel,
  litCount,
  greeting,
  dims,
  suggestion,
  missingLabel,
  closePanel: close,
  dismissTip,
  goSandglass,
  goMissing,
  openDailyCard,
  favGreeting,
} = useBuddy()
</script>

<style lang="scss" scoped>
.bf {
  /* 本组件不占布局空间 */
}

/* ---- 到点激励横幅 ---- */
.bf__tip {
  position: fixed;
  right: 28rpx;
  bottom: 168rpx;
  left: 28rpx;
  z-index: 90;
  display: flex;
  align-items: center;
  gap: 18rpx;
  padding: 20rpx 22rpx;
  border-radius: $gz-radius-lg;
  background: var(--gz-surface);
  border: 1rpx solid var(--gz-line);
  box-shadow: 0 18rpx 56rpx rgba(0, 0, 0, 0.16);
  animation: bf-rise 0.28s ease;
}

.bf__tip.is-reminder {
  border-color: var(--gz-accent);
}

@keyframes bf-rise {
  from {
    transform: translateY(24rpx);
    opacity: 0;
  }
  to {
    transform: translateY(0);
    opacity: 1;
  }
}

.bf__tip-mark {
  flex: none;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 64rpx;
  height: 64rpx;
  border-radius: 50%;
  background: var(--gz-accent-soft);
  color: var(--gz-accent);
  font-size: 32rpx;
  font-weight: 800;
}

.bf__tip-body {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
}

.bf__tip-title {
  font-size: $gz-fs-body;
  font-weight: 700;
  color: var(--gz-ink);
}

.bf__tip-text {
  margin-top: 4rpx;
  font-size: $gz-fs-caption;
  line-height: 1.6;
  color: var(--gz-ink-2);
}

.bf__tip-act {
  flex: none;
  padding: 12rpx 24rpx;
  border-radius: 999rpx;
  background: var(--gz-accent);
  color: var(--gz-on-cta);
  font-size: $gz-fs-small;
  font-weight: 600;
}

.bf__tip-x {
  flex: none;
  width: 44rpx;
  height: 44rpx;
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--gz-ink-3);
  font-size: 32rpx;
}

/* ---- 悬浮球 ---- */
.bf__fob {
  position: fixed;
  right: 28rpx;
  bottom: 40rpx;
  z-index: 80;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 108rpx;
  height: 108rpx;
  border-radius: 50%;
  background: linear-gradient(145deg, var(--gz-grad-to) 0%, var(--gz-accent) 68%);
  box-shadow: 0 16rpx 40rpx rgba(0, 0, 0, 0.22), 0 0 0 1rpx rgba(255, 255, 255, 0.14);
}

.bf__fob-halo {
  position: absolute;
  inset: -8rpx;
  border-radius: 50%;
  border: 1rpx solid var(--gz-accent-soft);
  animation: bf-breathe 3.2s ease-in-out infinite;
}

@keyframes bf-breathe {
  0%,
  100% {
    transform: scale(1);
    opacity: 0.5;
  }
  50% {
    transform: scale(1.14);
    opacity: 0.9;
  }
}

.bf__fob-glyph {
  position: relative;
  color: #fff;
  font-size: 44rpx;
  font-weight: 800;
  letter-spacing: 0.04em;
}

.bf__fob-dot {
  position: absolute;
  top: 6rpx;
  right: 6rpx;
  width: 22rpx;
  height: 22rpx;
  border-radius: 50%;
  background: #e04f3f;
  border: 3rpx solid var(--gz-surface);
}

/* ---- 展开面板 ---- */
.bf__mask {
  position: fixed;
  inset: 0;
  z-index: 95;
  background: rgba(0, 0, 0, 0.3);
}

.bf__panel {
  position: fixed;
  right: 20rpx;
  bottom: 170rpx;
  left: 20rpx;
  z-index: 96;
  padding: 30rpx 28rpx 28rpx;
  border-radius: $gz-radius-lg;
  background: var(--gz-surface);
  border: 1rpx solid var(--gz-line);
  box-shadow: 0 24rpx 80rpx rgba(0, 0, 0, 0.24);
  animation: bf-rise 0.24s ease;
}

.bf__panel-head {
  display: flex;
  align-items: center;
  gap: 18rpx;
}

.bf__orb {
  flex: none;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 76rpx;
  height: 76rpx;
  border-radius: 50%;
  background: linear-gradient(145deg, var(--gz-grad-to) 0%, var(--gz-accent) 70%);
}

.bf__orb-glyph {
  color: #fff;
  font-size: 34rpx;
  font-weight: 800;
}

.bf__panel-id {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
}

.bf__panel-name {
  font-size: 36rpx;
  font-weight: 800;
  letter-spacing: 0.04em;
  color: var(--gz-ink);
}

.bf__panel-mode {
  margin-top: 2rpx;
  font-size: $gz-fs-caption;
  color: var(--gz-ink-3);
}

.bf__close {
  flex: none;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 52rpx;
  height: 52rpx;
  border-radius: 50%;
  border: 1rpx solid var(--gz-line);
  color: var(--gz-ink-2);
  font-size: 36rpx;
  line-height: 1;
}

.bf__panel-greet {
  display: block;
  margin-top: 20rpx;
  font-size: $gz-fs-body;
  line-height: 1.7;
  color: var(--gz-ink-2);
}

.bf__greet-fav {
  display: inline-flex;
  margin-top: 8rpx;
  padding: 4rpx 2rpx;
  font-size: $gz-fs-caption;
  color: var(--gz-accent);
}

.bf__dims {
  margin-top: 22rpx;
  display: flex;
  flex-direction: column;
  gap: 16rpx;
}

.bf__dim-line {
  display: flex;
  align-items: center;
  gap: 16rpx;
}

.bf__dim-dot {
  flex: none;
  width: 16rpx;
  height: 16rpx;
  border-radius: 50%;
  background: var(--gz-line);
}

.bf__dim-dot.is-on {
  box-shadow: 0 0 0 6rpx var(--gz-accent-soft);
}

.bf__dim-label {
  flex: none;
  width: 160rpx;
  font-size: $gz-fs-body;
  color: var(--gz-ink);
}

.bf__dim-value {
  font-size: $gz-fs-body;
  font-weight: 700;
  color: var(--gz-accent);
  font-variant-numeric: tabular-nums;
}

.bf__dim-value.is-dim {
  color: var(--gz-ink-3);
  font-weight: 400;
}

.bf__suggest {
  margin-top: 22rpx;
  padding: 18rpx 20rpx;
  border-radius: $gz-radius-md;
  background: var(--gz-accent-soft);
}

.bf__suggest-label {
  display: block;
  font-size: $gz-fs-caption;
  letter-spacing: 0.1em;
  color: var(--gz-accent);
}

.bf__suggest-text {
  display: block;
  margin-top: 4rpx;
  font-size: $gz-fs-small;
  line-height: 1.7;
  color: var(--gz-ink-2);
}

.bf__acts {
  margin-top: 24rpx;
  display: flex;
  gap: 16rpx;
}

.bf__btn {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  height: 84rpx;
  border-radius: $gz-radius-md;
  font-size: $gz-fs-body;
  font-weight: 600;
}

.bf__btn--ghost {
  border: 1rpx solid var(--gz-line);
  color: var(--gz-ink-2);
}

.bf__btn--main {
  background: var(--gz-accent);
  color: var(--gz-on-cta);
}
</style>

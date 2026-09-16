<template>
  <!--
    与 GzDialog 同一套结构：遮罩 flex 居中 + 面板自己管高度。
    面板挂 `gz-skin` 取皮肤变量，因此**必须**在样式里 min-height: 0
    （全局 `.gz-skin { min-height: 100vh }` 会把面板顶成一屏高，见 PrivacyGate.scss 的注）。
    touchmove 拦截只挂遮罩：面板自己的 max-height + 内部滚动要能工作。
  -->
  <view v-if="privacyPending" class="pg-mask" @touchmove.stop.prevent @click="decline">
    <view class="pg" :class="skinClass" @click.stop>
      <text class="pg__title">需要你的同意</text>
      <text class="pg__body">
        这一步要用到「剪贴板 / 你选的文件 / 头像昵称 / 微信运动步数」。这些内容只在你自己的手机上流转，
        步数也只会留在本机 —— 继续之前，请先看过隐私保护指引。
      </text>

      <view class="pg__acts">
        <view class="pg__ghost" hover-class="gz-hover" @click="decline">暂不使用</view>
        <!-- #ifdef MP-WEIXIN -->
        <!-- 「同意」必须是原生 open-type=agreePrivacyAuthorization 的按钮：微信用它做合规留痕 -->
        <button
          id="agree-btn"
          class="pg__agree"
          open-type="agreePrivacyAuthorization"
          hover-class="none"
          @agreeprivacyauthorization="agree"
        >
          同意并继续
        </button>
        <!-- #endif -->
        <!-- #ifndef MP-WEIXIN -->
        <view class="pg__agree" hover-class="gz-hover" @click="agree">同意并继续</view>
        <!-- #endif -->
      </view>

      <text class="pg__link" @click="readContract">查看《隐私保护指引》全文 →</text>
    </view>
  </view>
</template>

<script setup lang="ts">
/**
 * PrivacyGate —— 隐私保护指引的同意弹窗（easycom 自动注册）。
 * =====================================
 *
 * 为什么需要它：manifest 开了 __usePrivacyCheck__，后台隐私保护指引生效后，
 * 剪贴板 / 选文件 / 头像昵称 / 微信运动步数这四类接口在用户同意前会被微信直接拦掉。
 * 挂在所有会碰到这些接口的页面上，拦截发生时由 utils/privacy 点亮这里，
 * 用户点「同意」即放行 —— 微信会自动补上刚才被拦的那次调用（不用再点第二次复制）。
 *
 * 挂在哪些页面：见 utils/privacy.ts 的说明。挂载成本是一行 `<PrivacyGate />`。
 */
import { computed } from 'vue'
import { useModeStore } from '@/stores/mode'
import { openPrivacyContract, privacyPending, settlePrivacy } from '@/utils/privacy'

const modeStore = useModeStore()
const skinClass = computed(() => `gz-skin gz-skin--${modeStore.id}`)

function agree(): void {
  settlePrivacy(true)
}

function decline(): void {
  settlePrivacy(false)
}

function readContract(): void {
  openPrivacyContract()
}
</script>

<style lang="scss" scoped>
@import './PrivacyGate.scss';
</style>

<template>
  <!-- 公告：随当前皮肤的主题弹框（懒显示，无公告时组件不渲染任何东西） -->
  <GzDialog
    :show="!!remote.activeNotice"
    :skin="modeStore.id"
    :title="remote.activeNotice?.title || ''"
    :content="remote.activeNotice?.body || ''"
    :confirm-text="remote.activeNotice?.level === 'warn' ? '知道了' : '好'"
    :show-cancel="false"
    @confirm="remote.closeNotice()"
    @cancel="remote.closeNotice()"
  />

  <!-- 版本更新：强制时不可取消、不可点遮罩关闭 -->
  <GzDialog
    :show="!!remote.activeUpdate"
    :skin="modeStore.id"
    title="发现新版本"
    :content="updateContent"
    :note="remote.activeUpdate?.note || ''"
    :confirm-text="remote.activeUpdate?.force ? '立即更新' : '重启生效'"
    cancel-text="稍后"
    :show-cancel="!remote.activeUpdate?.force"
    :mask-closable="!remote.activeUpdate?.force"
    @confirm="onUpdateConfirm"
    @cancel="remote.closeUpdate()"
  />
</template>

<script setup lang="ts">
/**
 * 远端提示层：公告 + 版本更新。
 *
 * 与 BuddyFloat 同一挂载模式（挂在各 tab 页），但展示态由 useRemoteStore 统一分发 ——
 * 这样多个实例不会各弹一次，切换 tab 也不会重复弹。
 * 纯展示：只消费下行配置，不产生任何上行数据。
 */
import { computed, watch } from 'vue'
import { useRemoteStore } from '@/stores/remote'
import { useModeStore } from '@/stores/mode'
import { applyUpdateNow, updateReady } from '@/utils/update'
import { getRunningVersion } from '@/utils/version'

const remote = useRemoteStore()
const modeStore = useModeStore()

const updateContent = computed(() => {
  const p = remote.activeUpdate
  if (!p) return ''
  if (p.force) {
    // 版本号只有正式版取得到（开发版/体验版为空）→ 文案要能兜住空值
    const running = getRunningVersion()
    return running
      ? `版本 ${running} 已不再支持，请更新到 ${p.version} 后继续使用。`
      : `当前版本已不再支持，请更新到 ${p.version} 后继续使用。`
  }
  return p.version
    ? `新版本 ${p.version} 已经准备好，重启后即可生效。`
    : '新版本已经准备好，重启后即可生效。'
})

/**
 * 判定该不该弹。
 * 配置是异步拉取的，所以不能只在 onMounted 判一次：
 * 用 watch(loaded) 在配置到货时补判（immediate 保证「进页面时配置已到」的情况也能判到）。
 */
function evaluate(): void {
  remote.shouldShowUpdate(getRunningVersion(), updateReady.value)
  remote.shouldShowNotice()
}

watch(
  () => remote.loaded,
  (v) => {
    if (v) evaluate()
  },
  { immediate: true },
)

/** 微信在后台把新包下载完时也补判一次（此时配置通常早已到达） */
watch(updateReady, (v) => {
  if (v) evaluate()
})

function onUpdateConfirm(): void {
  // applyUpdate 会立即重启小程序，成功就无需再处理 UI
  if (applyUpdateNow()) return

  // 还没拿到新包（例如强制更新但后台尚未下载完）：引导用户手动重进
  remote.closeUpdate()
  uni.showModal({
    title: '暂未获取到新版本',
    content: '请关闭小程序后重新进入；若仍提示更新，请删除小程序后再重新打开。',
    showCancel: false,
  })
}
</script>

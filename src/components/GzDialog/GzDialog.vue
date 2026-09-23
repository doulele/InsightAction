<template>
  <view v-if="show" class="gd-mask" :style="{ zIndex }" @touchmove.stop.prevent @click="onMaskTap">
    <view class="gd__holder">
      <!-- 皮肤类挂面板：随当前模式 / 目标模式整套换 CSS 变量（accent/surface/圆角…） -->
      <view
        class="gd"
        :class="[skinClass, { 'is-danger': variant === 'danger' }]"
        @click.stop
      >
        <image
          v-if="banner && artSrc && variant !== 'danger'"
          class="gd__art"
          :src="artSrc"
          mode="aspectFill"
          @error="onArtError"
        />
        <view v-else-if="banner && variant !== 'danger'" class="gd__art gd__art--fallback" />
        <view class="gd__body">
          <text v-if="title" class="gd__title">{{ title }}</text>
          <text v-if="subtitle" class="gd__sub">{{ subtitle }}</text>
          <!-- 优先自定义插槽；未提供则按 props 文案渲染 -->
          <view v-if="$slots.default" class="gd__slot">
            <slot />
          </view>
          <template v-else>
            <text v-if="content" class="gd__content">{{ content }}</text>
            <view v-if="note" class="gd__note">{{ note }}</view>
          </template>
          <!--
            输入模式（2026-09-23）：替代原生 `uni.showModal({ editable: true })`。
            原生那条路有两个固定毛病：① 面板永远是白的，不跟皮肤；
            ② `content` 会被当成输入框的**初始值** —— 调用方为了说明写的那句话，
            用户得先手动删掉才能写字（用户截图报的就是这个）。
            这里把说明留在 content / note 里当正文，输入框自己只带 placeholder。
          -->
          <textarea
            v-if="input && multiline"
            v-model="val"
            class="gd__input gd__input--area"
            :placeholder="placeholder"
            placeholder-class="gd__ph"
            :maxlength="maxlength"
            auto-height
          />
          <input
            v-else-if="input"
            v-model="val"
            class="gd__input"
            :type="inputType"
            :placeholder="placeholder"
            placeholder-class="gd__ph"
            :maxlength="maxlength"
            confirm-type="done"
          />
        </view>
        <view class="gd__acts">
          <view
            v-if="showCancel"
            class="gd__btn is-ghost"
            hover-class="gz-hover-btn"
            @click="close(false)"
          >
            {{ cancelText }}
          </view>
          <view class="gd__btn is-main" hover-class="gz-hover-btn" @click="onConfirm">
            {{ confirmText }}
          </view>
        </view>
      </view>
    </view>
  </view>
</template>

<script setup lang="ts">
/**
 * GzDialog —— 通用主题弹框
 * =====================================
 * 三模式共用一个组件：面板把 `gz-skin gz-skin--<mode>` 挂在自身，
 * 因此主色 / 纸底 / 文字 / 圆角等整套随「当前模式」或传入的「目标模式」(skin) 变化；
 * 覆盖各处原生 uni.showModal，保证任意确认场景都跟随皮肤。
 *
 * 用法（easycom 自动注册，无需 import）：
 *   <GzDialog
 *     v-model:show="open"
 *     :skin="pendingMode ?? modeStore.id"   // 预览目标模式皮肤时可传
 *     variant="danger"                        // danger：主按钮/提示块转语义红
 *     title="重置今日三件事"
 *     content="……"
 *     note="……"
 *     cancel-text="再想想"
 *     confirm-text="重置"
 *     @confirm="onConfirm"
 *   />
 *   @confirm：点主按钮触发（由调用方执行动作并自行关闭）
 *   @cancel / 遮罩点击 / @update:show=false：取消路径
 *
 * 横幅图（art）**不用每个调用方都传**：缺省自动取当前模式的主题图；
 * 只有换肤确认这类「要预览另一个模式」的场景才显式传目标模式的图。
 *
 * 输入模式（2026-09-23 新增，替代原生 editable 弹框）：
 *   <GzDialog
 *     v-model:show="askOpen"
 *     :input="true"
 *     title="凝练成一句"
 *     content="把它压成一句你能带走的话（24 字以内）。"   // 说明留在正文里
 *     placeholder="如：拖延不是懒，是那件事太大"          // 占位是**示例**，不是要用户删掉的话
 *     :maxlength="24"
 *     confirm-text="收下"
 *     @confirm="onLine"        // onLine(value: string)
 *     @cancel="askOpen = false"
 *   />
 *   要点：① 说明（content）与输入（placeholder / 输入框）**分开**，
 *   原生弹框把说明塞进输入框初始值、用户得删一遍，就是这次要修的病；
 *   ② 写一段话用 `:multiline="true"`（textarea，自动长高）；
 *   ③ 输入类弹框建议 `:banner="false"`：键盘弹起时面板越矮越好用。
 */
import { computed, ref, watch } from 'vue'
import { useModeStore } from '@/stores/mode'
import { useImageStore } from '@/stores/images'
import type { ModeId } from '@/config/modes'

interface Props {
  /** 是否显示（受控） */
  show: boolean
  /** 皮肤跟随：缺省 = 当前模式；传目标模式可预览切换后的主题 */
  skin?: ModeId
  /** 语义变体：danger 用于破坏性操作（删除/重置），确认键固定语义红 */
  variant?: 'default' | 'danger'
  /**
   * 顶部横幅图。**缺省 = 当前模式的主题横幅**（组件自己去 modeStore 取）；
   * 只有「预览切换后的模式」才需要显式传目标模式的图（见 settings / me 的换肤确认）。
   * danger 变体自动忽略。
   */
  art?: string
  title?: string
  /** 标题下小标 */
  subtitle?: string
  /** 正文（未提供默认插槽时生效） */
  content?: string
  /** 正文下的强调块（浅主色底） */
  note?: string
  cancelText?: string
  confirmText?: string
  showCancel?: boolean
  /** 点遮罩 = 取消 */
  maskClosable?: boolean
  /**
   * 是否显示顶部装饰横幅（远程横幅图 / 主题兜底饰带）。
   * 信息说明类弹框建议关掉：省下 240rpx，面板更紧凑，不会显得"占满屏幕"。
   */
  banner?: boolean
  zIndex?: number
  /**
   * 输入模式：正文区渲染一个输入框（替代原生 editable 弹框）。
   * 输入文本随 `@confirm` 第一个参数回传；缺省 false 时行为与以前完全一致。
   */
  input?: boolean
  /**
   * 输入框占位文案（input=true 时生效）。
   * 原生弹框时代写在 `content` 里的"那句话"要搬到这里 —— 写进 content 会被当成初始值。
   */
  placeholder?: string
  /** 输入框初始值（编辑已有内容时用，如「现在是：「…」」那种） */
  defaultValue?: string
  /** 输入字数上限（缺省 140） */
  maxlength?: number
  /** 多行输入（textarea）：写一段话时用；短标题 / 一句话用默认的单行输入 */
  multiline?: boolean
  /** 单行输入的键盘类型：填数字（如"守住多少天"）用 `number` */
  inputType?: 'text' | 'number'
}

const props = withDefaults(defineProps<Props>(), {
  variant: 'default',
  cancelText: '取消',
  confirmText: '确认',
  showCancel: true,
  maskClosable: true,
  banner: true,
  zIndex: 300,
  input: false,
  placeholder: '',
  defaultValue: '',
  maxlength: 140,
  multiline: false,
  inputType: 'text',
})

const emit = defineEmits<{
  (e: 'update:show', v: boolean): void
  /** 输入模式下带上输入框里的文本（没写字 = 空串）；非输入模式恒为空串 */
  (e: 'confirm', value: string): void
  (e: 'cancel'): void
}>()

const modeStore = useModeStore()
const skinClass = computed(() => `gz-skin gz-skin--${props.skin ?? modeStore.id}`)

/**
 * 横幅图源：显式传入的优先，**没传就用当前模式的图**。
 *
 * 为什么要有这层兜底：横幅图必须走 `modeStore.art`（后端 /skins 下发 + 本地缓存，
 * 见 HallHead 的同款注释），早先每个调用方各自传一遍，漏传就静默退回渐变饰带 ——
 * 表现是「这个弹框看起来没加载出主题图」，而代码不报错、极难被发现
 * （2026-09-21 设置页「开启云备份」与盲盒「换一只」两处即如此）。
 * 兜底后调用方只在「预览别的模式」时才需要传 art，其余一律自动跟随当前模式。
 */
const artSrc = computed(() => props.art ?? modeStore.art)

/**
 * 横幅读不出来（本地缓存被系统清掉 / 开发者工具里本地文件失效）→ 作废这条缓存。
 * 作废后 `artSrc` 自动回落到**远端地址**（弹框照常出图），且缓存层自带 5 分钟冷却，
 * 不会「报错 → 重下 → 再报错」打转。与 HallHead 同一套自愈
 * （2026-09-16 立的口径：凡是渲染本地图的 `<image>` 都要有 @error 自愈）。
 */
function onArtError(): void {
  useImageStore().invalidate(modeStore.remoteArtOf(props.skin ?? modeStore.id))
}

function close(isMask: boolean): void {
  if (isMask && !props.maskClosable) return
  emit('update:show', false)
  emit('cancel')
}

function onMaskTap(): void {
  close(true)
}

/**
 * 输入框的值：每次**弹出 / 换一问**时重置为 defaultValue。
 *
 * 组件实例在隐藏时并不会销毁（`v-if` 只包了遮罩那一层），不重置就会把上一次的输入带出来。
 * 指纹里带上 title 与 defaultValue 是有意的：问答链上（先问一句、确认后再问一句）
 * 两个框可能在同一个 tick 里一关一开 —— 只看 `show` 的话它是 false→true 被合并掉、
 * 重置不触发，新一问的框里会留着上一问的字。title / defaultValue 变了也重置，链条就干净了。
 */
const val = ref('')
const askFingerprint = computed(() => `${props.show}|${props.title ?? ''}|${props.defaultValue ?? ''}`)
watch(
  askFingerprint,
  () => {
    if (props.show) val.value = props.defaultValue ?? ''
  },
  { immediate: true },
)

function onConfirm(): void {
  emit('confirm', props.input ? val.value : '')
}
</script>

<style lang="scss" scoped>
@import './GzDialog.scss';
</style>

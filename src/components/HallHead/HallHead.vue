<template>
  <!--
    ⚠️ 皮肤类（gz-skin gz-skin--<模式>）挂在卡片**自己**身上，不能省：
    本组件是小程序自定义组件，其 wxss 只作用于组件内的节点 ——
    页面根节点上的 `.gz-skin--tech` 属于**组件外**的祖先，后代选择器选不中它。
    原先靠「页面根节点的皮肤类」来给图上文字配色 / 去掉压暗，结果科技模式下字仍是普通模式的
    浅黄绿、深色艺术画还被压着一层黑（2026-09-18 修）。详见 HallHead.scss 头部注释。
  -->
  <view class="hall-head" :class="[skinClass, { 'hall-head--with-cap': hasCap }]">
    <!--
      ⚠️ 必须走 modeStore.art（后端 /skins 下发 → 带版本号 → 命中本地缓存读盘），
      不能用 modeMeta.art：那是构建期变量 VITE_SKIN_BASE_URL 拼的静态地址，
      没配该变量时恒为 undefined ✗ → 图永远不出现（「观」页顶部空白就是这个原因）。
    -->
    <image v-if="modeStore.art" class="hall-head__art" :src="modeStore.art" mode="aspectFill" @error="onArtError" />
    <view class="hall-head__veil" />
    <view class="hall-head__body">
      <view class="hall-head__row">
        <!--
          印章位：默认是印章字；「我」大厅传 avatar 时这里直接显示头像（同一个位置、同一个尺寸）。
          有 action 时这一点也可点 —— 「点头像去起号 / 换头像」比只点右侧胶囊更符合直觉。
        -->
        <view
          class="hall-head__mark"
          :class="{ 'is-avatar': !!avatar }"
          :hover-class="action ? 'gz-hover' : 'none'"
          @click.stop="onMarkTap"
        >
          <image v-if="avatar" class="hall-head__avatar" :src="avatar" mode="aspectFill" />
          <text v-else>{{ mark }}</text>
        </view>
        <!-- 印章右侧一列：主标题（昵称）/ 英文定位 / 状态，按传入的渲染 -->
        <view class="hall-head__id">
          <text v-if="title" class="hall-head__name">{{ title }}</text>
          <text v-if="en" class="hall-head__en">{{ en }}</text>
          <text v-if="state" class="hall-head__state">{{ state }}</text>
        </view>
        <!-- 右侧动作（如「起号 ›」）：只有传了才出现 -->
        <text v-if="action" class="hall-head__action" hover-class="gz-hover" @click="emit('action')">
          {{ action }}
        </text>
      </view>

      <!-- 下半部：一句主张 + 关键数字（或「观」大厅的模式标签语），两者都空时整块不渲染 -->
      <view v-if="hasCap" class="hall-head__cap">
        <text v-if="capLabelText" class="hall-head__eyebrow">{{ capLabelText }}</text>
        <text v-if="capLineText" class="hall-head__quote">{{ capLineText }}</text>
        <view v-if="statList.length" class="hall-head__stats">
          <view v-for="s in statList" :key="s.label" class="hall-head__stat">
            <text class="hall-head__stat-value">{{ s.value }}</text>
            <text class="hall-head__stat-label">{{ s.label }}</text>
          </view>
        </view>
      </view>
    </view>
  </view>
</template>

<script setup lang="ts">
/**
 * HallHead —— 五个大厅页共用的「大厅头」（观 / 止 / 知 / 行 / 我）。
 * ============================================================
 *
 * 结构：当前模式的主题艺术画作背景 → 压暗层 veil → 文字层。
 * 文字层分上下两截：
 *   上截（必在）——「印章（或头像）+ 主标题 / 英文定位 /（可选）状态 +（可选）右侧动作」，
 *   下截（`capLabel` / `line` / `stats` 任一存在才渲染）—— 这块的主张与关键数字。
 *
 * 为什么值得抽成组件（2026-09-16）：五页原先各写一份「印章 + 英文 + 状态」，
 * 观页单独升级成"艺术画卡片"后与其余四页不是一套视觉，且压暗强度、图上文字配色
 * 都要按皮肤分别调 —— 五份复制等于以后每次调色要改五处。抽到这里后：
 *   · 配色/压暗只在本组件（HallHead.scss）里改；
 *   · 各页只传自己的印章字、定位与本页的"一句 + 数字"，模板里不再出现这些 class。
 *
 * 「我」大厅的名号（2026-09-16 合并）：原先首屏是「印章『我』+ 名号卡『我』」两个我，
 * 现在头像直接进印章位、昵称当主标题、右侧挂「起号 / 修改」—— 名号只有这一处。
 */
import { computed } from 'vue'
import { useModeStore } from '@/stores/mode'
import { useImageStore } from '@/stores/images'
import { useSkinClass } from '@/composables/useSkin'
import { getModeMeta } from '@/config/modes'

const props = withDefaults(
  defineProps<{
    /** 印章字（观 / 止 / 知 / 行 / 我）；传了 avatar 时它退居为无头像的兜底 */
    mark: string
    /** 头像地址：只有「我」大厅传，给了就占住印章位 */
    avatar?: string
    /** 印章右侧的主标题（「我」大厅放昵称）；与 `en` 可只用一个 */
    title?: string
    /** 英文定位行，例如 `INSIGHT · 观事 → 观理 → 观道` */
    en?: string
    /** 状态行（挂在主标题 / 定位下面） */
    state?: string
    /** 右侧动作文字（如「起号 ›」）：点击抛出 `action` 事件，由页面决定做什么 */
    action?: string
    /** 挂「今日修行 · 模式 + 模式标签语」，只有「观」大厅开 */
    showCap?: boolean
    /**
     * 下半部那句主张，文案来自各页的 `lexicon.hallLine()` / `config/dao.ts`。
     * **传了就用传进来的**（观页在这里放"我的道"），没传才回落到模式标签语。
     */
    line?: string
    /**
     * 覆盖小字行（观页有"我的道"时写成「今日修行 · 普通 · 我的道」）。
     * 空 = 走默认那句「今日修行 · 模式 · EN」。
     */
    capLabel?: string
    /** 关键数字：值走大字、标签走小字；**两三个为宜**，多了这块就散了 */
    stats?: Array<{ value: string; label: string }>
  }>(),
  { avatar: '', title: '', en: '', state: '', action: '', showCap: false, line: '' },
)

const emit = defineEmits<{ (e: 'action'): void }>()

/** 点印章 / 头像位：有 action 时才当作"入口"（「我」大厅用它起号 / 换头像） */
function onMarkTap(): void {
  if (props.action) emit('action')
}

const modeStore = useModeStore()
/**
 * 卡片自己的皮肤类（与 GzDialog / PrivacyGate 同一做法）：
 * 组件的 wxss 只作用于组件内节点，`--hh-*` 的字色与 veil 的压暗都按皮肤覆盖，
 * 这些覆盖规则的判据只能是"卡片自己带没带 gz-skin--xxx"。
 */
const skinClass = useSkinClass()
const meta = computed(() => getModeMeta(modeStore.id))

/**
 * 横幅读不出来（本地缓存被系统清掉 / 工具里本地文件失效）→ 作废这条缓存。
 *
 * 作废后 `modeStore.art` 会自动回落到**远端地址**（页面照常出图），
 * 缓存层自己也带 5 分钟冷却，不会「报错 → 重下 → 再报错」打转。
 */
function onArtError(): void {
  useImageStore().invalidate(modeStore.remoteArtOf(modeStore.id))
}

/** 数字行（归一成数组，模板里不用再判 undefined） */
const statList = computed(() => props.stats ?? [])

/** 小字行：默认「今日修行 · 模式 · EN」，观页有"我的道"时覆盖成「今日修行 · 模式 · 我的道」 */
const capLabelText = computed(
  () => props.capLabel || (props.showCap ? `今日修行 · ${meta.value.label} · ${meta.value.labelEn}` : ''),
)
/**
 * 那句主张。**优先用传进来的 `line`**（观页放"我的道"），没有才回落到模式标签语 ——
 * 模式标签语讲的是"这套表达语言什么气质"，道讲的是"你自己认的那条道理"，
 * 两种话同时只能站一个位置：叠起来就是同一块地方把话说两遍。
 */
const capLineText = computed(() => props.line || (props.showCap ? meta.value.tagline : ''))

/** 下半部有没有内容 —— 决定卡片走 250rpx（有下半部）还是 190rpx（只有印章行） */
const hasCap = computed(() => !!capLabelText.value || !!capLineText.value || statList.value.length > 0)
</script>

<style lang="scss" scoped>
@import './HallHead.scss';
</style>

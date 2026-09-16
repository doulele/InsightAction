<template>
  <!-- 答完：留着自己的回答，供下次回看（不再追问） -->
  <view v-if="done" class="probe is-done">
    <text class="probe__tag">已答 · 情境省察</text>
    <text class="probe__q">{{ q }}</text>
    <text class="probe__a">{{ rec?.answer }}</text>
  </view>

  <!-- 未答且今天没说过「先不写」：就地问一次 -->
  <view v-else-if="visible" class="probe">
    <text class="probe__tag">情境省察 · {{ sceneLabel }}</text>
    <text class="probe__q">{{ q }}</text>
    <textarea
      v-model="draft"
      class="probe__ta"
      :maxlength="120"
      placeholder="一句就够"
      placeholder-class="probe__ph"
      auto-height
    />
    <view class="probe__row">
      <text class="probe__skip" hover-class="gz-hover" @click="onSkip">先不写</text>
      <view class="probe__go" hover-class="gz-hover" @click="onSave">写下</view>
    </view>
    <text class="probe__note">答这句不占「每日一问」的额度 —— 那是一天一次，这个是这件事引出来的。</text>
  </view>
</template>

<script setup lang="ts">
/**
 * SceneProbe —— 情境化省察的就地一问（规格 v2 §4.3 省察轴）。
 *
 * 为什么不是新页面、也不是知大厅的常驻入口：
 *   §13.1 定案省察**不做常驻入口**（否则变成第二个每日待办），只跟在晚课后出现；
 *   情境化省察由事件触发，所以它应该**长在那件事的现场** —— 记完冲动、写破约原因、
 *   看完周报，就在那儿问一句，答完即走。
 *
 * 因此本组件只有两种可见状态：该问就问、答过就显示答案；说过「先不写」则整个隐身。
 * 样式外置在 SceneProbe.scss（按项目约定拆出）。
 */
import { computed, ref, watch } from 'vue'
import { useModeStore } from '@/stores/mode'
import { PROBE_SCENE_LABEL, useProbeStore, type ProbeScene } from '@/stores/probe'

/** 注意：prop 名用 anchor 而非 ref —— `ref` 在 Vue 模板里是保留属性（模板引用） */
const props = defineProps<{ scene: ProbeScene; anchor: string }>()

const probe = useProbeStore()
const mode = useModeStore()
const draft = ref('')

const q = computed(() => probe.questionOf(props.scene, mode.id))
const rec = computed(() => (props.anchor ? probe.of(props.anchor) : undefined))
const done = computed(() => Boolean(rec.value?.answer))
const visible = computed(
  () => Boolean(props.anchor) && !done.value && !probe.skippedToday(props.scene),
)
const sceneLabel = computed(() => PROBE_SCENE_LABEL[props.scene])

watch(
  () => props.anchor,
  () => {
    draft.value = ''
  },
)

function onSave(): void {
  if (!draft.value.trim()) {
    uni.showToast({ title: '写一句吧，一句就够', icon: 'none' })
    return
  }
  if (probe.answer(props.scene, props.anchor, draft.value, mode.id)) {
    draft.value = ''
    uni.showToast({ title: '已记下 · 这句进了「知」', icon: 'none' })
  }
}

function onSkip(): void {
  probe.skip(props.scene)
}
</script>

<style lang="scss" scoped>
@import './SceneProbe.scss';
</style>

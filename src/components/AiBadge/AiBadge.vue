<template>
  <!--
    来源标识 · 标明这段内容是「AI 产出」还是「基础规则兜底」。
    两个方向都必须标：
      · AI 出的要标 —— 用户有权知道自己看的是模型判断，以及自己的笔记被送去算了；
      · 基础规则出的也要标 —— 把规则算的结果说成 AI 判断，是更坏的误导。
    （对外文案统一说「基础」，不说「本地」/「本机」：
      · 「基础」讲的是**这是规则版的朴素结果，对应 AI 版**，用户一看就懂是"没用上 AI"；
      · 「本地」/「本机」在我们的语境里已经指本地存储、本地备份、本机后端，同词多义容易混淆。
      但涉及"内容出不出手机"时照实说「不联网 / 内容不出手机」，那是另一回事，别省。）
    新接入任何 AI 能力时直接复用它，别再各写一套文案。
  -->
  <text class="ai-badge" :class="[isAi ? 'is-ai' : 'is-local', { 'is-mini': mini }]">{{ label }}</text>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import type { AiSource } from '@/api/modules/ai'

const props = withDefaults(
  defineProps<{
    /** 结果来源：ai = 模型产出，local = 基础规则兜底（见 utils/localAi） */
    source: AiSource
    /** 覆盖默认文案（默认 "AI" / "基础"）。给具体动作名更清楚，如"AI 检验""基础汇总" */
    text?: string
    /** 迷你尺寸：嵌在标签 chip 里用 */
    mini?: boolean
  }>(),
  { text: '', mini: false },
)

const isAi = computed(() => props.source === 'ai')
const label = computed(() => props.text || (isAi.value ? 'AI' : '基础'))
</script>

<style lang="scss" scoped>
@import './AiBadge.scss';
</style>

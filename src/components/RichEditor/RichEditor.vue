<template>
  <view class="re">
    <!--
      工具栏只放**语义**按钮（粗细 / 斜体 / 下划线 / 标题 / 列表 / 引用 / 清格式），
      不做字号、颜色、对齐 —— 收件要的是结构，不是排版；放开排版只会让"你的话"越来越花。
    -->
    <view class="re__bar">
      <view
        v-for="b in BUTTONS"
        :key="b.id"
        class="re__btn"
        :class="{ 'is-on': active[b.id] }"
        hover-class="gz-hover"
        @click="run(b)"
      >
        {{ b.label }}
      </view>
    </view>

    <editor
      id="gzEditor"
      class="re__area"
      :placeholder="placeholder"
      placeholder-style="color:#A9A196"
      @ready="onReady"
      @input="onInput"
      @statuschange="onStatus"
    />

    <view class="re__foot">
      <text class="re__count" :class="{ 'is-over': text.length > max }">{{ text.length }} / {{ max }}</text>
      <text class="re__hint">只保留结构（粗细 / 标题 / 列表 / 引用），网页粘贴来的排版会被清掉</text>
    </view>
  </view>
</template>

<script setup lang="ts">
/**
 * RichEditor —— 小程序原生 `<editor>` 的薄封装（2026-09-17）。
 *
 * 为什么单独一个组件：`<editor>` 是这个项目里最容易在真机上出问题的组件
 * （没有 v-model、`maxlength` 不生效、`getContents()` 有平台时序差、必须固定高度），
 * 把这些坑关在一个文件里，录入页就能保持干净。
 *
 * 对外只暴露两条数据：
 *  - `html`：编辑器里的 HTML（正本，存库前由 store 再过一遍白名单清洗）；
 *  - `text`：由 HTML 派生的纯文本（检索 / AI / 导出 / 校验都用它）。
 *  **两者由本组件同时吐出**，所以"两份正文保持一致"是结构上成立的，不靠自觉。
 *
 * 三个具体坑的兜法：
 *  1. `@ready` 之前不调任何 API（否则 context 是空的，`setContents` 会静默失败）；
 *  2. 只有在 `html` 从**外部**变化（换条目 / 导入回填）时才 `setContents` ——
 *     否则用户每打一个字都会被重设一次光标；
 *  3. `maxlength` 不可靠，所以不做硬截断，只报数 + 由页面在存的时候拦（validate 里）。
 */
import { getCurrentInstance, reactive, ref, watch } from 'vue'
import { htmlToText, sanitizeHtml } from '@/utils/richText'

interface EditorContext {
  setContents: (opts: { html: string }) => void
  blur: () => void
  format: (name: string, value?: string | boolean) => void
  removeFormat: () => void
}

const props = withDefaults(
  defineProps<{
    /** 当前 HTML（外部传入；组件内部改动通过 update:html 吐回） */
    html?: string
    /** 字数上限（只用于提示与页面校验，不在这里硬截） */
    max?: number
    placeholder?: string
  }>(),
  { html: '', max: 10000, placeholder: '正文…' },
)

const emit = defineEmits<{
  (e: 'update:html', value: string): void
  (e: 'update:text', value: string): void
}>()

type BtnId = 'bold' | 'italic' | 'underline' | 'h3' | 'bullet' | 'ordered' | 'quote' | 'clear'

const BUTTONS: ReadonlyArray<{ id: BtnId; label: string }> = [
  { id: 'bold', label: '粗' },
  { id: 'italic', label: '斜' },
  { id: 'underline', label: '下划' },
  { id: 'h3', label: '标题' },
  { id: 'bullet', label: '· 列表' },
  { id: 'ordered', label: '1. 列表' },
  { id: 'quote', label: '引用' },
  { id: 'clear', label: '清格式' },
]

const active = reactive<Record<BtnId, boolean>>({
  bold: false,
  italic: false,
  underline: false,
  h3: false,
  bullet: false,
  ordered: false,
  quote: false,
  clear: false,
})

const inst = getCurrentInstance()
let ctx: EditorContext | null = null
const text = ref('')
/** 最近一次由本组件吐出去的 html —— 用来判断"这次变化是不是外部来的" */
let lastEmitted = ''

function onReady(): void {
  uni
    .createSelectorQuery()
    .in(inst?.proxy ?? undefined)
    .select('#gzEditor')
    .context((res) => {
      const got = (res as { context?: EditorContext } | null)?.context
      if (!got) return
      ctx = got
      if (props.html) {
        ctx.setContents({ html: props.html })
        lastEmitted = props.html
        text.value = htmlToText(props.html)
        emit('update:text', text.value)
      }
      /* 初始化后把焦点收掉：进页面就弹键盘会把下面的字段全遮住 */
      ctx.blur()
    })
    .exec()
}

/** 外部换内容（换条目 / 导入回填）时灌进编辑器 */
watch(
  () => props.html,
  (v) => {
    if (!ctx) return
    const next = v ?? ''
    if (next === lastEmitted) return
    ctx.setContents({ html: next })
    lastEmitted = next
    text.value = htmlToText(next)
    emit('update:text', text.value)
  },
)

function onInput(e: { detail?: { html?: string } }): void {
  const raw = e?.detail?.html ?? ''
  const clean = sanitizeHtml(raw)
  lastEmitted = clean
  text.value = htmlToText(clean)
  emit('update:html', clean)
  emit('update:text', text.value)
}

function onStatus(e: { detail?: Record<string, unknown> }): void {
  const d = e?.detail ?? {}
  active.bold = Boolean(d.bold)
  active.italic = Boolean(d.italic)
  active.underline = Boolean(d.underline)
  active.h3 = d.header === 'H3' || d.header === 'h3'
  active.bullet = d.list === 'bullet'
  active.ordered = d.list === 'ordered'
  active.quote = Boolean(d.blockquote)
}

function run(b: { id: BtnId }): void {
  if (!ctx) return
  switch (b.id) {
    case 'bold':
      ctx.format('bold')
      break
    case 'italic':
      ctx.format('italic')
      break
    case 'underline':
      ctx.format('underline')
      break
    /* 再点一次取消：与 Quill 的惯例一致，别让用户找不到"怎么变回去" */
    case 'h3':
      ctx.format('header', active.h3 ? false : 'H3')
      break
    case 'bullet':
      ctx.format('list', active.bullet ? false : 'bullet')
      break
    case 'ordered':
      ctx.format('list', active.ordered ? false : 'ordered')
      break
    case 'quote':
      ctx.format('blockquote', active.quote ? false : true)
      break
    case 'clear':
      ctx.removeFormat()
      break
  }
}
</script>

<style lang="scss" scoped>
@import './RichEditor.scss';
</style>

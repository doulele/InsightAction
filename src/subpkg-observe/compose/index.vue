<template>
  <view class="page" :class="skinClass">
    <!-- 顶栏 -->
    <view class="nav">
      <view class="nav__side" hover-class="gz-hover" @click="goBack">
        <text class="nav__back">‹</text>
      </view>
      <view class="nav__mid">
        <text class="nav__title">{{ kindTitle }}</text>
        <text class="nav__sub">存下不入账 · 处理时才给修为</text>
      </view>
      <view class="nav__side" />
    </view>

    <!-- 草稿：上次没写完的这一笔（点「继续写」才填回表单，不自动覆盖当前输入；改一笔时收起） -->
    <view v-if="draftStore.hasDraft && !isEditing" class="draft">
      <text class="draft__text">
        {{ draftResumed ? '草稿已填回表单' : '有一份没写完的草稿' }} · {{ draftAgo }}{{ draftWarn }}
      </text>
      <text v-if="!draftResumed" class="draft__btn draft__btn--main" hover-class="gz-hover" @click="resumeDraft">
        继续写
      </text>
      <text class="draft__btn" hover-class="gz-hover" @click="dropDraft">丢弃</text>
    </view>

    <!-- 归属：事 / 理 / 道 -->
    <view class="kinds">
      <view
        v-for="k in KINDS"
        :key="k.id"
        class="kind"
        :class="{ 'is-on': form.kind === k.id }"
        hover-class="gz-hover"
        @click="form.kind = k.id"
      >
        <text class="kind__char">{{ k.label }}</text>
        <text class="kind__hint">{{ k.hint }}</text>
      </view>
    </view>

    <!--
      事 / 理 / 道 的正面解释（随选中的那一张换）：它指什么 + 一个例子 + 这一类的硬要求。
      不放弹框 —— 这是这一页第一个要做的判断，不能藏在"?"里；
      而「见闻 / 认知 / 母题」三个词本身分不出界线（2026-09-18 补）。
    -->
    <view class="kinds__note">{{ kindNote }}</view>

    <!-- 形态：文章 / 一句话 / 视频 -->
    <view class="forms">
      <view
        v-for="f in FORMS"
        :key="f.id"
        class="forms__pill"
        :class="{ 'is-on': form.form === f.id }"
        hover-class="gz-hover"
        @click="form.form = f.id"
      >
        <text class="forms__text">{{ f.label }}</text>
      </view>
    </view>

    <!--
      导入文件（2026-09-17）：让外部 AI 按契约生成一份清单，导进来把表单填好。
      刻意放在最上面（形态之后）—— 它的用途就是"省掉手打"，埋在后面等于没有。
    -->
    <view class="import">
      <view class="import__btn" :class="{ 'is-off': importing }" hover-class="gz-hover" @click="doImport">
        <text class="import__text">{{ importing ? '解析中…' : '导入文件' }}</text>
      </view>
      <!--
        格式清单：整块压成一行 —— JSON 提到括号外（它是最准的那条路），其余一律收进括号。
        清单与右端的问号是同一个入口（都打开契约说明）；括号里只留一个"或"字，是给问号腾宽度。
        整行写死在一行里不放换行，免得多出空格；宽度账见 index.scss 同名注释。
      -->
      <text class="import__hint" hover-class="gz-hover" @click="showContract"><text class="import__k">JSON 最准</text>（或{{ importOtherExts }}/Word/Excel/PDF/图片）</text>
      <view class="import__help" hover-class="gz-hover" @click="showContract">
        <text class="import__help-q">?</text>
      </view>
    </view>
    <view v-if="importNotice" class="import__notice">
      <!-- 谁整理的要说清：AI 整理过就标 AI，图片识别标图片识别，别混着说 -->
      <AiBadge v-if="importSourceLabel" :source="importSource === 'ai' ? 'ai' : 'local'" :text="importSourceLabel" />
      <text class="import__notice-text">{{ importNotice }}</text>
      <text class="import__notice-x" hover-class="gz-hover" @click="closeNotice">×</text>
    </view>

    <!-- 主题：先归到哪些领域（可多选，六个一行排满） -->
    <view class="field">
      <view class="field__top">
        <text class="field__label">主题<text class="field__opt">选填 · 可多选</text></text>
      </view>
      <view class="topics">
        <view
          v-for="t in OBSERVE_TOPICS"
          :key="t"
          class="topic"
          :class="{ 'is-on': form.topics.includes(t) }"
          hover-class="gz-hover"
          @click="toggleTopic(t)"
        >
          <text class="topic__text">{{ t }}</text>
        </view>
      </view>
    </view>

    <!-- 一 · 来源：这条内容从哪来（链接 / 标题 / 出处 / 原文） -->
    <view v-if="form.form !== 'quote'" class="card">
      <view class="card__head">
        <view class="card__mark" />
        <text class="card__title">来源</text>
        <text class="card__hint">标题 · 链接 · 原文</text>
      </view>

      <!-- 文章：标题放最上面（先给它一个名字，链接跟着），再补来源 / 摘录 -->
      <block v-if="form.form === 'article'">
        <view class="field">
          <view class="field__top">
            <text class="field__label">标题<text class="field__req">必填</text></text>
          </view>
          <input
            v-model="form.title"
            class="field__input"
            :class="{ 'is-focus': focusKey === 'title' }"
            placeholder="给它一个你找得回来的名字"
            placeholder-class="field__ph"
            :maxlength="60"
            @focus="focusKey = 'title'"
            @blur="focusKey = ''"
          />
        </view>
        <view class="field">
          <view class="field__top">
            <text class="field__label">原文链接<text class="field__opt">选填</text></text>
          </view>
          <input
            v-model="form.link"
            class="field__input"
            :class="{ 'is-focus': focusKey === 'link' }"
            placeholder="https://"
            placeholder-class="field__ph"
            :maxlength="500"
            @focus="focusKey = 'link'"
            @blur="focusKey = ''"
          />
        </view>
        <view class="field">
          <view class="field__top">
            <text class="field__label">来源<text class="field__opt">选填</text></text>
          </view>
          <input
            v-model="form.sourceName"
            class="field__input"
            :class="{ 'is-focus': focusKey === 'source' }"
            placeholder="公众号 / 播客 / 书 / 朋友"
            placeholder-class="field__ph"
            :maxlength="30"
            @focus="focusKey = 'source'"
            @blur="focusKey = ''"
          />
        </view>
        <!-- 正文 / 摘录：真正抄来的原文放这里 -->

        <view class="field field--main">
          <view class="field__top">
            <text class="field__label">正文 / 摘录<text class="field__opt">选填 · 与链接二选一</text></text>
          </view>
          <!--
            正文改用富文本（2026-09-17）：导入的文件常常带简单样式（小标题、加粗、列表），
            纯文本框会把它们全抹平。工具与两条正文的同步规则见 components/RichEditor。
          -->
          <RichEditor
            :html="form.contentHtml"
            :max="BODY_MAX"
            placeholder="摘录触动你的段落（原文原话，不是你的总结）· 可加粗、起小标题"
            @update:html="onBodyHtml"
            @update:text="onBodyText"
          />
        </view>
      </block>

      <!-- 视频：标题 + 链接 + 来源 + 正文 -->
      <block v-else>
        <view class="field">
          <view class="field__top">
            <text class="field__label">标题<text class="field__req">必填</text></text>
          </view>
          <input
            v-model="form.title"
            class="field__input"
            :class="{ 'is-focus': focusKey === 'title' }"
            placeholder="这个视频叫什么"
            placeholder-class="field__ph"
            :maxlength="60"
            @focus="focusKey = 'title'"
            @blur="focusKey = ''"
          />
        </view>
        <view class="field">
          <view class="field__top">
            <text class="field__label">视频链接<text class="field__opt">选填</text></text>
          </view>
          <input
            v-model="form.videoUrl"
            class="field__input"
            :class="{ 'is-focus': focusKey === 'video' }"
            placeholder="粘贴链接（只做跳转，不在小程序内播放）"
            placeholder-class="field__ph"
            :maxlength="500"
            @focus="focusKey = 'video'"
            @blur="focusKey = ''"
          />
        </view>
        <view class="field">
          <view class="field__top">
            <text class="field__label">来源<text class="field__opt">选填</text></text>
          </view>
          <input
            v-model="form.sourceName"
            class="field__input"
            :class="{ 'is-focus': focusKey === 'source' }"
            placeholder="UP 主 / 频道 / 谁推荐的"
            placeholder-class="field__ph"
            :maxlength="30"
            @focus="focusKey = 'source'"
            @blur="focusKey = ''"
          />
        </view>
        <!-- 正文：视频里讲了什么（可贴逐字稿，也可只记要点） -->
        <view class="field field--main">
          <view class="field__top">
            <text class="field__label">正文<text class="field__opt">选填 · 视频里说了什么</text></text>
          </view>
          <RichEditor
            :html="form.contentHtml"
            :max="BODY_MAX"
            placeholder="它讲了什么？贴逐字稿，或记下关键几句"
            @update:html="onBodyHtml"
            @update:text="onBodyText"
          />
        </view>
      </block>
    </view>

    <!-- 二 · 你的话：金句、摘要、关键信息、观点、总结、感悟 —— 你写的和你选的 -->
    <view class="card">
      <view class="card__head">
        <view class="card__mark" />
        <text class="card__title">你的话</text>
        <text class="card__hint">你写的和你选的</text>
      </view>

      <!-- 经典语句（文章 / 视频）：你挑出来的那句原话，可多条 —— 放最上面，先落下打动你的那句 -->
      <view v-if="form.form !== 'quote'" class="field">
        <view class="field__top">
          <text class="field__label">经典语句<text class="field__opt">选填 · 可多条</text></text>
        </view>
        <view class="golden">
          <input
            v-model="goldenDraft"
            class="golden__input"
            :class="{ 'is-focus': focusKey === 'golden' }"
            placeholder="你觉得好的那一句原话"
            placeholder-class="field__ph"
            :maxlength="120"
            confirm-type="done"
            @focus="focusKey = 'golden'"
            @blur="focusKey = ''"
            @confirm="addGolden"
          />
          <view class="golden__add" :class="{ 'is-off': !goldenDraft.trim() }" hover-class="gz-hover" @click="addGolden">
            加
          </view>
        </view>
        <view v-if="form.golden.length" class="chips">
          <view v-for="(g, i) in form.golden" :key="i" class="chip" hover-class="gz-hover" @click="dropGolden(i)">
            <text class="chip__text">{{ g }}</text>
            <text class="chip__x">×</text>
          </view>
        </view>
      </view>

      <!-- 摘要（文章 / 视频）：用你自己的话压出来的摘要 -->
      <view v-if="form.form !== 'quote'" class="field">
        <view class="field__top">
          <text class="field__label">摘要<text class="field__opt">选填 · 你总结的摘要</text></text>
          <text class="field__count">{{ form.digest.length }}/1000</text>
        </view>
        <textarea
          v-model="form.digest"
          class="field__area field__area--sm"
          :class="{ 'is-focus': focusKey === 'digest' }"
          :placeholder="digestPlaceholder"
          placeholder-class="field__ph"
          :maxlength="1000"
          @focus="focusKey = 'digest'"
          @blur="focusKey = ''"
        />
      </view>

      <!-- 重要观点（文章 / 视频）：每条先一句总结，再解释 —— 可以很多条 -->
      <view v-if="form.form !== 'quote'" class="field">
        <view class="field__top">
          <text class="field__label">重要观点<text class="field__opt">选填 · 总结 + 解释，可多条</text></text>
        </view>

        <view v-for="(v, i) in form.viewpoints" :key="i" class="vp">
          <view class="vp__head">
            <text class="vp__no">观点 {{ i + 1 }}</text>
            <text class="vp__drop" hover-class="gz-hover" @click="dropViewpoint(i)">删</text>
          </view>
          <input
            v-model="v.title"
            class="field__input"
            :class="{ 'is-focus': focusKey === `vp-title-${i}` }"
            placeholder="先总结：它主张什么（一句话）"
            placeholder-class="field__ph"
            :maxlength="60"
            @focus="focusKey = `vp-title-${i}`"
            @blur="focusKey = ''"
          />
          <textarea
            v-model="v.text"
            class="field__area field__area--sm"
            :class="{ 'is-focus': focusKey === `vp-text-${i}` }"
            placeholder="再解释：凭什么是这样、证据是什么、你认哪一半"
            placeholder-class="field__ph"
            :maxlength="1000"
            @focus="focusKey = `vp-text-${i}`"
            @blur="focusKey = ''"
          />
        </view>

        <view class="vp-add" hover-class="gz-hover" @click="addViewpoint">
          <text class="vp-add__text">＋ 加一条观点</text>
        </view>
      </view>

      <!-- 文章 / 视频：一句话总结（必填）—— 要你交出的就是这一句；一句话就该一句话高 -->
      <view v-if="form.form !== 'quote'" class="field">
        <view class="field__top">
          <text class="field__label">一句话总结<text class="field__req">必填</text></text>
          <text class="field__count">{{ form.summary.length }}/500</text>
        </view>
        <textarea
          v-model="form.summary"
          class="field__area field__area--sm"
          :class="{ 'is-focus': focusKey === 'main' }"
          :placeholder="summaryPlaceholder"
          placeholder-class="field__ph"
          :maxlength="500"
          @focus="focusKey = 'main'"
          @blur="focusKey = ''"
        />
      </view>

      <!-- 一句话：那一句话（必填） -->
      <view v-else class="field field--main">
        <view class="field__top">
          <text class="field__label">那一句话<text class="field__req">必填</text></text>
          <text class="field__count">{{ form.content.length }}/2000</text>
        </view>
        <textarea
          :value="form.content"
          class="field__area"
          :class="{ 'is-focus': focusKey === 'main' }"
          placeholder="把那一句写下来（不写就不让存 —— 收藏夹不养僵尸）"
          placeholder-class="field__ph"
          :maxlength="2000"
          @focus="focusKey = 'main'"
          @blur="focusKey = ''"
          @input="onQuoteInput"
        />
      </view>

      <!-- 感悟：三种形态都收（读完长出来的话） -->
      <view class="field">
        <view class="field__top">
          <text class="field__label">感悟<text class="field__opt">选填 · 你从中悟到什么</text></text>
          <text class="field__count">{{ form.insight.length }}/3000</text>
        </view>
        <textarea
          v-model="form.insight"
          class="field__area field__area--sm"
          :class="{ 'is-focus': focusKey === 'insight' }"
          placeholder="它让你想到什么？照见了你哪一段经验、你打算怎么用"
          placeholder-class="field__ph"
          :maxlength="3000"
          @focus="focusKey = 'insight'"
          @blur="focusKey = ''"
        />
      </view>

      <!-- 理：为什么成立（写了才入册） -->
      <view v-if="form.kind === 'theory'" class="field">
        <view class="field__top">
          <text class="field__label">为什么成立<text class="field__opt">写了才算入册</text></text>
          <text class="field__count">{{ form.why.length }}/600</text>
        </view>
        <textarea
          v-model="form.why"
          class="field__area field__area--sm"
          :class="{ 'is-focus': focusKey === 'why' }"
          placeholder="它在什么条件下成立？反例是什么？"
          placeholder-class="field__ph"
          :maxlength="600"
          @focus="focusKey = 'why'"
          @blur="focusKey = ''"
        />
      </view>

    </view>

    <!-- 三 · 标签：以后还找得回来 -->
    <view class="card">
      <view class="card__head">
        <view class="card__mark" />
        <text class="card__title">标签</text>
        <text class="card__hint">选填 · 逗号分隔</text>
      </view>

      <view class="field">
        <input
          v-model="tagsDraft"
          class="field__input"
          :class="{ 'is-focus': focusKey === 'tags' }"
          placeholder="拖延, 注意力, 写作"
          placeholder-class="field__ph"
          :maxlength="80"
          @focus="focusKey = 'tags'"
          @blur="focusKey = ''"
        />
      </view>
    </view>

    <!-- 保存：存入草稿是旁路（不做必填校验），存入收件匣才算真的存下；改一笔时左边收起 -->
    <view class="acts">
      <view v-if="!isEditing" class="acts__ghost" hover-class="gz-hover" @click="saveDraft">
        <text class="acts__ghost-text">存入草稿</text>
      </view>
      <view class="save" :class="{ 'is-off': !errFree }" hover-class="gz-hover" @click="save">
        <text class="save__text">{{ isEditing ? '保存修改' : '存入收件匣' }}</text>
      </view>
    </view>
    <view class="foot">
      <text class="foot__text">{{ footText }}</text>
    </view>

    <!-- 复制契约示例（剪贴板）与选文件都属隐私接口，首次调用前要过这道门 -->
    <PrivacyGate />
  </view>
</template>

<script setup lang="ts">
/**
 * 观 · 记一笔（统一录入）—— 事 / 理 / 道 三类同源，文章 / 一句话 / 视频 三种形态。
 *
 * 三条硬规则落在本页：
 *  1. **不允许只存不写**：文章与视频要「标题 + 一句你自己的总结」，一句话形态就是那句话本身；
 *     链接一律选填（没有链接也能存 —— 关键是你写了什么）；
 *  2. **保存不入账**：修为在收件匣里"处理"时才给，所以这里存多少都不加分；
 *  3. **两张卡各管一件事**：「来源」管这条内容从哪来（链接 / 标题 / 出处 / 正文原文）；
 *     「你的话」管你写的和你选的（经典语句 / 摘要 / 重要观点 / 一句话总结 / 感悟 / 为什么成立）——
 *     版式按「来源 → 你的话 → 归档」三张卡分堆，长表单分段，读者始终知道自己在填哪一格；
 *  4. 主题六选一放在最上面（先归领域，再写内容），标签放在最后，两者都选填；
 *  5. **草稿是旁路**：存草稿不做必填校验（没写完就是没写完），只留一份、不进收件匣、不入账修为；
 *     真按下「存下」那一刻草稿自动清掉，不留影子；放满 14 天（DRAFT_HOLD_MS）也会自动清掉，
 *     且进页时明说一句，不悄悄吞掉用户敲过的字。草稿槽见 stores/composeDraft.ts。
 */
import { computed, ref, watch } from 'vue'
import { onLoad, onShow } from '@dcloudio/uni-app'
import { OBSERVE_TOPICS, useObserveStore, validate } from '@/stores/observe'
import type { ObsItem, ObserveForm, ObserveKind, Viewpoint } from '@/stores/observe'
import { useAccountStore } from '@/stores/account'
import { useRemoteStore } from '@/stores/remote'
import { useComposeDraftStore } from '@/stores/composeDraft'
import { useSkinClass } from '@/composables/useSkin'
import { sanitizeHtml } from '@/utils/richText'
import {
  LOCAL_EXTS,
  extOf,
  isLocalExt,
  isRemoteExt,
  parseImportFile,
  pickFile,
  readAsBase64,
  readAsText,
  type ImportedForm,
  type PickedFile,
} from '@/utils/fileImport'
import { parseFile } from '@/api/modules/parse'
import { CONTRACT_JSON, shareTemplate, type TemplateKind } from '@/utils/importTemplate'
import { ROUTES } from '@/router/routes'

const store = useObserveStore()
const draftStore = useComposeDraftStore()
/** 登录态（上传解析要带 token；未登录会静默登录一次） */
const account = useAccountStore()
/** 远端功能开关：`features.parse` 关掉时二进制文件入口直接说"未开启" */
const remote = useRemoteStore()
const skinClass = useSkinClass()

/** 草稿是否已填回表单（决定草稿条上还显不显示「继续写」） */
const draftResumed = ref(false)
/**
 * 编辑模式：从收件匣 / 详情页带 `?id=xxx` 进来时，这页从"记一笔"变成"改一笔"。
 * 复用同一套表单，只换标题与保存语义 —— 免得两处维护同样的字段。
 */
const editId = ref('')
const isEditing = computed(() => !!editId.value)
/** 草稿条与「存入草稿」在编辑模式下都收起：改的是已存的那条，不需要草稿 */

/** 草稿放了多久 —— 让人知道手里这份是不是还记得住的那份 */
const draftAgo = computed(() => draftStore.savedLabel())
/** 放超过 3 天才补一句"还有几天自清" —— 刚存的草稿不用吓唬人 */
const draftWarn = computed(() => (draftStore.ageInDays() >= 3 ? ` · ${draftStore.leftLabel()}` : ''))

const KINDS: Array<{ id: ObserveKind; label: string; hint: string }> = [
  { id: 'thing', label: '事', hint: '见闻' },
  { id: 'theory', label: '理', hint: '认知' },
  { id: 'mother', label: '道', hint: '母题' },
]

/**
 * 事 / 理 / 道 各是什么 —— 用户看到的三张签上只有「事 · 见闻」这么点字，
 * 分不出界线（这三类本来也容易混：一条新闻里既有事也有理）。
 * 所以每一类都要说清三件事：**它指什么 → 一个例子 → 这一类的硬要求**，
 * 短的那句放在签下面（kindNote），随选中的那一张换。
 *
 * 「理」与「道」的硬要求是产品口径，不是文案修饰，别删：
 * 理要写「为什么成立」才入册（见 footText 与 stores/observe 的校验），
 * 道是反复出现的底层问题，多半不是从某一篇里读出来的。
 */
const KIND_NOTES: Record<ObserveKind, string> = {
  thing: '事：你看到、听到或亲身经历的一件事（一条新闻、一次谈话、别人的做法）。记下「发生了什么」就够，想法写进「感悟」。',
  theory: '理：一条你认下的道理或认知（复利、二八法则、延迟满足）。要写清「它为什么成立」，这条才算入册。',
  mother: '道：反复出现的底层问题 —— 换个人、换个领域还会再遇到的那个（比如「人为什么会拖延」）。',
}

const FORMS: Array<{ id: ObserveForm; label: string }> = [
  { id: 'article', label: '文章' },
  { id: 'quote', label: '一句话' },
  { id: 'video', label: '视频' },
]

const form = ref({
  kind: 'thing' as ObserveKind,
  form: 'quote' as ObserveForm,
  title: '',
  link: '',
  videoUrl: '',
  sourceName: '',
  /** 摘要（你用自己话压出来的摘要） */
  digest: '',
  /** 重要观点：多条，每条 = 总结标题 + 解释 */
  viewpoints: [] as Viewpoint[],
  summary: '',
  content: '',
  /** 富文本正文（正本；content 是它的纯文本副本，由 RichEditor 同步吐出，见 utils/richText.ts） */
  contentHtml: '',
  why: '',
  /** 感悟（你的话；三种形态都收） */
  insight: '',
  golden: [] as string[],
  /** 主题：可多选（一条内容常横跨两三个领域） */
  topics: [] as string[],
})
const tagsDraft = ref('')
const goldenDraft = ref('')
/** 当前聚焦的字段名：用于把「字写在哪一格」画出来（微信原生 input 无 focus 样式） */
const focusKey = ref('')

/** 正文上限（按纯文本字数算）—— 与 RichEditor 的提示同一口径 */
const BODY_MAX = 10000
/** 这一笔是不是从文件导入的：存库时带上（不占配额 + 详情页角标） */
const imported = ref(false)
/** 导入结果的一句话交代（成功填了什么 / 哪里没读到），可手动关掉 */
const importNotice = ref('')
/**
 * 括号里那句"其余格式"：JSON 单独提到括号外突出（它是最准的那条路），剩下的都进括号。
 * 本机那几类从白名单派生，二进制那几类给中文说法（别在页面里手写扩展名）；
 * markdown 不列 —— 它和 md 是同一个东西，列出来只增噪（仍在白名单里可选）。
 * 分隔符用「/」且两边不留空格：整块要压进一行，空格在这里纯属浪费宽度（见 index.scss 的宽度账）。
 */
const importOtherExts = LOCAL_EXTS.filter((e) => e !== 'json' && e !== 'markdown')
  .map((e) => e.toUpperCase())
  .join('/')
/** 正在解析（上传解析比本机读慢，得有反馈） */
const importing = ref(false)
/** 这一次是谁整理的：rule 规则 / ai 模型 / ocr 图片识别（空 = 本机解析） */
const importSource = ref<'' | 'rule' | 'ai' | 'ocr'>('')
const importSourceLabel = computed(() => {
  if (importSource.value === 'ai') return 'AI 整理'
  if (importSource.value === 'ocr') return '图片识别'
  if (importSource.value === 'rule') return '规则抽取'
  return ''
})

/*
 * 字段怎么分堆（定规，改版后按这条走）：
 *  - 「来源」卡 = 这条内容从哪来：链接 / 标题 / 来源 / 正文 content
 *    （文章 = 摘录的原文，视频 = 视频里讲了什么）；
 *  - 「你的话」卡 = 你写的和你选的，顺序固定为：经典语句 golden → 摘要 digest →
 *    重要观点 viewpoints（多条：总结 + 解释）→ 一句话总结 summary（文章与视频必填）→
 *    感悟 insight（三种形态共用）→ 为什么成立 why（理）。
 * 注意：摘要 / 重要观点 / 经典语句虽然取材于原文，但都是"你总结的、你拎出来的、你挑的"，
 * 所以算你的话，不放来源卡。
 */
const kindTitle = computed(() => {
  const k = KINDS.find((x) => x.id === form.value.kind)
  const tail = k ? ` · ${k.label}` : ''
  return `${isEditing.value ? '改一笔' : '记一笔'}${tail}`
})

/** 把一条已存的内容灌进表单（编辑模式；字段与录入页一一对应） */
function loadItem(it: ObsItem): void {
  form.value.kind = it.kind
  form.value.form = it.form
  form.value.title = it.title
  form.value.link = it.link ?? ''
  form.value.videoUrl = it.videoUrl ?? ''
  form.value.sourceName = it.sourceName ?? ''
  form.value.digest = it.digest ?? ''
  form.value.viewpoints = (it.viewpoints ?? []).map((v) => ({ ...v }))
  form.value.summary = it.summary
  form.value.content = it.content
  form.value.contentHtml = it.contentHtml ?? ''
  imported.value = Boolean(it.imported)
  form.value.why = it.why ?? ''
  form.value.insight = it.insight ?? ''
  form.value.golden = [...it.golden]
  form.value.topics = [...it.topics]
  tagsDraft.value = it.tags.join(', ')
}

/** 当前归属的解释（文案见 KIND_NOTES）：页面上常驻一行，随选中的那张签换 */
const kindNote = computed(() => KIND_NOTES[form.value.kind])

/** 一句话总结的占位文案：文章说「这篇」，视频说「这个视频」 */
const summaryPlaceholder = computed(() =>
  form.value.form === 'video'
    ? '这个视频讲了什么？你想从里面得到什么'
    : '这篇讲了什么？你信哪一半、不信哪一半',
)

/** 摘要的占位文案：同样是"你的话"，按形态换说法 */
const digestPlaceholder = computed(() =>
  form.value.form === 'video'
    ? '用你自己的话压成两三句：它讲了什么、值不值得看'
    : '用你自己的话压成两三句（不是复制粘贴）',
)

const errFree = computed(() => !validate({ ...form.value }).length)


const footText = computed(() => {
  if (form.value.kind === 'theory') return '写了「为什么成立」，这条才入册'
  if (form.value.kind === 'mother') return '母题是反复出现的那个底层问题'
  return '存下不算数，读过写下才算数'
})

function addGolden(): void {
  const g = goldenDraft.value.trim()
  if (!g) return
  form.value.golden.push(g)
  goldenDraft.value = ''
}

function dropGolden(i: number): void {
  form.value.golden.splice(i, 1)
}

/** 主题多选：点一下加进来，再点一下拿掉（顺序＝点击顺序，不做排序） */
function toggleTopic(t: string): void {
  const i = form.value.topics.indexOf(t)
  if (i >= 0) form.value.topics.splice(i, 1)
  else form.value.topics.push(t)
}

/** 重要观点：一条条加、一条条删（空条目在存的时候会被滤掉，不会存进一份空壳） */
function addViewpoint(): void {
  form.value.viewpoints.push({ title: '', text: '' })
}

function dropViewpoint(i: number): void {
  form.value.viewpoints.splice(i, 1)
}

/** 存的时候把"标题与解释都空着"的条目剔掉 */
function cleanViewpoints(): Viewpoint[] {
  return form.value.viewpoints
    .map((v) => ({ title: v.title.trim(), text: v.text.trim() }))
    .filter((v) => v.title || v.text)
}

/** 表单是不是一片空白（没写什么就不用存草稿了） */
const isBlank = computed(() => {
  const f = form.value
  return (
    !f.title.trim() &&
    !f.link.trim() &&
    !f.videoUrl.trim() &&
    !f.sourceName.trim() &&
    !f.digest.trim() &&
    !f.viewpoints.some((v) => v.title.trim() || v.text.trim()) &&
    !f.summary.trim() &&
    !f.content.trim() &&
    !f.contentHtml.trim() &&
    !f.why.trim() &&
    !f.insight.trim() &&
    !f.topics.length &&
    !f.golden.length &&
    !tagsDraft.value.trim()
  )
})

/**
 * 存草稿：把输入框里的整份快照存下来，**不做必填校验** —— 草稿的意思就是"还没写完"。
 *
 * 它与「存下」的区别，正好是这一环的规矩所在：
 *  - 存下 → 进收件匣、占 200 条上限、7 天不读会被催着处理；
 *  - 存草稿 → 只在草稿槽里放一份，不入账修为、不进收件匣，想好了再来。
 */
function saveDraft(): void {
  if (isBlank.value) {
    uni.showToast({ title: '还什么都没写，先写一句', icon: 'none' })
    return
  }
  draftStore.save({
    kind: form.value.kind,
    form: form.value.form,
    title: form.value.title,
    link: form.value.link,
    videoUrl: form.value.videoUrl,
    sourceName: form.value.sourceName,
    digest: form.value.digest,
    viewpoints: form.value.viewpoints.map((v) => ({ ...v })),
    summary: form.value.summary,
    content: form.value.content,
    contentHtml: form.value.contentHtml,
    imported: imported.value,
    why: form.value.why,
    insight: form.value.insight,
    golden: [...form.value.golden],
    topics: [...form.value.topics],
    tags: tagsDraft.value,
  })
  draftResumed.value = true
  uni.showToast({ title: '已存草稿 · 下次进来接着写', icon: 'none' })
}

/** 把草稿填回表单（会覆盖当前输入，所以只在用户点「继续写」时才做，绝不自动填） */
function resumeDraft(): void {
  const d = draftStore.draft
  if (!d) return
  form.value.kind = d.kind
  form.value.form = d.form
  form.value.title = d.title
  form.value.link = d.link
  form.value.videoUrl = d.videoUrl
  form.value.sourceName = d.sourceName
  form.value.digest = d.digest
  // 兼容改多条目之前存下的草稿（那时只有一段 viewpoint 字符串）
  const legacyVp = (d as unknown as { viewpoint?: string }).viewpoint
  form.value.viewpoints = Array.isArray(d.viewpoints)
    ? d.viewpoints.map((v) => ({ ...v }))
    : legacyVp
      ? [{ title: '', text: legacyVp }]
      : []
  form.value.summary = d.summary
  form.value.content = d.content
  form.value.contentHtml = d.contentHtml ?? ''
  imported.value = Boolean(d.imported)
  form.value.why = d.why
  form.value.insight = d.insight
  form.value.golden = [...d.golden]
  // 兼容改多选之前存下的草稿（那时只有一个 topic 字符串）
  const legacyTopic = (d as unknown as { topic?: string }).topic
  form.value.topics = Array.isArray(d.topics) ? [...d.topics] : legacyTopic ? [legacyTopic] : []
  tagsDraft.value = d.tags
  draftResumed.value = true
  uni.showToast({ title: '已填回草稿', icon: 'none' })
}

/** 丢弃草稿：破坏性操作，照项目惯例走红色确认弹框 */
function dropDraft(): void {
  uni.showModal({
    title: '丢弃这份草稿',
    content: '草稿删了就找不回来了',
    confirmText: '丢弃',
    confirmColor: '#B24A3A',
    cancelText: '留着',
    success: (res) => {
      if (!res.confirm) return
      draftStore.clear()
      draftResumed.value = false
      uni.showToast({ title: '已丢弃', icon: 'none' })
    },
  })
}

/* ---------------- 正文的两条线（富文本 ↔ 纯文本） ----------------
 * 口径只有一句：**contentHtml 是正本，content 是它的可读副本**。
 * RichEditor 每次变化同时吐出两份，所以"两份保持一致"是结构上成立的；
 * 一句话形态不走富文本，改正文时顺手把导入留下的富文本作废（免得留一份对不上的旧格式）。
 */
function onBodyHtml(html: string): void {
  form.value.contentHtml = html
}

function onBodyText(text: string): void {
  form.value.content = text
}

function onQuoteInput(e: unknown): void {
  form.value.content = (e as { detail?: { value?: string } })?.detail?.value ?? ''
  /* 一句话形态不走富文本：手改了正文，之前导入的富文本版本就作废，别留一份对不上的旧格式 */
  form.value.contentHtml = ''
}

watch(
  () => form.value.form,
  (f) => {
    if (f === 'quote') form.value.contentHtml = ''
  },
)

/* ---------------- 导入文件（2026-09-17） ----------------
 * 三条规矩，都指向同一件事：**导入只是预填**。
 *  1. 只覆盖文件里真写了的字段，没写的一律保留用户当前输入；
 *  2. 回填后明说一句"过一遍再存"，不装作是自己写的；
 *  3. 不代存 —— 最后那一下「存入收件匣」永远由用户按。
 */
async function doImport(): Promise<void> {
  try {
    const file = await pickFile()
    const ext = extOf(file.name)

    /* 本机能读的（JSON / MD / TXT）：**全程不离开手机**，直接读、直接解析 */
    if (isLocalExt(ext)) {
      const { fields, warnings } = parseImportFile(file.name, readAsText(file.path))
      finishImport(fields, warnings, '')
      return
    }

    if (!isRemoteExt(ext)) {
      uni.showToast({ title: `暂不支持 .${ext} 这种文件`, icon: 'none' })
      return
    }

    /* 二进制格式（Word / Excel / PDF / 图片）本机读不了，必须上传 —— 先征得同意 */
    if (!remote.feature('parse')) {
      uni.showToast({ title: '文件解析暂未开启（可在设置里看当前开关）', icon: 'none' })
      return
    }
    if (!(await confirmUpload(file))) return

    importing.value = true
    const dataBase64 = readAsBase64(file.path, file.size)
    /* withAuth：token 过期时静默重登一次再试（与 AI 能力同一套，用户无感） */
    const res = await account.withAuth((token) => parseFile(token, { name: file.name, dataBase64 }))
    finishImport(res.fields, res.warnings, res.source)

    /* AI 整理过就说一声用量：这个功能确实花钱，不该瞒着用户 */
    if (res.source === 'ai' && res.meta) {
      importNotice.value += `（AI 整理用了 ${res.meta.tokens.total} tokens）`
    }
  } catch (e) {
    const msg = e instanceof Error ? e.message : '导入失败'
    /* 用户自己取消不是错误，别弹一句"已取消"吓他 */
    if (msg !== '已取消') uni.showToast({ title: msg, icon: 'none', duration: 2600 })
  } finally {
    importing.value = false
  }
}

/**
 * 上传前的明示同意（**不能省**）。
 *
 * 本机解析与上传解析是性质不同的两件事：前者文件没离开手机，后者离开了 ——
 * 用户有权在这一刻选择"不传"，而且我们要给他一条不用传的路（手打 / 换成 JSON 或 md）。
 */
function confirmUpload(file: PickedFile): Promise<boolean> {
  return new Promise((resolve) => {
    uni.showModal({
      title: '这个文件要上传解析',
      content:
        `「${file.name}」这类文件本机读不了，需要上传到服务器解析。\n\n`
        + '解析完成即删除：不落盘、不留存、不用于其他用途。\n\n'
        + '不想上传也有办法：直接手打，或让 AI 输出 .json / .md 文本 —— 那两种全程不离开手机。',
      confirmText: '上传解析',
      cancelText: '不上传',
      success: (r) => resolve(!!r.confirm),
      fail: () => resolve(false),
    })
  })
}

/** 解析结果落进表单 + 给一句交代（成功填了什么 / 哪里没读到） */
function finishImport(fields: ImportedForm, warnings: string[], source: '' | 'rule' | 'ai' | 'ocr'): void {
  applyImport(fields)
  imported.value = true
  importSource.value = source

  const got: string[] = []
  if (fields.title) got.push('标题')
  if (fields.content) got.push('正文')
  if (fields.contentHtml) got.push('样式')
  if (fields.summary) got.push('总结')
  if (fields.sourceName) got.push('来源')
  importNotice.value = got.length
    ? `已填入：${got.join(' / ')}${warnings.length ? ` · ${warnings.join('；')}` : ''} —— 过一遍再存`
    : `这份文件没读到可用字段${warnings.length ? `（${warnings.join('；')}）` : ''}`
  uni.showToast({ title: got.length ? '已回填表单' : '没读到内容', icon: 'none' })
}

function closeNotice(): void {
  importNotice.value = ''
  importSource.value = ''
}

/** 解析结果落进表单：未提到的字段一律保留原值 */
function applyImport(f: ImportedForm): void {
  const v = form.value
  if (f.kind) v.kind = f.kind
  if (f.form) v.form = f.form
  if (f.title) v.title = f.title
  if (f.topics?.length) v.topics = [...f.topics]
  if (f.tags?.length) tagsDraft.value = f.tags.join(', ')
  if (f.sourceName) v.sourceName = f.sourceName
  if (f.link) v.link = f.link
  if (f.videoUrl) v.videoUrl = f.videoUrl
  if (f.content) v.content = f.content
  /* 富文本进表单前再洗一遍（store 存的时候还会洗第三次 —— 闸门宁可多一道） */
  if (f.contentHtml) v.contentHtml = sanitizeHtml(f.contentHtml)
  if (f.digest) v.digest = f.digest
  /* 契约里的 viewpoints 两个字段都可缺省，落进表单时要补齐（表单类型是必填） */
  if (f.viewpoints?.length) {
    v.viewpoints = f.viewpoints.map((x) => ({ title: x.title ?? '', text: x.text ?? '' }))
  }
  if (f.summary) v.summary = f.summary
  if (f.insight) v.insight = f.insight
  if (f.why) v.why = f.why
  if (f.golden?.length) v.golden = [...f.golden]
}

/* ---------------- 格式说明 / 契约与模板（2026-09-18 扩） ----------------
 * 「?」与那行格式清单点开同一个动作表，四项各对应一件事：
 *   复制契约示例 —— 手机上的 AI：文本粘过去就行；
 *   转发 JSON 模板 —— 电脑上的 AI：文件发过去，让它照它填（最推荐）；
 *   转发 MD 模板 —— 电脑上人工填，或 AI 只会写「字段：值」时用；
 *   看格式说明 —— 把"为什么 JSON 最稳、哪些格式要上传"讲清。
 * 两条不许破：模板**本机生成**（不经后端、不上传）；导入永远只是预填，不代存。
 */
function showContract(): void {
  uni.showActionSheet({
    itemList: ['转发 JSON 模板', '转发 MD 模板', '复制契约示例', '看格式说明'],
    success: (res) => {
      if (res.tapIndex === 0) void sendTemplate('json')
      else if (res.tapIndex === 1) void sendTemplate('md')
      else if (res.tapIndex === 2) copyContract()
      else showFormatHelp()
    },
  })
}

/** 复制契约示例：给手机上的 AI（一段文本就够，不必造文件） */
function copyContract(): void {
  uni.setClipboardData({
    data: CONTRACT_JSON,
    success: () => uni.showToast({ title: '示例已复制 · 交给 AI 照它填', icon: 'none', duration: 2600 }),
    fail: () => uni.showToast({ title: '复制失败，可手动照抄字段名', icon: 'none' }),
  })
}

/**
 * 转发模板文件：本机写文件 → 转发到聊天（用户发给「文件传输助手」，再在电脑上打开）。
 * 文案里刻意不出现"下载" —— 微信里没有下载落点，落点就是"转发到聊天"。
 */
async function sendTemplate(kind: TemplateKind): Promise<void> {
  try {
    await shareTemplate(kind)
    uni.showToast({ title: '已生成模板 · 发给电脑让 AI 照它填', icon: 'none', duration: 2600 })
  } catch (e) {
    uni.showModal({
      title: '模板没能转发',
      content: `${e instanceof Error ? e.message : '未知错误'}\n\n可以改用「复制契约示例」，把格式直接粘给 AI。`,
      showCancel: false,
    })
  }
}

/**
 * 格式说明：只解释，不再兼做复制（复制已经单独是一项）。
 * 正文里不用 `**` 表强调 —— 原生弹框不认 Markdown，星号会原样显示出来。
 */
function showFormatHelp(): void {
  uni.showModal({
    title: '文件格式说明',
    content:
      'JSON 最准：契约 = 这一笔的全部字段（形态 / 标题 / 来源 / 链接 / 视频链接 / 经典语句 / 摘要 / 重要观点 / 一句话总结 / 感悟 / 为什么成立 / 正文，加一份带样式的正文）。把「JSON 模板」转发到电脑、让 AI 照它填，最不容易出错。\n\n'
      + '不进契约的只有三格：归属（事 / 理 / 道）、主题、标签 —— 原文里并没有写着「这是理」，归类是你的事，得你自己归。\n\n'
      + 'MD 与 JSON 是同一套字段，只是写法不同：按「字段：值」逐行写，字段名后面能用括号注明"这格要什么"；「正文：」以下全算正文，用 # 小标题、**加粗**、- 列表、> 引用写，会自动转成富文本。\n\n'
      + '上面这两种都在小程序本机解析，文件不会离开手机。\n\n'
      + 'Word / Excel / PDF / 图片本机读不了，会上传到服务器解析（解析完即删，也不占当日信息配额）。Excel 建议摆成两列：左列字段名、右列内容；PDF 若是扫描件、或中文用了非标准字体，可能抽不出文字 —— 那种情况改用文本清单最省事；图片直接读上面的文字（走微信官方识别）。\n\n'
      + '不管哪种方式，导入都只是预填：最后那一下「存入收件匣」永远由你按。',
    showCancel: false,
    confirmText: '知道了',
  })
}

function save(): void {
  const err = validate({ ...form.value })
  if (err) {
    uni.showToast({ title: err, icon: 'none' })
    return
  }
  const tags = tagsDraft.value
    .split(/[,，\s]+/)
    .map((t) => t.trim())
    .filter(Boolean)
  const viewpoints = cleanViewpoints()
  const payload = {
    kind: form.value.kind,
    form: form.value.form,
    title: form.value.title.trim(),
    topics: [...form.value.topics],
    tags,
    summary: form.value.summary.trim(),
    digest: form.value.digest.trim() || undefined,
    viewpoints: viewpoints.length ? viewpoints : undefined,
    content: form.value.content.trim(),
    /* 一句话形态不走富文本：它的正文就是"那一句"，给它格式没有意义 */
    contentHtml: form.value.form !== 'quote' && form.value.contentHtml ? form.value.contentHtml : undefined,
    imported: imported.value || undefined,
    insight: form.value.insight.trim() || undefined,
    golden: [...form.value.golden],
    link: form.value.link.trim() || undefined,
    videoUrl: form.value.videoUrl.trim() || undefined,
    sourceName: form.value.sourceName.trim() || undefined,
    why: form.value.why.trim() || undefined,
  }

  // 编辑模式：改的是已存的那一条 —— 不入账修为、不占当日配额、也不占收件上限
  if (editId.value) {
    store.update(editId.value, payload)
    uni.showToast({ title: '已保存修改', icon: 'none' })
    setTimeout(() => goBack(), 500)
    return
  }

  const item = store.add(payload)
  if (!item) {
    uni.showToast({ title: `收件满了（${store.items.length} 条），先去处理几条`, icon: 'none' })
    return
  }
  // 草稿的使命到此结束：这份内容已经真的进收件匣了，不该再留一份影子
  draftStore.clear()
  draftResumed.value = false
  uni.showToast({ title: '已存入收件匣 · 读过再处理', icon: 'none' })
  setTimeout(() => goBack(), 500)
}

function goBack(): void {
  const pages = getCurrentPages()
  if (pages.length > 1) {
    uni.navigateBack()
  } else {
    uni.switchTab({ url: ROUTES.tabObserve })
  }
}

onLoad((query) => {
  // 从各层子页 / 每日一则「认领」进来时预填：kind / form / title / content / src / tag
  const q = (query ?? {}) as Record<string, string>
  // 编辑模式（?id=xxx）：灌入已存内容，后面的预填与草稿一律让位
  if (q.id) {
    const it = store.find(q.id)
    if (it) {
      editId.value = q.id
      loadItem(it)
      return
    }
  }
  const k = q.kind
  if (k === 'thing' || k === 'theory' || k === 'mother') form.value.kind = k
  const f = q.form
  if (f === 'article' || f === 'quote' || f === 'video') form.value.form = f
  const decode = (s?: string) => (s ? decodeURIComponent(s) : '')
  if (q.title) form.value.title = decode(q.title)
  if (q.content) form.value.content = decode(q.content)
  if (q.src) form.value.sourceName = decode(q.src)
  if (q.tag) tagsDraft.value = decode(q.tag)
})

onShow(() => {
  // 刻意不读剪贴板：一进页面就触发"已读取剪贴板"的系统提示太打扰，链接请用户自己长按粘贴
  // 过期草稿在这里清掉，并明说一声 —— 那些字是用户自己敲的，不该默默消失
  if (draftStore.prune()) {
    draftResumed.value = false
    uni.showToast({ title: '上次的草稿放了太久，已自动清掉', icon: 'none' })
  }
})
</script>

<style lang="scss" scoped>
@import './index.scss';
</style>

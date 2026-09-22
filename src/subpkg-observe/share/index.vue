<template>
  <view class="page" :class="skinClass">
    <!-- 顶栏：从分享卡片进来时页面栈里只有这一页，返回要兜底回「观」 -->
        <SubNav @back="goBack">一条分享</SubNav>

    <view v-if="loading" class="hint">
      <text class="hint__text">正在打开…</text>
    </view>

    <!-- 取不到（已撤回 / 已过期）：与网页版同一句话，不区分"撤回了"还是"从来不存在" -->
    <view v-else-if="!snap" class="gone">
      <view class="gone__seal gz-motion">观</view>
      <text class="gone__title">这一页已经看不到了</text>
      <text class="gone__desc">作者撤回了这次分享，或者它已经过了有效期。</text>
      <view class="acts">
        <view class="acts__btn acts__btn--main" hover-class="gz-hover" @click="openApp">
          <text class="acts__btn-text">打开观止知行</text>
        </view>
      </view>
    </view>

    <template v-else>
      <!--
        卡一「这一段是什么」：与详情页第一张卡同构 ——
        卡头（小竖条 + 形态 + 右侧日期）→ 主题标签 → 标题 → 正文块 → 各内容块。
        来源挪到末尾的卡二（详情页那边它也是单独一张「来源」卡）。
      -->
      <view class="card">
        <view class="card__head">
          <view class="card__mark" />
          <text class="card__title">{{ kindLabel }}</text>
          <text v-if="dateText" class="card__hint">{{ dateText }}</text>
        </view>
        <view v-if="snap.topics?.length" class="topics">
          <text v-for="t in snap.topics" :key="t" class="topic">{{ t }}</text>
        </view>
        <text class="title">{{ snap.title || '一条分享' }}</text>
        <!-- 来源名摆在标题下面一行 —— 它本身不是"可点开的东西"，不该为它单开一张卡 -->
        <text v-if="snap.sourceName" class="src">来源 · {{ snap.sourceName }}</text>

      <!--
        正文（2026-09-22 改成与详情页同构）：灰底一块 + 卡头小竖条 + 「正文 · 原文 / 视频里讲的」，
        于是"这段是别人的字"与详情页看到的是同一个东西。
        内容在**服务端**洗过一遍（白名单标签、丢弃所有属性、图一律不留），
        这里再过 decorate() 注入内联样式 —— 小程序 rich-text 不吃外部 class（见 utils/richText.ts）。
      -->
      <view v-if="hasHtml || snap.content" class="origin">
        <view class="origin__head">
          <text class="origin__label">{{ originLabel }}</text>
          <!-- 与详情页同一套：正文超长时限高九行，就地「展开全文 / 收起」 -->
          <text v-if="contentLong" class="origin__toggle" hover-class="gz-hover" @click="contentOpen = !contentOpen">
            {{ contentOpen ? '收起' : '展开全文' }}
          </text>
        </view>
        <view v-if="hasHtml" class="origin__rich" :class="{ 'is-open': contentOpen }">
          <rich-text :nodes="richNodes" />
        </view>
        <text v-else class="origin__text" :class="{ 'is-open': contentOpen }">{{ snap.content }}</text>
      </view>

      <!--
        块顺序照抄**详情页**（2026-09-22 用户指出分享页与原文对不上）：
        标题 → 正文 → 摘要 → 重要观点 → 经典语句 → 一句话总结 → 感悟 → 为什么成立。
        摘要（digest）与一句话总结（summary）是两格：旧快照没有 digest，那一块就不出现。
      -->
      <view v-if="snap.digest" class="block">
        <view class="block__head">
          <view class="block__tick" />
          <text class="block__label">摘要</text>
        </view>
        <text class="block__text">{{ snap.digest }}</text>
      </view>

      <view v-if="snap.viewpoints?.length" class="block">
        <view class="block__head">
          <view class="block__tick" />
          <text class="block__label">重要观点</text>
        </view>
        <view v-for="(p, i) in snap.viewpoints" :key="i" class="vp">
          <text v-if="p.title" class="vp__title">{{ p.title }}</text>
          <text v-if="p.text" class="vp__text">{{ p.text }}</text>
        </view>
      </view>

      <view v-if="snap.golden?.length" class="block">
        <view class="block__head">
          <view class="block__tick" />
          <text class="block__label">经典语句</text>
        </view>
        <view class="golden">
          <text v-for="(g, i) in snap.golden" :key="i" class="golden__line">「{{ g }}」</text>
        </view>
      </view>

      <view v-if="snap.summary" class="block">
        <view class="block__head">
          <view class="block__tick" />
          <text class="block__label">一句话总结</text>
        </view>
        <text class="block__text">{{ snap.summary }}</text>
      </view>

      <view v-if="snap.insight" class="block">
        <view class="block__head">
          <view class="block__tick" />
          <text class="block__label">感悟</text>
        </view>
        <text class="block__text">{{ snap.insight }}</text>
      </view>

      <view v-if="snap.why" class="block">
        <view class="block__head">
          <view class="block__tick" />
          <text class="block__label">为什么成立</text>
        </view>
        <text class="block__text">{{ snap.why }}</text>
      </view>

      </view>

      <!--
        卡二「来源」= **可点开的东西的容器**：
        没有链接就整张卡不出现（原先只有一行「来源 · 视频号」的空卡还写着「点一下复制链接」，是句空话）；
        有链接时那行**直接显示标题**，点一下复制地址（个人主体没有业务域名，小程序里打不开外站）。
      -->
      <view v-if="snap.link || snap.videoUrl" class="card">
        <view class="card__head">
          <view class="card__mark" />
          <text class="card__title">来源</text>
          <text class="card__hint">点一下复制链接</text>
        </view>
        <view v-if="snap.link" class="link" hover-class="gz-hover" @click="copyText(snap.link, '原文链接已复制')">
          <text class="link__text">{{ linkLabel('原文') }} ›</text>
        </view>
        <view v-if="snap.videoUrl" class="link" hover-class="gz-hover" @click="copyText(snap.videoUrl, '视频链接已复制')">
          <text class="link__text">{{ linkLabel('视频') }} ›</text>
        </view>
      </view>

      <view class="acts">
        <view class="acts__btn acts__btn--main" hover-class="gz-hover" @click="openApp">
          <text class="acts__btn-text">打开观止知行</text>
        </view>
        <view class="acts__btn" hover-class="gz-hover" @click="copyH5">
          <text class="acts__btn-text">复制网页链接</text>
        </view>
      </view>
      <view class="foot">
        <text class="foot__text">这是别人分享给你的一条 · 链接随时可能被撤回</text>
      </view>
    </template>

    <!-- 复制链接属隐私接口（剪贴板），首次调用前要过这道门 -->
    <PrivacyGate />
  </view>
</template>

<script setup lang="ts">
/**
 * 一条分享的只读页（2026-09-21 建立）· 分包 subpkg-observe。
 *
 * 它是**好友点开小程序卡片**的落点（`?t=<token>`），也是全应用唯一"不需要登录"的页面：
 * 进来只用那个 token 去服务器取一条（`GET /guanzhi/share/item/:token`），取不到就渲染"看不到了"。
 *
 * 四条刻意的规矩：
 *  1. **只读**：没有任何编辑 / 处理 / 删除入口，也**不写进本机** —— 别人的一条不该混进你的收件匣
 *     （想收下来是另一件事，需要一个明确的"存进我的收件匣"，本轮不做）；
 *  2. 文案与网页版**同一套**：撤回了、过期了、不存在，都说"这一页已经看不到了"，不透露差别；
 *  3. 底部只给两个出口：「打开观止知行」（回启动页，由那一页分流）与「复制网页链接」（发到任何地方）；
 *  4. 外链一律「复制 + 提示」（个人主体小程序没有业务域名，web-view 打不开外站）。
 *
 * App.vue 有一条配套：**从分享卡片进来时不走启动箴言页**（否则会被 reLaunch 顶掉，这一条就永远打不开）。
 */
import { computed, ref } from 'vue'
import { onLoad } from '@dcloudio/uni-app'
import { fetchSharedItem, type ShareSnapshot } from '@/api/modules/share'
import { decorate, hasMarkup } from '@/utils/richText'
import { useSkinClass } from '@/composables/useSkin'
import { ROUTES } from '@/router/routes'

const skinClass = useSkinClass()

const loading = ref(true)
const snap = ref<ShareSnapshot | null>(null)
const h5Url = ref('')

const KIND_LABEL: Record<string, string> = { thing: '事', theory: '理', mother: '道' }
const FORM_LABEL: Record<string, string> = { article: '文章', quote: '一句话', video: '视频' }

const kindLabel = computed(() => {
  const s = snap.value
  if (!s) return ''
  const k = KIND_LABEL[s.kind] ?? ''
  const f = FORM_LABEL[s.form] ?? ''
  return k && f ? `${k} · ${f}` : k || f
})

const hasHtml = computed(() => hasMarkup(snap.value?.contentHtml))
const richNodes = computed(() => decorate(snap.value?.contentHtml ?? ''))

/** 正文限高与展开（与详情页同一口径：纯文本超过 240 字才算长） */
const contentOpen = ref(false)
const CONTENT_LONG = 240
const contentLong = computed(() => (snap.value?.content?.length ?? 0) > CONTENT_LONG)

/**
 * 链接那一行显示**标题**（用户点它就是"去看这一条"，标题比"原文链接"这种通用词有用得多）；
 * 没有标题时才退回一句通用文案（`原文` / `视频`）。
 */
function linkLabel(kind: string): string {
  const t = (snap.value?.title || '').trim()
  return t ? `${kind} · ${t}` : kind
}

/** 正文那一块的标签：三种形态读法不同 —— 与 detail/index.vue 的 originLabel 一字不差（两页要一致） */
const originLabel = computed(() => {
  const f = snap.value?.form
  if (f === 'quote') return '那一句话'
  if (f === 'video') return '正文 · 视频里讲的'
  return '正文 · 原文'
})

const dateText = computed(() => {
  const iso = snap.value?.publishedAt
  if (!iso) return ''
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ''
  const pad = (n: number): string => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
})

onLoad((options) => {
  const token = String((options as Record<string, unknown> | undefined)?.t || '')
  if (!token) {
    loading.value = false
    return
  }
  void load(token)
})

async function load(token: string): Promise<void> {
  try {
    const res = await fetchSharedItem(token)
    snap.value = res.snapshot
    h5Url.value = res.h5Url
  } catch (e) {
    /* 只有一种失败需要解释：这条没了（撤回 / 过期）。其余（没网）也一律按"看不到了"渲染 ——
       此时多说一个字都是噪音，用户能做的一样：返回。 */
    console.warn('[share] 读取失败：', e)
    snap.value = null
  } finally {
    loading.value = false
  }
}

function copyText(text: string, tip: string): void {
  uni.setClipboardData({
    data: text,
    success: () => uni.showToast({ title: tip, icon: 'none' }),
    fail: () => uni.showToast({ title: '复制失败，长按链接手动复制', icon: 'none' }),
  })
}

function copyH5(): void {
  if (!h5Url.value) return
  copyText(h5Url.value, '网页链接已复制 · 可以发到任何地方')
}

/**
 * 「打开观止知行」：回**启动页**，由那一页自己分流（已完成引导 → 主界面 / 首次 → 模式选择）。
 * 不直接 switchTab 到「观」大厅 —— 新用户会被丢进一个还没引导过的界面。
 */
function openApp(): void {
  uni.reLaunch({ url: ROUTES.entryStartup })
}

function goBack(): void {
  const pages = getCurrentPages()
  if (pages.length > 1) {
    uni.navigateBack()
  } else {
    /* 从分享卡片直接进来时栈里只有这一页：退回大厅而不是卡住 */
    uni.switchTab({ url: ROUTES.tabObserve })
  }
}
</script>

<style lang="scss">
@import './index.scss';
</style>

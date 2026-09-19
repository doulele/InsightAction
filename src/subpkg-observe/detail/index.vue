<template>
  <view class="page" :class="skinClass">
    <!-- 顶栏 -->
    <view class="nav">
      <view class="nav__side" hover-class="gz-hover" @click="goBack">
        <text class="nav__back">‹</text>
      </view>
      <view class="nav__mid">
        <text class="nav__title">{{ headTitle }}</text>
        <text v-if="item" class="nav__sub">{{ timeLabel(item.createdAt) }} 存入</text>
      </view>
      <view class="nav__side" />
    </view>

    <!-- 找不到（可能刚在别处删了） -->
    <view v-if="!item" class="empty">
      <view class="empty__seal gz-motion">空</view>
      <text class="empty__title">这条已经不在了</text>
      <text class="empty__desc">可能刚被删掉，或者链接过期了。</text>
      <view class="empty__btn" hover-class="gz-hover" @click="goBack">回收件匣</view>
    </view>

    <template v-else>
      <!-- 一 · 这一段是什么 -->
      <view class="card">
        <view class="card__head">
          <view class="card__mark" />
          <text class="card__title">{{ kindText(item.kind) }} · {{ formText(item.form) }}</text>
          <text class="card__hint">{{ stateText(item) }}</text>
        </view>

        <view v-if="item.topics.length" class="topics">
          <text v-for="t in item.topics" :key="t" class="topic">{{ t }}</text>
        </view>

        <text v-if="item.title" class="title">{{ item.title }}</text>

        <!-- 正文（原文）：灰底一块 + 限高，长了就地展开 —— 与"你的话"一眼分得开 -->
        <view v-if="item.content || item.contentHtml" class="origin">
          <view class="origin__head">
            <text class="origin__label">{{ originLabel }}</text>
            <text v-if="item.imported" class="origin__tag">导入</text>
            <text v-if="contentLong" class="origin__toggle" hover-class="gz-hover" @click="contentOpen = !contentOpen">
              {{ contentOpen ? '收起' : '展开全文' }}
            </text>
          </view>
          <!--
            有格式就用富文本回显（这正是导入带样式的初衷）；老数据没有 contentHtml，走纯文本分支。
            节点先过 decorate() —— 小程序 rich-text 不吃外部 class，样式得内联注入（见 utils/richText.ts）。
          -->
          <rich-text
            v-if="hasHtml"
            class="origin__rich"
            :class="{ 'is-open': contentOpen }"
            :nodes="richNodes"
          />
          <text v-else class="origin__text" :class="{ 'is-open': contentOpen }">{{ item.content }}</text>
        </view>

        <view v-if="item.digest" class="block">
          <view class="block__head">
            <view class="block__tick" />
            <text class="block__label">摘要</text>
          </view>
          <text class="block__text">{{ item.digest }}</text>
        </view>

        <view v-if="item.viewpoints?.length" class="block">
          <view class="block__head">
            <view class="block__tick" />
            <text class="block__label">重要观点</text>
          </view>
          <view v-for="(v, i) in item.viewpoints" :key="i" class="vp">
            <text v-if="v.title" class="vp__title">{{ v.title }}</text>
            <text v-if="v.text" class="vp__text">{{ v.text }}</text>
          </view>
        </view>

        <view v-if="item.golden.length" class="block">
          <view class="block__head">
            <view class="block__tick" />
            <text class="block__label">经典语句</text>
          </view>
          <view class="golden">
            <text v-for="(g, i) in item.golden" :key="i" class="golden__line">「{{ g }}」</text>
          </view>
        </view>

        <view v-if="item.summary" class="block">
          <view class="block__head">
            <view class="block__tick" />
            <text class="block__label">一句话总结</text>
          </view>
          <text class="block__text">{{ item.summary }}</text>
        </view>

        <view v-if="item.insight" class="block">
          <view class="block__head">
            <view class="block__tick" />
            <text class="block__label">感悟</text>
          </view>
          <text class="block__text">{{ item.insight }}</text>
        </view>

        <view v-if="item.why" class="block">
          <view class="block__head">
            <view class="block__tick" />
            <text class="block__label">为什么成立</text>
          </view>
          <text class="block__text">{{ item.why }}</text>
        </view>
      </view>

      <!-- 二 · 它从哪来 -->
      <view v-if="item.sourceName || item.link || item.videoUrl" class="card">
        <view class="card__head">
          <view class="card__mark" />
          <text class="card__title">来源</text>
          <text class="card__hint">点一下复制链接</text>
        </view>
        <view class="links">
          <text v-if="item.sourceName" class="links__src">来源 · {{ item.sourceName }}</text>
          <text v-if="item.link" class="links__link" hover-class="gz-hover" @click="openLink(item.link)">
            原文链接 ›
          </text>
          <text v-if="item.videoUrl" class="links__link" hover-class="gz-hover" @click="openVideo(item.videoUrl)">
            ▶ 打开视频
          </text>
        </view>
      </view>

      <!-- 三 · 归档信息 -->
      <view v-if="item.tags.length || item.handledAt" class="card">
        <view class="card__head">
          <view class="card__mark" />
          <text class="card__title">归档</text>
          <text class="card__hint">走过哪些路</text>
        </view>
        <view v-if="item.tags.length" class="topics">
          <text v-for="t in item.tags" :key="t" class="topic">{{ t }}</text>
        </view>
        <!-- 处理时写下的那一句（2026-09-17 从正文里挪出来单独存，原文保持原文） -->
        <view v-if="item.handleNote" class="block">
          <text class="block__label">处理时写下的一句</text>
          <text class="block__text">{{ item.handleNote }}</text>
        </view>
        <view v-if="item.handledAt" class="block">
          <text class="block__label">处理</text>
          <text class="block__text">{{ timeLabel(item.handledAt) }} · 深度 Lv.{{ item.depth }}</text>
        </view>
      </view>

      <!-- 操作 -->
      <view class="acts">
        <view class="acts__ghost" hover-class="gz-hover" @click="edit">
          <text class="acts__ghost-text">编辑</text>
        </view>
        <view v-if="!item.handledAt" class="save" :class="{ 'is-off': !canRead }" hover-class="gz-hover" @click="handle">
          <text class="save__text">{{ canRead ? '处理' : '明日再读' }}</text>
        </view>
        <view class="acts__ghost acts__ghost--danger" hover-class="gz-hover" @click="drop">
          <text class="acts__ghost-text">删除</text>
        </view>
      </view>
      <view class="foot">
        <text class="foot__text">存是为了处理，不是为了攒</text>
      </view>
    </template>

    <!-- 隐私授权拦截弹窗（复制原文前需征得同意） -->
    <PrivacyGate />
  </view>
</template>

<script setup lang="ts">
/**
 * 观 · 一条的详情 —— 收件匣卡片点「详情」进来的地方。
 *
 * 收件匣从此只做列表（标题 + 两行摘要 + 操作），全文搬到这里：
 * 一是长文（正文上限 10000 字）在列表里铺开会把列表淹掉，二是这一页要放
 * 「编辑 / 处理 / 删除」三个动作，挤在卡片上会让每条都变得很重。
 *
 * 编辑不进这一页的表单，而是带着 `?id=` 回到录入页（那一套字段只维护一份）；
 * 处理与删除沿用收件匣同一套规矩（配额、二次确认）。
 *
 * 版式上把两类东西分开，免得一屏文字糊成一片：
 *  - 「正文 / 原文」= 灰底一块，限高 520rpx，长了就地「展开全文」—— 别人的字；
 *  - 「摘要 / 重要观点 / 经典语句 / 一句话总结 / 感悟 / 为什么成立」= 细分割线 +
 *    主题色小竖条 —— 你写的字。
 */
import { computed, ref } from 'vue'
import { onLoad } from '@dcloudio/uni-app'
import { useObserveStore } from '@/stores/observe'
import { decorate, hasMarkup } from '@/utils/richText'
import { useSkinClass } from '@/composables/useSkin'
import { navigateTo, ROUTES } from '@/router/routes'

const store = useObserveStore()
const skinClass = useSkinClass()

const id = ref('')
const item = computed(() => (id.value ? store.find(id.value) : undefined))

const headTitle = computed(() => {
  const it = item.value
  if (!it) return '详情'
  return `${kindText(it.kind)} · ${formText(it.form)}`
})

/** 今天还能不能深度处理（配额用完只有「今天新存」的会被拦，见 store.canDeepRead） */
const canRead = computed(() => (item.value ? store.canDeepRead(item.value.id) : false))

/** 正文默认限高（九行上下），超了给一个「展开全文」开关 —— 不让一篇长逐字稿把下面全顶走 */
const contentOpen = ref(false)
const CONTENT_LONG = 240
/** 限高按**纯文本**长度算：HTML 的标签长度不该影响"算不算长" */
const contentLong = computed(() => (item.value?.content.length ?? 0) > CONTENT_LONG)

/** 这一条是不是带格式（有 contentHtml 才走富文本渲染分支） */
const hasHtml = computed(() => hasMarkup(item.value?.contentHtml))
/** 渲染节点：注入内联样式的副本（不动原件 —— 原件是存档用的正本） */
const richNodes = computed(() => decorate(item.value?.contentHtml ?? ''))

/** 正文那一块的标签：三种形态读法不同（视频没有"原文"，是"视频里讲的"） */
const originLabel = computed(() => {
  const it = item.value
  if (!it) return '正文'
  if (it.form === 'quote') return '那一句话'
  if (it.form === 'video') return '正文 · 视频里讲的'
  return '正文 · 原文'
})

function kindText(kind: string): string {
  return kind === 'thing' ? '事' : kind === 'theory' ? '理' : '道'
}

function formText(form: string): string {
  return form === 'article' ? '文章' : form === 'video' ? '视频' : '一句话'
}

function stateText(it: { handledAt?: number; kind: string; state: string }): string {
  if (it.handledAt) return `已处理 · Lv.${store.find(id.value)?.depth ?? 1}`
  if (it.kind === 'theory') return it.state === 'confirmed' ? '已入册' : it.state === 'pending' ? '待整理' : '草稿'
  return '未处理'
}

function timeLabel(t?: number): string {
  if (!t) return ''
  const d = new Date(t)
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getMonth() + 1} 月 ${d.getDate()} 日 ${pad(d.getHours())}:${pad(d.getMinutes())}`
}

/** 编辑：带着 id 回录入页（那一页有完整的字段与校验，不在这里再抄一份表单） */
function edit(): void {
  if (!item.value) return
  navigateTo(ROUTES.observeCompose, { id: item.value.id })
}

/**
 * 处理：读过并写下自己的话。
 * 配额用尽时先解释再拦（与收件匣一致，不静默失败）。
 */
function handle(): void {
  const it = item.value
  if (!it) return
  if (!canRead.value) {
    uni.showModal({
      title: '今天的深度阅读用完了',
      content: `每日 ${store.quotaTotal()} 次，只用来读「今天新存进来」的东西。\n这条明天再读；前几天存下的补处理不占额，现在就能处理。`,
      showCancel: false,
      confirmText: '知道了',
    })
    return
  }
  uni.showModal({
    title: '写下你的一句话',
    editable: true,
    placeholderText: '它让你想到什么 / 哪里不成立',
    confirmText: '处理',
    cancelText: '再想想',
    success: (res) => {
      if (!res.confirm) return
      const note = (res as { content?: string }).content ?? ''
      const ok = store.markHandled(it.id, note)
      uni.showToast({ title: ok ? '已处理 · 修为入账' : '今天的配额用完了', icon: 'none' })
    },
  })
}

/** 删除：破坏性操作，照项目惯例走红色确认弹框，删完退回列表 */
function drop(): void {
  const it = item.value
  if (!it) return
  uni.showModal({
    title: '删掉这条',
    content: '删了就找不回来了',
    confirmText: '删',
    confirmColor: '#B24A3A',
    cancelText: '留着',
    success: (res) => {
      if (!res.confirm) return
      store.remove(it.id)
      uni.showToast({ title: '已删', icon: 'none' })
      setTimeout(() => goBack(), 400)
    },
  })
}

/**
 * 外链一律走「复制 + 提示」：个人主体小程序没有业务域名白名单，
 * web-view 打不开外站，视频更不可能内嵌播放。
 */
function copyThenTip(url: string, tip: string): void {
  uni.setClipboardData({
    data: url,
    success: () => uni.showToast({ title: tip, icon: 'none' }),
    fail: () => uni.showToast({ title: '复制失败，长按链接手动复制', icon: 'none' }),
  })
}

function openLink(url?: string): void {
  if (url) copyThenTip(url, '链接已复制，粘贴到浏览器打开')
}

function openVideo(url?: string): void {
  if (url) copyThenTip(url, '视频链接已复制，去对应 App 或浏览器打开')
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
  id.value = (query as Record<string, string>)?.id ?? ''
})
</script>

<style lang="scss" scoped>
@import './index.scss';
</style>

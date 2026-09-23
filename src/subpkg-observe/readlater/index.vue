<template>
  <view class="page" :class="skinClass">
    <!-- 顶栏：返回 + 标题（子页统一样式） -->
        <SubNav :fallback="ROUTES.tabObserve">稍后读 · 碎片回收</SubNav>

    <!--
      形态选择（2026-09-23）：一句话 / 文章 / 视频。
      默认停在「一句话」—— 打开就能存，与从前一模一样（不多一步）；
      切到文章 / 视频才展开「标题 + 链接」，因为那两种形态**离了链接就找不回去**。
    -->
    <view class="pick">
      <view
        v-for="f in FORMS"
        :key="f.id"
        class="pick__item"
        :class="{ 'is-on': form === f.id }"
        hover-class="gz-hover"
        @click="pickForm(f.id)"
      >
        <text class="pick__mark">{{ f.mark }}</text>
        <text class="pick__name">{{ f.name }}</text>
      </view>
    </view>

    <!-- 收纳条 -->
    <view class="add">
      <!-- 文章 / 视频：先给标题与链接（链接是必填的那一格） -->
      <template v-if="isDoc">
        <input
          v-model="title"
          class="add__input"
          placeholder="标题（选填，不写就用你下面那句）"
          placeholder-class="add__ph"
          :maxlength="40"
        />
        <input
          v-model="link"
          class="add__input"
          :placeholder="form === 'video' ? '视频链接（必填）' : '原文链接（必填）'"
          placeholder-class="add__ph"
          confirm-type="done"
        />
      </template>
      <view class="add__row">
        <input
          v-model="draft"
          class="add__input"
          :placeholder="placeholder"
          placeholder-class="add__ph"
          :maxlength="80"
          confirm-type="done"
          @confirm="save"
        />
        <view class="add__btn" :class="{ 'is-off': !canSave }" hover-class="gz-hover" @click="save">
          存下
        </view>
      </view>
    </view>
    <view class="rule">
      <text class="rule__text">一句话留 24 小时 · 文章 / 视频留 7 天 · 读不完自会清走</text>
      <text v-if="store.items.length" class="rule__num">{{ store.items.length }} 条待读</text>
    </view>

    <!-- 列表 / 空态 -->
    <view v-if="!store.items.length" class="empty">
      <view class="empty__seal gz-motion">存</view>
      <text class="empty__title">{{ $p('empty.readlater.title') }}</text>
      <text class="empty__desc">{{ $p('empty.readlater.desc') }}</text>
    </view>
    <view v-else class="list">
      <view v-for="it in store.items" :key="it.createdAt" class="card" :class="`card--${formOf(it)}`">
        <!-- 卡头：形态徽标 + 还能留多久（三种形态在版式上就分开，不靠颜色猜） -->
        <view class="card__head">
          <text class="card__form">{{ FORM_NAME[formOf(it)] }}</text>
          <text class="card__time">{{ leftLabel(it) }}</text>
        </view>

        <!-- 文章 / 视频才有标题 -->
        <text v-if="it.title" class="card__title">{{ it.title }}</text>
        <text v-if="it.text" class="card__text" :class="{ 'is-quote': formOf(it) === 'quote' }">{{ it.text }}</text>

        <!-- 文章 / 视频才有链接：外链一律走「复制 + 提示」（个人主体没有业务域名白名单） -->
        <text v-if="it.link" class="card__link" hover-class="gz-hover" @click="openLink(it.link)">
          {{ formOf(it) === 'video' ? '▶ 打开视频' : '原文链接 ›' }}
        </text>

        <view class="card__meta">
          <text class="card__drop" hover-class="gz-hover" @click="dropItem(it.createdAt)">弃</text>
        </view>
      </view>
    </view>

    <view class="foot">
      <text class="foot__text">不读完，不积压</text>
    </view>

    <!-- 隐私授权拦截弹窗（复制链接前需征得同意） -->
    <PrivacyGate />
  </view>
</template>

<script setup lang="ts">
/**
 * 观 · 稍后读 —— 批次 B 第一个真实功能子页（分包 subpkg-observe）。
 * 「临时收藏，读不完自会清走」：本页提供 存 / 读 / 弃 与过期自动回收，
 * 让"收藏"保持在够得着的量级。纯本地存储，随云备份一起走。
 *
 * 2026-09-23：从"只能存一句话"扩成三种形态（一句话 / 文章 / 视频）——
 * 与「记一笔」的 form 同口径（文章有原文链接、视频有视频链接、一句话只有那句话）。
 * - 保留时长按形态分（一句话 24 小时 / 文章与视频 7 天），口径在 stores/readLater.ts；
 * - 卡片按形态分开版式：文档卡左侧一条主题色带 + 卡头徽标 + 标题 + 链接，
 *   一句话卡就是一句引文（不靠配色去猜是哪一种）；
 * - 默认仍是"一句话"：打开就能存，切形态才展开标题 / 链接。
 */
import { computed, onBeforeUnmount, ref } from 'vue'
import { onHide, onShow } from '@dcloudio/uni-app'
import {
  useReadLaterStore,
  formOf,
  holdMsOf,
  type ReadLaterForm,
  type ReadLaterItem,
} from '@/stores/readLater'
import { useSkinClass } from '@/composables/useSkin'
import { ROUTES } from '@/router/routes'
import { WARN_COLOR } from '@/config/palette'
import { showModal } from '@/utils/dialog'

const store = useReadLaterStore()
const skinClass = useSkinClass()

/** 三种形态：`mark` 只用一个字，和项目里其他地方的小印字一个路子 */
const FORMS: Array<{ id: ReadLaterForm; name: string; mark: string }> = [
  { id: 'quote', name: '一句话', mark: '「' },
  { id: 'article', name: '文章', mark: '文' },
  { id: 'video', name: '视频', mark: '▶' },
]
const FORM_NAME: Record<ReadLaterForm, string> = { quote: '一句话', article: '文章', video: '视频' }

const form = ref<ReadLaterForm>('quote')
const draft = ref('')
const title = ref('')
const link = ref('')

/** 文章 / 视频 = "文档型"：多标题与链接两格，且**必须有链接** */
const isDoc = computed(() => form.value !== 'quote')

const placeholder = computed(() => {
  if (form.value === 'quote') return '把此刻想读的，先放在这…'
  return form.value === 'video' ? '为什么要看它？（选填）' : '为什么要读它？（选填）'
})

/** 存下按钮的可用性：一句话要那句话，文档要链接 */
const canSave = computed(() => (isDoc.value ? link.value.trim().length > 0 : draft.value.trim().length > 0))

/** 剩余时效文案依赖的「现在」：半分钟一跳，让数字缓慢走动 */
const nowTick = ref(Date.now())
let ticker: ReturnType<typeof setInterval> | null = null

function pickForm(id: ReadLaterForm): void {
  form.value = id
  nowTick.value = Date.now()
}

function save(): void {
  if (!canSave.value) {
    uni.showToast({ title: isDoc.value ? '先粘上链接，不然回头找不到' : '写一句再存', icon: 'none' })
    return
  }
  const ok = store.add({ form: form.value, text: draft.value, title: title.value, link: link.value })
  if (ok) {
    draft.value = ''
    title.value = ''
    link.value = ''
    nowTick.value = Date.now()
  }
}

/** 丢弃：还没读的那一条会从清单里消失，先确认 */
function dropItem(createdAt: number): void {
  showModal({
    title: '丢弃这一条？',
    content: '它还没读。弃了就从清单里拿掉，不可找回。',
    confirmText: '丢弃',
    confirmColor: WARN_COLOR,
    cancelText: '留着',
    success: (res) => {
      if (!res.confirm) return
      store.remove(createdAt)
      uni.showToast({ title: '已丢弃', icon: 'none' })
    },
  })
}

/**
 * 外链一律走「复制 + 提示」：
 * 个人主体小程序没有业务域名白名单，web-view 打不开外站，视频更不可能内嵌播放。
 */
function openLink(url?: string): void {
  if (!url) return
  uni.setClipboardData({
    data: url,
    success: () => uni.showToast({ title: '链接已复制，粘贴到浏览器打开', icon: 'none' }),
    fail: () => uni.showToast({ title: '复制失败，长按链接手动复制', icon: 'none' }),
  })
}

/** 剩余时效：不足 1 分钟 / X 小时后自清（天数按各自的保留时长算） */
function leftLabel(it: ReadLaterItem): string {
  const left = it.createdAt + holdMsOf(formOf(it)) - nowTick.value
  if (left <= 0) return '已过期 · 打开即清'
  const mins = Math.ceil(left / 60_000)
  if (mins < 60) return `${mins} 分钟后自清`
  const hours = Math.ceil(mins / 60)
  if (hours <= 36) return `${hours} 小时后自清`
  return `${Math.ceil(hours / 24)} 天后自清`
}

onShow(() => {
  const cleared = store.prune()
  if (cleared > 0) {
    uni.showToast({ title: `已自动清走 ${cleared} 条过期收藏`, icon: 'none' })
  }
  nowTick.value = Date.now()
  ticker = setInterval(() => (nowTick.value = Date.now()), 30_000)
})

onHide(() => {
  if (ticker) {
    clearInterval(ticker)
    ticker = null
  }
})

onBeforeUnmount(() => {
  if (ticker) {
    clearInterval(ticker)
    ticker = null
  }
})
</script>

<style lang="scss" scoped>
@import './index.scss';
</style>

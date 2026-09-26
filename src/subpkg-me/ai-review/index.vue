<template>
  <view class="page" :class="skinClass">
    <SubNav :fallback="ROUTES.tabMe">AI 开通申请</SubNav>

    <!-- 还在读（只在第一次进来时显示，之后刷新不闪） -->
    <view v-if="loading && !loaded" class="hint">
      <text class="hint__text">正在读取…</text>
    </view>

    <!-- 读不到：**如实说**，不假装是"没有申请"（空列表会让人以为真没人申请） -->
    <view v-else-if="!loaded" class="hint">
      <text class="hint__title">没能读到申请列表</text>
      <text class="hint__text">{{ errText || '稍后再试' }}</text>
    </view>

    <template v-else>
      <!-- 概览 -->
      <view class="sum">
        <view class="sum__main">
          <text class="sum__num">{{ list.pending.length }}</text>
          <text class="sum__unit">条待批</text>
        </view>
        <text class="sum__sub">
          AI 每调用一次都真实花钱，所以只开给名单里的人；通过后立刻生效，对方不用重新登录。
        </text>
      </view>

      <!-- 待批 -->
      <view class="sec">
        <view class="sec__head">
          <text class="sec__title">待批申请</text>
          <text class="sec__hint">称呼是他自己填的，openid 是他唯一能"证明我是谁"的东西</text>
        </view>

        <view v-if="!list.pending.length" class="empty">
          <text class="empty__title">没有待批的申请</text>
          <text class="empty__text">对方在小程序里点「设置 → AI 授权 → 申请开通」之后，就会出现在这里。</text>
        </view>

        <view v-for="p in list.pending" :key="p.openid" class="card">
          <view class="card__main">
            <view class="card__top">
              <text class="card__name">{{ p.name || '（未署名）' }}</text>
              <text class="card__time">{{ when(p.at) }}</text>
            </view>
            <text class="card__id">{{ shortId(p.openid) }}</text>
          </view>
          <view class="card__acts">
            <view class="btn btn--main" hover-class="gz-hover" @click="doApprove(p)">通过</view>
            <view class="btn btn--off" hover-class="gz-hover" @click="doReject(p)">不通过</view>
          </view>
        </view>
      </view>

      <!-- 没通过的（留痕） -->
      <view v-if="list.rejected.length" class="sec">
        <view class="sec__head">
          <text class="sec__title">没通过的（{{ list.rejected.length }}）</text>
          <text class="sec__hint">留着是为了他能看到「上次没通过 · 可以再申请」；你随时能改判</text>
        </view>
        <view v-for="p in list.rejected" :key="p.openid" class="card is-faded">
          <view class="card__main">
            <view class="card__top">
              <text class="card__name">{{ p.name || '（未署名）' }}</text>
              <text class="card__time">{{ when(p.rejectedAt || p.at) }}</text>
            </view>
            <text class="card__id">{{ shortId(p.openid) }}</text>
          </view>
          <view class="card__acts">
            <view class="btn btn--main" hover-class="gz-hover" @click="doApprove(p)">还是通过</view>
          </view>
        </view>
      </view>

      <!-- 已开通 -->
      <view class="sec">
        <view class="sec__head">
          <text class="sec__title">已开通（{{ list.entries.length }}）</text>
          <text class="sec__hint">
            名单为空 = 不限（谁都能用）；名单里有人 = 只对这些人开放
          </text>
        </view>

        <view v-if="!list.entries.length" class="empty">
          <text class="empty__title">名单还是空的</text>
          <text class="empty__text">空名单意味着所有人都能用 AI。想收窄，就先通过一个人。</text>
        </view>

        <view v-for="e in list.entries" :key="e.openid" class="card">
          <view class="card__main">
            <view class="card__top">
              <text class="card__name">{{ e.name || '（未署名）' }}</text>
              <text class="card__time">{{ when(e.at) }}</text>
            </view>
            <text class="card__id">{{ shortId(e.openid) }}</text>
          </view>
          <view class="card__acts">
            <view class="btn btn--off" hover-class="gz-hover" @click="doRevoke(e)">移除</view>
          </view>
        </view>
      </view>

      <view class="foot">
        <text class="foot__text">审批只看"要不要给他花钱"，不看内容</text>
      </view>
    </template>
  </view>
</template>

<script setup lang="ts">
/**
 * 我 · 设置 → AI 开通申请（分包 subpkg-me/ai-review，2026-09-26）。
 *
 * 为什么要有这一页：开通 AI 原本只能"改 .env → 重启进程"或"登服务器跑脚本"，
 * 而申请是随时来的（对方点一下就有）—— 手机上批一下才是日常该有的样子。
 *
 * **身份靠登录态，不靠密钥**：管理密钥一旦进小程序包就等于公开（反编译即得，
 * 谁都能给自己开 AI、烧额度），所以这里用 `req.openid` 与后端 `AI_ADMIN_OPENIDS` 比对。
 * 不是管理员会吃 403，页面照实说"没能读到"（入口本来也只对管理员渲染）。
 *
 * 三种操作的动作范围（都是可逆的，所以只有"不通过 / 移除"要走确认）：
 *   · 通过   —— 加进白名单，**热生效**：对方不用重登、服务不用重启；
 *   · 不通过 —— 只标 `rejected` **不删记录**，他下次点开关会看到「上次没通过 · 可以再申请一次」；
 *   · 移除   —— 从白名单拿掉（收窄权限）。注意 `.env` 里那份种子不归这一页管。
 */
import { ref } from 'vue'
import { onShow } from '@dcloudio/uni-app'
import { useAccountStore } from '@/stores/account'
import { useSkinClass } from '@/composables/useSkin'
import {
  aiReviewApprove,
  aiReviewList,
  aiReviewReject,
  aiReviewRevoke,
  type AiApplicant,
  type AiEntry,
  type AiReviewData,
} from '@/api/modules/ai'
import { showModal } from '@/utils/dialog'
import { WARN_COLOR } from '@/config/palette'
import { ROUTES } from '@/router/routes'

const account = useAccountStore()
const skinClass = useSkinClass()

const list = ref<AiReviewData>({ pending: [], rejected: [], entries: [] })
/** 成功读到过一次就置 true —— 之后刷新失败不把已有内容清掉，只提示 */
const loaded = ref(false)
const loading = ref(false)
const errText = ref('')

/** 拉一次列表（进入页面、每次操作之后都走它） */
async function load(): Promise<void> {
  loading.value = true
  try {
    list.value = await account.withAuth((t) => aiReviewList(t))
    loaded.value = true
    errText.value = ''
  } catch (e) {
    errText.value = e instanceof Error ? e.message : ''
  } finally {
    loading.value = false
  }
}

onShow(() => {
  void load()
})

const pad = (n: number): string => String(n).padStart(2, '0')

/** ISO → `09-26 21:05`（审批看的是"多久以前"，不必带年） */
function when(iso: string): string {
  if (!iso) return '—'
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return '—'
  return `${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`
}

/** openid 只露头尾：够你核对，又不至于一眼截图就能被冒用 */
function shortId(id: string): string {
  return id.length > 14 ? `${id.slice(0, 6)}…${id.slice(-6)}` : id
}

/** 通过（不需要确认 —— 正面操作，且随时能"移除"改回去） */
async function doApprove(p: AiApplicant): Promise<void> {
  uni.showLoading({ title: '正在通过…', mask: true })
  try {
    await account.withAuth((t) => aiReviewApprove(t, p.openid, p.name))
    uni.hideLoading()
    uni.showToast({ title: '已开通 · 他那边开关就能用了', icon: 'none' })
    await load()
  } catch (e) {
    uni.hideLoading()
    showModal({
      title: '没通过成功',
      content: e instanceof Error ? e.message : '稍后再试一次',
      showCancel: false,
    })
  }
}

/**
 * 不通过：走确认 —— 这一步对方是**看得见**的（他下次点开关会被告知"上次没通过"），
 * 误点一下会平白让人以为没戏，所以多问一句。
 */
function doReject(p: AiApplicant): void {
  showModal({
    title: `不给「${p.name || '这位'}」开通？`,
    content: '他下次打开 AI 授权时会看到「上次没通过 · 可以再申请一次」，你随时能在这页改判。',
    confirmText: '不通过',
    confirmColor: WARN_COLOR,
    cancelText: '再想想',
    success: async (res) => {
      if (!res.confirm) return
      uni.showLoading({ title: '正在记下…', mask: true })
      try {
        await account.withAuth((t) => aiReviewReject(t, p.openid))
        uni.hideLoading()
        uni.showToast({ title: '已记下 · 没有开通', icon: 'none' })
        await load()
      } catch (e) {
        uni.hideLoading()
        showModal({
          title: '没记上',
          content: e instanceof Error ? e.message : '稍后再试一次',
          showCancel: false,
        })
      }
    },
  })
}

/** 从白名单移除：收窄权限，确认一次（对方会立刻用不了 AI） */
function doRevoke(e: AiEntry): void {
  showModal({
    title: `收回「${e.name || '这位'}」的 AI 权限？`,
    content: '收回后他调 AI 只会拿到基础结果（功能照常，只是不联网）。想再开，回这页通过一次即可。',
    confirmText: '收回',
    confirmColor: WARN_COLOR,
    cancelText: '留着',
    success: async (res) => {
      if (!res.confirm) return
      uni.showLoading({ title: '正在收回…', mask: true })
      try {
        await account.withAuth((t) => aiReviewRevoke(t, e.openid))
        uni.hideLoading()
        uni.showToast({ title: '已收回', icon: 'none' })
        await load()
      } catch (err) {
        uni.hideLoading()
        showModal({
          title: '没收回成功',
          content: err instanceof Error ? err.message : '稍后再试一次',
          showCancel: false,
        })
      }
    },
  })
}

/* 模板里直接用 import 进来的 ROUTES（SubNav 的返回落点） */
</script>

<style lang="scss" scoped>
@import './index.scss';
</style>

<template>
  <view class="page" :class="skinClass">
    <!-- 顶栏 -->
    <view class="nav">
      <view class="nav__side" hover-class="gz-hover" @click="goBack">
        <text class="nav__back">‹</text>
      </view>
      <text class="nav__title">愿望清单</text>
      <view class="nav__side" />
    </view>

    <!-- 修为进度 -->
    <view class="xp">
      <view class="xp__row">
        <text class="xp__label">当前修为</text>
        <text class="xp__value">{{ xp.total }}<text class="xp__unit">点</text></text>
      </view>
      <text class="xp__hint">
        戒断刷屏、专注静修、完成三件事……每一笔真实投入都在攒修为。达标即可把愿望兑换成现实奖励。
      </text>
    </view>

    <!-- 愿望列表 -->
    <view v-if="wishes.length === 0" class="empty">
      <text class="empty__title">先立一个愿望</text>
      <text class="empty__text">「等我攒到 500 修为，买那本一直想读的书」——把延迟满足变成看得见的账。</text>
    </view>

    <view v-for="w in wishes" :key="w.id" class="wish" :class="{ 'is-done': w.claimedAt }">
      <view class="wish__top">
        <text class="wish__name">{{ w.name }}</text>
        <view v-if="w.claimedAt" class="wish__stamp">已兑现</view>
        <view v-else-if="canClaim(w)" class="wish__stamp is-ready">可兑现</view>
        <view class="wish__del" hover-class="gz-hover" @click="confirmRemove(w)">×</view>
      </view>
      <text v-if="w.note" class="wish__note">{{ w.note }}</text>

      <template v-if="!w.claimedAt">
        <view class="bar">
          <view
            class="bar__fill"
            :style="{ width: `${pctOf(w)}%`, background: canClaim(w) ? 'var(--gz-accent)' : 'var(--gz-grad-to)' }"
          />
        </view>
        <view class="wish__row">
          <text class="wish__need">
            {{ Math.min(xp.total, w.needXp) }} / {{ w.needXp }} 修为
          </text>
          <view
            v-if="canClaim(w)"
            class="wish__claim"
            hover-class="gz-hover"
            @click="claimWish(w)"
          >
            去兑现
          </view>
        </view>
      </template>
      <text v-else class="wish__claimed">已在 {{ fmtDate(w.claimedAt) }} 兑现 · 收下这份给自己的奖赏</text>
    </view>

    <!-- 新增 -->
    <view class="add" hover-class="gz-hover" @click="addOpen = true">
      <text class="add__mark">＋</text>
      <text class="add__text">立一个新愿望</text>
    </view>

    <view class="foot">
      <text class="foot__text">攒修为的每一分钟 · 都会在未来兑现</text>
    </view>

    <!-- 新建弹层 -->
    <view v-if="addOpen" class="overlay" @click="addOpen = false">
      <view class="sheet" @click.stop>
        <text class="sheet__title">立个愿望</text>
        <input
          v-model="newName"
          class="sheet__input"
          placeholder="例如：买那本想读的书"
          maxlength="16"
        />
        <text class="sheet__label">需要攒到多少修为（不低于 {{ wishStore.WISH_MIN_XP }}）</text>
        <view class="needs">
          <view
            v-for="n in [100, 300, 600]"
            :key="n"
            class="need"
            :class="{ 'is-on': Number(newNeed) === n }"
            hover-class="gz-hover"
            @click="newNeed = String(n)"
          >
            {{ n }}
          </view>
          <input v-model="newNeed" class="need need--custom" type="number" placeholder="自定" />
        </view>
        <input
          v-model="newNote"
          class="sheet__input"
          placeholder="备注（可选）：为什么想要它"
          maxlength="24"
        />
        <view class="sheet__row">
          <view class="sheet__btn sheet__btn--ghost" hover-class="gz-hover" @click="addOpen = false">
            取消
          </view>
          <view class="sheet__btn" hover-class="gz-hover" @click="saveWish">立下</view>
        </view>
      </view>
    </view>

    <!-- 移除确认：主题随当前模式，破坏性键语义红 -->
    <GzDialog
      variant="danger"
      :show="removeOpen"
      title="划掉这个愿望？"
      :content="removeText()"
      confirm-text="移除"
      cancel-text="再想想"
      @cancel="removeOpen = false"
      @confirm="dropWish"
    />
  </view>
</template>

<script setup lang="ts">
/**
 * 行 · 愿望清单（m7 批次 · 分包 subpkg-action）：
 * 以修为为标尺的延迟满足账本。纯本地（stores/wish.ts），修为只作门槛不回退。
 */
import { computed, ref } from 'vue'
import GzDialog from '@/components/GzDialog/GzDialog.vue'
import { useWishStore, type Wish } from '@/stores/wish'
import { useXpStore } from '@/stores/xp'
import { useSkinClass } from '@/composables/useSkin'
import { ROUTES } from '@/router/routes'

const wishStore = useWishStore()
const xp = useXpStore()
const skinClass = useSkinClass()

const wishes = computed(() => wishStore.wishes)

function canClaim(w: Wish): boolean {
  return !w.claimedAt && xp.total >= w.needXp
}

function pctOf(w: Wish): number {
  return Math.min(100, Math.round((xp.total / w.needXp) * 100))
}

function claimWish(w: Wish): void {
  if (wishStore.claim(w.id, xp.total)) {
    uni.showToast({ title: `已兑现「${w.name}」· 奖励自己`, icon: 'none' })
  }
}

/** 待移除愿望（null = 弹框关闭） */
const removing = ref<Wish | null>(null)
const removeOpen = ref(false)

function removeText(): string {
  const w = removing.value
  if (!w) return ''
  return w.claimedAt ? '已兑现的愿望也可从清单移除。' : '它会从清单里消失，攒的修为不受影响。'
}

function confirmRemove(w: Wish): void {
  removing.value = w
  removeOpen.value = true
}

function dropWish(): void {
  removeOpen.value = false
  const target = removing.value
  removing.value = null
  if (target) wishStore.remove(target.id)
}

const pad = (n: number): string => String(n).padStart(2, '0')

function fmtDate(at: number): string {
  const d = new Date(at)
  return `${d.getMonth() + 1} 月 ${d.getDate()} 日`
}

/* ---- 新增 ---- */
const addOpen = ref(false)
const newName = ref('')
const newNeed = ref('300')
const newNote = ref('')

function saveWish(): void {
  const need = Number(newNeed.value)
  const ok = wishStore.add(newName.value, Number.isFinite(need) ? need : 300, newNote.value)
  if (!ok) return
  newName.value = ''
  newNeed.value = '300'
  newNote.value = ''
  addOpen.value = false
  uni.showToast({ title: '愿望已立下 · 开始攒吧', icon: 'none' })
}

function goBack(): void {
  const pages = getCurrentPages()
  if (pages.length > 1) {
    uni.navigateBack()
  } else {
    uni.switchTab({ url: ROUTES.tabAction })
  }
}
</script>

<style lang="scss" scoped>
@import './index.scss';
</style>

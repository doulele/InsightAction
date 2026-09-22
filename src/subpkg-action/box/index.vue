<template>
  <view class="page" :class="skinClass">
    <!-- 顶栏：返回 + 标题 -->
        <SubNav :fallback="ROUTES.tabAction">微行动盲盒</SubNav>

    <!-- 已抽中 -->
    <view v-if="current" class="stage">
      <view class="stage__seal">{{ done ? '成' : '盒' }}</view>
      <text class="stage__eyebrow">今日盲盒 · 第 {{ current.index + 1 }} 号行动</text>
      <text class="stage__idea">{{ ideaText }}</text>

      <view class="stage__hint">{{ stageHint }}</view>

      <button v-if="!done" class="cta" hover-class="gz-hover" @click="finish">我做完了</button>
      <view v-else class="stage__done-line">很好。身体的开关，已经被你拨开一次了。</view>

      <view class="stage__again" hover-class="gz-hover" @click="redraw">
        换一只（今天只算一次）
      </view>
      <view class="stage__rule">明天完成三件事后再来开 · 每天一只</view>
    </view>

    <!-- 未解锁 -->
    <view v-else-if="!daily.allDone" class="lock">
      <view class="lock__box">盲盒</view>
      <text class="lock__title">今天的盲盒还没解锁</text>
      <text class="lock__desc">
        先去「行 · 今日三件事」把今天要做的三件事全部勾完成。\n行动之后的奖励，才配叫奖励。
      </text>
      <button class="cta" hover-class="gz-hover" @click="goAction">去完成今日三件事</button>
    </view>

    <!-- 可开 -->
    <view v-else class="ready">
      <!-- 模式专属标志物：纸签筒 / 任务队列 / 开炉（图缺失时整块隐身） -->
      <ModuleMark mark="action.draw" size="md" />
      <view class="ready__box" hover-class="gz-hover" @click="openOnce">
        <text class="ready__mark">?</text>
      </view>
      <text class="ready__title">三事已成。开一只？</text>
      <text class="ready__desc">它会给你一个 3 分钟就能完成的线下小行动。\n跟手机无关，跟身体有关。</text>
      <!-- 步数联动（2026-09-17）：今天走得太少时，先从走动类里出（只调权重，不新开池子） -->
      <text v-if="moveFirst" class="ready__move">今天走得少 —— 先从离开座位的那几只里给你挑。</text>
      <button class="cta" hover-class="gz-hover" @click="openOnce">打开盲盒</button>
    </view>

    <view class="foot">
      <text class="foot__text">不给大脑更多信息 · 给身体一个动作</text>
    </view>

    <!-- 换一只确认：主题随当前模式 -->
    <GzDialog
      :show="redrawOpen"
      title="换一只？"
      content="换了它，今天也只算一次。"
      confirm-text="换"
      cancel-text="留着"
      @cancel="redrawOpen = false"
      @confirm="doRedraw"
    />
  </view>
</template>

<script setup lang="ts">
/**
 * 微行动盲盒（批次 C）· 分包 subpkg-action：
 * 今日三件事全部完成后解锁，随机抽一个 3 分钟线下行动；
 * 当天只算一次（抽中后可选换一只，但不重复计）。开盒动作写入痕迹流。
 */
import { computed, ref } from 'vue'
import GzDialog from '@/components/GzDialog/GzDialog.vue'
import { onShow } from '@dcloudio/uni-app'
import { BOX_IDEAS, useBoxStore } from '@/stores/box'
import { useDailyStore } from '@/stores/daily'
import { useBodyStore } from '@/stores/body'
import { logTrace } from '@/utils/traceLog'
import { useSkinClass } from '@/composables/useSkin'
import { navigateTo, ROUTES } from '@/router/routes'

const box = useBoxStore()
const daily = useDailyStore()
/** 身体电量（2026-09-17）：步数明显不足时，盲盒优先出走动类 */
const body = useBodyStore()
const skinClass = useSkinClass()

/**
 * 今天走得够不够（步数没同步过就不干预 —— 不猜、不按 0 算）。
 * 阈值取目标的 60%：低于它基本可以确定"今天坐太久了"。
 */
const moveFirst = computed(() => body.todayStep !== null && body.todayStep < body.goal * 0.6)

onShow(() => {
  daily.ensureToday()
})

const current = computed(() => box.todayDrawn())
const done = computed(() => Boolean(current.value?.done))
const ideaText = computed(() => (current.value ? BOX_IDEAS[current.value.index] : ''))

const stageHint = computed(() => {
  if (done.value) return '这次动作已完成。明天同一时刻，再开一只。'
  return '花不了几分钟。先放下手机，把这件事做完再回来。'
})

function openOnce(): void {
  if (!daily.allDone) return
  box.draw(false, moveFirst.value)
  // 开盒不给分，达成才给（避免反复开关刷分）
  logTrace({ kind: 'action.box', text: '开启微行动盲盒', value: 0 })
}

const redrawOpen = ref(false)

function redraw(): void {
  if (!current.value) return
  redrawOpen.value = true
}

function doRedraw(): void {
  redrawOpen.value = false
  if (!current.value) return
  box.draw(true, moveFirst.value)
}

function finish(): void {
  box.markDone()
  logTrace({ kind: 'action.box', text: '完成今日微行动' })
  uni.showToast({ title: '完成。回来给身体鼓个掌', icon: 'none' })
}

function goAction(): void {
  navigateTo(ROUTES.tabAction)
}

</script>

<style lang="scss" scoped>
@import './index.scss';
</style>

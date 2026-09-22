<template>
  <!--
    小枢 BuddyFloat · 批次 D 全局浮层
    - 右下角常驻小枢（本体随三模式：温和助手/数据分析师/护法灵兽）；
    - 形阶：本体之外按**修为等级**长装饰（素/纹/光/器，见 config/buddyForms.ts），
      规则是"只加不减"，所以老用户回头看只会看到它比昨天更完整；
    - 职司：在哪个大厅就挂哪枚角印（鉴/漏/卷/履），不换本体也不加装饰；
    - 到点激励：早间窗 06-08 / 晚间窗 21-23 首次进入时弹一次（同窗节流防骚扰）；
    - 入定到点：预设入定时段当前生效时弹「该去翻转沙漏」，每 10 分钟至多一次；
    - 展开面板：今日四维 + 缺维建议 + 打开今日日课卡。
  -->
  <view class="bf">
    <!-- 到点激励 / 入定到点 横幅（不遮内容，可点走） -->
    <view
      v-if="tip"
      class="bf__tip"
      :class="{ 'is-reminder': tip.kind === 'reminder' }"
      @click="tip.kind === 'reminder' ? goSandglass() : dismissTip()"
    >
      <text class="bf__tip-mark">{{ tip.kind === 'reminder' ? '时' : buddyGlyph }}</text>
      <view class="bf__tip-body">
        <text class="bf__tip-title">{{ tip.title }}</text>
        <text class="bf__tip-text">{{ tip.text }}</text>
      </view>
      <view class="bf__tip-act">
        {{ tip.kind === 'reminder' ? '现在去' : '知道了' }}
      </view>
      <view v-if="tip.kind !== 'reminder'" class="bf__tip-x" @click.stop="dismissTip">×</view>
    </view>

    <!-- 展开面板 -->
    <view v-if="open" class="bf__mask" @click="close" />
    <view v-if="open" class="bf__panel">
      <view class="bf__panel-head">
        <view class="bf__orb" :class="[shapeClass, `tier-${buddyTier}`]">
          <view v-if="buddyTier >= 1" class="bf__orb-ring" />
          <view v-if="buddyTier >= 3" class="bf__orb-ring bf__orb-ring--out" />
          <text class="bf__orb-glyph">{{ buddyGlyph }}</text>
        </view>
        <view class="bf__panel-id">
          <view class="bf__panel-namerow">
            <text class="bf__panel-name">{{ assistantName }}</text>
            <text class="bf__panel-stage">{{ buddyStageName }}</text>
          </view>
          <text class="bf__panel-mode">{{ modeLabel }}模式{{ dutySuffix }} · 今日已点亮 {{ litCount }}/4 维</text>
        </view>
        <view class="bf__close" hover-class="gz-hover" @click="close">×</view>
      </view>

      <text class="bf__panel-greet">{{ greeting }}</text>
      <view class="bf__greet-fav" hover-class="gz-hover" @click="favGreeting">收藏这句</view>

      <view class="bf__dims">
        <view v-for="d in dims" :key="d.key" class="bf__dim">
          <view class="bf__dim-line">
            <view class="bf__dim-dot" :class="{ 'is-on': d.on }" :style="d.on ? { background: d.color } : {}" />
            <text class="bf__dim-label">{{ d.label }}</text>
            <text class="bf__dim-value" :class="{ 'is-dim': !d.on }">{{ d.value }}</text>
          </view>
        </view>
      </view>

      <view v-if="suggestion" class="bf__suggest">
        <text class="bf__suggest-label">小枢建议</text>
        <text class="bf__suggest-text">{{ suggestion }}</text>
      </view>

      <!--
        递话（2026-09-17）：到期的胶囊 / 今天该重逢的旧卡，一次只递一条。
        这是小枢替"收不到推送"这件事做的补偿：回来那一刻，先把该见的东西送到眼前。
      -->
      <view v-if="handoff" class="bf__hand" hover-class="gz-hover" @click="handoff.go()">
        <text class="bf__hand-label">{{ handoff.label }}</text>
        <text class="bf__hand-text">{{ handoff.text }}</text>
      </view>

      <!-- 你记住的那句：点了去看全部（没有收藏就不出现） -->
      <view v-if="remembered" class="bf__prov" hover-class="gz-hover" @click="goProverbs">
        <text class="bf__prov-label">{{ rememberedLabel }}</text>
        <text class="bf__prov-text">「{{ remembered.text }}」</text>
        <text v-if="remembered.from" class="bf__prov-from">—— {{ remembered.from }}</text>
      </view>

      <view class="bf__acts">
        <view class="bf__btn bf__btn--ghost" hover-class="gz-hover" @click="goMissing">
          {{ missingLabel || '四处逛逛' }}
        </view>
        <view class="bf__btn bf__btn--main" hover-class="gz-hover" @click="openDailyCard">
          今日日课卡
        </view>
      </view>
    </view>

    <!-- 悬浮球 -->
    <view
      v-if="!open"
      class="bf__fob"
      :class="[shapeClass, `tier-${buddyTier}`, { 'has-tip': tip && tip.kind === 'reminder' }]"
      hover-class="gz-hover"
      @click="open = true"
    >
      <view class="bf__fob-halo" />
      <!-- 形阶：三阶起加三点浮光，四阶起加外圈光带（只在上一阶基础上加，不替换） -->
      <view v-if="buddyTier >= 2" class="bf__fob-sparks">
        <view v-for="n in 3" :key="n" class="bf__fob-spark" :class="`is-${n}`" />
      </view>
      <view v-if="buddyTier >= 3" class="bf__fob-band" />
      <text class="bf__fob-glyph">{{ buddyGlyph }}</text>
      <!-- 职司印：在观持鉴 / 在止掌漏 / 在知展卷 / 在行着履 -->
      <view v-if="buddyDuty" class="bf__fob-duty">{{ buddyDuty.glyph }}</view>
      <view v-if="reminderDue" class="bf__fob-dot" />
    </view>

    <!--
      每日结算：23:00 后首次打开时全屏出现一次（一天一次，见 useBuddy.maybeSettle）。
      刻意不做成「第 N 天连续」那类压迫式总结 —— 只把今天真实入账的四维摊开。
    -->
    <view v-if="settleOpen" class="stl" @touchmove.stop.prevent>
      <view class="stl__card" @click.stop>
        <text class="stl__eyebrow">{{ modeLabel }}模式 · 一日收束</text>
        <text class="stl__title">{{ settleData.title }}</text>

        <view class="stl__dims">
          <view v-for="d in settleData.dims" :key="d.key" class="stl__dim">
            <view class="stl__dim-head">
              <view class="stl__dim-dot" :class="{ 'is-on': d.on }" :style="d.on ? { background: d.color } : {}" />
              <text class="stl__dim-label">{{ d.label }}</text>
              <text class="stl__dim-value" :class="{ 'is-dim': !d.on }">{{ d.value }}</text>
            </view>
            <view class="stl__dim-bar">
              <view class="stl__dim-fill" :style="{ width: d.on ? '100%' : '0%', background: d.color }" />
            </view>
          </view>
        </view>

        <view class="stl__rows">
          <view class="stl__row">
            <text class="stl__k">今日最高</text>
            <text class="stl__v">{{ settleData.top }}</text>
          </view>
          <view class="stl__row">
            <text class="stl__k">当前境界</text>
            <text class="stl__v">{{ settleData.level }} · {{ settleData.gap }}</text>
          </view>
        </view>

        <text class="stl__comment">{{ settleData.comment }}</text>

        <!--
          今天还没收功时给一条出口（2026-09-22）：
          这一刻正是"一天的句号"，用户刚看完读数，顺势把他送到写一句的地方。
          已经收过就不出现 —— 那一行会变成没意义的重复。
        -->
        <view v-if="!closing.todayClosed" class="stl__link" hover-class="gz-hover" @click="settleToClosing">
          去{{ cw.title }} · 留一句给今天 ›
        </view>

        <view class="stl__acts">
          <view class="stl__btn stl__btn--ghost" hover-class="gz-hover-btn" @click="settleToCard">
            看今日日课卡
          </view>
          <view class="stl__btn" hover-class="gz-hover-btn" @click="closeSettle">收下今天</view>
        </view>
      </view>
    </view>
  </view>
</template>

<script setup lang="ts">
/**
 * 小枢全局浮层（批次 D 前端）：
 * UI 薄壳 —— 所有状态与触发逻辑在 composables/useBuddy.ts（模块级单例），
 * 由宿主大厅页在自身 onShow 里调用 poke() 驱动（早/晚到点激励、入定到点、面板数据）。
 */
import { computed } from 'vue'
import { useBuddy } from '@/composables/useBuddy'
import { useModeStore } from '@/stores/mode'
import { useClosingStore } from '@/stores/closing'
import { closingWords } from '@/config/lexicon'
import { navigateTo, ROUTES } from '@/router/routes'

const modeStore = useModeStore()
/**
 * 小枢的三套外形（只换形状与描边，位置/尺寸/交互一律不动）：
 *   普通 = 圆润纸印 / 科技 = 切角面板 / 修仙 = 双环道印。
 * 颜色本来就随 --gz-accent 变，这里补上"形"，模式才有质感级的区别。
 */
const shapeClass = computed(() => `is-${modeStore.id}`)

const {
  open,
  tip,
  due: reminderDue,
  buddyGlyph,
  assistantName,
  modeLabel,
  buddyStageName,
  buddyTier,
  buddyDuty,
  litCount,
  greeting,
  dims,
  suggestion,
  missingLabel,
  closePanel: close,
  dismissTip,
  goSandglass,
  goMissing,
  openDailyCard,
  favGreeting,
  remembered,
  rememberedLabel,
  goProverbs,
  handoff,
  settleOpen,
  settleData,
  closeSettle,
} = useBuddy()

/** 面板副行的职司后缀：不在四个大厅里（我页 / 子页）就整段不出现，不写"闲置"这类废话 */
const dutySuffix = computed(() => (buddyDuty.value ? ` · ${buddyDuty.value.label}` : ''))

/** 今日收功的三模式叫法（结算面板那条出口用） */
const closing = useClosingStore()
const cw = computed(() => closingWords(modeStore.id))

/**
 * 结算 → 去写一句（2026-09-22）。
 * 交接走 store（`takeFocus`）而不是 query：**tab 页带不了参数**，
 * 与「止念 → 三件事」的 handoff 同一范式（请求写在跳之前，由「行」页 onShow 取）。
 */
function settleToClosing(): void {
  closeSettle()
  closing.requestFocus()
  navigateTo(ROUTES.tabAction)
}

/** 结算里「看今日日课卡」：先关结算层，再跳（否则返回时会看到结算层还在） */
function settleToCard(): void {
  closeSettle()
  openDailyCard()
}
</script>

<style lang="scss" scoped>
@import './BuddyFloat.scss';
</style>

<template>
  <view class="page" :class="skinClass">
    <!-- 顶栏 -->
        <SubNav :fallback="ROUTES.tabMe">成就墙 · 徽章</SubNav>

    <!-- 模式专属标志物：盖章册 / 解锁矩阵 / 功勋碑（图缺失时整块隐身） -->
    <ModuleMark mark="me.achievement" size="md" />

    <!-- 总况 -->
    <view class="head">
      <view class="head__left">
        <text class="head__num">{{ unlockedN }}<text class="head__total"> / {{ list.length }}</text></text>
        <text class="head__cap">枚徽章已解锁</text>
      </view>
      <view class="head__seal" :class="{ 'is-empty': unlockedN === 0 }">
        {{ unlockedN === 0 ? '白' : unlockedN >= list.length ? '满' : unlockedN }}
      </view>
    </view>

    <!-- 下一枚预告 -->
    <view class="next" :class="{ 'is-full': unlockedN === list.length }">
      <text class="next__cap">{{ unlockedN === list.length ? '已是全收集' : '下一枚' }}</text>
      <text class="next__title">{{ nextRule ? nextRule.rule.name : '所有徽章都已点亮' }}</text>
      <text class="next__desc">{{ nextRule ? badgeDesc(nextRule.rule, dl) : '继续修行，守住日常' }}</text>
    </view>

    <!-- 徽章墙 -->
    <view class="wall">
      <view
        v-for="item in list"
        :key="item.rule.id"
        class="tile"
        :class="{ 'is-locked': !item.unlocked }"
        hover-class="gz-hover"
        @click="open(item)"
      >
        <view class="tile__mark" :class="{ 'is-locked': !item.unlocked }">
          {{ item.rule.name.slice(0, 1) }}
        </view>
        <text class="tile__name">{{ item.rule.name }}</text>
        <text class="tile__state">{{ item.unlocked ? '已解锁' : '未达成' }}</text>
      </view>
    </view>

    <!--
      彩蛋（规格 §12.5 单人 9 个：原有 6 条 + 2026-09-17 接入的三条 —— 守得住 / 时空之约 / 温故知新）：
      与徽章分开列，因为它们是「意外惊喜」而非里程碑 —— 徽章管"攒够多少"，彩蛋管"某件不常发生的事真的发生过"。
      检测规则见 utils/easter.ts —— 全部用本地真实数据判定，凑不出来的条件不写进来。
    -->
    <view class="section">
      <view class="section__head">
        <text class="section__title">彩蛋</text>
        <text class="section__n">{{ eggUnlocked }}/{{ eggs.length }}</text>
      </view>
      <view class="eggs">
        <view
          v-for="e in eggs"
          :key="e.rule.id"
          class="egg"
          :class="{ 'is-locked': !e.unlocked }"
          hover-class="gz-hover"
          @click="openEgg(e)"
        >
          <view class="egg__mark" :class="{ 'is-locked': !e.unlocked }">{{ e.rule.name.slice(0, 1) }}</view>
          <view class="egg__body">
            <text class="egg__name">{{ e.rule.name }}</text>
            <text class="egg__desc">{{ e.rule.desc }}</text>
          </view>
          <text class="egg__state">{{ e.unlocked ? '已触发' : '未触发' }}</text>
        </view>
      </view>
      <text class="eggs__note">
        彩蛋只记录「触发过」；对应的外观奖励（夜间主题 / 头像框 / 形态 / 特效）属视觉进阶，
        需登录与后端下发，当前版本尚未开放。
      </text>
    </view>

    <!-- 说明脚注 -->
    <view class="foot">
      <text class="foot__text">全部由本机行为判定 · 随云备份一起同步</text>
    </view>

    <!-- 徽章详情层 -->
    <view v-if="detailOpen" class="mask" @click="detailOpen = false">
      <view class="sheet" @click.stop>
        <view class="sheet__mark" :class="{ 'is-locked': !activeUnlocked }">
          {{ currentRule.name.slice(0, 1) }}
        </view>
        <text class="sheet__title">{{ currentRule.name }}</text>
        <text class="sheet__cap">{{ activeUnlocked ? '已解锁' : '未达成 · 达成条件' }}</text>
        <text class="sheet__desc">{{ badgeDesc(currentRule, dl) }}</text>
        <view class="sheet__close" hover-class="gz-hover" @click="detailOpen = false">知道了</view>
      </view>
    </view>

    <!-- 彩蛋详情层 -->
    <view v-if="eggOpen && activeEgg" class="mask" @click="eggOpen = false">
      <view class="sheet" @click.stop>
        <view class="sheet__mark" :class="{ 'is-locked': !activeEggUnlocked }">
          {{ activeEgg.name.slice(0, 1) }}
        </view>
        <text class="sheet__title">{{ activeEgg.name }}</text>
        <text class="sheet__cap">{{ activeEggUnlocked ? '已触发' : '未触发 · 触发条件' }}</text>
        <text class="sheet__desc">{{ activeEgg.desc }}</text>
        <view class="sheet__reward">
          <text class="sheet__reward-k">解锁奖励</text>
          <text class="sheet__reward-v">{{ activeEgg.reward }}</text>
        </view>
        <text class="sheet__note">
          奖励为外观类（主题 / 头像框 / 小枢形态 / 特效），属视觉进阶，需登录与后端下发，当前版本尚未开放。
        </text>
        <view class="sheet__close" hover-class="gz-hover" @click="eggOpen = false">知道了</view>
      </view>
    </view>
  </view>
</template>

<script setup lang="ts">
/**
 * 成就墙 · 徽章（批次 C · 我）· 分包 subpkg-me。
 * 徽章（规格 §12.4 的 25 枚 + 箴言 3 枚）均由本地行为快照判定（规则见 config/badges.ts），
 * 与「我」页入口的已解锁数同源；点击徽章可看达成条件。
 */
import { computed, ref } from 'vue'
import { badgeDesc, evaluateBadges, type BadgeRule } from '@/config/badges'
import { buildBadgeContext } from '@/utils/growth'
import { evaluateEggs, type EggResult, type EggRule } from '@/utils/easter'
import { useSkinClass } from '@/composables/useSkin'
import { useDimLabel } from '@/composables/usePhrase'
import { ROUTES } from '@/router/routes'

const skinClass = useSkinClass()
/** 徽章描述里的四维职能词随模式变（累计静修 / 专注 / 定力满 60 分钟） */
const dl = useDimLabel()

interface BadgeItem {
  rule: BadgeRule
  unlocked: boolean
}

const list = computed<BadgeItem[]>(() => evaluateBadges(buildBadgeContext()))
const unlockedN = computed(() => list.value.filter((i) => i.unlocked).length)
const nextRule = computed(() => list.value.find((i) => !i.unlocked))

const detailOpen = ref(false)
const activeRule = ref<BadgeRule | null>(null)
const activeUnlocked = ref(false)
/** 弹层只读展示用（避免模板里做空值判断） */
const currentRule = computed<BadgeRule>(() => activeRule.value ?? { id: '', name: '', desc: '', hit: () => false })

function open(item: BadgeItem): void {
  activeRule.value = item.rule
  activeUnlocked.value = item.unlocked
  detailOpen.value = true
}

/* ---------------- 彩蛋 ---------------- */
const eggs = computed<EggResult[]>(() => evaluateEggs())
const eggUnlocked = computed(() => eggs.value.filter((e) => e.unlocked).length)

const eggOpen = ref(false)
const activeEgg = ref<EggRule | null>(null)
const activeEggUnlocked = ref(false)

function openEgg(e: EggResult): void {
  activeEgg.value = e.rule
  activeEggUnlocked.value = e.unlocked
  eggOpen.value = true
}

</script>

<style lang="scss" scoped>
@import './index.scss';
</style>

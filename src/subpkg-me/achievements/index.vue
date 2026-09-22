<template>
  <view class="page" :class="skinClass">
    <!-- 顶栏 -->
        <SubNav :fallback="ROUTES.tabMe">成就墙 · 徽章</SubNav>

    <!-- 模式专属标志物：盖章册 / 解锁矩阵 / 功勋碑（图缺失时整块隐身） -->
    <ModuleMark mark="me.achievement" size="md" />

    <!--
      本次点亮的回执（2026-09-22）：只在"刚点亮、还没看过"时出现。
      它是**一次性的**——名单在进页那一刻就被取走了，不是徽章的属性；
      所以它不会天天杵在墙上，第二次进来看不到。
    -->
    <view v-if="freshLine" class="lit">
      <text class="lit__mark">新</text>
      <text class="lit__text">{{ freshLine }}</text>
    </view>

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
        <text v-if="item.fresh" class="tile__new">新</text>
        <text class="tile__name">{{ item.rule.name }}</text>
        <text class="tile__state" :class="{ 'is-past': item.unlocked && !item.now }">{{ stateText(item) }}</text>
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
        <text class="sheet__cap">{{ activeCap }}</text>
        <text class="sheet__desc">{{ badgeDesc(currentRule, dl) }}</text>
        <text v-if="activePastNote" class="sheet__note">{{ activePastNote }}</text>
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
import { badgeDesc, BADGE_RULES, type BadgeRule } from '@/config/badges'
import { badgeStates } from '@/utils/growth'
import { useBadgeStore } from '@/stores/badges'
import { evaluateEggs, type EggResult, type EggRule } from '@/utils/easter'
import { useSkinClass } from '@/composables/useSkin'
import { useDimLabel } from '@/composables/usePhrase'
import { ROUTES } from '@/router/routes'

const skinClass = useSkinClass()
/** 徽章描述里的四维职能词随模式变（累计静修 / 专注 / 定力满 60 分钟） */
const dl = useDimLabel()

interface BadgeItem {
  rule: BadgeRule
  /** 解锁过（当下命中 或 有留痕） */
  unlocked: boolean
  /** 此刻仍然满足（用来把"正走在路上"与"走过、后来断了"分开讲） */
  now: boolean
  /** 首次点亮时刻；0 = 从未点亮 */
  at: number
  /** 这次进来之前刚点亮的（角标用，一进来看过就不再是新的了） */
  fresh: boolean
}

const ledger = useBadgeStore()

/*
 * 进来即当作「看过了」：新点亮的名单在进页这一刻取走，
 * 于是「新」角标只在第一次打开成就墙时出现 —— 它不是徽章的属性，是一次性的回执。
 */
const freshIds = ref<string[]>(ledger.takeFresh())
const freshSet = computed(() => new Set(freshIds.value))

const list = computed<BadgeItem[]>(() => {
  /*
   * 取「当下命中 ∪ 已留痕」的并集（2026-09-22）：依赖当下连续状态的「持恒 / 守七」
   * 不该因为漏了一天就熄灭 —— 详见 stores/badges.ts。
   * 同时把 `now`（此刻还满足）与 `at`（什么时候点亮的）一并带出来，供墙上分行细说。
   */
  const states = badgeStates()
  return BADGE_RULES.map((rule) => {
    const s = states[rule.id]
    return {
      rule,
      unlocked: s.ever,
      now: s.now,
      at: s.at,
      fresh: freshSet.value.has(rule.id),
    }
  })
})
const unlockedN = computed(() => list.value.filter((i) => i.unlocked).length)
const nextRule = computed(() => list.value.find((i) => !i.unlocked))

/** 首次点亮的月份：当年只写「9 月」，跨年带上年份（tile 一格放得下） */
function litLabel(at: number): string {
  const d = new Date(at)
  return d.getFullYear() === new Date().getFullYear()
    ? `${d.getMonth() + 1} 月点亮`
    : `${d.getFullYear()}.${d.getMonth() + 1} 点亮`
}

/** 具体到日（弹层里有位置，比 tile 说得清） */
function litDay(at: number): string {
  const d = new Date(at)
  const md = `${d.getMonth() + 1} 月 ${d.getDate()} 日`
  return d.getFullYear() === new Date().getFullYear() ? md : `${d.getFullYear()} 年 ${md}`
}

/**
 * 墙上那一格的状态文字。
 *
 * 三态各有各的话（2026-09-22）：此刻满足 → 「已解锁」；曾经点亮、现在断了 → 「9 月点亮」；
 * 从没点亮 → 「未达成」。中间那一档刻意**不写**「已失效 / 未保持」之类 ——
 * 它要说的不是"你不行了"，而是"这一枚是你的了"。
 */
function stateText(item: BadgeItem): string {
  if (item.now) return '已解锁'
  if (item.at > 0) return litLabel(item.at)
  return '未达成'
}

/** 顶部那条回执：单枚报名字，多枚报数量（超过三枚只列前三） */
const freshLine = computed(() => {
  const names = BADGE_RULES.filter((r) => freshSet.value.has(r.id)).map((r) => r.name)
  if (names.length === 0) return ''
  if (names.length === 1) return `点亮了「${names[0]}」`
  if (names.length <= 3) return `这次点亮了 ${names.join('、')}`
  return `这次点亮了 ${names.length} 枚：${names.slice(0, 3).join('、')} 等`
})

const detailOpen = ref(false)
const activeRule = ref<BadgeRule | null>(null)
const activeItem = ref<BadgeItem | null>(null)
const activeUnlocked = computed(() => Boolean(activeItem.value?.unlocked))
/** 弹层只读展示用（避免模板里做空值判断） */
const currentRule = computed<BadgeRule>(() => activeRule.value ?? { id: '', name: '', desc: '', hit: () => false })

const activeCap = computed(() => {
  const it = activeItem.value
  if (!it) return ''
  if (it.now) return '已解锁'
  if (it.at > 0) return `已点亮 · ${litDay(it.at)}`
  return '未达成 · 达成条件'
})

/** 曾点亮、此刻未延续时补一句，免得用户以为徽章坏了 */
const activePastNote = computed(() =>
  activeItem.value && !activeItem.value.now && activeItem.value.at > 0
    ? '走过就算数 —— 后来断了，也不会把这一枚收回去。'
    : '',
)

function open(item: BadgeItem): void {
  activeRule.value = item.rule
  activeItem.value = item
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

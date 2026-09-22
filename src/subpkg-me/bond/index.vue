<template>
  <view class="page" :class="skinClass">
    <!-- 顶栏：返回 + 标题 -->
        <SubNav :fallback="ROUTES.tabMe">小枢羁绊</SubNav>

    <!-- 羁绊卡 -->
    <view class="bond">
      <view class="bond__orb">
        <text class="bond__orb-glyph">{{ buddyGlyph }}</text>
      </view>
      <view class="bond__info">
        <view class="bond__head">
          <text class="bond__name">{{ assistantName }}</text>
          <view class="bond__lv">Lv.{{ bondLv }} · {{ bondLvName }}</view>
        </view>
        <text class="bond__sub">
          {{ bondNextGap > 0 ? `再见 ${bondNextGap} 次升级 · 累计见面 ${bondXp} 次` : '已至「一心」之境 · 与君同行' }}
        </text>
        <view class="bar">
          <view class="bar__fill" :style="{ width: `${bondPct}%` }" />
        </view>
      </view>
    </view>
    <text class="bond__note">每一次问候、每一次打开面板，都算一次见面。羁绊只管小枢怎么说话，它的样子随境界长。</text>

    <!-- 形态谱：小枢的样子随**修为等级**长，与羁绊无关（两套成长刻意分开，不叠在一起） -->
    <view class="form">
      <view class="form__head">
        <text class="form__title">形态 · {{ buddyStageName }}</text>
        <text class="form__body">{{ buddyBodyName }}</text>
      </view>
      <view class="form__track">
        <view
          v-for="s in buddyStages"
          :key="s.idx"
          class="form__step"
          :class="{ 'is-on': s.on, 'is-cur': s.cur }"
        >
          <view class="form__dot" />
          <text class="form__name">{{ s.name }}</text>
          <text class="form__from">{{ s.idx === 0 ? '初始' : `「${s.from}」起` }}</text>
        </view>
      </view>
      <text class="form__note">{{ buddyStageNote }}</text>
      <text class="form__next">{{ stageNext }}</text>
    </view>

    <!-- 对话录 / 箴言墙 切换 -->
    <view class="tabs">
      <view
        class="tabs__item"
        :class="{ 'is-on': tab === 'lines' }"
        hover-class="gz-hover"
        @click="tab = 'lines'"
      >
        对话录
      </view>
      <view
        class="tabs__item"
        :class="{ 'is-on': tab === 'favs' }"
        hover-class="gz-hover"
        @click="tab = 'favs'"
      >
        箴言墙<text v-if="favs.length" class="tabs__count">{{ favs.length }}</text>
      </view>
    </view>

    <!-- 对话录 -->
    <view v-if="tab === 'lines'" class="sec">
      <view v-if="groups.length === 0" class="empty gz-motion">
        <text class="empty__title">{{ $p('empty.bond.title') }}</text>
        <text class="empty__text">{{ $p('empty.bond.desc') }}</text>
      </view>
      <view v-for="g in groups" :key="g.label" class="grp">
        <text class="grp__label">{{ g.label }}</text>
        <view class="line" v-for="item in g.items" :key="item.key">
          <view class="line__dot" :class="`is-${item.kind}`" />
          <view class="line__body">
            <text class="line__text">{{ item.text }}</text>
            <text class="line__meta">{{ KIND_LABEL[item.kind] }} · {{ item.time }}</text>
          </view>
          <view
            class="line__fav"
            :class="{ 'is-on': item.fav }"
            hover-class="gz-hover"
            @click="toggleFav(item.raw)"
          >
            {{ item.fav ? '♥' : '♡' }}
          </view>
        </view>
      </view>
    </view>

    <!-- 箴言墙 -->
    <view v-else class="sec">
      <view v-if="favs.length === 0" class="empty">
        <text class="empty__title">箴言墙还空着</text>
        <text class="empty__text">遇到想留住的句子，点亮 ♡ 就会收进这里，时时回看。</text>
      </view>
      <view v-else class="tip">
        <text class="tip__text">收藏的句子也可以在「我 · 我的箴言」集中查看、搜索与置顶。</text>
      </view>
      <view v-for="f in favsView" :key="f.key" class="fav">
        <text class="fav__mark">「</text>
        <view class="fav__body">
          <text class="fav__text">{{ f.text }}</text>
          <text class="fav__meta">{{ f.time }}</text>
        </view>
        <view class="fav__acts">
          <view class="fav__btn" hover-class="gz-hover" @click="copyLine(f.text)">复制</view>
          <view class="fav__btn fav__btn--off" hover-class="gz-hover" @click="toggleFav(f.raw)">移除</view>
        </view>
      </view>
    </view>

    <view class="foot">
      <text class="foot__text">小枢与你 · 来日方长</text>
    </view>

    <!-- 隐私授权拦截弹窗（复制羁绊文案前需征得同意） -->
    <PrivacyGate />
  </view>
</template>

<script setup lang="ts">
/**
 * 我 · 小枢羁绊（m7 批次 · 分包 subpkg-me/bond）：
 * 纯本地——对话录记录每一次到点问候 / 守护提醒 / 见面互动；
 * 箴言墙收纳收藏的小枢语录；羁绊等级随累计见面次数 Lv.1-20 渐进。
 * 数据源与逻辑在 composables/useBuddy.ts（模块级单例，随大厅 onShow poke 自动积累）。
 *
 * 本页同时是小枢「成长体系」的展示面：羁绊（怎么说话）+ 形态谱（长什么样）。
 * 两者刻意分开呈现——见 config/buddyForms.ts 顶部的分工说明。
 */
import { computed, ref } from 'vue'
import { useBuddy, type BuddyLine } from '@/composables/useBuddy'
import { useSkinClass } from '@/composables/useSkin'
import { ROUTES } from '@/router/routes'

const {
  buddyGlyph,
  assistantName,
  buddyStageName,
  buddyBodyName,
  buddyStageNote,
  buddyStages,
  buddyNextStageName,
  buddyStageGap,
  bondLv,
  bondLvName,
  bondXp,
  bondPct,
  bondNextGap,
  lines,
  favs,
  isFav,
  toggleFav,
} = useBuddy()

const skinClass = useSkinClass()

/** 下一阶提示：满了就说满了，不编"敬请期待" */
const stageNext = computed(() =>
  buddyStageGap.value > 0
    ? `距「${buddyNextStageName.value}」还差 ${buddyStageGap.value} 点修为`
    : '四阶已满 —— 形与器都在你手里了。',
)

const tab = ref<'lines' | 'favs'>('lines')

const KIND_LABEL: Record<BuddyLine['kind'], string> = {
  greet: '问候',
  guard: '守护',
  remind: '到点',
  meet: '见面',
  proverb: '开屏箴言',
}

const pad = (n: number): string => String(n).padStart(2, '0')

function fmtTime(at: number): string {
  const d = new Date(at)
  return `${pad(d.getHours())}:${pad(d.getMinutes())}`
}

function dayLabelOf(at: number): string {
  const d = new Date(at)
  const now = new Date()
  const isSame = (x: Date, y: Date): boolean =>
    x.getFullYear() === y.getFullYear() && x.getMonth() === y.getMonth() && x.getDate() === y.getDate()
  if (isSame(d, now)) return '今天'
  const yest = new Date(now)
  yest.setDate(now.getDate() - 1)
  if (isSame(d, yest)) return '昨天'
  return `${d.getMonth() + 1} 月 ${d.getDate()} 日`
}

interface LineView {
  key: string
  raw: BuddyLine
  kind: BuddyLine['kind']
  text: string
  time: string
  fav: boolean
}

interface Group {
  label: string
  items: LineView[]
}

const groups = computed<Group[]>(() => {
  const out: Group[] = []
  for (const l of lines.value) {
    const label = dayLabelOf(l.at)
    const last = out[out.length - 1]
    const item: LineView = {
      key: `${l.at}-${l.text}`,
      raw: l,
      kind: l.kind,
      text: l.text,
      time: fmtTime(l.at),
      /* 收藏状态直接问 proverb store（内部按 source+正文去重），收藏变化会触发重算 */
      fav: isFav(l),
    }
    if (last && last.label === label) {
      last.items.push(item)
    } else {
      out.push({ label, items: [item] })
    }
  }
  return out
})

const favsView = computed(() =>
  favs.value.map((f) => ({
    key: `${f.at}-${f.text}`,
    raw: f,
    text: f.text,
    time: `${dayLabelOf(f.at)} ${fmtTime(f.at)}`,
  })),
)

function copyLine(text: string): void {
  uni.setClipboardData({
    data: text,
    success: () => uni.showToast({ title: '已复制', icon: 'none' }),
  })
}

</script>

<style lang="scss" scoped>
@import './index.scss';
</style>

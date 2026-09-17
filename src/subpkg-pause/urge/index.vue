<template>
  <view class="page" :class="skinClass">
    <view class="nav">
      <view class="nav__side" hover-class="gz-hover" @click="goBack">
        <text class="nav__back">‹</text>
      </view>
      <text class="nav__title">止欲 · 冲动记录</text>
      <view class="nav__side" />
    </view>

    <view class="tabs">
      <view
        v-for="t in TABS"
        :key="t.id"
        class="tab"
        :class="{ 'is-on': tab === t.id }"
        hover-class="gz-hover"
        @click="tab = t.id"
      >
        {{ t.label }}
      </view>
    </view>

    <!-- ① 记一笔 -->
    <template v-if="tab === 'log'">
      <!-- 冷却期（两档：10 分钟 = 当下一口气 / 48 小时 = 大决定先放两天） -->
      <view v-if="cooling" class="cool">
        <text class="cool__label">冷却中 · {{ kindLabel }}</text>
        <text class="cool__time">{{ mmss }}</text>
        <text class="cool__note">{{ coolNote }}</text>
        <view class="cool__btn" hover-class="gz-hover" @click="finishCool">{{ coolBtn }}</view>
        <text class="cool__give" hover-class="gz-hover" @click="giveUpCool">不等了，直接记一笔</text>
      </view>
      <view v-else class="cool cool--idle">
        <text class="cool__label">冲动来了？</text>
        <text class="cool__note">先不决策，挑一档给自己 —— 走完这段算一笔定力。</text>
        <view class="chips">
          <view
            v-for="k in COOLDOWN_KINDS"
            :key="k.id"
            class="chip"
            :class="{ 'is-on': kind === k.id }"
            hover-class="gz-hover"
            @click="kind = k.id"
          >
            {{ k.label }}
          </view>
        </view>
        <text class="cool__hint">{{ kindNote }}</text>
        <view class="cool__btn" hover-class="gz-hover" @click="startCool">开始 {{ kindLabel }} 冷却</view>
      </view>

      <view class="form">
        <text class="form__label">① 是什么冲动</text>
        <view class="chips">
          <view
            v-for="t in URGE_TRIGGERS"
            :key="t"
            class="chip"
            :class="{ 'is-on': trigger === t }"
            hover-class="gz-hover"
            @click="trigger = t"
          >
            {{ t }}
          </view>
        </view>

        <text class="form__label">② 当时什么感觉</text>
        <view class="chips">
          <view
            v-for="f in URGE_FEELINGS"
            :key="f"
            class="chip"
            :class="{ 'is-on': feeling === f }"
            hover-class="gz-hover"
            @click="feeling = f"
          >
            {{ f }}
          </view>
        </view>

        <text class="form__label">③ 强度 {{ intensity }}/5</text>
        <view class="chips">
          <view
            v-for="n in [1, 2, 3, 4, 5]"
            :key="n"
            class="chip chip--num"
            :class="{ 'is-on': intensity === n }"
            hover-class="gz-hover"
            @click="intensity = n"
          >
            {{ n }}
          </view>
        </view>

        <text class="form__label">④ 最后做了吗</text>
        <view class="chips">
          <view class="chip" :class="{ 'is-on': !acted }" hover-class="gz-hover" @click="acted = false">
            没做
          </view>
          <view class="chip" :class="{ 'is-on': acted }" hover-class="gz-hover" @click="acted = true">
            做了
          </view>
        </view>

        <text class="form__label">⑤ 换成了什么（选填）</text>
        <input
          v-model="alternative"
          class="form__input"
          placeholder="例如：下楼走了十分钟"
          placeholder-class="form__ph"
          :maxlength="24"
        />

        <view class="btn" hover-class="gz-hover" @click="save">记下这一笔</view>
        <text class="form__note">
          记的是「发生过的事」，不是「做得对不对」。没忍住也照记 —— 那一笔最有信息量。
        </text>

        <!--
          情境化省察（规格 §4.3）：刚记完的这一笔就是「由头」，就地反问一句。
          只在记完这一笔之后出现，且当天说过「先不写」就不再问。
        -->
        <SceneProbe scene="urge" :anchor="lastAnchor" />
      </view>
    </template>

    <!-- ② 触发点地图 -->
    <template v-else>
      <view class="insight">
        <text class="insight__text">{{ urge.insight }}</text>
      </view>

      <view class="section">
        <view class="section__title">按触发点</view>
        <view v-if="urge.byTrigger.length" class="rows">
          <view v-for="r in urge.byTrigger" :key="r.trigger" class="row">
            <text class="row__name">{{ r.trigger }}</text>
            <view class="row__bar">
              <view class="row__fill" :style="{ width: `${rowPct(r.count)}%` }" />
            </view>
            <text class="row__meta">{{ r.count }} 次 · 强度 {{ r.avgIntensity }} · 忍住 {{ r.resistedRate }}%</text>
          </view>
        </view>
        <text v-else class="empty">还没有记录。先去左边的「记一笔」攒几次。</text>
      </view>

      <view class="section">
        <view class="section__title">按时段</view>
        <view class="bands">
          <view v-for="b in urge.byHourBand" :key="b.band" class="band">
            <view class="band__track">
              <view class="band__fill" :style="{ height: `${b.pct}%` }" />
            </view>
            <text class="band__n">{{ b.count }}</text>
            <text class="band__label">{{ b.label }}</text>
          </view>
        </view>
        <text class="section__note">深夜那一箱单独列 —— 多数失控发生在那里。</text>
      </view>

      <view class="section">
        <view class="section__title">最近记录</view>
        <view v-if="recent.length" class="logs">
          <view v-for="r in recent" :key="r.id" class="log">
            <text class="log__when">{{ whenOf(r.at) }}</text>
            <text class="log__text">{{ r.trigger }} · {{ r.feeling }} · 强度 {{ r.intensity }} · {{ r.acted ? '做了' : '没做' }}</text>
            <text v-if="r.alternative" class="log__alt">→ {{ r.alternative }}</text>
            <text class="log__del" hover-class="gz-hover" @click="remove(r.id)">删</text>
          </view>
        </view>
        <text v-else class="empty">暂无记录。</text>
      </view>
    </template>
  </view>
</template>

<script setup lang="ts">
/**
 * 止欲 · 冲动记录 + 触发点地图 + 冷却期（分包 subpkg-pause）—— 规格 v2 §4.2 轴一「止欲」层。
 * 一次冲动记四件事：什么时候、什么情境、什么感觉、最后做没做。
 * 攒够样本后地图会把形状显出来 —— 结论只在样本 ≥ 5 时才敢下。
 * 冷却期两档：10 分钟（当下一口气）/ 48 小时（想买、想做的大决定先放两天）。
 * 样式外置在 urge/index.scss（超过 100 行，按项目约定拆出）。
 */
import { computed, ref } from 'vue'
import { onLoad, onShow, onUnload } from '@dcloudio/uni-app'
import {
  COOLDOWN_KINDS,
  URGE_FEELINGS,
  URGE_TRIGGERS,
  cooldownKindMeta,
  useUrgeStore,
} from '@/stores/urge'
import type { CooldownKind } from '@/stores/urge'
import { useSkinClass } from '@/composables/useSkin'
import SceneProbe from '@/components/SceneProbe/SceneProbe.vue'
import { ROUTES } from '@/router/routes'

const urge = useUrgeStore()
const skinClass = useSkinClass()

const TABS = [
  { id: 'log' as const, label: '记一笔' },
  { id: 'map' as const, label: '触发点地图' },
]
const tab = ref<'log' | 'map'>('log')

onLoad((query) => {
  if (query?.tab === 'map') tab.value = 'map'
})

/* ---------------- 冷却期 ---------------- */
const remain = ref(0)
let ticker: ReturnType<typeof setInterval> | null = null

/** 用户选的那一档（冷却进行中时同步成 store 里那一段的档位，免得文案对不上） */
const kind = ref<CooldownKind>('quick')
const kindMeta = computed(() => cooldownKindMeta(kind.value))
const kindLabel = computed(() => kindMeta.value.label)
const kindNote = computed(() => kindMeta.value.note)

const cooling = computed(() => remain.value > 0)
/** 倒计时文案统一在 store 里出（快档 MM:SS / 长档「N 天 N 小时」） */
const mmss = computed(() => {
  void remain.value
  return urge.cooldownText()
})

/** 冷却中的说明与按钮也随档 —— 48 小时那一档不能写成"十分钟后还想做那就做" */
const coolNote = computed(() =>
  kind.value === 'long'
    ? '两天后再看还想不想 —— 大决定不怕晚两天。'
    : '十分钟后还想做，那就做 —— 但多数冲动撑不过这段时间。',
)
const coolBtn = computed(() => (kind.value === 'long' ? '两天到了，我还在想' : '十分钟到了'))

function refreshRemain(): void {
  remain.value = urge.cooldownRemain()
  if (remain.value <= 0 && ticker) stopTick()
}

function stopTick(): void {
  if (ticker) {
    clearInterval(ticker)
    ticker = null
  }
}

function startTick(): void {
  stopTick()
  ticker = setInterval(refreshRemain, 1000)
}

function startCool(): void {
  urge.startCooldown(kind.value)
  refreshRemain()
  startTick()
}

function finishCool(): void {
  urge.finishCooldown()
  stopTick()
  remain.value = 0
  uni.showToast({ title: '走完一段冷却 · 3 点定力入账', icon: 'none' })
}

function giveUpCool(): void {
  urge.clearCooldown()
  stopTick()
  remain.value = 0
}

onShow(() => {
  /* 冷却可能是在止页起的，也可能是跨天回来的 —— 先把档位对齐再刷新 */
  kind.value = urge.cooldownKind
  refreshRemain()
  if (remain.value > 0) startTick()
})

onUnload(() => stopTick())

/* ---------------- 记一笔 ---------------- */
const trigger = ref<string>(URGE_TRIGGERS[0])
const feeling = ref<string>(URGE_FEELINGS[0])
const intensity = ref(3)
const acted = ref(false)
const alternative = ref('')
/** 刚记下那一笔的溯源锚点（空 = 还没记过，不显示省察） */
const lastAnchor = ref('')

function save(): void {
  const rec = urge.add({
    trigger: trigger.value,
    feeling: feeling.value,
    intensity: intensity.value,
    acted: acted.value,
    alternative: alternative.value,
  })
  if (!rec) {
    uni.showToast({ title: '先选一个触发点', icon: 'none' })
    return
  }
  alternative.value = ''
  acted.value = false
  intensity.value = 3
  lastAnchor.value = `urge-${rec.id}`
  uni.showToast({ title: '记下了 · 2 点修为', icon: 'none' })
}

/* ---------------- 地图 ---------------- */
const recent = computed(() => urge.records.slice(0, 20))

function rowPct(count: number): number {
  const max = Math.max(1, ...urge.byTrigger.map((r) => r.count))
  return Math.round((count / max) * 100)
}

function whenOf(at: number): string {
  const d = new Date(at)
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getMonth() + 1}/${d.getDate()} ${pad(d.getHours())}:${pad(d.getMinutes())}`
}

function remove(id: number): void {
  uni.showModal({
    title: '删掉这一笔？',
    content: '它会从地图统计里一并移除。',
    confirmText: '删除',
    cancelText: '留着',
    success: (res) => {
      if (res.confirm) urge.remove(id)
    },
  })
}

function goBack(): void {
  const pages = getCurrentPages()
  if (pages.length > 1) {
    uni.navigateBack()
  } else {
    uni.switchTab({ url: ROUTES.tabPause })
  }
}
</script>

<style lang="scss" scoped>
@import './index.scss';
</style>

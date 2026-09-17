/**
 * 情境化省察 store —— 规格 v2 §4.3 省察轴 / §11 内容量（情境省察 3 个）。
 *
 * 与「每日灵魂拷问」的关系，就是这个 store 存在的全部理由：
 *   每日拷问**一天只有一次**（§4.3：硬绑时段会把省察变成打卡任务，为了凑次数而敷衍作答，
 *   恰好背离省察的本意）；情境化省察由**具体事件**触发（冲动后 / 违约后 / 周报后），
 *   **不占那个额度** —— 两者数据完全独立，这里的作答不影响 question store 的 answeredToday()。
 *
 * 三个刻意不做的事：
 *   1. **不做常驻入口**（§13.1：省察若在知大厅常驻，就变成第二个每日待办）——
 *      它只在事件发生后就地出现一次，答完即走；
 *   2. **不强制** —— 可以「先不写」，跳过不扣分、不记痕迹，且当天不再问（低频 + 有由头）；
 *   3. **同一情境同一天只入账一次修为** —— 否则「记一笔冲动 → 答一题 → 拿 8 分」
 *      就成了一条刷分路径，而省察的价值是自我认知，不是分。
 *
 * 接脊椎：每条作答都带 `ref` 回溯到触发它的那件事（urge-<id> / vow-<ts> / weekly-<周一>），
 * 于是「这句反思是哪来的」永远查得到（§4 全局：脊椎的 ref 溯源）。
 */
import { defineStore } from 'pinia'
import { computed, ref } from 'vue'
import type { ModeId } from '@/config/modes'
import { todayKey } from '@/stores/daily'
import { useKnowledgeStore } from '@/stores/knowledge'
import { useTraceStore } from '@/stores/trace'
import { logTrace } from '@/utils/traceLog'

/**
 * 触发情境（§11：原 3 个 —— 冲动后 / 违约后 / 周报后）。
 * 2026-09-17（四）加第 4 个 `thought`（反刍后）：止念写下"做不了、但还惦记"的那一念之后，
 * 就地反问一句"它还在你脑子里打转吗" —— 这是「放下了还惦记」这个信号唯一的自陈渠道。
 */
export type ProbeScene = 'urge' | 'vow' | 'weekly' | 'thought'

export interface ProbeRecord {
  /** 溯源锚点：urge-<id> / vow-<ts> / weekly-<周一>，与 trace.ref 同名同值 */
  ref: string
  scene: ProbeScene
  /** 当时问的那句（存下来，因为题目会随模式变） */
  q: string
  answer: string
  at: number
}

export const PROBE_SCENE_LABEL: Record<ProbeScene, string> = {
  urge: '冲动后',
  vow: '违约后',
  weekly: '周报后',
  thought: '止念后',
}

/**
 * 三情境 × 三模式（§5.5：反问话术的措辞随模式变化 —— 同一件事，问法不同）。
 * 措辞一律**只问不评**：不写「你又没忍住」「下次要注意」这类评判，
 * 破约的那一问也只问「当时在做什么」，不问「为什么又没做到」。
 */
const SCENE_Q: Record<ProbeScene, Record<ModeId, string>> = {
  urge: {
    normal: '刚才那一下，是什么先动的 —— 手、眼睛，还是心里那句话？',
    tech: '这次触发里，哪个变量最先越过了阈值？',
    dao: '这一念心动，是从何处起的？',
  },
  vow: {
    normal: '破的那一刻，你正在做什么？',
    tech: '违约那一刻，哪个前置条件没成立？',
    dao: '破戒之时，你身在何处、心在何处？',
  },
  weekly: {
    normal: '这一周，有什么是你一直在绕开的？',
    tech: '这一周，有一条你始终没跑的循环吗？',
    dao: '这一周，有一件事你一直绕着走吗？',
  },
  /**
   * 反刍后：那一念已经写到纸上、也判了"现在做不了"。
   * 这一问只关心一件事 —— 它是不是又回去了（放下 ≠ 停止）。
   * 不写「你怎么还在想」，不问「为什么放不下」。
   */
  thought: {
    normal: '记下这一念之后，它还在你脑子里打转吗？',
    tech: '这一念落到纸上之后，它回来过吗？大概隔了多久？',
    dao: '落笔之后，此念可曾去而复返？',
  },
}

/** 存档上限：一天情境题再多，200 条也够回看很久 */
const CAP = 200

export const useProbeStore = defineStore(
  'probe',
  () => {
    const records = ref<ProbeRecord[]>([])
    /** 场景 → 跳过那天（YYYY-MM-DD）；跳过后当天不再问 */
    const skipped = ref<Record<string, string>>({})

    function questionOf(scene: ProbeScene, mode: ModeId): string {
      return SCENE_Q[scene][mode] ?? SCENE_Q[scene].normal
    }

    function of(anchor: string): ProbeRecord | undefined {
      return records.value.find((r) => r.ref === anchor)
    }

    function answered(anchor: string): boolean {
      return Boolean(of(anchor)?.answer)
    }

    /** 这个情境今天已经说过「先不写」 */
    function skippedToday(scene: ProbeScene): boolean {
      return skipped.value[scene] === todayKey()
    }

    /** 跳过：只记日期，不落痕迹、不扣分（跳过本身不该被记录成一次「没做」） */
    function skip(scene: ProbeScene): void {
      skipped.value[scene] = todayKey()
    }

    /**
     * 写下回答：存档 + 落 reflect.probe 痕迹（带 ref 溯源）+ 沉淀一张 Lv.3 卡。
     * 与每日拷问同口径 —— 当场写下的一手反思就是内化，不必再「加深」两次。
     */
    function answer(scene: ProbeScene, anchor: string, text: string, mode: ModeId): boolean {
      const t = text.trim()
      if (!t) return false
      const q = questionOf(scene, mode)

      const exist = of(anchor)
      if (exist) {
        exist.answer = t
        exist.q = q
        exist.at = Date.now()
      } else {
        records.value.unshift({ ref: anchor, scene, q, answer: t, at: Date.now() })
        if (records.value.length > CAP) records.value = records.value.slice(0, CAP)
      }

      const trace = useTraceStore()
      const day = todayKey()
      const prefix = `${scene}-`
      const credited = trace
        .ofDay(day)
        .some((x) => x.kind === 'reflect.probe' && x.ref?.startsWith(prefix))
      logTrace({
        kind: 'reflect.probe',
        text: `${PROBE_SCENE_LABEL[scene]}的一问`,
        ref: anchor,
        value: credited ? 0 : 8,
      })

      useKnowledgeStore().add({
        kind: 'note',
        title: `${PROBE_SCENE_LABEL[scene]} · 省察`,
        content: t,
        tags: ['省察', PROBE_SCENE_LABEL[scene]],
        depth: 3,
        src: '知 · 情境省察',
      })
      return true
    }

    /** 某情境的全部作答（档案 / 回看用） */
    function listOf(scene: ProbeScene): ProbeRecord[] {
      return records.value.filter((r) => r.scene === scene)
    }

    const total = computed(() => records.value.length)

    return {
      records,
      skipped,
      questionOf,
      of,
      answered,
      skippedToday,
      skip,
      answer,
      listOf,
      total,
    }
  },
  {
    persist: { key: 'probe', paths: ['records', 'skipped'] },
  },
)

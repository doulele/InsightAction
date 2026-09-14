/**
 * usePhrase —— 主题化取词 composable。
 *
 * 页面里一行接入：
 *   const p = usePhrase()
 *   {{ p('assess.next') }}            // 当前模式的说法
 *   {{ p('switch.note', target.id) }} // 指定模式的说法（切换确认框预览目标模式）
 *
 * 为什么做成 composable：phrases.ts 不能引 store（会成环），
 * 而每个页面都重复 import content/mode store + 手写取词函数太啰嗦、容易写歪。
 */
import { useContentStore } from '@/stores/content'
import { useModeStore } from '@/stores/mode'
import type { PhraseKey } from '@/config/phrases'
import type { ModeId } from '@/config/modes'

export function usePhrase() {
  const content = useContentStore()
  const mode = useModeStore()
  return (key: PhraseKey, target?: ModeId): string => content.phraseOf(key, target ?? mode.id)
}

/** 四维键（与测评维度、四个大厅同名同义） */
export type DimKey = 'observe' | 'pause' | 'reflect' | 'action'

/**
 * 大厅符号固定为「观止知行」——它是全站骨架（tabBar 与四厅入口不随模式变），
 * 所以只有后面的**职能词**换说法：观 · 辨源 / 观 · 摄入 / 观 · 鉴源。
 */
const HALL_MARK: Record<DimKey, string> = { observe: '观', pause: '止', reflect: '知', action: '行' }

const DIM_PHRASE: Record<DimKey, PhraseKey> = {
  observe: 'dim.observe',
  pause: 'dim.pause',
  reflect: 'dim.reflect',
  action: 'dim.action',
}

/**
 * 四维标签 composable（页面里一行接入）：
 *   const dl = useDimLabel()
 *   dl('observe')        // 普通「观 · 辨源」/ 科技「观 · 摄入」/ 修仙「观 · 鉴源」
 *   dl('pause', 'dao')   // 指定模式（用于切换预览）
 *
 * 为什么要它：`观 · 辨源` 这类标签原先硬编码在 6 处页面里（我页四维、日课卡、
 * 日历、导出文本、小枢浮层、测评维度图），散着写就永远是同一套说法 ——
 * 三模式切换时，用户每天最先看到的那行字反而不变，等于没换模式。
 */
export function useDimLabel() {
  const p = usePhrase()
  return (key: DimKey, target?: ModeId): string => `${HALL_MARK[key]} · ${p(DIM_PHRASE[key], target)}`
}

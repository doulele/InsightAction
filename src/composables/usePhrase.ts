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

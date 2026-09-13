/**
 * 全局模板属性声明：配合 main.ts 注册的 `$p`（主题化取词）。
 *
 * 模板里直接写 {{ $p('empty.habits.title') }}，不需要每个页面 import store。
 * 放在 .d.ts 里是为了让 vue-tsc 在模板中也认识 $p，避免"属性不存在"的类型报错。
 */
import type { PhraseKey } from '@/config/phrases'
import type { ModeId } from '@/config/modes'

declare module 'vue' {
  interface ComponentCustomProperties {
    /**
     * 取当前模式（或指定模式）的主题化短语。
     * @param key  短语键，见 src/config/phrases.ts 的 PHRASE_KEYS
     * @param mode 省略则用当前模式；传值可用于"预览目标模式"的弹窗文案
     */
    $p: (key: PhraseKey, mode?: ModeId) => string
  }
}

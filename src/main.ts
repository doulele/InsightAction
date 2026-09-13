import { createSSRApp } from 'vue'
import App from './App.vue'
import { setupPinia } from './stores'
import { useContentStore } from './stores/content'
import { useModeStore } from './stores/mode'
import type { PhraseKey } from './config/phrases'
import type { ModeId } from './config/modes'

export function createApp() {
  const app = createSSRApp(App)

  // Pinia：统一状态管理，内置 uni.setStorageSync 持久化插件
  app.use(setupPinia())

  /**
   * 全局主题化取词：模板里直接 {{ $p('assess.next') }} / {{ $p('switch.note', target.id) }}。
   *
   * 为什么做成全局属性：主题化文案散在十几个页面的空状态与小字里，
   * 逐页 import store + 手写取词函数既啰嗦又容易漏；这里统一一个入口。
   * 注意必须在**调用时**才解析 store —— 注册这一刻 pinia 刚装上、但组件还没渲染，
   * 提前解析会拿到未就绪的实例。
   */
  app.config.globalProperties.$p = (key: PhraseKey, mode?: ModeId): string =>
    useContentStore().phraseOf(key, mode ?? useModeStore().id)

  return {
    app,
  }
}

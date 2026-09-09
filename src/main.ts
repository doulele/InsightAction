import { createSSRApp } from 'vue'
import App from './App.vue'
import { setupPinia } from './stores'

export function createApp() {
  const app = createSSRApp(App)

  // Pinia：统一状态管理，内置 uni.setStorageSync 持久化插件
  app.use(setupPinia())

  return {
    app,
  }
}

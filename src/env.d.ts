/// <reference types="vite/client" />

declare module '*.vue' {
  import type { DefineComponent } from 'vue'
  // eslint-disable-next-line @typescript-eslint/no-explicit-any, @typescript-eslint/ban-types
  const component: DefineComponent<{}, {}, any>
  export default component
}

/** 自定义环境变量（.env / .env.development 等），此处集中声明以获得类型提示 */
interface ImportMetaEnv {
  /** 后端 API 基础地址；留空时前端自动进入 mock 模式 */
  readonly VITE_API_BASE_URL?: string
  /** 是否强制走本地 mock：'true' | 'false'，默认 dev 且无 baseUrl 时自动开启 */
  readonly VITE_USE_MOCK?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}

/** skin.ts 等用 process.env.NODE_ENV 区分环境（uni 构建时由 vite define 替换） */
declare const process: {
  env: Record<string, string | undefined>
}

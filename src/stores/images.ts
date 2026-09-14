/**
 * 图片缓存 store —— 「进来拉一次，之后全走本地文件」。
 * ================================================
 *
 * 要解决的问题：横幅图与模块标志物都是远端地址，`<image :src="远端地址">`
 * 每渲染一次就交给框架去取一次网（跨页面、切模式返回、反复进出子页都会重来），
 * 既慢又费流量。
 *
 * 这里的做法：首次用到某个地址时**下载到本地临时文件**，之后所有用图的地方
 * 都拿本地路径 —— 同一个地址在整个会话里只请求一次，二次进入是**磁盘直读**。
 *
 * 四条设计约束：
 *  1. **同步返回，不阻塞渲染**：`resolve()` 是同步的（有缓存给本地路径，
 *     没有则先返回原地址并**顺手**触发一次后台下载）。渲染永不等网络。
 *  2. **响应式升级**：下载完成后写入响应式映射 → 用到它的 computed 自动重算，
 *     图片"无感"地从远端切换成本地（不会闪、不会重排）。
 *  3. **失败有冷却**：下载失败记时间戳，同一会话内 5 分钟不再重试 ——
 *     否则渲染循环里会对着坏地址反复打网（这是最容易踩的坑）。
 *  4. **落盘可跨会话**：映射持久化；冷启动先校验本地文件是否还在
 *     （临时目录会被系统清理），不在就剔除、回落到远端地址并重新下载。
 */
import { defineStore } from 'pinia'
import { ref } from 'vue'

/** 下载失败后的冷却时间：这段时间内不再重试同一个地址 */
const FAIL_COOLDOWN_MS = 5 * 60 * 1000

/** FileSystemManager 的最小结构（只用到存在性校验） */
interface MiniFs {
  accessSync?: (path: string) => void
}
const fs = (uni as unknown as { getFileSystemManager?: () => MiniFs }).getFileSystemManager?.()

/**
 * 判断一个临时文件路径是否**能用 accessSync 校验**。
 *
 * 真机：downloadFile 给的是 `wxfile://tmp_xxx` 或绝对路径 → 可校验 ✓
 * 开发者工具：给的是 `http://tmp/xxx` 伪路径（面板里会看到 307 内部跳转）→ 不可校验 ✗
 *
 * 为什么必须区分：若把"工具里的伪路径"也当失效处理，每次冷启动都会清空整表、
 * 图片全部重新下载（Network 面板刷满请求）。伪路径一律保守保留。
 */
function isVerifiablePath(path: string): boolean {
  if (!path) return false
  if (path.startsWith('wxfile://')) return true
  if (path.includes('://')) return false
  return path.startsWith('/')
}

export const useImageStore = defineStore(
  'images',
  () => {
    /** 远端地址 → 本地临时文件路径 */
    const map = ref<Record<string, string>>({})
    /** 正在下载中（防并发重复下载同一个地址） */
    const inflight = ref<Record<string, boolean>>({})
    /** 失败时间戳（做冷却，不无限重试） */
    const failed = ref<Record<string, number>>({})

    /**
     * 取可直接给 `<image src>` 用的地址（同步）。
     *
     * - 已有本地文件 → 返回本地路径（磁盘直读，不再打网）
     * - 否则 → 返回原远端地址（保证立刻能显示）并后台下载，成功后自动切换到本地
     * - 空地址 → undefined（调用方据此隐藏元素）
     */
    function resolve(url?: string): string | undefined {
      if (!url) return undefined
      const local = map.value[url]
      if (local) return local
      void prefetch(url)
      return url
    }

    /** 本地路径（仅当已缓存；不触发下载）—— 用于"命中率"这类自检 */
    function localOf(url?: string): string | undefined {
      return url ? map.value[url] : undefined
    }

    /** 让某个地址的本地缓存作废（文件被系统清理/读失败时调用），下次用到会重新下载 */
    function invalidate(url?: string): void {
      if (!url) return
      delete map.value[url]
      delete failed.value[url]
    }

    /** 下载单个地址到本地（已缓存 / 下载中 / 冷却中都会直接返回） */
    function prefetch(url?: string): Promise<void> {
      if (!url || map.value[url] || inflight.value[url]) return Promise.resolve()

      const lastFail = failed.value[url]
      if (lastFail && Date.now() - lastFail < FAIL_COOLDOWN_MS) return Promise.resolve()

      inflight.value[url] = true
      return new Promise<void>((resolve) => {
        uni.downloadFile({
          url,
          success: (res) => {
            const path = (res as { tempFilePath?: string }).tempFilePath
            if (res.statusCode === 200 && path) {
              map.value[url] = path
              if (failed.value[url]) delete failed.value[url]
            } else {
              failed.value[url] = Date.now()
            }
          },
          fail: () => {
            failed.value[url] = Date.now()
          },
          complete: () => {
            delete inflight.value[url]
            resolve()
          },
        })
      })
    }

    /** 批量预热（并发发起，互不阻塞；失败静默） */
    async function prefetchMany(urls: (string | undefined)[]): Promise<void> {
      await Promise.all(urls.filter((u): u is string => Boolean(u)).map((u) => prefetch(u)))
    }

    /**
     * 预热**单张**图（只用于"进页面马上就会看到"的图，比如当前模式的横幅）。
     *
     * 刻意不做"整套预热"：模块标志物都在子页里，进大厅就把它们全下下来属于白花流量，
     * 也会让人疑惑"我还没进那一页，怎么先请求了"。标志物改由 ModuleMark 组件
     * 在被挂载时触发下载 —— 一次下载、之后本地直读，请求数最小。
     */
    function warmBanner(remoteUrl?: string): void {
      void prefetch(remoteUrl)
    }

    /**
     * 冷启动校验：持久化下来的本地文件可能已被系统清掉，逐条确认，失效的剔除。
     * 只对"可校验的真实路径"动手，伪路径（开发者工具的 http://tmp/…）保守保留 ——
     * 详见 isVerifiablePath 的注释（不这么做会导致每次冷启动整表失效、图片反复重下）。
     */
    async function verifyExisting(): Promise<void> {
      if (!fs?.accessSync) return
      for (const [url, path] of Object.entries(map.value)) {
        if (!isVerifiablePath(path)) continue
        try {
          fs.accessSync(path)
        } catch {
          delete map.value[url]
        }
      }
    }

    return { map, resolve, localOf, invalidate, prefetch, prefetchMany, warmBanner, verifyExisting }
  },
  {
    /* 只持久化映射本身；inflight / failed 是运行态，不该落盘 */
    persist: { key: 'images', paths: ['map'] },
  },
)

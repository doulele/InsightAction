/**
 * 图片缓存 store —— 「进来拉一次，之后全走本地文件」。
 * ================================================
 *
 * 要解决的问题：横幅图与模块标志物都是远端地址，`<image :src="远端地址">`
 * 每渲染一次就交给框架去取一次网（跨页面、切模式返回、反复进出子页都会重来），
 * 既慢又费流量。
 *
 * 这里的做法：首次用到某个地址时**下载下来并搬进私有永久目录**，之后所有用图的地方
 * 都拿本地路径 —— 同一个地址只在第一次请求，二次进入是**磁盘直读**。
 *
 * 四条设计约束：
 *  1. **同步返回，不阻塞渲染**：`resolve()` 是同步的（有缓存给本地路径，
 *     没有则先返回原地址并**顺手**触发一次后台下载）。渲染永不等网络。
 *  2. **响应式升级**：下载完成后写入响应式映射 → 用到它的 computed 自动重算，
 *     图片"无感"地从远端切换成本地（不会闪、不会重排）。
 *  3. **失败有冷却**：下载/读图失败记时间戳，5 分钟内不再重试 ——
 *     否则渲染循环里会对着坏地址反复打网（这是最容易踩的坑）。
 *  4. **落盘可跨会话**：映射持久化；冷启动先校验本地文件是否还在，
 *     不在就剔除、回落到远端地址并重新下载。
 *
 * 2026-09-16：缓存从**临时目录**改到**私有永久目录**（`wx.env.USER_DATA_PATH`，
 * 见 utils/localFile.ts）。原因：临时目录会被系统/工具清理，缓存等于白做；
 * 且开发者工具里 `http://tmp/…` 会 307 跳到 `127.0.0.1:端口/__tmp__/…`，
 * 渲染层按跨域处理而本地服务不带 ACAO → 控制台刷 CORS 报错、图出不来
 * （真机走 `wxfile://` 不跨域，现象只在工具里出现）。
 */
import { defineStore } from 'pinia'
import { ref } from 'vue'
import { copyToUserDir, extOf, isTempPath } from '@/utils/localFile'

/** 下载失败后的冷却时间：这段时间内不再重试同一个地址 */
const FAIL_COOLDOWN_MS = 5 * 60 * 1000

/** 缓存文件名前缀（落在私有永久目录 wx.env.USER_DATA_PATH 下） */
const CACHE_PREFIX = 'gz-img-'

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

/**
 * 缓存文件名：`gz-img-<地址哈希>.<扩展名>`。
 *
 * 用**地址哈希**而不是时间戳：同一个地址重新下载时写的是同一个文件（覆盖），
 * 不会在永久目录里留下一堆同名不同编号的旧图（那是换不回来的空间泄漏）。
 */
function cacheName(url: string): string {
  let h = 5381
  for (let i = 0; i < url.length; i += 1) h = (h * 33 + url.charCodeAt(i)) >>> 0
  return `${CACHE_PREFIX}${h.toString(36)}.${extOf(url)}`
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

    /**
     * 让某个地址的本地缓存作废（文件被系统清理/读失败时调用），下次用到会重新下载。
     *
     * 同时记一次**失败冷却**：本地文件刚读坏时不立刻重下 ——
     * 否则「渲染本地文件 → 报错 → 作废 → 重新下载 → 又渲染本地文件」会自己转起来，
     * 网络面板里就是同一张图被无限重下。冷却期内直接走远端地址（页面照常出图）。
     */
    function invalidate(url?: string): void {
      if (!url) return
      delete map.value[url]
      failed.value[url] = Date.now()
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
              /*
               * 下载下来的是**临时**文件，必须搬进私有永久目录再用：
               *  · 临时目录会被系统/工具清理 → 明天打开图就没了；
               *  · 开发者工具里 `http://tmp/…` 会 307 跳到 `__tmp__/`，
               *    渲染层按跨域处理而本地服务不带 ACAO → 刷 CORS 报错、图出不来。
               * 搬家失败（环境不支持）时退回临时路径 —— 至少这一会话里还能显示。
               */
              map.value[url] = copyToUserDir(path, cacheName(url)) || path
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
      for (const [url, path] of Object.entries(map.value)) {
        /*
         * 老版本留下来的临时路径（还没搬过家的）：趁冷启动搬进永久目录。
         * 搬不过去说明临时文件已经被清掉了 —— 剔除它，让这类条目直接重新下载，
         * 而不是一直指向一个读不出来的地址（那正是 CORS / 坏图的来源）。
         */
        if (isTempPath(path)) {
          const dest = copyToUserDir(path, cacheName(url))
          if (dest) map.value[url] = dest
          else delete map.value[url]
          continue
        }
        if (!fs?.accessSync) continue
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

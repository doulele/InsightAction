/**
 * 小程序本地文件：把「临时文件」搬进私有永久目录。
 * ================================================
 *
 * 为什么要搬：`chooseAvatar` / `downloadFile` 给的都只是**临时**路径
 * （真机 `wxfile://tmp_…`、开发者工具 `http://tmp/…`），它有两个坑：
 *
 *  1. 临时目录会被系统/工具清理 —— 持久化的路径会指向一个已经不存在的
 *     文件，表现为「头像隔天没了 / 横幅图裂了」。
 *  2. 开发者工具里 `http://tmp/…` 会被 307 跳到
 *     `http://127.0.0.1:端口/__tmp__/…`，渲染层把它当跨域请求处理，
 *     而本地文件服务不带 `Access-Control-Allow-Origin` —— 于是控制台刷
 *     `blocked by CORS policy` + `Failed to load image`（真机走 wxfile://
 *     不跨域，没有这个问题）。
 *
 * 搬进 `wx.env.USER_DATA_PATH`（私有永久目录）之后：路径指向的文件一直在、
 * 开发者工具也不再走 tmp 那条跨域跳转、缓存还能跨会话复用。
 *
 * 拷贝用「先 copyFileSync，失败再读成 base64 重写」两步 ——
 * 个别临时文件（尤其头像）直接 copyFileSync 会报 permission denied，
 * 读出来重写是通行且可靠的兜底。
 */
/** 小程序文件能力的子集（只用同步的几个方法） */
interface MiniFs {
  copyFileSync?: (src: string, dest: string) => void
  readFileSync?: (path: string, encoding?: string) => string | ArrayBuffer
  writeFileSync?: (path: string, data: string, encoding?: string) => void
  unlinkSync?: (path: string) => void
  accessSync?: (path: string) => void
}
interface MiniFileApi {
  env?: { USER_DATA_PATH?: string }
  getFileSystemManager?: () => MiniFs
}
const mp = uni as unknown as MiniFileApi

/** 私有永久目录（`wxfile://usr` / 工具里 `http://usr`）；环境不支持时返回空串 */
export function userDir(): string {
  return mp.env?.USER_DATA_PATH ?? ''
}

function fs(): MiniFs | undefined {
  return mp.getFileSystemManager?.()
}

/** 是不是临时文件路径（真机 `wxfile://tmp_…` / 工具里 `http://tmp/…`） */
export function isTempPath(path: string): boolean {
  if (!path) return false
  return /^wxfile:\/\/tmp/i.test(path) || /^https?:\/\/tmp\//i.test(path)
}

/** 文件还在不在（不支持校验 / 伪路径时保守返回 true，不误删） */
export function fileExists(path: string): boolean {
  if (!path) return false
  const f = fs()
  if (!f?.accessSync) return true
  try {
    f.accessSync(path)
    return true
  } catch {
    return false
  }
}

/** 删掉一个本地文件（删不掉就算了，不能因为清理失败影响主流程） */
export function removeFile(path: string): void {
  if (!path) return
  try {
    fs()?.unlinkSync?.(path)
  } catch {
    /* 文件不在就算了 */
  }
}

/** 从地址里取扩展名（忽略 `?v=1` 之类的查询串），取不到给 'jpg' */
export function extOf(url: string): string {
  const clean = url.split(/[?#]/)[0] ?? ''
  return /\.([a-zA-Z0-9]+)$/.exec(clean)?.[1]?.toLowerCase() || 'jpg'
}

/**
 * 把文件拷进私有永久目录，返回可直接给 `<image src>` 用的路径。
 *
 * @param src      临时文件路径
 * @param fileName 目标文件名（**同一个来源要用稳定的名字**，否则每次重下都会留一份新文件）
 * @returns 永久目录下的路径；失败返回空串（调用方据此决定是回落还是放弃）
 */
export function copyToUserDir(src: string, fileName: string): string {
  const dir = userDir()
  const f = fs()
  if (!src || !dir || !f) return ''
  /* 已经在永久目录里（换会话后重复落盘）→ 原样返回，不做无用拷贝 */
  if (src.startsWith(dir)) return src

  const dest = `${dir}/${fileName}`
  try {
    if (f.copyFileSync) {
      f.copyFileSync(src, dest)
      return dest
    }
  } catch {
    /* 落到下面的 base64 兜底：部分临时文件直接拷贝会被拒 */
  }
  try {
    if (f.readFileSync && f.writeFileSync) {
      const data = f.readFileSync(src, 'base64')
      if (typeof data === 'string' && data) {
        f.writeFileSync(dest, data, 'base64')
        return dest
      }
    }
  } catch {
    /* 两步都失败 */
  }
  return ''
}

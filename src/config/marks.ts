/**
 * 模块标志物（Module Mark）—— 三模式各自的"专属物件"。
 * ==================================================
 *
 * 是什么：同一功能，三模式画成不同的东西 —— 专注是「沙漏 / 全息环 / 飞剑」，
 * 沉淀是「纸卡 / 终端 / 问心签」…… 这是"换模式"最容易被一眼认出的地方，
 * 比换配色有效得多（人对"独有物件"的记忆远强于对色值的记忆）。
 *
 * 三条设计约束：
 *  1. **缺失即隐身**：图没有/加载失败时组件整块不渲染，页面回到原有的纯 CSS 视觉，
 *     所以可以先把管道接好、图后补（不会出现破图或空位）；
 *  2. **不占包**：图走远端（和横幅同一个机制），文件名固定、按模式区分；
 *  3. **地址推导**：优先用当前模式的横幅地址推出同目录前缀 ——
 *     这样**不需要后端改动**，横幅能出图，标志物就能出图（运维只要把图传到同一目录）。
 *
 * 上传清单（放到横幅同目录即可，压缩规范 640px / JPG q82，单张 40~120KB）：
 *   mark-{normal|tech|dao}-focus.jpg        止 · 专注   （沙漏 / 全息环 / 飞剑）
 *   mark-{...}-card.jpg                     知 · 沉淀   （纸卡 / 终端窗口 / 问心签）
 *   mark-{...}-draw.jpg                     行 · 行动   （纸签筒 / 任务队列 / 开炉）
 *   mark-{...}-achievement.jpg              我 · 成就   （盖章册 / 解锁矩阵 / 功勋碑）
 */
import type { ModeId } from './modes'

export type MarkKey = 'pause.focus' | 'reflect.card' | 'action.draw' | 'me.achievement'

/** 全部模块键（启动预热时按它遍历） */
export const MARK_KEYS: readonly MarkKey[] = [
  'pause.focus',
  'reflect.card',
  'action.draw',
  'me.achievement',
]

/** 构建期兜底前缀（与横幅共用同一变量；mp 开发态通常为空，此时靠横幅地址推导） */
const SKIN_BASE_URL = import.meta.env.VITE_SKIN_BASE_URL || ''

/** 文件名固定：运营/设计只需按这张表传图，代码不用动 */
const MARK_FILES: Record<MarkKey, Record<ModeId, string>> = {
  'pause.focus': {
    normal: 'mark-normal-focus.jpg',
    tech: 'mark-tech-focus.jpg',
    dao: 'mark-dao-focus.jpg',
  },
  'reflect.card': {
    normal: 'mark-normal-card.jpg',
    tech: 'mark-tech-card.jpg',
    dao: 'mark-dao-card.jpg',
  },
  'action.draw': {
    normal: 'mark-normal-draw.jpg',
    tech: 'mark-tech-draw.jpg',
    dao: 'mark-dao-draw.jpg',
  },
  'me.achievement': {
    normal: 'mark-normal-achievement.jpg',
    tech: 'mark-tech-achievement.jpg',
    dao: 'mark-dao-achievement.jpg',
  },
}

/** 从任意图片地址推出同目录前缀（`.../background/a.jpg` → `.../background/`） */
function baseFrom(url?: string): string | undefined {
  if (!url) return undefined
  const cut = url.lastIndexOf('/')
  return cut > 0 ? url.slice(0, cut + 1) : undefined
}

/**
 * 取地址上的版本参数（`.../a.jpg?v=2` → `?v=2`）。
 *
 * 为什么要继承：运营换图后如果沿用同名文件，客户端图片缓存 / CDN / 框架缓存
 * 都会继续用旧图（表现为"我明明换了图，小程序还是旧的"）。横幅地址自带 `?v=N`，
 * 把版本号一并挂到标志物地址上，**改完图只要把 /skins 的版本号 +1**，
 * 所有相关地址一起变化 → 各级缓存自然失效，不需要用户清缓存。
 */
function versionOf(url?: string): string {
  if (!url) return ''
  const q = url.indexOf('?')
  return q >= 0 ? url.slice(q) : ''
}

/**
 * 取某模块标志物的地址。
 *
 * ⚠️ remoteBannerUrl 必须是**远端**横幅地址（即 modeStore.remoteArtOf()），
 * 不能传已经被缓存成本地路径的那个（modeStore.artOf()）——
 * 标志物地址靠它推出"同目录前缀"，传本地路径会推出错误目录。
 *
 * @param key             模块键（见 MarkKey）
 * @param mode            目标模式（切换预览时可指定）
 * @param remoteBannerUrl 当前模式的远端横幅地址
 * @returns 可直接丢给 <image src> 的地址；undefined 表示"没有这张图"（组件整块隐身）
 */
export function markUrl(key: MarkKey, mode: ModeId, remoteBannerUrl?: string): string | undefined {
  const file = MARK_FILES[key]?.[mode]
  if (!file) return undefined
  const base = baseFrom(remoteBannerUrl) ?? SKIN_BASE_URL
  return base ? `${base}${file}${versionOf(remoteBannerUrl)}` : undefined
}

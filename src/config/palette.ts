/**
 * 观止知行 · 身份色板（TS 侧）
 * ============================
 *
 * 与 `src/uni.scss` 里同名 SCSS 常量**一一对应**，给「JS 读得到颜色」的地方用：
 *   - canvas 绘制（`subpkg-me/board` 的雷达图）；
 *   - 内联 `:style="{ background: ... }"`；
 *   - 原生 `uni.showModal` 的 `confirmColor`。
 *
 * 为什么必须成对存在、且不许各写各的：
 * 这两组色是**身份色**（不随皮肤变），同一个语义在三个模式下必须同色。
 * 2026-09-22 排查时发现四环色有两套互相打架的映射 —— 看板 / 小枢 / 年度回顾
 * 把「观」当蓝、「止」当绿，而行动周报 / 痕迹时间轴正好反过来，
 * 于是同一个用户在两个页面看到「观」是两种颜色。
 * 现在以看板 / 小枢那一套为准，统一收在这里（页面不许再写死 hex）。
 *
 * ⚠️ 改这里的值要同步改 `src/uni.scss`，反之亦然。
 */
import type { HallId } from './lexicon'

/** 四环身份色：观 / 止 / 知 / 行（顺序与 HallId 一致，方便按下标取用） */
export const DIM_COLOR: Record<HallId, string> = {
  observe: '#4E8FD4', // 观 · 天蓝
  pause: '#84A268', //   止 · 静绿
  reflect: '#9C8AC4', // 知 · 紫
  action: '#C4602E', //  行 · 火色
}

/** 四环的固定顺序（图表 / 图例按它排，别在页面里再排一次） */
export const DIM_ORDER: readonly HallId[] = ['observe', 'pause', 'reflect', 'action']

/** 知识深度 Lv.1 / 2 / 3 身份色（下标 = 深度 - 1） */
export const DEPTH_COLOR: readonly string[] = ['#84A268', '#4E8FD4', '#9C8AC4']

/** 深度配色（给已有的 `depthColor(depth)` 调用点用，语义更直白） */
export function depthColor(depth: 1 | 2 | 3): string {
  return DEPTH_COLOR[depth - 1] ?? DEPTH_COLOR[0]
}

/** Lv.2 的蓝：AI（加工过）标注也用它，与「基础」的灰形成对照 */
export const DEPTH_COLOR_2 = '#4E8FD4'

/** 警示橙：超限 / 待处理 / 该清理了（比品牌朱砂更亮，两者别混用） */
export const WARN_COLOR = '#B25A2C'

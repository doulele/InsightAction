/**
 * 观止知行 · 三模式皮肤系统（数据层）
 * =====================================
 *
 * 设计哲学：用户的「修行数据」只有一份，但承载它们的视觉/控件随模式变化。
 * 三模式 = 三套语言 + 三套视觉，互相独立（不互相继承），但结构对称。
 *
 * 三套皮肤：
 *   normal  普通 EARTH  —— 纸与墨 · 温暖米白 · 橄榄绿点睛
 *   tech    科技 LAB    —— 极简暗色 · 电光蓝点睛
 *   dao     修仙 DAO    —— 水墨黑金 · 鎏金点睛
 *
 * 本文件只放「原生控件需要的颜色 + 静态资源路径」。
 * 纯 CSS 侧（页面背景/文字/分割线）通过 CSS 变量由 App.vue 注入，
 * 这样 .vue 文件里的 SCSS 只需改色板为 var(--gz-*)，不需要写三套样式。
 */
import type { ModeId } from './modes'

export type TabKey = 'observe' | 'pause' | 'reflect' | 'action' | 'me'

export interface TabIcons {
  default: string
  active: string
}

export interface SkinTokens {
  id: ModeId
  /** 皮肤名（中文短名） */
  label: string

  /**
   * 只有 **JS 读得到的颜色**才放在这里 —— 即原生控件与 canvas。
   * 页面/组件的纯 CSS 侧一律走 App.scss 的 `--gz-*` 变量（三套皮肤一份真相）。
   *
   * ⚠️ 2026-09-22 清理：这里原先还抄了一份 `accentSoft / paper / paperDeep /
   * surface / ink2 / ink3 / line / lineSoft`，全项目**无人消费**，却已经和
   * App.scss 漂移（tech 的 surface / ink3 / line、dao 的 paper / surface / ink3
   * 都对不上）。抄一份不用的色板 = 迟早变成第二份撒谎的真相，所以直接删掉。
   * 下面这两个字段是例外，它们**必须**与 App.scss 保持一致：
   */
  accent: string // ↑ 与 --gz-accent 同值（「我」页 canvas 雷达图用它描边）
  ink: string //    ↑ 与 --gz-ink 同值（同上，canvas 读不到 CSS 变量）

  /* ---- 原生控件侧：运行时通过 uni API 应用 ---- */
  navigationBar: { frontColor: '#000000' | '#ffffff'; backgroundColor: string }
  windowBackground: string
  tabBar: {
    color: string
    selectedColor: string
    backgroundColor: string
    borderStyle: 'white' | 'black'
  }
  tabIcons: Record<TabKey, TabIcons>
}

function iconsFor(mode: string): Record<TabKey, TabIcons> {
  return {
    observe: { default: `/static/tabbar/${mode}/observe.png`, active: `/static/tabbar/${mode}/observe_on.png` },
    pause:   { default: `/static/tabbar/${mode}/pause.png`,   active: `/static/tabbar/${mode}/pause_on.png` },
    reflect: { default: `/static/tabbar/${mode}/reflect.png`, active: `/static/tabbar/${mode}/reflect_on.png` },
    action:  { default: `/static/tabbar/${mode}/action.png`,  active: `/static/tabbar/${mode}/action_on.png` },
    me:      { default: `/static/tabbar/${mode}/me.png`,      active: `/static/tabbar/${mode}/me_on.png` },
  }
}

export const SKINS: Record<ModeId, SkinTokens> = {
  normal: {
    id: 'normal',
    label: '普通',
    accent: '#6D8B3F', // = App.scss --gz-accent
    ink: '#26231E', //    = App.scss --gz-ink
    navigationBar: { frontColor: '#000000', backgroundColor: '#F4EFE4' },
    windowBackground: '#F4EFE4',
    tabBar: { color: '#A9A196', selectedColor: '#6D8B3F', backgroundColor: '#FCFAF4', borderStyle: 'white' },
    tabIcons: iconsFor('normal'),
  },
  tech: {
    id: 'tech',
    label: '科技',
    accent: '#3FA9FF', // = App.scss --gz-accent
    ink: '#E6EDF5', //    = App.scss --gz-ink
    navigationBar: { frontColor: '#ffffff', backgroundColor: '#0D1117' },
    windowBackground: '#0D1117',
    tabBar: { color: '#66748A', selectedColor: '#3FA9FF', backgroundColor: '#151B24', borderStyle: 'black' },
    tabIcons: iconsFor('tech'),
  },
  dao: {
    id: 'dao',
    label: '修仙',
    accent: '#A4471F', // = App.scss --gz-accent
    ink: '#2A251E', //    = App.scss --gz-ink
    navigationBar: { frontColor: '#000000', backgroundColor: '#E7DFC9' },
    windowBackground: '#F1EDE0',
    tabBar: { color: '#A29A89', selectedColor: '#A4471F', backgroundColor: '#F9F5EA', borderStyle: 'white' },
    tabIcons: iconsFor('dao'),
  },
}

export function getSkin(id: ModeId): SkinTokens {
  return SKINS[id] ?? SKINS.normal
}

export const TAB_ORDER: readonly TabKey[] = ['observe', 'pause', 'reflect', 'action', 'me']
export const TAB_LABEL: Record<TabKey, string> = {
  observe: '观', pause: '止', reflect: '知', action: '行', me: '我',
}
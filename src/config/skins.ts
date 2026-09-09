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

  /* ---- CSS 侧：用于 .gz-skin--xxx 选择器中的 CSS 变量值 ---- */
  accent: string
  accentSoft: string
  paper: string
  paperDeep: string
  surface: string
  ink: string
  ink2: string
  ink3: string
  line: string
  lineSoft: string

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
    accent: '#6D8B3F',
    accentSoft: 'rgba(109,139,63,.12)',
    paper: '#F4EFE4',
    paperDeep: '#EDE6D6',
    surface: '#FCFAF4',
    ink: '#26231E',
    ink2: '#6B655B',
    ink3: '#9C9589',
    line: 'rgba(38,35,30,.10)',
    lineSoft: 'rgba(38,35,30,.05)',
    navigationBar: { frontColor: '#000000', backgroundColor: '#F4EFE4' },
    windowBackground: '#F4EFE4',
    tabBar: { color: '#A9A196', selectedColor: '#6D8B3F', backgroundColor: '#FCFAF4', borderStyle: 'white' },
    tabIcons: iconsFor('normal'),
  },
  tech: {
    id: 'tech',
    label: '科技',
    accent: '#3FA9FF',
    accentSoft: 'rgba(63,169,255,.14)',
    paper: '#0D1117',
    paperDeep: '#151B24',
    surface: '#151B24',
    ink: '#E6EDF5',
    ink2: '#9AA7B8',
    ink3: '#66748A',
    line: 'rgba(230,237,245,.10)',
    lineSoft: 'rgba(230,237,245,.05)',
    navigationBar: { frontColor: '#ffffff', backgroundColor: '#0D1117' },
    windowBackground: '#0D1117',
    tabBar: { color: '#66748A', selectedColor: '#3FA9FF', backgroundColor: '#151B24', borderStyle: 'black' },
    tabIcons: iconsFor('tech'),
  },
  dao: {
    id: 'dao',
    label: '修仙',
    accent: '#A4471F',
    accentSoft: 'rgba(164,71,31,.12)',
    paper: '#F1EDE0',
    paperDeep: '#EAE3D1',
    surface: '#F9F5EA',
    ink: '#2A251E',
    ink2: '#6E6759',
    ink3: '#A29A89',
    line: 'rgba(42,37,30,.16)',
    lineSoft: 'rgba(42,37,30,.07)',
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
/**
 * 三模式元数据 —— 产品哲学「一套底层逻辑，三套表达语言」的工程落点。
 *
 * 规则：用户的修行数据（时长/卡片/完成项）只有一份；
 *      模式只改变「叫法、文案、视觉」，由 lexion.ts + 主题共同承担。
 *      未来新增模式（如极简/儿童/长辈），只需在这里加一行 + 在 lexicon 补词表。
 */
const SKIN_BASE_URL = import.meta.env.VITE_SKIN_BASE_URL || ''

/**
 * 皮肤横幅图 URL。
 * 原图（assets-remote/skin）已移出主包以压缩体积，只能走 CDN；
 * 未配置 VITE_SKIN_BASE_URL 时返回 undefined → 页面不渲染横幅（避免请求坏路径导致 500/渲染层报错）。
 */
function artUrl(filename: string): string | undefined {
  return SKIN_BASE_URL ? `${SKIN_BASE_URL}${filename}` : undefined
}

export type ModeId = 'normal' | 'tech' | 'dao'

export interface ModeMeta {
  /** 唯一 id */
  id: ModeId
  /** 中文名（单/双字） */
  label: string
  /** 英文小标 */
  labelEn: string
  /** 一句话气质（模式选择页副文案） */
  tagline: string
  /** 首次测评名称 */
  assessmentName: string
  /** 成长体系名称（「我」页展示） */
  growthName: string
  /** 社交对象称呼（道侣/伙伴/搭档） */
  companionName: string
  /** 小枢形态 */
  assistantName: string
  /** 主题主色（留作批次 D 主题化使用；目前 UI 仍统一纸墨） */
  accent: string
  /** 卡片顶部横幅图路径 */
  art?: string
}

export const MODES: readonly ModeMeta[] = [
  {
    id: 'normal',
    label: '普通',
    labelEn: 'EARTH',
    tagline: '温和而踏实，像一棵树，把日子过成自己的样子。',
    assessmentName: '生活基线',
    growthName: '阶位',
    companionName: '伙伴',
    assistantName: '温和助手',
    accent: '#6D8B3F',
    art: artUrl('A_wide_horizontal_banner_illus_2026-09-09T05-35-28.png'),
  },
  {
    id: 'tech',
    label: '科技',
    labelEn: 'LAB',
    tagline: '冷静而克制，用数据与指标，把状态打磨成模型。',
    assessmentName: '数字画像',
    growthName: '段位',
    companionName: '搭档',
    assistantName: '数据分析师',
    accent: '#3FA9FF',
    art: artUrl('A_wide_horizontal_banner_for_a_2026-09-09T05-35-30.png'),
  },
  {
    id: 'dao',
    label: '修仙',
    labelEn: 'DAO',
    tagline: '诗意而中二，把每一日，都修成渡劫的功课。',
    assessmentName: '灵根检测',
    growthName: '境界',
    companionName: '道侣',
    assistantName: '护法灵兽',
    accent: '#A4471F',
    art: artUrl('A_wide_horizontal_ink_wash_ban_2026-09-09T05-05-45.png'),
  },
] as const

/** 默认模式：普通 */
export const DEFAULT_MODE_ID: ModeId = 'normal'

export function getModeMeta(id: ModeId): ModeMeta {
  return MODES.find((m) => m.id === id) ?? MODES[0]
}

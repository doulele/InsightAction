/**
 * 品牌内容元模型：观止知行
 *
 * 为什么把文案/内容抽成强类型常量？
 * 1. 首页、观止页、分享配置都引用同一份内容，改一处全局生效；
 * 2. TS 会在编译期兜底「数组缺项、字段拼错」这类低级错误。
 */

export interface Pillar {
  /** 关键字：观 / 止 / 知 / 行 */
  word: string
  /** 罗马字标注，仅作排版装饰 */
  latin: string
  /** 一句话释义 */
  desc: string
}

/** 四个支柱即「观止知行」的方法论骨架 */
export const PILLARS: readonly Pillar[] = [
  { word: '观', latin: 'IN·SIGHT', desc: '于信息洪流中，辨出真正重要的少数' },
  { word: '止', latin: 'HOLD', desc: '戒断无效刷屏，把注意力还给生活' },
  { word: '知', latin: 'KNOW', desc: '将碎片沉淀为成体系的认知' },
  { word: '行', latin: 'ACT', desc: '让认知真正兑现为微小的行动' },
] as const

export interface BrandMeta {
  /** 中文名 */
  name: string
  /** 英文标识 */
  nameEn: string
  /** 品牌标语（大字） */
  slogan: string
  /** 使命一段话 */
  mission: string
  /** 出处（小注） */
  source: string
}

export const BRAND: BrandMeta = {
  name: '观止知行',
  nameEn: 'Insight Action',
  slogan: '观有所止 · 知而后行',
  mission: '帮你从信息洪流中提取重点，把认知转化为行动；戒断无效刷屏，回归有序生活。',
  source: '《大学》：「知止而后有定，定而后能静」—— 知其所以，观其所止。',
}

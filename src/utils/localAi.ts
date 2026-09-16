/**
 * AI 三能力的**基础兜底**（离线、零成本、零依赖，对应 AI 版）。
 *
 * 为什么必须有这一层：
 *  · 开发时后端可能没起、Key 可能没配 —— AI 按钮不能变成死按钮；
 *  · 线上 AI 只对登录用户 / 白名单开放，没权限的人也该有可用功能，只是结果朴素些；
 *  · 模型抽风、网络抖动、额度用尽，都不该让页面功能整体失效。
 *
 * 设计底线 —— **诚实**：
 *  · 所有结果一律带 `source:'local'`，页面必须如实标注，不能把规则算出来的东西
 *    说成"AI 说的"。误导用户以为自己被 AI 点评过，比没有这个功能更糟；
 *  · 宁可输出"基础摘要"这种朴素结果，也不伪造模型口吻的漂亮话。
 *
 * 因此这里的产出定位是**可用但不惊艳**：能帮用户把事办了就行，
 * 真正需要理解语义的时刻仍然交给 AI（AI 可用时优先走 AI）。
 */
import type { DigestResult, FeynmanResult, TagsResult } from '@/api/modules/ai'

/** 基础结果没有真实用量，给一个一眼能认出来的占位（不是伪造 model 名） */
const LOCAL_META = {
  model: 'local',
  tokens: { prompt: 0, completion: 0, total: 0 },
  costYuan: 0,
} as const

/**
 * 领域词表 —— 命中即作为标签。
 *
 * 为什么先查词表而不是纯统计词频：智能标签的用途是**事后检索**，
 * 有价值的标签是"这属于哪个领域/机制"（复利、注意力、拖延），
 * 而不是正文里出现最多的词（"这个""其实"）。纯统计几乎必然给出后者。
 * 这张表不追求全，命中不了再退回词频。
 */
const DOMAIN_WORDS = [
  '复利', '习惯', '注意力', '拖延', '情绪', '焦虑', '决策', '偏见', '认知', '记忆',
  '学习', '时间', '效率', '关系', '沟通', '健康', '睡眠', '运动', '目标', '计划',
  '反馈', '风险', '概率', '选择', '自律', '动机', '意志', '消费', '投资', '阅读',
  '写作', '成长', '能量', '专注', '坚持', '改变', '方法', '复盘', '边界', '取舍',
]

/** 词频兜底时要丢掉的虚词/万能词（放在这里比写在正则里好读） */
const STOP_WORDS = new Set([
  '这个', '那个', '其实', '就是', '不是', '因为', '所以', '但是', '而且', '然后',
  '如果', '可以', '应该', '已经', '还是', '一个', '我们', '你们', '他们', '什么',
  '怎么', '这样', '那样', '自己', '它们', '之后', '之前', '时候', '有点', '非常',
  '真的', '觉得', '知道', '没有', '可能', '需要', '通过', '对于', '关于', '以及',
  '并且', '或者', '一些', '很多', '这些', '那些', '一种', '一直', '不过', '只是',
])

/**
 * 解释性连接词 —— 有没有它们，是"讲明白了"和"只给了结论"最省事的区分信号。
 * 费曼技巧的核心是能不能把因果讲出来，而这些词就是因果在文字上的痕迹。
 */
const EXPLAIN_WORDS = [
  '因为', '所以', '也就是', '换句话说', '比如', '例如', '意思是', '指的是',
  '意味着', '原因是', '这样一来', '相当于', '也就是说', '之所以', '于是',
]

/** 空洞词 —— 堆术语的典型特征：看着高级，实际什么都没说 */
const FLUFF_WORDS = [
  '本质', '其实', '无非', '某种', '系统', '模型', '方法论', '底层逻辑', '维度',
  '赋能', '闭环', '心智', '结构性', '生态', '抓手', '对齐', '颗粒度', '升维',
]

/** 取纯中文串（丢掉标点、数字、英文，n-gram 只在中文上做） */
function chineseOnly(text: string): string {
  return text.replace(/[^\u4e00-\u9fa5]/g, '')
}

/**
 * 生成 n 元组并按频次降序返回。
 * 只取 2~3 字：中文概念词绝大多数落在这个长度，4 字以上噪声远多于有效词。
 */
function topGrams(text: string, limit: number): string[] {
  const clean = chineseOnly(text)
  if (clean.length < 2) return []

  const freq = new Map<string, number>()
  for (const n of [2, 3]) {
    for (let i = 0; i + n <= clean.length; i += 1) {
      const g = clean.slice(i, i + n)
      freq.set(g, (freq.get(g) || 0) + 1)
    }
  }

  const ranked = [...freq.entries()]
    .filter(([g]) => !STOP_WORDS.has(g))
    .sort((a, b) => b[1] - a[1] || b[0].length - a[0].length)
    .map(([g]) => g)

  // 去重：与已入选词有包含关系的丢掉（"复利"已选，就不要"复利的"这种碎片）
  const picked: string[] = []
  for (const g of ranked) {
    if (picked.length >= limit) break
    if (picked.some((p) => p.includes(g) || g.includes(p))) continue
    picked.push(g)
  }
  return picked
}

/** 截取前 n 字，超出加省略号 */
function clip(text: string, n: number): string {
  const t = text.trim()
  return t.length > n ? `${t.slice(0, n)}…` : t
}

/** 第一句（按句号/问号/换行切），用于"大白话版"与简报开头 */
function firstSentence(text: string): string {
  return text.split(/[。！？；\n]/).map((s) => s.trim()).filter(Boolean)[0] || text.trim()
}

/* ==================== 三个兜底 ==================== */

/**
 * 智能标签兜底：先命中领域词表，不足 3 个再用高频词补足。
 * 顺序上**领域词优先** —— 它更接近"这条笔记在讲哪个领域"，检索价值更高。
 */
export function localTags(text: string): TagsResult {
  const body = text.trim()
  const hits = DOMAIN_WORDS.filter((w) => body.includes(w))

  const tags = [...hits]
  if (tags.length < 3) {
    for (const g of topGrams(body, 8)) {
      if (tags.length >= 3) break
      if (!tags.includes(g)) tags.push(g)
    }
  }

  return { tags: tags.slice(0, 5), source: 'local', meta: LOCAL_META }
}

/**
 * 费曼速记兜底：规则体检。
 *
 * 判据只有三条，都是"讲没讲明白"在文字上最稳定的痕迹：
 *  1. 太短 → 根本没展开；
 *  2. 没有解释性连接词 → 只给了结论，没讲因果；
 *  3. 空洞词扎堆 → 堆术语冒充理解。
 * 规则查不出真正的逻辑漏洞（那是 AI 的活），但上面这三条它比人更不会漏。
 */
export function localFeynman(text: string): FeynmanResult {
  const body = text.trim()
  const issues: string[] = []

  if (body.length < 30) {
    issues.push('只写了这么点，还没说清到底是件什么事')
  }

  const hasExplain = EXPLAIN_WORDS.some((w) => body.includes(w))
  if (!hasExplain && body.length >= 30) {
    issues.push('通篇都在给结论，没讲"为什么"')
  }

  const fluffs = FLUFF_WORDS.filter((w) => body.includes(w))
  if (fluffs.length >= 2) {
    issues.push(`"${fluffs.slice(0, 2).join('""')}"这类词没有解释，只是换了个说法`)
  }

  // 追问挑最薄弱的那一项，问具体的，不问"你真的懂了吗"这种废话
  let question: string
  if (body.length < 30) question = '能再具体点吗？举个你自己的例子？'
  else if (fluffs.length >= 2) question = `"${fluffs[0]}"换成你自己的话，怎么说？`
  else if (!hasExplain) question = '为什么会这样？中间到底发生了什么？'
  else question = '换个不懂这事的人问你"所以呢"，你会怎么答？'

  return {
    clear: issues.length === 0,
    issues: issues.slice(0, 3),
    // 本地版不做改写（改写得不偿失），原样引第一句 —— 至少让用户看见自己写的话
    plainVersion: clip(firstSentence(body), 60),
    question,
    source: 'local',
    meta: LOCAL_META,
  }
}

/**
 * 极简报兜底：老实做汇总，不硬凑主线。
 *
 * AI 版会去找几条记录之间的联系；本地版做不到，就**直说做不到** ——
 * 硬凑出来的主线比没有主线更有害，它会让用户误以为自己想清楚了。
 */
export function localDigest(items: string[]): DigestResult {
  const list = items.map((t) => String(t).trim()).filter(Boolean)
  const chars = list.reduce((n, t) => n + t.length, 0)

  return {
    summary: `最近 ${list.length} 条，共 ${chars} 字。${clip(firstSentence(list[0] || ''), 40)}（基础汇总，未调用 AI，不判断这几条之间的联系）`,
    highlights: list.slice(0, 3).map((t) => clip(t, 40)),
    source: 'local',
    meta: LOCAL_META,
  }
}

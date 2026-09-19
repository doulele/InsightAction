/**
 * 富文本工具（2026-09-17）—— 收件「正文」从纯文本升级成"可带简单样式"之后的**唯一口径**。
 *
 * 为什么是"纯文本 + 富文本"两份，而不是只存 HTML：
 *  `ObsItem.content` 被下游大量消费 —— 检索、`refSource.refTitle` 的 slice、
 *  归档导出 Markdown、喂给 AI 的正文、`validate()` 的长度校验、云备份体积。
 *  只存 HTML 的话，这些地方全都要改成"考虑标签"（切片切出半个标签、导出吐出原始 HTML、
 *  AI 收到一堆噪声）。所以定死：**content 永远是可读纯文本，contentHtml 只在有格式时才有**，
 *  编辑时由 `htmlToText()` 重算 content —— 单向派生，两者不会漂移。
 *
 * 为什么必须有白名单清洗：粘贴网页 / AI 生成的文件里常带几十 KB 的内联样式和脚本，
 *  不清洗的话单条就能把 storage 撑爆（小程序单 key 上限 1MB），而且 `<img>` 外链图
 *  在小程序里要么被域名白名单挡住、要么得下载缓存 —— **图一律不留**。
 *
 * 渲染侧为什么要 decorate：小程序 `<rich-text>` 不吃外部 class，
 *  h2 / ul / li 不注入内联样式会退化成一段没有层次的文字。
 */

/** 允许保留的标签（其余标签一律**拆掉标签、留下文字**，不做整段删除） */
const ALLOWED = new Set([
  'b',
  'strong',
  'i',
  'em',
  'u',
  's',
  'strike',
  'del',
  'h1',
  'h2',
  'h3',
  'ul',
  'ol',
  'li',
  'blockquote',
  'p',
  'br',
  'div',
  'span',
])

/** 整段连同内容一起丢掉（不是"拆标签"）—— 危险标签与图片 */
const DROPPED = 'script|style|iframe|object|embed|video|audio|svg|canvas|link|meta|img|input|form'

/**
 * `span` 上允许保留的三个样式（**只这三个**）——
 * 小程序 `<editor>` 在部分情况下把加粗/斜体/下划线输出成带 style 的 span，
 * 一律剥离会让用户在编辑器里按的加粗白按一次。其余属性和样式全部丢弃。
 */
const SPAN_STYLE_KEEP = /^(font-weight|font-style|text-decoration)\s*:/i

/** 从 span 的属性串里挑出允许保留的 style（找不到就返回空串） */
function keepSpanStyle(attrs: string): string {
  const m = attrs.match(/style\s*=\s*"([^"]*)"/i) ?? attrs.match(/style\s*=\s*'([^']*)'/i)
  if (!m) return ''
  const kept = m[1]
    .split(';')
    .map((d) => d.trim())
    .filter((d) => SPAN_STYLE_KEEP.test(d))
    .join(';')
  return kept ? ` style="${kept}"` : ''
}

/**
 * 清洗：只留白名单标签，**丢弃所有属性**（span 上的三个样式除外，见上）。
 * 属性全丢是刻意的 —— 保留下来的内联样式既是体积黑洞，也是样式跑偏的来源；
 * 需要的样子由 decorate() 在渲染时统一注入。
 */
export function sanitizeHtml(raw: string): string {
  if (!raw) return ''
  let html = raw
  /* 注释（含条件注释）先清掉，免得隐藏内容混进来 */
  html = html.replace(/<!--[\s\S]*?-->/g, '')
  /* 危险/无用标签整段删除 */
  html = html.replace(new RegExp(`<(${DROPPED})\\b[\\s\\S]*?<\\/\\1\\s*>`, 'gi'), '')
  html = html.replace(new RegExp(`<\\/?(${DROPPED})\\b[^>]*>`, 'gi'), '')
  /* 开标签：留白名单，其余拆掉；span 额外保留三个样式 */
  html = html.replace(/<([a-zA-Z][a-zA-Z0-9]*)((?:\s[^>]*)?)>/g, (_m, tag: string, attrs: string) => {
    const t = tag.toLowerCase()
    if (!ALLOWED.has(t)) return ''
    if (t === 'br') return '<br/>'
    const style = t === 'span' ? keepSpanStyle(attrs) : ''
    return `<${t}${style}>`
  })
  /* 闭标签：同上 */
  html = html.replace(/<\/([a-zA-Z][a-zA-Z0-9]*)\s*>/g, (_m, tag: string) => {
    const t = tag.toLowerCase()
    return ALLOWED.has(t) && t !== 'br' ? `</${t}>` : ''
  })
  return html.trim()
}

/** 是否真的带格式（用来决定渲染走富文本还是纯文本分支） */
export function hasMarkup(html?: string): boolean {
  return Boolean(html && /<[a-z][^>]*>/i.test(html))
}

/** 富文本 → 纯文本（供检索 / AI / 导出 / 校验 / 双写 content 用） */
export function htmlToText(html: string): string {
  if (!html) return ''
  return html
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<li[^>]*>/gi, '- ')
    .replace(/<\/(p|div|li|h1|h2|h3|blockquote|ul|ol)>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/&amp;/gi, '&')
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}

function escapeHtml(text: string): string {
  return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}

/** 纯文本 → 富文本（老数据进编辑器时用；空行分段、单换行折行） */
export function textToHtml(text: string): string {
  const t = (text ?? '').trim()
  if (!t) return ''
  return t
    .split(/\n{2,}/)
    .map((block) => `<p>${block.split('\n').map(escapeHtml).join('<br/>')}</p>`)
    .join('')
}

/** 渲染时注入的内联样式（rich-text 不吃外部 class，只能写进标签上） */
const INLINE: Record<string, string> = {
  h1: 'font-size:40rpx;font-weight:700;line-height:1.6;margin:16rpx 0 10rpx;',
  h2: 'font-size:34rpx;font-weight:700;line-height:1.6;margin:14rpx 0 8rpx;',
  h3: 'font-size:30rpx;font-weight:700;line-height:1.6;margin:12rpx 0 6rpx;',
  p: 'margin:8rpx 0;line-height:1.85;',
  div: 'line-height:1.85;',
  blockquote:
    'margin:10rpx 0;padding:6rpx 20rpx;border-left:4rpx solid #D9CFBB;color:#6B6257;',
  ul: 'margin:8rpx 0;padding-left:36rpx;',
  ol: 'margin:8rpx 0;padding-left:36rpx;',
  li: 'line-height:1.8;',
  b: 'font-weight:700;',
  strong: 'font-weight:700;',
  i: 'font-style:italic;',
  em: 'font-style:italic;',
  u: 'text-decoration:underline;',
  s: 'text-decoration:line-through;',
  strike: 'text-decoration:line-through;',
  del: 'text-decoration:line-through;',
}

/** 给白名单标签注入内联样式（`<rich-text :nodes="decorate(html)">` 用） */
export function decorate(html: string): string {
  if (!html) return ''
  return html.replace(/<([a-zA-Z][a-zA-Z0-9]*)(?:\s[^>]*)?>/g, (m, tag: string) => {
    const style = INLINE[tag.toLowerCase()]
    return style ? `<${tag} style="${style}">` : m
  })
}

/**
 * 富文本 → Markdown（归档导出用）。
 * 只做"能读得懂"的映射，不追求还原：标题 / 粗斜体 / 列表 / 引用 / 段落。
 */
export function htmlToMarkdown(html: string): string {
  if (!html) return ''
  let out = html
  out = out.replace(/<h1[^>]*>([\s\S]*?)<\/h1>/gi, '\n# $1\n')
  out = out.replace(/<h2[^>]*>([\s\S]*?)<\/h2>/gi, '\n## $1\n')
  out = out.replace(/<h3[^>]*>([\s\S]*?)<\/h3>/gi, '\n### $1\n')
  out = out.replace(/<\/?(b|strong)[^>]*>/gi, '**')
  out = out.replace(/<\/?(i|em)[^>]*>/gi, '*')
  out = out.replace(/<li[^>]*>/gi, '\n- ')
  out = out.replace(/<br\s*\/?>/gi, '\n')
  out = out.replace(/<\/(p|div|blockquote|li|ul|ol)>/gi, '\n')
  out = out.replace(/<[^>]+>/g, '')
  out = out.replace(/&nbsp;/gi, ' ')
  out = out.replace(/&lt;/gi, '<').replace(/&gt;/gi, '>').replace(/&amp;/gi, '&')
  return out.replace(/[ \t]+\n/g, '\n').replace(/\n{3,}/g, '\n\n').trim()
}

/**
 * 从导入的文件里抽出「来源名」。
 * 只是为了避免"导入的东西全都归到未标注来源" —— 抽不到就如实返回空串。
 */
export function guessSourceFromText(text: string): string {
  const m = text.match(/^\s*(?:来源|出处|source)\s*[:：]\s*(.+)$/im)
  return m ? m[1].trim().slice(0, 30) : ''
}

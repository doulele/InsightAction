/**
 * 记一笔 · 文件导入（2026-09-17）—— 把"外部 AI 生成的一份内容"变成填好的表单。
 *
 * 为什么**契约优先**：
 *   "任何格式都能识别"听起来体贴，实际是把不确定性全留给用户（同一个 PDF，解析出来
 *   可能是三段也可能是三十段）。所以定一条最准的路：
 *    1. **JSON 清单**（字段名与表单一一对应）—— 外部 AI 直接产这个，准确率接近 100%，零解析成本；
 *    2. **md / txt**（按「字段：值」分段，正文从「正文：」开始收到底）—— 顺手写就能用；
 *    3. docx / xlsx / pdf / 图片 —— 送服务端解析（已接，见 api/modules/parse.ts 与服务端 parseService）。
 *
 * 给外部 AI 的**契约与模板**（可复制、可转发成文件）统一放在 `utils/importTemplate.ts`：
 * 字段名在这里解析、在那里生成，两处必须一起改 —— 契约按形态给（文章 / 一句话 / 视频字段不一样），
 * 而且里面**没有 `form` 这一格**，粘/导进来之后由这里的 `inferForm()` 反推。
 *
 * 隐私：这里读的是用户**从聊天里主动选中**的文件，读取在**本机**完成
 * （`FileSystemManager.readFileSync`），不上传、不落第二份。
 * 将来接服务端解析时必须另加一道知情同意，并更新 PRIVACY.md 的网络访问表 —— 文件离开手机是性质变化。
 */
import type { ObserveForm, ObserveKind } from '@/stores/observe'
import type { ParseFields } from '@/api/modules/parse'

/** 在小程序**本机**就能读的文本格式 —— 这几类永远不上传 */
export const LOCAL_EXTS = ['json', 'md', 'markdown', 'txt'] as const
/** 本机读不了、要送服务端解析的格式（服务端见 InsightActionBacend/services/parseService.js） */
export const REMOTE_EXTS = ['docx', 'xlsx', 'pdf', 'png', 'jpg', 'jpeg', 'webp', 'bmp'] as const
/**
 * 选文件时的白名单：**一个入口、按扩展名分流** ——
 * 不让用户先自己判断"这个文件该点哪个按钮"（那是我们的活，不是他的）。
 */
export const IMPORT_EXTS = [...LOCAL_EXTS, ...REMOTE_EXTS] as const
/** 单文件上限：与后端 `config.parse.maxBytes` 同口径 */
export const IMPORT_MAX_BYTES = 2 * 1024 * 1024

export function extOf(name: string): string {
  return (String(name).split('.').pop() ?? '').toLowerCase()
}

export function isLocalExt(ext: string): boolean {
  return (LOCAL_EXTS as readonly string[]).includes(ext)
}

export function isRemoteExt(ext: string): boolean {
  return (REMOTE_EXTS as readonly string[]).includes(ext)
}

/**
 * 解析出来的一组字段（缺省即"文件里没写"，由页面保留用户当前值）。
 * 类型定义在 `api/modules/parse.ts` —— 本机解析与服务端解析共用同一套字段名，
 * 这样两边都产出同一种东西，页面只需要一个 `applyImport()`。
 */
export type ImportedForm = ParseFields

export interface ImportResult {
  fields: ImportedForm
  /** 需要让人知道的问题（如"没读到标题"）—— 不拦人，只如实说 */
  warnings: string[]
}

/* ---------------- 读文件（本机，不上传） ---------------- */

/** 微信文件 API 的可选能力（与 utils/localBackup.ts 同一套存在性判断，避免平台差异直接报错） */
interface MpFileApi {
  chooseMessageFile?: (options: {
    count: number
    type: string
    extension?: string[]
    success?: (res: { tempFiles?: Array<{ path?: string; name?: string; size?: number }> }) => void
    fail?: (err: { errMsg?: string }) => void
  }) => void
  getFileSystemManager?: () => {
    readFileSync: (path: string, encoding: string) => string
    statSync?: (path: string) => { size?: number }
  }
}

const mp = uni as unknown as MpFileApi

export interface PickedFile {
  name: string
  /** 临时文件路径：选完**立刻读**，读完就不再引用它 */
  path: string
  size: number
}

/**
 * 选一个文件 —— **用户从聊天里主动选**（不读相册、不碰摄像头，也就没有额外隐私接口）。
 * 只负责选、不负责读：读成文本还是 base64 由扩展名决定（见下面两个函数）。
 */
export function pickFile(): Promise<PickedFile> {
  return new Promise((resolve, reject) => {
    if (typeof mp.chooseMessageFile !== 'function') {
      reject(new Error('当前环境不支持从聊天选择文件（请用微信小程序打开）'))
      return
    }
    mp.chooseMessageFile({
      count: 1,
      type: 'file',
      extension: [...IMPORT_EXTS],
      success: (res) => {
        const file = res?.tempFiles?.[0]
        if (!file?.path) {
          reject(new Error('未选中文件'))
          return
        }
        resolve({ name: file.name ?? 'import.txt', path: file.path, size: Number(file.size || 0) })
      },
      fail: (err) => {
        const msg = err?.errMsg || ''
        reject(new Error(/cancel/i.test(msg) ? '已取消' : msg || '选择文件失败'))
      },
    })
  })
}

/** 本机读成文本（只在本机能读的格式上用） */
export function readAsText(path: string): string {
  const fs = mp.getFileSystemManager?.()
  if (!fs) throw new Error('当前环境不支持读取文件')
  const text = fs.readFileSync(path, 'utf8')
  return typeof text === 'string' ? text : String(text)
}

/**
 * 本机读成 base64（给服务端解析用）。
 * 体积闸门放在这里：base64 会让体积涨约 1/3，与其上传一半被后端拒绝，不如现在就拦下来。
 */
export function readAsBase64(path: string, size = 0): string {
  const fs = mp.getFileSystemManager?.()
  if (!fs) throw new Error('当前环境不支持读取文件')
  if (size > IMPORT_MAX_BYTES) {
    throw new Error(`文件太大了（${Math.round(size / 1024)}KB，上限 ${Math.round(IMPORT_MAX_BYTES / 1024)}KB）`)
  }
  const raw = fs.readFileSync(path, 'base64')
  const base64 = typeof raw === 'string' ? raw : String(raw)
  if (base64.length > IMPORT_MAX_BYTES * 1.4) {
    throw new Error(`文件太大了（上限 ${Math.round(IMPORT_MAX_BYTES / 1024)}KB）`)
  }
  return base64
}

/* ---------------- 解析 ---------------- */

const KIND_MAP: Record<string, ObserveKind> = {
  事: 'thing',
  见闻: 'thing',
  thing: 'thing',
  理: 'theory',
  认知: 'theory',
  theory: 'theory',
  道: 'mother',
  母题: 'mother',
  mother: 'mother',
}

const FORM_MAP: Record<string, ObserveForm> = {
  文章: 'article',
  article: 'article',
  一句话: 'quote',
  quote: 'quote',
  视频: 'video',
  video: 'video',
}

/** 字段名的多种叫法（中文优先，因为外部 AI 更可能照中文写） */
const FIELD_ALIAS: Record<string, keyof ImportedForm> = {
  归属: 'kind',
  类型: 'kind',
  类别: 'kind',
  kind: 'kind',
  形态: 'form',
  形式: 'form',
  form: 'form',
  标题: 'title',
  题目: 'title',
  title: 'title',
  主题: 'topics',
  领域: 'topics',
  topics: 'topics',
  标签: 'tags',
  tags: 'tags',
  来源: 'sourceName',
  出处: 'sourceName',
  source: 'sourceName',
  sourcename: 'sourceName',
  链接: 'link',
  原文链接: 'link',
  link: 'link',
  视频链接: 'videoUrl',
  videourl: 'videoUrl',
  摘要: 'digest',
  digest: 'digest',
  一句话总结: 'summary',
  总结: 'summary',
  summary: 'summary',
  重要观点: 'viewpoints',
  观点: 'viewpoints',
  感悟: 'insight',
  insight: 'insight',
  为什么成立: 'why',
  why: 'why',
  经典语句: 'golden',
  金句: 'golden',
  golden: 'golden',
}

/** 「正文」开头的几种写法：见到它就说明后面全是正文 */
const CONTENT_KEYS = ['正文', '原文', '内容', '摘录', '视频里讲的', 'content', 'body']

function splitList(raw: string): string[] {
  return raw
    .split(/[、,，;；/|]/)
    .map((s) => s.trim())
    .filter(Boolean)
}

/** 收尾：把字段名与取值对上号 */
function assign(fields: ImportedForm, key: string, value: string): void {
  const field = FIELD_ALIAS[key.toLowerCase()] ?? FIELD_ALIAS[key]
  if (!field) return
  const v = value.trim()
  if (!v) return
  switch (field) {
    case 'kind':
      fields.kind = KIND_MAP[v.toLowerCase()] ?? KIND_MAP[v] ?? fields.kind
      break
    case 'form':
      fields.form = FORM_MAP[v.toLowerCase()] ?? FORM_MAP[v] ?? fields.form
      break
    case 'topics':
      fields.topics = splitList(v)
      break
    case 'tags':
      fields.tags = splitList(v)
      break
    case 'golden':
      fields.golden = splitList(v)
      break
    /*
     * 重要观点：**一行一条，重复出现即多条**（md 这条路只能这样表达多条）。
     * 写法是「一句话结论 —— 解释 / 证据」；舍不得写破折号时，整行都算结论。
     * 只认中文破折号 —— 不认连字符：正文里 "AI-powered"、"2024-09-18" 这类词不能被劈开。
     */
    case 'viewpoints': {
      const m = /^(.*?)\s*[—–]{1,2}\s*(.*)$/.exec(v)
      const item = m ? { title: m[1].trim(), text: m[2].trim() } : { title: v, text: '' }
      fields.viewpoints = [...(fields.viewpoints ?? []), item]
      break
    }
    default:
      ;(fields as Record<string, unknown>)[field] = v
  }
}

/**
 * 字段名允许带**尾注**：「归属（事 / 理 / 道）：理」照样认成「归属」。
 *
 * 为什么要有它：模板想在一行里把"这一格要什么"写清楚，括号注是最自然的位置
 * （写在冒号后面会被当成值，对枚举字段直接出错）。只剥**行尾**那一对括号，
 * 字段名中间的括号不动。
 *
 * 注意两条：
 *  1. 注里**不能出现冒号** —— 冒号是"名与值的分界"，注里带冒号会让这一行认不出字段
 *     （不认只是被跳过，不会认错，但那一格就丢了），所以模板里用「」或破折号替；
 *  2. 字段名（含注）上限 40 字：放宽是为了容下较长的注；放宽不会误认 ——
 *     剥掉注之后还得**精确等于**一个已知字段名才算数。
 */
function keyOf(raw: string): string {
  return raw.replace(/[（(][^）)]*[）)]\s*$/, '').trim()
}

/** md / txt：按「字段：值」逐行读，遇到「正文：」把剩下的全收下 */
function parseLoose(text: string): ImportResult {
  const fields: ImportedForm = {}
  const warnings: string[] = []
  const lines = text.split(/\r?\n/)
  let i = 0
  for (; i < lines.length; i += 1) {
    const line = lines[i]
    const m = line.match(/^\s*([^：:]{1,40})\s*[：:]\s*(.*)$/)
    const key = keyOf(m?.[1] ?? '')
    const lower = key.toLowerCase()
    if (CONTENT_KEYS.includes(lower) || CONTENT_KEYS.includes(key)) {
      const rest = (m?.[2] ?? '').trim()
      const body = [rest, ...lines.slice(i + 1)].filter((s) => s !== undefined).join('\n').trim()
      fields.content = body
      fields.contentHtml = mdToHtml(body)
      i = lines.length
      break
    }
    if (m && FIELD_ALIAS[lower] !== undefined) assign(fields, key, m[2])
  }
  if (!fields.content && !fields.summary) warnings.push('没读到正文：请让文件里的正文段以「正文：」开头')
  return { fields, warnings }
}

/** JSON 清单：字段名与表单一一对应（也容忍中文键） */
function parseJson(text: string): ImportResult {
  const warnings: string[] = []
  let raw: unknown
  try {
    raw = JSON.parse(text)
  } catch {
    return { fields: {}, warnings: ['这个文件不是合法的 JSON'] }
  }
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    return { fields: {}, warnings: ['JSON 顶层应该是一个对象（字段名 → 内容）'] }
  }
  const obj = raw as Record<string, unknown>
  const fields: ImportedForm = {}
  const str = (v: unknown): string => (typeof v === 'string' ? v.trim() : '')

  for (const [k, v] of Object.entries(obj)) {
    if (Array.isArray(v)) {
      const key = k.toLowerCase()
      if (key === 'topics' || key === '主题') fields.topics = v.map((x) => String(x).trim()).filter(Boolean)
      else if (key === 'tags' || key === '标签') fields.tags = v.map((x) => String(x).trim()).filter(Boolean)
      else if (key === 'golden' || key === '经典语句' || key === '金句') {
        fields.golden = v.map((x) => String(x).trim()).filter(Boolean)
      } else if (key === 'viewpoints' || key === '重要观点') {
        fields.viewpoints = v
          .filter((x) => x && typeof x === 'object')
          .map((x) => {
            const o = x as Record<string, unknown>
            return { title: str(o.title ?? o.总结), text: str(o.text ?? o.解释) }
          })
          .filter((v2) => v2.title || v2.text)
      }
      continue
    }
    const value = str(v)
    if (!value) continue
    if (k.toLowerCase() === 'contenthtml' || k === '正文html') fields.contentHtml = value
    else if (k.toLowerCase() === 'content' || k === '正文' || k === '原文') fields.content = value
    else assign(fields, k, value)
  }

  if (fields.contentHtml && !fields.contentHtml.includes('<')) fields.contentHtml = mdToHtml(fields.contentHtml)
  if (!fields.content && !fields.summary) warnings.push('文件里没有「正文」或「一句话总结」—— 表单要你自己补上')
  return { fields, warnings }
}

/**
 * 入口：按扩展名选解析方式。
 * **文件里给两份正文时以 contentHtml 为准**（纯文本由它派生，见页面的保存逻辑）。
 */
export function parseImportFile(name: string, text: string): ImportResult {
  const ext = (name.split('.').pop() ?? '').toLowerCase()
  if (ext === 'json') return parseJson(text)
  return parseLoose(text)
}

/* ---------------- 粘贴进来的文本（2026-09-19） ---------------- */

/**
 * 剥掉 Markdown 代码围栏。
 *
 * 为什么必须有这一步：AI 聊天里复制出来的 JSON 十有八九裹在 ```json 里
 * （它这么写是为了好看），原样贴进 `JSON.parse` 只会得到"不是合法的 JSON"。
 * 剥法保守 —— 只在围栏成对出现时取中间那段，否则原文返回。
 */
export function stripFence(text: string): string {
  const m = /```[a-zA-Z0-9]*\s*\n([\s\S]*?)```/.exec(text)
  return (m ? m[1] : text).trim()
}

/**
 * 「这是你要的清单：{ … } 有问题再问我」—— 从一段话里把那个 JSON 对象抠出来。
 * 只在整段**不是**以 `{` 开头时试；抠出来的那段必须真能 parse 才算数，
 * 所以不会把正文里恰好带花括号的普通文字误当成 JSON。
 */
function tryExtractJson(text: string): string {
  const a = text.indexOf('{')
  const b = text.lastIndexOf('}')
  if (a < 0 || b <= a) return ''
  const slice = text.slice(a, b + 1)
  try {
    JSON.parse(slice)
    return slice
  } catch {
    return ''
  }
}

/**
 * 粘贴进来的文本：与「选文件」走同一个解析器，只是**没有文件名可依**，靠内容自己认。
 *  1. 先剥代码围栏（见 stripFence）；
 *  2. 以 `{` / `[` 开头 → JSON；开头是别的话，就试着从里面抠一个能 parse 的对象；
 *  3. 都不是 → 按「字段：值」逐行读（md / txt 那条路）。
 * 认不出字段不在这里报错，由页面决定怎么说（返回空 fields + warnings）。
 */
export function parsePasted(text: string): ImportResult {
  const body = stripFence(text)
  if (/^[[{]/.test(body)) return parseJson(body)
  const inner = tryExtractJson(body)
  if (inner) return parseJson(inner)
  return parseLoose(body)
}

/**
 * 认出来的字段名（按表单顺序）。
 * 给"填进去了什么"的交代用 —— 选文件与粘贴两条路共用同一份说法，
 * 免得两个入口把同一件事说成两种（原来这段逻辑散在页面里，2026-09-19 收到这里）。
 */
export function recognizedFields(f: ImportedForm): string[] {
  const got: string[] = []
  if (f.kind) got.push('归属')
  if (f.form) got.push('形态')
  if (f.title) got.push('标题')
  if (f.topics?.length) got.push('主题')
  if (f.tags?.length) got.push('标签')
  if (f.sourceName) got.push('来源')
  if (f.link) got.push('原文链接')
  if (f.videoUrl) got.push('视频链接')
  if (f.content) got.push('正文')
  if (f.contentHtml) got.push('样式')
  if (f.digest) got.push('摘要')
  if (f.viewpoints?.length) got.push('重要观点')
  if (f.summary) got.push('一句话总结')
  if (f.insight) got.push('感悟')
  if (f.why) got.push('为什么成立')
  if (f.golden?.length) got.push('经典语句')
  return got
}

/* ---------------- md → HTML（只做收件需要的那几种结构） ---------------- */

function inline(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*([^*]+)\*/g, '<em>$1</em>')
    .replace(/`([^`]+)`/g, '$1')
}

/** 极简 Markdown → HTML：标题 / 粗斜体 / 有序无序列表 / 引用 / 段落 */
export function mdToHtml(md: string): string {
  const out: string[] = []
  let list: 'ul' | 'ol' | '' = ''
  let quote: string[] = []

  const closeList = (): void => {
    if (!list) return
    out.push(`</${list}>`)
    list = ''
  }
  const flushQuote = (): void => {
    if (!quote.length) return
    out.push(`<blockquote><p>${quote.map(inline).join('<br/>')}</p></blockquote>`)
    quote = []
  }

  for (const raw of md.split(/\r?\n/)) {
    const line = raw.trim()
    if (!line) {
      flushQuote()
      closeList()
      continue
    }
    if (/^>\s?/.test(line)) {
      closeList()
      quote.push(line.replace(/^>\s?/, ''))
      continue
    }
    flushQuote()
    const h = line.match(/^(#{1,3})\s+(.*)$/)
    if (h) {
      closeList()
      out.push(`<h${h[1].length}>${inline(h[2])}</h${h[1].length}>`)
      continue
    }
    const ul = line.match(/^[-*+]\s+(.*)$/)
    if (ul) {
      if (list !== 'ul') {
        closeList()
        out.push('<ul>')
        list = 'ul'
      }
      out.push(`<li>${inline(ul[1])}</li>`)
      continue
    }
    const ol = line.match(/^\d+[.)]\s+(.*)$/)
    if (ol) {
      if (list !== 'ol') {
        closeList()
        out.push('<ol>')
        list = 'ol'
      }
      out.push(`<li>${inline(ol[1])}</li>`)
      continue
    }
    closeList()
    out.push(`<p>${inline(line)}</p>`)
  }
  flushQuote()
  closeList()
  return out.join('')
}

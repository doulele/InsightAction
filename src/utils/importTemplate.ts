/**
 * 记一笔 · 导入模板（2026-09-18，2026-09-19 改成**按形态生成**）——
 * 把「契约」做成能发给电脑的文件（或直接粘进聊天的一段文本）。
 *
 * 为什么要有文件版：「复制契约示例」只能把文本留在手机的剪贴板里，而外部 AI 多半在电脑上。
 * 所以这里在本机生成两份模板，由用户**转发到聊天**（文件传输助手 / 电脑）——
 * 全程不经过后端、不上传，与「粘贴清单」「导入文件」是同一条隐私口径。
 *
 * 两份模板的写法不同、**字段完全一样**（与 utils/fileImport.ts 的解析器三方对齐，改一处要一起改）：
 *   .json —— 字段名与表单一一对应，外部 AI 照它填最不容易出错（推荐）；
 *   .md   —— 「字段：值」逐行，「正文：」以下全算正文；人也能直接照着填。
 * 唯一的差别是 md 没有 `contentHtml`：正文按 md 语法写就行，读进来会自动转富文本。
 *
 * **按形态生成**（2026-09-19 改，用户两轮校正后定）：
 *  1. 契约跟着页面上选中的「形态」走 —— 文章给了「原文链接」、视频给「视频链接」、
 *     一句话只有正文与感悟，其余（经典语句 / 摘要 / 重要观点 / 一句话总结）是文章与视频共用。
 *     把另一种形态才有的字段塞给 AI，只会诱导它替你编一格（"视频链接"填进一篇公众号文章）。
 *  2. 契约里**有 `form` 这一格**（2026-09-21 加回，用户提的）：值就是当前形态的 id
 *     （`article` / `quote` / `video`），让清单**自己声明身份**。
 *     为什么加回来 —— 用户的原话是"万一进来复制错了咋搞"：在「一句话」签上复制了「文章」那份契约，
 *     全文只有链接、金句、观点，粘回来靠字段反推也能认成文章，但**用户不知道**发生了什么。
 *     有了这一格：① 导入以**清单里写的**为准（`applyImport` 优先用它，见 fileImport）；
 *     ② 预检弹框能明说"这份清单自己写着是**文章**，你现在选的是**一句话**"，让人当场发现拿错了。
 *     老文件 / 手写清单没有这一格时，仍由 `utils/fileImport.ts` 的 `inferForm()` 按字段反推。
 *  3. 契约里**没有 `why`**（原来有，2026-09-19 去掉）：它只对「理」有意义，
 *     而归属（事 / 理 / 道）本来就不在契约里 —— 同理，AI 判不准就不要它替你写。
 *
 * 字段表与三种形态的生成规则都写在下方的 `FORM_KEYS` / `JSON_SAMPLE` / `MD_LABEL` 里：
 * 为什么用表而不是三段手写文本 —— 字段名改一处要三处跟着改，迟早会漂。
 *
 * 两点约定：
 *  1. **文案上不出现「下载」**：微信里没有下载落点，落点就是"转发到聊天"
 *     （底层用 localBackup 的 writeTextFile + shareFile，与备份 / 修行档案导出同一套）；
 *  2. **文件名的 ASCII 惯例**：`guanzhi-import-template-<形态>.json`，
 *     与 guanzhi-backup-*、guanzhi-archive-* 一致，避开多字节文件名在各端转发时的差异；
 *     文件名带形态是为了"一眼看得出"，而**契约里也有 `form` 那一格**（见上）——
 *     转发到聊天之后文件躺在列表里，两处都对得上才不会拿错。
 */
import type { ObserveForm } from '@/stores/observe'
import { shareFile, writeTextFile } from '@/utils/localBackup'

/** 模板格式：json（契约最准）/ md（人和 AI 都能填） */
export type TemplateKind = 'json' | 'md'

/** 形态的中文名（契约标题 / 文件说明 / 页面提示都要它） */
export const FORM_LABEL: Record<ObserveForm, string> = {
  article: '文章',
  quote: '一句话',
  video: '视频',
}

/** 三种形态（按页面上的签的顺序） */
const ALL_FORMS: ObserveForm[] = ['article', 'quote', 'video']

/**
 * 每种形态要哪几格 —— **顺序就是契约里的顺序**（`form` 在最前、正文放在最后）。
 * 三种形态的差别其实只有三处：文章有「原文链接」、视频有「视频链接」、一句话只有正文与感悟。
 *
 * `form` 放第一位（2026-09-21）：它是最该被先看到、也最不该被改的一格 ——
 * AI 读到的第一行就是"这是文章/一句话/视频的清单"，填的时候自然照它来。
 */
const FORM_KEYS: Record<ObserveForm, string[]> = {
  article: ['form', 'title', 'sourceName', 'link', 'golden', 'digest', 'viewpoints', 'summary', 'insight', 'content', 'contentHtml'],
  video: ['form', 'title', 'sourceName', 'videoUrl', 'golden', 'digest', 'viewpoints', 'summary', 'insight', 'content', 'contentHtml'],
  quote: ['form', 'content', 'insight'],
}

/**
 * JSON 里每格的示例值。
 * JSON 没有注释位，「这一格要什么」只能写在**值**里 —— 值本身就是给 AI 的说明，
 * 它会照形状替换掉（`viewpoints` 还得让它看见"一条一个对象"的形状，所以给数组）。
 */
const JSON_SAMPLE: Record<string, unknown> = {
  title: '给它起一个你以后找得回来的标题',
  sourceName: '它从哪来：公众号 / 播客 / 书 / 朋友',
  link: '原文链接；没有就留空',
  videoUrl: '视频链接；没有就留空',
  golden: ['从原文里挑出最打动你的那句话（可多条）'],
  digest: '用你自己的话把原文压成两三句（不是复制粘贴）',
  viewpoints: [{ title: '一句话结论', text: '解释 / 证据；可多条，一条一个对象' }],
  summary: '一句话说清它讲了什么（这一格必填）',
  insight: '它让你想到什么、你打算怎么用',
  content: '原文正文：把原文照抄进来（是原文，不是你的总结）',
  contentHtml: '<p>同一份正文的带样式版本（可选）：可用 <strong>加粗</strong>、<h3>小标题</h3>、<ul><li>列表</li></ul></p>',
}

/** 一句话形态下「正文」就是那一句话，示例值换一种说法（字段名仍是 content） */
const QUOTE_CONTENT_SAMPLE = '那一句话：把打动你的那句原话照抄进来（这一格必填）'

/**
 * MD 里每格的写法（字段名 + 括号注）。四条规矩对齐解析器（别改坏）：
 *  1. 值写在冒号后面；空值会被忽略，所以留空的行等于没写，不会把空字段灌进表单；
 *  2. 括号注会被解析器剥掉再认字段名（`keyOf`），注里写清"这格要什么"最省事，
 *     但**注里不能出现冒号**（冒号是名与值的分界），所以注里用「」或 ·
 *  3. 「提示」行、`##` 标题行都只写给人看：认不出字段名的整行跳过；
 *  4. 「正文」之后**直到文件结束**都算正文，所以它必须放在最后一个字段。
 *
 * 没有 `contentHtml` 这一格：md 的正文本身支持 `#` / `**` / `-` / `>`，
 * 读进来会自动转成富文本，用不着再手写一遍 HTML。
 */
const MD_LABEL: Record<string, string> = {
  form: '形态（article = 文章 / quote = 一句话 / video = 视频 · 这一格请原样保留，别改）',
  title: '标题（你以后找得回来的名字）',
  sourceName: '来源（公众号 / 播客 / 书 / 朋友 / UP 主）',
  link: '链接（原文地址；没有就留空）',
  videoUrl: '视频链接（没有就留空）',
  golden: '经典语句（从原文里挑出最打动你的那句原话；可多条，用、隔开）',
  digest: '摘要（用你自己的话把原文压成两三句）',
  viewpoints: '重要观点（一行一条，写成「结论 —— 解释 / 证据」）',
  summary: '一句话总结（一句话说清它讲了什么）',
  insight: '感悟（它让你想到什么、你打算怎么用）',
  content: '正文（原文原话，不是你的总结）',
}

/** 一句话形态的正文行（字段名仍是「正文」，靠括号注说清它就是那一句话） */
const QUOTE_CONTENT_LINE = '正文（那一句话 · 必填）：'

/**
 * 契约示例（JSON）—— 只给当前形态要的那几格。
 * `form` 直接写成**当前形态的 id**（不是说明文字）：这一格是清单的身份证，
 * AI 照抄下来，回来时就不必靠字段猜（拿错契约时也认得出来，见文件头的说明）。
 */
export function contractJson(form: ObserveForm): string {
  const out: Record<string, unknown> = {}
  for (const key of FORM_KEYS[form]) {
    if (key === 'form') {
      out[key] = form
      continue
    }
    out[key] = key === 'content' && form === 'quote' ? QUOTE_CONTENT_SAMPLE : JSON_SAMPLE[key]
  }
  return JSON.stringify(out, null, 2)
}

/** 模板（Markdown）—— 值**全部留空**，给人 / AI 填；字段与 JSON 契约完全一样 */
export function contractMd(form: ObserveForm): string {
  const label = FORM_LABEL[form]
  const others = ALL_FORMS.filter((f) => f !== form).map((f) => FORM_LABEL[f]).join(' / ')
  /* 正文不进这一串：它必须留在最后（解析器见到它就收到底） */
  /* `form` 那一格**带值**（其余留空给人 / AI 填）：它是这份清单的身份证，不该由谁去猜 */
  const heads = FORM_KEYS[form]
    .filter((k) => MD_LABEL[k] && k !== 'content')
    .map((k) => `${MD_LABEL[k]}：${k === 'form' ? form : ''}`)
  return [
    `# 观止知行 · 记一笔导入模板（${label}）`,
    '',
    '提示：把值写在冒号后面；用不着的行整行删掉（空值会被忽略，不会写进表单）。',
    '提示：括号里的字是说明，不用删；「正文」必须放在最后一个字段 —— 它以下直到文件结束都算正文。',
    `提示：这份模板只给「${label}」这一种形态（形态那一格已写好 ${form}，请原样保留）。`
      + `要${others}的清单，回小程序切到那张签再复制一次，别拿这一份凑。`,
    '提示：正文支持简单格式：# 小标题、**加粗**、- 列表、> 引用（会自动转成富文本，所以没有单独的一格）。',
    '提示：没有 归属（事 / 理 / 道）、主题、标签、为什么成立 —— 那几格在应用里点一下就有，不在契约里。',
    '',
    ...heads,
    '',
    `## 正文 · ${form === 'quote' ? '那一句话，原话' : '原文原话，不是你的总结'}`,
    '',
    form === 'quote' ? QUOTE_CONTENT_LINE : `${MD_LABEL.content}：`,
    '',
  ].join('\n')
}

/**
 * 生成模板文件并转发到聊天（用户自己发给「文件传输助手」再在电脑上打开）。
 * 失败时**抛出**可读原因（基础库 < 2.16.1 不支持文件转发），由调用方给出降级建议。
 */
export async function shareTemplate(kind: TemplateKind, form: ObserveForm): Promise<void> {
  const text = kind === 'json' ? contractJson(form) : contractMd(form)
  const { filePath, fileName } = writeTextFile(text, `guanzhi-import-template-${form}.${kind}`)
  await shareFile(filePath, fileName)
}

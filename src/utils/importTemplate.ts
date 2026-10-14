/**
 * 记一笔 · 交给 AI 的提示词与空模板（2026-09-18 起，2026-10-14 加提示词）——
 * 把「契约」做成能发给电脑的文件、或直接粘进聊天的一段文本。
 *
 * 为什么要有文件版：剪贴板只留在手机上，而外部 AI 多半在电脑上。
 * 所以这里在本机生成两份文本，由用户**转发到聊天**（文件传输助手 / 电脑）——
 * 全程不经过后端、不上传，与「粘贴JSON表单」「导入表单」是同一条隐私口径。
 *
 * 两份的写法不同、**字段完全一样**（与 utils/fileImport.ts 的解析器三方对齐，改一处要一起改）：
 *   prompt —— **提示词**：总要求 + 逐格怎么填 + 当前形态的**空骨架** JSON，交给 AI 让它照结构填（推荐）；
 *   md     —— **空模板**：「字段：值」逐行、值全留空，「正文：」以下全算正文；人也能直接照着填。
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
 * **提示词**（2026-10-14 加）：除了"给结构"，还要"给要求"。
 * 原来「复制契约示例」给的是一份裸 JSON，而里面的值是"给它起一个你找得回来的标题"
 * 这类给人看的示例说明 —— 大模型拿到常原样抄、或不知道要读哪段内容。
 * 现在主路是把「总要求 + 逐格怎么填 + 空骨架」拼成一段提示词（`contractPrompt()`）交给 AI；
 * **规则按形态给三套**（一句话 / 文章 / 视频本来就不一样，见 `promptFieldRules`），
 * 骨架与字段名仍只有 `FORM_KEYS` 一份真相。
 *
 * 字段表与三种形态的生成规则都写在下方的 `FORM_KEYS` / `MD_LABEL` 里：
 * 为什么用表而不是三段手写文本 —— 字段名改一处要三处跟着改，迟早会漂。
 *
 * 两点约定：
 *  1. **文案上不出现「下载」**：微信里没有下载落点，落点就是"转发到聊天"
 *     （底层用 localBackup 的 writeTextFile + shareFile，与备份 / 修行档案导出同一套）；
 *  2. **文件名的 ASCII 惯例**：`guanzhi-import-prompt-<形态>.md` / `guanzhi-import-template-<形态>.md`，
 *     与 guanzhi-backup-*、guanzhi-archive-* 一致，避开多字节文件名在各端转发时的差异；
 *     文件名带形态是为了"一眼看得出"，而**契约里也有 `form` 那一格**（见上）——
 *     转发到聊天之后文件躺在列表里，两处都对得上才不会拿错。
 */
import type { ObserveForm } from '@/stores/observe'
import { shareFile, writeTextFile } from '@/utils/localBackup'

/**
 * 要转发出去的那份文件是哪种（2026-10-14 起只剩两种）。
 *   prompt —— **提示词**：一段「要求」+ 当前形态的契约 JSON，交给 AI 让它照结构填（主路）；
 *   md     —— **空模板**：逐行「字段：值」、值全留空，给"想自己填 / AI 只会写行文本"用。
 * 原来的 `json`（裸契约示例文件）已并入提示词 —— 提示词里本就含契约，
 * 且带指令更不容易被 AI 把示例说明当答案抄走。
 */
export type TemplateKind = 'prompt' | 'md'

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
 * 契约的**空骨架**（JSON）—— 只给当前形态要的那几格，值一律留空。
 *
 * 为什么值留空（2026-10-14 改）：从前这里是"给 AI 看的示例值"（如"给它起一个你以后找得回来的标题"），
 * 大模型常把那几句**原样抄回来**。现在所有说明都挪进提示词的「每一格要怎么填」，
 * 骨架只表达**结构与形状**（`viewpoints` 是"对象数组"这件事得看得见），值交给它填。
 * `form` 是唯一带值的一格 —— 它是这份清单的身份证（AI 照抄下来，回来时不必靠字段猜）。
 */
export function contractJson(form: ObserveForm): string {
  const out: Record<string, unknown> = {}
  for (const key of FORM_KEYS[form]) {
    if (key === 'form') out[key] = form
    else if (key === 'golden') out[key] = []
    else if (key === 'viewpoints') out[key] = [{ title: '', text: '' }]
    else out[key] = ''
  }
  return JSON.stringify(out, null, 2)
}

/**
 * 「每一格要怎么填」—— **按形态给三套**（一句话 / 文章 / 视频本来就不同）。
 *
 * 为什么不写成一套通用的：一句话只有正文与感悟，让它去挑「经典语句」「摘要」等于凭空造格子；
 * 文章与视频也有区别 —— 链接那一格不同（原文链接 / 视频链接）、正文的来源不同（原文 / 逐字稿）。
 * 这份规则**与 `FORM_KEYS` 一一对应**：结构里没有的格子，这里一个字都不提。
 */
function promptFieldRules(form: ObserveForm): string[] {
  if (form === 'quote') {
    return [
      '`content`：那一句话本身 —— **照抄原话，一个字都别改**。**必填**。',
      '`insight`：用第一人称写它让你想到什么、你打算怎么用它；可分 2~3 点，别加那句原话没说的东西。',
      '这份结构里**只有这三格**（`form` / `content` / `insight`）—— 没有标题、来源、链接、金句、摘要、观点、总结，也不用给正文的 HTML 版。',
    ]
  }
  const isVideo = form === 'video'
  return [
    '`title`：保留原标题；没有标题就把核心问题提炼成一句（≤60 字）。**必填**。',
    '`sourceName`：来源平台 / 作者 / 公众号（≤30 字）；没有就留空。',
    isVideo
      ? '`videoUrl`：视频链接；原文里真给了才填，没有就留空。'
      : '`link`：原文链接；原文里真给了才填，没有就留空。',
    isVideo
      ? '`golden`：从**逐字稿**里挑最有力、能独立传播的原话，**照抄别改**；每条 ≤120 字，通常 3~5 条。'
      : '`golden`：从**原文**里挑最有力、能独立传播的原话，**照抄别改**；每条 ≤120 字，通常 3~5 条。',
    '`digest`：客观摘要 —— 用你自己的话把"问题 → 原因 → 结论"压成一段，150~300 字，不加个人感受。',
    '`viewpoints`：把内容拆成 3~5 条核心观点，一条一个对象：`title` 是一句短结论（≤20 字），`text` 是解释与证据（可引用原文关键句）。',
    '`summary`：一句话点明全篇主旨，回答"它到底在说什么"。**必填**。',
    '`insight`：用第一人称写"我打算怎么做"，具体可执行（如「当……时，我就……」），不要复述原文；通常 3 点。',
    isVideo
      ? '`content`：视频里讲了什么 —— 有逐字稿就**照抄**（可分段、可加小标题），没有就记下关键几句；不要大段删减、不要改原意、不要编。'
      : '`content`：把原文**照抄**进来（是原文，不是你的总结）—— 可分段、可加小标题、可修正明显错别字，但不要大段删减、不要改原意、不要编。',
    '`contentHtml`：与 `content` **内容完全一致**，只是多一层结构标签：`<h2>`/`<h3>` 小标题、`<p>` 段落、`<ul>`/`<ol>`/`<li>` 列表、`<blockquote>` 引用、`<strong>` 加粗。**不要写任何 style 属性、也不要套一层 `<div>`** —— 展示样式由程序注入（写了也会被丢掉）。',
  ]
}

/** 总要求（三种形态共用）；`form` 那一格的值随形态变，所以按参数拼 */
function promptCommonRules(form: ObserveForm): string[] {
  return [
    '只输出 JSON 本身 —— 不要解释、不要前言后记，也不要包在 ``` 里。',
    '必须是**合法 JSON**：字符串用双引号；字符串里的换行写成 \\n。',
    '不要增加结构里没有的字段，也不要漏掉标了**必填**的格子。',
    '内容里没有、或你拿不准的格子**留空**（字符串给 `""`、数组给 `[]`）—— 不要编链接、来源、作者。',
    `\`form\` 那一格原样保留（就是 \`${form}\`），不要改。`,
  ]
}

/**
 * 提示词（2026-10-14 新增）—— 「总要求 + 每一格要怎么填 + 空骨架」，整段交给 AI。
 *
 * 为什么不再只给裸 JSON：裸 JSON 里的值是"给它起一个你以后找得回来的标题"这类
 * **给人看的示例说明** —— 大模型拿到它，常把那几句原样抄回来、或根本不知道要读你贴的哪段内容。
 * 现在把"只输出 JSON、哪几格照抄、哪几格可以概括、字数多少、拿不准留空"逐条写出来，它才照格式做。
 *
 * 骨架与字段名**直接复用 `contractJson()` / `FORM_KEYS`** —— 只有一份真相，不会与解析器漂；
 * 规则也**按形态给三套**（见 `promptFieldRules`），不会让"一句话"去填它根本没有的格子。
 */
export function contractPrompt(form: ObserveForm): string {
  const label = FORM_LABEL[form]
  const intro = form === 'quote'
    ? '你是我的整理助手。我会在下面贴一句话，请把它整理成一份 JSON。'
    : `你是我的整理助手。我会在下面贴一段内容（${form === 'video' ? '视频逐字稿' : '原文'}），请把它整理成一份 JSON 清单。`
  return [
    `# 观止知行 · 记一笔：把内容整理成一张「${label}」清单`,
    '',
    intro,
    '下面 JSON 里的每一格都是**空的**，那是留给你的位置 —— 请按「每一格要怎么填」逐格填上，',
    '不要照抄空值，也不要增减字段。',
    '',
    '## 总要求',
    ...promptCommonRules(form).map((r, i) => `${i + 1}. ${r}`),
    '',
    '## 每一格要怎么填',
    ...promptFieldRules(form).map((r) => `- ${r}`),
    '',
    '## 按这个结构输出（值留空，等你填）',
    contractJson(form),
    '',
    '我要整理的内容贴在下面：',
    '',
  ].join('\n')
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
 * 生成提示词 / 空模板文件并转发到聊天（用户自己发给「文件传输助手」再在电脑上打开）。
 * 失败时**抛出**可读原因（基础库 < 2.16.1 不支持文件转发），由调用方给出降级建议。
 */
export async function shareTemplate(kind: TemplateKind, form: ObserveForm): Promise<void> {
  const isPrompt = kind === 'prompt'
  const text = isPrompt ? contractPrompt(form) : contractMd(form)
  /* 两份都用 .md 后缀：都是给人看、给 AI 读的文本，电脑上双击就能打开 */
  const name = isPrompt ? `guanzhi-import-prompt-${form}.md` : `guanzhi-import-template-${form}.md`
  const { filePath, fileName } = writeTextFile(text, name)
  await shareFile(filePath, fileName)
}

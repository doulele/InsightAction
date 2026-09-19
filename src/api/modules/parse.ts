/**
 * 服务端文件解析（需登录）。
 *
 *   POST /parse  { name, dataBase64 }
 *     → { fields, text, textLength, source, warnings, meta? }
 *
 * 分工：**文本类文件（.json / .md / .txt）在小程序本机解析、从不上传**；
 * 这里只处理本机读不了的：Word（.docx）/ Excel（.xlsx）/ PDF / 图片（服务端转微信官方 OCR）。
 *
 * 为什么走 JSON + base64 而不是 `uni.uploadFile`（multipart）：
 *  · 小程序端把文件读成 base64 只是一行（`FileSystemManager.readFile(..., 'base64')`），
 *    而后端因此不必引入 multer、也不必落一个上传临时目录 —— **少一处可能残留用户文件的地方**
 *    （我们承诺的是"解析完成即删除"）；
 *  · 代价是请求体膨胀约 1/3，所以体积闸门（2MB）卡在读取之前，见 `utils/fileImport.ts`。
 *
 * 两条硬约束（与后端 routes/parse.js 一致）：
 *  1. **调用前必须明示同意**：文件离开手机是性质变化，不能替用户默认答应（页面负责弹窗）；
 *  2. 文件内容不落盘、不进数据库、不打日志 —— 响应回来之后服务器就没有它了。
 */
import { http } from '@/api/http'
import type { AiMeta } from '@/api/modules/ai'

/**
 * 「记一笔」的字段契约（唯一出处）。
 * 前端本机解析（utils/fileImport.ts）与服务端解析共用这一套字段名 ——
 * 改字段名要两处一起改，否则导入会静默丢字段。
 */
export interface ParseFields {
  kind?: 'thing' | 'theory' | 'mother'
  form?: 'article' | 'quote' | 'video'
  title?: string
  topics?: string[]
  tags?: string[]
  sourceName?: string
  link?: string
  videoUrl?: string
  content?: string
  contentHtml?: string
  digest?: string
  viewpoints?: Array<{ title?: string; text?: string }>
  summary?: string
  insight?: string
  why?: string
  golden?: string[]
}

export interface ParseResult {
  /** 抽出来的字段（缺省即"文件里没写"，页面保留用户当前输入） */
  fields: ParseFields
  /** 前 1500 字预览（给人看"读到了什么"，不用于入库） */
  text: string
  /** 抽出文本的总长度 */
  textLength: number
  /** 谁整理的：rule 规则 / ai 模型 / ocr 图片识别 */
  source: 'rule' | 'ai' | 'ocr'
  /** 需要让人知道的问题（不拦人，只如实说） */
  warnings: string[]
  /** source = 'ai' 时的用量与成本 */
  meta?: AiMeta
}

/**
 * 送一个文件给服务端解析。
 * 超时放宽到 30 秒：图片 OCR 与「长文请模型整理」都比普通接口慢得多，
 * 15 秒默认值会让用户看到"网络异常"，而其实再等两秒就出来了。
 */
export function parseFile(token: string, body: { name: string; dataBase64: string }): Promise<ParseResult> {
  return http.post<ParseResult, { name: string; dataBase64: string }>('/parse', body, {
    header: { Authorization: `Bearer ${token}` },
    timeout: 30000,
    /* 错误提示由页面统一给（要带上"换种格式试试"这类指引），这里不重复弹 */
    showError: false,
  })
}

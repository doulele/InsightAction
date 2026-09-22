/**
 * 观 · 收件池 —— 用户主动输入的内容统一落在这里（事 / 理 / 道 三类同源）。
 *
 * 为什么三层共用一个池子：
 *  - 录入只有一个入口，用户不必先想清楚「这算事还是理」再决定去哪儿存；
 *  - 事→理→道 是**晋升**关系（一条事读透了可以立为理，几条理可以提炼成母题），
 *    同池才有 ref 可挂；拆成三个 store 就要写跨 store 引用，容易脏。
 *
 * 硬规则（来自产品哲学）：
 *  1. 不允许只存不写：每种形态都有必填（见 validate()）——文章 / 视频要"标题 + 一句你自己的总结"，
 *     一句话形态就是那句话本身（链接一律选填：没有链接也能存）；
 *  2. 存了不算数：修为只在**处理**时入账（markHandled），不是保存时；
 *  3. 存而未处理满 7 天 → 进统一清理队列（dueForCleanup），必须处理或删。
 */
import { defineStore } from 'pinia'
import { computed, ref } from 'vue'
import { logTrace } from '@/utils/traceLog'
import { htmlToText, sanitizeHtml } from '@/utils/richText'
import { DAO_LINE_MAX } from '@/config/dao'
import { dailyQuotaOf } from '@/config/quota'
import { dateKeyOf } from '@/utils/dateKey'
import { useAssessmentStore } from '@/stores/assessment'
import { useModeStore } from '@/stores/mode'

/** 归属层：事（见闻）/ 理（认知）/ 道（母题） */
export type ObserveKind = 'thing' | 'theory' | 'mother'

/** 内容形态：文章 / 一句话 / 视频 */
export type ObserveForm = 'article' | 'quote' | 'video'

/** 六个领域（与预置理库的领域划分一致） */
export const OBSERVE_TOPICS = ['心智', '方法', '关系', '金钱', '身体', '时间'] as const
export type ObserveTopic = (typeof OBSERVE_TOPICS)[number]

/** 处理状态：草稿（没写为什么成立）/ 待整理（每日一则记住的）/ 已入册 */
export type ObserveState = 'draft' | 'pending' | 'confirmed'

/** 一条重要观点：先说结论（title），再解释（text）—— 与"摘抄"分开，这是你的话 */
export interface Viewpoint {
  /** 总结标题：它主张什么，一句话 */
  title: string
  /** 解释：凭什么是这样 / 证据是什么 / 你认哪一半 */
  text: string
}

export interface ObsItem {
  /** obs- 前缀 + 时间戳（只增不改） */
  id: string
  kind: ObserveKind
  form: ObserveForm
  title: string
  /**
   * 主题（领域）：**可多选**。一条内容常常横跨两三个领域
   * （"注意力被偷走"既是心智也是时间），单选会逼人做无谓的取舍。
   * 老数据里的单选字段 `topic: string` 由 migrateLegacy() 搬进这里。
   */
  topics: string[]
  tags: string[]
  /** 摘要（你用自己话压出来的摘要）—— 文章 / 视频用，选填，放「你的话」卡 */
  digest?: string
  /**
   * 重要观点（**多条**）：每条先一句总结（标题），再解释为什么 / 你认哪一半。
   * 一条内容里值得单独拎出来的观点往往不止一个，所以这里是数组而不是一段文字。
   */
  viewpoints?: Viewpoint[]
  /** 一句话总结（你的话：这条内容你自己的那一句）—— 文章与视频必填 */
  summary: string
  /**
   * 正文位（这条内容本身的正文）：
   *  - 文章 → 摘录的原文（选填，与链接二选一）；
   *  - 视频 → 视频里讲了什么（选填，可贴逐字稿）；
   *  - 一句话 → 那一句话（必填）。
   */
  content: string
  /**
   * 富文本正文（2026-09-17，可选）：从文件导入或手输时带简单样式（粗体 / 标题 / 列表）。
   *
   * **与 content 的关系是单向派生**：contentHtml 是正本（存前过白名单清洗），
   * content 是它的可读副本（每次编辑由 htmlToText 重算）。
   * 理由与清洗规则见 utils/richText.ts 的注释 —— 别在这里再加一份判断。
   */
  contentHtml?: string
  /**
   * 由文件导入（2026-09-17）。
   * 两个用途：详情页标一个「导入」角标；以及**不占当日信息配额**（见 quotaUsed）。
   */
  imported?: boolean
  /**
   * 处理时写下的那一句话（2026-09-17 从 content 里挪出来单独存）。
   * 原先是拼进正文的 —— 富文本化之后那会破坏 content = htmlToText(contentHtml) 的一致性，
   * 而且分开本来就更对：原文归原文，你的话归你的话。
   */
  handleNote?: string
  /** 经典语句（可多条，能一键收进「我的箴言」） */
  golden: string[]
  /**
   * 感悟 —— 一句话形态专用（这句话让你想到什么）。
   * 与 golden 的分工：golden 是**抄来的原话**（别人的），insight 是**你的话**（读完之后长出来的）。
   * 一句话形态不再收「经典语句」：那一句本身已经抄在 content 里了，再抄一遍只是重复。
   */
  insight?: string
  /** 原文链接（文章） */
  link?: string
  /** 视频链接（只存不解析，点击=复制后跳转） */
  videoUrl?: string
  /** 来源名（喂信息源质量榜） */
  sourceName?: string
  /** 为什么成立（理入册的必要条件） */
  why?: string
  /** 挂靠的母题 id */
  motherId?: string
  /**
   * 凝练句（2026-09-21，**只有「道」用得上**）：一句 ≤ 24 字的主张，
   * 由用户自己从这条道上凝出来，用于「观」大厅头部那句主张与开屏「今日一签」。
   *
   * 为什么另开一个字段而不是复用 title：title 是那个**问句**（「我到底在回避什么」）——
   * 它得一直是个问题（问句才会反复冒出来），而扉页上需要一句能立住的话。
   * 取用规则与长度上限见 `config/dao.ts`，别在页面里另写一套。
   *
   * 边界：`add()` 会给非「道」的条目清掉它；而 `update()` 把归属从道改成事/理时**保留**——
   * 取用侧只读 `mothers`，所以不显示；用户哪天再改回「道」，那句还在（不替他丢字）。
   */
  daoLine?: string
  /** 深度：0 存 / 1 写了自述 / 2 关联到某条理 */
  depth: 0 | 1 | 2
  state: ObserveState
  createdAt: number
  /** 处理（读过并写下）的时刻 */
  handledAt?: number
}

export type ObsInput = Omit<ObsItem, 'id' | 'createdAt' | 'depth' | 'state' | 'handledAt'> &
  Partial<Pick<ObsItem, 'depth' | 'state'>>

/** 收件上限（防止只进不出） */
export const ITEMS_LIMIT = 200
/** 待整理上限（每日一则「记住」的落点，逼用户在 20 条内消化） */
export const PENDING_LIMIT = 20
/** 存而未处理多少天后进清理队列 */
export const CLEAN_AFTER_MS = 7 * 24 * 60 * 60 * 1000

let uniq = 1

function nextId(): string {
  return `obs-${Date.now().toString(36)}-${(uniq++ % 1000).toString(36)}`
}

/**
 * 校验：不同形态的必填项不同，返回第一条错误（页面拿去 toast）。
 * 一句话 → content（那一句话）；文章 / 视频 → title（标题）+ summary（一句话总结）。
 * 链接、正文、摘要、感悟都是选填 —— 必填只留"起个名字 + 你交出的那一句"，闸门才拦得住。
 */
export function validate(input: Partial<ObsInput>): string {
  const form = input.form ?? 'quote'
  const content = (input.content ?? '').trim()
  const summary = (input.summary ?? '').trim()
  if (form === 'video') {
    if (!(input.title ?? '').trim()) return '给这个视频起个标题'
    if (!summary) return '写一句你自己的总结'
    return ''
  }
  if (form === 'article') {
    if (!(input.title ?? '').trim()) return '给这篇文章起个标题'
    if (!summary) return '写一句你自己的总结'
    return ''
  }
  if (!content) return '总得写点什么'
  if (content.length < 2) return '太短了，再说清楚一点'
  return ''
}

export const useObserveStore = defineStore(
  'observe',
  () => {
    const items = ref<ObsItem[]>([])
    /** 每日一则的互动记录：dateKey → 动作数组（同一动作不重复入账） */
    const dailyMarks = ref<Record<string, string[]>>({})

    /** 新在前 */
    const list = computed(() => items.value)

    function find(id: string): ObsItem | undefined {
      return items.value.find((i) => i.id === id)
    }

    /**
     * 老数据迁移（幂等，跑几次结果都一样；调用点在 App.vue onLaunch，
     * 必须晚于 pinia 的持久化水合，否则迁的是空 state）：
     *  1. 主题：单选 `topic: string` → 多选 `topics: string[]`；
     *  2. 重要观点：单条 `viewpoint: string` → 多条 `viewpoints: { title, text }[]`
     *     （老的那段文字整段放进 text，标题留空 —— 不替用户编标题）。
     */
    function migrateLegacy(): number {
      let moved = 0
      for (const it of items.value) {
        const raw = it as unknown as { topic?: string; viewpoint?: string }

        if (!Array.isArray(it.topics)) {
          it.topics = raw.topic ? [raw.topic] : []
          delete raw.topic
          moved++
        }

        if (!Array.isArray(it.viewpoints)) {
          it.viewpoints = raw.viewpoint ? [{ title: '', text: raw.viewpoint }] : []
          moved++
        }
        delete raw.viewpoint
      }
      return moved
    }

    /** 未处理的（存了但没读过写过的） */
    const pending = computed(() => items.value.filter((i) => !i.handledAt))
    const pendingCount = computed(() => pending.value.length)

    /** 待整理数（每日一则「记住」落点，含草稿） */
    const inboxCount = computed(
      () => items.value.filter((i) => i.state !== 'confirmed' && !i.handledAt).length,
    )

    /** 已入册的理（写了「为什么成立」的才算一条理，其余是草稿） */
    const theories = computed(() => items.value.filter((i) => i.kind === 'theory' && i.state === 'confirmed'))
    /** 母题（道）：用户认领或自己提炼出来的底层问题 */
    const mothers = computed(() => items.value.filter((i) => i.kind === 'mother'))

    /**
     * 存一条。返回 null 表示被上限拦下（页面提示）。
     * 注意：**保存不入账修为**，处理才入账 —— 避免「只存不读」刷分。
     */
    function add(input: ObsInput): ObsItem | null {
      if (items.value.length >= ITEMS_LIMIT) return null
      const now = Date.now()
      // 理：写了「为什么成立」即入册，否则只是草稿
      const state: ObserveState =
        input.kind === 'theory' ? (input.why?.trim() ? 'confirmed' : 'draft') : 'confirmed'
      /*
       * 富文本与纯文本的**单向派生**（见 utils/richText.ts）：
       * contentHtml 是正本（清洗过），content 是可读副本。页面通常两份一起传，
       * 但万一哪条入口只给了 HTML，这里兜住：由 HTML 抽出纯文本，绝不留一份空 content。
       */
      const contentHtml = input.contentHtml ? sanitizeHtml(input.contentHtml) : ''
      const content = input.content.trim() || (contentHtml ? htmlToText(contentHtml) : '')
      const item: ObsItem = {
        ...input,
        id: nextId(),
        title: input.title?.trim() || '',
        topics: input.topics ?? [],
        tags: input.tags ?? [],
        summary: input.summary ?? '',
        content,
        contentHtml: contentHtml || undefined,
        golden: (input.golden ?? []).filter((g) => g.trim()),
        /*
         * 凝练句只在「道」上成立，长度在这里兜一次底（页面用 maxlength 拦过一次，
         * 但 store 是唯一闸门，新入口绕不过去）；空串统一存 undefined ——
         * 免得留下"有 daoLine 字段但是空的"这种半状态，取用时还得再判一次。
         */
        daoLine:
          input.kind === 'mother' ? input.daoLine?.trim().slice(0, DAO_LINE_MAX) || undefined : undefined,
        depth: 0,
        state,
        createdAt: now,
      }
      items.value.unshift(item)
      return item
    }

    /**
     * 每日一则「记住」专用：落为待整理的理（pending）。
     * 超过 20 条返回 null —— 队列满了必须去整理，而不是继续堆积。
     */
    function remember(input: { title: string; content: string; tags?: string[]; sourceName?: string }): ObsItem | null {
      if (inboxCount.value >= PENDING_LIMIT) return null
      return add({
        kind: 'theory',
        form: 'quote',
        title: input.title,
        topics: [],
        tags: input.tags ?? ['每日一则'],
        summary: '',
        content: input.content,
        golden: [],
        sourceName: input.sourceName,
        state: 'pending',
      })
    }

    /**
     * 改一条。
     *
     * 归属（事 / 理 / 道）能在编辑页改，而它**不是一个标签**：理要写了「为什么成立」才入册进理库，
     * 改成事就该从理库退出去。所以状态在这里跟着重算一次（原规则只单向「补写即入册」，
     * 于是"一条事改成理"会没写 why 也躺在理库里 —— 2026-09-19 修）：
     *  - 理：有 why → confirmed（入册），没有 → draft（草稿，不进理库）；
     *  - 别的归属：confirmed；
     *  - 待整理（pending，每日一则「记住」的落点）不因一次编辑改状态 —— 那是另一条队列。
     * 编辑页"换归属先提示一句"的那段文案与这里的口径是一对，改一处要一起改。
     */
    function update(id: string, patch: Partial<ObsInput>): void {
      const it = find(id)
      if (!it) return
      const next: Partial<ObsInput> = { ...patch }
      /* 富文本同样要过清洗：编辑页会传进来，但 store 才是唯一闸门（新入口绕不过去） */
      if (typeof next.contentHtml === 'string') next.contentHtml = sanitizeHtml(next.contentHtml) || undefined
      Object.assign(it, next)
      if (it.kind === 'theory') {
        if (it.state !== 'pending') it.state = it.why?.trim() ? 'confirmed' : 'draft'
      } else {
        it.state = 'confirmed'
      }
    }

    function remove(id: string): void {
      items.value = items.value.filter((i) => i.id !== id)
    }

    /* ---------------- 每日信息配额 ---------------- */

    /** 今日配额总数（联动测评建档，见 config/quota.ts 的三条规则） */
    function quotaTotal(): number {
      return dailyQuotaOf(useAssessmentStore().get(useModeStore().id)).total
    }

    /** 配额规则的文字解释（页面说明用） */
    function quotaNote(): string {
      return dailyQuotaOf(useAssessmentStore().get(useModeStore().id)).note
    }

    /**
     * 今日已用的深度阅读次数。
     *
     * 只数「**今天新存入、且今天读完写完**」的 —— 这是新摄入。
     * **存量（前几天存的，今天补处理）不占配额**：那是还债，值得鼓励，
     * 若连还债都要占名额，用户只会把旧账继续拖着，与 §4 的清理机制相悖。
     */
    function quotaUsed(now = Date.now()): number {
      const key = dateKeyOf(now)
      return items.value.filter(
        (i) =>
          /* 导入的文件不占配额（2026-09-17 定案）：一次导入常常是一整篇，不该一口吃掉当天名额 */
          !i.imported &&
          i.handledAt &&
          dateKeyOf(i.createdAt) === key &&
          dateKeyOf(i.handledAt) === key,
      ).length
    }

    function quotaLeft(): number {
      return Math.max(0, quotaTotal() - quotaUsed())
    }

    /**
     * 这条今天还能不能深度处理（= 占掉一次配额）。
     * 存量永远可以处理；今天存进来的，要看配额还有没有余。
     */
    function canDeepRead(id: string): boolean {
      const it = find(id)
      if (!it) return false
      /* 导入的永远可以读（同上：不占配额） */
      if (it.imported) return true
      if (dateKeyOf(it.createdAt) !== dateKeyOf()) return true
      return quotaUsed() < quotaTotal()
    }

    /**
     * 处理一条（读过并写下自己的话）→ 深度 +1，并按归属层入账修为。
     *  - 事：observe.source +5
     *  - 理：已入册 +8；草稿（没写为什么成立）只留痕不入账
     *  - 道：observe.mother +20
     *
     * 配额用尽时**拒绝**（返回 false，不入账也不加深度）：
     * 这是「用完即止」唯一真正生效的地方 —— 只显示数字不拦，等于没有这道闸门。
     * 兜底放在 store 而不是页面，是为了将来任何新入口都绕不过去。
     * 注意：**删除不受影响**，所以「处理或删」的二选一不会变成死锁。
     *
     * @returns 是否真的处理了（false = 已处理过 / 找不到 / 今日配额用尽）
     */
    function markHandled(id: string, note?: string): boolean {
      const it = find(id)
      if (!it || it.handledAt) return false
      if (!canDeepRead(id)) return false
      it.handledAt = Date.now()
      it.depth = (Math.min(2, it.depth + 1) as 0 | 1 | 2)
      if (note?.trim()) it.content = `${it.content}\n${note.trim()}`

      const kind = it.kind === 'thing' ? 'observe.source' : it.kind === 'theory' ? 'observe.theory' : 'observe.mother'
      const scored = it.kind !== 'theory' || it.state === 'confirmed'
      logTrace({
        kind,
        text: it.title || it.content.slice(0, 24),
        ref: it.id,
        level: it.depth,
        value: scored ? undefined : 0,
      })
      return true
    }

    /** 某母题下挂了多少条（理 + 事），用于母题库的「份量」 */
    function childrenOf(motherId: string): ObsItem[] {
      return items.value.filter((i) => i.motherId === motherId && i.kind !== 'mother')
    }

    /** 母题名（条目被删时返回空串，页面不至于崩） */
    function motherName(id?: string): string {
      if (!id) return ''
      return find(id)?.title ?? ''
    }

    /**
     * 把一条内容挂到某个母题下。
     * 挂靠本身**不入账**：它只是整理动作，真正的加工在「处理」时已经付过费了。
     */
    function attachMother(id: string, motherId?: string): void {
      const it = find(id)
      if (!it) return
      if (motherId) it.motherId = motherId
      else delete it.motherId
    }

    /**
     * 认领一个预置母题：生成一条「道」条目。
     * 不入账 —— 别人写好的问题不算你的功夫，挂上第一条自己的内容才算。
     */
    function adoptPreset(input: {
      name: string
      topics: string[]
      content: string
      probe?: string
      /** 认领时顺手凝的那一句（可留空，之后在母题库卡片上补） */
      daoLine?: string
    }): ObsItem | null {
      const item = add({
        kind: 'mother',
        form: 'quote',
        title: input.name,
        topics: input.topics,
        tags: ['母题', '预置'],
        summary: '',
        content: input.content,
        golden: [],
        daoLine: input.daoLine,
      })
      // 预置母题是「待填」，不标记为已处理，让它在收件匣里等着被填上第一笔
      return item
    }

    /**
     * 提炼母题：从一条已入册的理（或反复出现的事）升上去。
     * 入账 observe.mother（+20）—— 这是观这一环最贵的一次加工，值得。
     * 提炼后原条目自动挂到新母题下，母题条目标记已处理（避免同一份功夫付两次）。
     */
    function promoteToMother(id: string, name: string, why: string, daoLine?: string): ObsItem | null {
      const src = find(id)
      const n = name.trim()
      if (!src || !n) return null
      const item = add({
        kind: 'mother',
        form: 'quote',
        title: n,
        topics: [...src.topics],
        tags: ['母题'],
        summary: '',
        content: why.trim() || src.content,
        golden: [],
        /* 详情页「凝练成道」走这条路：一边晋升一边就把那句主张定下来 */
        daoLine,
      })
      if (!item) return null
      src.motherId = item.id
      // 直接标记已处理、不走 markHandled：提炼母题是**输出**不是摄入，不该占当日配额
      item.handledAt = Date.now()
      item.depth = 2
      logTrace({ kind: 'observe.mother', text: n, ref: item.id, level: 2 })
      return item
    }

    /** 存而未处理、且已超过 7 天 → 必须处理或删 */
    function dueForCleanup(): ObsItem[] {
      const deadline = Date.now() - CLEAN_AFTER_MS
      return pending.value.filter((i) => i.createdAt <= deadline)
    }

    /** 按层筛选 */
    function ofKind(kind: ObserveKind): ObsItem[] {
      return items.value.filter((i) => i.kind === kind)
    }

    /** 搜索（标题 / 正文 / 摘要 / 关键信息 / 观点 / 一句话总结 / 金句 / 感悟 / 标签 / 来源） */
    function search(kw: string): ObsItem[] {
      const k = kw.trim().toLowerCase()
      if (!k) return items.value
      return items.value.filter((i) =>
        [
          i.title,
          i.content,
          i.summary,
          i.digest ?? '',
          ...(i.viewpoints ?? []).map((v) => `${v.title} ${v.text}`),
          i.insight ?? '',
          i.sourceName ?? '',
          ...i.topics,
          ...i.tags,
          ...i.golden,
        ]
          .join(' ')
          .toLowerCase()
          .includes(k),
      )
    }

    /** 某来源的口碑素材：这里只提供"存过几次"的计数（质量榜用） */
    function countBySource(): Record<string, number> {
      const map: Record<string, number> = {}
      for (const i of items.value) {
        const name = (i.sourceName ?? '').trim()
        if (!name) continue
        map[name] = (map[name] ?? 0) + 1
      }
      return map
    }

    /**
     * 每日一则的一个动作（认领 / 记住 / 反驳 / 记一笔）。
     * 同一天同一动作只记一次；**当日首次互动**入账 +2 —— 四个动作不是四份奖励，
     * 奖励的是"今天看了这一则"，不是"把按钮点一遍"。
     */
    function markDaily(dateKey: string, action: string): boolean {
      const arr = dailyMarks.value[dateKey] ?? []
      if (arr.includes(action)) return false
      arr.push(action)
      dailyMarks.value[dateKey] = arr
      if (arr.length === 1) {
        logTrace({ kind: 'observe.daily', text: `每日一则 · ${action}`, value: 2 })
      }
      return true
    }

    function dailyActionsOf(dateKey: string): string[] {
      return dailyMarks.value[dateKey] ?? []
    }

    return {
      items,
      dailyMarks,
      markDaily,
      dailyActionsOf,
      list,
      pending,
      pendingCount,
      inboxCount,
      theories,
      mothers,
      add,
      adoptPreset,
      promoteToMother,
      attachMother,
      childrenOf,
      motherName,
      quotaTotal,
      quotaNote,
      quotaUsed,
      quotaLeft,
      canDeepRead,
      remember,
      update,
      remove,
      find,
      markHandled,
      dueForCleanup,
      ofKind,
      search,
      countBySource,
      migrateLegacy,
    }
  },
  {
    persist: { key: 'observe', paths: ['items', 'dailyMarks'] },
  },
)

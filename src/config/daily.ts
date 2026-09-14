/**
 * 每日一则 · 内置 30 条（事 / 理 / 典 各 10 条，按 事→理→典 循环排列 → 自然轮转）。
 *
 * 取用规则（v2 §4.1）：
 *  - 一日一条，**不补不累计**：今天没看，明天就是明天那条；
 *  - index = 距 2026-01-01 的天数 % 总条数，所以同一天在任何设备上都是同一条；
 *  - 可回看最近 7 天（往回推 7 个 index）。
 *
 * 远端覆盖：/content 的 library.daily（后端期能力）。没有下发时用这里的 30 条兜底，
 * 保证离线刚打开也有东西看 —— 「首开即可见」不能依赖网络。
 */
export type DailyKind = '事' | '理' | '典'

export interface DailyItem {
  /** 稳定 id（只增不改） */
  id: string
  kind: DailyKind
  title: string
  /** 正文：一段话说清楚，不求全 */
  text: string
  /** 出处（事=来源，理=提出者/书名，典=典籍） */
  source?: string
  /** 反例 / 不适用的边界 —— 给「反驳」动作一个抓手 */
  counter?: string
  tags?: string[]
}

/** 起始日：index 的天数基准（改这个会让所有人的"今日一则"跳变，别动） */
export const DAILY_EPOCH = '2026-01-01'

export const DAILY_ITEMS: readonly DailyItem[] = [
  // —— 事：看见世界的样子 ——
  {
    id: 'daily-s1',
    kind: '事',
    title: '视线齐平的那一层最赚钱',
    text: '超市把利润最高的商品放在与你视线齐平的位置，儿童 cereal 放在孩子看得见的低层。货架不是随机的，是一张注意力地图。下次进便利店，先看一眼什么被放在了你的正前方——那是别人替你做的选择。',
    source: '零售动线设计',
    counter: '线上货架没有"层"，但"首屏"和"推荐位"在做同一件事。',
    tags: ['注意力', '选择'],
  },
  {
    id: 'daily-s2',
    kind: '事',
    title: '一个红点值多少次解锁',
    text: '未读红点是最便宜的钩子：它不告诉你内容，只告诉你"有东西等你"。多数人平均每天解锁手机上百次，其中相当一部分是被红点拽进去的，而不是自己想打开。',
    source: '通知设计',
    counter: '也有人从红点里获得掌控感，关键在于是不是你主动订阅的。',
    tags: ['注意力', '习惯'],
  },
  {
    id: 'daily-s3',
    kind: '事',
    title: '口香糖为什么在收银台',
    text: '排队结账时，人已经做了一连串决策，意志力见底，此时随手拿一件的概率最高。商家把小件冲动消费品放在"决策最疲惫"的位置，而不是最顺路的位置。',
    source: '决策疲劳',
    counter: '对自己也适用：别在疲惫时做重要决定。',
    tags: ['决策', '消费'],
  },
  {
    id: 'daily-s4',
    kind: '事',
    title: '电梯里的镜子',
    text: '早期写字楼抱怨电梯慢，有人建议在电梯旁装镜子。等待时间没变，投诉却少了：人们忙着看镜子里的自己，没空感觉慢。感知的时间不等于钟表的时间。',
    source: '感知心理学',
    counter: '镜子不能解决真的慢，只能解决"觉得慢"。',
    tags: ['感知', '时间'],
  },
  {
    id: 'daily-s5',
    kind: '事',
    title: '指差确认',
    text: '日本铁路的作业员会指着信号、念出状态再操作。这套动作据说让差错率下降八成。手指和嘴巴把"我以为我看见了"变成"我确实看见了"。',
    source: '日本铁路安全法',
    counter: '对个人来说，出声朗读自己的检查清单有同样效果，但很多人嫌傻。',
    tags: ['方法', '专注'],
  },
  {
    id: 'daily-s6',
    kind: '事',
    title: '有人看着才洗手',
    text: '医院里手卫生依从率常年在四成上下，一旦有可见的监督或反馈屏，能升到九成。人不是不知道正确做法，是"没人看见"时正确做法不产生收益。',
    source: '医院感染控制',
    counter: '自律的极限，就是把看不见的地方也变成看得见。',
    tags: ['习惯', '环境'],
  },
  {
    id: 'daily-s7',
    kind: '事',
    title: '菜单的第一页',
    text: '餐厅菜单的第一页（或右上角）放的是毛利最高的菜。它是锚：后面所有价格都拿它当参照。你以为你在挑选，其实你在被锚定。',
    source: '菜单工程',
    counter: '电子菜单能重排顺序，锚就藏得更深了。',
    tags: ['锚定', '消费'],
  },
  {
    id: 'daily-s8',
    kind: '事',
    title: '免费的一小口',
    text: '试吃、试用、先读一章——免费的一小口会显著提高购买率。不是因为好吃，是因为人心里多了一笔"欠了点什么"的账。',
    source: '互惠原理',
    counter: '知道这个机制，依然很难不被它影响；能做的是别在试吃时做决定。',
    tags: ['互惠', '消费'],
  },
  {
    id: 'daily-s9',
    kind: '事',
    title: '60% 降雨概率是什么意思',
    text: '它常被读成"会下一会儿"，实际含义更接近"在这样的天气条件下，十次里有六次会下雨"。人对概率的直觉很差，所以宁要一个确定的错答案，也不要一个模糊的对答案。',
    source: '概率表达',
    counter: '把概率换成频次表达（十次里六次），理解会好很多。',
    tags: ['概率', '判断'],
  },
  {
    id: 'daily-s10',
    kind: '事',
    title: '最后一天卖得最好',
    text: '截止日期前一天的产出往往等于前面所有天的总和。不是那天变聪明了，是 deadline 终于把"要不要做"这个问题收走了。',
    source: '截止效应',
    counter: '靠 deadline 推进是有代价的：质量、睡眠和自我感觉。',
    tags: ['行动', '拖延'],
  },

  // —— 理：把看见的变成认知 ——
  {
    id: 'daily-l1',
    kind: '理',
    title: '可得性偏差',
    text: '越容易想起来的例子，越容易被认为是常见的。飞机失事记得牢，于是觉得飞比开车危险；其实按里程算正好相反。判断概率时，先问一句：我能想起它，是因为它多，还是因为它响。',
    source: '认知心理学',
    counter: '当某个领域你确实经验丰富时，直觉样本是真样本，此时"能想起"反而是有效信号。',
    tags: ['认知', '判断'],
  },
  {
    id: 'daily-l2',
    kind: '理',
    title: '损失厌恶',
    text: '丢掉一百块的难受，大约要捡到两百块才能抵消。所以人会死守亏损的股票、将就的关系、已经看完一半的烂书——不是因为还有希望，是因为"确定地失去"太疼。',
    source: '前景理论',
    counter: '把"我已经投入的"和"接下来会发生的"分开算，结论常常立刻不同。',
    tags: ['决策', '金钱'],
  },
  {
    id: 'daily-l3',
    kind: '理',
    title: '峰终定律',
    text: '一段经历留在记忆里的样子，主要由最高点和结尾决定，长度几乎不影响。所以"好聚好散"不只是礼貌，它决定了这段关系在你记忆里的样子。',
    source: 'Kahneman',
    counter: '对需要长期枯燥坚持的事（健身、学语言），峰终定律会给出错误的负反馈。',
    tags: ['记忆', '体验'],
  },
  {
    id: 'daily-l4',
    kind: '理',
    title: '蔡格尼克效应',
    text: '没做完的事会一直占着你的注意力，做完的就放下了。所以"写到一半"比"还没开始"更耗神——前者在后台一直跑。',
    source: 'Zeigarnik',
    counter: '反过来用：写作时刻意在句子中间停笔，第二天更容易接上。',
    tags: ['注意力', '行动'],
  },
  {
    id: 'daily-l5',
    kind: '理',
    title: '邓宁-克鲁格效应',
    text: '能力越低的人越容易高估自己，因为他缺少"判断自己差"的能力。真正的分水岭在于：当你开始觉得某件事比想象中复杂，说明你终于入门了。',
    source: 'Dunning-Kruger',
    counter: '它常被误用成"自信的人都很蠢"，其实说的是"缺乏反馈时的自信不可信"。',
    tags: ['认知', '成长'],
  },
  {
    id: 'daily-l6',
    kind: '理',
    title: '复利的沉默期',
    text: '复利曲线前九成的时间几乎是平的，所有可见的增长挤在最后一段。多数人不是算错了，是熬不过那段"什么都没发生"的日子。',
    source: '复利',
    counter: '前提是它真的是复利；很多事只是线性叠加，别拿它自我安慰。',
    tags: ['成长', '时间'],
  },
  {
    id: 'daily-l7',
    kind: '理',
    title: '帕金森定律',
    text: '工作会自动膨胀，填满你给它的所有时间。给一周，它就是一周的活；给两小时，它常常也能在两小时内被做完。',
    source: 'Parkinson',
    counter: '对需要酝酿的创造性工作，压缩时间只会得到粗糙的半成品。',
    tags: ['时间', '方法'],
  },
  {
    id: 'daily-l8',
    kind: '理',
    title: '第二序思维',
    text: '不只问"然后会怎样"，还要问"再然后呢"。第一层大家都想得到，差别在第二层：省下的时间会被什么占掉？解决了这个问题会冒出什么新问题？',
    source: '第二序思维',
    counter: '推演太远会陷入瘫痪，通常两层就够，第三层归于噪音。',
    tags: ['思考', '决策'],
  },
  {
    id: 'daily-l9',
    kind: '理',
    title: '奥卡姆剃刀',
    text: '如无必要，勿增实体。面对两个都能解释现象的假设，先选假设更少的那个——不是因为它更可能是真的，是因为它更容易被检验、也更容易被推翻。',
    source: 'Occam',
    counter: '世界本身有时就是复杂的，"更简单"不等于"更正确"。',
    tags: ['思考', '方法'],
  },
  {
    id: 'daily-l10',
    kind: '理',
    title: '汉隆剃刀',
    text: '能用愚蠢、疏忽、忙碌解释的，就不要归因于恶意。这条剃刀省下的不是判断力，是情绪——它把你从"他针对我"里捞出来。',
    source: 'Hanlon',
    counter: '对反复出现的同类行为，第一次算疏忽，第三次就要当模式处理。',
    tags: ['关系', '情绪'],
  },

  // —— 典：前人把话说过了 ——
  {
    id: 'daily-d1',
    kind: '典',
    title: '知止而后有定',
    text: '知道在哪里停下来，心才能定下来；定下来才静，静了才安，安了才能想清楚，想清楚才有所得。顺序是倒过来的：先有边界，后有专注。',
    source: '《大学》',
    counter: '不知道该止于何处时，先给一个临时的止，比悬着强。',
    tags: ['止', '专注'],
  },
  {
    id: 'daily-d2',
    kind: '典',
    title: '吾生也有涯，而知也无涯',
    text: '用有限的生命去追无限的知识，危险。庄子的警告在信息时代几乎是字面意义上的：不是要少学，是要承认学不完，然后挑。',
    source: '《庄子·养生主》',
    counter: '它常被断章取义地用来劝学，原意恰恰相反，是劝止。',
    tags: ['观', '取舍'],
  },
  {
    id: 'daily-d3',
    kind: '典',
    title: '功不唐捐',
    text: '日拱一卒，功不唐捐。字面意思是：下的功夫不会白费，只是常常不在你期待的地方、以你期待的方式兑现。',
    source: '胡适',
    counter: '功夫也可能白费——如果方向是错的。所以还要定期回头看方向。',
    tags: ['行动', '坚持'],
  },
  {
    id: 'daily-d4',
    kind: '典',
    title: '慎独',
    text: '没人看见的时候，你还是不是同一个人。这是最省力的自我检测：不必问理想，只问独处时你在做什么。',
    source: '《中庸》',
    counter: '慎独不是自我审判，是给自己一个不依赖外界反馈的锚。',
    tags: ['自省', '习惯'],
  },
  {
    id: 'daily-d5',
    kind: '典',
    title: '不积跬步',
    text: '不积跬步，无以至千里；不积小流，无以成江海。被引用到滥，但它的重点在后半句常被删掉的部分：骐骥一跃，不能十步。',
    source: '《荀子·劝学》',
    counter: '也要留意"积"的方向：错误的动作重复一万次，只是把错误练熟。',
    tags: ['坚持', '成长'],
  },
  {
    id: 'daily-d6',
    kind: '典',
    title: '格物致知',
    text: '在事情本身上穷究它的道理，知识才会长出来。不是先读很多书再去做，是在做的过程里把这件事问透。',
    source: '《大学》',
    counter: '光格物不读书，容易把个例当规律；两头都要。',
    tags: ['知', '方法'],
  },
  {
    id: 'daily-d7',
    kind: '典',
    title: '控制二分法',
    text: '有些事取决于你，有些事不取决于你。把力气放在前者，对后者只保留态度。这是斯多葛最实用的一条，也是焦虑的解药。',
    source: '爱比克泰德',
    counter: '难点不在道理，在于"哪些算不取决于我"这条线，本身就随能力移动。',
    tags: ['情绪', '取舍'],
  },
  {
    id: 'daily-d8',
    kind: '典',
    title: '未经省察的人生',
    text: '苏格拉底说它不值得过。省察不是反省错误，是时常问一句：我现在这样过，是我选的吗。',
    source: '苏格拉底',
    counter: '过度省察会让人迟迟不动；省察是为了更好地行动，不是替代行动。',
    tags: ['自省', '行'],
  },
  {
    id: 'daily-d9',
    kind: '典',
    title: '上士闻道',
    text: '上士闻道，勤而行之；中士闻道，若存若亡；下士闻道，大笑之。听到一个好道理，反应越激烈地嘲笑，越说明它戳中了什么。',
    source: '《道德经》',
    counter: '也不是所有被嘲笑的道理都对，有些确实只是错。',
    tags: ['知', '行'],
  },
  {
    id: 'daily-d10',
    kind: '典',
    title: '观自在',
    text: '先能看见自己，才谈得上自在。观，是把注意力放回此时此地，不加评判地看一眼正在发生的念头与身体。',
    source: '《心经》',
    counter: '"不加评判"是最难的部分，做不到也不用苛责，看见自己在评判，就已经是观了。',
    tags: ['观', '止'],
  },
]

/**
 * 内置每日一则的版本号 —— 与题库 / 短语同一套「新鲜度闸门」思路，但**用独立字段**：
 * 远端下发里的 `library.dailyVersion >= 此值` 才采用远端内容。
 *
 * 为什么不用全局 version：全局 version 一提升就会连带放开题库与短语的覆盖
 * （线上 content.json 长期停在 version 2，而本地题库已是 3 —— 一旦提到 3，
 *  旧题库会整体盖回来）。每日一则是**纯展示内容**，出错顶多看到一条旧文案，
 * 没必要和测评口径绑在一条绳上，所以独立计数，运营侧只改 daily 也不会误伤其它。
 * 每次改本地这 30 条，请 +1。
 */
export const LOCAL_DAILY_VERSION = 1

/** 远端下发的每日一则：至少这么多条才肯轮换（太少会一天到晚重复同一条） */
export const MIN_REMOTE_DAILY = 7
/** 单条上限：防止运营位把整本书塞进来 */
const MAX_TEXT_LEN = 600

/**
 * 远端内容清洗：不合格**整体丢弃**（回落到内置 30 条），不做部分采用。
 * 理由同题库：半套内容比旧内容更糟 —— 用户会看到缺字的卡片，且无从判断是 bug 还是内容如此。
 */
export function sanitizeDaily(list: unknown): DailyItem[] | null {
  if (!Array.isArray(list)) return null
  const out: DailyItem[] = []
  for (const [i, raw] of list.entries()) {
    if (!raw || typeof raw !== 'object') return null
    const r = raw as Record<string, unknown>
    const title = typeof r.title === 'string' ? r.title.trim() : ''
    const text = typeof r.text === 'string' ? r.text.trim() : ''
    if (!title || !text) return null
    const kind = r.kind === '事' || r.kind === '理' || r.kind === '典' ? r.kind : '理'
    out.push({
      id: typeof r.id === 'string' && r.id.trim() ? r.id.trim() : `remote-${i}`,
      kind,
      title: title.slice(0, 60),
      text: text.slice(0, MAX_TEXT_LEN),
      source: typeof r.source === 'string' ? r.source.trim().slice(0, 40) : undefined,
      counter: typeof r.counter === 'string' ? r.counter.trim().slice(0, MAX_TEXT_LEN) : undefined,
      tags: Array.isArray(r.tags) ? r.tags.filter((t): t is string => typeof t === 'string').slice(0, 6) : undefined,
    })
  }
  return out.length >= MIN_REMOTE_DAILY ? out : null
}

/** 某日距起始日的天数（可为负，取模前先归正） */
export function daysSinceEpoch(dateKey: string): number {
  const a = Date.parse(`${dateKey}T12:00:00`)
  const b = Date.parse(`${DAILY_EPOCH}T12:00:00`)
  if (Number.isNaN(a) || Number.isNaN(b)) return 0
  return Math.floor((a - b) / 86400000)
}

/** 某日那一则的下标（用条数取模，内容增删自动适配） */
export function dailyIndex(dateKey: string, count = DAILY_ITEMS.length): number {
  const n = count > 0 ? count : DAILY_ITEMS.length
  const d = daysSinceEpoch(dateKey) % n
  return d < 0 ? d + n : d
}

/**
 * 某日的每日一则。
 * 传入 items（远端下发的）时优先用它；为空/越界一律回落到内置，保证首开可见。
 *
 * offset = 「换一个」的次数：同一天内往后挪几条，**不改日期**。
 * 之所以按"挪几条"而不是"随机抽"：随机会让人以为每次打开都不同，
 * 而这东西的意义恰恰是"今天就是这一条"；往后挪一格，转完一圈自然回到原条。
 */
export function dailyOf(dateKey: string, items?: readonly DailyItem[], offset = 0): DailyItem {
  const list = items && items.length ? items : DAILY_ITEMS
  const n = list.length
  if (!n) return DAILY_ITEMS[dailyIndex(dateKey)]
  const base = dailyIndex(dateKey, n)
  const i = (((base + offset) % n) + n) % n
  return list[i] ?? DAILY_ITEMS[dailyIndex(dateKey)]
}

/** 最近 n 天（含今天，往前推）的一则，用于「回看」 */
export function dailyRecent(
  dateKey: string,
  n = 7,
  items?: readonly DailyItem[],
): Array<{ date: string; item: DailyItem }> {
  const out: Array<{ date: string; item: DailyItem }> = []
  const base = Date.parse(`${dateKey}T12:00:00`)
  if (Number.isNaN(base)) return out
  for (let i = 0; i < n; i++) {
    const d = new Date(base - i * 86400000)
    const m = `${d.getMonth() + 1}`.padStart(2, '0')
    const day = `${d.getDate()}`.padStart(2, '0')
    const key = `${d.getFullYear()}-${m}-${day}`
    out.push({ date: key, item: dailyOf(key, items) })
  }
  return out
}

/**
 * 主题化短语（phrases）—— 三模式各自的说法：按钮、空状态、提示。
 *
 * 与 lexicon.ts 的分工：
 *   lexicon —— 大厅状态栏**模板**（带 {占位符}，随数据实时渲染）
 *   phrases —— 固定**短语**（无占位符），如「下一题 / 下一项 / 继续问心」
 *
 * 三套口吻的基调：
 *   normal —— 温润生活感：像手账、像日常
 *   tech   —— 实验室口吻：参数、指标、执行
 *   dao    —— 修真口吻：道统、问心、转修
 *
 * 数据来源：远端 content.json → phrases（可改，不用发版）；本文件是内置兜底。
 * ⚠️ 本文件**不要 import store**（页面/store 都要用它的兜底，引 store 会成环）。
 *    页面通过 usePhrase() 取词，远端优先、内置兜底。
 */
import type { ModeId } from './modes'

/**
 * 全部短语键：**唯一来源**（类型由它派生，避免"联合类型 + 列表"两处维护走样）。
 * 新增键：这里加一行 + LOCAL_PHRASES 加一段 + 远端 JSON 加同键即可覆盖。
 */
export const PHRASE_KEYS = [
  /* 模式切换确认框 */
  'switch.title',
  'switch.note',
  'switch.confirm',
  'switch.cancel',
  'switch.done',
  /* 主要行动按钮 */
  'start.cta',
  'back.cta',
  'retake.cta',
  /* 测评答题 */
  'assess.next',
  'assess.prev',
  'assess.skip',
  /* 空状态：各子页标题 + 说明 */
  'empty.habits.title',
  'empty.habits.desc',
  'empty.growth.title',
  'empty.growth.desc',
  'empty.stats.title',
  'empty.stats.desc',
  'empty.readlater.title',
  'empty.readlater.desc',
  'empty.timeline.title',
  'empty.timeline.desc',
  'empty.bond.title',
  'empty.bond.desc',
  'empty.reflect.title',
  'empty.reflect.desc',
  /* 设置页 · 数据区行说明（行标题保持功能清晰，不做主题化） */
  'settings.exportToday.sub',
  'settings.exportAll.sub',
  'settings.exportArchive.sub',
  'settings.importFile.sub',
  'settings.resetToday.sub',
  'settings.resetAll.sub',
  /* 轻提示 */
  'toast.copied',
  'toast.resetDone',
  'toast.restored',
  /* 徽章点亮的那一刻（2026-09-22）：接在徽章名后面，如「持恒 · 点亮了 · 去成就墙看看」 */
  'badge.lit',
  'badge.litHint',
  /* 测评：耗时说明 */
  'assess.cost',
  /* 测评：跳过建档的确认弹窗（讲清「不测也能用 + 缺什么 + 随时可补」） */
  'assess.skipTitle',
  /* 第一题下方的显眼出口（比右上角小字更容易被看到） */
  'assess.skipBottom',
  'assess.skipNote',
  'assess.skipConfirm',
  'assess.skipCancel',
  'assess.skipDone',
  /* 测评结果：维度分布 / 作答质量 / 与上次对比 */
  'assess.dimTitle',
  'assess.qualityStraight',
  'assess.qualityInconsistent',
  /* 作答过快（平均每题不足 1.2 秒，判定见 config/assessment.ts 的 isHasty） */
  'assess.qualityHasty',
  'assess.trend',
  'assess.trendFirst',
  /* 结果可信度（由完整性/变异度/一致性/作答节奏合成，见 signals） */
  'assess.confLabel',
  'assess.confHigh',
  'assess.confMid',
  'assess.confLow',
  /* 结果页的「下一步」：只看最弱的那一维，一次只给一条 */
  'assess.nextStep',
  'advice.observe',
  'advice.pause',
  'advice.reflect',
  'advice.action',
  /* 起点基线（我页等级卡下方那行） */
  'baseline.title',
  'baseline.missing',
  'baseline.cta',
  /* 未建档提醒条（观大厅 / 我页） */
  'prompt.title',
  'prompt.note',
  'prompt.cta',
  'prompt.later',

  /* 四维（观/止/知/行）的职能名：符号「观止知行」固定，职能词随模式变 */
  'dim.observe',
  'dim.pause',
  'dim.reflect',
  'dim.action',
] as const

export type PhraseKey = (typeof PHRASE_KEYS)[number]

type PhraseTable = Record<PhraseKey, Record<ModeId, string>>

/**
 * 内置短语版本号 —— 与 config/assessment.ts 的 LOCAL_ASSESS_VERSION 同理：
 * 远端 content.json 的 version 低于它，说明服务器上的文案比代码还旧
 * （例如线上仍写着「6 题 · 约 1 分钟」，而本地已改为 8 题），此时整体忽略远端 phrases。
 * 运营侧更新文案后把 version 提到 ≥ 此值即可重新生效。每次改本地短语，请 +1。
 */
export const LOCAL_PHRASE_VERSION = 4

const LOCAL_PHRASES: PhraseTable = {
  /* ---------- 模式切换确认框 ---------- */
  'switch.title': {
    normal: '换一种生活节奏？',
    tech: '切换运行模式？',
    dao: '转修此道？',
  },
  'switch.note': {
    normal:
      '换过去之后，配色、栏目标题和说话的语气都会换成另一种说法，像给同一本手账换了一套纸和笔。修行记录不会动，随时可以换回来。',
    tech:
      '切换后配色、指标命名与描述文案会整套替换为科技语言，相当于换一套参数模板。数据不重算、不清空，可随时切回。',
    dao:
      '转修之后，门中配色、称谓与名目皆随新道统更易。修为道行仍是同一份，不受影响，日后亦可随时转回。',
  },
  'switch.confirm': {
    normal: '就这样换',
    tech: '执行切换',
    dao: '就此转修',
  },
  'switch.cancel': {
    normal: '先不换',
    tech: '取消',
    dao: '暂且不转',
  },
  'switch.done': {
    normal: '已换成「普通」的说法',
    tech: '运行模式已切换为「科技」',
    dao: '已归入「修仙」一脉',
  },

  /* ---------- 主要行动按钮 ---------- */
  'start.cta': {
    normal: '就从今天开始',
    tech: '初始化并开始',
    dao: '择日不如就今日',
  },
  'back.cta': {
    normal: '回到日常',
    tech: '返回控制台',
    dao: '返回洞府',
  },
  'retake.cta': {
    normal: '再测一次看看变化',
    tech: '重新采样一次',
    dao: '再测一次灵根',
  },

  /* ---------- 测评答题 ---------- */
  'assess.next': {
    normal: '下一题',
    tech: '下一项',
    dao: '继续问心',
  },
  'assess.prev': {
    normal: '上一题',
    tech: '上一项',
    dao: '回上一问',
  },
  'assess.skip': {
    normal: '跳过',
    tech: '略过',
    dao: '不测也罢',
  },

  /* ---------- 空状态：习惯 ---------- */
  'empty.habits.title': {
    normal: '还没有习惯',
    tech: '暂无追踪项',
    dao: '尚未立课',
  },
  'empty.habits.desc': {
    normal: '习惯别贪多。先守住一两个，\n等它长成身体的一部分，再加新的。',
    tech: '先建立 1~2 个可量化追踪项，\n样本不足时，数据没有意义。',
    dao: '课业不在多。先立一两门日课，\n等它入骨，再添新功。',
  },

  /* ---------- 空状态：成长曲线 ---------- */
  'empty.growth.title': {
    normal: '还没有数据',
    tech: '数据不足',
    dao: '道行未显',
  },
  'empty.growth.desc': {
    normal: '先答几次灵魂拷问、存几张卡片。\n每周沉淀会在这里长成一条向上的曲线。',
    tech: '先产生若干条记录，\n样本足够后才会生成趋势曲线。',
    dao: '先答几问、存几悟，\n周线自会浮出水面。',
  },

  /* ---------- 空状态：专注统计 ---------- */
  'empty.stats.title': {
    normal: '尚无专注记录',
    tech: '暂无采样数据',
    dao: '定力未录',
  },
  'empty.stats.desc': {
    normal: '走完一段沙漏，这里就会长出第一根柱子。',
    tech: '完成一次专注计时，就会产生第一个数据点。',
    dao: '走完一段沙漏，此处自生一柱。',
  },

  /* ---------- 空状态：收纳（稍后读） ---------- */
  'empty.readlater.title': {
    normal: '此刻空空如也',
    tech: '缓冲区为空',
    dao: '此处空空',
  },
  'empty.readlater.desc': {
    normal: '读到舍不得放下的，先存一句在这。\n一句话留 24 小时、文章与视频留 7 天，读不掉的会被时间带走。',
    tech: '遇到值得深入的内容先存入缓冲区，\n一句话 24 小时内、文章与视频 7 天内处理，超时自动清除。',
    dao: '见到好句，先收入囊中。\n一句留一昼夜，文章与影像留七日，否则随缘散去。',
  },

  /* ---------- 空状态：痕迹时间轴 ---------- */
  'empty.timeline.title': {
    normal: '还没有痕迹',
    tech: '暂无事件流',
    dao: '未有痕迹',
  },
  'empty.timeline.desc': {
    normal: '去行厅完成一件三件事，或打一次卡 —— 从第一笔开始。\n观止知行只记录真实发生过的事。',
    tech: '完成一次三件事或打卡，事件会被写入时间轴。\n本应用只记录真实发生的行为。',
    dao: '去行厅成事一件，或行一次课 —— 自第一笔起。\n本门只录真实发生之事。',
  },

  /* ---------- 空状态：结伴对话 ---------- */
  'empty.bond.title': {
    normal: '还没有对话',
    tech: '暂无会话记录',
    dao: '尚无对谈',
  },
  'empty.bond.desc': {
    normal: '去大厅走一走、等一次早晚问候，与小枢的每一次见面都会记在这里。',
    tech: '进入任一大厅或等待定时问候，交互会被记录在此。',
    dao: '去厅中走动，或候一次晨昏问安，与道友的每次相会皆录于此。',
  },

  /* ---------- 空状态：所悟（知识卡片） ---------- */
  'empty.reflect.title': {
    normal: '还没有所悟',
    tech: '暂无条目',
    dao: '尚未有悟',
  },
  'empty.reflect.desc': {
    normal:
      '从今天的灵魂拷问写起，或在观里种的概念收成后导入。\n每一条都会按「转述 → 重构 → 内化」标注深度。',
    tech: '从今日拷问开始，或导入观厅收成的概念。\n每条都会标注加工深度。',
    dao: '自今日拷问起笔，或收观中所得之果。\n每条皆按「转述 → 重构 → 内化」标注深浅。',
  },

  /* ---------- 设置页 · 数据区行说明 ---------- */
  'settings.exportToday.sub': {
    normal: '复制一份今日修行摘要到剪贴板',
    tech: '把今日指标摘要写入剪贴板',
    dao: '将今日修行摘录抄入剪贴板',
  },
  'settings.exportAll.sub': {
    normal: '生成备份文件并转发到聊天保存 · 全程在本机，不上传服务器',
    tech: '导出完整数据文件并转发到聊天 · 全部在本机完成，不经服务器',
    dao: '结成一份备份文卷转发保存 · 全程不出本机，不假外求',
  },
  'settings.exportArchive.sub': {
    normal: '把四环沉淀压成一份能读的文字（Markdown），可转发或复制 · 全程在本机',
    tech: '导出可读版修行档案（Markdown）· 全部在本机完成，不经服务器',
    dao: '将四环所修誊作一卷可读之文，可传可抄 · 全程不出本机',
  },
  'settings.importFile.sub': {
    normal: '从聊天记录选择备份文件 · 会覆盖本机现有数据，需二次确认',
    tech: '从聊天记录导入备份文件 · 将覆盖本机数据，需二次确认',
    dao: '自聊天记录取回备份文卷 · 将覆盖本机所有，需二次确认',
  },
  'settings.resetToday.sub': {
    normal: '清空今日待办与完成状态，需二次确认',
    tech: '重置今日待办与完成标记，需二次确认',
    dao: '抹去今日待办与已了之事，需二次确认',
  },
  'settings.resetAll.sub': {
    normal: '清空修为/等级/徽章/知识卡/习惯/痕迹等所有修行记录 · 保留语言与提醒偏好',
    tech: '清空修为/等级/徽章/卡片/习惯/痕迹等全部记录 · 保留语言与提醒设置',
    dao: '清空修为、境界、徽记、卡片、课业、痕迹等一切记录 · 保留语言与提醒',
  },

  /* ---------- 轻提示 ---------- */
  'toast.copied': {
    normal: '今日概览已复制',
    tech: '摘要已写入剪贴板',
    dao: '摘录已抄入剪贴板',
  },
  'toast.resetDone': {
    normal: '修行数据已清空',
    tech: '数据已重置',
    dao: '前尘修为已散尽',
  },
  'toast.restored': {
    normal: '数据已恢复',
    tech: '恢复完成',
    dao: '旧日修行已归位',
  },
  /*
   * 徽章点亮（2026-09-22）。
   * 拼法是「徽章名 · badge.lit · badge.litHint」，例如「持恒 · 点亮了 · 去成就墙看看」；
   * 多枚一起点亮时用枚数代替徽章名（「3 枚 · 点亮了 · 去成就墙看看」）。
   * 分三段是为了让同一种修行语言配上自己的动宾搭配，而不是把整句话焊死成一句固定文案。
   */
  'badge.lit': {
    normal: '点亮了',
    tech: '解锁完成',
    dao: '得了一记',
  },
  'badge.litHint': {
    normal: '去成就墙看看',
    tech: '去成就墙查看',
    dao: '功勋碑上添了一笔',
  },

  /* ---------- 测评：耗时说明（降低"一进来就要答题"的心理负担） ---------- */
  'assess.cost': {
    normal: '约 90 秒',
    tech: '约 90 秒',
    dao: '一盏茶功夫',
  },

  /* ---------- 测评：跳过建档的确认弹窗 ---------- */
  'assess.skipTitle': {
    normal: '先不建档，也可以',
    tech: '暂不建立画像',
    dao: '暂不测灵根',
  },
  'assess.skipBottom': {
    normal: '先跳过，回头在「我」里补',
    tech: '稍后补测，先进控制台',
    dao: '暂且略过，日后再测',
  },
  'assess.skipNote': {
    normal:
      '不建档也能照常用，记录一条都不会少。\n缺的是三样：① 起点称号与分数 ② 我页的「起点基线」 ③ 「立约」徽章。\n随时去「我」里补，1 分钟。',
    tech: '不建档不影响任何功能与记录。\n缺三项：① 分档结果与画像称号 ② 我页「基线参数」 ③ 「立约」徽章。\n可随时在「我」中补齐，约 60 秒。',
    dao: '不测灵根，四厅照常行走，记录一笔不少。\n所缺者三：① 灵根称号与根骨分 ② 洞府「入门根骨」 ③ 「立约」徽记。\n随时可回洞府补测，一盏茶功夫。',
  },
  'assess.skipConfirm': {
    normal: '先跳过，回头补',
    tech: '跳过，稍后补测',
    dao: '暂且略过',
  },
  'assess.skipCancel': {
    normal: '继续答题',
    tech: '继续填写',
    dao: '继续问心',
  },
  'assess.skipDone': {
    normal: '已跳过 · 随时可在「我」里补建档',
    tech: '已跳过 · 可在「我」中随时补测',
    dao: '已略过 · 随时可回洞府补测',
  },

  /* ---------- 测评结果：维度 / 质量 / 对比 ---------- */
  'assess.dimTitle': {
    normal: '四个维度',
    tech: '指标分布',
    dao: '四道功课',
  },
  'assess.qualityStraight': {
    normal:
      '这次每道题选的位置都一样，可能答得有点快。分数先按这个算，30 天后可以再测一次看变化。',
    tech:
      '本次所有题目作答位置一致，数据可信度偏低。结果照常保留，建议 30 天后重新采样。',
    dao: '此番每题所选位置如一，恐是随手点过。分数暂且记下，三十日后可再测。',
  },
  'assess.qualityInconsistent': {
    normal:
      '同一类问题上，你的回答前后有点相反（比如一处说「几乎不」，另一处说「总是」）。不一定是错的，只是这次结论会不太稳 —— 30 天后重测一次会更准。',
    tech:
      '同维度题目出现相互矛盾的取值，本次结论置信度偏低。结果照常保留，建议 30 天后重新采样。',
    dao: '同一道行上前言不搭后语，此番结论未必稳妥。三十日后重测，方见真章。',
  },
  'assess.trend': {
    normal: '较上次',
    tech: '环比上次',
    dao: '较前番',
  },
  'assess.trendFirst': {
    normal: '这是第一次建档。往后每 30 天可重测一次，这里会显示变化。',
    tech: '首次采样完成。30 天后可再次采样，此处将显示环比变化。',
    dao: '初次立档。此后每三十日可测一次，此处自会显出进退。',
  },
  /* 作答过快：不判废、不改分，只说明「为什么这次结论要打个折」 */
  'assess.qualityHasty': {
    normal:
      '这次答得比读题还快，有几题可能没看清就选了。分数照算不清零，30 天后重测一次会更准。',
    tech:
      '平均每题作答不足 1.2 秒，低于有效阅读所需时间。数据照常保留，建议 30 天后重新采样。',
    dao: '此番应答甚疾，恐未及细读。录之以为参考，三十日后再测方准。',
  },
  /* 结果可信度：告诉用户「这份结论能多当真」——比只给一个数字诚实得多 */
  'assess.confLabel': {
    normal: '结果可信度',
    tech: '数据置信度',
    dao: '此测可信几分',
  },
  'assess.confHigh': {
    normal: '前后作答自洽，也没有漏题。这份结果可以当真。',
    tech: '各维度自洽、作答完整，本次采样可作为后续对比的基准。',
    dao: '前后应答如一，条目无缺。此番测定，可作凭据。',
  },
  'assess.confMid': {
    normal: '大体可用，有几处答得偏快或不太一致。看趋势就好，别拿它当精确值。',
    tech: '存在轻微不自洽或遗漏，结论可作趋势参考，不宜当作精确指标。',
    dao: '大体可信，然有数处前后参差。观其大略则可，勿据此细较。',
  },
  'assess.confLow': {
    normal: '这次作答明显偏快或前后矛盾，只当个大概印象。30 天后再测一次会准很多。',
    tech: '本次采样存在作答惯性、过快或自相矛盾，数据不足以支撑结论，建议 30 天后重采样。',
    dao: '此番应答或过急促，或前后相悖，难以为凭。待三十日后重测方准。',
  },
  /* 下一步：只给最弱的一维，一次一条。给四条等于没给 */
  'assess.nextStep': {
    normal: '接下来，先练这一项',
    tech: '优先优化的指标',
    dao: '此后当先修此道',
  },
  'advice.observe': {
    normal:
      '拿手机之前先停一秒。下一步不是少用，是先看清自己因什么拿起来——在「观」里记一条触发原因就够了。',
    tech: '点亮屏幕前先记录触发源（内部情绪 / 外部通知 / 无目的），一周后看占比，就能定位真正的干扰源。',
    dao: '念起之时先观其来处。于「观」中记下此念因何而起，日久自能辨其根由。',
  },
  'advice.pause': {
    normal:
      '从每天一段 15 分钟的沙漏开始，这段时间手机不在手边。能坐住的天数比一次坐多久更要紧。',
    tech: '先做连续 45 分钟的单任务窗口：通知全关、一次只开一个应用。用专注计时验证它是否真的没被打断。',
    dao: '每日行一炷香入定之功，收起外物。初时心猿意马不足虑，坐得住的日子比坐得久更要紧。',
  },
  'advice.reflect': {
    normal: '每天写一句就好，不必长——记下「今天哪件事值得记住」，一周后回头看。',
    tech: '读完立刻记一句要点（十个字也行），把「读过就忘」转成可检索的沉淀。',
    dao: '每夜记一句当日功过。不必洋洋万言，日积月累自有可观。',
  },
  'advice.action': {
    normal: '挑一件「本周就该做」的事，拆到今天能动的最小一步，今天就做完它。',
    tech: '把本周目标拆成当天可完成的原子任务（≤25 分钟），每日完成率比总进度更能预测成败。',
    dao: '取一件当下该为之事，分作今日可行的一小步。先行为上，勿待机缘。',
  },

  /* ---------- 起点基线（我页等级卡下方） ---------- */
  'baseline.title': {
    normal: '起点基线',
    tech: '基线参数',
    dao: '入门根骨',
  },
  'baseline.missing': {
    normal: '未建立 · 建档后展示你的起点与变化',
    tech: '未采样 · 建档后此处显示基线值与环比',
    dao: '未立 · 建档后此处显示根骨与进退',
  },
  'baseline.cta': {
    normal: '去建档',
    tech: '去采样',
    dao: '去测灵根',
  },

  /* ---------- 未建档提醒条 ---------- */
  'prompt.title': {
    normal: '还差一次建档',
    tech: '基线未建立',
    dao: '尚未立档',
  },
  'prompt.note': {
    normal:
      '8 题 · 约 90 秒。建档后我页会显示你的起点基线与称号；不建档也照常用。',
    tech: '8 项 · 约 90 秒。建立后可看到基线参数与分档；不建档不影响使用。',
    dao: '八问 · 一盏茶功夫。立档后洞府中便有根骨与称号可看；不测亦无妨。',
  },
  'prompt.cta': {
    normal: '现在补上',
    tech: '立即建档',
    dao: '此刻补测',
  },
  'prompt.later': {
    normal: '三天后再提醒',
    tech: '稍后提醒',
    dao: '过几日再说',
  },

  /* ---------- 四维职能名（大厅符号「观止知行」固定，只有职能词换说法） ---------- */
  'dim.observe': {
    normal: '辨源',
    tech: '摄入',
    dao: '鉴源',
  },
  'dim.pause': {
    normal: '静修',
    tech: '专注',
    dao: '定力',
  },
  'dim.reflect': {
    normal: '产出',
    tech: '沉淀',
    dao: '悟道',
  },
  'dim.action': {
    normal: '完成',
    tech: '执行',
    dao: '功德',
  },
}

/** 内置兜底取词（远端没有配置该键/该模式时使用）；键不存在则返回空串 */
export function localPhrase(key: PhraseKey, mode: ModeId): string {
  return LOCAL_PHRASES[key]?.[mode] ?? ''
}

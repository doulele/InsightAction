/**
 * 三十条预置理（规格 §11 · 观：理，6 领域 × 5 条）。
 *
 * 为什么必须有这批内容：§7.2 空状态原则 —— 理库不能依赖用户输入才能站住，
 * 新用户第一屏看到的不能是空白。它是「第一天体验的保证」。
 *
 * 三条硬规则：
 *  1. **每条必须自带「为什么成立」**（规格原文）—— 摘抄不算理；
 *  2. id 遵守 §11.1：形如 theory-xxx，**只许追加、不许插入或重排**（改内容安全，改顺序会让引用错位）；
 *  3. 收下不入账：预置理是「别人认定过的」，用户自己的加工（处理/应用）才付修为。
 *
 * 为什么放前端而不是走 /content 下发：这批是**结构化推荐**（要接 §7.1 的测评映射、
 * 要参与领域筛选），不是运营文案；后运营位下发的是每日一则那类纯展示内容。
 */
import type { ObserveTopic } from '@/stores/observe'
import { OBSERVE_TOPICS } from '@/stores/observe'

export interface PresetTheory {
  /** 稳定 id（只追加，不重排） */
  id: string
  topic: ObserveTopic
  /** 一句短断言（不是书名，是可以被认同或反驳的那句话） */
  title: string
  /** 本体：它在什么条件下成立 */
  content: string
  /** 为什么成立（规格硬要求） */
  why: string
}

export const PRESET_THEORIES: readonly PresetTheory[] = [
  /* ---------------- 心智（5） ---------------- */
  {
    id: 'theory-attention-first',
    topic: '心智',
    title: '注意力先于时间',
    content: '你缺的从来不是时间，是没被打断的整块注意力。日程排得再满，注意力碎了就什么都推进不了。',
    why: '切换任务后回到原任务，平均要十几分钟才能重新进入状态；被打断省下的那几分钟，实际变成了低质量的碎片时间。',
  },
  {
    id: 'theory-emotion-is-signal',
    topic: '心智',
    title: '情绪是信号，不是指令',
    content: '愤怒在说「边界被踩了」，焦虑在说「有件事还模糊着」。听见它，但不必照它执行。',
    why: '情绪是大脑对环境的快速评估：快于理性，但精度低。把它当信息源而非行动命令，既利用它的快，又兜住它的错。',
  },
  {
    id: 'theory-writing-shrinks-fear',
    topic: '心智',
    title: '写下来的事会小一半',
    content: '在脑子里转的担忧是弥散的；落在纸上，它就有了边界和形状，也就能被处理。',
    why: '未完成的事会持续占用工作记忆（蔡格尼克效应）。写下来的那一刻，它从「悬着的事」变成「清单上的一项」，大脑才肯松手。',
  },
  {
    id: 'theory-environment-beats-will',
    topic: '心智',
    title: '环境赢过意志力',
    content: '想少刷手机，最有效的不是忍，是把手机放到另一个房间。意志力是消耗品，环境是常量。',
    why: '抵抗诱惑本身消耗认知资源，且随疲劳衰减；改变环境一次到位、不随状态波动。靠忍的人，输给做环境设计的人。',
  },
  {
    id: 'theory-recall-not-understanding',
    topic: '心智',
    title: '能背出来，不等于懂了',
    content: '顺滑地复述只说明「熟悉」；换个情境还能用它，才是「理解」。',
    why: '流畅感来自再认（见过），不是提取（能用）。实战考的是迁移，而迁移恰恰是复述练不出来的那部分。',
  },

  /* ---------------- 方法（5） ---------------- */
  {
    id: 'theory-done-over-perfect',
    topic: '方法',
    title: '先完成，再完美',
    content: '完成的东西可以改；没完成的东西，连被改的资格都没有。',
    why: '反馈只发生在「做完」之后。完美主义拖住的每一版都是零信息量，而第一版糙品已经能换来真实反馈。',
  },
  {
    id: 'theory-one-change-at-a-time',
    topic: '方法',
    title: '一次只改一件事',
    content: '同时改三件事，通常一件也改不成；改成了，也不知道是哪件起了作用。',
    why: '单变量才可归因；而意志力与注意力有带宽，三条新习惯在互相抢同一份预算。',
  },
  {
    id: 'theory-compound-needs-continuity',
    topic: '方法',
    title: '复利靠不中断，不靠强度',
    content: '每天二十分钟坚持一年，胜过每个周末狂练五小时。中断清零的代价被严重低估。',
    why: '积累曲线是乘法不是加法：强度决定单次增量，连续性决定乘数——而乘数才是指数项。',
  },
  {
    id: 'theory-output-is-input',
    topic: '方法',
    title: '输出才是最好的输入',
    content: '读十篇不如写一篇。写不出来的地方，就是还没读懂的地方。',
    why: '阅读是再认（看着眼熟），写作是提取与重组（从空页开始搭结构）；后者逼你暴露理解的断层，而那正是学习发生的位置。',
  },
  {
    id: 'theory-smallest-step',
    topic: '方法',
    title: '把第一步缩到不可能失败',
    content: '「每天跑步」太难，「换上跑鞋」不难。先让开始变得廉价，坚持才有得谈。',
    why: '启动阻力是行动最大的敌人。一旦启动，继续的心理成本远低于从头开始；骗过「启动」这一关，就赢了大半。',
  },

  /* ---------------- 关系（5） ---------------- */
  {
    id: 'theory-unspoken-expectations',
    topic: '关系',
    title: '没说出口的期待，会变成怨气',
    content: '你以为的「应该懂」，在对方那里从未被登记过。期待不说出口，就只有你一个人在守约。',
    why: '猜测他人心理的准确率远低于我们的自信。把期待说出口，把它从「默契幻觉」变成「可协商的约定」——哪怕被拒绝，也好过单方面记账。',
  },
  {
    id: 'theory-boundary-before-kindness',
    topic: '关系',
    title: '边界先于善良',
    content: '没有边界的善良会被当成义务。先说清「我做到哪、不做到哪」，善意才保得住价值。',
    why: '无条件供给的东西会被定价为零（边际效用递减）。边界制造稀缺，稀缺才让善意被当作善意，而不是空气。',
  },
  {
    id: 'theory-listen-before-rebut',
    topic: '关系',
    title: '听完，再反驳',
    content: '多数争执里，双方反驳的是自己脑补的对方，而不是对方刚说完的话。',
    why: '对方说话时，人大多在组织自己下一句反驳而非倾听。先完整听完并复述确认，至少保证你们在打同一场架。',
  },
  {
    id: 'theory-relationship-ledger',
    topic: '关系',
    title: '关系是一本账，冲突是取款',
    content: '平日的倾听与帮衬是存款，争吵与失信是取款。只取不存，多深的情分也会见底。',
    why: '负面互动的心理重量约是正面互动的五倍。修复一次关系需要的正面对冲，远多于制造裂痕的那一次负面。',
  },
  {
    id: 'theory-change-interaction-not-person',
    topic: '关系',
    title: '你改不了人，只能改互动方式',
    content: '对方的一面，只在与你的关系里呈现。你换一种回应，这段舞就换了一种跳法。',
    why: '行为在互动中互相塑造（强化回路）。你无法操作另一个人的内在，但你是回路的另一半：改自己这一半，对方的反应函数就换了输入。',
  },

  /* ---------------- 金钱（5） ---------------- */
  {
    id: 'theory-pay-yourself-first',
    topic: '金钱',
    title: '先支付自己',
    content: '到手的钱，先划走要存的那份，剩下的才是能花的。反过来存钱，永远存不下来。',
    why: '花销会自动膨胀到与收入持平。先扣后存靠的是机制，先花后存靠的是自制力——长期看，机制必胜。',
  },
  {
    id: 'theory-total-cost-of-ownership',
    topic: '金钱',
    title: '标价之外都是首付',
    content: '一件东西的成本是「买它 + 养它 + 处置它」，标价只是第一期。',
    why: '持有成本（维护、收纳、升级、注意力）常年在标价之上。只看标价做决定，等于用首付判断总价。',
  },
  {
    id: 'theory-hourly-price',
    topic: '金钱',
    title: '用时薪换算，不用折扣换算',
    content: '「打三折」不构成买的理由；「这等于我两天的工作」才是。',
    why: '折扣锚定的是虚高的原价，时薪锚定的是你真实的生命成本。换算成时间后仍觉得值，才是真值。',
  },
  {
    id: 'theory-delay-not-deny',
    topic: '金钱',
    title: '延迟满足不是不满足',
    content: '它只是把「现在就要」换成「到点再要」。你保住了选择权，还拿到了等待的利息。',
    why: '冲动消费的快感来自即时性本身而非物品。延迟二十四小时后，多数购买欲会自然衰减——省下的不是钱，是「为已衰减的欲望买单」的那部分。',
  },
  {
    id: 'theory-debt-taxes-future',
    topic: '金钱',
    title: '负债是对未来的自己征税',
    content: '每一笔消费债，都是让明天的你替今天的你打工。',
    why: '利息按时间复利滚动，花的是你未来的自由度。用未来的收入贴现今天的快感，收入真到账时已名花有主。',
  },

  /* ---------------- 身体（5） ---------------- */
  {
    id: 'theory-sleep-is-interest',
    topic: '身体',
    title: '睡眠是利息，不是成本',
    content: '睡够不是浪费时间，是把白天的损耗结算清楚。省下的睡眠，身体会连本带利收回去。',
    why: '记忆巩固、代谢清理、情绪复位都发生在睡眠中。用睡眠换来的清醒是低质量的：账面多两小时，实际亏一整天。',
  },
  {
    id: 'theory-hunger-is-hormone',
    topic: '身体',
    title: '饿，不一定是胃的事',
    content: '半夜的饿、无聊的饿、压力的饿，多数是情绪在借道肠胃说话。',
    why: '情绪应激与饥饿共用同一套神经通路（都指向「填补感」）。等十分钟或喝口水再判断，饿意常常自己就退了。',
  },
  {
    id: 'theory-motion-precedes-mood',
    topic: '身体',
    title: '先动起来，情绪会跟上',
    content: '不是等有精神了才运动，是运动了才有精神。动作在前，状态在后。',
    why: '情绪部分服从身体信号：心率、呼吸先变化，大脑随后把它解释成「有干劲」。直接调控情绪很难，调控身体简单得多。',
  },
  {
    id: 'theory-screen-before-sleep',
    topic: '身体',
    title: '睡前一小时，屏幕是贼',
    content: '刷手机「助眠」是个反讽：它偷走的不只是时间，还有入睡的能力本身。',
    why: '亮屏抑制褪黑素分泌，内容的新奇感维持唤醒水平。你以为的「再看五分钟」，在生理上是一次次重置入睡倒计时。',
  },
  {
    id: 'theory-pain-is-negotiation',
    topic: '身体',
    title: '疼是谈判，不是宣判',
    content: '慢性疼痛多数不是「坏了要换」，是「超了要谈」——姿势、负荷、恢复，三者总有一个越界了。',
    why: '持续性疼痛很大程度是神经系统的过度预警（敏化），警告不等于损伤。把它当信号去排查诱因，好过把它当判决躺平。',
  },

  /* ---------------- 时间（5） ---------------- */
  {
    id: 'theory-rocks-before-sand',
    topic: '时间',
    title: '先放石头，再放沙',
    content: '日程先塞进最重要的一两件事，剩下的时间让杂事自己找缝。顺序反了，沙会填满整个瓶子。',
    why: '琐事数量没有上限，且自带「看起来紧急」的属性，会自动占满所有可用时间。要事不预约位置，就永远排在「忙完之后」——那个时刻不会到来。',
  },
  {
    id: 'theory-procrastination-is-emotion',
    topic: '时间',
    title: '拖延是情绪问题',
    content: '你拖的不是事，是这件事带来的那种感觉。治拖延，先治「想到它就不舒服」。',
    why: '拖延是对负面情绪的短期回避：任务引发烦躁 → 逃去刷手机，回报即时。把任务切小、降低启动的不适感，比骂自己「没自制力」有效得多。',
  },
  {
    id: 'theory-no-is-cheap-time',
    topic: '时间',
    title: '说「不」是最便宜的时间购买',
    content: '每一次答应，都是在替别人的优先级打工。拒绝不需要技巧，只需要提前想清楚自己要什么。',
    why: '时间只能记在一处账上：答应了这件事，同一时段别的就没了。而「都答应」的隐性成本（质量稀释、自我耗竭）在你看见它之前就已在扣款。',
  },
  {
    id: 'theory-define-done',
    topic: '时间',
    title: '完成的定义，要提前写下',
    content: '「差不多了」是拖延的最后形态。开始前写下「做成什么样算完」，结束时就无处可拖。',
    why: '目标模糊给了「再完善一下」无限的活动空间。明确的终点线把判断从「感觉」换成「对照」——既是止损，也是止损之后的休息权。',
  },
  {
    id: 'theory-busy-is-not-output',
    topic: '时间',
    title: '忙，不等于产出',
    content: '回消息、开会、整理桌面都产生「在做事」的体感，但只有那件你一直没开始的事，才产生结果。',
    why: '大脑对「付出」和「产出」的记账是混在一起的（都用忙碌感结算）。分开看会发现：日程表的密度和成果的密度，常常毫无关系。',
  },
]

/* ---------------- §7.1 测评 → 首周推荐映射 ---------------- */

/** 最弱维度 → 优先领域（观察失控先补「辨」；冲动失控先回到身体） */
const DIM_PRIMARY: Record<string, ObserveTopic> = {
  observe: '心智',
  pause: '身体',
  reflect: '方法',
  action: '时间',
}

/** 最弱维度 → 次推领域 */
const DIM_SECONDARY: Record<string, ObserveTopic> = {
  observe: '时间',
  pause: '心智',
  reflect: '心智',
  action: '方法',
}

function orderTopics(first: string[]): readonly ObserveTopic[] {
  const rest = OBSERVE_TOPICS.filter((t) => !first.includes(t))
  return [...(first as ObserveTopic[]), ...rest]
}

/**
 * 预置理的推荐排序（规格 §7.1：测评结果 → 首周优先推该领域的理）。
 *
 * 只排序、不删减 —— 推荐是「先看哪个」，不是「不许看哪个」。
 * 没有测评（跳过建档）时不猜，按固定顺序给全量。
 * 整体偏低时先给「方法 / 时间」（先给抓手，少推需要沉淀的）。
 */
export function recommendOrder(
  dims?: ReadonlyArray<{ dim: string; score: number; max: number }> | null,
  overallTier?: string,
): readonly ObserveTopic[] {
  if (overallTier === 'low') return orderTopics(['方法', '时间'])
  if (!dims || dims.length < 2) return OBSERVE_TOPICS
  const weakest = [...dims].sort(
    (a, b) => a.score / Math.max(1, a.max) - b.score / Math.max(1, b.max),
  )[0]
  if (!weakest) return OBSERVE_TOPICS
  const first = [DIM_PRIMARY[weakest.dim], DIM_SECONDARY[weakest.dim]].filter(Boolean)
  return first.length ? orderTopics(first) : OBSERVE_TOPICS
}

/**
 * 预置母题库 —— 12 个「反复出现的底层问题」。
 *
 * 为什么是预置的：
 *  母题不是学来的名词，是**被同一件事绊倒很多次之后**才认出来的东西。
 *  空手让用户「提炼母题」几乎必然写不出来，所以先给 12 个常见的当样本：
 *  认领其中一个，或者被它提醒后写出自己的 —— 都算数。
 *
 * 为什么是 12 个：六个领域各 2 个，够密到能认出自己，又少到不会变成另一个收藏夹。
 *
 * 覆盖六领域（与 OBSERVE_TOPICS 一致）：心智 / 方法 / 关系 / 金钱 / 身体 / 时间。
 */
import type { ObserveTopic } from '@/stores/observe'

export interface PresetMother {
  /** 稳定 id（只增不改） */
  id: string
  /** 母题名（一个问句，不是名词 —— 问句才会反复冒出来） */
  name: string
  /** 所属领域 */
  topic: ObserveTopic
  /** 一句话：它通常在什么情况下出现 */
  line: string
  /** 认领时的追问（写进母题条目正文，逼用户先说一句自己的） */
  probe: string
}

export const PRESET_MOTHERS: readonly PresetMother[] = [
  // 心智
  {
    id: 'pm-attention',
    name: '这一刻，注意力归谁',
    topic: '心智',
    line: '同一类东西总在你没决定时就占走十分钟 —— 那就是它在替你分配注意力。',
    probe: '上一次明明想做别的、却被人牵着走，是什么时候？',
  },
  {
    id: 'pm-avoid',
    name: '我到底在回避什么',
    topic: '心智',
    line: '拖延很少是因为懒，多数是因为那件事后面还站着一个更难回答的问题。',
    probe: '那件一直没动的事，做成了会逼你面对什么？',
  },
  // 方法
  {
    id: 'pm-feedback',
    name: '这件事的反馈从哪来',
    topic: '方法',
    line: '没有反馈的练习只是重复。进步快的事，几乎都是当天就能知道自己错在哪的事。',
    probe: '你现在做的这件事，多久能收到一次真实反馈？',
  },
  {
    id: 'pm-smallest',
    name: '最小可行动作是什么',
    topic: '方法',
    line: '卡住往往不是难，是第一步太大。把它切到「五分钟能做完」，卡点通常就消失了。',
    probe: '你手上这件事，五分钟版本长什么样？',
  },
  // 关系
  {
    id: 'pm-exchange',
    name: '这段关系在交换什么',
    topic: '关系',
    line: '长久的关系都在交换某种东西：情绪、资源、时间或陪伴。看不清交换物，就会在失衡时困惑。',
    probe: '这段关系里，你给的是什么，得到的又是什么？',
  },
  {
    id: 'pm-need',
    name: '我说的是需求还是情绪',
    topic: '关系',
    line: '「你从来不管我」是情绪，「我希望睡前有十分钟聊两句」是需求。前者让对方防御，后者可以被满足。',
    probe: '把最近一次想说的话，翻译成一句可执行的需求。',
  },
  // 金钱
  {
    id: 'pm-buy',
    name: '这笔钱换来了什么',
    topic: '金钱',
    line: '花的每一笔都在买某样东西：时间、安心、面子或快感。说清买了什么，后悔会少很多。',
    probe: '上个月最大的一笔非必要支出，买到了什么？它还在吗？',
  },
  {
    id: 'pm-enough',
    name: '够用到底是多少',
    topic: '金钱',
    line: '没有「够」这条线，收入涨多少都还是不够 —— 因为它会跟着欲望一起涨。',
    probe: '写下你的数字：多少收入就足以支撑你想过的日子？',
  },
  // 身体
  {
    id: 'pm-body',
    name: '身体正在说什么',
    topic: '身体',
    line: '肩颈、睡眠、胃口常常比脑子更早知道出了问题。忽略它的账，最后都记在效率上。',
    probe: '最近身体反复出现的那个信号是什么？它出现前你在做什么？',
  },
  {
    id: 'pm-energy',
    name: '一天的精力是怎么流走的',
    topic: '身体',
    line: '时间管理常常无效，因为真正稀缺的不是时间，是精力。找到你精力最高的两小时。',
    probe: '一天里哪两个小时你最清醒？那两小时现在在做什么？',
  },
  // 时间
  {
    id: 'pm-compound',
    name: '这是复利还是消耗',
    topic: '时间',
    line: '同样一小时，有的会在一年后还在给你回报，有的结束就结束了。区别在它有没有留下东西。',
    probe: '昨天花掉的那三小时，今天还剩下什么？',
  },
  {
    id: 'pm-decade',
    name: '什么值得做十年',
    topic: '时间',
    line: '用十年尺度筛一遍，绝大多数"紧急"都会自动掉下去，剩下的才是真正该占住日程的。',
    probe: '眼下忙的事里，有哪件十年后还在？',
  },
]

/** 按领域取预置母题 */
export function presetsOfTopic(topic: ObserveTopic): PresetMother[] {
  return PRESET_MOTHERS.filter((m) => m.topic === topic)
}

export function findPreset(id: string): PresetMother | undefined {
  return PRESET_MOTHERS.find((m) => m.id === id)
}

/**
 * 首次测评题库 —— 三模式三套 6 题建档（普通·生活基线 / 科技·数字画像 / 修仙·灵根检测）。
 * 产品约定：选完模式立刻答题建档；分数 0-18，映射 3 档；重测间隔 ≥30 天。
 * 三套题共用同一评分结构（每题 4 选项 0-3 分），未来改题只动这里。
 */
import type { ModeId } from '@/config/modes'

export interface AssessmentOption {
  text: string
  /** 0-3 分 */
  score: number
}

export interface AssessmentQuestion {
  q: string
  options: readonly AssessmentOption[]
}

export interface AssessmentBank {
  mode: ModeId
  /** 测评名（展示用，通常等于 modes.assessmentName） */
  title: string
  /** 开测前一句话 */
  intro: string
  questions: readonly AssessmentQuestion[]
  /** 三档称号：低 / 中 / 高 */
  tierNames: readonly [string, string, string]
  /** 三档描述：低 / 中 / 高 */
  tierDescs: readonly [string, string, string]
}

export const ASSESSMENT_BANKS: readonly AssessmentBank[] = [
  {
    mode: 'normal',
    title: '生活基线',
    intro: '摸清你当下的生活节奏。没有标准答案，如实就好。',
    questions: [
      {
        q: '清晨睁开眼，你通常会先做什么？',
        options: [
          { text: '先刷上十几二十分钟手机再说', score: 0 },
          { text: '躺着刷一会儿，再慢慢起来', score: 1 },
          { text: '洗漱吃饭，忙完正事才碰手机', score: 2 },
          { text: '睁眼就开始今天的正事', score: 3 },
        ],
      },
      {
        q: '做正事时，能连续专注多久不被手机打断？',
        options: [
          { text: '很难超过 10 分钟', score: 0 },
          { text: '半小时左右就想去摸手机', score: 1 },
          { text: '能专注一两小时', score: 2 },
          { text: '大半天都不怎么碰', score: 3 },
        ],
      },
      {
        q: '晚上临睡前，你一般在做什么？',
        options: [
          { text: '短视频一刷就停不下来', score: 0 },
          { text: '刷到眼皮打架才睡', score: 1 },
          { text: '看会儿书或听点什么', score: 2 },
          { text: '到点就睡，沾枕头就着', score: 3 },
        ],
      },
      {
        q: '感到无聊或焦虑时，你的第一反应是？',
        options: [
          { text: '立刻拿起手机', score: 0 },
          { text: '大多时候会去摸手机', score: 1 },
          { text: '偶尔，多数能忍住', score: 2 },
          { text: '能安静地待一会儿', score: 3 },
        ],
      },
      {
        q: '这一周，你有几天出门走动或运动？',
        options: [
          { text: '几乎没有', score: 0 },
          { text: '一两天', score: 1 },
          { text: '三四天', score: 2 },
          { text: '五天以上', score: 3 },
        ],
      },
      {
        q: '过去一个月，你完整读完过书或长文吗？',
        options: [
          { text: '一本都没读完', score: 0 },
          { text: '读过几篇长文', score: 1 },
          { text: '读完过一本薄书', score: 2 },
          { text: '读完两本以上', score: 3 },
        ],
      },
    ],
    tierNames: ['紧绷期', '平衡期', '从容期'],
    tierDescs: [
      '信息与屏幕占用的比重偏高，身心常被推着走。好消息是：基线越低，改善的余地越大。',
      '节奏大体自洽，偶有失控的时段。把「观止知行的清单」变成固定节律，是下一步。',
      '作息、专注与阅读都在轨道上。守住它，把节奏过成理所当然的样子。',
    ],
  },
  {
    mode: 'tech',
    title: '数字画像',
    intro: '用数据给现在的你画一张像。参数如实填写，越诚实越准。',
    questions: [
      {
        q: '估算今天纯屏幕时间（非工作用途）有多少？',
        options: [
          { text: '4 小时以上', score: 0 },
          { text: '2-4 小时', score: 1 },
          { text: '1-2 小时', score: 2 },
          { text: '不到 1 小时', score: 3 },
        ],
      },
      {
        q: '收到消息通知，你通常？',
        options: [
          { text: '有红点就想点开', score: 0 },
          { text: '经常被打断去看', score: 1 },
          { text: '攒到固定时间集中处理', score: 2 },
          { text: '通知常年静音，主动去看', score: 3 },
        ],
      },
      {
        q: '同时开着好几件事时，你？',
        options: [
          { text: '常忘了上一件做到哪', score: 0 },
          { text: '手忙脚乱勉强应付', score: 1 },
          { text: '能分清主次有序切换', score: 2 },
          { text: '习惯一次只做一件', score: 3 },
        ],
      },
      {
        q: '你每天主动摄取的新信息，主要来自？',
        options: [
          { text: '被动刷到什么看什么', score: 0 },
          { text: '各平台的信息流推送', score: 1 },
          { text: '固定的几个订阅与作者', score: 2 },
          { text: '围绕明确主题的深入阅读', score: 3 },
        ],
      },
      {
        q: '关于「记录」，你的日常是？',
        options: [
          { text: '基本不记录', score: 0 },
          { text: '想到了才记一笔', score: 1 },
          { text: '有固定的清单或日记', score: 2 },
          { text: '有完整的记录与复盘系统', score: 3 },
        ],
      },
      {
        q: '一天结束回想今天，你通常觉得？',
        options: [
          { text: '想不起自己干了什么', score: 0 },
          { text: '有点乱，理不清', score: 1 },
          { text: '大致清楚做了什么', score: 2 },
          { text: '心里有本明白账', score: 3 },
        ],
      },
    ],
    tierNames: ['失焦画像', '均衡画像', '强健画像'],
    tierDescs: [
      '注意力被切割得比较碎，屏幕主导了大部分空闲时间。先把「止」练起来，数据会很快变好看。',
      '大多数维度自控良好，偶有失焦窗口。用专注统计固化好的习惯，把「偶尔」变成「默认」。',
      '清晰、自洽、有系统。你缺的不是方法，是把这套系统坚持下去的长期主义。',
    ],
  },
  {
    mode: 'dao',
    title: '灵根检测',
    intro: '测一测你心性的根骨。灵根有优劣，修行无早晚。',
    questions: [
      {
        q: '独自安静时（无手机），杂念多久会涌上来？',
        options: [
          { text: '几乎静不下来，念头没停过', score: 0 },
          { text: '撑一两分钟就想动', score: 1 },
          { text: '能安静坐一阵子', score: 2 },
          { text: '极少杂念，安定自如', score: 3 },
        ],
      },
      {
        q: '面对剧、游戏、美食这类诱惑，你能自控多久？',
        options: [
          { text: '基本抵挡不住', score: 0 },
          { text: '只能撑一时', score: 1 },
          { text: '大部分时候守得住', score: 2 },
          { text: '诱惑于我如浮云', score: 3 },
        ],
      },
      {
        q: '别人的一句评价，会扰乱你多久？',
        options: [
          { text: '一整天都在想', score: 0 },
          { text: '好几个小时', score: 1 },
          { text: '一阵子就过去了', score: 2 },
          { text: '听过即忘，不入心', score: 3 },
        ],
      },
      {
        q: '刷到一条很刺激、引战的内容，你会？',
        options: [
          { text: '立刻想回击、转发', score: 0 },
          { text: '忍不住要评论两句', score: 1 },
          { text: '能忍住，划走', score: 2 },
          { text: '基本无感', score: 3 },
        ],
      },
      {
        q: '最近一次对自己许诺「要做到」，结果如何？',
        options: [
          { text: '没做到，早忘了', score: 0 },
          { text: '勉强完成了一半', score: 1 },
          { text: '做到了', score: 2 },
          { text: '说到做到，从不失言', score: 3 },
        ],
      },
      {
        q: '你觉得自己更接近哪种状态？',
        options: [
          { text: '被日子推着走', score: 0 },
          { text: '常心浮气躁，定不住', score: 1 },
          { text: '时有静定，能自己拿主意', score: 2 },
          { text: '气定神闲，处变不惊', score: 3 },
        ],
      },
    ],
    tierNames: ['凡骨灵根', '中品灵根', '天品灵根'],
    tierDescs: [
      '凡骨亦能成道。灵根平平，正说明心性尚未被驯化，反而潜力无限——从每天一段沙漏开始炼。',
      '中品可造。定力尚可、贪嗔偶起，正好以日课打磨，假以时日必入上品。',
      '天品之姿，万中无一。切记根骨愈佳，魔考愈重——守住日常，方不负此根。',
    ],
  },
]

export function getAssessmentBank(mode: ModeId): AssessmentBank {
  return ASSESSMENT_BANKS.find((b) => b.mode === mode) ?? ASSESSMENT_BANKS[0]
}

export type AssessmentTier = 'low' | 'mid' | 'high'

/** 总分 → 档位（0-18：≤6 低 / ≥13 高 / 其余中） */
export function tierOf(score: number): AssessmentTier {
  if (score >= 13) return 'high'
  if (score <= 6) return 'low'
  return 'mid'
}

export function tierIndex(tier: AssessmentTier): 0 | 1 | 2 {
  return tier === 'low' ? 0 : tier === 'mid' ? 1 : 2
}

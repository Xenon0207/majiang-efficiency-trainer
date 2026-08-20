import type { TileCode } from '../domain/tiles'

export interface RuleChoice {
  id: string
  label: string
  correct: boolean
  explanation: string
}

export interface RuleQuestion {
  id: string
  prompt: string
  note?: string
  tiles?: readonly TileCode[]
  river?: readonly TileCode[]
  doraIndicator?: TileCode
  choices: readonly RuleChoice[]
}

export interface RuleLesson {
  id: string
  order: number
  title: string
  subtitle: string
  intro: string
  keyPoint: string
  points: readonly string[]
  example?: {
    label: string
    tiles: readonly TileCode[]
    caption: string
  }
  questions: readonly RuleQuestion[]
}

export const ruleLessons: readonly RuleLesson[] = [
  {
    id: 'round-flow',
    order: 1,
    title: '一局日麻怎样进行',
    subtitle: '场风、自风、庄家与王牌',
    intro: '基本摸切与四面子一雀头和其他麻将相同；先认识日麻桌面上新增的场况信息。',
    keyPoint: '场风属于整局阶段，自风取决于你的座位；两者可能相同。',
    points: [
      '一副牌共 136 张，不使用花牌；牌山末端保留 14 张王牌。',
      '东风战通常打完东一局到东四局；半庄战继续打南一局到南四局。',
      '庄家自风为东。庄家和牌，或流局时按规则保持庄家，会连庄并增加本场数。',
      '普通摸牌来自牌山；杠后从王牌摸岭上牌。牌山摸完仍无人和牌时荒牌流局。',
    ],
    questions: [
      {
        id: 'round-1',
        prompt: '现在是东三局，你坐南家。场风和自风分别是什么？',
        choices: [
          { id: 'a', label: '场风东，自风南', correct: true, explanation: '东三局仍属于东场；你坐南家，所以自风是南。' },
          { id: 'b', label: '场风南，自风东', correct: false, explanation: '局数中的“东”是场风，不代表每个人的自风。' },
          { id: 'c', label: '场风东，自风东', correct: false, explanation: '只有庄家的自风固定为东；题目中你是南家。' },
        ],
      },
      {
        id: 'round-2',
        prompt: '普通情况下，王牌中的 14 张牌会怎样？',
        choices: [
          { id: 'a', label: '保留在牌山末端，不作为普通摸牌', correct: true, explanation: '王牌用于宝牌指示、岭上牌等，不会像普通牌山一样依次摸完。' },
          { id: 'b', label: '最后 14 巡照常摸取', correct: false, explanation: '普通牌山在王牌之前结束；剩余王牌不会成为普通摸牌。' },
          { id: 'c', label: '开局平均发给四家', correct: false, explanation: '王牌始终留在牌山末端，不会在开局发给玩家。' },
        ],
      },
      {
        id: 'round-3',
        prompt: '牌山的普通摸牌全部用完，仍无人和牌，通常发生什么？',
        choices: [
          { id: 'a', label: '荒牌流局', correct: true, explanation: '随后会确认各家是否听牌，并处理流局结算与连庄。' },
          { id: 'b', label: '自动由庄家和牌', correct: false, explanation: '庄家不会因为牌山耗尽而自动和牌。' },
          { id: 'c', label: '继续摸王牌直到有人和牌', correct: false, explanation: '王牌不用于延长普通摸牌。' },
        ],
      },
    ],
  },
  {
    id: 'yaku-required',
    order: 2,
    title: '有牌型不等于能和',
    subtitle: '先有役，再计算宝牌',
    intro: '日麻与许多地方麻将最大的区别，是牌已经组成和牌形状仍不一定能和。',
    keyPoint: '宝牌只增加番数，不会提供和牌资格。没有役时，宝牌再多也不能和。',
    points: [
      '和牌必须至少有一个役。役来自牌型、和牌方式或场况。',
      '门前表示没有吃、碰或明杠；暗杠通常仍保持门前。',
      '有些役只限门前，有些副露后会降番，也有些副露后仍成立。',
      '判断顺序永远是：先确认有役，再把赤宝牌、表宝牌和里宝牌加入番数。',
    ],
    questions: [
      {
        id: 'yaku-gate-1',
        prompt: '你的副露手牌已经组成和牌形状，含 3 张宝牌，但没有任何役。能和吗？',
        choices: [
          { id: 'a', label: '不能和', correct: true, explanation: '宝牌不是役。必须先有至少一个役，宝牌才会增加番数。' },
          { id: 'b', label: '能和，因为有 3 张宝牌', correct: false, explanation: '宝牌再多也不能替代役，这是日麻最重要的规则门槛。' },
        ],
      },
      {
        id: 'yaku-gate-2',
        prompt: '门前听牌后自摸，除此之外没有别的牌型役。能和吗？',
        choices: [
          { id: 'a', label: '能和', correct: true, explanation: '门前清自摸和本身就是 1 番役。' },
          { id: 'b', label: '不能和', correct: false, explanation: '只要保持门前，自摸便提供“门前清自摸和”。' },
        ],
      },
      {
        id: 'yaku-gate-3',
        prompt: '已经碰过牌，还能依靠“门前清自摸和”获得役吗？',
        choices: [
          { id: 'a', label: '不能', correct: true, explanation: '碰牌使手牌副露，不再满足门前清自摸和。' },
          { id: 'b', label: '只要最终自摸就能', correct: false, explanation: '这个役同时要求“门前”和“自摸”，缺一不可。' },
        ],
      },
    ],
  },
  {
    id: 'common-yaku',
    order: 3,
    title: '最常用的入门役',
    subtitle: '先掌握最容易遇到的八种',
    intro: '不必先背完整役种表。把常见役与门前限制记清楚，已经足够开始实战。',
    keyPoint: '立直、门前清自摸和、平和、一杯口只在门前成立；断幺九、役牌、对对和可以副露。',
    points: [
      '立直：门前听牌时宣告。门前清自摸和：门前状态下自摸。',
      '断幺九：全部由 2～8 数牌组成。本工具采用常见的“食断”，副露后仍成立。',
      '役牌：三元牌、场风或自风组成刻子/杠子。双东、双南可同时计算两番。',
      '平和：门前、全顺子、非役牌雀头，并以两面等待完成。',
      '一杯口要求门前的同门同数字两组顺子；对对和与七对子则由对子、刻子构成。',
    ],
    example: {
      label: '平和的核心形状',
      tiles: ['2m', '3m', '4m', '3p', '4p', '5p', '6s', '7s', '2s', '3s', '4s', '5m', '5m'],
      caption: '门前已有三组顺子、非役牌雀头，67条两面等待 5/8条时符合平和。',
    },
    questions: [
      {
        id: 'common-yaku-1',
        prompt: '你是南家，场风为东，手里有三张南。它是什么？',
        tiles: ['2z', '2z', '2z'],
        choices: [
          { id: 'a', label: '自风役牌，1 番', correct: true, explanation: '你的自风是南，南刻子构成役牌。' },
          { id: 'b', label: '只是普通字牌刻子', correct: false, explanation: '自风刻子本身就是 1 番役。' },
          { id: 'c', label: '场风役牌，2 番', correct: false, explanation: '场风是东，因此南只计算自风的 1 番。' },
        ],
      },
      {
        id: 'common-yaku-2',
        prompt: '副露后，手牌全部由 2～8 数牌组成。按本工具规则有什么役？',
        choices: [
          { id: 'a', label: '断幺九', correct: true, explanation: '本工具采用允许副露断幺九的常见规则。' },
          { id: 'b', label: '平和', correct: false, explanation: '平和必须门前；副露后不能成立。' },
          { id: 'c', label: '一定无役', correct: false, explanation: '只要不含幺九和字牌，副露也可以保留断幺九。' },
        ],
      },
      {
        id: 'common-yaku-3',
        prompt: '平和的最后等待可以是坎张，例如 24 等 3 吗？',
        tiles: ['2m', '4m'],
        choices: [
          { id: 'a', label: '不可以', correct: true, explanation: '平和要求最终是两面等待；坎张、边张和单骑都不符合。' },
          { id: 'b', label: '可以，只要其他部分都是顺子', correct: false, explanation: '全顺子只是条件之一，最终等待也必须是两面。' },
        ],
      },
    ],
  },
  {
    id: 'calls-and-kan',
    order: 4,
    title: '吃、碰、杠与副露',
    subtitle: '鸣牌前先确认还剩什么役',
    intro: '你已经知道吃碰杠怎样组成面子，这一课只处理日麻的来源限制和门前变化。',
    keyPoint: '鸣牌最危险的不是少一张受入，而是把唯一的役一起鸣掉。',
    points: [
      '吃只能取上家的弃牌；碰和大明杠可以取另外任何一家的弃牌。',
      '吃、碰、大明杠和加杠会使手牌副露，之后不能立直。',
      '暗杠通常仍视为门前，但立直后的暗杠还有额外形状限制，入门阶段先不展开。',
      '杠成立后翻开新的宝牌指示牌，并从岭上牌补摸一张。',
    ],
    questions: [
      {
        id: 'calls-1',
        prompt: '对家打出你需要的牌，可以用它完成顺子并“吃”吗？',
        choices: [
          { id: 'a', label: '不可以', correct: true, explanation: '吃只能取上家的弃牌；对家或下家的牌不能吃。' },
          { id: 'b', label: '可以，顺子正确即可', correct: false, explanation: '日麻严格限制吃牌来源，只能吃上家。' },
        ],
      },
      {
        id: 'calls-2',
        prompt: '碰了一组役牌后，之后还能立直吗？',
        choices: [
          { id: 'a', label: '不能立直，但役牌仍提供役', correct: true, explanation: '碰牌破坏门前，所以不能立直；役牌本身仍成立。' },
          { id: 'b', label: '可以立直，因为已经有役', correct: false, explanation: '是否有役与能否立直是两件事；立直必须门前。' },
          { id: 'c', label: '不能立直，而且役牌也消失', correct: false, explanation: '役牌允许副露，碰出后仍是役。' },
        ],
      },
      {
        id: 'calls-3',
        prompt: '自己手里四张相同牌做暗杠，通常会发生什么？',
        choices: [
          { id: 'a', label: '保持门前，翻新宝牌并摸岭上牌', correct: true, explanation: '暗杠通常不破坏门前；杠后会增加宝牌指示并补摸岭上牌。' },
          { id: 'b', label: '一定失去门前状态', correct: false, explanation: '暗杠与明杠不同，通常仍保持门前。' },
          { id: 'c', label: '不补牌，手牌永久少一张', correct: false, explanation: '杠后需要从岭上补摸，使手牌继续保持可正常摸切的张数。' },
        ],
      },
    ],
  },
  {
    id: 'riichi',
    order: 5,
    title: '立直',
    subtitle: '用 1000 点换取役与额外打点机会',
    intro: '立直把“我已经门前听牌”公开宣告出来。它简单、常用，也是初学者最可靠的役。',
    keyPoint: '立直后不能自由改牌，原则上只能把刚摸到的牌打掉。',
    points: [
      '必须保持门前并已经听牌；宣告时横放弃牌并支付一根 1000 点立直棒。',
      '通常要求自己至少有 1000 点，且牌山仍足够让自己再摸一次。',
      '立直本身 1 番，并可能获得一发与里宝牌。',
      '立直后原则上只能摸切；符合严格条件的暗杠除外。',
    ],
    questions: [
      {
        id: 'riichi-1',
        prompt: '门前一向听，支付 1000 点后可以提前立直吗？',
        choices: [
          { id: 'a', label: '不可以', correct: true, explanation: '立直时必须已经听牌；一向听还差一步。' },
          { id: 'b', label: '可以，只要保持门前', correct: false, explanation: '门前只是条件之一，听牌也是硬性条件。' },
        ],
      },
      {
        id: 'riichi-2',
        prompt: '立直之后摸到一张能改善等待、但不能和的牌，可以自由换牌吗？',
        choices: [
          { id: 'a', label: '通常不能，只能摸切', correct: true, explanation: '立直锁定了手牌与等待，普通情况下必须打出刚摸的牌。' },
          { id: 'b', label: '可以，只要向听数不退', correct: false, explanation: '向听不退并不足够；立直后不能自由改变手牌。' },
        ],
      },
      {
        id: 'riichi-3',
        prompt: '立直后和牌，里宝牌指示牌有什么作用？',
        choices: [
          { id: 'a', label: '可能增加额外宝牌番数', correct: true, explanation: '只有立直和牌者能查看并计算里宝牌。' },
          { id: 'b', label: '提供立直所需的役', correct: false, explanation: '立直本身已经是役；里宝牌只负责增加番数。' },
          { id: 'c', label: '把所有赤五变成普通五', correct: false, explanation: '里宝牌不会取消赤宝牌。' },
        ],
      },
    ],
  },
  {
    id: 'furiten',
    order: 6,
    title: '振听',
    subtitle: '看整组等待，不只看被打过的那张',
    intro: '振听限制荣和，但不限制自摸。判断时必须先求出全部和牌牌，再检查自己的牌河。',
    keyPoint: '只要自己的牌河含有任意一张和牌牌，整组等待都不能荣和。',
    points: [
      '舍牌振听：自己曾打过当前任意一张和牌牌，当前全部等待都不能荣和。',
      '同巡振听：别人打出可荣和牌而你选择放过，在自己下次摸牌前不能荣和。',
      '立直后放过可荣和牌，会在本局剩余时间持续振听。',
      '以上状态都不妨碍自摸。',
    ],
    example: {
      label: '最容易漏判的振听',
      tiles: ['2m', '3m'],
      caption: '23万听 1万和4万。只要自己的牌河里有1万，1万与4万都不能荣和。',
    },
    questions: [
      {
        id: 'furiten-1',
        prompt: '你持有 23万，听 1万和4万；自己的牌河里有 1万。对手打出4万，能荣和吗？',
        tiles: ['2m', '3m'],
        river: ['1m'],
        choices: [
          { id: 'a', label: '不能荣和', correct: true, explanation: '1万属于当前等待，因此整组 1/4万都处于舍牌振听。' },
          { id: 'b', label: '能，因为自己只打过1万', correct: false, explanation: '振听不是只封锁打过的那张牌，而是封锁整组等待的荣和。' },
        ],
      },
      {
        id: 'furiten-2',
        prompt: '同样处于舍牌振听时，自己摸到4万，可以自摸和吗？',
        tiles: ['2m', '3m', '4m'],
        river: ['1m'],
        choices: [
          { id: 'a', label: '可以自摸', correct: true, explanation: '振听只限制荣和，不会取消自摸和牌。' },
          { id: 'b', label: '不可以，振听禁止任何和牌', correct: false, explanation: '振听仍然允许自摸，这是实战中的重要区别。' },
        ],
      },
      {
        id: 'furiten-3',
        prompt: '立直后，对手打出可和牌，你选择不荣和。之后还能荣和同组等待吗？',
        choices: [
          { id: 'a', label: '本局不能再荣和，只能等待自摸', correct: true, explanation: '立直后的见逃振听会持续到本局结束。' },
          { id: 'b', label: '自己下次摸牌后恢复荣和', correct: false, explanation: '这是普通同巡振听的恢复方式；立直后见逃不会恢复。' },
        ],
      },
    ],
  },
  {
    id: 'dora',
    order: 7,
    title: '宝牌与赤五',
    subtitle: '从指示牌找到真正的宝牌',
    intro: '桌上翻开的牌是“宝牌指示牌”，它的下一张才是真正的宝牌。',
    keyPoint: '数牌、风牌和三元牌各自在自己的循环里前进，不能跨组。',
    points: [
      '数牌按 1→2→…→9→1 循环。',
      '风牌按 东→南→西→北→东 循环。',
      '三元牌按 白→发→中→白 循环。',
      '赤五本身就是一张宝牌；杠会增加宝牌指示牌，立直和牌还可能计算里宝牌。',
      '宝牌仍然不是役：必须先有其他役才能和牌。',
    ],
    questions: [
      {
        id: 'dora-1',
        prompt: '宝牌指示牌是9万，真正的宝牌是什么？',
        doraIndicator: '9m',
        choices: [
          { id: 'a', label: '1万', correct: true, explanation: '数牌在9之后回到1。' },
          { id: 'b', label: '9万', correct: false, explanation: '翻开的牌只是指示牌，宝牌是它的下一张。' },
          { id: 'c', label: '白', correct: false, explanation: '数牌只在同一门的1～9内循环。' },
        ],
      },
      {
        id: 'dora-2',
        prompt: '宝牌指示牌是北，真正的宝牌是什么？',
        doraIndicator: '4z',
        choices: [
          { id: 'a', label: '东', correct: true, explanation: '风牌循环是东南西北，北的下一张回到东。' },
          { id: 'b', label: '白', correct: false, explanation: '风牌与三元牌使用两个独立循环。' },
          { id: 'c', label: '北', correct: false, explanation: '指示牌本身通常不等于宝牌。' },
        ],
      },
      {
        id: 'dora-3',
        prompt: '一手牌只有两张赤五，没有任何役。能和吗？',
        tiles: ['0m', '0p'],
        choices: [
          { id: 'a', label: '不能和', correct: true, explanation: '赤五各算一张宝牌，但宝牌不能提供和牌资格。' },
          { id: 'b', label: '能和，赤五就是两番役', correct: false, explanation: '赤五增加两番宝牌；“番”不代表它本身是役。' },
        ],
      },
    ],
  },
]

export const totalRuleQuestions = ruleLessons.reduce((sum, lesson) => sum + lesson.questions.length, 0)

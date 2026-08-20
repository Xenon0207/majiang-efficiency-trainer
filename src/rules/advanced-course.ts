import type { TileCode } from '../domain/tiles'
import type { RuleChoice, RuleLesson, RulePhase, RuleQuestion } from './course'
import { MAJSOUL_RULESET, hanLabel, yakuCatalog, type YakuDefinition, type YakuFrequency } from './majsoul-ruleset'
import { calculateScore, scoreExplanation, type ScoreInput } from './scoring'

function choose(id: string, prompt: string, correctLabel: string, wrongLabels: readonly string[], explanation: string): RuleQuestion {
  return { id, prompt, choices: [
    { id: 'correct', label: correctLabel, correct: true, explanation },
    ...wrongLabels.map((label, index) => ({ id: `wrong-${index}`, label, correct: false, explanation })),
  ] }
}

function lesson(input: Omit<RuleLesson, 'habit' | 'difference' | 'terms'> & Partial<Pick<RuleLesson, 'habit' | 'difference' | 'terms'>>): RuleLesson {
  return {
    habit: '先凭熟悉感认牌型，却没有检查门清、副露与成立条件。',
    difference: '完整学习阶段要同时回答：这是什么役、是否允许副露、副露后还剩几番。',
    terms: '本阶段采用雀魂四人麻将标准规则。',
    ...input,
  }
}

const byFrequency = (frequency: YakuFrequency) => yakuCatalog.filter((yaku) => yaku.frequency === frequency)

function yakuRecognitionQuestions(prefix: string, yakus: readonly YakuDefinition[]): RuleQuestion[] {
  return yakus.map((yaku, index) => {
    const distractors = yakus.filter((item) => item.id !== yaku.id).slice((index * 3) % Math.max(1, yakus.length - 1), (index * 3) % Math.max(1, yakus.length - 1) + 2)
    const labels = distractors.length === 2 ? distractors.map((item) => item.name) : yakuCatalog.filter((item) => item.id !== yaku.id).slice(0, 2).map((item) => item.name)
    return choose(`${prefix}-${yaku.id}`, `哪一个役符合这段说明：${yaku.summary}`, yaku.name, labels, `${yaku.name}：${yaku.summary} 门清时${hanLabel(yaku, false)}，${hanLabel(yaku, true)}。`)
  })
}

function openChangeQuestions(yakus: readonly YakuDefinition[]): RuleQuestion[] {
  return yakus.map((yaku) => {
    const correct = hanLabel(yaku, true)
    const wrong = yaku.hanOpen === null ? ['仍然成立，番数不变', '副露后减1番'] : [`副露后不成立`, `副露后${hanLabel(yaku, false)}`]
    return choose(`open-${yaku.id}`, `${yaku.name}在已经吃碰后怎样计算？`, correct, wrong, `${yaku.name}门清时${hanLabel(yaku, false)}；${correct}。`)
  })
}

function hanReviewQuestions(): RuleQuestion[] {
  return yakuCatalog.filter((yaku) => typeof yaku.hanClosed === 'number' && yaku.id !== 'dora').map((yaku) => {
    const correct = `${hanLabel(yaku, false)}${yaku.hanOpen === null ? '，仅门清' : yaku.hanOpen !== yaku.hanClosed ? `／副露${hanLabel(yaku, true)}` : '，副露不减番'}`
    return choose(`han-${yaku.id}`, `${yaku.name}按番数怎样记？`, correct, ['1番，副露不减番', '2番，仅门清'], `${yaku.name}：门清${hanLabel(yaku, false)}；${hanLabel(yaku, true)}。`)
  })
}

function multi(id: string, prompt: string, tiles: readonly TileCode[], options: readonly [string, boolean][], explanation: string): RuleQuestion {
  return {
    id, prompt, tiles, selectionMode: 'multiple',
    choices: options.map(([label, correct], index): RuleChoice => ({ id: `${id}-${index}`, label, correct, explanation })),
  }
}

const routeQuestions: readonly RuleQuestion[] = [
  multi('route-plan-1', '这手约三向听。保持门清向前走时，哪些役是自然可期待的方向？（多选）', ['2m','3m','4m','3p','4p','5p','4s','5s','6s','7p','7p','2s','3s'], [['立直',true],['平和',true],['断幺九',true],['混一色',false]], '三门顺子、中张为主且有普通雀头；立直、平和、断幺九都自然，混一色反而要拆掉大量牌。'),
  multi('route-plan-2', '这手牌最自然保留哪些役种可能？（多选）', ['1m','2m','3m','4m','5m','6m','7m','8m','9m','5z','5z','6z','6z'], [['一气通贯',true],['混一色',true],['役牌',true],['断幺九',false]], '同门已有123/456/789骨架，字牌对子可向役牌发展；含幺九，不能做断幺九。'),
  multi('route-plan-3', '对子很多但尚未成型，哪些路线值得同时比较？（多选）', ['2m','2m','5m','5m','3p','3p','7p','7p','4s','4s','6z','6z','9s'], [['七对子',true],['普通面子手',true],['国士无双',false],['清一色',false]], '六个对子让七对很近，但相邻牌仍可能组成面子；不能只凭对子多就锁死路线。'),
  multi('route-plan-4', '这手三门都有相同数字顺子骨架，哪些路线自然？（多选）', ['2m','3m','4m','2p','3p','4p','2s','3s','5s','6s','6s','7s','8s'], [['三色同顺',true],['平和',true],['立直',true],['三色同刻',false]], '三门234指向三色同顺；顺子手也自然保留平和与立直。三色同刻需要三门刻子，不是同顺。'),
  multi('route-plan-5', '这手以字牌和幺九对子为主，哪些特殊路线值得观察？（多选）', ['1m','1m','9m','1p','9p','9p','1s','9s','1z','2z','3z','5z','7z'], [['国士无双',true],['混老头',true],['断幺九',false],['平和',false]], '十三幺种类很多，国士路线明确；对子继续增加时也可能观察混老头，但不能强行锁定。'),
  multi('route-plan-6', '这手一门数牌占绝对多数并带字牌，哪些路线应保留？（多选）', ['2p','3p','4p','4p','5p','6p','7p','8p','9p','5z','5z','6z','6z'], [['混一色',true],['一气通贯',true],['役牌',true],['三色同顺',false]], '饼子一门加字牌自然指向混一色；已有中后段连续形可观察一气，字牌对子也可能成为役牌。'),
]

function scoreChoices(correct: string, input: ScoreInput): string[] {
  const variants = [
    calculateScore({ ...input, dealer: !input.dealer }).label,
    calculateScore({ ...input, han: Math.max(1, input.han - 1) }).label,
    calculateScore({ ...input, fu: input.fu === 30 ? 40 : 30 }).label,
    input.method === 'ron' ? `${calculateScore(input).total + 300}点` : `${calculateScore(input).payments[0] + 100} / ${calculateScore(input).payments.at(-1)! + 100}点`,
  ]
  return [...new Set(variants)].filter((value) => value !== correct).slice(0, 3)
}

function generateScorePool(prefix: string, count: number, mode: 'ron' | 'mixed' | 'limit'): RuleQuestion[] {
  const regular = [
    [1,30],[1,40],[1,50],[2,25],[2,30],[2,40],[2,50],[2,60],[3,30],[3,40],[3,50],[3,60],[4,30],[4,40],
  ] as const
  const limits = [[5,30],[6,30],[7,30],[8,30],[10,30],[11,30],[12,30],[13,30]] as const
  return Array.from({ length: count }, (_, index) => {
    const [han, fu] = (mode === 'limit' ? limits : regular)[index % (mode === 'limit' ? limits.length : regular.length)]
    const method = mode === 'ron' ? 'ron' : index % 3 === 0 ? 'ron' : 'tsumo'
    const dealer = Math.floor(index / 2) % 2 === 1
    const input: ScoreInput = { han, fu, method, dealer }
    const result = calculateScore(input)
    const correct = result.label
    const context = dealer ? '亲家' : '子家'
    const action = method === 'ron' ? '荣和' : '自摸'
    return choose(`${prefix}-${index + 1}`, `第${index + 1}题：${context}${han}番${fu}符${action}，应怎样支付？`, correct, scoreChoices(correct, input), scoreExplanation(input))
  })
}

const fuQuestions: readonly RuleQuestion[] = [
  choose('fu-1', '平和门清自摸通常按多少符？', '20符', ['30符','40符'], '平和自摸是常见的20符例外。'),
  choose('fu-2', '七对子固定按多少符？', '25符', ['20符','30符'], '七对子固定25符，不再逐项累加。'),
  choose('fu-3', '门清荣和最常见的起点是多少符？', '30符', ['20符','25符'], '副底20符加门清荣和10符，通常从30符开始。'),
  choose('fu-4', '坎张、边张或单骑等待通常增加多少符？', '2符', ['4符','不加符'], '三种愚形等待通常加2符；两面和双碰不靠等待本身加符。'),
  choose('fu-5', '白、发、中作雀头通常增加多少符？', '2符', ['1符','4符固定'], '役牌雀头通常2符；场风与自风重合的雀魂规则按4符。'),
  choose('fu-6', '算完符以后怎样处理个位数？', '向上进到下一个10符', ['四舍五入','直接舍去'], '除七对子25符外，符数向上取整到10。'),
  choose('fu-7', '本课程为什么主要练20、25、30、40、50、60、70符？', '覆盖绝大多数常见实战和牌', ['其他符数在规则上不存在','雀魂只允许这些符数'], '奇特高符并非不存在，只是不值得初学阶段投入大量记忆。'),
  choose('fu-8', '一副暗杠会影响符数；本课程的算分题最多放几副杠？', '一副', ['两副','不限'], '先覆盖一杠以内的常见局面，避免罕见组合干扰点数熟练度。'),
]

const otherRuleQuestions: readonly RuleQuestion[] = [
  choose('detail-1', '吃牌只能从哪位玩家的舍牌进行？', '上家', ['下家','任意一家'], '吃只能对上家的舍牌；碰与明杠可对任意一家。'),
  choose('detail-2', '碰与吃同时发生冲突时，通常谁优先？', '碰（以及和牌）优先于吃', ['吃永远优先','按座次随机'], '和牌优先级最高；碰/杠优先于吃。'),
  choose('detail-3', '开杠后除摸岭上牌外，还会发生什么？', '翻开新的宝牌指示牌', ['立刻立直','清空所有牌河'], '每次有效开杠会增加一个杠宝牌指示牌。'),
  choose('detail-4', '立直棒1000点在无人和牌的流局后怎样处理？', '留在场上，由之后的和牌者取得', ['立即退还','三家平分'], '供托会累积到之后有人和牌。'),
  choose('detail-5', '一本场时，荣和的支付通常额外增加多少？', '300点', ['100点','1000点'], '每本场荣和加300；自摸时每家多付100。'),
  choose('detail-6', '荒牌流局时，听牌与未听牌玩家之间通常发生什么？', '结算总计3000点的罚符', ['无人支付','每人固定支付1000'], '根据听牌人数在听牌者与未听牌者之间结算3000点。'),
  choose('detail-7', '立直后能否暗杠？', '仅在不改变等待和手牌结构判定时可以', ['永远可以','绝对不可以'], '立直后暗杠限制严格，不能借此改变等待。'),
  choose('detail-8', '赤5万本身怎样计算？', '作为5万使用，并额外算1张赤宝牌', ['只能作宝牌不能组面子','固定算2番'], '赤五功能上仍是普通五，可组成面子，同时自带1番宝牌。'),
  choose('detail-9', '牌山只剩最后一张时还能开杠吗？', '不能', ['可以，岭上牌另算','只有暗杠可以'], '没有可供补牌与后续正常流程的空间时不能开杠。'),
  choose('detail-10', '宝牌指示牌翻出4万，手里的赤5万共算几张宝牌？', '2张：普通宝牌5万＋赤宝牌', ['1张，只取其一','3张'], '同一张赤5既命中普通宝牌，又具有赤宝牌身份，可叠加计算。'),
]

const high = byFrequency('高频').filter((yaku) => yaku.id !== 'dora')
const common = byFrequency('常见')
const occasional = byFrequency('偶尔')
const rare = byFrequency('罕见')

export const advancedRulePhases: readonly RulePhase[] = [
  { id: 'complete-yaku', eyebrow: '详细规则 · 第一部分', title: '完整役种体系', goal: '按实战出现频率学习；高频反复练，罕见役只要求见到时认识。', lessonIds: ['common-yaku','open-yaku','regular-yaku','rare-yaku','han-review','route-planning'] },
  { id: 'scoring', eyebrow: '详细规则 · 第二部分', title: '常见和牌算分', goal: '先掌握常见符，再用短回合从数百道题库练到形成反射。', lessonIds: ['fu-basics','score-ron','score-tsumo','score-limit'] },
  { id: 'rule-details', eyebrow: '详细规则 · 第三部分', title: '牌桌细节补全', goal: '补齐鸣牌、杠、本场、供托、流局等真正开局后会遇到的规则。', lessonIds: ['table-details'] },
]

export const advancedRuleLessons: readonly RuleLesson[] = [
  lesson({ id:'common-yaku',phaseId:'complete-yaku',order:13,title:'先把高频役认到不假思索',subtitle:'高频役正反反复',intro:'这些役构成绝大多数真实和牌，值得重复。',keyPoint:'先看能否和，再数可以叠加的役与宝牌。',points:['立直、门清自摸、断幺九、平和、役牌是日常主体。','宝牌和赤宝牌可以叠加，却仍不能单独提供和牌资格。','同一手常同时拥有多个役。'],questions:yakuRecognitionQuestions('high',high) }),
  lesson({ id:'open-yaku',phaseId:'complete-yaku',order:14,title:'吃碰以后，役还剩多少？',subtitle:'副露变化专项',intro:'这是从其他麻将切换过来最容易付出代价的地方。',keyPoint:'鸣牌前同时说出役名和副露后的番数。',points:['立直、平和、一杯口、七对子等门清限定役会消失。','三色同顺、一气通贯、混全、纯全、混一色、清一色副露减一番。','断幺九、役牌、对对和等副露不减番。'],questions:openChangeQuestions([...high,...common,...occasional]) }),
  lesson({ id:'regular-yaku',phaseId:'complete-yaku',order:15,title:'常见与偶尔出现的组合役',subtitle:'不强做，但要会看',intro:'这些役经常作为既有牌形的加分方向出现。',keyPoint:'认出自然路线，不为役名强拆高效牌。',points:['三色同顺与一气通贯是顺子手常见加分方向。','对对和、三暗刻、小三元常与役牌或混一色叠加。','混全与纯全会牺牲中张牌效，不应看到幺九就强做。'],questions:yakuRecognitionQuestions('regular',[...common,...occasional]) }),
  lesson({ id:'rare-yaku',phaseId:'complete-yaku',order:16,title:'罕见役：见到时认识就够了',subtitle:'低频役与役满地图',intro:'不拿宝贵练习时间反复刷三色同刻，但完整规则不能留白。',keyPoint:'罕见役先会识别；役满知道成立条件，实战遇到再回看。',points:['岭上、抢杠、海底、河底依赖特殊和牌时机。','三杠子、三色同刻、二杯口等实战非常少见。','国士、四暗刻、大三元等役满不再与普通番数相加。'],questions:yakuRecognitionQuestions('rare',rare),sessionSize:12,poolLabel:`${rare.length}题低频题库 · 每次抽12题` }),
  lesson({ id:'han-review',phaseId:'complete-yaku',order:17,title:'把役种按番数再记一遍',subtitle:'从役名反查番数',intro:'换一个提问方向，才能确认不是只会看关键词猜答案。',keyPoint:'1番是日常骨架；副露减番的役要成对记忆。',points:['1番役数量最多，也最常决定能不能和。','2～3番役常作为结构奖励。','混一色3/2、清一色6/5是最重要的门清/副露番差。'],questions:hanReviewQuestions(),sessionSize:12,poolLabel:'全役番数题库 · 每次抽12题' }),
  lesson({ id:'route-planning',phaseId:'complete-yaku',order:18,title:'从约三向听手牌看可能的役',subtitle:'多选路线判断',intro:'不是问最后会做成什么，而是问现在有哪些自然路线值得保留。',keyPoint:'可以同时保留多个方向；进张以后再收窄，不要过早锁死。',points:['先选不需要大幅拆牌的自然役。','普通面子手与七对、国士可在早期动态比较。','“可能”不等于必须追求，牌效仍是第一层筛选。'],questions:routeQuestions }),
  lesson({ id:'fu-basics',phaseId:'scoring',order:19,title:'符只学够用的部分',subtitle:'常见符数快速判断',intro:'不从罕见110符开始背；先让常见点数能算出来。',keyPoint:'先记20、25、30符三个锚点，再逐项加符并向上取整。',points:['平和自摸20符；七对子固定25符；门清荣和常从30符起。','刻子、杠子、役牌雀头与愚形等待会加符。','课程只大量练常见20～70符，题目最多一副杠。'],questions:fuQuestions }),
  lesson({ id:'score-ron',phaseId:'scoring',order:20,title:'荣和点数练到形成反射',subtitle:'子家与亲家荣和',intro:`${MAJSOUL_RULESET.description}`,keyPoint:'先分亲子，再由番符查点；4番30符仍是7700/11600。',points:['子家常见阶梯包含1000、1300、1600、2000、2600、3200、3900、5200、6400、7700。','亲家支付约为子家的1.5倍，并向上取整到百点。','每次随机抽12题，题库共100题。'],questions:generateScorePool('ron-score',100,'ron'),sessionSize:12,poolLabel:'100题荣和题库 · 每次抽12题' }),
  lesson({ id:'score-tsumo',phaseId:'scoring',order:21,title:'自摸支付：先看谁是庄家',subtitle:'亲子与三家分担',intro:'子家自摸由庄家支付较多；亲家自摸则三家支付相同。',keyPoint:'子家自摸读作“闲家支付 / 庄家支付”；亲家自摸三家同额。',points:['子家自摸：两位子家付一份，庄家付两份。','亲家自摸：三位子家支付相同。','每本场自摸时每家另付100点。'],questions:generateScorePool('mixed-score',120,'mixed'),sessionSize:12,poolLabel:'120题亲子/自摸题库 · 每次抽12题' }),
  lesson({ id:'score-limit',phaseId:'scoring',order:22,title:'满贯以上反而更简单',subtitle:'跳满到役满',intro:'达到满贯后不再逐符计算，按番数档位支付。',keyPoint:'5满贯、6～7跳满、8～10倍满、11～12三倍满、13+役满。',points:['本规则不切上满贯：4番30符是7700/11600，不抬到满贯。','满贯、跳满、倍满、三倍满和役满只需记档位。','宝牌可推高番数，但仍需先有役。'],questions:generateScorePool('limit-score',80,'limit'),sessionSize:12,poolLabel:'80题满贯以上题库 · 每次抽12题' }),
  lesson({ id:'table-details',phaseId:'rule-details',order:23,title:'把真正开局会碰到的细节补齐',subtitle:'鸣牌、杠、流局与点棒',intro:'这些规则不需要第一小时全背，但打牌遇到时必须有地方查。',keyPoint:'先掌握高频流程；罕见流局与特殊责任规则作为查阅项。',points:['吃只来自上家；碰和杠的优先级高于吃，和牌最高。','杠会补岭上牌并翻新指示牌；立直后暗杠受严格限制。','本场、供托、荒牌流局听牌罚符都会改变点数结算。','赤五既是普通五，也额外算赤宝牌；命中普通宝牌时可以叠加。'],questions:otherRuleQuestions }),
]

import type { TileCode } from '../domain/tiles'
import type { RuleChoice, RuleLesson, RulePhase, RuleQuestion, RuleStudySection } from './course'
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

const yakuNotes: Readonly<Record<string, string>> = {
  riichi: '常见误区：门清还不够，必须已经听牌；立直后原则上不能换听。',
  'menzen-tsumo': '常见误区：只有门清自摸才有这一番；副露后自摸本身不是役。',
  tanyao: '雀魂采用食断：吃碰后仍成立。和牌时不能留下任何一、九或字牌。',
  pinfu: '四项同时检查：门清、全顺子、非役牌雀头、两面等待。',
  yakuhai: '白发中永远是役牌；风牌只有场风和自风有役，双风刻子可算两番。',
  ippatsu: '任何玩家的吃、碰、杠都会打断一发机会；暗杠也会打断。',
  iipeikou: '必须是同一花色、完全相同的两组顺子，而且只能门清。',
  chiitoitsu: '七种不同对子；四张相同牌不能拆成两个对子。',
  toitoi: '明刻也可以，所以常与役牌、混一色叠加。',
  'sanshoku-doujun': '看的是三门相同顺子，例如三门都有345；副露后由2番降为1番。',
  ittsu: '同一花色必须同时具备123、456、789；副露后由2番降为1番。',
  honitsu: '只能有一门数牌和字牌；门清3番，副露2番。',
  chinitsu: '只能有一门数牌，不能有字牌；门清6番，副露5番。',
  chanta: '每组都碰到幺九或字牌，并且牌里既有顺子也有字牌。',
  junchan: '每组都碰到一或九，但完全没有字牌；副露后由3番降为2番。',
  honroutou: '只有一、九与字牌，必然由刻子/对子构成，可与七对子或对对和叠加。',
  shousangen: '两组三元刻子加剩下一种三元雀头；两组役牌的番数还要另外算。',
  sanankou: '已经副露别的组仍可能成立；关键是有三组暗刻。双碰荣和完成的刻子不算暗刻。',
}

function yakuStudySection(title: string, yakus: readonly YakuDefinition[], intro?: string): RuleStudySection {
  return {
    title,
    intro,
    items: yakus.map((yaku) => ({
      title: yaku.name,
      badge: `门清 ${hanLabel(yaku, false)} · ${hanLabel(yaku, true)}`,
      body: yaku.summary,
      note: yakuNotes[yaku.id],
    })),
  }
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

const doraStudy: RuleStudySection = {
  title: '宝牌要和役分开数',
  intro: '宝牌非常常见，所以必须放在高频课里；但它不属于役。',
  items: [
    { title: '普通宝牌', badge: '每张＋1番', body: '指示牌的下一张才是宝牌；数牌、风牌和三元牌分别按自己的循环。', note: '没有役时，即使有很多宝牌也不能和。' },
    { title: '赤宝牌', badge: '三张赤五', body: '雀魂四麻的5万、5饼、5条各有一张赤五；功能上仍是普通五，同时自带1番。', note: '若5本身也是普通宝牌，同一张赤5可以同时计算两份宝牌。' },
    { title: '里宝牌与杠宝牌', badge: '满足条件才翻', body: '立直和牌后才能看里宝牌；开杠后会增加杠宝牌指示牌。', note: '先确认役和和牌，再把所有宝牌加入番数。' },
  ],
}

const openStudySections: readonly RuleStudySection[] = [
  yakuStudySection('一吃碰就消失：门清限定役', [...high, ...common, ...occasional].filter((yaku) => yaku.hanOpen === null), '这些役的成立条件本身包含“门清”。鸣牌前必须知道自己会失去它们。'),
  yakuStudySection('副露后减一番：食下役', [...common, ...occasional].filter((yaku) => typeof yaku.hanOpen === 'number' && yaku.hanOpen !== yaku.hanClosed), '牌型仍成立，但开放手牌降低一番。最常用的记忆组是三色、一气、混全、纯全、混一色、清一色。'),
  yakuStudySection('副露后番数不变', [...high, ...common, ...occasional].filter((yaku) => yaku.hanOpen !== null && yaku.hanOpen === yaku.hanClosed), '这些役可以放心用明刻或明顺完成，但仍要比较鸣牌是否真的提高速度。'),
]

const hanStudySections: readonly RuleStudySection[] = [1, 2, 3, 6].map((han) => ({
  title: `${han}番役速查`,
  items: yakuCatalog.filter((yaku) => yaku.id !== 'dora' && yaku.hanClosed === han).map((yaku) => ({
    title: yaku.name,
    badge: yaku.hanOpen === null ? '仅门清' : yaku.hanOpen === han ? '副露不减番' : `副露 ${yaku.hanOpen}番`,
    body: yaku.summary,
  })),
}))

const routeStudySections: readonly RuleStudySection[] = [{
  title: '看约三向听手牌的三步法',
  items: [
    { title: '第一步：先看现成骨架', badge: '不拆牌也能保留', body: '中张顺子多就观察立直、平和、断幺；三门同数字顺子观察三色；一门123/456/789观察一气。' },
    { title: '第二步：再看特殊路线距离', badge: '动态比较', body: '对子很多时同时比较七对与普通手；幺九字牌种类很多时观察国士；一门明显集中时观察染手。' },
    { title: '第三步：进张后重新判断', badge: '可能 ≠ 必做', body: '现在能期待的役可以有多个。下一张牌可能强化其中一条，也可能让原路线不再划算。' },
  ],
}]

const fuStudySections: readonly RuleStudySection[] = [
  { title:'先记三个不用计算的锚点',items:[
    {title:'平和自摸',badge:'20符',body:'门清平和自摸固定看作20符；这是最常见的20符和牌。'},
    {title:'七对子',badge:'25符',body:'固定25符，不再累加刻子、雀头或等待符。'},
    {title:'门清荣和',badge:'至少30符',body:'副底20符加门清荣和10符，因此通常从30符开始。'},
  ]},
  { title:'普通手牌怎样逐项加符',intro:'从20符副底开始，命中哪些项目就加哪些，最后向上进到下一个10符。',items:[
    {title:'和牌方式',badge:'门清荣和＋10 / 自摸＋2',body:'平和自摸是20符例外；副露后荣和没有门清加符。'},
    {title:'雀头与等待',badge:'通常＋2',body:'三元牌、场风、自风雀头加符；坎张、边张、单骑等待也各加2符。'},
    {title:'刻子',badge:'明刻2/4 · 暗刻4/8',body:'中张在前、幺九字牌在后；幺九字牌刻子的符是中张两倍。'},
    {title:'杠子',badge:'明杠8/16 · 暗杠16/32',body:'同样是幺九字牌翻倍。本课程题目最多出现一副杠。'},
    {title:'最后取整',badge:'个位向上',body:'例如合计32符不是30符，而是向上按40符计算。'},
  ]},
]

const ronStudySections: readonly RuleStudySection[] = [
  { title:'子家荣和常用表',intro:'先找番，再找符。越过满贯线后改看满贯以上档位。',items:[
    {title:'1番',badge:'30符1000 · 40符1300 · 50符1600',body:'新手最常见的低打点起点。'},
    {title:'2番',badge:'30符2000 · 40符2600 · 50符3200',body:'2番60符是3900。'},
    {title:'3番',badge:'30符3900 · 40符5200 · 50符6400',body:'3番60符是7700，仍未自动变成满贯。'},
    {title:'4番',badge:'30符7700 · 40符满贯8000',body:'雀魂不切上满贯，所以4番30符保留7700。'},
  ]},
  { title:'亲家荣和常用表',items:[
    {title:'1番',badge:'30符1500 · 40符2000 · 50符2400',body:'亲家点数约为子家1.5倍，再向上取整到百点。'},
    {title:'2番',badge:'30符2900 · 40符3900 · 50符4800',body:'2番60符是5800。'},
    {title:'3番',badge:'30符5800 · 40符7700 · 50符9600',body:'3番60符是11600。'},
    {title:'4番',badge:'30符11600 · 40符满贯12000',body:'雀魂不切上满贯，所以4番30符保留11600。'},
  ]},
]

const tsumoStudySections: readonly RuleStudySection[] = [{
  title:'自摸数字应该怎样读',
  items:[
    {title:'子家自摸',badge:'闲家支付 / 庄家支付',body:'例如子家3番30符写作1000 / 2000：另外两位子家各付1000，庄家付2000。'},
    {title:'亲家自摸',badge:'同一数字∀',body:'例如亲家3番30符写作2000∀：三位子家各付2000。'},
    {title:'本场',badge:'每本场每家＋100',body:'自摸时每位付款者各多付100；荣和则放铳者每本场多付300。'},
    {title:'读总收益',badge:'不要只看较小数字',body:'子家1000/2000自摸的总收入是1000＋1000＋2000＝4000。'},
  ],
}]

const limitStudySections: readonly RuleStudySection[] = [{
  title:'满贯以上只背五档',
  items:[
    {title:'满贯',badge:'5番（或基础点达到上限）',body:'子家荣和8000，亲家荣和12000；子家自摸2000/4000，亲家自摸4000∀。'},
    {title:'跳满',badge:'6～7番',body:'子家荣和12000，亲家荣和18000；子家自摸3000/6000，亲家自摸6000∀。'},
    {title:'倍满',badge:'8～10番',body:'子家荣和16000，亲家荣和24000；子家自摸4000/8000，亲家自摸8000∀。'},
    {title:'三倍满',badge:'11～12番',body:'子家荣和24000，亲家荣和36000；子家自摸6000/12000，亲家自摸12000∀。'},
    {title:'役满',badge:'13番以上或役满役',body:'子家荣和32000，亲家荣和48000；子家自摸8000/16000，亲家自摸16000∀。'},
  ],
}]

const tableStudySections: readonly RuleStudySection[] = [
  {title:'鸣牌与杠',items:[
    {title:'吃',badge:'只能吃上家',body:'用上家的舍牌和自己两张牌组成顺子。和牌优先，碰/杠也优先于吃。'},
    {title:'碰与明杠',badge:'可取任意一家舍牌',body:'碰组成明刻；大明杠用三张相同手牌取得第四张，之后摸岭上牌。'},
    {title:'暗杠与加杠',badge:'会翻新指示牌',body:'暗杠用手中四张相同牌；加杠是在已有碰牌上补第四张。立直后暗杠受等待不变限制。'},
  ]},
  {title:'点棒、连庄与流局',items:[
    {title:'立直棒／供托',badge:'每根1000点',body:'宣布立直先支付1000点；无人和牌时留在场上，之后由和牌者取得。'},
    {title:'本场',badge:'荣和＋300 / 自摸每家＋100',body:'连庄或流局会累积本场，额外支付不改变役与番符。'},
    {title:'荒牌流局',badge:'听牌罚符共3000点',body:'牌山摸完无人和牌时，根据听牌人数在听牌者与未听牌者之间结算。'},
  ]},
  doraStudy,
]

export const advancedRulePhases: readonly RulePhase[] = [
  { id: 'complete-yaku', eyebrow: '详细规则 · 第一部分', title: '完整役种体系', goal: '按实战出现频率学习；高频反复练，罕见役只要求见到时认识。', lessonIds: ['common-yaku','open-yaku','regular-yaku','rare-yaku','han-review','route-planning'] },
  { id: 'scoring', eyebrow: '详细规则 · 第二部分', title: '常见和牌算分', goal: '先掌握常见符，再用短回合从数百道题库练到形成反射。', lessonIds: ['fu-basics','score-ron','score-tsumo','score-limit'] },
  { id: 'rule-details', eyebrow: '详细规则 · 第三部分', title: '牌桌细节补全', goal: '补齐鸣牌、杠、本场、供托、流局等真正开局后会遇到的规则。', lessonIds: ['table-details'] },
]

export const advancedRuleLessons: readonly RuleLesson[] = [
  lesson({ id:'common-yaku',phaseId:'complete-yaku',order:15,title:'先把高频役认到不假思索',subtitle:'高频役正反反复',intro:'这些役构成绝大多数真实和牌，值得重复。',keyPoint:'先看能否和，再数可以叠加的役与宝牌。',points:['立直、门清自摸、断幺九、平和、役牌是日常主体。','宝牌和赤宝牌可以叠加，却仍不能单独提供和牌资格。','同一手常同时拥有多个役。'],studySections:[yakuStudySection('五个最常用的和牌资格',high,'先读成立条件，再比较自己熟悉的麻将规则哪里不同。'),doraStudy],questions:yakuRecognitionQuestions('high',high) }),
  lesson({ id:'open-yaku',phaseId:'complete-yaku',order:16,title:'吃碰以后，役还剩多少？',subtitle:'副露变化专项',intro:'这是从其他麻将切换过来最容易付出代价的地方。',keyPoint:'鸣牌前同时说出役名和副露后的番数。',points:['立直、平和、一杯口、七对子等门清限定役会消失。','三色同顺、一气通贯、混全、纯全、混一色、清一色副露减一番。','断幺九、役牌、对对和等副露不减番。'],studySections:openStudySections,questions:openChangeQuestions([...high,...common,...occasional]) }),
  lesson({ id:'regular-yaku',phaseId:'complete-yaku',order:17,title:'常见与偶尔出现的组合役',subtitle:'不强做，但要会看',intro:'这些役经常作为既有牌形的加分方向出现。',keyPoint:'认出自然路线，不为役名强拆高效牌。',points:['三色同顺与一气通贯是顺子手常见加分方向。','对对和、三暗刻、小三元常与役牌或混一色叠加。','混全与纯全会牺牲中张牌效，不应看到幺九就强做。'],studySections:[yakuStudySection('实战常见的加分役',common),yakuStudySection('偶尔出现：认识自然机会',occasional)],questions:yakuRecognitionQuestions('regular',[...common,...occasional]) }),
  lesson({ id:'rare-yaku',phaseId:'complete-yaku',order:18,title:'罕见役：见到时认识就够了',subtitle:'低频役与役满地图',intro:'不拿宝贵练习时间反复刷三色同刻，但完整规则不能留白。',keyPoint:'罕见役先会识别；役满知道成立条件，实战遇到再回看。',points:['岭上、抢杠、海底、河底依赖特殊和牌时机。','三杠子、三色同刻、二杯口等实战非常少见。','国士、四暗刻、大三元等役满不再与普通番数相加。'],studySections:[yakuStudySection('低频役与役满速查',rare,'这一页是查阅地图，不要求一次背完；先阅读一遍，再从题库随机复习。')],questions:yakuRecognitionQuestions('rare',rare),sessionSize:12,poolLabel:`${rare.length}题低频题库 · 每次抽12题` }),
  lesson({ id:'han-review',phaseId:'complete-yaku',order:19,title:'把役种按番数再记一遍',subtitle:'从役名反查番数',intro:'换一个提问方向，才能确认不是只会看关键词猜答案。',keyPoint:'1番是日常骨架；副露减番的役要成对记忆。',points:['1番役数量最多，也最常决定能不能和。','2～3番役常作为结构奖励。','混一色3/2、清一色6/5是最重要的门清/副露番差。'],studySections:hanStudySections,questions:hanReviewQuestions(),sessionSize:12,poolLabel:'全役番数题库 · 每次抽12题' }),
  lesson({ id:'route-planning',phaseId:'complete-yaku',order:20,title:'从约三向听手牌看可能的役',subtitle:'多选路线判断',intro:'不是问最后会做成什么，而是问现在有哪些自然路线值得保留。',keyPoint:'可以同时保留多个方向；进张以后再收窄，不要过早锁死。',points:['先选不需要大幅拆牌的自然役。','普通面子手与七对、国士可在早期动态比较。','“可能”不等于必须追求，牌效仍是第一层筛选。'],studySections:routeStudySections,questions:routeQuestions }),
  lesson({ id:'fu-basics',phaseId:'scoring',order:21,title:'符只学够用的部分',subtitle:'常见符数快速判断',intro:'不从罕见110符开始背；先让常见点数能算出来。',keyPoint:'先记20、25、30符三个锚点，再逐项加符并向上取整。',points:['平和自摸20符；七对子固定25符；门清荣和常从30符起。','刻子、杠子、役牌雀头与愚形等待会加符。','课程只大量练常见20～70符，题目最多一副杠。'],studySections:fuStudySections,questions:fuQuestions }),
  lesson({ id:'score-ron',phaseId:'scoring',order:22,title:'荣和点数练到形成反射',subtitle:'子家与亲家荣和',intro:`${MAJSOUL_RULESET.description}`,keyPoint:'先分亲子，再由番符查点；4番30符仍是7700/11600。',points:['子家常见阶梯包含1000、1300、1600、2000、2600、3200、3900、5200、6400、7700。','亲家支付约为子家的1.5倍，并向上取整到百点。','每次随机抽12题，题库共100题。'],studySections:ronStudySections,questions:generateScorePool('ron-score',100,'ron'),sessionSize:12,poolLabel:'100题荣和题库 · 每次抽12题' }),
  lesson({ id:'score-tsumo',phaseId:'scoring',order:23,title:'自摸支付：先看谁是庄家',subtitle:'亲子与三家分担',intro:'子家自摸由庄家支付较多；亲家自摸则三家支付相同。',keyPoint:'子家自摸读作“闲家支付 / 庄家支付”；亲家自摸三家同额。',points:['子家自摸：两位子家付一份，庄家付两份。','亲家自摸：三位子家支付相同。','每本场自摸时每家另付100点。'],studySections:tsumoStudySections,questions:generateScorePool('mixed-score',120,'mixed'),sessionSize:12,poolLabel:'120题亲子/自摸题库 · 每次抽12题' }),
  lesson({ id:'score-limit',phaseId:'scoring',order:24,title:'满贯以上反而更简单',subtitle:'跳满到役满',intro:'达到满贯后不再逐符计算，按番数档位支付。',keyPoint:'5满贯、6～7跳满、8～10倍满、11～12三倍满、13+役满。',points:['本规则不切上满贯：4番30符是7700/11600，不抬到满贯。','满贯、跳满、倍满、三倍满和役满只需记档位。','宝牌可推高番数，但仍需先有役。'],studySections:limitStudySections,questions:generateScorePool('limit-score',80,'limit'),sessionSize:12,poolLabel:'80题满贯以上题库 · 每次抽12题' }),
  lesson({ id:'table-details',phaseId:'rule-details',order:25,title:'把真正开局会碰到的细节补齐',subtitle:'鸣牌、杠、流局与点棒',intro:'这些规则不需要第一小时全背，但打牌遇到时必须有地方查。',keyPoint:'先掌握高频流程；罕见流局与特殊责任规则作为查阅项。',points:['吃只来自上家；碰和杠的优先级高于吃，和牌最高。','杠会补岭上牌并翻新指示牌；立直后暗杠受严格限制。','本场、供托、荒牌流局听牌罚符都会改变点数结算。','赤五既是普通五，也额外算赤宝牌；命中普通宝牌时可以叠加。'],studySections:tableStudySections,questions:otherRuleQuestions }),
]

export const MAJSOUL_RULESET = {
  id: 'mahjong-soul-four-player',
  label: '雀魂四人麻将标准规则',
  redFives: 3,
  openTanyao: true,
  kiriageMangan: false,
  description: '三张赤五、食断开启；不采用切上满贯，因此保留 2600、5200、7700、11600。',
} as const

export type YakuFrequency = '高频' | '常见' | '偶尔' | '罕见'

export interface YakuDefinition {
  id: string
  name: string
  hanClosed: number | '役满' | '双倍役满'
  hanOpen: number | '役满' | '双倍役满' | null
  frequency: YakuFrequency
  summary: string
}

export const yakuCatalog: readonly YakuDefinition[] = [
  { id: 'riichi', name: '立直', hanClosed: 1, hanOpen: null, frequency: '高频', summary: '门清听牌时支付1000点宣告。' },
  { id: 'menzen-tsumo', name: '门前清自摸和', hanClosed: 1, hanOpen: null, frequency: '高频', summary: '门清状态下自摸和牌。' },
  { id: 'tanyao', name: '断幺九', hanClosed: 1, hanOpen: 1, frequency: '高频', summary: '全手只使用2～8数牌；雀魂允许副露。' },
  { id: 'pinfu', name: '平和', hanClosed: 1, hanOpen: null, frequency: '高频', summary: '门清、全顺子、非役牌雀头、两面听。' },
  { id: 'yakuhai', name: '役牌', hanClosed: 1, hanOpen: 1, frequency: '高频', summary: '三元牌、场风或自风的刻子/杠子，每项各1番。' },
  { id: 'dora', name: '宝牌／赤宝牌', hanClosed: 1, hanOpen: 1, frequency: '高频', summary: '每张加1番但不是役；三种花色各有一张赤五。' },
  { id: 'ippatsu', name: '一发', hanClosed: 1, hanOpen: null, frequency: '常见', summary: '立直后无鸣牌打断的一巡内和牌。' },
  { id: 'iipeikou', name: '一杯口', hanClosed: 1, hanOpen: null, frequency: '常见', summary: '门清手中同一花色两组相同顺子。' },
  { id: 'chiitoitsu', name: '七对子', hanClosed: 2, hanOpen: null, frequency: '常见', summary: '七种不同对子，固定25符。' },
  { id: 'toitoi', name: '对对和', hanClosed: 2, hanOpen: 2, frequency: '常见', summary: '四组刻子或杠子。' },
  { id: 'sanshoku-doujun', name: '三色同顺', hanClosed: 2, hanOpen: 1, frequency: '常见', summary: '万饼条三门各有同数字顺子。' },
  { id: 'ittsu', name: '一气通贯', hanClosed: 2, hanOpen: 1, frequency: '常见', summary: '同一花色拥有123、456、789。' },
  { id: 'honitsu', name: '混一色', hanClosed: 3, hanOpen: 2, frequency: '常见', summary: '一门数牌加字牌。' },
  { id: 'chinitsu', name: '清一色', hanClosed: 6, hanOpen: 5, frequency: '常见', summary: '全手只有一门数牌。' },
  { id: 'chanta', name: '混全带幺九', hanClosed: 2, hanOpen: 1, frequency: '偶尔', summary: '每组及雀头都含幺九或字牌，且至少有顺子和字牌。' },
  { id: 'junchan', name: '纯全带幺九', hanClosed: 3, hanOpen: 2, frequency: '偶尔', summary: '每组及雀头都含一或九，没有字牌，且至少有顺子。' },
  { id: 'honroutou', name: '混老头', hanClosed: 2, hanOpen: 2, frequency: '偶尔', summary: '全手只有幺九牌和字牌。' },
  { id: 'shousangen', name: '小三元', hanClosed: 2, hanOpen: 2, frequency: '偶尔', summary: '两组三元牌刻子，加一组三元牌雀头；役牌另计。' },
  { id: 'sanankou', name: '三暗刻', hanClosed: 2, hanOpen: 2, frequency: '偶尔', summary: '三组自己摸齐的暗刻；荣和完成的那组通常不算暗刻。' },
  { id: 'double-riichi', name: '两立直', hanClosed: 2, hanOpen: null, frequency: '罕见', summary: '第一巡、无人鸣牌前立直。' },
  { id: 'haitei', name: '海底摸月', hanClosed: 1, hanOpen: 1, frequency: '罕见', summary: '牌山最后一张自摸。' },
  { id: 'houtei', name: '河底捞鱼', hanClosed: 1, hanOpen: 1, frequency: '罕见', summary: '最后一张舍牌荣和。' },
  { id: 'rinshan', name: '岭上开花', hanClosed: 1, hanOpen: 1, frequency: '罕见', summary: '开杠后从岭上牌自摸和牌。' },
  { id: 'chankan', name: '抢杠', hanClosed: 1, hanOpen: 1, frequency: '罕见', summary: '他人加杠时以该牌荣和。' },
  { id: 'sankantsu', name: '三杠子', hanClosed: 2, hanOpen: 2, frequency: '罕见', summary: '一手牌完成三组杠。' },
  { id: 'sanshoku-doukou', name: '三色同刻', hanClosed: 2, hanOpen: 2, frequency: '罕见', summary: '万饼条三门各有同数字刻子；实战极少见。' },
  { id: 'ryanpeikou', name: '二杯口', hanClosed: 3, hanOpen: null, frequency: '罕见', summary: '门清手中有两组一杯口；不与七对子重复。' },
  { id: 'nagashi', name: '流局满贯', hanClosed: 5, hanOpen: null, frequency: '罕见', summary: '荒牌流局时自己的舍牌全为幺九字牌且未被鸣走。' },
  { id: 'kokushi', name: '国士无双', hanClosed: '役满', hanOpen: null, frequency: '罕见', summary: '十三种幺九字牌各一张，其中一种成对。' },
  { id: 'kokushi-13', name: '国士无双十三面', hanClosed: '双倍役满', hanOpen: null, frequency: '罕见', summary: '十三种幺九字牌各一张，等待其中任意一种成对。' },
  { id: 'suuankou', name: '四暗刻', hanClosed: '役满', hanOpen: null, frequency: '罕见', summary: '四组暗刻；双碰荣和通常不能成立。' },
  { id: 'suuankou-tanki', name: '四暗刻单骑', hanClosed: '双倍役满', hanOpen: null, frequency: '罕见', summary: '四组暗刻已经完成，以雀头单骑和牌。' },
  { id: 'daisangen', name: '大三元', hanClosed: '役满', hanOpen: '役满', frequency: '罕见', summary: '白发中全部组成刻子或杠子。' },
  { id: 'shousuushii', name: '小四喜', hanClosed: '役满', hanOpen: '役满', frequency: '罕见', summary: '三组风刻，第四种风作雀头。' },
  { id: 'daisuushii', name: '大四喜', hanClosed: '双倍役满', hanOpen: '双倍役满', frequency: '罕见', summary: '四种风牌全部组成刻子或杠子。' },
  { id: 'tsuuiisou', name: '字一色', hanClosed: '役满', hanOpen: '役满', frequency: '罕见', summary: '全手只有字牌。' },
  { id: 'chinroutou', name: '清老头', hanClosed: '役满', hanOpen: '役满', frequency: '罕见', summary: '全手只有数牌的一和九。' },
  { id: 'ryuuiisou', name: '绿一色', hanClosed: '役满', hanOpen: '役满', frequency: '罕见', summary: '只使用条子的2、3、4、6、8及发。' },
  { id: 'chuuren', name: '九莲宝灯', hanClosed: '役满', hanOpen: null, frequency: '罕见', summary: '门清清一色中的1112345678999加同门任一张。' },
  { id: 'junsei-chuuren', name: '纯正九莲宝灯', hanClosed: '双倍役满', hanOpen: null, frequency: '罕见', summary: '先完成1112345678999，再等待同门任意一张。' },
  { id: 'suukantsu', name: '四杠子', hanClosed: '役满', hanOpen: '役满', frequency: '罕见', summary: '同一人完成四组杠。' },
  { id: 'tenhou', name: '天和', hanClosed: '役满', hanOpen: null, frequency: '罕见', summary: '庄家配牌即和。' },
  { id: 'chiihou', name: '地和', hanClosed: '役满', hanOpen: null, frequency: '罕见', summary: '闲家第一巡、无人鸣牌前自摸和。' },
] as const

export function hanLabel(yaku: YakuDefinition, open: boolean): string {
  const value = open ? yaku.hanOpen : yaku.hanClosed
  if (value === null) return '副露后不成立'
  return typeof value === 'number' ? `${value}番` : value
}
